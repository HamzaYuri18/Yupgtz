import React, { useState } from 'react';
import { X, Search, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ReportingRow {
  id: string;
  numero_contrat: string;
  assure: string;
  montant_credit: number | null;
  solde: number | null;
  statut: string | null;
  reporting: string | null;
  motif: string | null;
  ancienne_date_paiement: string | null;
  nouvelle_date_paiement: string | null;
  utilisateur: string;
  session_date: string | null;
  created_at: string;
}

const MOTIF_OPTIONS = [
  'Date de paiement reportée suite demande du client',
  'Client injoignable',
  'Crédit payé partiellement',
];

const formatDateFR = (d: string | null): string => {
  if (!d) return '—';
  const date = new Date(d.length > 10 ? d : `${d}T00:00:00`);
  return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString('fr-FR');
};

interface Props {
  onClose: () => void;
}

const ReportingRecouvrementModal: React.FC<Props> = ({ onClose }) => {
  const [numeroContrat, setNumeroContrat] = useState('');
  const [paiementFrom, setPaiementFrom] = useState('');
  const [paiementTo, setPaiementTo] = useState('');
  const [creditFrom, setCreditFrom] = useState('');
  const [creditTo, setCreditTo] = useState('');
  const [motifFilter, setMotifFilter] = useState('');
  const [rows, setRows] = useState<ReportingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      let query = supabase.from('reporting_recouvrement').select('*').order('created_at', { ascending: false });

      if (numeroContrat.trim()) query = query.ilike('numero_contrat', `%${numeroContrat.trim()}%`);
      if (paiementFrom) query = query.gte('ancienne_date_paiement', paiementFrom);
      if (paiementTo) query = query.lte('ancienne_date_paiement', paiementTo);
      if (creditFrom) query = query.gte('session_date', creditFrom);
      if (creditTo) query = query.lte('session_date', creditTo);
      if (motifFilter) query = query.eq('motif', motifFilter);

      const { data, error: err } = await query;
      if (err) throw err;
      setRows(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la recherche.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setNumeroContrat('');
    setPaiementFrom('');
    setPaiementTo('');
    setCreditFrom('');
    setCreditTo('');
    setMotifFilter('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-t-2xl sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6" />
            <h2 className="text-xl font-bold">Reporting de recouvrement</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">N° Contrat</label>
              <input
                type="text"
                value={numeroContrat}
                onChange={e => setNumeroContrat(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Ex: CI0554N00478804"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type de reporting (motif)</label>
              <select
                value={motifFilter}
                onChange={e => setMotifFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white"
              >
                <option value="">Tous les motifs</option>
                {MOTIF_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Plage de date de paiement prévu (ancienne date)</p>
              <div className="flex gap-2">
                <input type="date" value={paiementFrom} onChange={e => setPaiementFrom(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                <input type="date" value={paiementTo} onChange={e => setPaiementTo(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Plage de date de crédit (session de clôture)</p>
              <div className="flex gap-2">
                <input type="date" value={creditFrom} onChange={e => setCreditFrom(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                <input type="date" value={creditTo} onChange={e => setCreditTo(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <Search className="w-4 h-4" /> {loading ? 'Recherche...' : 'Rechercher'}
            </button>
            <button
              onClick={clearFilters}
              className="px-5 py-2.5 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Effacer les filtres
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {searched && !error && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Résultats</h3>
                <span className="text-sm text-gray-500">{rows.length} ligne(s)</span>
              </div>
              {rows.length === 0 ? (
                <div className="p-8 text-center text-gray-500">Aucun résultat pour ces critères.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">N° Contrat</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Assuré</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Motif</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Ancienne date</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Nouvelle date</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Solde</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Session</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Utilisateur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium whitespace-nowrap">{r.numero_contrat}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.assure}</td>
                          <td className="px-3 py-2">{r.motif || r.reporting || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatDateFR(r.ancienne_date_paiement)}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-semibold text-indigo-700">{formatDateFR(r.nouvelle_date_paiement)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.solde != null ? Number(r.solde).toFixed(2) : '—'} DT</td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatDateFR(r.session_date)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.utilisateur}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportingRecouvrementModal;
