import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Check, X, Filter, Calendar, TrendingUp, CreditCard, CheckCircle, Clock, ChevronDown, Plus, Undo2, FileDown, Percent } from 'lucide-react';
import jsPDF from 'jspdf';
import { getSession } from '../utils/auth';

interface Cheque {
  id: number;
  Numero_Contrat: string;
  Assure: string;
  Numero_Cheque: string;
  Titulaire_Cheque: string;
  Montant: string;
  Date_Encaissement_prévue: string;
  Banque: string;
  Statut: string;
  created_at: string;
  date_encaissement?: string;
}

interface DetailChequePartiel {
  id: number;
  cheque_id: number;
  montant: number;
  date_encaissement: string;
}

const currentMonth = new Date().toISOString().slice(0, 7);

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'TND' }).format(n);
}
function fmtDate(d: string) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('fr-FR');
}
// Date locale (pas UTC) pour éviter le décalage d'un jour autour de minuit en Tunisie (UTC+1)
function getLocalDateStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const emptyAddForm = {
  numeroContrat: '',
  assure: '',
  numeroCheque: '',
  montant: '',
  banque: '',
  dateEncaissementPrevue: '',
};

export default function ChequesManagement() {
  const isHamza = getSession()?.username === 'Hamza';

  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCheque, setSelectedCheque] = useState<Cheque | null>(null);
  const [encaissementDate, setEncaissementDate] = useState('');
  const [encaissementMontant, setEncaissementMontant] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Encaissements partiels ──────────────────────────────────────────────
  const [detailsByCheque, setDetailsByCheque] = useState<Record<number, DetailChequePartiel[]>>({});

  // ── Ajout manuel d'un chèque (Hamza uniquement) ─────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // ── Filtres ──────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState('all');
  const [encaissFrom, setEncaissFrom] = useState('');
  const [encaissTo, setEncaissTo] = useState('');
  const [emissionFrom, setEmissionFrom] = useState('');
  const [emissionTo, setEmissionTo] = useState('');

  // ── Stats mois ───────────────────────────────────────────────────────────
  const [statsMois, setStatsMois] = useState(currentMonth);

  useEffect(() => { loadCheques(); loadPartialDetails(); }, []);

  const loadCheques = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('Cheques').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setCheques(data || []);
    } catch { alert('Erreur chargement chèques'); }
    finally { setLoading(false); }
  };

  const loadPartialDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('details_cheques_encaisses_partiellement')
        .select('*')
        .order('date_encaissement', { ascending: true });
      if (error) throw error;
      const grouped: Record<number, DetailChequePartiel[]> = {};
      (data || []).forEach((d: DetailChequePartiel) => {
        if (!grouped[d.cheque_id]) grouped[d.cheque_id] = [];
        grouped[d.cheque_id].push(d);
      });
      setDetailsByCheque(grouped);
    } catch (err) {
      console.error('Erreur chargement détails encaissements partiels:', err);
    }
  };

  const getCumulativePartial = (chequeId: number) =>
    (detailsByCheque[chequeId] || []).reduce((s, d) => s + Number(d.montant), 0);

  const getReste = (c: Cheque) => parseFloat(c.Montant || '0') - getCumulativePartial(c.id);

  const openChequeModal = (c: Cheque) => {
    setSelectedCheque(c);
    setEncaissementDate(getLocalDateStr());
    const reste = getReste(c);
    setEncaissementMontant(reste > 0 ? reste.toFixed(3) : '');
    setShowModal(true);
  };

  // ── Filtrage ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return cheques.filter(c => {
      if (statusFilter !== 'all' && c.Statut !== statusFilter) return false;
      if (encaissFrom && c.Date_Encaissement_prévue < encaissFrom) return false;
      if (encaissTo   && c.Date_Encaissement_prévue > encaissTo)   return false;
      const emDate = c.created_at.slice(0, 10);
      if (emissionFrom && emDate < emissionFrom) return false;
      if (emissionTo   && emDate > emissionTo)   return false;
      return true;
    });
  }, [cheques, statusFilter, encaissFrom, encaissTo, emissionFrom, emissionTo]);

  const activeFilters = [statusFilter !== 'all', encaissFrom, encaissTo, emissionFrom, emissionTo].filter(Boolean).length;

  const resetFilters = () => {
    setStatusFilter('all');
    setEncaissFrom(''); setEncaissTo('');
    setEmissionFrom(''); setEmissionTo('');
  };

  // ── Stats du mois sélectionné ────────────────────────────────────────────
  const stats = useMemo(() => {
    const inMonth = cheques.filter(c => c.created_at.slice(0, 7) === statsMois);
    const total = inMonth.length;
    const encaisses = inMonth.filter(c => c.Statut === 'Encaissé').length;
    const partiels = inMonth.filter(c => c.Statut === 'Encaissé partiellement').length;
    const nonEncaisses = total - encaisses - partiels;
    const montantTotal = inMonth.reduce((s, c) => s + parseFloat(c.Montant || '0'), 0);
    const montantEncaisse = inMonth.filter(c => c.Statut === 'Encaissé')
      .reduce((s, c) => s + parseFloat(c.Montant || '0'), 0);
    const montantPartielRecu = inMonth.filter(c => c.Statut === 'Encaissé partiellement')
      .reduce((s, c) => s + (detailsByCheque[c.id] || []).reduce((s2, d) => s2 + Number(d.montant), 0), 0);
    const pctEncaisse = total > 0 ? Math.round((encaisses / total) * 100) : 0;
    const pctPartiel = total > 0 ? Math.round((partiels / total) * 100) : 0;
    const pctNon = 100 - pctEncaisse - pctPartiel;
    return { total, encaisses, partiels, nonEncaisses, montantTotal, montantEncaisse, montantPartielRecu, pctEncaisse, pctPartiel, pctNon };
  }, [cheques, statsMois, detailsByCheque]);

  const availableMonths = useMemo(() => {
    const s = new Set(cheques.map(c => c.created_at.slice(0, 7)));
    return Array.from(s).sort().reverse();
  }, [cheques]);

  // ── Encaisser (total ou partiel) ────────────────────────────────────────
  const handleEncaisser = async () => {
    if (!selectedCheque || !encaissementDate || !encaissementMontant) return;
    const montantSaisi = parseFloat(encaissementMontant);
    if (isNaN(montantSaisi) || montantSaisi <= 0) {
      alert('Veuillez saisir un montant valide.');
      return;
    }
    const reste = getReste(selectedCheque);
    if (montantSaisi > reste + 0.001) {
      alert(`Le montant saisi (${fmt(montantSaisi)}) dépasse le reste à encaisser (${fmt(reste)}).`);
      return;
    }

    setSaving(true);
    try {
      const { error: insError } = await supabase.from('details_cheques_encaisses_partiellement')
        .insert([{ cheque_id: selectedCheque.id, montant: montantSaisi, date_encaissement: encaissementDate }]);
      if (insError) throw insError;

      const complet = montantSaisi >= reste - 0.001;
      const { error } = await supabase.from('Cheques')
        .update(complet
          ? { Statut: 'Encaissé', date_encaissement: encaissementDate }
          : { Statut: 'Encaissé partiellement' })
        .eq('id', selectedCheque.id);
      if (error) throw error;

      setShowModal(false);
      setSelectedCheque(null);
      setEncaissementDate('');
      setEncaissementMontant('');
      await Promise.all([loadCheques(), loadPartialDetails()]);
    } catch { alert('Erreur lors de l\'encaissement'); }
    finally { setSaving(false); }
  };

  // ── Annuler l'encaissement, total ou partiel (Hamza uniquement) ────────
  const handleAnnulerEncaissement = async () => {
    if (!isHamza || !selectedCheque) return;
    if (!confirm('Êtes-vous sûr de vouloir annuler l\'encaissement de ce chèque ? L\'historique des encaissements partiels sera supprimé.')) return;
    setSaving(true);
    try {
      const { error: delError } = await supabase.from('details_cheques_encaisses_partiellement')
        .delete()
        .eq('cheque_id', selectedCheque.id);
      if (delError) throw delError;

      const { error } = await supabase.from('Cheques')
        .update({ Statut: 'Non Encaissé', date_encaissement: null })
        .eq('id', selectedCheque.id);
      if (error) throw error;
      setShowModal(false);
      setSelectedCheque(null);
      await Promise.all([loadCheques(), loadPartialDetails()]);
    } catch { alert('Erreur lors de l\'annulation de l\'encaissement'); }
    finally { setSaving(false); }
  };

  // ── Chèques encaissés aujourd'hui (remise à zéro automatiquement le jour suivant) ──
  const todayStr = getLocalDateStr();
  const chequesEncaissesAujourdhui = cheques.filter(c => (c.date_encaissement || '').slice(0, 10) === todayStr);
  const montantEncaisseAujourdhui = chequesEncaissesAujourdhui.reduce((s, c) => s + parseFloat(c.Montant || '0'), 0);

  const truncate = (s: string, max: number) => (s && s.length > max ? s.slice(0, max - 1) + '…' : (s || ''));

  const handleDownloadBordereauEncaissement = () => {
    if (chequesEncaissesAujourdhui.length === 0) {
      alert('Aucun chèque encaissé aujourd\'hui.');
      return;
    }

    try {
    const pdf = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.width;
    const leftMargin = 15;
    const rightMargin = 15;
    const contentWidth = pageWidth - leftMargin - rightMargin;
    let y = 20;

    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('AGENCE SHIRI FARES HAMZA', pageWidth / 2, y, { align: 'center' });
    y += 7;
    pdf.setFontSize(13);
    pdf.text('STAR ASSURANCE', pageWidth / 2, y, { align: 'center' });
    y += 12;

    pdf.setFontSize(14);
    pdf.text('BORDEREAU DE REMISE DE CHEQUES A L\'ENCAISSEMENT', pageWidth / 2, y, { align: 'center', maxWidth: contentWidth });
    y += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Date de remise : ${new Date().toLocaleDateString('fr-FR')}`, leftMargin, y);
    y += 10;

    const cols = [
      { label: 'N° Chèque', width: 26 },
      { label: 'N° Contrat', width: 30 },
      { label: 'Assuré', width: 45 },
      { label: 'Banque', width: 35 },
      { label: 'Montant (DT)', width: contentWidth - (26 + 30 + 45 + 35) },
    ];

    const drawRow = (values: string[], yPos: number, bold = false) => {
      let x = leftMargin;
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      cols.forEach((col, i) => {
        pdf.text(values[i], x + 2, yPos);
        x += col.width;
      });
    };

    pdf.setFillColor(230, 230, 230);
    pdf.rect(leftMargin, y - 5, contentWidth, 8, 'F');
    drawRow(cols.map(c => c.label), y, true);
    y += 6;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(leftMargin, y, leftMargin + contentWidth, y);
    y += 6;

    let total = 0;
    chequesEncaissesAujourdhui.forEach(c => {
      const montant = parseFloat(c.Montant || '0');
      total += montant;
      drawRow([
        truncate(c.Numero_Cheque, 14),
        truncate(c.Numero_Contrat, 16),
        truncate(c.Assure, 24),
        truncate(c.Banque, 18),
        montant.toLocaleString('fr-FR', { minimumFractionDigits: 3 }),
      ], y);
      y += 7;
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
    });

    y += 2;
    pdf.line(leftMargin, y, leftMargin + contentWidth, y);
    y += 9;
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Nombre de chèques : ${chequesEncaissesAujourdhui.length}`, leftMargin, y);
    y += 7;
    pdf.text(`Montant total : ${total.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT`, leftMargin, y);

    pdf.save(`bordereau_remise_cheques_${todayStr}.pdf`);
    } catch (err) {
      console.error('Erreur génération bordereau:', err);
      alert('Erreur lors de la génération du bordereau PDF.');
    }
  };

  // ── Ajouter un chèque manquant (Hamza uniquement) ───────────────────────
  const openAddModal = () => {
    setAddForm(emptyAddForm);
    setAddError(null);
    setShowAddModal(true);
  };

  const handleAddCheque = async () => {
    if (!addForm.numeroContrat || !addForm.assure || !addForm.numeroCheque || !addForm.montant || !addForm.banque || !addForm.dateEncaissementPrevue) {
      setAddError('Veuillez remplir tous les champs.');
      return;
    }
    setAddSaving(true);
    setAddError(null);
    try {
      const { error } = await supabase.from('Cheques').insert([{
        Numero_Contrat: addForm.numeroContrat.trim().toUpperCase(),
        Assure: addForm.assure.trim(),
        Numero_Cheque: addForm.numeroCheque.trim(),
        Titulaire_Cheque: addForm.assure.trim(),
        Montant: parseFloat(addForm.montant),
        Date_Encaissement_prévue: addForm.dateEncaissementPrevue,
        Banque: addForm.banque.trim(),
        Statut: 'Non Encaissé',
      }]);
      if (error) throw error;
      setShowAddModal(false);
      setAddForm(emptyAddForm);
      await loadCheques();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement du chèque.');
    } finally {
      setAddSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Chargement des chèques…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── En-tête ── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 px-6 py-6 shadow-xl">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Gestion des Chèques</h1>
                <p className="text-slate-400 text-sm">Suivi et encaissement des chèques reçus</p>
              </div>
            </div>
            {isHamza && (
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium px-4 py-2.5 rounded-xl transition-all text-sm shrink-0"
              >
                <Plus className="w-4 h-4" />
                Ajouter un chèque
              </button>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-lg text-white text-sm">
              <CreditCard className="w-3.5 h-3.5 text-slate-300" />
              <span className="text-slate-300">Total :</span>
              <span className="font-bold">{cheques.length}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 rounded-lg text-emerald-300 text-sm">
              <CheckCircle className="w-3.5 h-3.5" />
              Encaissés : <span className="font-bold ml-1">{cheques.filter(c => c.Statut === 'Encaissé').length}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 rounded-lg text-orange-300 text-sm">
              <Percent className="w-3.5 h-3.5" />
              Partiels : <span className="font-bold ml-1">{cheques.filter(c => c.Statut === 'Encaissé partiellement').length}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 rounded-lg text-red-300 text-sm">
              <Clock className="w-3.5 h-3.5" />
              En attente : <span className="font-bold ml-1">{cheques.filter(c => c.Statut === 'Non Encaissé').length}</span>
            </span>
            <button
              onClick={handleDownloadBordereauEncaissement}
              title={chequesEncaissesAujourdhui.length === 0 ? 'Aucun chèque encaissé aujourd\'hui' : 'Télécharger le bordereau de remise'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-amber-300 text-sm transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              Encaissés aujourd'hui : <span className="font-bold ml-1">{chequesEncaissesAujourdhui.length}</span>
              <span className="text-amber-200/80">({fmt(montantEncaisseAujourdhui)})</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* ── Stats du mois ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Statistiques mensuelles</h2>
            </div>
            <div className="relative">
              <select
                value={statsMois}
                onChange={e => setStatsMois(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              >
                {availableMonths.length === 0 && (
                  <option value={currentMonth}>
                    {new Date(currentMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </option>
                )}
                {availableMonths.map(m => (
                  <option key={m} value={m}>
                    {new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="p-5">
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5">
              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">Total chèques</p>
                <p className="text-3xl font-bold text-indigo-700">{stats.total}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide mb-1">Encaissés</p>
                <p className="text-3xl font-bold text-emerald-700">{stats.encaisses}</p>
                <p className="text-xs text-emerald-600 mt-1">{stats.pctEncaisse}% du total</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-1">Partiels</p>
                <p className="text-3xl font-bold text-orange-700">{stats.partiels}</p>
                <p className="text-xs text-orange-600 mt-1">{stats.pctPartiel}% du total</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">En attente</p>
                <p className="text-3xl font-bold text-red-700">{stats.nonEncaisses}</p>
                <p className="text-xs text-red-600 mt-1">{stats.pctNon}% du total</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Montant total</p>
                <p className="text-xl font-bold text-slate-700">{fmt(stats.montantTotal)}</p>
                <p className="text-xs text-slate-500 mt-1">Encaissé : {fmt(stats.montantEncaisse)}</p>
                {stats.montantPartielRecu > 0 && (
                  <p className="text-xs text-orange-600 mt-0.5">Reçu (partiels) : {fmt(stats.montantPartielRecu)}</p>
                )}
              </div>
            </div>

            {/* Barre de progression */}
            {stats.total > 0 && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1.5 flex-wrap gap-1">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Encaissés {stats.pctEncaisse}%</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Partiels {stats.pctPartiel}%</span>
                  <span className="flex items-center gap-1">En attente {stats.pctNon}%<span className="w-2 h-2 rounded-full bg-red-400 inline-block" /></span>
                </div>
                <div className="h-3 rounded-full bg-gray-100 overflow-hidden flex">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${stats.pctEncaisse}%` }}
                  />
                  <div
                    className="h-full bg-gradient-to-r from-orange-400 to-orange-300 transition-all duration-500"
                    style={{ width: `${stats.pctPartiel}%` }}
                  />
                  <div
                    className="h-full bg-gradient-to-r from-red-400 to-red-300 transition-all duration-500"
                    style={{ width: `${stats.pctNon}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Filtres ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Filtres</h2>
              {activeFilters > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                  {activeFilters} actif{activeFilters > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {activeFilters > 0 && (
              <button onClick={resetFilters} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                Réinitialiser
              </button>
            )}
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Statut */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Statut</label>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="Non Encaissé">Non Encaissé</option>
                  <option value="Encaissé partiellement">Encaissé partiellement</option>
                  <option value="Encaissé">Encaissé</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Range date d'encaissement prévue */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                <Calendar className="w-3 h-3 inline mr-1" />Date d'encaissement prévue
              </label>
              <div className="flex gap-2">
                <input type="date" value={encaissFrom} onChange={e => setEncaissFrom(e.target.value)}
                  className="w-full px-2.5 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Du" />
                <input type="date" value={encaissTo} onChange={e => setEncaissTo(e.target.value)}
                  className="w-full px-2.5 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Au" />
              </div>
            </div>

            {/* Range date d'émission */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                <Calendar className="w-3 h-3 inline mr-1" />Date d'émission
              </label>
              <div className="flex gap-2">
                <input type="date" value={emissionFrom} onChange={e => setEmissionFrom(e.target.value)}
                  className="w-full px-2.5 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                <input type="date" value={emissionTo} onChange={e => setEmissionTo(e.target.value)}
                  className="w-full px-2.5 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
            </div>
          </div>

          <div className="px-5 pb-4">
            <p className="text-xs text-gray-500">
              <span className="font-semibold text-gray-700">{filtered.length}</span> chèque{filtered.length !== 1 ? 's' : ''} affiché{filtered.length !== 1 ? 's' : ''}
              {activeFilters > 0 && <span className="text-gray-400"> (sur {cheques.length} au total)</span>}
            </p>
          </div>
        </div>

        {/* ── Tableau ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900">
                  {['N° Contrat','Assuré','N° Chèque','Banque','Montant','Date Enc. Prévue','Date Émission','Statut','Date Encaissement','Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-400">Aucun chèque trouvé</td></tr>
                ) : filtered.map((c, idx) => {
                  const encaisse = c.Statut === 'Encaissé';
                  const partiel = c.Statut === 'Encaissé partiellement';
                  const partialTitle = partiel
                    ? 'Encaissements partiels :\n' + (detailsByCheque[c.id] || [])
                        .map(d => `${fmtDate(d.date_encaissement)} : ${fmt(Number(d.montant))}`)
                        .join('\n') + `\nReste à encaisser : ${fmt(getReste(c))}`
                    : undefined;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => openChequeModal(c)}
                      className={`border-l-4 cursor-pointer transition-all duration-150 ${
                        encaisse
                          ? `border-l-emerald-500 ${idx % 2 === 0 ? 'bg-emerald-50/40' : 'bg-white'} hover:bg-emerald-100/50`
                          : partiel
                          ? `border-l-orange-400 ${idx % 2 === 0 ? 'bg-orange-50/40' : 'bg-white'} hover:bg-orange-100/50`
                          : `border-l-red-400 ${idx % 2 === 0 ? 'bg-white' : 'bg-red-50/20'} hover:bg-red-50/60`
                      }`}
                    >
                      <td className="px-4 py-3 font-mono font-medium text-gray-800">{c.Numero_Contrat}</td>
                      <td className="px-4 py-3 text-gray-800">{c.Assure}</td>
                      <td className="px-4 py-3 font-mono text-gray-700">{c.Numero_Cheque}</td>
                      <td className="px-4 py-3 text-gray-700">{c.Banque}</td>
                      <td className="px-4 py-3 font-bold text-gray-900">{fmt(parseFloat(c.Montant || '0'))}</td>
                      <td className="px-4 py-3 text-gray-700">{fmtDate(c.Date_Encaissement_prévue)}</td>
                      <td className="px-4 py-3 text-gray-700">{fmtDate(c.created_at)}</td>
                      <td className="px-4 py-3">
                        <span
                          title={partialTitle}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            encaisse
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : partiel
                              ? 'bg-orange-100 text-orange-700 border border-orange-200'
                              : 'bg-red-100 text-red-700 border border-red-200'
                          }`}
                        >
                          {encaisse ? <CheckCircle className="w-3 h-3" /> : partiel ? <Percent className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {c.Statut}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.date_encaissement
                          ? <span className="text-emerald-700 font-medium">{fmtDate(c.date_encaissement)}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {!encaisse && (
                          <button
                            onClick={e => { e.stopPropagation(); openChequeModal(c); }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg text-xs font-semibold hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />Encaisser
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="lg:hidden divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <p className="p-8 text-center text-gray-400">Aucun chèque trouvé</p>
            ) : filtered.map(c => {
              const encaisse = c.Statut === 'Encaissé';
              const partiel = c.Statut === 'Encaissé partiellement';
              const partialTitle = partiel
                ? 'Encaissements partiels :\n' + (detailsByCheque[c.id] || [])
                    .map(d => `${fmtDate(d.date_encaissement)} : ${fmt(Number(d.montant))}`)
                    .join('\n') + `\nReste à encaisser : ${fmt(getReste(c))}`
                : undefined;
              return (
                <div
                  key={c.id}
                  onClick={() => openChequeModal(c)}
                  className={`p-4 border-l-4 cursor-pointer transition-colors ${
                    encaisse ? 'border-l-emerald-500 bg-emerald-50/30' : partiel ? 'border-l-orange-400 bg-orange-50/30' : 'border-l-red-400 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">N° Contrat</p>
                      <p className="font-mono font-semibold text-gray-900">{c.Numero_Contrat}</p>
                    </div>
                    <span
                      title={partialTitle}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                        encaisse ? 'bg-emerald-100 text-emerald-700' : partiel ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {encaisse ? <CheckCircle className="w-3 h-3" /> : partiel ? <Percent className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {c.Statut}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                    <span className="text-gray-500">Assuré</span><span className="font-medium text-gray-800">{c.Assure}</span>
                    <span className="text-gray-500">Montant</span><span className="font-bold text-gray-900">{fmt(parseFloat(c.Montant || '0'))}</span>
                    <span className="text-gray-500">Banque</span><span className="text-gray-700">{c.Banque}</span>
                    <span className="text-gray-500">Date enc. prévue</span><span className="text-gray-700">{fmtDate(c.Date_Encaissement_prévue)}</span>
                    <span className="text-gray-500">Date émission</span><span className="text-gray-700">{fmtDate(c.created_at)}</span>
                    {partiel && <>
                      <span className="text-gray-500">Reste à encaisser</span>
                      <span className="text-orange-700 font-medium">{fmt(getReste(c))}</span>
                    </>}
                    {c.date_encaissement && <>
                      <span className="text-gray-500">Encaissé le</span>
                      <span className="text-emerald-700 font-medium">{fmtDate(c.date_encaissement)}</span>
                    </>}
                  </div>
                  {!encaisse && (
                    <button
                      onClick={e => { e.stopPropagation(); openChequeModal(c); }}
                      className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-semibold"
                    >
                      <Check className="w-4 h-4" />Encaisser
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && selectedCheque && (() => {
        const encaisse = selectedCheque.Statut === 'Encaissé';
        const partiel = selectedCheque.Statut === 'Encaissé partiellement';
        const dejaEncaisse = getCumulativePartial(selectedCheque.id);
        const reste = getReste(selectedCheque);
        const historique = detailsByCheque[selectedCheque.id] || [];
        const closeModal = () => { setShowModal(false); setSelectedCheque(null); setEncaissementDate(''); setEncaissementMontant(''); };

        return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header modal */}
            <div className={`px-6 py-4 ${encaisse ? 'bg-gradient-to-r from-emerald-600 to-emerald-700' : partiel ? 'bg-gradient-to-r from-orange-500 to-orange-600' : 'bg-gradient-to-r from-indigo-600 to-indigo-700'}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">
                  {selectedCheque.Statut === 'Non Encaissé' ? 'Encaisser le chèque' : partiel ? 'Poursuivre l\'encaissement' : 'Détails du chèque'}
                </h3>
                <button onClick={closeModal}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Infos */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['N° Contrat', selectedCheque.Numero_Contrat],
                  ['Assuré', selectedCheque.Assure],
                  ['N° Chèque', selectedCheque.Numero_Cheque],
                  ['Banque', selectedCheque.Banque],
                  ['Titulaire', selectedCheque.Titulaire_Cheque],
                  ['Date émission', fmtDate(selectedCheque.created_at)],
                  ['Date enc. prévue', fmtDate(selectedCheque.Date_Encaissement_prévue)],
                ].map(([label, val]) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                    <p className="text-sm font-medium text-gray-900">{val}</p>
                  </div>
                ))}
                <div className="bg-indigo-50 rounded-xl p-3">
                  <p className="text-xs text-indigo-400 mb-0.5">Montant du chèque</p>
                  <p className="text-sm font-bold text-indigo-900">{fmt(parseFloat(selectedCheque.Montant || '0'))}</p>
                </div>
                {(partiel || encaisse) && dejaEncaisse > 0 && (
                  <div className="bg-emerald-50 rounded-xl p-3">
                    <p className="text-xs text-emerald-500 mb-0.5">Déjà encaissé</p>
                    <p className="text-sm font-bold text-emerald-900">{fmt(dejaEncaisse)}</p>
                  </div>
                )}
                {partiel && (
                  <div className="bg-orange-50 rounded-xl p-3">
                    <p className="text-xs text-orange-500 mb-0.5">Reste à encaisser</p>
                    <p className="text-sm font-bold text-orange-900">{fmt(reste)}</p>
                  </div>
                )}
              </div>

              {historique.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Historique des encaissements</p>
                  <div className="space-y-1">
                    {historique.map(d => (
                      <div key={d.id} className="flex justify-between text-sm">
                        <span className="text-gray-600">{fmtDate(d.date_encaissement)}</span>
                        <span className="font-medium text-gray-900">{fmt(Number(d.montant))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {encaisse && selectedCheque.date_encaissement && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-emerald-600">Date d'encaissement (soldé)</p>
                    <p className="font-semibold text-emerald-800">{fmtDate(selectedCheque.date_encaissement)}</p>
                  </div>
                </div>
              )}

              {!encaisse && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Montant à encaisser *</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      max={reste}
                      value={encaissementMontant}
                      onChange={e => setEncaissementMontant(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-400 mt-1">Reste à encaisser : {fmt(reste)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date d'encaissement *</label>
                    <input
                      type="date"
                      value={encaissementDate}
                      onChange={e => setEncaissementDate(e.target.value)}
                      max={getLocalDateStr()}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                {!encaisse && (
                  <button
                    onClick={handleEncaisser}
                    disabled={!encaissementDate || !encaissementMontant || saving}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50 transition-all shadow-sm"
                  >
                    {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                    Confirmer l'encaissement
                  </button>
                )}
                {isHamza && (partiel || encaisse) && (
                  <button
                    onClick={handleAnnulerEncaissement}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold rounded-xl hover:from-red-700 hover:to-red-800 disabled:opacity-50 transition-all shadow-sm"
                  >
                    {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Undo2 className="w-4 h-4" />}
                    Annuler l'encaissement
                  </button>
                )}
                <button
                  onClick={closeModal}
                  className="px-5 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  {selectedCheque.Statut === 'Non Encaissé' ? 'Annuler' : 'Fermer'}
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ── Modal : ajouter un chèque manquant (Hamza uniquement) ── */}
      {showAddModal && isHamza && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Ajouter un chèque</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">N° Contrat *</label>
                <input
                  type="text"
                  value={addForm.numeroContrat}
                  onChange={e => setAddForm({ ...addForm, numeroContrat: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Assuré *</label>
                <input
                  type="text"
                  value={addForm.assure}
                  onChange={e => setAddForm({ ...addForm, assure: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">N° Chèque *</label>
                  <input
                    type="text"
                    value={addForm.numeroCheque}
                    onChange={e => setAddForm({ ...addForm, numeroCheque: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Montant (DT) *</label>
                  <input
                    type="number"
                    step="0.001"
                    value={addForm.montant}
                    onChange={e => setAddForm({ ...addForm, montant: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Banque *</label>
                <input
                  type="text"
                  value={addForm.banque}
                  onChange={e => setAddForm({ ...addForm, banque: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date d'encaissement prévue *</label>
                <input
                  type="date"
                  value={addForm.dateEncaissementPrevue}
                  onChange={e => setAddForm({ ...addForm, dateEncaissementPrevue: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {addError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                  {addError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleAddCheque}
                  disabled={addSaving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all shadow-sm"
                >
                  {addSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                  Enregistrer
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  disabled={addSaving}
                  className="px-5 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
