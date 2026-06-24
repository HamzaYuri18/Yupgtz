import React, { useState, useEffect } from 'react';
import {
  BarChart3, Download, Calendar, DollarSign, FileText, Users,
  Trash2, Banknote, CreditCard, Landmark, Filter, TrendingUp,
  ChevronDown, RefreshCw, Search
} from 'lucide-react';
import { getContracts, exportToXLSX } from '../utils/storage';
import { Contract } from '../types';
import {
  getAffaireContracts, getRapportContracts, getTermeContracts,
  deleteRapportContract, deleteAffaireContract, deleteTermeContract,
  getFilteredDataForExport
} from '../utils/supabaseService';
import { getSessionDate, getSession } from '../utils/auth';
import DeleteMotifModal from './DeleteMotifModal';

type PendingDelete =
  | { kind: 'rapport'; id: number; numeroContrat: string; type: string; info: string }
  | { kind: 'affaire'; id: number; type: string; info: string }
  | { kind: 'terme'; id: number; type: string; info: string };

const paymentColors: Record<string, string> = {
  Espece: 'bg-emerald-100 text-emerald-700',
  Cheque: 'bg-blue-100 text-blue-700',
  'Carte Bancaire': 'bg-purple-100 text-purple-700',
  Banque: 'bg-sky-100 text-sky-700',
};

const branchColors: Record<string, string> = {
  Auto: 'bg-orange-100 text-orange-700',
  Vie: 'bg-pink-100 text-pink-700',
  'Santé': 'bg-red-100 text-red-700',
  IRDS: 'bg-teal-100 text-teal-700',
  Financier: 'bg-indigo-100 text-indigo-700',
};

