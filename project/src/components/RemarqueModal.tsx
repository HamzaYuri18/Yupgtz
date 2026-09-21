import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Calendar, User, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SmsHistoryEntry {
  date_envoi: string;
  utilisateur: string;
  statut: string | null;
  destinataire: string;
}

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
    echeance?: string;
  };
  onSave: () => void;
}

export default function RemarqueModal({ isOpen, onClose, contrat, onSave }: RemarqueModalProps) {
  const [remarque, setRemarque] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [smsHistory, setSmsHistory] = useState<SmsHistoryEntry[]>([]);
  const [smsHistoryLoading, setSmsHistoryLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRemarque('');
      setError('');
      setSuccess('');
      loadSmsHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, contrat.police, contrat.echeance]);

  const loadSmsHistory = async () => {
    if (!contrat.echeance) { setSmsHistory([]); return; }
    setSmsHistoryLoading(true);
    try {
      const echeanceFormatted = contrat.echeance.split('T')[0];
      const { data, error: smsError } = await supabase
        .from('smsing')
        .select('date_envoi, utilisateur, statut, destinataire')
        .eq('numero_contrat', contrat.police)
        .eq('echeance', echeanceFormatted)
        .order('date_envoi', { ascending: false });
      if (smsError) throw smsError;
      setSmsHistory(data || []);
    } catch (err) {
      console.error('Erreur lors du chargement de l\'historique SMS:', err);
      setSmsHistory([]);
    } finally {
      setSmsHistoryLoading(false);
    }
  };

  const handleSave = async () => {
    if (!remarque.trim()) {
      setError('Veuillez saisir une remarque');
      return;
    }

    if (!contrat.echeance) {
      setError('Date d\'échéance manquante');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const currentUser = localStorage.getItem('currentUser');

      const echeanceDate = new Date(contrat.echeance);
      const monthsFR = [
        'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'
      ];
      const monthName = monthsFR[echeanceDate.getMonth()];
      const year = echeanceDate.getFullYear();
      const tableName = `table_terme_${monthName}_${year}`;

      const echeanceFormatted = contrat.echeance.split('T')[0];

      console.log(`🔍 Enregistrement de la remarque dans la table: ${tableName}`);
      console.log(`🔍 Numero contrat: ${contrat.police}, Echeance: ${echeanceFormatted}`);

      const { error: updateError } = await supabase
        .from(tableName)
        .update({
          remarque: remarque.trim(),
          date_remarque: new Date().toISOString(),
          user_remarque: currentUser || 'Utilisateur inconnu'
        })
        .eq('numero_contrat', contrat.police)
        .eq('echeance', echeanceFormatted);

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

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-emerald-900 mb-3 flex items-center">
              <Send className="w-4 h-4 mr-2" />
              SMS envoyés pour ce terme ({smsHistory.length})
            </h3>
            {smsHistoryLoading ? (
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                Chargement...
              </div>
            ) : smsHistory.length === 0 ? (
              <p className="text-sm text-emerald-700">Aucun SMS envoyé pour ce terme.</p>
            ) : (
              <ul className="space-y-2">
                {smsHistory.map((sms, index) => (
                  <li key={index} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-700 bg-white rounded-lg border border-emerald-100 px-3 py-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-emerald-600" />
                      {new Date(sms.date_envoi).toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-emerald-600" />
                      {sms.utilisateur}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${
                      sms.statut === 'Envoyé' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {sms.statut || 'Envoyé'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
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
            <select
              value={remarque}
              onChange={(e) => setRemarque(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base"
              disabled={isSaving}
            >
              <option value="">Sélectionnez une option...</option>
              <option value="RT">RT</option>
              <option value="vendu">Vendu</option>
              <option value="relancé">Relancé</option>
              <option value="Payé par Note de Credit">Payé par Note de Credit</option>
              <option value="CX deposé">CX deposé</option>
            </select>
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
