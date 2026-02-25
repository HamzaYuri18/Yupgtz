import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface TermeSuspenduModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractNumber: string;
  insuredName: string;
  dateEcheance: string;
  joursDepasses: number;
  primeTotale: number;
}

export default function TermeSuspenduModal({
  isOpen,
  onClose,
  contractNumber,
  insuredName,
  dateEcheance,
  joursDepasses,
  primeTotale
}: TermeSuspenduModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="relative bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-300">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="p-8">
          <div className="flex items-start space-x-4 mb-6">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-red-600 animate-pulse" />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-red-600 mb-2">
                ATTENTION : TERME SUSPENDU
              </h2>
              <p className="text-lg text-gray-600">
                Délai de garde dépassé
              </p>
            </div>
          </div>

          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-red-800 mb-4">
              Ce Terme a dépassé le délai de garde et doit être remis en vigueur !
            </h3>

            <div className="space-y-3 text-gray-700">
              <div className="flex justify-between items-center border-b border-red-200 pb-2">
                <span className="font-semibold">Numéro de Police:</span>
                <span className="text-lg font-bold text-red-700">{contractNumber}</span>
              </div>

              <div className="flex justify-between items-center border-b border-red-200 pb-2">
                <span className="font-semibold">Assuré:</span>
                <span className="font-medium">{insuredName}</span>
              </div>

              <div className="flex justify-between items-center border-b border-red-200 pb-2">
                <span className="font-semibold">Date d'Échéance:</span>
                <span className="font-medium">
                  {new Date(dateEcheance).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </div>

              <div className="flex justify-between items-center border-b border-red-200 pb-2">
                <span className="font-semibold">Jours de Retard:</span>
                <span className="text-xl font-bold text-red-600">{joursDepasses} jours</span>
              </div>

              <div className="flex justify-between items-center border-b border-red-200 pb-2">
                <span className="font-semibold">Prime Totale:</span>
                <span className="text-lg font-bold text-gray-900">{primeTotale.toFixed(2)} TND</span>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-800 mb-1">
                  ACTION REQUISE IMMÉDIATEMENT
                </p>
                <p className="text-sm text-yellow-700">
                  Veuillez encaisser ce terme maintenant avant la clôture de la session.
                  Le contrat est enregistré dans la table des termes suspendus et nécessite une action immédiate.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-lg hover:shadow-xl"
            >
              J'ai compris, fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
