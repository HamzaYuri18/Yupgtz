import React, { useState } from 'react';
import { X, Send, MessageSquare, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export interface SmsTarget {
  numero_contrat: string;
  assure: string;
  telephone: string;
}

interface Props {
  targets: SmsTarget[];
  username: string;
  onClose: () => void;
}

const DEFAULT_MESSAGE = "Cher Assuré {assure}, votre contrat {contrat} est arrivé à échéance. Merci de régulariser votre situation dans les meilleurs délais. STAR 72486210";

type SendStatus = 'pending' | 'sent' | 'failed' | 'skipped';

interface SendResult {
  target: SmsTarget;
  status: SendStatus;
  reason?: string;
}

const TermesSmsModal: React.FC<Props> = ({ targets, username, onClose }) => {
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const maxChars = 160;

  const buildMessage = (target: SmsTarget): string =>
    message
      .replace(/\{assure\}/gi, target.assure || '')
      .replace(/\{contrat\}/gi, target.numero_contrat || '');

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const newResults: SendResult[] = [];

    for (const target of targets) {
      const cleanedPhone = (target.telephone || '').replace(/\s+/g, '');
      const finalMessage = buildMessage(target);

      if (!cleanedPhone || cleanedPhone.length < 8) {
        newResults.push({ target, status: 'skipped', reason: 'Numéro de téléphone manquant ou invalide' });
        continue;
      }
      if (finalMessage.length > maxChars) {
        newResults.push({ target, status: 'skipped', reason: `Message trop long (${finalMessage.length}/${maxChars})` });
        continue;
      }

      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ mobile: cleanedPhone, message: finalMessage }),
        });
        const result = await response.json();

        await supabase.from('smsing').insert({
          date_envoi: new Date().toISOString(),
          description: finalMessage,
          destinataire: cleanedPhone,
          client: target.assure,
          numero_contrat: target.numero_contrat,
          utilisateur: username,
          statut: result.success ? 'Envoyé' : 'Non envoyé',
        });

        newResults.push(result.success
          ? { target, status: 'sent' }
          : { target, status: 'failed', reason: result.error || 'Échec inconnu' });
      } catch (err) {
        await supabase.from('smsing').insert({
          date_envoi: new Date().toISOString(),
          description: finalMessage,
          destinataire: cleanedPhone,
          client: target.assure,
          numero_contrat: target.numero_contrat,
          utilisateur: username,
          statut: 'Non envoyé',
        });
        newResults.push({ target, status: 'failed', reason: err instanceof Error ? err.message : 'Erreur réseau' });
      }
    }

    setResults(newResults);
    setSending(false);
  };

  const previewLength = targets.length > 0 ? buildMessage(targets[0]).length : message.length;
  const sentCount = results?.filter(r => r.status === 'sent').length || 0;
  const failedCount = results?.filter(r => r.status === 'failed' || r.status === 'skipped').length || 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Envoyer un SMS de rappel
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <span className="font-semibold">{targets.length}</span> contrat{targets.length > 1 ? 's' : ''} sélectionné{targets.length > 1 ? 's' : ''}
          </div>

          {!results && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Message (personnalisable)</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={5}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Placeholders disponibles : <code className="bg-gray-100 px-1 rounded">{'{assure}'}</code> et <code className="bg-gray-100 px-1 rounded">{'{contrat}'}</code> — remplacés pour chaque destinataire.
                </p>
                <p className={`text-xs mt-1 text-right ${previewLength > maxChars ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                  {previewLength}/{maxChars} caractères (aperçu du 1er destinataire)
                </p>
              </div>

              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {targets.map(t => (
                  <div key={t.numero_contrat} className="px-3 py-2 text-xs flex justify-between items-center">
                    <span className="text-gray-700">{t.assure} — {t.numero_contrat}</span>
                    <span className={t.telephone ? 'text-gray-500' : 'text-red-500 font-medium'}>
                      {t.telephone || 'sans numéro'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={sending}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !message.trim()}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {sending ? `Envoi… (${targets.length})` : (<><Send className="w-4 h-4" /> Envoyer {targets.length > 1 ? `(${targets.length})` : ''}</>)}
                </button>
              </div>
            </>
          )}

          {results && (
            <>
              <div className="flex gap-3">
                <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{sentCount}</p>
                  <p className="text-xs text-green-600">Envoyé{sentCount > 1 ? 's' : ''}</p>
                </div>
                <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{failedCount}</p>
                  <p className="text-xs text-red-600">Échec{failedCount > 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {results.map(r => (
                  <div key={r.target.numero_contrat} className="px-3 py-2 text-xs flex items-start gap-2">
                    {r.status === 'sent' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-gray-800 font-medium">{r.target.assure} — {r.target.numero_contrat}</p>
                      {r.reason && <p className="text-gray-500">{r.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={onClose}
                className="w-full px-4 py-2.5 bg-slate-700 text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                Fermer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TermesSmsModal;
