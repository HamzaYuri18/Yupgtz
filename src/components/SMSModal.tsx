import React, { useState, useEffect } from 'react';
import { X, Send, MessageSquare, Phone, Languages, AlertCircle, Calendar } from 'lucide-react';
import { getSession } from '../utils/auth';
import { supabase } from '../lib/supabase';

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

type SMSType = 'normal' | 'advanced';

const SMSModal: React.FC<SMSModalProps> = ({ isOpen, onClose, credit }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [language, setLanguage] = useState<'fr' | 'ar'>('fr');
  const [isMessageEditable, setIsMessageEditable] = useState(false);
  const [dateLimite, setDateLimite] = useState('');
  const [smsType, setSmsType] = useState<SMSType>('normal');
  const [charCount, setCharCount] = useState(0);
  const maxChars = 160;

  const generateMessage = (lang: 'fr' | 'ar', type: SMSType, date: string) => {
    const soldeFormatted = Math.abs(credit.solde).toLocaleString('fr-FR');
    const formattedDate = lang === 'fr' ? new Date(date).toLocaleDateString('fr-FR') : new Date(date).toLocaleDateString('ar-SA');

    if (lang === 'fr') {
      let msg = `Cher Assuré, Vous avez un montant impayé de ${soldeFormatted} DT.Nous vous prions de le payer avant le ${formattedDate}.`;
      if (type === 'advanced') {
        msg += ' Afin d\'eviter la suspension de votre contrat.';
      }
      msg += ' Merci pour votre comprehension. STAR 72486210';
      return msg;
    } else {
      let msg = `عزيزي المؤمن، لديك مبلغ غير مدفوع قدره ${soldeFormatted} دت. نرجو منك دفعه قبل ${formattedDate}.`;
      if (type === 'advanced') {
        msg += ' لتجنب تعليق عقدك.';
      }
      msg += ' شكرا لتفهمك. STAR 72486210';
      return msg;
    }
  };

  useEffect(() => {
    if (isOpen && credit && credit.numero_contrat) {
      console.log('SMS Modal ouvert pour:', credit);
      setPhoneNumber(credit.telephone || '');

      const session = getSession();
      const currentUsername = session?.username || '';
      setIsMessageEditable(currentUsername === 'Hamza');

      setDateLimite('');
      setSmsType('normal');
      setStatus(null);
      setMessage('');
    }
  }, [isOpen, credit]);

  useEffect(() => {
    if (dateLimite) {
      const newMessage = generateMessage(language, smsType, dateLimite);
      setMessage(newMessage);
      setCharCount(newMessage.length);
    }
  }, [dateLimite, language, smsType, credit.solde]);

  const handleSendSMS = async () => {
    if (!phoneNumber || !message || !dateLimite) {
      setStatus({ type: 'error', message: 'Veuillez remplir tous les champs' });
      return;
    }

    const cleanedPhone = phoneNumber.replace(/\s+/g, '');
    if (cleanedPhone.length < 8) {
      setStatus({ type: 'error', message: 'Numéro de téléphone invalide' });
      return;
    }

    if (message.length > maxChars) {
      setStatus({ type: 'error', message: `Le message dépasse la limite de ${maxChars} caractères` });
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
        const session = getSession();
        const currentUsername = session?.username || 'Inconnu';

        await supabase.from('smsing').insert({
          date_envoi: new Date().toISOString(),
          description: message,
          destinataire: cleanedPhone,
          client: credit.assure,
          numero_contrat: credit.numero_contrat,
          utilisateur: currentUsername,
          statut: 'Envoyé',
        });

        setStatus({ type: 'success', message: 'SMS Envoyé' });
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        await supabase.from('smsing').insert({
          date_envoi: new Date().toISOString(),
          description: message,
          destinataire: cleanedPhone,
          client: credit.assure,
          numero_contrat: credit.numero_contrat,
          utilisateur: session?.username || 'Inconnu',
          statut: 'Non envoyé',
        });

        setStatus({ type: 'error', message: 'Non envoyé' });
      }
    } catch (error) {
      console.error('Erreur:', error);

      const session = getSession();
      await supabase.from('smsing').insert({
        date_envoi: new Date().toISOString(),
        description: message,
        destinataire: cleanedPhone,
        client: credit.assure,
        numero_contrat: credit.numero_contrat,
        utilisateur: session?.username || 'Inconnu',
        statut: 'Non envoyé',
      });

      setStatus({ type: 'error', message: 'Non envoyé' });
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  const remainingChars = maxChars - charCount;

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
                {Math.abs(credit.solde).toLocaleString('fr-FR')} DT
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Date limite de paiement
            </label>
            <input
              type="date"
              value={dateLimite}
              onChange={(e) => setDateLimite(e.target.value)}
              className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                language === 'ar' ? 'text-right' : 'text-left'
              }`}
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Type de SMS</label>
            <div className="flex gap-4">
              <button
                onClick={() => setSmsType('normal')}
                className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                  smsType === 'normal'
                    ? 'border-blue-600 bg-blue-50 text-blue-900 font-semibold'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
              >
                Normal
              </button>
              <button
                onClick={() => setSmsType('advanced')}
                className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                  smsType === 'advanced'
                    ? 'border-blue-600 bg-blue-50 text-blue-900 font-semibold'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
              >
                Avancée
              </button>
            </div>
            {smsType === 'advanced' && (
              <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Message incluant l'avertissement de suspension
              </p>
            )}
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
              onChange={(e) => {
                setMessage(e.target.value);
                setCharCount(e.target.value.length);
              }}
              rows={5}
              maxLength={maxChars}
              disabled={true}
              className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-gray-100 cursor-not-allowed ${
                language === 'ar' ? 'text-right' : 'text-left'
              }`}
              placeholder="Le message sera généré automatiquement..."
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-gray-500">Limite: {maxChars} caractères</p>
              <p className={`text-sm font-medium ${remainingChars < 20 ? 'text-red-600' : 'text-gray-600'}`}>
                {charCount}/{maxChars}
              </p>
            </div>
          </div>

          {status && (
            <div
              className={`p-4 rounded-lg flex items-center gap-2 ${
                status.type === 'success'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : status.type === 'error'
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
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
              disabled={isSending || !phoneNumber || !message || !dateLimite}
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
