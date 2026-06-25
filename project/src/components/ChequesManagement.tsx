import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Check, X, Filter, Calendar, TrendingUp, CreditCard, CheckCircle, Clock, ChevronDown } from 'lucide-react';

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

const currentMonth = new Date().toISOString().slice(0, 7);

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'TND' }).format(n);
}
function fmtDate(d: string) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('fr-FR');
}

export default function ChequesManagement() {
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCheque, setSelectedCheque] = useState<Cheque | null>(null);
  const [encaissementDate, setEncaissementDate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Filtres ──────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState('all');
  const [encaissFrom, setEncaissFrom] = useState('');
  const [encaissTo, setEncaissTo] = useState('');
  const [emissionFrom, setEmissionFrom] = useState('');
  const [emissionTo, setEmissionTo] = useState('');

  // ── Stats mois ───────────────────────────────────────────────────────────
  const [statsMois, setStatsMois] = useState(currentMonth);

  useEffect(() => { loadCheques(); }, []);

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
    const nonEncaisses = total - encaisses;
    const montantTotal = inMonth.reduce((s, c) => s + parseFloat(c.Montant || '0'), 0);
    const montantEncaisse = inMonth.filter(c => c.Statut === 'Encaissé')
      .reduce((s, c) => s + parseFloat(c.Montant || '0'), 0);
    const pctEncaisse = total > 0 ? Math.round((encaisses / total) * 100) : 0;
    const pctNon = 100 - pctEncaisse;
    return { total, encaisses, nonEncaisses, montantTotal, montantEncaisse, pctEncaisse, pctNon };
  }, [cheques, statsMois]);

  const availableMonths = useMemo(() => {
    const s = new Set(cheques.map(c => c.created_at.slice(0, 7)));
    return Array.from(s).sort().reverse();
  }, [cheques]);

  // ── Encaisser ────────────────────────────────────────────────────────────
  const handleEncaisser = async () => {
    if (!selectedCheque || !encaissementDate) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('Cheques')
        .update({ Statut: 'Encaissé', date_encaissement: encaissementDate })
        .eq('id', selectedCheque.id);
      if (error) throw error;
      setShowModal(false);
      setSelectedCheque(null);
      setEncaissementDate('');
      await loadCheques();
    } catch { alert('Erreur lors de l\'encaissement'); }
    finally { setSaving(false); }
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
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Gestion des Chèques</h1>
              <p className="text-slate-400 text-sm">Suivi et encaissement des chèques reçus</p>
            </div>
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
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 rounded-lg text-red-300 text-sm">
              <Clock className="w-3.5 h-3.5" />
              En attente : <span className="font-bold ml-1">{cheques.filter(c => c.Statut !== 'Encaissé').length}</span>
            </span>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">Total chèques</p>
                <p className="text-3xl font-bold text-indigo-700">{stats.total}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide mb-1">Encaissés</p>
                <p className="text-3xl font-bold text-emerald-700">{stats.encaisses}</p>
                <p className="text-xs text-emerald-600 mt-1">{stats.pctEncaisse}% du total</p>
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
              </div>
            </div>

            {/* Barre de progression */}
            {stats.total > 0 && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Encaissés {stats.pctEncaisse}%</span>
                  <span className="flex items-center gap-1">En attente {stats.pctNon}%<span className="w-2 h-2 rounded-full bg-red-400 inline-block" /></span>
                </div>
                <div className="h-3 rounded-full bg-gray-100 overflow-hidden flex">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${stats.pctEncaisse}%` }}
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
                  return (
                    <tr
                      key={c.id}
                      onClick={() => { setSelectedCheque(c); setEncaissementDate(new Date().toISOString().split('T')[0]); setShowModal(true); }}
                      className={`border-l-4 cursor-pointer transition-all duration-150 ${
                        encaisse
                          ? `border-l-emerald-500 ${idx % 2 === 0 ? 'bg-emerald-50/40' : 'bg-white'} hover:bg-emerald-100/50`
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
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          encaisse ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-red-100 text-red-700 border border-red-200'
                        }`}>
                          {encaisse ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
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
                            onClick={e => { e.stopPropagation(); setSelectedCheque(c); setEncaissementDate(new Date().toISOString().split('T')[0]); setShowModal(true); }}
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
              return (
                <div
                  key={c.id}
                  onClick={() => { setSelectedCheque(c); setEncaissementDate(new Date().toISOString().split('T')[0]); setShowModal(true); }}
                  className={`p-4 border-l-4 cursor-pointer transition-colors ${encaisse ? 'border-l-emerald-500 bg-emerald-50/30' : 'border-l-red-400 bg-white'}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">N° Contrat</p>
                      <p className="font-mono font-semibold text-gray-900">{c.Numero_Contrat}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                      encaisse ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {encaisse ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {c.Statut}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                    <span className="text-gray-500">Assuré</span><span className="font-medium text-gray-800">{c.Assure}</span>
                    <span className="text-gray-500">Montant</span><span className="font-bold text-gray-900">{fmt(parseFloat(c.Montant || '0'))}</span>
                    <span className="text-gray-500">Banque</span><span className="text-gray-700">{c.Banque}</span>
                    <span className="text-gray-500">Date enc. prévue</span><span className="text-gray-700">{fmtDate(c.Date_Encaissement_prévue)}</span>
                    <span className="text-gray-500">Date émission</span><span className="text-gray-700">{fmtDate(c.created_at)}</span>
                    {c.date_encaissement && <>
                      <span className="text-gray-500">Encaissé le</span>
                      <span className="text-emerald-700 font-medium">{fmtDate(c.date_encaissement)}</span>
                    </>}
                  </div>
                  {!encaisse && (
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedCheque(c); setEncaissementDate(new Date().toISOString().split('T')[0]); setShowModal(true); }}
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
      {showModal && selectedCheque && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header modal */}
            <div className={`px-6 py-4 ${selectedCheque.Statut === 'Encaissé' ? 'bg-gradient-to-r from-emerald-600 to-emerald-700' : 'bg-gradient-to-r from-indigo-600 to-indigo-700'}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">
                  {selectedCheque.Statut === 'Non Encaissé' ? 'Encaisser le chèque' : 'Détails du chèque'}
                </h3>
                <button onClick={() => { setShowModal(false); setSelectedCheque(null); setEncaissementDate(''); }}
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
                  <p className="text-xs text-indigo-400 mb-0.5">Montant</p>
                  <p className="text-sm font-bold text-indigo-900">{fmt(parseFloat(selectedCheque.Montant || '0'))}</p>
                </div>
              </div>

              {selectedCheque.Statut === 'Encaissé' && selectedCheque.date_encaissement && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-emerald-600">Date d'encaissement</p>
                    <p className="font-semibold text-emerald-800">{fmtDate(selectedCheque.date_encaissement)}</p>
                  </div>
                </div>
              )}

              {selectedCheque.Statut === 'Non Encaissé' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date d'encaissement *</label>
                  <input
                    type="date"
                    value={encaissementDate}
                    onChange={e => setEncaissementDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-1">
                {selectedCheque.Statut === 'Non Encaissé' ? (
                  <>
                    <button
                      onClick={handleEncaisser}
                      disabled={!encaissementDate || saving}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50 transition-all shadow-sm"
                    >
                      {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                      Confirmer l'encaissement
                    </button>
                    <button
                      onClick={() => { setShowModal(false); setSelectedCheque(null); setEncaissementDate(''); }}
                      className="px-5 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      Annuler
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setShowModal(false); setSelectedCheque(null); }}
                    className="w-full py-3 bg-gradient-to-r from-slate-700 to-slate-800 text-white font-semibold rounded-xl hover:from-slate-800 hover:to-slate-900 transition-all"
                  >
                    Fermer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
