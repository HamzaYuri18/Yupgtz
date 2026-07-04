import React, { useState } from 'react';
import { Calendar, Download, TrendingUp, DollarSign, FileText, CreditCard, Trash2, X, Search, ChevronRight, BarChart2, Filter, Receipt, AlertCircle, ArrowDownCircle, RefreshCw, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getSession, getSessionDate } from '../utils/auth';
import * as XLSX from 'xlsx';
import DeleteMotifModal from './DeleteMotifModal';

interface Transaction {
  id: number;
  type: string;
  branche: string;
  numero_contrat: string;
  prime: number;
  assure: string;
  mode_paiement: string;
  type_paiement: string;
  montant_credit: number | null;
  montant: number;
  date_paiement_prevue: string | null;
  cree_par: string;
  created_at: string;
  echeance?: string;
  retour_type?: string | null;
  prime_avant_retour?: number | null;
  date_depense?: string | null;
  date_recette?: string | null;
  date_ristourne?: string | null;
  date_sinistre?: string | null;
  numero_sinistre?: string | null;
  numero_attestation?: string | null;
}

interface Statistics {
  totalTransactions: number;
  totalPrime: number;
  totalMontant: number;
  totalCredit: number;
  totalEspecesNet: number;
  totalCheque: number;
  totalDepenses: number;
  totalPaiementCredits: number;
  totalRistournes: number;
  totalSinistres: number;
  totalRecettes: number;
  countEspeces: number;
  countCheque: number;
  countDepenses: number;
  countPaiementCredits: number;
  countRistournes: number;
  countSinistres: number;
  countRecettes: number;
  countCredits: number;
  byBranche: { [key: string]: { montant: number; count: number } };
  byModePaiement: { [key: string]: { montant: number; count: number } };
  byTypePaiement: { [key: string]: { montant: number; count: number } };
  byType: { [key: string]: { montant: number; count: number } };
  byBanque: { [key: string]: { montant: number; count: number } };
}

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  transactions: Transaction[];
  onDelete: (t: Transaction) => void;
  onExport: (transactions: Transaction[], label: string) => void;
  formatCurrency: (n: number) => string;
  accentColor: string;
}

const TYPE_COLORS: Record<string, string> = {
  Terme: 'bg-blue-100 text-blue-700 border-blue-200',
  Affaire: 'bg-green-100 text-green-700 border-green-200',
  Avenant: 'bg-purple-100 text-purple-700 border-purple-200',
  'Encaissement pour autre code': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Dépense: 'bg-red-100 text-red-700 border-red-200',
  'Paiement Crédit': 'bg-orange-100 text-orange-700 border-orange-200',
  Ristourne: 'bg-violet-100 text-violet-700 border-violet-200',
  Sinistre: 'bg-pink-100 text-pink-700 border-pink-200',
  Recette: 'bg-sky-100 text-sky-700 border-sky-200',
  'Recette Exceptionnelle': 'bg-cyan-100 text-cyan-700 border-cyan-200',
};

