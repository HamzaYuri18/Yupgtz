import React, { useState, useEffect } from 'react';
import { X, CreditCard, User, Calendar, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CreditStatsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'nouveaux' | 'payes';
  dateDebut: string;
  dateFin: string;
}

const CreditStatsDetailModal: React.FC<CreditStatsDetailModalProps> = ({
  isOpen,
  onClose,
  type,
  dateDebut,
  dateFin
}) => {
  const [credits, setCredits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && dateDebut && dateFin) {
      loadCredits();
    }
  }, [isOpen, type, dateDebut, dateFin]);

  const loadCredits = async () => {
    try {
      setIsLoading(true);

      const startDate = new Date(dateDebut);
      const endDate = new Date(dateFin);
      endDate.setHours(23, 59, 59, 999);

      const { data: allCredits, error } = await supabase
        .from('liste_credits')
        .select('*');

      if (error) {
        console.error('Erreur chargement crédits:', error);
        return;
      }

      let filteredCredits: any[] = [];

      if (type === 'nouveaux') {
        filteredCredits = allCredits?.filter(credit => {
          const creditDate = new Date(credit.created_at);
          return creditDate >= startDate && creditDate <= endDate;
        }) || [];
      } else if (type === 'payes') {
        filteredCredits = allCredits?.filter(credit => {
          if (credit.statut === 'Non payé' || !credit.date_paiement_effectif) {
            return false;
          }
          const paiementDate = new Date(credit.date_paiement_effectif);
          return paiementDate >= startDate && paiementDate <= endDate;
        }) || [];
      }

      setCredits(filteredCredits);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'Payé':
      case 'Payé en total':
        return 'bg-green-100 text-green-800';
      case 'Payé partiellement':
        return 'bg-blue-100 text-blue-800';
      case 'En retard':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-orange-100 text-orange-800';
    }
  };

  const getTotalMontant = () => {
    return credits.reduce((sum, credit) => sum + (credit.montant_credit || 0), 0);
  };

  const getTotalPaye = () => {
    return credits.reduce((sum, credit) => sum + (credit.paiement || 0), 0);
  };

  const getTotalSolde = () => {
    return credits.reduce((sum, credit) => sum + (credit.solde || 0), 0);
  };

  const getHeaderColor = () => {
    return type === 'nouveaux'
      ? 'bg-gradient-to-r from-orange-500 to-orange-600'
      : 'bg-gradient-to-r from-green-500 to-green-600';
  };

  const getTitle = () => {
    return type === 'nouveaux'
      ? 'Détails des Nouveaux Crédits'
      : 'Détails des Crédits Payés';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className={`${getHeaderColor()} text-white p-6 rounded-t-xl`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{getTitle()}</h2>
              <p className="text-white text-opacity-90 mt-1">
                {credits.length} crédit{credits.length > 1 ? 's' : ''} trouvé{credits.length > 1 ? 's' : ''}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Montant Total Crédit</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {getTotalMontant().toLocaleString('fr-FR')} DT
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Payé</p>
                  <p className="text-2xl font-bold text-green-600">
                    {getTotalPaye().toLocaleString('fr-FR')} DT
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Solde Restant</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {getTotalSolde().toLocaleString('fr-FR')} DT
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-orange-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Chargement des données...</p>
              </div>
            </div>
          ) : credits.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Aucun crédit trouvé</p>
            </div>
          ) : (
            <div className="space-y-3">
              {credits.map((credit, index) => (
                <div
                  key={credit.id || index}
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 border border-gray-200"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        <p className="text-xs text-gray-500 font-medium">Contrat</p>
                      </div>
                      <p className="font-semibold text-gray-900">{credit.numero_contrat}</p>
                      <p className="text-sm text-gray-600">{credit.branche}</p>
                    </div>

                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <User className="w-4 h-4 text-gray-600" />
                        <p className="text-xs text-gray-500 font-medium">Assuré</p>
                      </div>
                      <p className="font-medium text-gray-900">{credit.assure}</p>
                      {credit.telephone && (
                        <p className="text-sm text-gray-600">{credit.telephone}</p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <p className="text-xs text-gray-500 font-medium">Montants</p>
                      </div>
                      <p className="text-sm">
                        <span className="text-gray-600">Crédit:</span>{' '}
                        <span className="font-semibold text-gray-900">
                          {(credit.montant_credit || 0).toLocaleString('fr-FR')} DT
                        </span>
                      </p>
                      <p className="text-sm">
                        <span className="text-gray-600">Payé:</span>{' '}
                        <span className="font-semibold text-green-600">
                          {(credit.paiement || 0).toLocaleString('fr-FR')} DT
                        </span>
                      </p>
                      <p className="text-sm">
                        <span className="text-gray-600">Solde:</span>{' '}
                        <span className="font-semibold text-orange-600">
                          {(credit.solde || 0).toLocaleString('fr-FR')} DT
                        </span>
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <Calendar className="w-4 h-4 text-orange-600" />
                        <p className="text-xs text-gray-500 font-medium">Dates & Statut</p>
                      </div>
                      <p className="text-sm text-gray-600">
                        Créé le: {new Date(credit.created_at).toLocaleDateString('fr-FR')}
                      </p>
                      {credit.date_paiement_prevue && (
                        <p className="text-sm text-gray-600">
                          Échéance: {new Date(credit.date_paiement_prevue).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                      {credit.date_paiement_effectif && (
                        <p className="text-sm text-gray-600">
                          Payé le: {new Date(credit.date_paiement_effectif).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                      <div className="mt-1">
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(credit.statut)}`}>
                          {credit.statut}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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

export default CreditStatsDetailModal;
