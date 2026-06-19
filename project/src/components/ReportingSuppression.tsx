import React, { useState, useEffect } from 'react';
import { Calendar, Download, Trash2, Search, FileText, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getSessionDate } from '../utils/auth';
import * as XLSX from 'xlsx';

interface SuppressionRecord {
  id: string;
  rapport_id: number | null;
  type: string;
  branche: string | null;
  numero_contrat: string | null;
  prime: number;
  assure: string | null;
  mode_paiement: string | null;
  type_paiement: string | null;
  montant_credit: number | null;
  montant: number;
  echeance: string | null;
  date_paiement_prevue: string | null;
  cree_par: string | null;
  created_at_original: string | null;
  motif_suppression: string;
  supprime_par: string;
  supprime_le: string;
  numero_attestation: string | null;
  session_date: string | null;
}

interface SuppressionStats {
  total: number;
  byType: { [key: string]: number };
  sessionCount: number;
}

const TYPE_COLORS: { [key: string]: string } = {
  'Terme': 'bg-blue-100 text-blue-700',
  'Affaire': 'bg-green-100 text-green-700',
  'Dépense': 'bg-red-100 text-red-700',
  'Recette': 'bg-sky-100 text-sky-700',
  'Recette Exceptionnelle': 'bg-sky-100 text-sky-700',
  'Ristourne': 'bg-violet-100 text-violet-700',
  'Sinistre': 'bg-pink-100 text-pink-700',
  'Paiement Crédit': 'bg-amber-100 text-amber-700',
  'Avenant': 'bg-teal-100 text-teal-700',
  'Encaissement pour autre code': 'bg-orange-100 text-orange-700',
};

const ReportingSuppression: React.FC = () => {
  const [records, setRecords] = useState<SuppressionRecord[]>([]);
  const [stats, setStats] = useState<SuppressionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filtered, setFiltered] = useState(false);

  const sessionDate = getSessionDate();

  useEffect(() => {
    loadLatest();
  }, []);

  const loadLatest = async () => {
    setLoading(true);
    setFiltered(false);

    const { data, error } = await supabase
      .from('reporting_suppression')
      .select('*')
      .order('supprime_le', { ascending: false })
      .limit(10);

    if (!error && data) {
      setRecords(data);
      await loadStats();
    }

    setLoading(false);
  };

  const loadStats = async () => {
    const { data: allData, error } = await supabase
      .from('reporting_suppression')
      .select('type, session_date');

    if (!error && allData) {
      const byType: { [key: string]: number } = {};
      let sessionCount = 0;

      allData.forEach(r => {
        byType[r.type] = (byType[r.type] || 0) + 1;
        if (r.session_date === sessionDate) {
          sessionCount++;
        }
      });

      setStats({
        total: allData.length,
        byType,
        sessionCount
      });
    }
  };

  const handleSearch = async () => {
    if (!dateFrom || !dateTo) return;

    setLoading(true);
    setFiltered(true);

    const { data, error } = await supabase
      .from('reporting_suppression')
      .select('*')
      .gte('supprime_le', `${dateFrom}T00:00:00`)
      .lte('supprime_le', `${dateTo}T23:59:59`)
      .order('supprime_le', { ascending: false });

    if (!error && data) {
      setRecords(data);
    }

    setLoading(false);
  };

  const handleReset = () => {
    setDateFrom('');
    setDateTo('');
    loadLatest();
  };

  const handleExport = () => {
    if (records.length === 0) return;

    const exportData = records.map(r => ({
      'ID Rapport': r.rapport_id || '',
      'Type': r.type,
      'Branche': r.branche || '',
      'N° Contrat': r.numero_contrat || '',
      'Assuré': r.assure || '',
      'Prime': r.prime,
      'Montant': r.montant,
      'Montant Crédit': r.montant_credit || '',
      'Mode Paiement': r.mode_paiement || '',
      'Type Paiement': r.type_paiement || '',
      'Echéance': r.echeance || '',
      'N° Attestation': r.numero_attestation || '',
      'Créé Par': r.cree_par || '',
      'Date Originale': r.created_at_original ? new Date(r.created_at_original).toLocaleString('fr-FR') : '',
      'Motif Suppression': r.motif_suppression,
      'Supprimé Par': r.supprime_par,
      'Date Suppression': new Date(r.supprime_le).toLocaleString('fr-FR'),
      'Session': r.session_date || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Suppressions');

    const label = filtered ? `${dateFrom}_au_${dateTo}` : '10_derniers';
    XLSX.writeFile(wb, `reporting_suppressions_${label}.xlsx`);
  };

  const formatCurrency = (amount: number) => {
    return `${new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }).format(amount)} DT`;
  };

  const getTypeColor = (type: string) => {
    return TYPE_COLORS[type] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Reporting des Suppressions</h2>
              <p className="text-sm text-gray-500">
                {filtered
                  ? `Résultats filtrés du ${dateFrom} au ${dateTo}`
                  : 'Affichage des 10 dernières suppressions'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-32">
            <label className="block text-sm font-medium text-gray-700 mb-2">Date du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1 min-w-32">
            <label className="block text-sm font-medium text-gray-700 mb-2">Date au</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={!dateFrom || !dateTo || loading}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Search className="w-4 h-4" />
            <span>Filtrer</span>
          </button>
          {filtered && (
            <button
              onClick={handleReset}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Réinitialiser
            </button>
          )}
          {records.length > 0 && (
            <button
              onClick={handleExport}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Exporter XLSX</span>
            </button>
          )}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-5 text-white shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <Trash2 className="w-7 h-7 opacity-80" />
              <span className="text-3xl font-bold">{stats.total}</span>
            </div>
            <p className="text-red-100 text-sm font-medium">Total Suppressions</p>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="w-7 h-7 opacity-80" />
              <span className="text-3xl font-bold">{stats.sessionCount}</span>
            </div>
            <p className="text-amber-100 text-sm font-medium">Suppressions session actuelle</p>
            <p className="text-amber-200 text-xs mt-1">Session du {sessionDate}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center space-x-2 mb-3">
              <TrendingUp className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900 text-sm">Par Type d'Opération</h3>
            </div>
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {Object.entries(stats.byType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(type)}`}>
                      {type}
                    </span>
                    <span className="font-bold text-gray-900 text-sm">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-10 h-10 border-4 border-red-200 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement...</p>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune suppression trouvée</h3>
          <p className="text-gray-600">
            {filtered
              ? 'Aucune suppression pour la période sélectionnée'
              : 'Aucune opération supprimée enregistrée'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h3 className="font-semibold text-gray-900 text-sm">
                {filtered ? `${records.length} suppression(s) trouvée(s)` : `10 dernières suppressions`}
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-500">
                {[...new Set(records.map(r => r.supprime_par))].join(', ')}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">N° Contrat</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Assuré</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Branche</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Prime</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Motif Suppression</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Supprimé Par</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date Suppression</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-red-50/30 transition-colors">
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(record.type)}`}>
                        {record.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {record.numero_contrat || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{record.assure || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{record.branche || '-'}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                      {record.prime ? formatCurrency(record.prime) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">
                      {record.montant ? formatCurrency(record.montant) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-48">
                      <div className="bg-red-50 border border-red-100 rounded px-2 py-1 text-xs text-red-700 italic">
                        {record.motif_suppression}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center px-2 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-700">
                        {record.supprime_par}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(record.supprime_le).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {record.session_date || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportingSuppression;