const DistributionBar: React.FC<{ label: string; count: number; total: number; color: string }> = ({ label, count, total, color }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-gray-700 font-medium">{label || '—'}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{pct}%</span>
          <span className="text-sm font-bold text-gray-900 w-6 text-right">{count}</span>
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const ReportGenerator: React.FC = () => {
  const [rapportContracts, setRapportContracts] = useState<any[]>([]);
  const [sessionRapportContracts, setSessionRapportContracts] = useState<any[]>([]);
  const [localContracts, setLocalContracts] = useState<Contract[]>([]);
  const [affaireContracts, setAffaireContracts] = useState<any[]>([]);
  const [sessionAffaireContracts, setSessionAffaireContracts] = useState<any[]>([]);
  const [termeContracts, setTermeContracts] = useState<any[]>([]);
  const [sessionTermeContracts, setSessionTermeContracts] = useState<any[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    type: 'all', branch: 'all', paymentMode: 'all',
    dateFrom: '', dateTo: '', createdBy: 'all'
  });
  const [showSessionData, setShowSessionData] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  useEffect(() => {
    setLocalContracts(getContracts());
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadRapportContracts(), loadAffaireContracts(), loadTermeContracts()]);
    setLoading(false);
  };

  const loadRapportContracts = async () => {
    try {
      const rapportData = await getRapportContracts();
      setRapportContracts(rapportData);
      const sessionDate = getSessionDate();
      const sessionData = rapportData.filter(c =>
        new Date(c.created_at).toISOString().split('T')[0] === sessionDate
      );
      setSessionRapportContracts(sessionData);
      setFilteredContracts(showSessionData ? sessionData : rapportData);
    } catch (e) { console.error(e); }
  };

  const loadAffaireContracts = async () => {
    try {
      const affaires = await getAffaireContracts();
      setAffaireContracts(affaires);
      const sessionDate = getSessionDate();
      setSessionAffaireContracts(affaires.filter(c =>
        new Date(c.created_at).toISOString().split('T')[0] === sessionDate
      ));
    } catch (e) { console.error(e); }
  };

  const loadTermeContracts = async () => {
    try {
      const termes = await getTermeContracts();
      setTermeContracts(termes);
      const sessionDate = getSessionDate();
      setSessionTermeContracts(termes.filter(c =>
        new Date(c.created_at).toISOString().split('T')[0] === sessionDate
      ));
    } catch (e) { console.error(e); }
  };

  useEffect(() => { applyFilters(); }, [filters, rapportContracts, sessionRapportContracts, showSessionData]);

  const applyFilters = () => {
    const src = showSessionData ? sessionRapportContracts : rapportContracts;
    const filtered = src.filter(c => {
      const d = new Date(c.created_at);
      const from = filters.dateFrom ? new Date(filters.dateFrom) : new Date('1900-01-01');
      const to   = filters.dateTo   ? new Date(filters.dateTo)   : new Date('2100-12-31');
      return (
        (filters.type        === 'all' || c.type          === filters.type) &&
        (filters.branch      === 'all' || c.branche       === filters.branch) &&
        (filters.paymentMode === 'all' || c.mode_paiement === filters.paymentMode) &&
        (filters.createdBy   === 'all' || c.cree_par      === filters.createdBy) &&
        d >= from && d <= to
      );
    });
    setFilteredContracts(filtered);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const resetFilters = () =>
    setFilters({ type: 'all', branch: 'all', paymentMode: 'all', dateFrom: '', dateTo: '', createdBy: 'all' });

  const activeFilterCount = Object.entries(filters).filter(([, v]) => v !== 'all' && v !== '').length;

  const calculateStats = () => {
    const totalContracts = filteredContracts.length;
    const totalPremium   = filteredContracts.reduce((s, c) => s + (c.prime   || 0), 0);
    const totalMontant   = filteredContracts.reduce((s, c) => s + (c.montant || 0), 0);
    const avgPremium     = totalContracts > 0 ? totalPremium / totalContracts : 0;
    const totalEspeces   = filteredContracts.filter(c => c.mode_paiement === 'Espece').reduce((s, c) => s + (c.montant || 0), 0);
    const totalCheque    = filteredContracts.filter(c => c.mode_paiement === 'Cheque' && (c.montant || 0) > 0).reduce((s, c) => s + (c.montant || 0), 0);
    const totalBanque    = filteredContracts.filter(c => c.mode_paiement === 'Banque' || c.mode_paiement === 'Carte Bancaire').reduce((s, c) => s + (c.montant || 0), 0);
    const byType        = filteredContracts.reduce((a, c) => { a[c.type]          = (a[c.type]          || 0) + 1; return a; }, {} as Record<string, number>);
    const byBranch      = filteredContracts.reduce((a, c) => { a[c.branche]       = (a[c.branche]       || 0) + 1; return a; }, {} as Record<string, number>);
    const byPaymentMode = filteredContracts.reduce((a, c) => { a[c.mode_paiement] = (a[c.mode_paiement] || 0) + 1; return a; }, {} as Record<string, number>);
    return { totalContracts, totalPremium, totalMontant, avgPremium, totalEspeces, totalCheque, totalBanque, byType, byBranch, byPaymentMode };
  };

  const exportToExcel = async () => {
    if (!filters.type || filters.type === 'all') { alert("Veuillez sélectionner un type avant d'exporter"); return; }
    if (!filters.dateFrom) { alert('Veuillez sélectionner une date de début'); return; }
    if (!filters.dateTo)   { alert('Veuillez sélectionner une date de fin');   return; }
    try {
      const data = await getFilteredDataForExport(
        filters.type === 'Rapport' ? 'all' : filters.type,
        filters.dateFrom, filters.dateTo
      );
      if (!data.length) { alert('Aucune donnée à exporter'); return; }
      exportToXLSX(data.map(c => ({
        id: c.id.toString(), type: c.type, branch: c.branche,
        contractNumber: c.numero_contrat, premiumAmount: c.prime,
        insuredName: c.assure, paymentMode: c.mode_paiement,
        paymentType: c.type_paiement, creditAmount: c.montant_credit,
        paymentDate: c.date_paiement_prevue, createdBy: c.cree_par,
        createdAt: new Date(c.created_at).getTime()
      })), `rapport_${filters.type}_${filters.dateFrom}_${filters.dateTo}.xlsx`);
    } catch { alert("Erreur lors de l'export"); }
  };

  const initiateDeleteRapport = (id: number, num: string, type: string, assure: string) => {
    setPendingDelete({ kind: 'rapport', id, numeroContrat: num, type, info: `N° ${num}${assure ? ` - ${assure}` : ''}` });
    setDeleteModalOpen(true);
  };
  const initiateDeleteAffaire = (id: number, num: string, assure: string) => {
    setPendingDelete({ kind: 'affaire', id, type: 'Affaire', info: `N° ${num}${assure ? ` - ${assure}` : ''}` });
    setDeleteModalOpen(true);
  };
  const initiateDeleteTerme = (id: number, num: string, assure: string) => {
    setPendingDelete({ kind: 'terme', id, type: 'Terme', info: `N° ${num}${assure ? ` - ${assure}` : ''}` });
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirmed = async (motif: string) => {
    setDeleteModalOpen(false);
    if (!pendingDelete) return;
    const session = getSession();
    const suppressPar = session?.username || 'inconnu';
    const pd = pendingDelete;
    setPendingDelete(null);
    let ok = false;
    if      (pd.kind === 'rapport')  ok = await deleteRapportContract(pd.id, pd.numeroContrat, motif, suppressPar);
    else if (pd.kind === 'affaire') ok = await deleteAffaireContract(pd.id, motif, suppressPar);
    else if (pd.kind === 'terme')   ok = await deleteTermeContract(pd.id, motif, suppressPar);
    if (ok) { loadRapportContracts(); loadAffaireContracts(); loadTermeContracts(); }
    else alert('Erreur lors de la suppression du contrat');
  };

  const handleDeleteCancelled = () => { setDeleteModalOpen(false); setPendingDelete(null); };

  const stats = calculateStats();
  const uniqueUsers = [...new Set(rapportContracts.map(c => c.cree_par))];
  const sessionDate = getSessionDate();
  const fmt = (n: number) =>
    `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n)} DT`;
  const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('fr-FR') : '—';

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-gray-900 via-slate-800 to-blue-900 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center border border-white/20 shadow-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Rapports & Statistiques</h2>
              <p className="text-sm text-white/60 mt-0.5">
                {showSessionData
                  ? `Session du ${new Date(sessionDate + 'T00:00:00').toLocaleDateString('fr-FR')}`
                  : 'Toutes les données'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={loadAll}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl border border-white/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            <button
              onClick={() => setShowSessionData(!showSessionData)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border transition-colors ${
                showSessionData
                  ? 'bg-blue-500 hover:bg-blue-400 text-white border-blue-400'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
              }`}
            >
              <Calendar className="w-4 h-4" />
              {showSessionData ? 'Toutes les données' : 'Session actuelle'}
            </button>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold rounded-xl border border-emerald-400 transition-colors shadow-md"
            >
              <Download className="w-4 h-4" />
              Exporter XLSX
            </button>
          </div>
        </div>
      </div>

      {/* ── Filtres ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Filtres</span>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                {activeFilterCount} actif{activeFilterCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button onClick={resetFilters} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Réinitialiser tout
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Type</label>
            <div className="relative">
              <select name="type" value={filters.type} onChange={handleFilterChange}
                className="w-full pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 appearance-none">
                <option value="all">Tous les types</option>
                {['Terme','Affaire','Credit','Rapport','Dépense','Recette Exceptionnelle','Ristourne','Sinistre','Paiement Crédit'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Branche</label>
            <div className="relative">
              <select name="branch" value={filters.branch} onChange={handleFilterChange}
                className="w-full pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 appearance-none">
                <option value="all">Toutes</option>
                {['Auto','Vie','Santé','IRDS','Financier'].map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Mode paiement</label>
            <div className="relative">
              <select name="paymentMode" value={filters.paymentMode} onChange={handleFilterChange}
                className="w-full pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 appearance-none">
                <option value="all">Tous</option>
                <option value="Espece">Espèce</option>
                <option value="Cheque">Chèque</option>
                <option value="Carte Bancaire">Carte Bancaire</option>
                <option value="Banque">Banque</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Utilisateur</label>
            <div className="relative">
              <select name="createdBy" value={filters.createdBy} onChange={handleFilterChange}
                className="w-full pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 appearance-none">
                <option value="all">Tous</option>
                {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Du</label>
            <input type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFilterChange}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50" />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Au</label>
            <input type="date" name="dateTo" value={filters.dateTo} onChange={handleFilterChange}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50" />
          </div>
        </div>
      </div>

      {/* ── KPI Row 1 ───────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { icon: <FileText className="w-5 h-5" />, label: 'Total Contrats', value: stats.totalContracts.toString(), sub: showSessionData ? 'Session actuelle' : 'Toutes données', grad: 'from-blue-500 to-blue-600', tc: 'text-blue-600' },
          { icon: <DollarSign className="w-5 h-5" />, label: 'Prime Totale',  value: fmt(stats.totalPremium),  grad: 'from-emerald-500 to-emerald-600', tc: 'text-emerald-600' },
          { icon: <TrendingUp className="w-5 h-5" />, label: 'Total Montant', value: fmt(stats.totalMontant), sub: stats.totalMontant >= 0 ? 'Résultat positif' : 'Résultat négatif', grad: stats.totalMontant >= 0 ? 'from-teal-500 to-teal-600' : 'from-red-500 to-red-600', tc: stats.totalMontant >= 0 ? 'text-teal-600' : 'text-red-600' },
          { icon: <BarChart3 className="w-5 h-5" />, label: 'Prime Moyenne',  value: fmt(stats.avgPremium),   grad: 'from-violet-500 to-violet-600', tc: 'text-violet-600' },
          { icon: <Users className="w-5 h-5" />,    label: 'Utilisateurs',   value: uniqueUsers.length.toString(), grad: 'from-orange-500 to-orange-600', tc: 'text-orange-600' },
        ].map(({ icon, label, value, sub, grad, tc }) => (
          <div key={label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 bg-gradient-to-br ${grad} rounded-xl flex items-center justify-center text-white shadow flex-shrink-0`}>
              {icon}
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-semibold uppercase tracking-wide ${tc} mb-0.5`}>{label}</p>
              <p className="text-base font-bold text-gray-900 truncate">{value}</p>
              {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* ── KPI Row 2: payment breakdown ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: <Banknote className="w-6 h-6 text-emerald-600" />, label: 'Total Espèces', value: fmt(stats.totalEspeces), bg: 'bg-emerald-50', border: 'border-emerald-200', tc: 'text-emerald-700' },
          { icon: <CreditCard className="w-6 h-6 text-blue-600" />,  label: 'Total Chèque',  value: fmt(stats.totalCheque),  bg: 'bg-blue-50',    border: 'border-blue-200',    tc: 'text-blue-700' },
          { icon: <Landmark className="w-6 h-6 text-sky-600" />,     label: 'Total Banque',   value: fmt(stats.totalBanque),  bg: 'bg-sky-50',     border: 'border-sky-200',     tc: 'text-sky-700' },
        ].map(({ icon, label, value, bg, border, tc }) => (
          <div key={label} className={`${bg} border ${border} rounded-2xl p-5 flex items-center gap-4`}>
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">{icon}</div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${tc}`}>{label}</p>
              <p className={`text-xl font-bold ${tc} mt-0.5`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Distribution Charts ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { title: 'Par Type',     data: stats.byType,         color: 'bg-blue-500' },
          { title: 'Par Branche',  data: stats.byBranch,       color: 'bg-emerald-500' },
          { title: 'Par Paiement', data: stats.byPaymentMode,  color: 'bg-violet-500' },
        ].map(({ title, data, color }) => (
          <div key={title} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">{title}</h3>
            {Object.keys(data).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Aucune donnée</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(data).sort(([, a], [, b]) => b - a).map(([k, count]) => (
                  <DistributionBar key={k} label={k} count={count} total={stats.totalContracts} color={color} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Contrats Terme session ───────────────────────── */}
      {showSessionData && sessionTermeContracts.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-blue-50/40">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-800">Contrats Terme — Session actuelle</h3>
            </div>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
              {sessionTermeContracts.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Numéro','Branche','Assuré','Prime (DT)','Échéance','Date Paiement',''].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sessionTermeContracts.map(c => (
                  <tr key={c.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{c.numero_contrat}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${branchColors[c.branche] || 'bg-gray-100 text-gray-600'}`}>{c.branche}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{c.assure}</td>
                    <td className="px-5 py-3 font-semibold text-emerald-700">{fmt(c.prime)}</td>
                    <td className="px-5 py-3 text-gray-500">{fmtDate(c.echeance)}</td>
                    <td className="px-5 py-3 text-gray-500">{fmtDate(c.date_paiement)}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => initiateDeleteTerme(c.id, c.numero_contrat, c.Assure || c.assure || '')}
                        className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Contrats Affaire ─────────────────────────────── */}
      {(showSessionData ? sessionAffaireContracts : affaireContracts).length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-emerald-50/40">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-800">
                Contrats Affaire — {showSessionData ? 'Session actuelle' : 'Toutes données'}
              </h3>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
              {(showSessionData ? sessionAffaireContracts : affaireContracts).length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Numéro','Branche','Assuré','Prime (DT)','Paiement','Créé par','Date',''].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(showSessionData ? sessionAffaireContracts : affaireContracts).map(c => (
                  <tr key={c.id} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{c.numero_contrat}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${branchColors[c.branche] || 'bg-gray-100 text-gray-600'}`}>{c.branche}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{c.assure}</td>
                    <td className="px-5 py-3 font-semibold text-emerald-700">{fmt(c.prime)}</td>
                    <td className="px-5 py-3">
                      <div className="text-gray-700">{c.mode_paiement}</div>
                      <div className="text-xs text-gray-400">{c.type_paiement}</div>
                      {c.montant_credit ? <div className="text-xs text-orange-600 font-medium">Crédit: {fmt(c.montant_credit)}</div> : null}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{c.cree_par}</td>
                    <td className="px-5 py-3 text-gray-500">{fmtDate(c.created_at)}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => initiateDeleteAffaire(c.id, c.numero_contrat, c.Assure || c.assure || '')}
                        className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Table Rapport ────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
              <Search className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">
                Table Rapport — {showSessionData ? 'Session actuelle' : 'Toutes données'}
              </h3>
              <p className="text-xs text-gray-400">{filteredContracts.length} contrat{filteredContracts.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['N° Contrat','Type','Branche','Assuré','Prime','Montant','Mode Paiement','Type Paiement','Montant Crédit','Date Prévu','Échéance','Créé par','Date',''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <FileText className="w-10 h-10 opacity-30" />
                      <p className="text-sm font-medium">Aucun contrat trouvé</p>
                      <p className="text-xs">Modifiez les filtres pour afficher des résultats</p>
                    </div>
                  </td>
                </tr>
              ) : filteredContracts.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{c.numero_contrat}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      c.type === 'Terme' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>{c.type}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${branchColors[c.branche] || 'bg-gray-100 text-gray-600'}`}>
                      {c.branche}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{c.assure}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-700 whitespace-nowrap">{fmt(c.prime || 0)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`font-semibold ${(c.montant || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fmt(c.montant || 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${paymentColors[c.mode_paiement] || 'bg-gray-100 text-gray-600'}`}>
                      {c.mode_paiement}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      c.type_paiement === 'Au comptant' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>{c.type_paiement}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.montant_credit
                      ? <span className="font-semibold text-orange-600">{fmt(c.montant_credit)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {c.date_paiement_prevue ? fmtDate(c.date_paiement_prevue) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.echeance
                      ? <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">{fmtDate(c.echeance)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.cree_par}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(c.created_at)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => initiateDeleteRapport(c.id, c.numero_contrat, c.type, c.assure || '')}
                      className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DeleteMotifModal
        isOpen={deleteModalOpen}
        transactionType={pendingDelete?.type || ''}
        transactionInfo={pendingDelete?.info || ''}
        onConfirm={handleDeleteConfirmed}
        onCancel={handleDeleteCancelled}
      />
    </div>
  );
};

export default ReportGenerator;
