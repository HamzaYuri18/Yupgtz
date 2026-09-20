import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertCircle, CalendarRange, CheckCircle2, FileSpreadsheet, Search, Upload, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

type SecondaryView = 'encaissement' | 'motifs';

const SECONDARY_TABLES: Record<SecondaryView, { table: string; dateColumn: string; label: string }> = {
  encaissement: { table: 'terme_encaissement_details', dateColumn: 'date_input', label: 'Détails de la vérification des encaissements' },
  motifs: { table: 'attestations_motifs', dateColumn: 'date_input', label: 'Motifs des attestations servies non comptabilisées' },
};

const prettyHeader = (key: string): string => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const formatCell = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'number') return value.toLocaleString('fr-FR');
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return value.length > 10 ? date.toLocaleString('fr-FR') : date.toLocaleDateString('fr-FR');
    }
  }
  return String(value);
};

type VerificationStatus = 'bon' | 'non-encaisse' | 'alerte' | 'introuvable';

interface ImportRow {
  souscripteur: string;
  police: string;
  dateEffective: string;
  montantTTC: number | null;
  commissions: number | null;
  sousType: string;
  ligne: number;
}

interface VerificationRow extends ImportRow {
  dateEncaissement: string | null;
  primeNette: number | null;
  dateStatus: 'bon' | 'non-encaisse' | 'alerte' | 'introuvable';
  montantStatus: 'bon' | 'alerte' | 'non-verifie';
  error?: string;
}

const normalizeHeader = (value: unknown): string => String(value ?? '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '');

const normalizeContract = (value: unknown): string => String(value ?? '').trim().toUpperCase();

const parseAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDate = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'number') {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const frenchDate = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (frenchDate) return `${frenchDate[3]}-${frenchDate[2].padStart(2, '0')}-${frenchDate[1].padStart(2, '0')}`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString().slice(0, 10);
};

const formatDate = (value: string | null): string => {
  if (!value) return 'Non renseignée';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-FR');
};

const formatAmount = (value: number | null): string => value === null ? 'Non renseigné' : `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT`;

const findColumn = (headers: string[], names: string[]): number => {
  const aliases = names.map(normalizeHeader);
  return headers.findIndex((header) => aliases.includes(header));
};

const parseFile = (file: File): Promise<ImportRow[]> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const workbook = XLSX.read(new Uint8Array(event.target?.result as ArrayBuffer), { type: 'array', cellDates: false });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: true });

      // Trouver la ligne d'en-tête: celle qui contient "Souscripteur"
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(rows.length, 20); i += 1) {
        const rowCells = (rows[i] || []).map(normalizeHeader);
        if (rowCells.some((cell) => cell === 'souscripteur' || cell === 'assure' || cell === 'assure')) {
          headerRowIndex = i;
          break;
        }
      }

      const headers = headerRowIndex >= 0
        ? (rows[headerRowIndex] || []).map(normalizeHeader)
        : (rows[0] || []).map(normalizeHeader);
      const start = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;

      const souscripteurIndex = findColumn(headers, ['Souscripteur', 'Assuré', 'Assure']);
      const policeIndex = findColumn(headers, ['Police', 'Numéro police', 'Numero contrat', 'Contrat']);
      const dateIndex = findColumn(headers, ['Date effective', 'Date effet', 'Date']);
      const montantIndex = findColumn(headers, ['Montant TTC', 'Montant']);
      const commissionsIndex = findColumn(headers, ['Comissions', 'Commissions', 'Commission']);
      const sousTypeIndex = findColumn(headers, ['Sous-type', 'Sous type', 'Soustype']);

      const resolvedSouscripteurIndex = souscripteurIndex >= 0 ? souscripteurIndex : 0;
      const resolvedPoliceIndex = policeIndex >= 0 ? policeIndex : 1;
      const resolvedDateIndex = dateIndex >= 0 ? dateIndex : 2;
      const resolvedMontantIndex = montantIndex >= 0 ? montantIndex : 3;
      const resolvedCommissionsIndex = commissionsIndex >= 0 ? commissionsIndex : 4;
      const resolvedSousTypeIndex = sousTypeIndex >= 0 ? sousTypeIndex : 5;

      const importedRows: ImportRow[] = [];
      for (let index = start; index < rows.length; index += 1) {
        const row = rows[index] || [];
        const police = normalizeContract(row[resolvedPoliceIndex]);
        if (!police) continue;
        importedRows.push({
          souscripteur: String(row[resolvedSouscripteurIndex] ?? '').trim(),
          police,
          dateEffective: parseDate(row[resolvedDateIndex]),
          montantTTC: parseAmount(row[resolvedMontantIndex]),
          commissions: parseAmount(row[resolvedCommissionsIndex]),
          sousType: String(row[resolvedSousTypeIndex] ?? '').trim(),
          ligne: index + 1
        });
      }
      resolve(importedRows);
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Fichier Excel invalide'));
    }
  };
  reader.onerror = () => reject(new Error('Impossible de lire le fichier Excel'));
  reader.readAsArrayBuffer(file);
});

