import React, { useState } from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';

interface DeleteMotifModalProps {
  isOpen: boolean;
  transactionType: string;
  transactionInfo: string;
  onConfirm: (motif: string) => void;
  onCancel: () => void;
}

const DeleteMotifModal: React.FC<DeleteMotifModalProps> = ({
  isOpen,
  transactionType,
  transactionInfo,
  onConfirm,
  onCancel
}) => {
  const [motif, setMotif] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!motif.trim() || motif.trim().length < 5) {
      setError('Le motif est obligatoire et doit contenir au moins 5 caractères');
      return;
    }
    setMotif('');
    setError('');
    onConfirm(motif.trim());
  };

  const handleCancel = () => {
    setMotif('');
    setError('');
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-red-100">
        <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-t-2xl p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Suppression d'opération</h2>
              <p className="text-red-100 text-sm">Confirmation requise</p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Vous allez supprimer : {transactionType}
              </p>
              <p className="text-xs text-amber-700 mt-1">{transactionInfo}</p>
              <p className="text-xs text-amber-600 mt-2">
                Cette action est irréversible. L'opération sera archivée dans le reporting.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Motif de suppression <span className="text-red-500">*</span>
            </label>
            <textarea
              value={motif}
              onChange={(e) => {
                setMotif(e.target.value);
                if (error) setError('');
              }}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all resize-none text-sm"
              placeholder="Saisir le motif de la suppression (ex: Erreur de saisie, Double enregistrement, ...)"
              autoFocus
            />
            {error && (
              <p className="mt-1 text-xs text-red-600">{error}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {motif.trim().length} / minimum 5 caractères
            </p>
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-semibold text-sm flex items-center justify-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Confirmer la suppression</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteMotifModal;
