import React, { useState } from 'react';
import { ShieldCheck, Upload, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sendTelegramToHamza } from '../utils/declarationEspece';

export interface PendingDeclaration {
  numero_sinistre: string;
  client: string;
  montant: number;
}

interface Props {
  pending: PendingDeclaration[];
  username: string;
  onAllValidated: () => void;
  onCancel: () => void;
}

const CODE_VALIDITY_MINUTES = 20;

const generateCode = (): string => String(Math.floor(100000 + Math.random() * 900000));

type RowPhase = 'idle' | 'sending' | 'awaiting_code' | 'verifying' | 'validated';

interface RowState {
  phase: RowPhase;
  file: File | null;
  scanUrl: string;
  codeInput: string;
  error: string;
}

const emptyRow = (): RowState => ({ phase: 'idle', file: null, scanUrl: '', codeInput: '', error: '' });

const DeclarationScanValidationModal: React.FC<Props> = ({ pending, username, onAllValidated, onCancel }) => {
  const [rows, setRows] = useState<Record<string, RowState>>({});

  const getRow = (numero: string): RowState => rows[numero] ?? emptyRow();
  const patchRow = (numero: string, patch: Partial<RowState>) =>
    setRows(prev => ({ ...prev, [numero]: { ...(prev[numero] ?? emptyRow()), ...patch } }));

  const allValidated = pending.length > 0 && pending.every(p => getRow(p.numero_sinistre).phase === 'validated');

  const handleSendScan = async (p: PendingDeclaration) => {
    const row = getRow(p.numero_sinistre);
    if (!row.file) {
      patchRow(p.numero_sinistre, { error: 'Veuillez sélectionner le scan de la déclaration signée.' });
      return;
    }
    patchRow(p.numero_sinistre, { phase: 'sending', error: '' });
    try {
      const ext = row.file.name.split('.').pop() || 'pdf';
      const filePath = `declarations_sinistres/declaration_${p.numero_sinistre}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('attestations').upload(filePath, row.file);
      if (uploadErr) throw new Error(`Échec de l'envoi du scan : ${uploadErr.message}`);
      const { data: urlData } = supabase.storage.from('attestations').getPublicUrl(filePath);
      const scanUrl = urlData.publicUrl;

      const code = generateCode();
      const expiresAt = new Date(Date.now() + CODE_VALIDITY_MINUTES * 60000).toISOString();
      const { error: insertErr } = await supabase.from('sinistre_declaration_codes').insert({
        numero_sinistre: p.numero_sinistre,
        code,
        requested_by: username,
        scan_url: scanUrl,
        expires_at: expiresAt,
      });
      if (insertErr) throw new Error(`Échec de l'enregistrement du code : ${insertErr.message}`);

      const telegram = await sendTelegramToHamza(
        `🔔 Validation déclaration espèce — sinistre\n\n` +
        `Demandé par : ${username}\n` +
        `N° sinistre : ${p.numero_sinistre}\n` +
        `Client : ${p.client}\n` +
        `Montant : ${p.montant.toFixed(3)} DT\n\n` +
        `Scan de la déclaration signée : ${scanUrl}\n\n` +
        `Code de validation : ${code}\n` +
        `(valable ${CODE_VALIDITY_MINUTES} minutes, uniquement pour ${username})`
      );
      if (!telegram.success) throw new Error(telegram.error || "Échec de l'envoi Telegram à Hamza.");

      patchRow(p.numero_sinistre, { phase: 'awaiting_code', scanUrl, file: null });
    } catch (err) {
      patchRow(p.numero_sinistre, {
        phase: 'idle',
        error: err instanceof Error ? err.message : 'Erreur lors de l\'envoi.',
      });
    }
  };

  const handleValidateCode = async (p: PendingDeclaration) => {
    const row = getRow(p.numero_sinistre);
    if (!row.codeInput.trim()) {
      patchRow(p.numero_sinistre, { error: 'Veuillez saisir le code reçu par Mr Hamza.' });
      return;
    }
    patchRow(p.numero_sinistre, { phase: 'verifying', error: '' });
    try {
      const { data, error } = await supabase
        .from('sinistre_declaration_codes')
        .select('id, expires_at, scan_url')
        .eq('numero_sinistre', p.numero_sinistre)
        .eq('requested_by', username)
        .eq('code', row.codeInput.trim())
        .eq('used', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);

      if (!data) {
        patchRow(p.numero_sinistre, { phase: 'awaiting_code', error: 'Code invalide. Vérifiez le code envoyé à Mr Hamza.' });
        return;
      }
      if (new Date(data.expires_at).getTime() < Date.now()) {
        patchRow(p.numero_sinistre, { phase: 'awaiting_code', error: 'Ce code a expiré (20 minutes). Renvoyez le scan pour obtenir un nouveau code.' });
        return;
      }

      await supabase
        .from('sinistre_declaration_codes')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('id', data.id);

      const { error: sinistreErr } = await supabase
        .from('sinistres')
        .update({ declaration_validee: true, declaration_scan_url: data.scan_url })
        .eq('numero_sinistre', p.numero_sinistre);
      if (sinistreErr) throw new Error(sinistreErr.message);

      patchRow(p.numero_sinistre, { phase: 'validated', error: '' });
    } catch (err) {
      patchRow(p.numero_sinistre, {
        phase: 'awaiting_code',
        error: err instanceof Error ? err.message : 'Erreur lors de la vérification du code.',
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[90] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-black via-gray-900 to-emerald-900 px-6 py-5 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-300" />
            <div>
              <h3 className="text-white font-bold">Déclarations signées requises</h3>
              <p className="text-emerald-200/70 text-xs">Sinistres payés en espèce non encore validés</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-700">
            Pour clôturer la caisse, scannez la déclaration signée et légalisée de chaque sinistre payé en espèce, puis saisissez le code envoyé à Mr Hamza par Telegram (valable {CODE_VALIDITY_MINUTES} minutes, uniquement pour vous).
          </p>

          {pending.map(p => {
            const row = getRow(p.numero_sinistre);
            return (
              <div key={p.numero_sinistre} className={`border-2 rounded-xl p-4 space-y-3 ${row.phase === 'validated' ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-semibold text-slate-900">Sinistre {p.numero_sinistre}</span>
                    <span className="text-slate-500 ml-2">{p.client}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{p.montant.toFixed(3)} DT</span>
                </div>

                {row.phase === 'validated' ? (
                  <p className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
                    <CheckCircle2 className="w-4 h-4" /> Déclaration validée par Mr Hamza
                  </p>
                ) : row.phase === 'awaiting_code' || row.phase === 'verifying' ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600">Saisissez le code reçu par Telegram :</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={row.codeInput}
                        onChange={e => patchRow(p.numero_sinistre, { codeInput: e.target.value.replace(/\D/g, '') })}
                        onKeyDown={e => e.key === 'Enter' && handleValidateCode(p)}
                        placeholder="Ex: 482913"
                        className="flex-1 border border-slate-300 rounded-xl px-4 py-2 text-center tracking-widest font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                      <button
                        onClick={() => handleValidateCode(p)}
                        disabled={row.phase === 'verifying'}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                      >
                        {row.phase === 'verifying' ? 'Vérification…' : 'Valider'}
                      </button>
                    </div>
                    <button
                      onClick={() => patchRow(p.numero_sinistre, { phase: 'idle', error: '' })}
                      className="text-xs text-slate-500 hover:text-slate-700 underline"
                    >
                      Renvoyer un scan
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 border-2 border-dashed border-slate-300 rounded-xl px-4 py-3 cursor-pointer hover:border-emerald-400 transition-colors">
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-600 truncate">
                        {row.file ? row.file.name : 'Sélectionner le scan (image ou PDF)'}
                      </span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={e => patchRow(p.numero_sinistre, { file: e.target.files?.[0] ?? null, error: '' })}
                      />
                    </label>
                    <button
                      onClick={() => handleSendScan(p)}
                      disabled={row.phase === 'sending'}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-60 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      {row.phase === 'sending' ? 'Envoi à Mr Hamza…' : 'Envoyer à Mr Hamza pour validation'}
                    </button>
                  </div>
                )}

                {row.error && (
                  <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {row.error}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={onAllValidated}
              disabled={!allValidated}
              className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              Poursuivre la clôture
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeclarationScanValidationModal;
