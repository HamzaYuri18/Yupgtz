import React, { useState, useEffect, useCallback } from 'react';
import {
  X, TrendingUp, Award, Zap, ChevronDown, ChevronUp,
  Trophy, Target, CheckCircle2, Medal
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getSessionDate } from '../utils/auth';

interface Realisation {
  id: number;
  numero_contrat: string;
  type_contrat: string;
  prime_ttc: number;
  prime_nette: number;
  utilisateur: string;
  date_realisation: string;
}

interface Stats {
  count: number;
  prime_ttc: number;
  prime_brute: number;
  by_type: Record<string, { count: number; prime_ttc: number; prime_brute: number }>;
  bonus_total: number;
  bonus_detail: Record<string, { bonus: number; atteint: boolean; reste: number }>;
}

const BONUS_RULES: Record<string, { taux: number; seuil: number }> = {
  'Habitation':            { taux: 0.05,  seuil: 1000 },
  'Transport Marchandise': { taux: 0.05,  seuil: 1000 },
  'Santé Internationale':  { taux: 0.015, seuil: 2000 },
  'Santé Nationale':       { taux: 0.015, seuil: 2000 },
};

const TYPE_BADGE: Record<string, string> = {
  'Habitation':            'bg-blue-100/80 text-blue-700',
  'Transport Marchandise': 'bg-orange-100/80 text-orange-700',
  'Santé Internationale':  'bg-green-100/80 text-green-700',
  'Santé Nationale':       'bg-teal-100/80 text-teal-700',
};

const fmt = (n: number) =>
  n.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' DT';

function buildStats(rows: Realisation[]): Stats {
  const by_type: Record<string, { count: number; prime_ttc: number; prime_brute: number }> = {};
  let prime_ttc = 0;
  let prime_brute = 0;

  for (const r of rows) {
    const pb = (r.prime_nette - 3) / 1.12;
    prime_ttc += r.prime_ttc;
    prime_brute += pb;
    if (!by_type[r.type_contrat]) by_type[r.type_contrat] = { count: 0, prime_ttc: 0, prime_brute: 0 };
    by_type[r.type_contrat].count++;
    by_type[r.type_contrat].prime_ttc += r.prime_ttc;
    by_type[r.type_contrat].prime_brute += pb;
  }

  const bonus_detail: Record<string, { bonus: number; atteint: boolean; reste: number }> = {};
  let bonus_total = 0;
  for (const [type, rule] of Object.entries(BONUS_RULES)) {
    const pb = by_type[type]?.prime_brute ?? 0;
    const atteint = pb >= rule.seuil;
    const bonus = atteint ? pb * rule.taux : 0;
    bonus_detail[type] = { bonus, atteint, reste: Math.max(0, rule.seuil - pb) };
    bonus_total += bonus;
  }

  return { count: rows.length, prime_ttc, prime_brute, by_type, bonus_total, bonus_detail };
}

interface UserBlock {
  name: string;
  session: Stats;
  cumul: Stats;
  isLeader: boolean;
}

interface ProductiviteNotificationProps {
  username: string;
  onNavigateToProductivite?: () => void;
}

