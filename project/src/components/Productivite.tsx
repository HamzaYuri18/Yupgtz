import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Award, Target, ChevronDown, ChevronUp,
  Download, Filter, X, Star, Zap, BarChart2, CheckCircle, Clock, Edit2, Save
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getSession } from '../utils/auth';
import * as XLSX from 'xlsx';

interface Realisation {
  id: number;
  numero_contrat: string;
  type_contrat: string;
  branche: string;
  assure: string;
  prime_ttc: number;
  prime_nette: number;
  prime_brute: number;
  utilisateur: string;
  date_realisation: string;
  created_at: string;
}

interface UserStats {
  utilisateur: string;
  total_contrats: number;
  prime_ttc_total: number;
  prime_brute_total: number;
  by_type: Record<string, { count: number; prime_ttc: number; prime_brute: number }>;
  bonus_total: number;
  bonus_detail: Record<string, { bonus: number; actif: boolean }>;
}

// Pas de seuil minimum — le bonus s'applique dès le 1er DT de prime brute
const BONUS_RULES: Record<string, { taux: number; label: string; color: string }> = {
  'Habitation':             { taux: 0.05,  label: 'Assurance Habitation',          color: 'blue'   },
  'Transport Marchandise':  { taux: 0.05,  label: 'Transport Marchandise Terrestre', color: 'orange' },
  'Santé Internationale':   { taux: 0.015, label: 'Santé Internationale',           color: 'green'  },
  'Santé Nationale':        { taux: 0.015, label: 'Santé Nationale',                color: 'teal'   },
};

const TYPE_COLORS: Record<string, string> = {
  'Habitation':            'bg-blue-100 text-blue-800 border-blue-200',
  'Transport Marchandise': 'bg-orange-100 text-orange-800 border-orange-200',
  'Santé Internationale':  'bg-green-100 text-green-800 border-green-200',
  'Santé Nationale':       'bg-teal-100 text-teal-800 border-teal-200',
};

const CHALLENGE_MONTHS = ['2026-06', '2026-07', '2026-08'];

interface LiquidationRow {
  mois: string;
  statut: 'En attente' | 'Liquidé';
  date_liquidation: string | null;
  updated_by: string | null;
}

const formatDT = (n: number) =>
  n.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' DT';

function computeStats(data: Realisation[]): UserStats[] {
  const users = ['Ahlem', 'Rouae'];
  return users.map(u => {
    const rows = data.filter(r => r.utilisateur.toLowerCase() === u.toLowerCase());
    const by_type: Record<string, { count: number; prime_ttc: number; prime_brute: number }> = {};
    let prime_ttc_total = 0;
    let prime_brute_total = 0;

    for (const r of rows) {
      const t = r.type_contrat;
      if (!by_type[t]) by_type[t] = { count: 0, prime_ttc: 0, prime_brute: 0 };
      by_type[t].count++;
      by_type[t].prime_ttc += r.prime_ttc;
      by_type[t].prime_brute += r.prime_brute ?? (r.prime_nette - 3) / 1.12;
      prime_ttc_total += r.prime_ttc;
      prime_brute_total += r.prime_brute ?? (r.prime_nette - 3) / 1.12;
    }

    const bonus_detail: Record<string, { bonus: number; actif: boolean }> = {};
    let bonus_total = 0;

    for (const [type, rule] of Object.entries(BONUS_RULES)) {
      const pb = by_type[type]?.prime_brute ?? 0;
      const actif = pb > 0;
      const bonus = pb * rule.taux;
      bonus_detail[type] = { bonus, actif };
      bonus_total += bonus;
    }

    return { utilisateur: u, total_contrats: rows.length, prime_ttc_total, prime_brute_total, by_type, bonus_total, bonus_detail };
  });
}

// ── Bonus par mois pour un utilisateur ───────────────────────────────────────
function computeMonthlyBonus(data: Realisation[], utilisateur: string, mois: string) {
  const rows = data.filter(r =>
    r.utilisateur.toLowerCase() === utilisateur.toLowerCase() &&
    r.date_realisation.slice(0, 7) === mois
  );
  let total = 0;
  for (const r of rows) {
    const rule = BONUS_RULES[r.type_contrat];
    if (rule) {
      const pb = r.prime_brute ?? (r.prime_nette - 3) / 1.12;
      total += pb * rule.taux;
    }
  }
  return total;
}

