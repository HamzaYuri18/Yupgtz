import React, { useState } from 'react';
import { ShieldCheck, Upload, CheckCircle2, AlertCircle, Send, FileCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sendTelegramToHamza } from '../utils/declarationEspece';

export interface PendingDeclaration {
  kind: 'sinistre' | 'ristourne';
  reference: string;
  label: string;
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
  derogation: boolean;
  codeInput: string;
  error: string;
}

const emptyRow = (): RowState => ({ phase: 'idle', file: null, scanUrl: '', derogation: false, codeInput: '', error: '' });

const DeclarationScanValidationModal: React.FC<Props> = ({ pending, username, onAllValidated, onCancel }) => {
  const [rows, setRows] = useState<Record<string, RowState>>({});

  const keyOf = (p: PendingDeclaration) => `${p.kind}:${p.reference}`;
  const getRow = (p: PendingDeclaration): RowState => rows[keyOf(p)] ?? emptyRow();
  const patchRow = (p: PendingDeclaration, patch: Partial<RowState>) =>
    setRows(prev => ({ ...prev, [keyOf(p)]: { ...(prev[keyOf(p)] ?? emptyRow()), ...patch } }));

  const allValidated = pending.length > 0 && pending.every(p => getRow(p).phase === 'validated');

  const createCodeAndNotify = async (p: PendingDeclaration, derogation: boolean, scanUrl: string) => {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_VALIDITY_MINUTES * 60000).toISOString();
    const { error: insertErr } = await supabase.from('sinistre_declaration_codes').insert({
      type_dossier: p.kind,
      reference: p.reference,
      numero_sinistre: p.kind === 'sinistre' ? p.reference : null,
      code,
      requested_by: username,
      scan_url: scanUrl || null,
      derogation,
      expires_at: expiresAt,
    });
    if (insertErr) throw new Error(`Échec de l'enregistrement du code : ${insertErr.message}`);

    const titre = p.kind === 'sinistre' ? 'sinistre' : 'ristourne';
    const lignes = [
      derogation
        ? `🔔 Demande de DÉROGATION — déclaration signée non fournie (${titre})`
        : `🔔 Validation déclaration signée — ${titre}`,
      '',
      `Demandé par : ${username}`,
      `Référence : ${p.label}`,
      `Client : ${p.client}`,
      `Montant : ${p.montant.toFixed(3)} DT`,
    ];
    if (scanUrl) lignes.push('', `Scan de la déclaration signée : ${scanUrl}`);
    lignes.push('', `Code de validation : ${code}`, `(valable ${CODE_VALIDITY_MINUTES} minutes, uniquement pour ${username})`);
    const telegram = await sendTelegramToHamza(lignes.join('\n'));
    if (!telegram.success) throw new Error(telegram.error || "Échec de l'envoi Telegram à Mr Hamza.");
  };

  const handleSendScan = async (p: PendingDeclaration) => {
    const row = getRow(p);
    if (!row.file) {
      patchRow(p, { error: 'Veuillez sélectionner le scan de la déclaration signée.' });
      return;
    }
    patchRow(p, { phase: 'sending', error: '' });
    try {
      const ext = row.file.name.split('.').pop() || 'pdf';
      const filePath = `declarations/${p.kind}_${p.reference}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('attestations').upload(filePath, row.file);
      if (uploadErr) throw new Error(`Échec de l'envoi du scan : ${uploadErr.message}`);
      const { data: urlData } = supabase.storage.from('attestations').getPublicUrl(filePath);
      const scanUrl = urlData.publicUrl;

      await createCodeAndNotify(p, false, scanUrl);
      patchRow(p, { phase: 'awaiting_code', scanUrl, derogation: false, file: null });
    } catch (err) {
      patchRow(p, { phase: 'idle', error: err instanceof Error ? err.message : "Erreur lors de l'envoi." });
    }
  };

  const handleRequestDerogation = async (p: PendingDeclaration) => {
    patchRow(p, { phase: 'sending', error: '' });
    try {
      await createCodeAndNotify(p, true, '');
      patchRow(p, { phase: 'awaiting_code', derogation: true, scanUrl: '' });
    } catch (err) {
      patchRow(p, { phase: 'idle', error: err instanceof Error ? err.message : 'Erreur lors de la demande de dérogation.' });
    }
  };

  const handleValidateCode = async (p: PendingDeclaration) => {
    const row = getRow(p);
    if (!row.codeInput.trim()) {
      patchRow(p, { error: 'Veuillez saisir le code reçu par Mr Hamza.' });
      return;
    }
    patchRow(p, { phase: 'verifying', error: '' });
    try {
      const { data, error } = await supabase
        .from('sinistre_declaration_codes')
        .select('id, expires_at, scan_url, derogation')
        .eq('type_dossier', p.kind)
        .eq('reference', p.reference)
        .eq('requested_by', username)
        .eq('code', row.codeInput.trim())
        .eq('used', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);

      if (!data) {
        patchRow(p, { phase: 'awaiting_code', error: 'Code invalide. Vérifiez le code envoyé à Mr Hamza.' });
        return;
      }
      if (new Date(data.expires_at).getTime() < Date.now()) {
        patchRow(p, { phase: 'awaiting_code', error: 'Ce code a expiré (20 minutes). Relancez la demande pour obtenir un nouveau code.' });
        return;
      }

      await supabase
        .from('sinistre_declaration_codes')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('id', data.id);

      const update = {
        declaration_validee: true,
        declaration_scan_url: data.scan_url,
        declaration_derogation: !!data.derogation,
      };
      const { error: targetErr } = p.kind === 'sinistre'
        ? await supabase.from('sinistres').update(update).eq('numero_sinistre', p.reference)
        : await supabase.from('ristournes').update(update).eq('id', p.reference);
      if (targetErr) throw new Error(targetErr.message);

      patchRow(p, { phase: 'validated', error: '' });
    } catch (err) {
      patchRow(p, { phase: 'awaiting_code', error: err instanceof Error ? err.message : 'Erreur lors de la vérification du code.' });
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
              <p className="text-emerald-200/70 text-xs">Paiements en espèce non encore validés</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-700">
            Pour clôturer la caisse, pour chaque paiement en espèce : envoyez le scan de la déclaration signée et légalisée, ou demandez une dérogation à Mr Hamza. Dans les deux cas, saisissez le code reçu par Telegram (valable {CODE_VALIDITY_MINUTES} minutes, uniquement pour vous).
          </p>

          {pending.map(p => {
            const row = getRow(p);
            return (
              <div key={keyOf(p)} className={`border-2 rounded-xl p-4 space-y-3 ${row.phase === 'validated' ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-semibold text-slate-900">{p.label}</span>
                    <span className="text-slate-500 ml-2">{p.client}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{p.montant.toFixed(3)} DT</span>
                </div>

                {row.phase === 'validated' ? (
                  <p className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    {row.derogation ? 'Dérogation accordée par Mr Hamza' : 'Déclaration validée par Mr Hamza'}
                  </p>
                ) : row.phase === 'awaiting_code' || row.phase === 'verifying' ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600">
                      {row.derogation ? 'Demande de dérogation envoyée. ' : 'Scan envoyé. '}
                      Saisissez le code reçu par Telegram :
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={row.codeInput}
                        onChange={e => patchRow(p, { codeInput: e.target.value.replace(/\D/g, '') })}
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
                      onClick={() => patchRow(p, { phase: 'idle', error: '' })}
                      className="text-xs text-slate-500 hover:text-slate-700 underline"
                    >
                      Revenir au choix
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
                        onChange={e => patchRow(p, { file: e.target.files?.[0] ?? null, error: '' })}
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleSendScan(p)}
                        disabled={row.phase === 'sending'}
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60 transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        {row.phase === 'sending' ? 'Envoi…' : 'Envoyer le scan'}
                      </button>
                      <button
                        onClick={() => handleRequestDerogation(p)}
                        disabled={row.phase === 'sending'}
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border-2 border-amber-400 text-amber-800 bg-amber-50 text-sm font-medium hover:bg-amber-100 disabled:opacity-60 transition-colors"
                      >
                        <FileCheck className="w-4 h-4" />
                        Demander une dérogation
                      </button>
                    </div>
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