const DetailModal: React.FC<DetailModalProps> = ({
  isOpen, onClose, title, subtitle, transactions, onDelete, onExport, formatCurrency, accentColor
}) => {
  if (!isOpen) return null;

  const totalPrime = transactions.reduce((s, t) => s + (t.prime || 0), 0);
  const totalMontant = transactions.reduce((s, t) => s + (t.montant || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`${accentColor} px-6 py-4 flex items-center justify-between`}>
          <div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
            {subtitle && <p className="text-sm text-white/80 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-white/20 text-white text-sm font-semibold px-3 py-1 rounded-full">
              {transactions.length} transaction{transactions.length > 1 ? 's' : ''}
            </span>
            <button
              onClick={() => onExport(transactions, title)}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Exporter
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary bar */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-gray-500">Total Primes:</span>{' '}
            <span className="font-semibold text-gray-800">{formatCurrency(totalPrime)}</span>
          </div>
          <div>
            <span className="text-gray-500">Total Montants:</span>{' '}
            <span className="font-semibold text-gray-800">{formatCurrency(totalMontant)}</span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FileText className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-sm">Aucune transaction</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Branche</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">N° Contrat</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Assuré</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Prime</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Mode</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Créé par</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${TYPE_COLORS[t.type] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                          {t.type}
                        </span>
                        {t.retour_type && (
                          <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${
                            t.retour_type === 'Technique' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200'
                          }`}>
                            {t.retour_type === 'Technique' ? 'RT' : 'RCX'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.branche}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{t.numero_contrat}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">{t.assure}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatCurrency(t.prime)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatCurrency(t.montant)}</td>
                    <td className="px-4 py-3 text-gray-600">{t.mode_paiement}</td>
                    <td className="px-4 py-3 text-gray-600">{t.cree_par}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => { onClose(); onDelete(t); }}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const TransactionReport: React.FC = () => {
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteTransaction, setPendingDeleteTransaction] = useState<Transaction | null>(null);

  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    title: string;
    subtitle?: string;
    transactions: Transaction[];
    accentColor: string;
  }>({ open: false, title: '', transactions: [], accentColor: 'bg-blue-600' });

  const openDetailModal = (
    title: string,
    filtered: Transaction[],
    accentColor: string,
    subtitle?: string
  ) => {
    setDetailModal({ open: true, title, transactions: filtered, accentColor, subtitle });
  };

  const calculateStatistics = (data: Transaction[]): Statistics => {
    const stats: Statistics = {
      totalTransactions: data.length,
      totalPrime: 0,
      totalMontant: 0,
      totalCredit: 0,
      totalEspecesNet: 0,
      totalCheque: 0,
      totalDepenses: 0,
      totalPaiementCredits: 0,
      totalRistournes: 0,
      totalSinistres: 0,
      totalRecettes: 0,
      countEspeces: 0,
      countCheque: 0,
      countDepenses: 0,
      countPaiementCredits: 0,
      countRistournes: 0,
      countSinistres: 0,
      countRecettes: 0,
      countCredits: 0,
      byBranche: {},
      byModePaiement: {},
      byTypePaiement: {},
      byType: {},
      byBanque: {}
    };

    data.forEach(transaction => {
      const prime = transaction.prime || 0;
      const montant = transaction.montant || 0;

      if (prime > 0) stats.totalPrime += prime;
      if (transaction.mode_paiement === 'Espece') stats.totalMontant += montant;
      if (transaction.montant_credit) { stats.totalCredit += transaction.montant_credit; stats.countCredits++; }
      if (transaction.mode_paiement === 'Espece' && montant > 0) { stats.countEspeces++; stats.totalEspecesNet += montant; }
      if (transaction.mode_paiement === 'Cheque' && montant > 0) { stats.totalCheque += montant; stats.countCheque++; }
      if (transaction.type === 'Dépense') { stats.totalDepenses += montant; stats.countDepenses++; }
      if (transaction.type === 'Paiement Crédit') { stats.totalPaiementCredits += montant; stats.countPaiementCredits++; }
      if (transaction.type === 'Ristourne') { stats.totalRistournes += montant; stats.countRistournes++; }
      if (transaction.type === 'Sinistre') { stats.totalSinistres += montant; stats.countSinistres++; }
      if (transaction.type === 'Recette') { stats.totalRecettes += montant; stats.countRecettes++; }

      if (!stats.byBranche[transaction.branche]) stats.byBranche[transaction.branche] = { montant: 0, count: 0 };
      stats.byBranche[transaction.branche].montant += prime;
      stats.byBranche[transaction.branche].count++;

      if (!stats.byModePaiement[transaction.mode_paiement]) stats.byModePaiement[transaction.mode_paiement] = { montant: 0, count: 0 };
      stats.byModePaiement[transaction.mode_paiement].montant += prime;
      stats.byModePaiement[transaction.mode_paiement].count++;

      if (!stats.byTypePaiement[transaction.type_paiement]) stats.byTypePaiement[transaction.type_paiement] = { montant: 0, count: 0 };
      if (transaction.type_paiement === 'Au comptant') {
        if (montant > 0) { stats.byTypePaiement[transaction.type_paiement].montant += montant; stats.byTypePaiement[transaction.type_paiement].count++; }
      } else if (transaction.type_paiement === 'Crédit') {
        stats.byTypePaiement[transaction.type_paiement].montant += (prime - montant);
        stats.byTypePaiement[transaction.type_paiement].count++;
      } else {
        stats.byTypePaiement[transaction.type_paiement].montant += prime;
        stats.byTypePaiement[transaction.type_paiement].count++;
      }

      if (!stats.byType[transaction.type]) stats.byType[transaction.type] = { montant: 0, count: 0 };
      stats.byType[transaction.type].montant += prime;
      stats.byType[transaction.type].count++;

      if (transaction.mode_paiement === 'Cheque' && transaction.type_paiement) {
        const banque = transaction.type_paiement || 'Non spécifié';
        if (!stats.byBanque[banque]) stats.byBanque[banque] = { montant: 0, count: 0 };
        stats.byBanque[banque].montant += montant;
        stats.byBanque[banque].count++;
      }
    });

    return stats;
  };

  const handleSearch = async () => {
    if (!dateFrom || !dateTo) { setError('Veuillez saisir les dates de début et de fin'); return; }
    if (new Date(dateFrom) > new Date(dateTo)) { setError('La date de début doit être antérieure à la date de fin'); return; }

    setLoading(true);
    setError('');

    try {
      const { data, error: fetchError } = await supabase
        .from('rapport')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const filteredData = (data || []).filter(transaction => {
        const transactionDateStr = transaction.created_at.split('T')[0];
        return transactionDateStr >= dateFrom && transactionDateStr <= dateTo;
      });

      const enrichedData = await Promise.all(
        filteredData.map(async (transaction) => {
          if (transaction.type === 'Terme' && transaction.numero_contrat && transaction.echeance) {
            try {
              const echeanceDate = new Date(transaction.echeance);
              const echeanceISO = echeanceDate.toISOString().split('T')[0];
              const { data: termeData } = await supabase
                .from('terme')
                .select('"Retour", "Prime avant retour", "Numero Attestation"')
                .eq('numero_contrat', transaction.numero_contrat)
                .eq('echeance', echeanceISO)
                .maybeSingle();
              if (termeData) return { ...transaction, retour_type: termeData.Retour || null, prime_avant_retour: termeData['Prime avant retour'] || null, numero_attestation: termeData['Numero Attestation'] || null };
            } catch {}
          }
          if (transaction.type === 'Affaire' && transaction.numero_contrat) {
            try {
              const createdDate = new Date(transaction.created_at);
              const createdISO = createdDate.toISOString().split('T')[0];
              const { data: affaireData } = await supabase
                .from('affaire')
                .select('"Numero Attestation"')
                .eq('numero_contrat', transaction.numero_contrat)
                .gte('created_at', `${createdISO}T00:00:00`)
                .lt('created_at', `${createdISO}T23:59:59`)
                .maybeSingle();
              if (affaireData) return { ...transaction, numero_attestation: affaireData['Numero Attestation'] || null };
            } catch {}
          }
          return transaction;
        })
      );

      setTransactions(enrichedData);
      setStatistics(calculateStatistics(enrichedData));
    } catch (err) {
      setError('Erreur lors de la recherche des transactions');
    } finally {
      setLoading(false);
    }
  };

  const initiateDelete = (transaction: Transaction) => {
    setPendingDeleteTransaction(transaction);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirmed = async (motif: string) => {
    setDeleteModalOpen(false);
    if (!pendingDeleteTransaction) return;
    const transaction = pendingDeleteTransaction;
    setPendingDeleteTransaction(null);
    await performDelete(transaction, motif);
  };

  const handleDeleteCancelled = () => {
    setDeleteModalOpen(false);
    setPendingDeleteTransaction(null);
  };

  const resetAttestationStatut = async (numeroAttestation: string | null | undefined) => {
    if (!numeroAttestation) return;
    const attestationNum = parseInt(numeroAttestation);
    if (isNaN(attestationNum)) return;
    try {
      const { data: carnetTables, error: carnetError } = await supabase.rpc('check_attestation_disponible', { attestation_numero: attestationNum });
      if (carnetError || !carnetTables || carnetTables.length === 0) return;
      const carnetTable = carnetTables[0]?.carnet_table;
      if (!carnetTable) return;
      await supabase.from(carnetTable).update({ statut: null }).eq('numero_attestation', numeroAttestation.toString());
    } catch {}
  };

  const libererAttestation = async (numeroAttestation: string, transaction: Transaction, motif: string) => {
    const session = getSession();
    const currentUser = session?.username || 'inconnu';
    try {
      await supabase.from('attestations_disponibles').insert({
        numero_attestation: numeroAttestation,
        libere_par: currentUser,
        motif_liberation: motif,
        ancien_numero_contrat: transaction.numero_contrat,
        ancien_assure: transaction.assure,
        reutilise: false
      });
    } catch {}
  };

  const saveToReportingSuppression = async (transaction: Transaction, motif: string): Promise<boolean> => {
    const session = getSession();
    const currentUser = session?.username || 'inconnu';
    const sessionDate = getSessionDate();
    const { error } = await supabase.from('reporting_suppression').insert({
      rapport_id: transaction.id, type: transaction.type, branche: transaction.branche || null,
      numero_contrat: transaction.numero_contrat || null, prime: transaction.prime ?? 0,
      assure: transaction.assure || null, mode_paiement: transaction.mode_paiement || null,
      type_paiement: transaction.type_paiement || null, montant_credit: transaction.montant_credit ?? null,
      montant: transaction.montant ?? 0, echeance: transaction.echeance || null,
      date_paiement_prevue: transaction.date_paiement_prevue || null, cree_par: transaction.cree_par || null,
      created_at_original: transaction.created_at, motif_suppression: motif,
      supprime_par: currentUser, supprime_le: new Date().toISOString(),
      numero_attestation: transaction.numero_attestation || null, session_date: sessionDate
    });
    return !error;
  };

  const performDelete = async (transaction: Transaction, motif: string) => {
    try {
      await saveToReportingSuppression(transaction, motif);
      let sourceDeleteSuccess = false;

      switch (transaction.type) {
        case 'Terme':
          if (transaction.numero_contrat && transaction.echeance) {
            const echeanceDate = new Date(transaction.echeance);
            const echeanceISO = echeanceDate.toISOString().split('T')[0];
            const { data: termeRow } = await supabase.from('terme').select('"Numero Attestation"').eq('numero_contrat', transaction.numero_contrat).eq('echeance', echeanceISO).maybeSingle();
            const { error: termeError } = await supabase.from('terme').delete().eq('numero_contrat', transaction.numero_contrat).eq('echeance', echeanceISO);
            sourceDeleteSuccess = !termeError;
            if (sourceDeleteSuccess) {
              const attestationNum = termeRow?.['Numero Attestation'] || transaction.numero_attestation;
              await resetAttestationStatut(attestationNum);
              if (attestationNum) await libererAttestation(attestationNum, transaction, motif);
            }
          }
          break;
        case 'Affaire':
          if (transaction.numero_contrat) {
            const createdDate = new Date(transaction.created_at);
            const createdISO = createdDate.toISOString().split('T')[0];
            const { data: affaireRow } = await supabase.from('affaire').select('"Numero Attestation"').eq('numero_contrat', transaction.numero_contrat).gte('created_at', `${createdISO}T00:00:00`).lt('created_at', `${createdISO}T23:59:59`).maybeSingle();
            const { error: affaireError } = await supabase.from('affaire').delete().eq('numero_contrat', transaction.numero_contrat).gte('created_at', `${createdISO}T00:00:00`).lt('created_at', `${createdISO}T23:59:59`);
            sourceDeleteSuccess = !affaireError;
            if (sourceDeleteSuccess) {
              const attestationNum = affaireRow?.['Numero Attestation'] || transaction.numero_attestation;
              await resetAttestationStatut(attestationNum);
              if (attestationNum) await libererAttestation(attestationNum, transaction, motif);
            }
          }
          break;
        case 'Dépense':
          if (transaction.date_depense && transaction.montant) {
            const { data: matchingDepenses } = await supabase.from('depenses').select('*').eq('date_depense', transaction.date_depense).eq('montant', Math.abs(transaction.montant)).limit(1);
            if (matchingDepenses && matchingDepenses.length > 0) {
              const { error: depenseError } = await supabase.from('depenses').delete().eq('id', matchingDepenses[0].id);
              sourceDeleteSuccess = !depenseError;
            }
          }
          break;
        case 'Recette Exceptionnelle':
        case 'Recette':
          if (transaction.date_recette && transaction.montant) {
            const { data: matchingRecettes } = await supabase.from('recettes_exceptionnelles').select('*').eq('date_recette', transaction.date_recette).eq('montant', transaction.montant).limit(1);
            if (matchingRecettes && matchingRecettes.length > 0) {
              const { error: recetteError } = await supabase.from('recettes_exceptionnelles').delete().eq('id', matchingRecettes[0].id);
              sourceDeleteSuccess = !recetteError;
            }
          }
          break;
        case 'Ristourne':
          if (transaction.numero_contrat && transaction.date_ristourne) {
            const { data: matchingRistournes } = await supabase.from('ristournes').select('*').eq('date_ristourne', transaction.date_ristourne);
            if (matchingRistournes && matchingRistournes.length > 0) {
              const ristourneToDelete = matchingRistournes.find(r => r.numero_contrat?.trim() === transaction.numero_contrat?.trim() || parseFloat(r.montant_ristourne) === Math.abs(transaction.montant));
              if (ristourneToDelete) {
                const { error: ristourneError } = await supabase.from('ristournes').delete().eq('id', ristourneToDelete.id);
                sourceDeleteSuccess = !ristourneError;
              }
            }
          }
          break;
        case 'Sinistre':
          if (transaction.numero_sinistre && transaction.date_sinistre) {
            const { data: matchingSinistres } = await supabase.from('sinistres').select('*').eq('date_sinistre', transaction.date_sinistre);
            if (matchingSinistres && matchingSinistres.length > 0) {
              const sinistreToDelete = matchingSinistres.find(s => s.numero_sinistre?.trim() === transaction.numero_sinistre?.trim() || Math.abs(parseFloat(s.montant)) === Math.abs(transaction.montant));
              if (sinistreToDelete) {
                const { error: sinistreError } = await supabase.from('sinistres').delete().eq('id', sinistreToDelete.id);
                sourceDeleteSuccess = !sinistreError;
              }
            }
          }
          break;
        case 'Paiement Crédit':
          sourceDeleteSuccess = true;
          break;
        case 'Encaissement pour autre code':
          if (transaction.numero_contrat && transaction.echeance) {
            const { error: encaissementError } = await supabase.from('encaissement_autre_code').delete().eq('numero_contrat', transaction.numero_contrat).eq('echeance', transaction.echeance);
            sourceDeleteSuccess = !encaissementError;
          }
          break;
        case 'Avenant':
          if (transaction.numero_contrat) {
            const createdDate = new Date(transaction.created_at);
            const createdISO = createdDate.toISOString().split('T')[0];
            const { error: avenantError } = await supabase.from('Avenant_Changement_véhicule').delete().eq('numero_contrat', transaction.numero_contrat).gte('created_at', `${createdISO}T00:00:00`).lt('created_at', `${createdISO}T23:59:59`);
            sourceDeleteSuccess = !avenantError;
          }
          break;
        default:
          sourceDeleteSuccess = true;
      }

      const { error: rapportError } = await supabase.from('rapport').delete().eq('id', transaction.id);
      if (rapportError) { setError(`Erreur suppression: ${rapportError.message}`); return; }

      setError('');
      void sourceDeleteSuccess;
      handleSearch();
    } catch (err) {
      setError(`Erreur: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const exportTransactions = (txs: Transaction[], label: string) => {
    if (txs.length === 0) return;
    const exportData = txs.map(t => ({
      'ID': t.id, 'Type': t.type,
      'Retour': t.retour_type ? (t.retour_type === 'Technique' ? 'RT' : 'RCX') : '',
      'Branche': t.branche, 'Numéro Contrat': t.numero_contrat,
      'Prime': t.prime, 'Prime Avant Retour': t.prime_avant_retour || '',
      'Assuré': t.assure, 'Mode Paiement': t.mode_paiement,
      'Type Paiement': t.type_paiement, 'Montant Crédit': t.montant_credit || '',
      'Montant': t.montant, 'Date Paiement Prévue': t.date_paiement_prevue || '',
      'Créé Par': t.cree_par, 'Date Création': new Date(t.created_at).toLocaleString('fr-FR')
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    const safeName = label.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_');
    XLSX.writeFile(wb, `${safeName}_${dateFrom}_au_${dateTo}.xlsx`);
  };

  const formatCurrency = (amount: number) =>
    `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(amount)} DT`;

  const getTransactionInfo = (t: Transaction) => {
    const parts = [];
    if (t.numero_contrat) parts.push(`N° ${t.numero_contrat}`);
    if (t.assure) parts.push(t.assure);
    if (t.prime) parts.push(`${t.prime} DT`);
    if (t.echeance) parts.push(`Échéance: ${t.echeance}`);
    return parts.join(' - ');
  };

  const statCards = statistics ? [
    {
      label: 'Total Transactions', value: statistics.totalTransactions, sub: null,
      icon: <Filter className="w-5 h-5" />, color: 'from-blue-500 to-blue-600', textColor: 'text-blue-100',
      filter: () => transactions, accent: 'bg-blue-600', isCount: true
    },
    {
      label: 'Total Primes', value: formatCurrency(statistics.totalPrime), sub: null,
      icon: <TrendingUp className="w-5 h-5" />, color: 'from-emerald-500 to-emerald-600', textColor: 'text-emerald-100',
      filter: () => transactions, accent: 'bg-emerald-600', isCount: false
    },
    {
      label: 'Total Montants Espèces', value: formatCurrency(statistics.totalMontant), sub: null,
      icon: <DollarSign className="w-5 h-5" />, color: 'from-green-500 to-green-600', textColor: 'text-green-100',
      filter: () => transactions.filter(t => t.mode_paiement === 'Espece'), accent: 'bg-green-600', isCount: false
    },
    {
      label: 'Total Crédits', value: formatCurrency(statistics.totalCredit), sub: `${statistics.countCredits} crédits`,
      icon: <CreditCard className="w-5 h-5" />, color: 'from-orange-500 to-orange-600', textColor: 'text-orange-100',
      filter: () => transactions.filter(t => !!t.montant_credit), accent: 'bg-orange-600', isCount: false
    },
    {
      label: 'Espèces Net', value: formatCurrency(statistics.totalEspecesNet), sub: `${statistics.countEspeces} opérations`,
      icon: <DollarSign className="w-5 h-5" />, color: 'from-teal-500 to-teal-600', textColor: 'text-teal-100',
      filter: () => transactions.filter(t => t.mode_paiement === 'Espece' && t.montant > 0), accent: 'bg-teal-600', isCount: false
    },
    {
      label: 'Total Chèques', value: formatCurrency(statistics.totalCheque), sub: `${statistics.countCheque} chèques`,
      icon: <Receipt className="w-5 h-5" />, color: 'from-cyan-500 to-cyan-600', textColor: 'text-cyan-100',
      filter: () => transactions.filter(t => t.mode_paiement === 'Cheque' && t.montant > 0), accent: 'bg-cyan-600', isCount: false
    },
    {
      label: 'Total Dépenses', value: formatCurrency(statistics.totalDepenses), sub: `${statistics.countDepenses} dépenses`,
      icon: <ArrowDownCircle className="w-5 h-5" />, color: 'from-red-500 to-red-600', textColor: 'text-red-100',
      filter: () => transactions.filter(t => t.type === 'Dépense'), accent: 'bg-red-600', isCount: false
    },
    {
      label: 'Paiements Crédits', value: formatCurrency(statistics.totalPaiementCredits), sub: `${statistics.countPaiementCredits} paiements`,
      icon: <RefreshCw className="w-5 h-5" />, color: 'from-amber-500 to-amber-600', textColor: 'text-amber-100',
      filter: () => transactions.filter(t => t.type === 'Paiement Crédit'), accent: 'bg-amber-600', isCount: false
    },
    {
      label: 'Total Ristournes', value: formatCurrency(statistics.totalRistournes), sub: `${statistics.countRistournes} ristournes`,
      icon: <Tag className="w-5 h-5" />, color: 'from-violet-500 to-violet-600', textColor: 'text-violet-100',
      filter: () => transactions.filter(t => t.type === 'Ristourne'), accent: 'bg-violet-600', isCount: false
    },
    {
      label: 'Total Sinistres', value: formatCurrency(statistics.totalSinistres), sub: `${statistics.countSinistres} sinistres`,
      icon: <AlertCircle className="w-5 h-5" />, color: 'from-pink-500 to-pink-600', textColor: 'text-pink-100',
      filter: () => transactions.filter(t => t.type === 'Sinistre'), accent: 'bg-pink-600', isCount: false
    },
    {
      label: 'Total Recettes', value: formatCurrency(statistics.totalRecettes), sub: `${statistics.countRecettes} recettes`,
      icon: <BarChart2 className="w-5 h-5" />, color: 'from-sky-500 to-sky-600', textColor: 'text-sky-100',
      filter: () => transactions.filter(t => t.type === 'Recette' || t.type === 'Recette Exceptionnelle'), accent: 'bg-sky-600', isCount: false
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Search panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Rapport de Transactions</h2>
            <p className="text-sm text-gray-500">Analysez vos transactions par période</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date au</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl font-medium text-sm transition-all shadow-sm hover:shadow-md"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {loading ? 'Recherche...' : 'Rechercher'}
          </button>
          {transactions.length > 0 && (
            <button
              onClick={() => exportTransactions(transactions, 'rapport_complet')}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              Exporter tout
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Stats grid */}
      {statistics && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {statCards.map((card, idx) => (
              <button
                key={idx}
                onClick={() => openDetailModal(card.label, card.filter(), card.accent, `${dateFrom} → ${dateTo}`)}
                className={`bg-gradient-to-br ${card.color} rounded-2xl p-4 text-white text-left hover:scale-[1.03] active:scale-[0.98] transition-all duration-150 shadow-sm hover:shadow-md group`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-1.5 bg-white/20 rounded-lg">{card.icon}</div>
                  <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="font-bold text-lg leading-tight mb-0.5">
                  {card.isCount ? card.value : <span className="text-base font-bold">{card.value}</span>}
                </div>
                {card.sub && <div className={`text-xs ${card.textColor} mt-0.5`}>{card.sub}</div>}
                <div className={`text-xs ${card.textColor} mt-2 font-medium`}>{card.label}</div>
              </button>
            ))}
          </div>

          {/* Breakdown panels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Par Branche */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-400 rounded-full" />
                Par Branche
              </h3>
              <div className="space-y-2.5">
                {Object.entries(statistics.byBranche).map(([branche, data]) => (
                  <button
                    key={branche}
                    onClick={() => openDetailModal(`Branche: ${branche}`, transactions.filter(t => t.branche === branche), 'bg-blue-600', `${data.count} transactions`)}
                    className="w-full flex justify-between items-center p-2.5 rounded-xl hover:bg-blue-50 transition-colors group"
                  >
                    <span className="font-medium text-gray-700 text-sm group-hover:text-blue-700">{branche}</span>
                    <div className="text-right">
                      <div className="text-sm font-bold text-blue-600">{formatCurrency(data.montant)}</div>
                      <div className="text-xs text-gray-400">{data.count} tx</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Par Mode de Paiement */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                Par Mode de Paiement
              </h3>
              <div className="space-y-2.5">
                {Object.entries(statistics.byModePaiement).map(([mode, data]) => (
                  <button
                    key={mode}
                    onClick={() => openDetailModal(`Mode: ${mode}`, transactions.filter(t => t.mode_paiement === mode), 'bg-emerald-600', `${data.count} transactions`)}
                    className="w-full flex justify-between items-center p-2.5 rounded-xl hover:bg-emerald-50 transition-colors group"
                  >
                    <span className="font-medium text-gray-700 text-sm group-hover:text-emerald-700">{mode}</span>
                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald-600">{formatCurrency(data.montant)}</div>
                      <div className="text-xs text-gray-400">{data.count} tx</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Par Type de Paiement */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-400 rounded-full" />
                Par Type de Paiement
              </h3>
              <div className="space-y-2.5">
                {Object.entries(statistics.byTypePaiement).map(([type, data]) => (
                  <button
                    key={type}
                    onClick={() => openDetailModal(`Paiement: ${type}`, transactions.filter(t => t.type_paiement === type), 'bg-orange-600', `${data.count} transactions`)}
                    className="w-full flex justify-between items-center p-2.5 rounded-xl hover:bg-orange-50 transition-colors group"
                  >
                    <span className="font-medium text-gray-700 text-sm group-hover:text-orange-700">{type}</span>
                    <div className="text-right">
                      <div className="text-sm font-bold text-orange-600">{formatCurrency(data.montant)}</div>
                      <div className="text-xs text-gray-400">{data.count} tx</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Par Type */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-violet-400 rounded-full" />
                Par Type
              </h3>
              <div className="space-y-2.5">
                {Object.entries(statistics.byType).map(([type, data]) => (
                  <button
                    key={type}
                    onClick={() => openDetailModal(`Type: ${type}`, transactions.filter(t => t.type === type), 'bg-violet-600', `${data.count} transactions`)}
                    className="w-full flex justify-between items-center p-2.5 rounded-xl hover:bg-violet-50 transition-colors group"
                  >
                    <span className={`inline-flex items-center gap-1.5 font-medium text-sm group-hover:text-violet-700`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${TYPE_COLORS[type]?.split(' ')[0] || 'bg-gray-400'}`} />
                      {type}
                    </span>
                    <div className="text-right">
                      <div className="text-sm font-bold text-violet-600">{formatCurrency(data.montant)}</div>
                      <div className="text-xs text-gray-400">{data.count} tx</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {Object.keys(statistics.byBanque).length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-cyan-400 rounded-full" />
                  Par Banque (Chèques)
                </h3>
                <div className="space-y-2.5">
                  {Object.entries(statistics.byBanque).map(([banque, data]) => (
                    <button
                      key={banque}
                      onClick={() => openDetailModal(`Banque: ${banque}`, transactions.filter(t => t.mode_paiement === 'Cheque' && t.type_paiement === banque), 'bg-cyan-600', `${data.count} chèques`)}
                      className="w-full flex justify-between items-center p-2.5 rounded-xl hover:bg-cyan-50 transition-colors group"
                    >
                      <span className="font-medium text-gray-700 text-sm group-hover:text-cyan-700">{banque}</span>
                      <div className="text-right">
                        <div className="text-sm font-bold text-cyan-600">{formatCurrency(data.montant)}</div>
                        <div className="text-xs text-gray-400">{data.count} chèques</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Full transactions table */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800">Toutes les transactions</h3>
              <p className="text-xs text-gray-500 mt-0.5">{transactions.length} résultat{transactions.length > 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={() => exportTransactions(transactions, 'rapport_complet')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Exporter
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['ID', 'Type', 'Branche', 'N° Contrat', 'Assuré', 'Prime', 'Montant', 'Mode', 'Type Paiement', 'Créé Par', 'Date', ''].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${['Prime', 'Montant'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.map(transaction => (
                  <tr key={transaction.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">{transaction.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${TYPE_COLORS[transaction.type] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                          {transaction.type}
                        </span>
                        {transaction.retour_type && (
                          <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${transaction.retour_type === 'Technique' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                            {transaction.retour_type === 'Technique' ? 'RT' : 'RCX'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{transaction.branche}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{transaction.numero_contrat}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">{transaction.assure}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatCurrency(transaction.prime)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatCurrency(transaction.montant)}</td>
                    <td className="px-4 py-3 text-gray-600">{transaction.mode_paiement}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${transaction.type_paiement === 'Crédit' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                        {transaction.type_paiement}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{transaction.cree_par}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(transaction.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => initiateDelete(transaction)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && transactions.length === 0 && (dateFrom || dateTo) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-base font-semibold text-gray-700 mb-1">Aucune transaction trouvée</h3>
          <p className="text-sm text-gray-400">Aucune transaction pour la période sélectionnée</p>
        </div>
      )}

      <DetailModal
        isOpen={detailModal.open}
        onClose={() => setDetailModal(s => ({ ...s, open: false }))}
        title={detailModal.title}
        subtitle={detailModal.subtitle}
        transactions={detailModal.transactions}
        onDelete={initiateDelete}
        onExport={exportTransactions}
        formatCurrency={formatCurrency}
        accentColor={detailModal.accentColor}
      />

      <DeleteMotifModal
        isOpen={deleteModalOpen}
        transactionType={pendingDeleteTransaction?.type || ''}
        transactionInfo={pendingDeleteTransaction ? getTransactionInfo(pendingDeleteTransaction) : ''}
        onConfirm={handleDeleteConfirmed}
        onCancel={handleDeleteCancelled}
      />
    </div>
  );
};

export default TransactionReport;