// ── Modal Détail ─────────────────────────────────────────────────────────────
interface DetailModalProps {
  utilisateur: string;
  data: Realisation[];
  allStats: UserStats[];
  onClose: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ utilisateur, data, allStats, onClose }) => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const filtered = data.filter(r => {
    if (r.utilisateur.toLowerCase() !== utilisateur.toLowerCase()) return false;
    if (dateFrom && r.date_realisation < dateFrom) return false;
    if (dateTo && r.date_realisation > dateTo) return false;
    if (typeFilter && r.type_contrat !== typeFilter) return false;
    return true;
  });

  const types = Array.from(new Set(data.filter(r => r.utilisateur.toLowerCase() === utilisateur.toLowerCase()).map(r => r.type_contrat)));
  const myStats = allStats.find(s => s.utilisateur.toLowerCase() === utilisateur.toLowerCase());
  const otherStats = allStats.find(s => s.utilisateur.toLowerCase() !== utilisateur.toLowerCase());
  const isTrailing = (myStats && otherStats) ? myStats.prime_ttc_total < otherStats.prime_ttc_total : false;
  const ecart = (myStats && otherStats) ? Math.abs(myStats.prime_ttc_total - otherStats.prime_ttc_total) : 0;
  const totalPrimeTTC = filtered.reduce((s, r) => s + r.prime_ttc, 0);

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(filtered.map(r => ({
      'N° Contrat': r.numero_contrat, 'Type': r.type_contrat, 'Assuré': r.assure,
      'Prime TTC (DT)': r.prime_ttc, 'Prime Nette (DT)': r.prime_nette,
      'Prime Brute (DT)': Number(((r.prime_nette - 3) / 1.12).toFixed(3)), 'Date': r.date_realisation,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Réalisations');
    XLSX.writeFile(wb, `realisations_${utilisateur}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] max-h-[97vh] flex flex-col">
        <div className={`relative overflow-hidden rounded-t-2xl px-6 py-5 ${isTrailing ? 'bg-gradient-to-r from-slate-700 via-slate-600 to-emerald-700' : 'bg-gradient-to-r from-slate-700 to-slate-600'}`}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15)_0%,transparent_60%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white text-2xl font-extrabold shadow-inner flex-shrink-0">
                {utilisateur[0]}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-2xl font-extrabold text-white tracking-tight">{utilisateur}</h2>
                  {isTrailing && otherStats && (
                    <span className="flex items-center gap-1 bg-white/15 border border-white/20 rounded-full px-2.5 py-0.5 text-white/90 text-xs font-semibold">
                      <Target className="w-3.5 h-3.5" /> {formatDT(ecart)} derrière {otherStats.utilisateur}
                    </span>
                  )}
                </div>
                <p className="text-white/70 text-sm mt-0.5">
                  {filtered.length} contrat{filtered.length > 1 ? 's' : ''} · Total TTC : <span className="font-bold text-white">{formatDT(totalPrimeTTC)}</span>
                </p>
              </div>
            </div>
            {myStats && (
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="bg-white/15 border border-white/20 rounded-xl px-4 py-2.5 text-center backdrop-blur-sm">
                  <div className="text-2xl font-extrabold text-white">{myStats.total_contrats}</div>
                  <div className="text-white/65 text-xs uppercase tracking-wide font-medium">Contrats</div>
                </div>
                <div className="bg-white/15 border border-white/20 rounded-xl px-4 py-2.5 text-center backdrop-blur-sm">
                  <div className="text-base font-extrabold text-white leading-tight">{formatDT(myStats.prime_ttc_total)}</div>
                  <div className="text-white/65 text-xs uppercase tracking-wide font-medium">Prime TTC</div>
                </div>
                {myStats.bonus_total > 0 && (
                  <div className="bg-white/15 border border-white/20 rounded-xl px-4 py-2.5 text-center backdrop-blur-sm">
                    <div className="text-base font-extrabold text-white leading-tight">{formatDT(myStats.bonus_total)}</div>
                    <div className="text-white/65 text-xs uppercase tracking-wide font-medium">Bonus</div>
                  </div>
                )}
                <button onClick={exportXlsx} className="flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 border border-white/30 text-white rounded-xl text-sm font-medium transition-colors backdrop-blur-sm">
                  <Download className="w-4 h-4" /> XLSX
                </button>
                <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl text-white/70 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
          {myStats && Object.keys(myStats.by_type).length > 0 && (
            <div className="relative flex flex-wrap gap-2 mt-4">
              {Object.entries(myStats.by_type).map(([type, stat]) => (
                <div key={type} className="flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1 backdrop-blur-sm">
                  <span className="text-white font-bold text-xs">{stat.count}×</span>
                  <span className="text-white/85 text-xs">{type}</span>
                  <span className="text-white/40 text-xs">·</span>
                  <span className="text-white/85 text-xs font-medium">{formatDT(stat.prime_ttc)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filtres</span>
          </div>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-300">
            <option value="">Tous les types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {(dateFrom || dateTo || typeFilter) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setTypeFilter(''); }} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
              <X className="w-3 h-3" /> Réinitialiser
            </button>
          )}
          <div className="ml-auto text-xs text-gray-400 self-center">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</div>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {['N° Contrat','Type','Assuré','Prime TTC','Prime Brute','Date'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-gray-500 font-semibold text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">Aucun résultat</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-gray-800 text-xs">{r.numero_contrat}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${TYPE_COLORS[r.type_contrat] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>{r.type_contrat}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 text-sm">{r.assure}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{formatDT(r.prime_ttc)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500 text-xs">{formatDT(Number(((r.prime_nette - 3) / 1.12).toFixed(3)))}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(r.date_realisation).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex items-center justify-between">
          <span className="text-xs text-gray-400">{filtered.length} contrat{filtered.length > 1 ? 's' : ''} · Depuis le 18/06/2026</span>
          <span className="text-sm font-bold text-gray-900">Total TTC : <span className="text-emerald-700">{formatDT(totalPrimeTTC)}</span></span>
        </div>
      </div>
    </div>
  );
};

// ── Composant principal ───────────────────────────────────────────────────────
const Productivite: React.FC = () => {
  const [data, setData] = useState<Realisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalUser, setModalUser] = useState<string | null>(null);
  const [expandedBonus, setExpandedBonus] = useState<Record<string, boolean>>({});
  const [liquidations, setLiquidations] = useState<LiquidationRow[]>([]);
  const [editingMois, setEditingMois] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [savingLiq, setSavingLiq] = useState(false);

  const currentUser = getSession()?.username || '';
  const isHamza = currentUser.toLowerCase() === 'hamza';

  const load = useCallback(async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('suivie_realisations').select('*')
      .gte('date_realisation', '2026-06-18')
      .order('date_realisation', { ascending: false });
    if (!error && rows) setData(rows as Realisation[]);
    setLoading(false);
  }, []);

  const loadLiquidations = useCallback(async () => {
    const { data: rows } = await supabase
      .from('bonus_liquidation')
      .select('mois, statut, date_liquidation, updated_by');
    if (rows) setLiquidations(rows as LiquidationRow[]);
  }, []);

  const saveLiquidation = async (mois: string, statut: 'Liquidé' | 'En attente', date: string | null) => {
    setSavingLiq(true);
    await supabase.from('bonus_liquidation').upsert(
      [{ mois, statut, date_liquidation: date || null, updated_by: currentUser }],
      { onConflict: 'mois' }
    );
    await loadLiquidations();
    setEditingMois(null);
    setSavingLiq(false);
  };

  useEffect(() => {
    load();
    loadLiquidations();
    const channel = supabase
      .channel('suivie_realisations_productivite')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suivie_realisations' }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, loadLiquidations]);

  const stats = computeStats(data);
  const [ahlem, rouae] = stats;
  const leader = ahlem.prime_ttc_total > rouae.prime_ttc_total ? ahlem.utilisateur : rouae.prime_ttc_total > ahlem.prime_ttc_total ? rouae.utilisateur : null;
  const totalContrats = ahlem.total_contrats + rouae.total_contrats;
  const totalPrimeTTC = ahlem.prime_ttc_total + rouae.prime_ttc_total;
  const barWidth = (val: number, max: number) => max === 0 ? 0 : Math.round((val / max) * 100);
  const maxPrime = Math.max(ahlem.prime_ttc_total, rouae.prime_ttc_total);
  const maxContrats = Math.max(ahlem.total_contrats, rouae.total_contrats);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-emerald-800 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Productivité</h1>
              <p className="text-white/70 text-sm">Suivi des réalisations — depuis le 18/06/2026</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{totalContrats}</div>
              <div className="text-white/60 text-xs uppercase tracking-wide">Contrats total</div>
            </div>
            <div className="w-px h-12 bg-white/20" />
            <div className="text-center">
              <div className="text-3xl font-bold">{formatDT(totalPrimeTTC)}</div>
              <div className="text-white/60 text-xs uppercase tracking-wide">Prime TTC totale</div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {!leader && totalContrats > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 flex items-center gap-3">
              <Star className="w-5 h-5 text-blue-500" />
              <span className="text-blue-700 font-medium">Égalité parfaite !</span>
            </div>
          )}

          {/* Cartes comparaison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.map(s => (
              <div key={s.utilisateur} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow">
                      {s.utilisateur[0]}
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg">{s.utilisateur}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">{s.total_contrats}</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide">contrats</div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Nb. contrats</span>
                    <span className="font-semibold text-emerald-700 cursor-pointer hover:underline" onClick={() => setModalUser(s.utilisateur)}>{s.total_contrats} →</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-700" style={{ width: `${barWidth(s.total_contrats, Math.max(maxContrats, 1))}%` }} />
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Prime TTC</span>
                    <span className="font-semibold text-blue-700 cursor-pointer hover:underline" onClick={() => setModalUser(s.utilisateur)}>{formatDT(s.prime_ttc_total)} →</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-700" style={{ width: `${barWidth(s.prime_ttc_total, Math.max(maxPrime, 1))}%` }} />
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  {Object.entries(s.by_type).map(([type, stat]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${TYPE_COLORS[type] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>{type}</span>
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span className="font-semibold">{stat.count} contrat{stat.count > 1 ? 's' : ''}</span>
                        <span className="text-gray-400">|</span>
                        <span>{formatDT(stat.prime_ttc)}</span>
                      </div>
                    </div>
                  ))}
                  {Object.keys(s.by_type).length === 0 && <p className="text-xs text-gray-400 italic">Aucune réalisation enregistrée</p>}
                </div>

                {/* Section bonus */}
                <div className="border-t border-gray-100 pt-4">
                  <button
                    onClick={() => setExpandedBonus(prev => ({ ...prev, [s.utilisateur]: !prev[s.utilisateur] }))}
                    className="flex items-center justify-between w-full text-sm font-semibold text-gray-700 hover:text-gray-900"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      <span>Bonus estimé</span>
                      <span className={`ml-1 text-base font-bold ${s.bonus_total > 0 ? 'text-green-600' : 'text-gray-400'}`}>{formatDT(s.bonus_total)}</span>
                    </div>
                    {expandedBonus[s.utilisateur] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {expandedBonus[s.utilisateur] && (
                    <div className="mt-3 space-y-2">
                      {Object.entries(BONUS_RULES).map(([type, rule]) => {
                        const detail = s.bonus_detail[type];
                        const pb = s.by_type[type]?.prime_brute ?? 0;
                        return (
                          <div key={type} className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-700">{type}</span>
                              {detail.actif ? (
                                <span className="flex items-center gap-1 text-xs text-green-600 font-bold">
                                  <Award className="w-3 h-3" /> +{formatDT(detail.bonus)}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">Aucune réalisation</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>Prime brute : {formatDT(pb)}</span>
                              <span className="text-gray-300">|</span>
                              <span>Taux : {(rule.taux * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Récapitulatif bonus */}
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-yellow-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-yellow-600" />
              <h3 className="font-bold text-gray-800 text-lg">Récapitulatif des Bonus</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-yellow-200">
                    <th className="text-left py-2 pr-4 text-gray-500 font-semibold text-xs uppercase">Catégorie</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase text-center py-2 px-2">Taux</th>
                    {stats.map(s => (
                      <th key={s.utilisateur} className="text-center py-2 px-3 text-xs font-semibold text-gray-600 uppercase">{s.utilisateur}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-yellow-100">
                  {Object.entries(BONUS_RULES).map(([type, rule]) => (
                    <tr key={type} className="hover:bg-yellow-50/50">
                      <td className="py-2.5 pr-4 font-medium text-gray-800">{type}</td>
                      <td className="py-2.5 px-2 text-center text-gray-600">{(rule.taux * 100).toFixed(1)}%</td>
                      {stats.map(s => {
                        const d = s.bonus_detail[type];
                        return (
                          <td key={s.utilisateur} className="py-2.5 px-3 text-center">
                            {d.actif ? (
                              <span className="inline-flex items-center gap-1 text-green-700 font-bold">
                                <Award className="w-3 h-3" /> {formatDT(d.bonus)}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-yellow-300 bg-yellow-50">
                    <td className="py-3 pr-4 font-bold text-gray-900" colSpan={2}>Total Bonus</td>
                    {stats.map(s => (
                      <td key={s.utilisateur} className="py-3 px-3 text-center">
                        <span className={`text-base font-bold ${s.bonus_total > 0 ? 'text-green-700' : 'text-gray-400'}`}>{formatDT(s.bonus_total)}</span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Liquidation par mois — gérée par Hamza */}
            <div className="mt-5">
              <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Liquidation des bonus par mois
                {isHamza && <span className="text-xs font-normal text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Vous pouvez modifier</span>}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {CHALLENGE_MONTHS.map(mois => {
                  const row = liquidations.find(l => l.mois === mois);
                  const statut = row?.statut ?? 'En attente';
                  const dateLiq = row?.date_liquidation ?? null;
                  const isLiquidé = statut === 'Liquidé';
                  const label = new Date(mois + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                  const isEditing = editingMois === mois;

                  return (
                    <div key={mois} className={`rounded-xl border p-4 transition-colors ${isLiquidé ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-700 capitalize">{label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${isLiquidé ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {isLiquidé ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {statut}
                          </span>
                          {isHamza && !isEditing && (
                            <button
                              onClick={() => { setEditingMois(mois); setEditDate(dateLiq ?? ''); }}
                              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors"
                              title="Modifier"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Affichage de la date */}
                      {!isEditing && (
                        <p className="text-xs text-gray-500 mb-2">
                          {isLiquidé
                            ? <>Liquidé le <span className="font-semibold text-emerald-700">{dateLiq ? new Date(dateLiq).toLocaleDateString('fr-FR') : '—'}</span></>
                            : <span className="text-amber-600">Date non encore fixée</span>
                          }
                        </p>
                      )}

                      {/* Formulaire Hamza */}
                      {isEditing && (
                        <div className="mb-3 space-y-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveLiquidation(mois, 'Liquidé', editDate)}
                              disabled={savingLiq || !editDate}
                              className="flex-1 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              Marquer Liquidé
                            </button>
                            <button
                              onClick={() => saveLiquidation(mois, 'En attente', null)}
                              disabled={savingLiq}
                              className="flex-1 py-1.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 disabled:opacity-50 transition-colors"
                            >
                              En attente
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={editDate}
                              onChange={e => setEditDate(e.target.value)}
                              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                            />
                            <button onClick={() => setEditingMois(null)} className="text-gray-400 hover:text-gray-600">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Bonus par utilisateur */}
                      <div className="space-y-1">
                        {stats.map(s => {
                          const mb = computeMonthlyBonus(data, s.utilisateur, mois);
                          return (
                            <div key={s.utilisateur} className="flex items-center justify-between text-xs">
                              <span className="text-gray-600">{s.utilisateur}</span>
                              <span className={`font-bold ${mb > 0 ? (isLiquidé ? 'text-emerald-700' : 'text-amber-700') : 'text-gray-400'}`}>
                                {mb > 0 ? formatDT(mb) : '—'}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {row?.updated_by && (
                        <p className="text-[10px] text-gray-400 mt-2">Mis à jour par {row.updated_by}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 p-3 bg-white/70 rounded-xl border border-yellow-100">
              <div className="flex items-start gap-2">
                <BarChart2 className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-gray-600 space-y-1.5">
                  <p><span className="font-semibold">Habitation :</span> Bonus de <span className="font-bold text-amber-700">5%</span> sur la prime brute. Contrats <span className="font-semibold text-blue-700">renouvelables uniquement</span>.</p>
                  <p><span className="font-semibold">Transport :</span> Bonus de <span className="font-bold text-amber-700">5%</span> sur la prime brute. Contrats <span className="font-semibold text-orange-700">Ferme ou Renouvelable</span>.</p>
                  <p><span className="font-semibold">Santé (nationale &amp; internationale) :</span> Bonus de <span className="font-bold text-amber-700">1,5%</span> sur la prime brute.</p>
                  <p className="text-gray-400 italic">Prime brute = (Prime nette − 3) ÷ 1,12</p>
                  <div className="flex flex-wrap gap-4 pt-1 border-t border-yellow-100 mt-1">
                    <p className="text-amber-700 font-semibold">Liquidation des bonus : fin de chaque mois.</p>
                    <p className="text-red-600 font-semibold">Fin du challenge : 31/08/2026.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {totalContrats === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucune réalisation enregistrée depuis le 18/06/2026</p>
              <p className="text-sm mt-1">Les contrats Affaire (606, 604, CI0805, CI0210) enregistrés par Ahlem et Rouae apparaîtront ici.</p>
            </div>
          )}
        </>
      )}

      {modalUser && (
        <DetailModal utilisateur={modalUser} data={data} allStats={stats} onClose={() => setModalUser(null)} />
      )}
    </div>
  );
};

export default Productivite;
