import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Check, X, Filter, Calendar } from 'lucide-react';

interface Cheque {
  id: number;
  numero_contrat: string;
  assure: string;
  numero_cheque: string;
  titulaire_cheque: string;
  montant: number;
  date_encaissement_prevue: string;
  banque: string;
  statut: string;
  created_at: string;
  cree_par: string;
  date_encaissement?: string;
}

export default function ChequesManagement() {
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [filteredCheques, setFilteredCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [selectedCheque, setSelectedCheque] = useState<Cheque | null>(null);
  const [encaissementDate, setEncaissementDate] = useState<string>('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadCheques();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [cheques, statusFilter, monthFilter]);

  const loadCheques = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('Cheques')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCheques(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des chèques:', error);
      alert('Erreur lors du chargement des chèques');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...cheques];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.statut === statusFilter);
    }

    if (monthFilter !== 'all') {
      filtered = filtered.filter(c => {
        const chequeMonth = new Date(c.created_at).toISOString().slice(0, 7);
        return chequeMonth === monthFilter;
      });
    }

    setFilteredCheques(filtered);
  };

  const getAvailableMonths = () => {
    const months = new Set<string>();
    cheques.forEach(c => {
      const month = new Date(c.created_at).toISOString().slice(0, 7);
      months.add(month);
    });
    return Array.from(months).sort().reverse();
  };

  const handleEncaisserClick = (cheque: Cheque) => {
    setSelectedCheque(cheque);
    setEncaissementDate(new Date().toISOString().split('T')[0]);
    setShowModal(true);
  };

  const handleEncaisser = async () => {
    if (!selectedCheque || !encaissementDate) return;

    try {
      const { error } = await supabase
        .from('Cheques')
        .update({
          statut: 'Encaissé',
          date_encaissement: encaissementDate
        })
        .eq('id', selectedCheque.id);

      if (error) throw error;

      alert('Chèque encaissé avec succès!');
      setShowModal(false);
      setSelectedCheque(null);
      setEncaissementDate('');
      loadCheques();
    } catch (error) {
      console.error('Erreur lors de l\'encaissement:', error);
      alert('Erreur lors de l\'encaissement du chèque');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MAD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Chargement des chèques...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestion des Chèques</h1>
        <p className="text-gray-600">Gérez et encaissez les chèques reçus</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold">Filtres</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Statut
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tous les statuts</option>
              <option value="Non Encaissé">Non Encaissé</option>
              <option value="Encaissé">Encaissé</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mois d'émission
            </label>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tous les mois</option>
              {getAvailableMonths().map(month => (
                <option key={month} value={month}>
                  {new Date(month + '-01').toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long'
                  })}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          {filteredCheques.length} chèque{filteredCheques.length > 1 ? 's' : ''} trouvé{filteredCheques.length > 1 ? 's' : ''}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  N° Contrat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assuré
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  N° Chèque
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Banque
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Prévue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Émission
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Encaissement
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCheques.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                    Aucun chèque trouvé
                  </td>
                </tr>
              ) : (
                filteredCheques.map((cheque) => (
                  <tr key={cheque.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {cheque.numero_contrat}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cheque.assure}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cheque.numero_cheque}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cheque.banque}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatCurrency(cheque.montant)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(cheque.date_encaissement_prevue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(cheque.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        cheque.statut === 'Encaissé'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {cheque.statut}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cheque.date_encaissement ? formatDate(cheque.date_encaissement) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {cheque.statut === 'Non Encaissé' && (
                        <button
                          onClick={() => handleEncaisserClick(cheque)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                          Encaisser
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && selectedCheque && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Encaisser le chèque</h3>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Numéro de contrat</p>
                <p className="font-semibold">{selectedCheque.numero_contrat}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Assuré</p>
                <p className="font-semibold">{selectedCheque.assure}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Numéro de chèque</p>
                <p className="font-semibold">{selectedCheque.numero_cheque}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Montant</p>
                <p className="font-semibold text-lg">{formatCurrency(selectedCheque.montant)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date d'encaissement *
                </label>
                <input
                  type="date"
                  value={encaissementDate}
                  onChange={(e) => setEncaissementDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleEncaisser}
                disabled={!encaissementDate}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Confirmer l'encaissement
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedCheque(null);
                  setEncaissementDate('');
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
