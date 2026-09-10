import React, { useEffect, useState } from 'react';
import { Calendar, Send, RefreshCw, X, AlertCircle, Filter, ArrowLeft, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getSession } from '../utils/auth';

interface ProlongationRow {
  id: string;
  numero_contrat: string;
  assure: string;
  classe: string;
  marque: string;
  immatriculation: string;
  date_effet: string;
  date_fin_prolongation: string;
  pour_le_compte: string;
  date_demande: string;
}

const formatDateFR = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR');
};

const daysRemaining = (iso: string): number => {
  if (!iso) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / 86400000);
};

interface Props {
  onBack: () => void;
}

const ProlongationsList: React.FC<Props> = ({ onBack }) => {
  const [rows, setRows] = useState<ProlongationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [smsTarget, setSmsTarget] = useState<ProlongationRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProlongationRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isHamza = getSession()?.username === 'Hamza';

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('prolongation').select('*').order('date_fin_prolongation', { ascending: true });
      if (dateFrom) query = query.gte('date_fin_prolongation', dateFrom);
      if (dateTo) query = query.lte('date_fin_prolongation', dateTo);
      const { data, error: err } = await query;
      if (err) throw err;
      setRows(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des prolongations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetFilter = () => {
    setDateFrom('');
    setDateTo('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error: err } = await supabase.from('prolongation').delete().eq('id', deleteTarget.id);
      if (err) throw err;
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-violet-600" />
            Liste des prolongations
          </h2>
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 transition-all font-medium text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fin de prolongation — du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">au</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filtrer
          </button>
          {(dateFrom || dateTo) && (
            <button onClick={resetFilter} className="text-sm text-slate-500 hover:text-slate-700">
              Réinitialiser
            </button>
          )}
          <button
            onClick={load}
            className="ml-auto flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500 py-10 text-center">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500 py-10 text-center">Aucune prolongation trouvée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-200">
                  <th className="py-2 pr-3">Contrat</th>
                  <th className="py-2 pr-3">Assuré</th>
                  <th className="py-2 pr-3">Marque / Immat.</th>
                  <th className="py-2 pr-3">Date d'effet</th>
                  <th className="py-2 pr-3">Fin prolongation</th>
                  <th className="py-2 pr-3">Jours restants</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const remaining = daysRemaining(row.date_fin_prolongation);
                  const badgeClass =
                    remaining < 0 ? 'bg-red-100 text-red-700' :
                    remaining <= 5 ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700';
                  return (
                    <tr key={row.id || row.numero_contrat} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2.5 pr-3 font-mono text-slate-700">{row.numero_contrat}</td>
                      <td className="py-2.5 pr-3 text-slate-700">{row.assure}</td>
                      <td className="py-2.5 pr-3 text-slate-700">{row.marque} — {row.immatriculation}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{formatDateFR(row.date_effet)}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{formatDateFR(row.date_fin_prolongation)}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
                          {remaining < 0 ? `Expirée (${Math.abs(remaining)} j)` : `${remaining} j`}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSmsTarget(row)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                            SMS
                          </button>
                          {isHamza && (
                            <button
                              onClick={() => setDeleteTarget(row)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-medium hover:bg-red-100 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Supprimer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {smsTarget && <ProlongationSMSModal row={smsTarget} onClose={() => setSmsTarget(null)} />}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4" onClick={() => setDeleteTarget(null)}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Supprimer la prolongation
            </h3>
            <p className="text-sm text-slate-600">
              Confirmez la suppression de la prolongation du contrat{' '}
              <span className="font-semibold">{deleteTarget.numero_contrat}</span> ({deleteTarget.assure}).
              Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Modal d'envoi SMS ───────────────────────────────────────────────────────

const ProlongationSMSModal: React.FC<{ row: ProlongationRow; onClose: () => void }> = ({ row, onClose }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const maxChars = 160;

  useEffect(() => {
    const remaining = daysRemaining(row.date_fin_prolongation);
    const dateStr = formatDateFR(row.date_fin_prolongation);
    const msg = remaining >= 0
      ? `Cher Assuré, votre prolongation exceptionnelle du contrat ${row.numero_contrat} expire le ${dateStr} (${remaining} jour(s) restant(s)). Merci de régulariser votre situation. STAR 72486210`
      : `Cher Assuré, votre prolongation exceptionnelle du contrat ${row.numero_contrat} a expiré le ${dateStr}. Merci de régulariser votre situation. STAR 72486210`;
    setMessage(msg);
  }, [row]);

  const handleSend = async () => {
    if (!phoneNumber || !message) {
      setStatus({ type: 'error', message: 'Veuillez renseigner le numéro et le message.' });
      return;
    }
    const cleanedPhone = phoneNumber.replace(/\s+/g, '');
    if (cleanedPhone.length < 8) {
      setStatus({ type: 'error', message: 'Numéro de téléphone invalide.' });
      return;
    }
    if (message.length > maxChars) {
      setStatus({ type: 'error', message: `Le message dépasse la limite de ${maxChars} caractères.` });
      return;
    }

    setIsSending(true);
    setStatus(null);
    const session = getSession();
    const currentUsername = session?.username || 'Inconnu';

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ mobile: cleanedPhone, message }),
      });
      const result = await response.json();

      await supabase.from('smsing').insert({
        date_envoi: new Date().toISOString(),
        description: message,
        destinataire: cleanedPhone,
        client: row.assure,
        numero_contrat: row.numero_contrat,
        utilisateur: currentUsername,
        statut: result.success ? 'Envoyé' : 'Non envoyé',
      });

      if (result.success) {
        setStatus({ type: 'success', message: 'SMS envoyé.' });
        setTimeout(onClose, 1500);
      } else {
        setStatus({ type: 'error', message: 'Échec de l\'envoi.' });
      }
    } catch {
      await supabase.from('smsing').insert({
        date_envoi: new Date().toISOString(),
        description: message,
        destinataire: cleanedPhone,
        client: row.assure,
        numero_contrat: row.numero_contrat,
        utilisateur: currentUsername,
        statut: 'Non envoyé',
      });
      setStatus({ type: 'error', message: 'Échec de l\'envoi.' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            Envoyer un SMS
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 space-y-1">
          <p><span className="font-semibold">Client :</span> {row.assure}</p>
          <p><span className="font-semibold">Contrat :</span> {row.numero_contrat}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Numéro de téléphone</label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)}
            placeholder="Ex: 20123456 ou 21620123456"
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Message</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={4}
            maxLength={maxChars}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />
          <p className="text-xs text-slate-500 mt-1 text-right">{message.length}/{maxChars}</p>
        </div>

        {status && (
          <div className={`p-3 rounded-lg text-sm ${status.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {status.message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSending}
            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSend}
            disabled={isSending}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isSending ? 'Envoi…' : (<><Send className="w-4 h-4" /> Envoyer</>)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProlongationsList;
