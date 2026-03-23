import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Calendar, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CreditEvolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EvolutionData {
  date: string;
  nouveauxCredits: number;
  creditsPayes: number;
}

const CreditEvolutionModal: React.FC<CreditEvolutionModalProps> = ({ isOpen, onClose }) => {
  const [evolutionData, setEvolutionData] = useState<EvolutionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalNouveaux, setTotalNouveaux] = useState(0);
  const [totalPayes, setTotalPayes] = useState(0);

  useEffect(() => {
    if (isOpen) {
      loadEvolutionData();
    }
  }, [isOpen]);

  const loadEvolutionData = async () => {
    try {
      setIsLoading(true);

      const today = new Date();
      const quinzeJoursAvant = new Date(today);
      quinzeJoursAvant.setDate(today.getDate() - 15);

      const dateDebut = quinzeJoursAvant.toISOString().split('T')[0];
      const dateFin = today.toISOString().split('T')[0];

      const { data: credits, error } = await supabase
        .from('liste_credits')
        .select('*')
        .gte('created_at', dateDebut)
        .lte('created_at', dateFin + 'T23:59:59');

      if (error) {
        console.error('Erreur chargement données:', error);
        return;
      }

      const dataByDate: { [key: string]: { nouveaux: number; payes: number } } = {};

      for (let i = 0; i <= 15; i++) {
        const currentDate = new Date(quinzeJoursAvant);
        currentDate.setDate(quinzeJoursAvant.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];
        dataByDate[dateStr] = { nouveaux: 0, payes: 0 };
      }

      let totalN = 0;
      let totalP = 0;

      credits?.forEach(credit => {
        const creditDate = credit.created_at.split('T')[0];

        if (dataByDate[creditDate]) {
          dataByDate[creditDate].nouveaux += credit.montant_credit || 0;
          totalN += credit.montant_credit || 0;

          if (credit.statut === 'Payé' || credit.statut === 'Payé en total') {
            if (credit.date_paiement_effectif) {
              const paiementDate = credit.date_paiement_effectif.split('T')[0];
              if (dataByDate[paiementDate]) {
                dataByDate[paiementDate].payes += credit.paiement || 0;
                totalP += credit.paiement || 0;
              }
            }
          } else if (credit.statut === 'Payé partiellement') {
            if (credit.date_paiement_effectif) {
              const paiementDate = credit.date_paiement_effectif.split('T')[0];
              if (dataByDate[paiementDate]) {
                dataByDate[paiementDate].payes += credit.paiement || 0;
                totalP += credit.paiement || 0;
              }
            }
          }
        }
      });

      const evolutionArray: EvolutionData[] = Object.keys(dataByDate)
        .sort()
        .map(date => ({
          date,
          nouveauxCredits: dataByDate[date].nouveaux,
          creditsPayes: dataByDate[date].payes
        }));

      setEvolutionData(evolutionArray);
      setTotalNouveaux(totalN);
      setTotalPayes(totalP);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const maxValue = Math.max(
    ...evolutionData.map(d => Math.max(d.nouveauxCredits, d.creditsPayes)),
    1
  );

  const getBarHeight = (value: number) => {
    return (value / maxValue) * 100;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  const difference = totalPayes - totalNouveaux;
  const differencePercent = totalNouveaux > 0 ? (difference / totalNouveaux) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Evolution Paiements / Crédits</h2>
              <p className="text-white text-opacity-90 mt-1">
                Analyse des 15 derniers jours
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

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Chargement des données...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-6 bg-gray-50 border-b">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Nouveaux Crédits</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {totalNouveaux.toLocaleString('fr-FR')} DT
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-orange-500" />
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Crédits Payés</p>
                      <p className="text-2xl font-bold text-green-600">
                        {totalPayes.toLocaleString('fr-FR')} DT
                      </p>
                    </div>
                    <TrendingDown className="w-8 h-8 text-green-500" />
                  </div>
                </div>

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

            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Évolution Quotidienne</h3>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-orange-500 rounded"></div>
                      <span className="text-sm text-gray-600">Nouveaux Crédits</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className="text-sm text-gray-600">Crédits Payés</span>
                    </div>
                  </div>
                </div>

                <div className="relative" style={{ height: '400px' }}>
                  <div className="absolute inset-0 flex items-end justify-between space-x-1">
                    {evolutionData.map((data, index) => (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div className="w-full flex items-end justify-center space-x-1 flex-1">
                          <div
                            className="bg-orange-500 rounded-t hover:bg-orange-600 transition-colors cursor-pointer relative group"
                            style={{
                              height: `${getBarHeight(data.nouveauxCredits)}%`,
                              width: '45%',
                              minHeight: data.nouveauxCredits > 0 ? '4px' : '0'
                            }}
                            title={`Nouveaux: ${data.nouveauxCredits.toLocaleString('fr-FR')} DT`}
                          >
                            {data.nouveauxCredits > 0 && (
                              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                {data.nouveauxCredits.toLocaleString('fr-FR')} DT
                              </div>
                            )}
                          </div>

                          <div
                            className="bg-green-500 rounded-t hover:bg-green-600 transition-colors cursor-pointer relative group"
                            style={{
                              height: `${getBarHeight(data.creditsPayes)}%`,
                              width: '45%',
                              minHeight: data.creditsPayes > 0 ? '4px' : '0'
                            }}
                            title={`Payés: ${data.creditsPayes.toLocaleString('fr-FR')} DT`}
                          >
                            {data.creditsPayes > 0 && (
                              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                {data.creditsPayes.toLocaleString('fr-FR')} DT
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-gray-600 transform rotate-45 origin-top-left">
                          {formatDate(data.date)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-12 pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 mb-2">Moyenne Nouveaux Crédits/jour:</p>
                      <p className="text-lg font-semibold text-orange-600">
                        {(totalNouveaux / 15).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DT
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-2">Moyenne Crédits Payés/jour:</p>
                      <p className="text-lg font-semibold text-green-600">
                        {(totalPayes / 15).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DT
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
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
    </div>
  );
};

export default CreditEvolutionModal;
