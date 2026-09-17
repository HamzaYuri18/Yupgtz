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
  isHamza: boolean;
  onClose: () => void;
}

const DEFAULT_MESSAGE = "Cher Assuré {assure}, votre contrat {contrat} est arrivé à échéance. Merci de régulariser votre situation dans les meilleurs délais. STAR 72486210";

type TemplateId = 'echeance' | 'impaye';
type Lang = 'fr' | 'ar';

// Modèles imposés aux utilisateurs autres que Hamza (lui seul peut taper un
// message libre). Pas de {assure}/{contrat} ici : texte fourni tel quel.
const TEMPLATES: Record<TemplateId, Record<Lang, string>> = {
  echeance: {
    fr: "Cher Client, votre contrat d'assurance arrive à échéance. Merci de régler votre prime d'assurance le plus tôt possible. Tel: 72486210",
    ar: 'عزيزي الزبون، عقد تأمينك قد وصل إلى تاريخ الاستحقاق. يرجى تسديد قسط التأمين في أقرب وقت ممكن. الهاتف: 72486210',
  },
  impaye: {
    fr: "Cher client, votre prime d'assurance demeure impayée. Merci de bien vouloir passer par notre agence pour le paiement afin d'éviter des pénalités. Tel: 72486210",
    ar: 'عزيزي الزبون، لا يزال قسط تأمينك غير مسدد. يرجى المرور بوكالتنا لتسوية الدفع تفاديًا للغرامات. الهاتف: 72486210',
  },
};

const TEMPLATE_LABELS: Record<TemplateId, string> = {
  echeance: 'Rappel échéance',
  impaye: 'Rappel impayé',
};

type SendStatus = 'pending' | 'sent' | 'failed' | 'skipped';

interface SendResult {
  target: SmsTarget;
  phone: string;
  status: SendStatus;
  reason?: string;
}

const TermesSmsModal: React.FC<Props> = ({ targets, username, isHamza, onClose }) => {
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [templateId, setTemplateId] = useState<TemplateId>('echeance');
  const [lang, setLang] = useState<Lang>('fr');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);
  // Numéros ajoutés manuellement par Hamza, EN PLUS du numéro déjà
  // enregistré pour le contrat (le SMS part vers tous les numéros).
  const [extraPhones, setExtraPhones] = useState<Record<string, string[]>>({});
  const [phoneDraft, setPhoneDraft] = useState<Record<string, string>>({});
  const maxChars = 160;

  // Pour les utilisateurs non-Hamza, le message effectif est toujours l'un
  // des 4 modèles fixes (2 modèles x 2 langues) — jamais du texte libre.
  const effectiveMessage = isHamza ? message : TEMPLATES[templateId][lang];

  const phonesFor = (target: SmsTarget): string[] => {
    const base = target.telephone ? [target.telephone] : [];
    return [...base, ...(extraPhones[target.numero_contrat] || [])];
  };

  const addPhone = (numeroContrat: string) => {
    const value = (phoneDraft[numeroContrat] || '').trim();
    if (!value) return;
    setExtraPhones(prev => ({
      ...prev,
      [numeroContrat]: [...(prev[numeroContrat] || []), value],
    }));
    setPhoneDraft(prev => ({ ...prev, [numeroContrat]: '' }));
  };

  const removeExtraPhone = (numeroContrat: string, index: number) => {
    setExtraPhones(prev => ({
      ...prev,
      [numeroContrat]: (prev[numeroContrat] || []).filter((_, i) => i !== index),
    }));
  };

  const buildMessage = (target: SmsTarget): string =>
    effectiveMessage
      .replace(/\{assure\}/gi, target.assure || '')
      .replace(/\{contrat\}/gi, target.numero_contrat || '');

  const handleSend = async () => {
    if (!effectiveMessage.trim()) return;
    setSending(true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const newResults: SendResult[] = [];

    for (const target of targets) {
      const phones = phonesFor(target);
      const finalMessage = buildMessage(target);

      if (phones.length === 0) {
        newResults.push({ target, phone: '', status: 'skipped', reason: 'Numéro de téléphone manquant' });
        continue;
      }
      if (finalMessage.length > maxChars) {
        newResults.push({ target, phone: phones.join(', '), status: 'skipped', reason: `Message trop long (${finalMessage.length}/${maxChars})` });
        continue;
      }

      for (const rawPhone of phones) {
        const cleanedPhone = rawPhone.replace(/\s+/g, '');

        if (!cleanedPhone || cleanedPhone.length < 8) {
          newResults.push({ target, phone: rawPhone, status: 'skipped', reason: 'Numéro invalide' });
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
            ? { target, phone: cleanedPhone, status: 'sent' }
            : { target, phone: cleanedPhone, status: 'failed', reason: result.error || 'Échec inconnu' });
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
          newResults.push({ target, phone: cleanedPhone, status: 'failed', reason: err instanceof Error ? err.message : 'Erreur réseau' });
        }
      }
    }

    setResults(newResults);
    setSending(false);
  };

  const previewLength = targets.length > 0 ? buildMessage(targets[0]).length : effectiveMessage.length;
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
              {isHamza ? (
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
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Modèle de message</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(TEMPLATES) as TemplateId[]).map(id => (
                      <button
                        key={id}
                        onClick={() => setTemplateId(id)}
                        className={`px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                          templateId === id ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {TEMPLATE_LABELS[id]}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2 bg-gray-100 rounded-lg p-1 w-fit">
                    {(['fr', 'ar'] as Lang[]).map(l => (
                      <button
                        key={l}
                        onClick={() => setLang(l)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                          lang === l ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {l === 'fr' ? 'Français' : 'العربية'}
                      </button>
                    ))}
                  </div>
                  <div
                    className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800"
                    dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  >
                    {effectiveMessage}
                  </div>
                </div>
              )}

              <p className={`text-xs -mt-2 text-right ${previewLength > maxChars ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                {previewLength}/{maxChars} caractères (aperçu du 1er destinataire)
              </p>

              <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {targets.map(t => {
                  const phones = phonesFor(t);
                  const extras = extraPhones[t.numero_contrat] || [];
                  return (
                    <div key={t.numero_contrat} className="px-3 py-2 text-xs space-y-1.5">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-gray-700 truncate">{t.assure} — {t.numero_contrat}</span>
                        {phones.length === 0 && <span className="text-red-500 font-medium shrink-0">sans numéro</span>}
                      </div>

                      {phones.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {t.telephone && (
                            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{t.telephone}</span>
                          )}
                          {extras.map((p, i) => (
                            <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              {p}
                              {isHamza && (
                                <button onClick={() => removeExtraPhone(t.numero_contrat, i)} className="hover:text-blue-900">
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      {isHamza && (
                        <div className="flex gap-1.5">
                          <input
                            type="tel"
                            value={phoneDraft[t.numero_contrat] || ''}
                            onChange={e => setPhoneDraft(prev => ({ ...prev, [t.numero_contrat]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPhone(t.numero_contrat); } }}
                            placeholder="Ajouter un numéro"
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                          <button
                            onClick={() => addPhone(t.numero_contrat)}
                            className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                          >
                            Ajouter
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
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
                  disabled={sending || !effectiveMessage.trim()}
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
                {results.map((r, i) => (
                  <div key={`${r.target.numero_contrat}-${r.phone}-${i}`} className="px-3 py-2 text-xs flex items-start gap-2">
                    {r.status === 'sent' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-gray-800 font-medium">
                        {r.target.assure} — {r.target.numero_contrat}{r.phone ? ` (${r.phone})` : ''}
                      </p>
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