const VerificationEncaissements: React.FC = () => {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [results, setResults] = useState<VerificationRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<'tous' | VerificationStatus>('tous');

  // ── Consultation par plage de dates (terme_encaissement_details / attestations_motifs) ──
  const [secondaryView, setSecondaryView] = useState<SecondaryView>('encaissement');
  const [secDateFrom, setSecDateFrom] = useState('');
  const [secDateTo, setSecDateTo] = useState('');
  const [secondaryRows, setSecondaryRows] = useState<Record<string, unknown>[]>([]);
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [secondaryError, setSecondaryError] = useState('');
  const [secondarySearched, setSecondarySearched] = useState(false);
  const [secondaryTotalCount, setSecondaryTotalCount] = useState<number | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage('');
    setResults([]);
    try {
      const importedRows = await parseFile(file);
      setRows(importedRows);
      setFileName(file.name);
      if (importedRows.length === 0) setMessage('Aucune ligne exploitable avec une colonne Police n’a été trouvée.');
    } catch (error) {
      setRows([]);
      setFileName('');
      setMessage(error instanceof Error ? error.message : 'Erreur lors de la lecture du fichier');
    }
  };

  const verifyRows = async () => {
    if (rows.length === 0) {
      setMessage('Veuillez charger un fichier Excel avant de lancer la vérification.');
      return;
    }
    setIsLoading(true);
    setMessage('');
    try {
      const { data, error } = await supabase
        .from('terme')
        .select('numero_contrat, "Date_Encaissement", prime_nette');
      if (error) throw error;

      const termeByPolice = new Map<string, { dateEncaissement: string | null; primeNette: number | null }>();
      for (const terme of data || []) {
        const police = normalizeContract(terme.numero_contrat);
        if (police && !termeByPolice.has(police)) {
          termeByPolice.set(police, {
            dateEncaissement: terme.Date_Encaissement ? parseDate(terme.Date_Encaissement) : null,
            primeNette: parseAmount(terme.prime_nette)
          });
        }
      }

      setResults(rows.map((row): VerificationRow => {
        const terme = termeByPolice.get(row.police);
        if (!terme) {
          return { ...row, dateEncaissement: null, primeNette: null, dateStatus: 'introuvable', montantStatus: 'non-verifie', error: 'Police introuvable dans la table terme' };
        }
        const dateStatus: VerificationStatus = !terme.dateEncaissement
          ? 'non-encaisse'
          : terme.dateEncaissement === row.dateEffective ? 'bon' : 'alerte';
        const montantStatus = row.montantTTC !== null && terme.primeNette !== null && Math.abs(row.montantTTC - terme.primeNette) < 0.01 ? 'bon' : 'alerte';
        return { ...row, dateEncaissement: terme.dateEncaissement, primeNette: terme.primeNette, dateStatus, montantStatus };
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erreur lors de la vérification');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSecondaryData = async () => {
    if (!secDateFrom || !secDateTo) {
      setSecondaryError('Veuillez sélectionner une date de début et une date de fin.');
      return;
    }
    setSecondaryLoading(true);
    setSecondaryError('');
    setSecondarySearched(true);
    setSecondaryTotalCount(null);
    try {
      const { table, dateColumn } = SECONDARY_TABLES[secondaryView];
      // Borne de fin inclusive jusqu'à la toute fin de la journée : si la
      // colonne est un timestamp (pas juste une date), comparer à
      // "secDateTo" tout court exclut silencieusement toutes les lignes de
      // ce jour-là enregistrées après minuit — ça se traduit par "aucune
      // donnée" alors que la table est bien remplie.
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .gte(dateColumn, secDateFrom)
        .lte(dateColumn, `${secDateTo}T23:59:59.999`)
        .order(dateColumn, { ascending: false });
      if (error) throw error;
      console.log(`🔍 ${table} (${dateColumn} entre ${secDateFrom} et ${secDateTo}): ${count ?? data?.length ?? 0} ligne(s)`);
      setSecondaryRows(data || []);

      // Diagnostic : si le filtre par date ne renvoie rien, on compte les
      // lignes visibles dans la table SANS filtre de date. Ça distingue un
      // problème de RLS/permissions (0 dans les deux cas, alors que
      // l'utilisateur voit des lignes dans Supabase) d'un problème de plage
      // de dates ou de format de colonne (0 filtré mais > 0 au total).
      if ((count ?? data?.length ?? 0) === 0) {
        const { count: totalCount, error: totalError } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        if (!totalError) setSecondaryTotalCount(totalCount ?? 0);
      }
    } catch (error) {
      setSecondaryError(error instanceof Error ? error.message : 'Erreur lors du chargement des données.');
      setSecondaryRows([]);
    } finally {
      setSecondaryLoading(false);
    }
  };

  const secondaryColumns = useMemo(
    () => (secondaryRows.length > 0 ? Object.keys(secondaryRows[0]) : []),
    [secondaryRows]
  );

  const filteredResults = useMemo(() => {
    if (filter === 'tous') return results;
    if (filter === 'alerte') return results.filter((result) => result.dateStatus === 'alerte' || result.montantStatus === 'alerte');
    return results.filter((result) => result.dateStatus === filter);
  }, [filter, results]);
  const summary = useMemo(() => ({
    total: results.length,
    bon: results.filter((result) => result.dateStatus === 'bon' && result.montantStatus === 'bon').length,
    nonEncaisse: results.filter((result) => result.dateStatus === 'non-encaisse').length,
    alertes: results.filter((result) => result.dateStatus === 'alerte' || result.montantStatus === 'alerte').length,
    introuvables: results.filter((result) => result.dateStatus === 'introuvable').length
  }), [results]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700"><FileSpreadsheet className="w-6 h-6" /></div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Vérification des encaissements</h2>
                <p className="text-sm text-slate-500 mt-1">Comparez les encaissements PI avec les données de l’application.</p>
              </div>
            </div>
          </div>
          <label className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white font-semibold cursor-pointer hover:bg-slate-700 transition-colors">
            <Upload className="w-4 h-4" /> Charger un fichier Excel
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
          </label>
        </div>
        {fileName && <p className="mt-5 text-sm text-slate-600">Fichier chargé: <span className="font-semibold text-slate-900">{fileName}</span> — {rows.length} ligne(s)</p>}
        {message && <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{message}</div>}
        <button onClick={verifyRows} disabled={isLoading || rows.length === 0} className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          <Search className="w-4 h-4" /> {isLoading ? 'Vérification en cours...' : 'Lancer la vérification'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 rounded-xl bg-indigo-100 text-indigo-700"><CalendarRange className="w-6 h-6" /></div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Détails par plage de dates</h2>
            <p className="text-sm text-slate-500 mt-1">Consultez les détails de la vérification des encaissements, ou les motifs des attestations servies non comptabilisées.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {(Object.keys(SECONDARY_TABLES) as SecondaryView[]).map((view) => (
            <button
              key={view}
              onClick={() => { setSecondaryView(view); setSecondaryRows([]); setSecondarySearched(false); setSecondaryError(''); }}
              className={`px-4 py-2 rounded-xl font-semibold text-sm transition-colors ${
                secondaryView === view ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {SECONDARY_TABLES[view].label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Date de début</label>
            <input
              type="date"
              value={secDateFrom}
              onChange={(e) => setSecDateFrom(e.target.value)}
              className="border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Date de fin</label>
            <input
              type="date"
              value={secDateTo}
              onChange={(e) => setSecDateTo(e.target.value)}
              className="border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>
          <button
            onClick={loadSecondaryData}
            disabled={secondaryLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Search className="w-4 h-4" /> {secondaryLoading ? 'Recherche en cours...' : 'Rechercher'}
          </button>
        </div>

        {secondaryError && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />{secondaryError}
          </div>
        )}

        {secondarySearched && !secondaryError && (
          <div className="mt-5 border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 text-sm">{SECONDARY_TABLES[secondaryView].label}</h3>
              <span className="text-sm text-slate-500">{secondaryRows.length} ligne(s)</span>
            </div>
            {secondaryRows.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-1">
                <p>Aucune donnée pour cette plage de dates.</p>
                {secondaryTotalCount === 0 ? (
                  <p className="text-xs text-amber-600 font-medium">
                    0 ligne visible au total dans "{SECONDARY_TABLES[secondaryView].table}" (même sans filtre de date) — c'est un problème de permissions RLS, pas de dates : la politique doit autoriser le rôle "anon" (l'application n'utilise pas l'authentification Supabase, donc "authenticated" seul ne suffit pas).
                  </p>
                ) : secondaryTotalCount !== null && secondaryTotalCount > 0 ? (
                  <p className="text-xs text-amber-600 font-medium">
                    {secondaryTotalCount} ligne(s) visible(s) au total dans la table, mais aucune dans cette plage de dates — vérifiez le format/la colonne "{SECONDARY_TABLES[secondaryView].dateColumn}" ou élargissez la période.
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">Si la table contient pourtant des lignes dans cette période, vérifiez que les politiques RLS de "{SECONDARY_TABLES[secondaryView].table}" autorisent bien la lecture (SELECT) pour le rôle "anon".</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {secondaryColumns.map((col) => (
                        <th key={col} className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap">{prettyHeader(col)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {secondaryRows.map((row, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        {secondaryColumns.map((col) => (
                          <td key={col} className="px-4 py-3 whitespace-nowrap text-slate-700">{formatCell(row[col])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {results.length > 0 && <>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            ['tous', 'Total', summary.total, 'bg-slate-100 text-slate-800'],
            ['bon', 'Conformes', summary.bon, 'bg-emerald-100 text-emerald-800'],
            ['non-encaisse', 'Non encaissés', summary.nonEncaisse, 'bg-amber-100 text-amber-800'],
            ['alerte', 'Alertes', summary.alertes, 'bg-red-100 text-red-800'],
            ['introuvable', 'Introuvables', summary.introuvables, 'bg-gray-100 text-gray-800']
          ].map(([key, label, count, color]) => <button key={key} onClick={() => setFilter(key as 'tous' | VerificationStatus)} className={`rounded-xl p-4 text-left ${color} transition-transform hover:-translate-y-0.5`}><p className="text-xs font-semibold uppercase tracking-wide">{label}</p><p className="text-2xl font-bold mt-1">{count}</p></button>)}
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between"><h3 className="font-bold text-slate-900">Résultats de la vérification</h3><span className="text-sm text-slate-500">{filteredResults.length} ligne(s)</span></div>
          <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{['Ligne', 'Souscripteur', 'Police', 'Sous-type', 'Date effective PI', 'Date encaissement application', 'Montant TTC PI', 'Prime nette application', 'Commissions PI', 'Résultat'].map((heading) => <th key={heading} className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
            {filteredResults.map((result) => {
              const amountAlert = result.montantStatus === 'alerte';
              const isGood = result.dateStatus === 'bon' && !amountAlert;
              const isMissing = result.dateStatus === 'non-encaisse';
              return <tr key={`${result.police}-${result.ligne}`} className={isGood ? 'bg-emerald-50/40' : isMissing ? 'bg-amber-50/50' : 'bg-red-50/50'}>
                <td className="px-4 py-3 text-slate-500">{result.ligne}</td><td className="px-4 py-3 font-medium text-slate-900">{result.souscripteur || '—'}</td><td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{result.police}</td><td className="px-4 py-3 whitespace-nowrap">{result.sousType || '—'}</td><td className="px-4 py-3 whitespace-nowrap">{formatDate(result.dateEffective)}</td><td className="px-4 py-3 whitespace-nowrap">{formatDate(result.dateEncaissement)}</td><td className="px-4 py-3 whitespace-nowrap">{formatAmount(result.montantTTC)}</td><td className="px-4 py-3 whitespace-nowrap">{formatAmount(result.primeNette)}</td><td className="px-4 py-3 whitespace-nowrap">{formatAmount(result.commissions)}</td>
                <td className="px-4 py-3 min-w-[280px]">{result.dateStatus === 'introuvable' ? <span className="inline-flex items-center gap-1.5 text-gray-700 font-semibold"><XCircle className="w-4 h-4" />Police introuvable dans terme</span> : <div className="space-y-1">{isGood ? <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold"><CheckCircle2 className="w-4 h-4" />Bon: dates et montant concordants</span> : isMissing ? <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold"><AlertCircle className="w-4 h-4" />Non encaissé sur l’application mais encaissé sur PI</span> : <span className="inline-flex items-center gap-1.5 text-red-700 font-semibold"><XCircle className="w-4 h-4" />Alerte: vérification à corriger</span>}{result.dateStatus === 'alerte' && <p className="text-xs text-red-700">Dates différentes: PI {formatDate(result.dateEffective)} / application {formatDate(result.dateEncaissement)}</p>}{amountAlert && <p className="text-xs text-red-700">Montants différents: PI {formatAmount(result.montantTTC)} / application {formatAmount(result.primeNette)}</p>}</div>}</td>
              </tr>;
            })}
          </tbody></table></div>
          {filteredResults.length === 0 && <div className="p-8 text-center text-slate-500">Aucun résultat pour ce filtre.</div>}
        </div>
      </>}
    </div>
  );
};

export default VerificationEncaissements;
