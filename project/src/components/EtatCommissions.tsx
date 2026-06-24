import React, { useState, useEffect } from 'react';
import { Calendar, CreditCard as Edit2, Check, X, DollarSign, TrendingDown, TrendingUp, Download, Filter, Heart, Unlock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

interface QuinzaineData {
  id?: string;
  annee: number;
  mois: number;
  quinzaine: number;
  date_debut: string;
  date_fin: string;
  commission: number;
  commission_vie: number;
  commission_liberee: number;
  total_charges: number;
  total_depenses: number;
  commission_nette: number;
  statut: 'Non Liquidée' | 'Liquidée';
  date_liquidation: string | null;
  banque: string | null;
  mode_liquidation: 'Chèque' | 'Virement' | null;
  remarques: string | null;
}

const EtatCommissions: React.FC = () => {
  const [quinzaines, setQuinzaines] = useState<QuinzaineData[]>([]);
  const [filteredQuinzaines, setFilteredQuinzaines] = useState<QuinzaineData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<QuinzaineData>>({});
  const [commissionInput, setCommissionInput] = useState<string>('');
  const [commissionVieInput, setCommissionVieInput] = useState<string>('');
  const [commissionLibInput, setCommissionLibInput] = useState<string>('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterAnnee, setFilterAnnee] = useState<string>(String(new Date().getFullYear()));
  const [filterQuinzaine, setFilterQuinzaine] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const moisNoms = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const getLastDayOfMonth = (year: number, month: number): number => {
    return new Date(year, month, 0).getDate();
  };

  const generateQuinzaines = () => {
    const quinzainesArray: QuinzaineData[] = [];
    const startDate = new Date(2025, 8, 1);
    const currentDate = new Date();

    let year = startDate.getFullYear();
    let month = startDate.getMonth() + 1;

    while (year < currentDate.getFullYear() || (year === currentDate.getFullYear() && month <= currentDate.getMonth() + 1)) {
      const lastDay = getLastDayOfMonth(year, month);

      quinzainesArray.push({
        annee: year, mois: month, quinzaine: 1,
        date_debut: `${year}-${String(month).padStart(2, '0')}-01`,
        date_fin: `${year}-${String(month).padStart(2, '0')}-15`,
        commission: 0, commission_vie: 0, commission_liberee: 0,
        total_charges: 0, total_depenses: 0, commission_nette: 0,
        statut: 'Non Liquidée', date_liquidation: null, banque: null,
        mode_liquidation: null, remarques: null
      });

      quinzainesArray.push({
        annee: year, mois: month, quinzaine: 2,
        date_debut: `${year}-${String(month).padStart(2, '0')}-16`,
        date_fin: `${year}-${String(month).padStart(2, '0')}-${lastDay}`,
        commission: 0, commission_vie: 0, commission_liberee: 0,
        total_charges: 0, total_depenses: 0, commission_nette: 0,
        statut: 'Non Liquidée', date_liquidation: null, banque: null,
        mode_liquidation: null, remarques: null
      });

      month++;
      if (month > 12) { month = 1; year++; }
    }

    return quinzainesArray;
  };

  const isAfterThreshold = (annee: number, mois: number, quinzaine: number): boolean => {
    if (annee > 2026) return true;
    if (annee === 2026 && mois > 5) return true;
    if (annee === 2026 && mois === 5 && quinzaine >= 2) return true;
    return false;
  };

  const calculateCommissionsFromTable = async (dateDebut: string, dateFin: string): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from('Commissions')
        .select('"Commission nette"')
        .gte('Date', dateDebut)
        .lte('Date', dateFin);
      if (error) throw error;
      return data?.reduce((sum, row) => sum + (Number(row['Commission nette']) || 0), 0) || 0;
    } catch { return 0; }
  };

  const calculateCharges = async (dateDebut: string, dateFin: string): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('charges')
        .gte('date_session', dateDebut)
        .lte('date_session', dateFin);
      if (error) throw error;
      return data?.reduce((sum, s) => sum + (Number(s.charges) || 0), 0) || 0;
    } catch { return 0; }
  };

  const calculateDepenses = async (dateDebut: string, dateFin: string): Promise<number> => {
    try {
      const excluded = ['Versement Bancaire', 'A/S Ahlem', 'A/S Rouae', 'Reprise sur Avance Client'];
      const { data, error } = await supabase
        .from('depenses')
        .select('montant, type_depense, statut_depense')
        .gte('date_depense', dateDebut)
        .lte('date_depense', dateFin);
      if (error) throw error;
      return data?.reduce((sum, d) => {
        if (excluded.includes(d.type_depense)) return sum;
        if (d.type_depense === 'Dépense Récupérable' && d.statut_depense === 'Payé') return sum;
        return sum + (Number(d.montant) || 0);
      }, 0) || 0;
    } catch { return 0; }
  };

  const calcNette = (commission: number, vie: number, liberee: number, charges: number, depenses: number) =>
    commission + vie + liberee - charges - depenses;

  const loadQuinzaines = async () => {
    setLoading(true);
    setError('');
    try {
      const { error: updateError } = await supabase.rpc('update_etat_commission');
      if (updateError) console.error('Erreur actualisation etat_commission:', updateError);

      const generated = generateQuinzaines();

      const { data: existingData, error: fetchError } = await supabase
        .from('etat_commission')
        .select('*')
        .order('annee', { ascending: false })
        .order('mois', { ascending: false })
        .order('quinzaine', { ascending: false });

      if (fetchError) throw fetchError;

      const enriched = await Promise.all(
        generated.map(async (q) => {
          const existing = existingData?.find(
            e => e.annee === q.annee && e.mois === q.mois && e.quinzaine === q.quinzaine
          );

          if (existing) {
            const baseCommission = Number(existing.commission) || 0;
            let commFromTable = 0;
            if (isAfterThreshold(q.annee, q.mois, q.quinzaine)) {
              commFromTable = await calculateCommissionsFromTable(q.date_debut, q.date_fin);
            }
            const totalComm = baseCommission + commFromTable;
            const vie = Number(existing.commission_vie) || 0;
            const liberee = Number(existing.commission_liberee) || 0;
            const charges = Number(existing.total_charges) || 0;
            const depenses = Number(existing.total_depenses) || 0;
            return {
              ...q,
              id: existing.id,
              commission: totalComm,
              commission_vie: vie,
              commission_liberee: liberee,
              total_charges: charges,
              total_depenses: depenses,
              commission_nette: calcNette(totalComm, vie, liberee, charges, depenses),
              statut: existing.statut,
              date_liquidation: existing.date_liquidation,
              banque: existing.banque,
              mode_liquidation: existing.mode_liquidation,
              remarques: existing.remarques
            };
          } else {
            const charges = await calculateCharges(q.date_debut, q.date_fin);
            const depenses = await calculateDepenses(q.date_debut, q.date_fin);
            let commFromTable = 0;
            if (isAfterThreshold(q.annee, q.mois, q.quinzaine)) {
              commFromTable = await calculateCommissionsFromTable(q.date_debut, q.date_fin);
            }
            const totalComm = q.commission + commFromTable;
            return {
              ...q,
              commission: totalComm,
              total_charges: charges,
              total_depenses: depenses,
              commission_nette: calcNette(totalComm, 0, 0, charges, depenses)
            };
          }
        })
      );

      setQuinzaines(enriched);
    } catch (err) {
      console.error('Erreur chargement quinzaines:', err);
      setError('Erreur lors du chargement des quinzaines');
    } finally {
      setLoading(false);
    }
  };

  const refreshCalculations = async (quinzaine: QuinzaineData) => {
    const charges = await calculateCharges(quinzaine.date_debut, quinzaine.date_fin);
    const depenses = await calculateDepenses(quinzaine.date_debut, quinzaine.date_fin);
    let commFromTable = 0;
    if (isAfterThreshold(quinzaine.annee, quinzaine.mois, quinzaine.quinzaine)) {
      commFromTable = await calculateCommissionsFromTable(quinzaine.date_debut, quinzaine.date_fin);
    }
    const commission = (Number(quinzaine.commission) || 0) + commFromTable;
    const vie = Number(quinzaine.commission_vie) || 0;
    const liberee = Number(quinzaine.commission_liberee) || 0;
    return {
      total_charges: charges,
      total_depenses: depenses,
      commission_nette: calcNette(commission, vie, liberee, charges, depenses)
    };
  };

  const handleSave = async (quinzaine: QuinzaineData) => {
    setError('');
    setSuccess('');
    try {
      const merged = { ...quinzaine, ...editData };
      const calculations = await refreshCalculations(merged);

      const dataToSave = {
        annee: quinzaine.annee,
        mois: quinzaine.mois,
        quinzaine: quinzaine.quinzaine,
        date_debut: quinzaine.date_debut,
        date_fin: quinzaine.date_fin,
        commission: Number(editData.commission ?? quinzaine.commission),
        commission_vie: Number(editData.commission_vie ?? quinzaine.commission_vie ?? 0),
        commission_liberee: Number(editData.commission_liberee ?? quinzaine.commission_liberee ?? 0),
        total_charges: calculations.total_charges,
        total_depenses: calculations.total_depenses,
        commission_nette: calculations.commission_nette,
        statut: editData.statut ?? quinzaine.statut,
        date_liquidation: editData.date_liquidation ?? quinzaine.date_liquidation,
        banque: editData.banque ?? quinzaine.banque,
        mode_liquidation: editData.mode_liquidation ?? quinzaine.mode_liquidation,
        remarques: editData.remarques ?? quinzaine.remarques,
        updated_at: new Date().toISOString()
      };

      if (quinzaine.id) {
        const { error: updateError } = await supabase
          .from('etat_commission').update(dataToSave).eq('id', quinzaine.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('etat_commission').insert([dataToSave]);
        if (insertError) throw insertError;
      }

      setSuccess('Données enregistrées avec succès');
      setEditingId(null);
      setEditData({});
      setCommissionInput('');
      setCommissionVieInput('');
      setCommissionLibInput('');
      await loadQuinzaines();
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
      setError('Erreur lors de la sauvegarde');
    }
  };

  const startEdit = (quinzaine: QuinzaineData) => {
    setEditingId(quinzaine.id || `${quinzaine.annee}-${quinzaine.mois}-${quinzaine.quinzaine}`);
    setCommissionInput(quinzaine.commission > 0 ? String(quinzaine.commission) : '');
    setCommissionVieInput(quinzaine.commission_vie > 0 ? String(quinzaine.commission_vie) : '');
    setCommissionLibInput(quinzaine.commission_liberee > 0 ? String(quinzaine.commission_liberee) : '');
    setEditData({
      commission: quinzaine.commission,
      commission_vie: quinzaine.commission_vie,
      commission_liberee: quinzaine.commission_liberee,
      statut: quinzaine.statut,
      date_liquidation: quinzaine.date_liquidation,
      banque: quinzaine.banque,
      mode_liquidation: quinzaine.mode_liquidation,
      remarques: quinzaine.remarques
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
    setCommissionInput('');
    setCommissionVieInput('');
    setCommissionLibInput('');
  };

  const makeNumericInput = (
    value: string,
    setValue: (v: string) => void,
    field: keyof QuinzaineData
  ) => ({
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(',', '.');
      if (raw === '' || /^-?\d*\.?\d*$/.test(raw)) {
        setValue(e.target.value.replace(',', '.'));
        const parsed = parseFloat(raw);
        if (!isNaN(parsed)) setEditData(prev => ({ ...prev, [field]: parsed }));
      }
    },
    onBlur: () => {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        setValue(String(parsed));
        setEditData(prev => ({ ...prev, [field]: parsed }));
      } else {
        setValue('0');
        setEditData(prev => ({ ...prev, [field]: 0 }));
      }
    }
  });

  const exportCharges = async (quinzaine: QuinzaineData) => {
    try {
      const { data, error } = await supabase
        .from('sessions').select('*')
        .gte('date_session', quinzaine.date_debut).lte('date_session', quinzaine.date_fin)
        .order('date_session', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) { setError('Aucune charge trouvée'); return; }
      const ws = XLSX.utils.json_to_sheet(data.map(s => ({
        'Date Session': s.date_session, 'Charges': Number(s.charges) || 0,
        'Statut': s.statut, 'Remarques': s.remarques || ''
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Charges');
      XLSX.writeFile(wb, `charges_${moisNoms[quinzaine.mois - 1]}_${quinzaine.annee}_Q${quinzaine.quinzaine}.xlsx`);
    } catch { setError('Erreur export charges'); }
  };

  const exportDepenses = async (quinzaine: QuinzaineData) => {
    try {
      const excluded = ['Versement Bancaire', 'A/S Ahlem', 'A/S Rouae', 'Reprise sur Avance Client'];
      const { data, error } = await supabase
        .from('depenses').select('*')
        .gte('date_depense', quinzaine.date_debut).lte('date_depense', quinzaine.date_fin)
        .order('date_depense', { ascending: false });
      if (error) throw error;
      const filtered = data?.filter(d => {
        if (excluded.includes(d.type_depense)) return false;
        if (d.type_depense === 'Dépense Récupérable' && d.statut_depense === 'Payé') return false;
        return true;
      });
      if (!filtered || filtered.length === 0) { setError('Aucune dépense trouvée'); return; }
      const ws = XLSX.utils.json_to_sheet(filtered.map(d => ({
        'Date Dépense': d.date_depense, 'Type': d.type_depense,
        'Montant': Number(d.montant) || 0, 'Statut': d.statut_depense || '',
        'Client': d.Client || '', 'N° Contrat': d.Numero_Contrat || '', 'Créé Par': d.cree_par
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Dépenses');
      XLSX.writeFile(wb, `depenses_${moisNoms[quinzaine.mois - 1]}_${quinzaine.annee}_Q${quinzaine.quinzaine}.xlsx`);
    } catch { setError('Erreur export dépenses'); }
  };

  const applyFilters = () => {
    let filtered = [...quinzaines];
    if (filterAnnee !== 'all') filtered = filtered.filter(q => q.annee === Number(filterAnnee));
    if (filterQuinzaine !== 'all') filtered = filtered.filter(q => q.quinzaine === Number(filterQuinzaine));
    filtered.sort((a, b) => {
      if (b.annee !== a.annee) return b.annee - a.annee;
      if (b.mois !== a.mois) return b.mois - a.mois;
      return b.quinzaine - a.quinzaine;
    });
    setFilteredQuinzaines(filtered);
    setCurrentPage(1);
  };

  useEffect(() => { loadQuinzaines(); }, []);
  useEffect(() => { applyFilters(); }, [quinzaines, filterAnnee, filterQuinzaine]);

  const fmt = (amount: number) =>
    `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(amount)} DT`;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  const isEditing = (quinzaine: QuinzaineData) =>
    editingId === (quinzaine.id || `${quinzaine.annee}-${quinzaine.mois}-${quinzaine.quinzaine}`);

  // ── Cumulated stats ───────────────────────────────────────────────────────
  const totalComm    = filteredQuinzaines.reduce((s, q) => s + q.commission, 0);
  const totalVie     = filteredQuinzaines.reduce((s, q) => s + q.commission_vie, 0);
  const totalLib     = filteredQuinzaines.reduce((s, q) => s + q.commission_liberee, 0);
  const totalAllComm = totalComm + totalVie + totalLib;
  const totalCharges = filteredQuinzaines.reduce((s, q) => s + q.total_charges, 0);
  const totalDep     = filteredQuinzaines.reduce((s, q) => s + q.total_depenses, 0);
  const totalNette   = filteredQuinzaines.reduce((s, q) => s + q.commission_nette, 0);

  const pct = (val: number) => totalAllComm > 0 ? Math.round((val / totalAllComm) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header + filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Etat des Commissions</h2>
              <p className="text-sm text-gray-500">Gestion des commissions par quinzaine</p>
            </div>
          </div>
          <button
            onClick={loadQuinzaines}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-400"
          >
            {loading ? 'Chargement...' : 'Actualiser'}
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">{success}</div>}

        <div className="flex items-center space-x-4 mt-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filtres:</span>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Année</label>
            <select
              value={filterAnnee}
              onChange={(e) => setFilterAnnee(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
            >
              <option value="all">Toutes les années</option>
              {Array.from(new Set(quinzaines.map(q => q.annee))).sort((a, b) => b - a).map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Quinzaine</label>
            <select
              value={filterQuinzaine}
              onChange={(e) => setFilterQuinzaine(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
            >
              <option value="all">Toutes les quinzaines</option>
              <option value="1">Quinzaine 1</option>
              <option value="2">Quinzaine 2</option>
            </select>
          </div>
          {(filterAnnee !== 'all' || filterQuinzaine !== 'all') && (
            <button
              onClick={() => { setFilterAnnee('all'); setFilterQuinzaine('all'); }}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Summary cards row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-md border-l-4 border-sky-500 p-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Total Commissions</p>
              <p className="text-lg font-bold text-sky-700">{fmt(totalComm)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md border-l-4 border-rose-500 p-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <TrendingDown className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Total Charges</p>
              <p className="text-lg font-bold text-rose-700">{fmt(totalCharges)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md border-l-4 border-amber-500 p-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <TrendingDown className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Total Dépenses</p>
              <p className="text-lg font-bold text-amber-700">{fmt(totalDep)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md border-l-4 border-emerald-500 p-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Total Net</p>
              <p className={`text-lg font-bold ${totalNette >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmt(totalNette)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Commission breakdown stats */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
          Répartition cumulée des commissions
        </h3>

        {/* Three stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {/* Commission */}
          <div className="bg-sky-50 rounded-xl p-4 border border-sky-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-semibold text-sky-700 uppercase tracking-wide">Commission</span>
              </div>
              <span className="text-xl font-black text-sky-700">{pct(totalComm)}%</span>
            </div>
            <p className="text-xl font-bold text-sky-900">{fmt(totalComm)}</p>
            <div className="mt-3 h-2 bg-sky-100 rounded-full overflow-hidden">
              <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${pct(totalComm)}%` }} />
            </div>
          </div>

          {/* Commission Vie */}
          <div className="bg-pink-50 rounded-xl p-4 border border-pink-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-600" />
                <span className="text-xs font-semibold text-pink-700 uppercase tracking-wide">Commission Vie</span>
              </div>
              <span className="text-xl font-black text-pink-700">{pct(totalVie)}%</span>
            </div>
            <p className="text-xl font-bold text-pink-900">{fmt(totalVie)}</p>
            <div className="mt-3 h-2 bg-pink-100 rounded-full overflow-hidden">
              <div className="h-full bg-pink-500 rounded-full transition-all" style={{ width: `${pct(totalVie)}%` }} />
            </div>
          </div>

          {/* Commission Libérée */}
          <div className="bg-violet-50 rounded-xl p-4 border border-violet-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Unlock className="w-4 h-4 text-violet-600" />
                <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Comm. Libérée</span>
              </div>
              <span className="text-xl font-black text-violet-700">{pct(totalLib)}%</span>
            </div>
            <p className="text-xl font-bold text-violet-900">{fmt(totalLib)}</p>
            <div className="mt-3 h-2 bg-violet-100 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pct(totalLib)}%` }} />
            </div>
          </div>
        </div>

        {/* Stacked progress bar */}
        {totalAllComm > 0 && (
          <div>
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
              <div className="bg-sky-500 transition-all" style={{ width: `${pct(totalComm)}%` }} title={`Commission: ${pct(totalComm)}%`} />
              <div className="bg-pink-500 transition-all" style={{ width: `${pct(totalVie)}%` }} title={`Commission Vie: ${pct(totalVie)}%`} />
              <div className="bg-violet-500 transition-all" style={{ width: `${pct(totalLib)}%` }} title={`Commission Libérée: ${pct(totalLib)}%`} />
            </div>
            <div className="flex gap-5 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />Commission {pct(totalComm)}%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500 inline-block" />Vie {pct(totalVie)}%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />Libérée {pct(totalLib)}%</span>
              <span className="ml-auto font-semibold text-gray-700">Total: {fmt(totalAllComm)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Période</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-sky-600 uppercase whitespace-nowrap">Commission</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-pink-600 uppercase whitespace-nowrap">Comm. Vie</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-violet-600 uppercase whitespace-nowrap">Comm. Libérée</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-red-600 uppercase whitespace-nowrap">Charges</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-amber-600 uppercase whitespace-nowrap">Dépenses</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-emerald-700 uppercase whitespace-nowrap">Comm. Nette</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Statut</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Liquidation</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Remarques</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredQuinzaines.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((quinzaine) => {
                const editing = isEditing(quinzaine);
                return (
                  <tr key={`${quinzaine.annee}-${quinzaine.mois}-${quinzaine.quinzaine}`} className="hover:bg-gray-50">
                    {/* Période */}
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-900 whitespace-nowrap">
                        {moisNoms[quinzaine.mois - 1]} {quinzaine.annee} - Q{quinzaine.quinzaine}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(quinzaine.date_debut)} au {formatDate(quinzaine.date_fin)}
                      </div>
                    </td>

                    {/* Commission */}
                    <td className="px-3 py-3 text-right">
                      {editing ? (
                        <input
                          type="text" inputMode="decimal"
                          {...makeNumericInput(commissionInput, setCommissionInput, 'commission')}
                          placeholder="0.000"
                          className="w-28 px-2 py-1 border border-sky-400 rounded text-right focus:outline-none focus:ring-2 focus:ring-sky-500 bg-sky-50 font-medium text-sm"
                        />
                      ) : (
                        <span className="font-semibold text-sky-700">{fmt(quinzaine.commission)}</span>
                      )}
                    </td>

                    {/* Commission Vie */}
                    <td className="px-3 py-3 text-right">
                      {editing ? (
                        <input
                          type="text" inputMode="decimal"
                          {...makeNumericInput(commissionVieInput, setCommissionVieInput, 'commission_vie')}
                          placeholder="0.000"
                          className="w-28 px-2 py-1 border border-pink-400 rounded text-right focus:outline-none focus:ring-2 focus:ring-pink-500 bg-pink-50 font-medium text-sm"
                        />
                      ) : (
                        <span className={`font-semibold ${quinzaine.commission_vie > 0 ? 'text-pink-600' : 'text-gray-400'}`}>
                          {quinzaine.commission_vie > 0 ? fmt(quinzaine.commission_vie) : '—'}
                        </span>
                      )}
                    </td>

                    {/* Commission Libérée */}
                    <td className="px-3 py-3 text-right">
                      {editing ? (
                        <input
                          type="text" inputMode="decimal"
                          {...makeNumericInput(commissionLibInput, setCommissionLibInput, 'commission_liberee')}
                          placeholder="0.000"
                          className="w-28 px-2 py-1 border border-violet-400 rounded text-right focus:outline-none focus:ring-2 focus:ring-violet-500 bg-violet-50 font-medium text-sm"
                        />
                      ) : (
                        <span className={`font-semibold ${quinzaine.commission_liberee > 0 ? 'text-violet-600' : 'text-gray-400'}`}>
                          {quinzaine.commission_liberee > 0 ? fmt(quinzaine.commission_liberee) : '—'}
                        </span>
                      )}
                    </td>

                    {/* Charges */}
                    <td
                      className="px-3 py-3 text-right cursor-pointer hover:bg-red-50 transition-colors group"
                      onClick={() => exportCharges(quinzaine)}
                      title="Cliquer pour exporter"
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span className="font-semibold text-red-600">{fmt(quinzaine.total_charges)}</span>
                        <Download className="w-3 h-3 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>

                    {/* Dépenses */}
                    <td
                      className="px-3 py-3 text-right cursor-pointer hover:bg-orange-50 transition-colors group"
                      onClick={() => exportDepenses(quinzaine)}
                      title="Cliquer pour exporter"
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span className="font-semibold text-orange-600">{fmt(quinzaine.total_depenses)}</span>
                        <Download className="w-3 h-3 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>

                    {/* Commission Nette */}
                    <td className="px-3 py-3 text-right">
                      <span className={`font-bold ${quinzaine.commission_nette >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {fmt(quinzaine.commission_nette)}
                      </span>
                    </td>

                    {/* Statut */}
                    <td className="px-3 py-3">
                      {editing ? (
                        <select
                          value={editData.statut ?? quinzaine.statut}
                          onChange={(e) => setEditData({ ...editData, statut: e.target.value as 'Non Liquidée' | 'Liquidée' })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        >
                          <option value="Non Liquidée">Non Liquidée</option>
                          <option value="Liquidée">Liquidée</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          quinzaine.statut === 'Liquidée' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {quinzaine.statut}
                        </span>
                      )}
                    </td>

                    {/* Liquidation */}
                    <td className="px-3 py-3">
                      {editing && (editData.statut === 'Liquidée' || quinzaine.statut === 'Liquidée') ? (
                        <div className="space-y-1.5">
                          <input type="date"
                            value={editData.date_liquidation ?? quinzaine.date_liquidation ?? ''}
                            onChange={(e) => setEditData({ ...editData, date_liquidation: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                          <input type="text" placeholder="Banque"
                            value={editData.banque ?? quinzaine.banque ?? ''}
                            onChange={(e) => setEditData({ ...editData, banque: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                          <select
                            value={editData.mode_liquidation ?? quinzaine.mode_liquidation ?? ''}
                            onChange={(e) => setEditData({ ...editData, mode_liquidation: e.target.value as 'Chèque' | 'Virement' })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          >
                            <option value="">Mode</option>
                            <option value="Chèque">Chèque</option>
                            <option value="Virement">Virement</option>
                          </select>
                        </div>
                      ) : quinzaine.statut === 'Liquidée' ? (
                        <div className="text-xs">
                          <div className="font-medium">{formatDate(quinzaine.date_liquidation)}</div>
                          <div className="text-gray-600">{quinzaine.banque}</div>
                          <div className="text-gray-600">{quinzaine.mode_liquidation}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>

                    {/* Remarques */}
                    <td className="px-3 py-3">
                      {editing ? (
                        <textarea
                          value={editData.remarques ?? quinzaine.remarques ?? ''}
                          onChange={(e) => setEditData({ ...editData, remarques: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          rows={2} placeholder="Remarques..."
                        />
                      ) : (
                        <span className="text-gray-600 text-xs">{quinzaine.remarques || '-'}</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center space-x-2">
                        {editing ? (
                          <>
                            <button onClick={() => handleSave(quinzaine)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Enregistrer">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={cancelEdit} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Annuler">
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => startEdit(quinzaine)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Modifier">
                            <Edit2 className="w-4 h-4" />
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

        {filteredQuinzaines.length > itemsPerPage && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              {(currentPage - 1) * itemsPerPage + 1} – {Math.min(currentPage * itemsPerPage, filteredQuinzaines.length)} sur {filteredQuinzaines.length} quinzaines
            </p>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-medium rounded-lg"
              >
                ← Précédent
              </button>
              <span className="px-4 py-2 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-lg">
                {currentPage} / {Math.ceil(filteredQuinzaines.length / itemsPerPage)}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredQuinzaines.length / itemsPerPage), p + 1))}
                disabled={currentPage === Math.ceil(filteredQuinzaines.length / itemsPerPage)}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-medium rounded-lg"
              >
                Suivant →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EtatCommissions;
