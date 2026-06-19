import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Calendar, DollarSign, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import CreditStatsDetailModal from './CreditStatsDetailModal';

interface CreditEvolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface QuinzaineData {
  quinzaine: string;
  dateDebut: string;
  dateFin: string;
  totalNouveauxCredits: number;
  totalCreditsPayes: number;
}

const CreditEvolutionModal: React.FC<CreditEvolutionModalProps> = ({ isOpen, onClose }) => {
  const [quinzainesData, setQuinzainesData] = useState<QuinzaineData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalType, setDetailModalType] = useState<'nouveaux' | 'payes'>('nouveaux');

  useEffect(() => {
    if (isOpen) {
      initializeDates();
    }
  }, [isOpen]);

  useEffect(() => {
    if (dateDebut && dateFin) {
      loadEvolutionData();
    }
  }, [dateDebut, dateFin]);

  const initializeDates = () => {
    const today = new Date();

    const quatreQuinzainesAvant = new Date(today);
    quatreQuinzainesAvant.setDate(today.getDate() - (4 * 15));

    setDateDebut(quatreQuinzainesAvant.toISOString().split('T')[0]);
    setDateFin(today.toISOString().split('T')[0]);
  };

  const getQuinzainePeriod = (date: Date): { debut: Date; fin: Date; label: string } => {
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();

    if (day <= 15) {
      const debut = new Date(year, month, 1);
      const fin = new Date(year, month, 15, 23, 59, 59);
      return {
        debut,
        fin,
        label: `Q1 ${debut.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`
      };
    } else {
      const debut = new Date(year, month, 16);
      const fin = new Date(year, month + 1, 0, 23, 59, 59);
      return {
        debut,
        fin,
        label: `Q2 ${debut.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`
      };
    }
  };

  const getAllQuinzainesBetween = (start: Date, end: Date): QuinzaineData[] => {
    const quinzaines: QuinzaineData[] = [];
    let current = new Date(start);

    while (current <= end) {
      const period = getQuinzainePeriod(current);

      if (period.fin >= start && period.debut <= end) {
        quinzaines.push({
          quinzaine: period.label,
          dateDebut: period.debut.toISOString().split('T')[0],
          dateFin: period.fin.toISOString().split('T')[0],
          totalNouveauxCredits: 0,
          totalCreditsPayes: 0
        });
      }

      if (current.getDate() <= 15) {
        current = new Date(current.getFullYear(), current.getMonth(), 16);
      } else {
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      }
    }

    return quinzaines;
  };

  const loadEvolutionData = async () => {
    try {
      setIsLoading(true);

      const startDate = new Date(dateDebut);
      const endDate = new Date(dateFin);
      endDate.setHours(23, 59, 59, 999);

      const { data: allCredits, error: errorAll } = await supabase
        .from('liste_credits')
        .select('*');

      if (errorAll) {
        console.error('Erreur chargement données:', errorAll);
        return;
      }

      const quinzaines = getAllQuinzainesBetween(startDate, endDate);

      quinzaines.forEach(quinzaine => {
        const qDebut = new Date(quinzaine.dateDebut);
        const qFin = new Date(quinzaine.dateFin);
        qFin.setHours(23, 59, 59, 999);

        allCredits?.forEach(credit => {
          const creditDate = new Date(credit.created_at);
          if (creditDate >= qDebut && creditDate <= qFin) {
            quinzaine.totalNouveauxCredits += credit.montant_credit || 0;
          }

          if (credit.statut !== 'Non payé' && credit.date_paiement_effectif) {
            const paiementDate = new Date(credit.date_paiement_effectif);
            if (paiementDate >= qDebut && paiementDate <= qFin) {
              quinzaine.totalCreditsPayes += credit.paiement || 0;
            }
          }
        });
      });

      let cumulNouveaux = 0;
      let cumulPayes = 0;

      const quinzainesAvecCumul = quinzaines.map(q => {
        cumulNouveaux += q.totalNouveauxCredits;
        cumulPayes += q.totalCreditsPayes;

        return {
          ...q,
          totalNouveauxCredits: cumulNouveaux,
          totalCreditsPayes: cumulPayes
        };
      });

      setQuinzainesData(quinzainesAvecCumul);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const maxValue = Math.max(
    ...quinzainesData.map(d => Math.max(d.totalNouveauxCredits, d.totalCreditsPayes)),
    1
  );

  const getPointY = (value: number, containerHeight: number) => {
    return containerHeight - (value / maxValue) * containerHeight;
  };

  const createPathData = (data: number[], height: number) => {
    if (data.length === 0) return '';

    const width = 100;
    const step = width / (data.length - 1 || 1);

    let path = `M 0 ${getPointY(data[0], height)}`;

    data.forEach((value, index) => {
      if (index > 0) {
        const x = step * index;
        const y = getPointY(value, height);
        path += ` L ${x} ${y}`;
      }
    });

    return path;
  };

  const handleFilterApply = () => {
    if (dateDebut && dateFin) {
      loadEvolutionData();
    }
  };

  const handleReset = () => {
    initializeDates();
  };

  const openDetailModal = (type: 'nouveaux' | 'payes') => {
    setDetailModalType(type);
    setDetailModalOpen(true);
  };

  const dernierIndex = quinzainesData.length - 1;
  const derniersNouveaux = dernierIndex >= 0 ? quinzainesData[dernierIndex].totalNouveauxCredits : 0;
  const derniersPayes = dernierIndex >= 0 ? quinzainesData[dernierIndex].totalCreditsPayes : 0;
  const difference = derniersPayes - derniersNouveaux;
  const differencePercent = derniersNouveaux > 0 ? (difference / derniersNouveaux) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Evolution Paiements / Crédits</h2>
              <p className="text-white text-opacity-90 mt-1">
                Analyse cumulative par quinzaine
              </p>
            </div>
            <button
              onClick={onClose}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-b">
          <div className="bg-white rounded-lg p-4 shadow mb-4">
            <div className="flex items-center space-x-2 mb-3">
              <Filter className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Filtres de Période</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Début
                </label>
                <input
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Fin
                </label>
                <input
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleFilterApply}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Appliquer
                </button>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleReset}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Réinitialiser
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => openDetailModal('nouveaux')}
              className="bg-white rounded-lg p-4 shadow hover:shadow-lg transition-shadow cursor-pointer text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Nouveaux Crédits</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {derniersNouveaux.toLocaleString('fr-FR')} DT
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-orange-500" />
              </div>
            </button>

            <button
              onClick={() => openDetailModal('payes')}
              className="bg-white rounded-lg p-4 shadow hover:shadow-lg transition-shadow cursor-pointer text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Crédits Payés</p>
                  <p className="text-2xl font-bold text-green-600">
                    {derniersPayes.toLocaleString('fr-FR')} DT
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </button>

            <div className="bg-white rounded-lg p-4 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Différence</p>
                  <p className={`text-2xl font-bold ${difference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {difference > 0 ? '+' : ''}{difference.toLocaleString('fr-FR')} DT
                  </p>
                  <p className={`text-xs ${difference > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {differencePercent > 0 ? '+' : ''}{differencePercent.toFixed(1)}%
                  </p>
                </div>
                <DollarSign className={`w-8 h-8 ${difference > 0 ? 'text-red-500' : 'text-green-500'}`} />
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Chargement des données...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Évolution Cumulative par Quinzaine</h3>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-orange-500 rounded"></div>
                    <span className="text-sm text-gray-600">Total Nouveaux Crédits</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span className="text-sm text-gray-600">Total Crédits Payés</span>
                  </div>
                </div>
              </div>

              {quinzainesData.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Aucune donnée disponible pour cette période</p>
                </div>
              ) : (
                <>
                  <div className="relative bg-gray-50 rounded-lg p-4" style={{ height: '400px' }}>
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="w-full h-full"
                    >
                      <defs>
                        <linearGradient id="gridGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#e5e7eb" stopOpacity="0.5" />
                          <stop offset="100%" stopColor="#e5e7eb" stopOpacity="0.1" />
                        </linearGradient>
                      </defs>

                      <line x1="0" y1="25" x2="100" y2="25" stroke="#e5e7eb" strokeWidth="0.2" />
                      <line x1="0" y1="50" x2="100" y2="50" stroke="#e5e7eb" strokeWidth="0.2" />
                      <line x1="0" y1="75" x2="100" y2="75" stroke="#e5e7eb" strokeWidth="0.2" />

                      <path
                        d={createPathData(quinzainesData.map(d => d.totalNouveauxCredits), 100)}
                        fill="none"
                        stroke="#f97316"
                        strokeWidth="0.8"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />

                      <path
                        d={createPathData(quinzainesData.map(d => d.totalCreditsPayes), 100)}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="0.8"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />

                      {quinzainesData.map((_, index) => {
                        const step = 100 / (quinzainesData.length - 1 || 1);
                        const x = step * index;
                        const yNouveaux = getPointY(quinzainesData[index].totalNouveauxCredits, 100);
                        const yPayes = getPointY(quinzainesData[index].totalCreditsPayes, 100);

                        return (
                          <g key={index}>
                            <circle cx={x} cy={yNouveaux} r="1" fill="#f97316" />
                            <circle cx={x} cy={yPayes} r="1" fill="#10b981" />
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quinzaine
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Nouveaux
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Payés
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Écart
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {quinzainesData.map((q, index) => {
                          const ecart = q.totalCreditsPayes - q.totalNouveauxCredits;
                          return (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {q.quinzaine}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-orange-600 font-semibold">
                                {q.totalNouveauxCredits.toLocaleString('fr-FR')} DT
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-green-600 font-semibold">
                                {q.totalCreditsPayes.toLocaleString('fr-FR')} DT
                              </td>
                              <td className={`px-4 py-3 text-sm text-right font-semibold ${
                                ecart >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {ecart >= 0 ? '+' : ''}{ecart.toLocaleString('fr-FR')} DT
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="p-4 bg-gray-50 rounded-b-xl border-t">
          <button
            onClick={onClose}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>

      <CreditStatsDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        type={detailModalType}
        dateDebut={dateDebut}
        dateFin={dateFin}
      />
    </div>
  );
};

export default CreditEvolutionModal;
