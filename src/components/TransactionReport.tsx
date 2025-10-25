import React, { useState } from 'react';
import { Calendar, Download, TrendingUp, DollarSign, FileText, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

interface Transaction {
  id: number;
  type: string;
  branche: string;
  numero_contrat: string;
  prime: number;
  assure: string;
  mode_paiement: string;
  type_paiement: string;
  montant_credit: number | null;
  montant: number;
  date_paiement_prevue: string | null;
  cree_par: string;
  created_at: string;
}

interface Statistics {
  totalTransactions: number;
  totalPrime: number;
  totalMontant: number;
  totalCredit: number;
  totalEspecesNet: number;
  totalCheque: number;
  totalDepenses: number;
  totalPaiementCredits: number;
  totalRistournes: number;
  totalSinistres: number;
  totalRecettes: number;
  byBranche: { [key: string]: number };
  byModePaiement: { [key: string]: number };
  byTypePaiement: { [key: string]: number };
  byType: { [key: string]: number };
  byBanque: { [key: string]: number };
}

const TransactionReport: React.FC = () => {
  const [searchDate, setSearchDate] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const calculateStatistics = (data: Transaction[]): Statistics => {
    const stats: Statistics = {
      totalTransactions: data.length,
      totalPrime: 0,
      totalMontant: 0,
      totalCredit: 0,
      totalEspecesNet: 0,
      totalCheque: 0,
      totalDepenses: 0,
      totalPaiementCredits: 0,
      totalRistournes: 0,
      totalSinistres: 0,
      totalRecettes: 0,
      byBranche: {},
      byModePaiement: {},
      byTypePaiement: {},
      byType: {},
      byBanque: {}
    };

    data.forEach(transaction => {
      const prime = transaction.prime || 0;
      const montant = transaction.montant || 0;

      stats.totalPrime += prime;
      stats.totalMontant += montant;
      stats.totalCredit += transaction.montant_credit || 0;

      // Calculer Total Espèces Net (Espèce - Dépenses - Ristournes)
      if (transaction.mode_paiement === 'Espece') {
        if (transaction.type === 'Dépense' || transaction.type === 'Ristourne') {
          stats.totalEspecesNet -= montant;
        } else {
          stats.totalEspecesNet += montant;
        }
      }

      // Calculer Total Chèque
      if (transaction.mode_paiement === 'Cheque') {
        stats.totalCheque += montant;
      }

      // Calculer Total Dépenses
      if (transaction.type === 'Dépense') {
        stats.totalDepenses += montant;
      }

      // Calculer Total Paiement Crédits
      if (transaction.type === 'Paiement Crédit') {
        stats.totalPaiementCredits += montant;
      }

      // Calculer Total Ristournes
      if (transaction.type === 'Ristourne') {
        stats.totalRistournes += montant;
      }

      // Calculer Total Sinistres
      if (transaction.type === 'Sinistre') {
        stats.totalSinistres += montant;
      }

      // Calculer Total Recettes Exceptionnelles
      if (transaction.type === 'Recette') {
        stats.totalRecettes += montant;
      }

      // Par Branche
      stats.byBranche[transaction.branche] = (stats.byBranche[transaction.branche] || 0) + prime;

      // Par Mode de Paiement
      stats.byModePaiement[transaction.mode_paiement] = (stats.byModePaiement[transaction.mode_paiement] || 0) + prime;

      // Par Type de Paiement
      stats.byTypePaiement[transaction.type_paiement] = (stats.byTypePaiement[transaction.type_paiement] || 0) + prime;

      // Par Type
      stats.byType[transaction.type] = (stats.byType[transaction.type] || 0) + prime;

      // Par Banque (si Chèque)
      if (transaction.mode_paiement === 'Cheque' && transaction.type_paiement) {
        const banque = transaction.type_paiement || 'Non spécifié';
        stats.byBanque[banque] = (stats.byBanque[banque] || 0) + montant;
      }
    });

    return stats;
  };

  const handleSearch = async () => {
    if (!searchDate) {
      setError('Veuillez saisir une date de recherche');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const startDate = new Date(searchDate);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(searchDate);
      endDate.setHours(23, 59, 59, 999);

      const { data, error: fetchError } = await supabase
        .from('rapport')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setTransactions(data || []);
      setStatistics(calculateStatistics(data || []));
    } catch (err) {
      console.error('Erreur lors de la recherche:', err);
      setError('Erreur lors de la recherche des transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (transactions.length === 0) {
      setError('Aucune transaction à exporter');
      return;
    }

    const exportData = transactions.map(t => ({
      'ID': t.id,
      'Type': t.type,
      'Branche': t.branche,
      'Numéro Contrat': t.numero_contrat,
      'Prime': t.prime,
      'Assuré': t.assure,
      'Mode Paiement': t.mode_paiement,
      'Type Paiement': t.type_paiement,
      'Montant Crédit': t.montant_credit || '',
      'Montant': t.montant,
      'Date Paiement Prévue': t.date_paiement_prevue || '',
      'Créé Par': t.cree_par,
      'Date Création': new Date(t.created_at).toLocaleString('fr-FR')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    const fileName = `rapport_transactions_${searchDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND'
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Rapport de Transactions</h2>
              <p className="text-sm text-gray-500">Rechercher et analyser les transactions par date</p>
            </div>
          </div>
        </div>

        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date de Recherche
            </label>
            <input
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Calendar className="w-4 h-4" />
            <span>{loading ? 'Recherche...' : 'Rechercher'}</span>
          </button>
          {transactions.length > 0 && (
            <button
              onClick={handleExport}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Exporter</span>
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}
      </div>

      {statistics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <FileText className="w-6 h-6 opacity-80" />
                <span className="text-xl font-bold">{statistics.totalTransactions}</span>
              </div>
              <p className="text-blue-100 text-xs font-medium">Total Transactions</p>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-sm p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-6 h-6 opacity-80" />
                <span className="text-xl font-bold">{formatCurrency(statistics.totalPrime)}</span>
              </div>
              <p className="text-green-100 text-xs font-medium">Total Primes</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-sm p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-6 h-6 opacity-80" />
                <span className="text-xl font-bold">{formatCurrency(statistics.totalMontant)}</span>
              </div>
              <p className="text-emerald-100 text-xs font-medium">Total Montants</p>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-sm p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <CreditCard className="w-6 h-6 opacity-80" />
                <span className="text-xl font-bold">{formatCurrency(statistics.totalCredit)}</span>
              </div>
              <p className="text-orange-100 text-xs font-medium">Total Crédits</p>
            </div>

            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl shadow-sm p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-6 h-6 opacity-80" />
                <span className="text-xl font-bold">{formatCurrency(statistics.totalEspecesNet)}</span>
              </div>
              <p className="text-teal-100 text-xs font-medium">Total Espèces Net</p>
            </div>

            <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl shadow-sm p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <CreditCard className="w-6 h-6 opacity-80" />
                <span className="text-xl font-bold">{formatCurrency(statistics.totalCheque)}</span>
              </div>
              <p className="text-cyan-100 text-xs font-medium">Total Chèque</p>
            </div>

            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-sm p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-6 h-6 opacity-80" />
                <span className="text-xl font-bold">{formatCurrency(statistics.totalDepenses)}</span>
              </div>
              <p className="text-red-100 text-xs font-medium">Total Dépenses</p>
            </div>

            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-sm p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-6 h-6 opacity-80" />
                <span className="text-xl font-bold">{formatCurrency(statistics.totalPaiementCredits)}</span>
              </div>
              <p className="text-amber-100 text-xs font-medium">Total Paiement Crédits</p>
            </div>

            <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl shadow-sm p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-6 h-6 opacity-80" />
                <span className="text-xl font-bold">{formatCurrency(statistics.totalRistournes)}</span>
              </div>
              <p className="text-violet-100 text-xs font-medium">Total Ristournes</p>
            </div>

            <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl shadow-sm p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <FileText className="w-6 h-6 opacity-80" />
                <span className="text-xl font-bold">{formatCurrency(statistics.totalSinistres)}</span>
              </div>
              <p className="text-pink-100 text-xs font-medium">Total Sinistres</p>
            </div>

            <div className="bg-gradient-to-br from-sky-500 to-sky-600 rounded-xl shadow-sm p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-6 h-6 opacity-80" />
                <span className="text-xl font-bold">{formatCurrency(statistics.totalRecettes)}</span>
              </div>
              <p className="text-sky-100 text-xs font-medium">Total Recettes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Par Branche</h3>
              <div className="space-y-3">
                {Object.entries(statistics.byBranche).map(([branche, amount]) => (
                  <div key={branche} className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">{branche}</span>
                    <span className="text-blue-600 font-bold">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Par Mode de Paiement</h3>
              <div className="space-y-3">
                {Object.entries(statistics.byModePaiement).map(([mode, amount]) => (
                  <div key={mode} className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">{mode}</span>
                    <span className="text-green-600 font-bold">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Par Type de Paiement</h3>
              <div className="space-y-3">
                {Object.entries(statistics.byTypePaiement).map(([type, amount]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">{type}</span>
                    <span className="text-emerald-600 font-bold">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Par Type</h3>
              <div className="space-y-3">
                {Object.entries(statistics.byType).map(([type, amount]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">{type}</span>
                    <span className="text-orange-600 font-bold">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {Object.keys(statistics.byBanque).length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Par Banque (Chèques)</h3>
                <div className="space-y-3">
                  {Object.entries(statistics.byBanque).map(([banque, amount]) => (
                    <div key={banque} className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium">{banque}</span>
                      <span className="text-cyan-600 font-bold">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {transactions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Branche</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">N° Contrat</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Assuré</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Prime</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Mode</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type Paiement</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Créé Par</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900">{transaction.id}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        transaction.type === 'Terme' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {transaction.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{transaction.branche}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{transaction.numero_contrat}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{transaction.assure}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{formatCurrency(transaction.prime)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">{formatCurrency(transaction.montant)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{transaction.mode_paiement}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        transaction.type_paiement === 'Crédit' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {transaction.type_paiement}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{transaction.cree_par}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{new Date(transaction.created_at).toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && transactions.length === 0 && searchDate && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune Transaction Trouvée</h3>
          <p className="text-gray-600">Aucune transaction n'a été trouvée pour la date sélectionnée</p>
        </div>
      )}
    </div>
  );
};

export default TransactionReport;
