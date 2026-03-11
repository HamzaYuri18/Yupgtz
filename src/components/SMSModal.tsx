import React, { useState, useEffect } from 'react';
import { X, Send, MessageSquare, Phone, Languages } from 'lucide-react';

interface SMSModalProps {
  isOpen: boolean;
  onClose: () => void;
  credit: {
    numero_contrat: string;
    assure: string;
    solde: number;
    telephone?: string;
  };
}

const SMSModal: React.FC<SMSModalProps> = ({ isOpen, onClose, credit }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [language, setLanguage] = useState<'fr' | 'ar'>('fr');

  useEffect(() => {
    if (isOpen && credit && credit.numero_contrat) {
      console.log('SMS Modal ouvert pour:', credit);
      setPhoneNumber(credit.telephone || '');

      const formatContractNumber = (contrat: string): string => {
        if (contrat.length >= 4) {
          const firstTwo = contrat.substring(0, 2);
          const lastTwo = contrat.substring(contrat.length - 2);
          return `${firstTwo}xx${lastTwo}`;
        }
        return contrat;
      };

      const formattedContract = formatContractNumber(credit.numero_contrat);

      if (language === 'fr') {
        setMessage(
          `Bonjour ${credit.assure}, vous avez un solde impayé de ${Math.abs(credit.solde).toLocaleString('fr-FR')} DT pour le contrat ${formattedContract}. Merci de régulariser votre situation. Salutations. STAR SHIRI 72486210`
        );
      } else {
        setMessage(
          `مرحبا ${credit.assure}، لديك رصيد غير مدفوع قدره ${Math.abs(credit.solde).toLocaleString('fr-FR')} دت للعقد ${formattedContract}. يرجى تسوية وضعيتك. تحياتنا. STAR SHIRI 72486210`
        );
      }
      setStatus(null);
    }
  }, [isOpen, credit, language]);

  if (!isOpen) return null;

  const handleSendSMS = async () => {
    if (!phoneNumber || !message) {
      setStatus({ type: 'error', message: 'Veuillez remplir tous les champs' });
      return;
    }

    const cleanedPhone = phoneNumber.replace(/\s+/g, '');
    if (cleanedPhone.length < 8) {
      setStatus({ type: 'error', message: 'Numéro de téléphone invalide' });
      return;
    }

    if (message.length > 160) {
      setStatus({ type: 'error', message: 'Le message ne peut pas dépasser 160 caractères' });
      return;
    }

    setIsSending(true);
    setStatus(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          mobile: cleanedPhone,
          message: message,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus({ type: 'success', message: 'SMS envoyé avec succès!' });
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setStatus({ type: 'error', message: result.error || 'Erreur lors de l\'envoi du SMS' });
      }
    } catch (error) {
      console.error('Erreur:', error);
      setStatus({ type: 'error', message: 'Erreur de connexion au serveur' });
    } finally {
      setIsSending(false);
    }
  };

  const remainingChars = 160 - message.length;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Envoyer un SMS</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Client:</span> {credit.assure}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Contrat:</span> {credit.numero_contrat}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Solde:</span>{' '}
              <span className="text-red-600 font-bold">
                {credit.solde.toLocaleString('fr-FR')} DT
              </span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Phone className="w-4 h-4 inline mr-2" />
              Numéro de téléphone
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Ex: 20123456 ou 21620123456"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Format: 8 chiffres ou avec préfixe international 216
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                <MessageSquare className="w-4 h-4 inline mr-2" />
                Message SMS
              </label>
              <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setLanguage('fr')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    language === 'fr'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Languages className="w-4 h-4 inline mr-1" />
                  Français
                </button>
                <button
                  onClick={() => setLanguage('ar')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    language === 'ar'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Languages className="w-4 h-4 inline mr-1" />
                  العربية
                </button>
              </div>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={160}
              className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                language === 'ar' ? 'text-right' : 'text-left'
              }`}
              placeholder="Votre message..."
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-gray-500">Limite: 160 caractères</p>
              <p className={`text-sm font-medium ${remainingChars < 20 ? 'text-red-600' : 'text-gray-600'}`}>
                {remainingChars} caractères restants
              </p>
            </div>
          </div>

          {status && (
            <div
              className={`p-4 rounded-lg ${
                status.type === 'success'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}
            >
              <p className="text-sm font-medium">{status.message}</p>
            </div>
          )}

          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={isSending}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleSendSMS}
              disabled={isSending || !phoneNumber || !message}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center space-x-2"
            >
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Envoi en cours...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Envoyer SMS</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SMSModal;
