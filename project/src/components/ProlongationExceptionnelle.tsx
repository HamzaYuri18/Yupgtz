import React, { useState } from 'react';
import { Search, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Download, FileText, Car, MapPin, Calendar, RotateCcw, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Noms des mois sans accents pour les noms de tables
const MOIS_TABLE: Record<number, string> = {
  0: 'janvier', 1: 'fevrier', 2: 'mars', 3: 'avril', 4: 'mai', 5: 'juin',
  6: 'juillet', 7: 'aout', 8: 'septembre', 9: 'octobre', 10: 'novembre', 11: 'decembre'
};



interface ProlongForm {
  numero_contrat: string;
  assure: string;
  prime: number;
  date_echeance: string;    // YYYY-MM-DD (référence 49 jours)
  pour_le_compte: string;
  classe: string;
  date_effet: string;
  date_fin_prolongation: string;
  marque: string;
  puissance: string;
  immatriculation: string;
  usage: string;
  adresse: string;
}

// ── Utilitaires date ──────────────────────────────────────────────────────────

const formatDateFR = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR');
};

const addDays = (iso: string, n: number): string => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

const daysDiff = (isoA: string, isoB: string): number => {
  const a = new Date(isoA + 'T00:00:00').getTime();
  const b = new Date(isoB + 'T00:00:00').getTime();
  return Math.round((b - a) / 86400000);
};

// ── Génération PDF — reproduit fidèlement la mise en page du template ──────────