const ProductiviteNotification: React.FC<ProductiviteNotificationProps> = ({ username, onNavigateToProductivite }) => {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [data, setData] = useState<UserBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const isHamza = username.toLowerCase() === 'hamza';
  const isTracked = ['ahlem', 'rouae'].includes(username.toLowerCase());

  const load = useCallback(async () => {
    const sessionDate = getSessionDate();

    const { data: rows, error } = await supabase
      .from('suivie_realisations')
      .select('id, numero_contrat, type_contrat, prime_ttc, prime_nette, utilisateur, date_realisation')
      .gte('date_realisation', '2026-06-18');

    if (error || !rows) { setLoading(false); return; }

    const users = isTracked ? [username] : ['Ahlem', 'Rouae'];

    const blocks: UserBlock[] = users.map(u => {
      const cumRows = (rows as Realisation[]).filter(r => r.utilisateur.toLowerCase() === u.toLowerCase());
      const sesRows = cumRows.filter(r => r.date_realisation === sessionDate);
      return {
        name: u,
        session: buildStats(sesRows),
        cumul: buildStats(cumRows),
        isLeader: false,
      };
    });

    if (blocks.length === 2) {
      const [a, b] = blocks;
      if (a.cumul.prime_ttc > b.cumul.prime_ttc) a.isLeader = true;
      else if (b.cumul.prime_ttc > a.cumul.prime_ttc) b.isLeader = true;
    }

    setData(blocks);
    setLoading(false);
  }, [username, isTracked]);

  useEffect(() => {
    if (!isTracked && !isHamza) return;
    load();

    const channel = supabase
      .channel('suivie_realisations_notif')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suivie_realisations' }, () => {
        load();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load, isTracked, isHamza]);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setExpanded(false), 10000);
    return () => clearTimeout(t);
  }, [visible]);

  if ((!isTracked && !isHamza) || dismissed || loading) return null;
  if (data.length === 0) return null;

  const leader = data.find(b => b.isLeader) ?? null;
  const trailing = data.find(b => !b.isLeader) ?? null;
  const ecart = leader && trailing ? leader.cumul.prime_ttc - trailing.cumul.prime_ttc : 0;
  const totalCumulPrimeTTC = data.reduce((s, b) => s + b.cumul.prime_ttc, 0);
  const totalBonusCumul = data.reduce((s, b) => s + b.cumul.bonus_total, 0);

  return (
    <div
      className={`fixed right-4 bottom-4 z-[110] w-96 transition-all duration-500 ease-out ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-[28rem] opacity-0'
      }`}
    >
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">

        {/* Header bar */}
        <div
          className={`bg-gradient-to-r from-slate-800 to-emerald-800 px-4 py-3 flex items-center justify-between ${onNavigateToProductivite ? 'cursor-pointer' : ''}`}
          onClick={onNavigateToProductivite}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Productivité</p>
              <p className="text-white/60 text-xs">{onNavigateToProductivite ? 'Cliquer pour voir la rubrique' : 'Rapport de session'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(p => !p); }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Leader highlight — always visible */}
        {leader && data.length === 2 && (
          <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-400 px-4 py-3">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_right,rgba(255,255,255,0.15)_0%,transparent_65%)]" />
            <div className="relative flex items-center justify-between gap-2">
              {/* Identity */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/25 border border-white/30 flex items-center justify-center text-white font-extrabold text-base shadow-inner flex-shrink-0">
                  {leader.name[0]}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-white flex-shrink-0" />
                    <span className="text-white font-extrabold text-base leading-tight truncate">{leader.name}</span>
                  </div>
                  <p className="text-white/75 text-xs leading-tight">En tête · {leader.cumul.count} contrat{leader.cumul.count > 1 ? 's' : ''}</p>
                </div>
              </div>
              {/* KPIs */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right">
                  <div className="text-white font-bold text-sm leading-tight">{fmt(leader.cumul.prime_ttc)}</div>
                  <div className="text-white/65 text-xs">Prime TTC</div>
                </div>
                {ecart > 0 && (
                  <div className="bg-white/20 border border-white/30 rounded-lg px-2 py-1 text-center backdrop-blur-sm">
                    <div className="text-white font-bold text-xs leading-tight">+{fmt(ecart)}</div>
                    <div className="text-white/65 text-[10px]">avance</div>
                  </div>
                )}
              </div>
            </div>
            {/* Type pills */}
            {Object.keys(leader.cumul.by_type).length > 0 && (
              <div className="relative flex flex-wrap gap-1.5 mt-2">
                {Object.entries(leader.cumul.by_type).map(([type, stat]) => (
                  <span key={type} className="inline-flex items-center gap-1 bg-white/20 border border-white/25 rounded-full px-2 py-0.5 text-white text-xs font-medium backdrop-blur-sm">
                    <span className="font-bold">{stat.count}×</span> {type}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Summary row */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{data.reduce((s, b) => s + b.session.count, 0)}</div>
              <div className="text-xs text-gray-400">Session</div>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{data.reduce((s, b) => s + b.cumul.count, 0)}</div>
              <div className="text-xs text-gray-400">Cumulé</div>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="text-center">
              <div className="text-sm font-bold text-emerald-700">{fmt(totalCumulPrimeTTC)}</div>
              <div className="text-xs text-gray-400">Prime TTC</div>
            </div>
          </div>
          {totalBonusCumul > 0 && (
            <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
              <Award className="w-3.5 h-3.5 text-green-600" />
              <span className="text-xs font-bold text-green-700">{fmt(totalBonusCumul)}</span>
            </div>
          )}
        </div>

        {/* Expanded detail */}
        <div className={`transition-all duration-500 overflow-hidden ${expanded ? 'max-h-[560px]' : 'max-h-0'}`}>
          <div className="px-4 py-3 space-y-3 max-h-[480px] overflow-y-auto">
            {data.map((block, idx) => (
              <div key={block.name}>
                {/* User card */}
                <div className={`rounded-xl border p-3 space-y-2.5 ${
                  block.isLeader
                    ? 'border-yellow-200 bg-yellow-50/60'
                    : 'border-gray-100 bg-gray-50/60'
                }`}>
                  {/* User row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm ${
                        block.isLeader
                          ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                          : 'bg-gradient-to-br from-slate-400 to-slate-600'
                      }`}>
                        {block.name[0]}
                      </div>
                      <span className="font-semibold text-gray-800 text-sm">{block.name}</span>
                      {block.isLeader
                        ? <span className="flex items-center gap-0.5 text-[11px] text-amber-600 font-bold bg-amber-100 rounded-full px-1.5 py-0.5"><Trophy className="w-3 h-3" /> 1er</span>
                        : <span className="flex items-center gap-0.5 text-[11px] text-slate-500 font-medium bg-slate-100 rounded-full px-1.5 py-0.5"><Medal className="w-3 h-3" /> 2e</span>
                      }
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <span className="font-semibold text-gray-700">{block.session.count}</span> session
                      <span className="text-gray-300 mx-1">/</span>
                      <span className="font-semibold text-gray-700">{block.cumul.count}</span> cumul
                    </div>
                  </div>

                  {/* Prime TTC */}
                  <div className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5 border border-gray-100">
                    <span className="text-xs text-gray-500">Prime TTC cumulée</span>
                    <span className="text-sm font-bold text-gray-900">{fmt(block.cumul.prime_ttc)}</span>
                  </div>

                  {/* By type */}
                  {Object.keys(block.cumul.by_type).length > 0 && (
                    <div className="space-y-1">
                      {Object.entries(block.cumul.by_type).map(([type, stat]) => (
                        <div key={type} className="flex items-center justify-between">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE[type] || 'bg-gray-100 text-gray-600'}`}>
                            {type}
                          </span>
                          <div className="text-[11px] text-gray-500">
                            <span className="font-semibold text-gray-700">{stat.count}</span> contrat{stat.count > 1 ? 's' : ''} — <span className="font-medium">{fmt(stat.prime_ttc)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bonus progress */}
                  <div className="space-y-1.5">
                    {Object.entries(BONUS_RULES).map(([type, rule]) => {
                      const d = block.cumul.bonus_detail[type];
                      const pb = block.cumul.by_type[type]?.prime_brute ?? 0;
                      const pct = Math.min(100, Math.round((pb / rule.seuil) * 100));
                      if (pb === 0) return null;
                      return (
                        <div key={type} className="bg-white rounded-lg px-2.5 py-2 border border-gray-100 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-gray-600 font-medium truncate pr-2">{type}</span>
                            {d.atteint ? (
                              <span className="flex items-center gap-0.5 text-[11px] text-green-700 font-bold whitespace-nowrap">
                                <CheckCircle2 className="w-3 h-3" /> +{fmt(d.bonus)}
                              </span>
                            ) : (
                              <span className="text-[11px] text-amber-600 whitespace-nowrap">−{fmt(d.reste)}</span>
                            )}
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${d.atteint ? 'bg-green-500' : 'bg-amber-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bonus total */}
                  {block.cumul.bonus_total > 0 && (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-xs font-semibold text-green-800">Bonus gagné</span>
                      </div>
                      <span className="text-sm font-bold text-green-700">{fmt(block.cumul.bonus_total)}</span>
                    </div>
                  )}
                  {block.cumul.bonus_total === 0 && (
                    <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                      <Target className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      <span className="text-xs text-amber-700">Aucun bonus débloqué</span>
                    </div>
                  )}
                </div>

                {idx < data.length - 1 && <div className="h-2" />}
              </div>
            ))}
          </div>

          <div
            className="text-center py-2 cursor-pointer hover:bg-gray-50 transition-colors border-t border-gray-100"
            onClick={() => setExpanded(false)}
          >
            <span className="text-xs text-gray-400 flex items-center justify-center gap-1">
              <ChevronDown className="w-3 h-3" /> Réduire
            </span>
          </div>
        </div>

        {/* Collapsed expand hint */}
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full py-2 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-1"
          >
            <ChevronUp className="w-3 h-3" /> Voir le détail
          </button>
        )}
      </div>
    </div>
  );
};

export default ProductiviteNotification;
