import React, { useEffect, useState } from 'react';
import { ShieldCheck, X, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getSession } from '../utils/auth';
import type { ProlongForm } from './ProlongationExceptionnelle';

const CODE_VALIDITY_MINUTES = 30;

const formatDateFR = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR');
};

const generateCode = (): string => String(Math.floor(100000 + Math.random() * 900000));

interface Props {
  form: ProlongForm;
  pdfBytes: Uint8Array;
  onClose: () => void;
  onValidated: () => void;
}

type Phase = 'sending' | 'awaiting_code' | 'verifying' | 'error';

const ProlongationValidationModal: React.FC<Props> = ({ form, pdfBytes, onClose, onValidated }) => {
  const [phase, setPhase] = useState<Phase>('sending');
  const [initError, setInitError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const username = getSession()?.username || 'Inconnu';

  const sendRequest = async () => {
    setPhase('sending');
    setInitError(null);
    setVerifyError(null);

    try {
      // 1. Héberger le PDF pour que Mr Hamza puisse le consulter avant de valider.
      const fileName = `prolongation_${form.numero_contrat.replace(/\//g, '-')}_${Date.now()}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from('prolongations')
        .upload(fileName, new Blob([pdfBytes], { type: 'application/pdf' }));
      if (uploadErr) throw new Error(`Échec de l'envoi du PDF: ${uploadErr.message}`);

      const { data: urlData } = supabase.storage.from('prolongations').getPublicUrl(fileName);
      const pdfUrl = urlData.publicUrl;

      // 2. Générer et enregistrer le code de validation.
      const code = generateCode();
      const expiresAt = new Date(Date.now() + CODE_VALIDITY_MINUTES * 60000).toISOString();

      const { error: insertErr } = await supabase.from('prolongation_validation_codes').insert({
        numero_contrat: form.numero_contrat,
        code,
        requested_by: username,
        pdf_url: pdfUrl,
        expires_at: expiresAt,
      });
      if (insertErr) throw new Error(`Échec de l'enregistrement du code: ${insertErr.message}`);

      // 3. Envoyer le code + les données + le lien à Mr Hamza par Telegram.
      const message = [
        '🔔 Demande de validation — Prolongation',
        '',
        `Demandé par : ${username}`,
        `Contrat : ${form.numero_contrat}`,
        `Assuré : ${form.assure}`,
        `Marque / Immat. : ${form.marque} — ${form.immatriculation}`,
        `Date d'effet : ${formatDateFR(form.date_effet)}`,
        `Fin de prolongation : ${formatDateFR(form.date_fin_prolongation)}`,
        '',
        `Voir le PDF : ${pdfUrl}`,
        '',
        `Code de validation : ${code}`,
        `(valable ${CODE_VALIDITY_MINUTES} minutes)`,
      ].join('\n');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/send-telegram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ message }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Échec de l'envoi Telegram à Mr Hamza.");
      }

      // 4. Le lien a été transmis : le PDF n'a plus besoin de rester sur le
      // stockage Supabase, on le supprime pour ne pas accumuler d'espace.
      await supabase.storage.from('prolongations').remove([fileName]);

      setPhase('awaiting_code');
    } catch (err) {
      setInitError(err instanceof Error ? err.message : 'Erreur lors de la préparation de la demande.');
      setPhase('error');
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    sendRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResend = () => {
    setResending(true);
    setCodeInput('');
    sendRequest();
  };

  const handleValidate = async () => {
    if (!codeInput.trim()) {
      setVerifyError('Veuillez saisir le code reçu par Mr Hamza.');
      return;
    }

    setPhase('verifying');
    setVerifyError(null);

    try {
      const { data, error: err } = await supabase
        .from('prolongation_validation_codes')
        .select('id, expires_at')
        .eq('numero_contrat', form.numero_contrat)
        .eq('requested_by', username)
        .eq('code', codeInput.trim())
        .eq('used', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (err) throw new Error(err.message);

      if (!data) {
        setVerifyError('Code invalide. Vérifiez le code envoyé à Mr Hamza.');
        setPhase('awaiting_code');
        return;
      }

      if (new Date(data.expires_at).getTime() < Date.now()) {
        setVerifyError('Ce code a expiré. Demandez un nouveau code.');
        setPhase('awaiting_code');
        return;
      }

      await supabase
        .from('prolongation_validation_codes')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('id', data.id);

      onValidated();
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Erreur lors de la vérification du code.');
      setPhase('awaiting_code');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-violet-600" />
            Validation requise
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {phase === 'sending' && (
          <p className="text-sm text-slate-600 py-6 text-center">
            Envoi de la demande à Mr Hamza…
          </p>
        )}

        {phase === 'error' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <p className="text-sm">{initError}</p>
            </div>
            <button
              onClick={sendRequest}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-violet-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </button>
          </div>
        )}

        {(phase === 'awaiting_code' || phase === 'verifying') && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Un code de validation a été envoyé à <span className="font-semibold">Mr Hamza</span> par Telegram,
              avec les données de la prolongation et un lien vers le PDF. Saisissez ce code pour poursuivre.
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Code de validation</label>
              <input
                type="text"
                inputMode="numeric"
                value={codeInput}
                onChange={e => setCodeInput(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleValidate()}
                placeholder="Ex: 482913"
                maxLength={6}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-center text-lg tracking-widest font-mono focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                autoFocus
              />
            </div>

            {verifyError && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-sm">{verifyError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleResend}
                disabled={resending || phase === 'verifying'}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
                Renvoyer
              </button>
              <button
                onClick={handleValidate}
                disabled={phase === 'verifying'}
                className="flex-1 flex items-center justify-center gap-2 bg-violet-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-violet-700 disabled:opacity-60 transition-colors"
              >
                {phase === 'verifying' ? 'Vérification…' : 'Valider'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProlongationValidationModal;