const generateProlongationPDF = async (f: ProlongForm): Promise<void> => {
  const response = await fetch('/forms/Mliki_Amel.pdf');
  if (!response.ok) throw new Error('Le modèle PDF est introuvable.');

  const pdf = await PDFDocument.load(await response.arrayBuffer());
  const page = pdf.getPages()[0];
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const white = rgb(1, 1, 1);
  const black = rgb(0, 0, 0);
  const scale = 72 / 25.4;
  const pageHeight = page.getHeight();
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR');
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const point = (mm: number): number => mm * scale;
  const y = (mm: number, size: number): number => pageHeight - point(mm) - size;
  const clear = (x: number, top: number, width: number, height: number): void => {
    page.drawRectangle({ x: point(x), y: pageHeight - point(top + height), width: point(width), height: point(height), color: white });
  };
  const value = (text: string, x: number, top: number, size = 8): void => {
    page.drawText(text || '', { x: point(x), y: y(top, size), size, font, color: black });
  };
  const clearValue = (x: number, top: number, width: number, height = 7): void => clear(x, top - 1, width, height);

  clearValue(57, 19, 55); clearValue(68, 26, 25); clearValue(62, 33, 35); clearValue(62, 40, 38);
  clearValue(25, 58, 75); clearValue(52, 65, 80);
  clearValue(145, 11, 50); clearValue(148, 25, 30); clearValue(157, 39, 45); clearValue(142, 50, 60); clearValue(138, 61, 35); clearValue(138, 67, 35);
  clearValue(122, 93, 55); clearValue(111, 105, 35); clearValue(111, 115, 38);
  clearValue(26, 135, 75); clearValue(52, 146, 80); clearValue(28, 161, 78, 20);
  clearValue(58, 188, 35); clearValue(58, 194, 35);
  clearValue(150, 114, 45); clearValue(156, 135, 30); clearValue(165, 148, 45); clearValue(149, 161, 60);
  clearValue(125, 238, 60, 12); clearValue(130, 261, 65, 14);

  value(f.numero_contrat, 57, 19);
  value(f.classe, 68, 26);
  value(formatDateFR(f.date_effet), 62, 33);
  value(formatDateFR(f.date_fin_prolongation), 62, 40);
  value(f.assure, 25, 58);
  value(f.pour_le_compte, 52, 65);
  value(f.marque, 145, 11);
  value(f.puissance, 148, 25);
  value(f.immatriculation, 157, 39);
  value(f.usage, 142, 50);
  value(dateStr, 138, 61);
  value(timeStr, 138, 67);

  value(f.numero_contrat, 122, 93);
  value(formatDateFR(f.date_effet), 111, 105);
  value(formatDateFR(f.date_fin_prolongation), 111, 115);
  value(f.assure, 26, 135);
  value(f.pour_le_compte, 52, 146);
  const addressLines = f.adresse.trim().split(/\\s+/).reduce<string[]>((lines, word) => {
    const current = lines[lines.length - 1] || '';
    if ((current + ' ' + word).trim().length > 26) lines.push(word);
    else if (lines.length === 0) lines.push(word);
    else lines[lines.length - 1] = `${current} ${word}`.trim();
    return lines;
  }, []);
  addressLines.slice(0, 4).forEach((line, index) => value(line, 28, 161 + index * 6, 7));
  value(dateStr, 58, 188);
  value(timeStr, 58, 194);
  value(f.marque, 150, 114);
  value(f.puissance, 156, 135);
  value(f.immatriculation, 165, 148);
  value(f.usage, 149, 161);
  value(formatDateFR(f.date_fin_prolongation), 125, 238, 13);
  value(f.immatriculation, 130, 261, 15);

  const bytes = await pdf.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `prolongation_${f.numero_contrat.replace(/\\//g, '-')}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};


// ── Sauvegarde Supabase ───────────────────────────────────────────────────────

const saveProlongation = async (f: ProlongForm): Promise<void> => {
  const now = new Date();
  const { error } = await supabase.from('prolongation').insert([{
    numero_contrat: f.numero_contrat,
    assure: f.assure,
    prime: f.prime,
    date_echeance: f.date_echeance,
    pour_le_compte: f.pour_le_compte,
    classe: f.classe,
    date_effet: f.date_effet,
    date_fin_prolongation: f.date_fin_prolongation,
    marque: f.marque,
    puissance: f.puissance,
    immatriculation: f.immatriculation,
    usage: f.usage,
    adresse: f.adresse,
    date_demande: now.toISOString().split('T')[0],
    heure_demande: now.toTimeString().slice(0, 5),
  }]);
  if (error) throw new Error(error.message);
};

// ── Composant principal ───────────────────────────────────────────────────────

type Step = 'search' | 'form' | 'done';

const ProlongationExceptionnelle: React.FC = () => {
  const [step, setStep]           = useState<Step>('search');
  const [searchNum, setSearchNum] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [form, setForm]           = useState<ProlongForm | null>(null);
  const [sending, setSending]     = useState(false);
  const [finErr, setFinErr]       = useState<string | null>(null);

  // ── Step 1 : Recherche ──────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!searchNum.trim() || !searchDate) {
      setError('Veuillez renseigner le numéro de contrat et la date d\'échéance.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const d = new Date(searchDate + 'T00:00:00');
      const monthKey = MOIS_TABLE[d.getMonth()];
      const year     = d.getFullYear();
      const tableName = `table_terme_${monthKey}_${year}`;

      // 1. Recherche dans la table mensuelle
      const { data: termeData, error: termeErr } = await supabase
        .from(tableName)
        .select('numero_contrat, assure, prime, echeance')
        .ilike('numero_contrat', searchNum.trim())
        .maybeSingle();

      if (termeErr) {
        setError(`Table "${tableName}" introuvable ou erreur : ${termeErr.message}`);
        return;
      }
      if (!termeData) {
        setError(`Aucun contrat trouvé dans la table ${tableName} pour ce numéro.`);
        return;
      }

      // 2. Vérifier si une prolongation existe déjà
      const { data: existing } = await supabase
        .from('prolongation')
        .select('id')
        .ilike('numero_contrat', searchNum.trim())
        .maybeSingle();

      if (existing) {
        setError('⛔ Ce contrat fait déjà l\'objet d\'une prolongation exceptionnelle. Nouvelle demande impossible.');
        return;
      }

      // 3. Initialiser le formulaire
      setForm({
        numero_contrat: termeData.numero_contrat,
        assure: termeData.assure || '',
        prime: Number(termeData.prime) || 0,
        date_echeance: searchDate,
        pour_le_compte: '',
        classe: '',
        date_effet: searchDate,
        date_fin_prolongation: '',
        marque: '',
        puissance: '',
        immatriculation: '',
        usage: '',
        adresse: '',
      });
      setStep('form');
    } catch (err: any) {
      setError(`Erreur inattendue : ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Validation date fin ─────────────────────────────────────────────────────

  const validateFin = (val: string): string | null => {
    if (!val || !form) return null;
    const diff = daysDiff(form.date_echeance, val);
    if (diff <= 0) return 'La date de fin doit être après la date d\'échéance.';
    if (diff > 49) return `Maximum 49 jours après l'échéance (≤ ${addDays(form.date_echeance, 49)}).`;
    return null;
  };

  const handleFinChange = (val: string) => {
    setFinErr(validateFin(val));
    setForm(f => f ? { ...f, date_fin_prolongation: val } : f);
  };

  // ── Step 2 : Soumission ─────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form) return;

    // Validation finale
    const err = validateFin(form.date_fin_prolongation);
    if (err) { setFinErr(err); return; }
    if (!form.date_fin_prolongation) { setFinErr('La date de fin de prolongation est obligatoire.'); return; }
    if (!form.classe.trim())         { setError('La classe est obligatoire.'); return; }
    if (!form.marque.trim())         { setError('La marque est obligatoire.'); return; }
    if (!form.immatriculation.trim()) { setError('L\'immatriculation est obligatoire.'); return; }

    setSending(true);
    setError(null);

    try {
      await saveProlongation(form);
      setStep('done');
    } catch (err: any) {
      setError(`Erreur lors de l'enregistrement : ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const upd = (field: keyof ProlongForm, val: string) =>
    setForm(f => f ? { ...f, [field]: val } : f);

  const reset = () => {
    setStep('search');
    setSearchNum('');
    setSearchDate('');
    setForm(null);
    setError(null);
    setFinErr(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-violet-900 rounded-2xl p-6 text-white shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
            <Shield className="w-7 h-7 text-violet-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Prolongation</h1>
            <p className="text-slate-400 text-sm mt-0.5">Demande de prolongation de couverture — max. 49 jours</p>
          </div>
        </div>

        {/* Étapes */}
        <div className="mt-5 flex items-center gap-3">
          {(['search', 'form', 'done'] as Step[]).map((s, i) => {
            const labels = ['Recherche', 'Formulaire', 'Confirmation'];
            const active = step === s;
            const done   = (['search', 'form', 'done'] as Step[]).indexOf(step) > i;
            return (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  active ? 'bg-violet-500 text-white' :
                  done   ? 'bg-emerald-600/60 text-emerald-200' :
                           'bg-white/10 text-white/40'
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    active ? 'bg-white text-violet-600' :
                    done   ? 'bg-emerald-400 text-white' :
                             'bg-white/20 text-white/50'
                  }`}>{done ? '✓' : i + 1}</span>
                  {labels[i]}
                </div>
                {i < 2 && <div className="w-6 h-0.5 bg-white/20 rounded" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── ÉTAPE 1 : RECHERCHE ─────────────────────────────────────────────── */}
      {step === 'search' && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-5 flex items-center gap-2">
            <Search className="w-5 h-5 text-violet-600" />
            Identifier le contrat
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Numéro de contrat
              </label>
              <input
                type="text"
                value={searchNum}
                onChange={e => { setSearchNum(e.target.value); setError(null); }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="ex: CI0554N00478804"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-800 font-mono focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Date d'échéance
                <span className="ml-1 text-xs text-slate-500">(détermine la table terme à consulter)</span>
              </label>
              <input
                type="date"
                value={searchDate}
                onChange={e => { setSearchDate(e.target.value); setError(null); }}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
              {searchDate && (
                <p className="mt-1 text-xs text-slate-500">
                  → Table : <span className="font-mono font-semibold text-violet-700">
                    table_terme_{MOIS_TABLE[new Date(searchDate + 'T00:00:00').getMonth()]}_{new Date(searchDate + 'T00:00:00').getFullYear()}
                  </span>
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleSearch}
            disabled={loading}
            className="mt-6 flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold px-8 py-3 rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-lg"
          >
            {loading ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Recherche en cours…</>
            ) : (
              <><Search className="w-4 h-4" />Rechercher le contrat</>
            )}
          </button>
        </div>
      )}

      {/* ── ÉTAPE 2 : FORMULAIRE ────────────────────────────────────────────── */}
      {step === 'form' && form && (
        <div className="space-y-5">
          {/* Récapitulatif contrat */}
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-violet-700 uppercase tracking-wide mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Contrat identifié
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'N° Contrat',   value: form.numero_contrat, mono: true },
                { label: 'Assuré',       value: form.assure },
                { label: 'Prime',        value: `${form.prime} DT` },
                { label: 'Échéance',     value: formatDateFR(form.date_echeance) },
              ].map(({ label, value, mono }) => (
                <div key={label} className="bg-white rounded-xl p-3 border border-violet-100">
                  <p className="text-xs text-violet-600 font-medium mb-1">{label}</p>
                  <p className={`text-sm font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Formulaire complet */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-5 flex items-center gap-2">
              <Car className="w-5 h-5 text-violet-600" />
              Informations du véhicule
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field label="Marque *" value={form.marque} onChange={v => upd('marque', v)} placeholder="ex: Peugeot" />
              <Field label="Puissance" value={form.puissance} onChange={v => upd('puissance', v)} placeholder="ex: 5 CV" />
              <Field label="Immatriculation *" value={form.immatriculation} onChange={v => upd('immatriculation', v)} placeholder="ex: 123 TU 4567" mono />
              <Field label="Usage" value={form.usage} onChange={v => upd('usage', v)} placeholder="ex: Voiture de tourisme" />
              <Field label="Classe *" value={form.classe} onChange={v => upd('classe', v)} placeholder="ex: Classe A" />
              <Field label="Pour le compte de" value={form.pour_le_compte} onChange={v => upd('pour_le_compte', v)} placeholder="Nom de la compagnie" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-5 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-violet-600" />
              Dates de prolongation
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Date effet */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Date d'effet</label>
                <input
                  type="date"
                  value={form.date_effet}
                  onChange={e => upd('date_effet', e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Date fin prolongation */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Date fin de prolongation *
                  <span className="ml-1 text-xs text-slate-500">
                    (max: {formatDateFR(addDays(form.date_echeance, 49))} — 49 j après l'échéance)
                  </span>
                </label>
                <input
                  type="date"
                  value={form.date_fin_prolongation}
                  min={addDays(form.date_echeance, 1)}
                  max={addDays(form.date_echeance, 49)}
                  onChange={e => handleFinChange(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none ${
                    finErr ? 'border-red-400 bg-red-50' : 'border-slate-300'
                  }`}
                />
                {finErr && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />{finErr}
                  </p>
                )}
                {form.date_fin_prolongation && !finErr && (
                  <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {daysDiff(form.date_echeance, form.date_fin_prolongation)} jour(s) de prolongation
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-5 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-violet-600" />
              Assuré
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Assuré</label>
                <input
                  type="text"
                  value={form.assure}
                  readOnly
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 text-slate-600"
                />
              </div>
              <Field
                label="Adresse"
                value={form.adresse}
                onChange={v => upd('adresse', v)}
                placeholder="Adresse de l'assuré"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 transition-all font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Nouvelle recherche
            </button>
            <button
              onClick={handleSubmit}
              disabled={sending || !!finErr || !form.date_fin_prolongation}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold px-8 py-3 rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-lg"
            >
              {sending ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Enregistrement…</>
              ) : (
                <><CheckCircle className="w-4 h-4" />Enregistrer la prolongation</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── ÉTAPE 3 : CONFIRMATION ──────────────────────────────────────────── */}
      {step === 'done' && form && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Demande enregistrée</h2>
            <p className="text-slate-500 mt-1">La prolongation a été sauvegardée dans Supabase.</p>
          </div>

          {/* Récap */}
          <div className="bg-slate-50 rounded-xl p-5 text-left max-w-lg mx-auto space-y-2">
            {[
              ['Contrat',              form.numero_contrat],
              ['Assuré',               form.assure],
              ['Classe',               form.classe],
              ['Marque / Immat.',      `${form.marque} — ${form.immatriculation}`],
              ['Date fin prolongation', formatDateFR(form.date_fin_prolongation)],
              ['Durée prolongation',   `${daysDiff(form.date_echeance, form.date_fin_prolongation)} jour(s)`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-slate-500">{k}</span>
                <span className="font-semibold text-slate-800">{v}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => generateProlongationPDF(form)}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold px-8 py-3 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg"
            >
              <Download className="w-4 h-4" />
              Télécharger le document PDF
            </button>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 transition-all font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Nouvelle prolongation
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Champ texte réutilisable ──────────────────────────────────────────────────

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}> = ({ label, value, onChange, placeholder, mono }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none ${mono ? 'font-mono' : ''}`}
    />
  </div>
);

export default ProlongationExceptionnelle;
