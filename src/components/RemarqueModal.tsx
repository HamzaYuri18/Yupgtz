import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Calendar, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RemarqueModalProps {
  isOpen: boolean;
  onClose: () => void;
  contrat: {
    police: string;
    mois: string;
    terme: number;
    remarque?: string;
    date_remarque?: string;
    user_remarque?: string;
  };
  onSave: () => void;
}

export default function RemarqueModal({ isOpen, onClose, contrat, onSave }: RemarqueModalProps) {
  const [remarque, setRemarque] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setRemarque('');
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!remarque.trim()) {
      setError('Veuillez saisir une remarque');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const currentUser = localStorage.getItem('currentUser');
      const tableName = `terme_${contrat.mois.replace(/-/g, '_')}`;

      const { error: updateError } = await supabase
        .from(tableName)
        .update({
          remarque: remarque.trim(),
          date_remarque: new Date().toISOString(),
          user_remarque: currentUser || 'Utilisateur inconnu'
        })
        .eq('police', contrat.police)
        .eq('terme', contrat.terme);

      if (updateError) {
        throw updateError;
      }

      setSuccess('Remarque enregistrée avec succès');
      setTimeout(() => {
        onSave();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Erreur lors de l\'enregistrement de la remarque:', err);
      setError('Erreur lors de l\'enregistrement: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-800">Remarques - Police {contrat.police}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Informations du contrat</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Police:</span>
                <span className="ml-2 font-medium text-gray-900">{contrat.police}</span>
              </div>
              <div>
                <span className="text-gray-600">Terme:</span>
                <span className="ml-2 font-medium text-gray-900">{contrat.terme}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-600">Mois:</span>
                <span className="ml-2 font-medium text-gray-900">{contrat.mois}</span>
              </div>
            </div>
          </div>

          {contrat.remarque && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" />
                Dernière remarque enregistrée
              </h3>
              <p className="text-gray-800 mb-3 whitespace-pre-wrap">{contrat.remarque}</p>
              <div className="flex flex-wrap gap-4 text-xs text-gray-600 border-t border-blue-200 pt-3">
                {contrat.date_remarque && (
                  <div className="flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    {new Date(contrat.date_remarque).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                )}
                {contrat.user_remarque && (
                  <div className="flex items-center">
                    <User className="w-3 h-3 mr-1" />
                    {contrat.user_remarque}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nouvelle remarque *
            </label>
            <textarea
              value={remarque}
              onChange={(e) => setRemarque(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              rows={4}
              placeholder="Saisissez votre remarque ici..."
              disabled={isSaving}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">
              {success}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Enregistrement...
              </>
            ) : (
              'Enregistrer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
