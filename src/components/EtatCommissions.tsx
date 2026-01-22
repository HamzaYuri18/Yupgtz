import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Save, Edit2, Check, X, DollarSign, TrendingDown, TrendingUp, FileText, Download, Filter, RefreshCw } from 'lucide-react';
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterAnnee, setFilterAnnee] = useState<string>('all');
  const [filterQuinzaine, setFilterQuinzaine] = useState<string>('all');
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dataLoadedRef = useRef(false);
  const subscriptionsRef = useRef<any[]>([]);

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
        annee: year,
        mois: month,
        quinzaine: 1,
        date_debut: `${year}-${String(month).padStart(2, '0')}-01`,
        date_fin: `${year}-${String(month).padStart(2, '0')}-15`,
        commission: 0,
        total_charges: 0,
        total_depenses: 0,
        commission_nette: 0,
        statut: 'Non Liquidée',
        date_liquidation: null,
        banque: null,
        mode_liquidation: null,
        remarques: null
      });

      quinzainesArray.push({
        annee: year,
        mois: month,
        quinzaine: 2,
        date_debut: `${year}-${String(month).padStart(2, '0')}-16`,
        date_fin: `${year}-${String(month).padStart(2, '0')}-${lastDay}`,
        commission: 0,
        total_charges: 0,
        total_depenses: 0,
        commission_nette: 0,
        statut: 'Non Liquidée',
        date_liquidation: null,
        banque: null,
        mode_liquidation: null,
        remarques: null
      });

      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }

    return quinzainesArray;
  };

  const calculateCharges = async (dateDebut: string, dateFin: string): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('charges')
        .gte('date_session', dateDebut)
        .lte('date_session', dateFin);

      if (error) throw error;

      const total = data?.reduce((sum, session) => sum + (Number(session.charges) || 0), 0) || 0;
      return total;
    } catch (err) {
      console.error('Erreur calcul charges:', err);
      return 0;
    }
  };

  const calculateDepenses = async (dateDebut: string, dateFin: string): Promise<number> => {
    try {
      const excludedTypes = ['Versement Bancaire', 'A/S Ahlem', 'A/S Islem', 'Reprise sur Avance Client'];

      const { data, error } = await supabase
        .from('depenses')
        .select('montant, type_depense')
        .gte('date_depense', dateDebut)
        .lte('date_depense', dateFin);

      if (error) throw error;

      const total = data?.reduce((sum, depense) => {
        if (!excludedTypes.includes(depense.type_depense)) {
          return sum + (Number(depense.montant) || 0);
        }
        return sum;
      }, 0) || 0;

      return total;
    } catch (err) {
      console.error('Erreur calcul dépenses:', err);
      return 0;
    }
  };

  const loadQuinzaines = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError('');

    try {
      const generatedQuinzaines = generateQuinzaines();

      const { data: existingData, error: fetchError } = await supabase
        .from('etat_commission')
        .select('*')
        .order('annee', { ascending: false })
        .order('mois', { ascending: false })
        .order('quinzaine', { ascending: false });

      if (fetchError) throw fetchError;

      const enrichedQuinzaines = await Promise.all(
        generatedQuinzaines.map(async (quinzaine) => {
          const existing = existingData?.find(
            e => e.annee === quinzaine.annee &&
                 e.mois === quinzaine.mois &&
                 e.quinzaine === quinzaine.quinzaine
          );

          if (existing) {
            return {
              ...quinzaine,
              id: existing.id,
              commission: Number(existing.commission) || 0,
              total_charges: Number(existing.total_charges) || 0,
              total_depenses: Number(existing.total_depenses) || 0,
              commission_nette: Number(existing.commission_nette) || 0,
              statut: existing.statut,
              date_liquidation: existing.date_liquidation,
              banque: existing.banque,
              mode_liquidation: existing.mode_liquidation,
              remarques: existing.remarques
            };
          } else {
            const charges = await calculateCharges(quinzaine.date_debut, quinzaine.date_fin);
            const depenses = await calculateDepenses(quinzaine.date_debut, quinzaine.date_fin);
            const commissionNette = quinzaine.commission - charges - depenses;

            return {
              ...quinzaine,
              total_charges: charges,
              total_depenses: depenses,
              commission_nette: commissionNette
            };
          }
        })
      );

      setQuinzaines(enrichedQuinzaines);
      dataLoadedRef.current = true;
    } catch (err) {
      console.error('Erreur chargement quinzaines:', err);
      setError('Erreur lors du chargement des quinzaines');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const refreshCalculations = async (quinzaine: QuinzaineData) => {
    const charges = await calculateCharges(quinzaine.date_debut, quinzaine.date_fin);
    const depenses = await calculateDepenses(quinzaine.date_debut, quinzaine.date_fin);
    const commission = Number(quinzaine.commission) || 0;
    const commissionNette = commission - charges - depenses;

    return {
      total_charges: charges,
      total_depenses: depenses,
      commission_nette: commissionNette
    };
  };

  const handleSave = async (quinzaine: QuinzaineData) => {
    setError('');
    setSuccess('');

    try {
      const calculations = await refreshCalculations({
        ...quinzaine,
        ...editData
      });

      const dataToSave = {
        annee: quinzaine.annee,
        mois: quinzaine.mois,
        quinzaine: quinzaine.quinzaine,
        date_debut: quinzaine.date_debut,
        date_fin: quinzaine.date_fin,
        commission: Number(editData.commission ?? quinzaine.commission),
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
          .from('etat_commission')
          .update(dataToSave)
          .eq('id', quinzaine.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('etat_commission')
          .insert([dataToSave]);

        if (insertError) throw insertError;
      }

      setSuccess('Données enregistrées avec succès');
      setEditingId(null);
      setEditData({});
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
      setError('Erreur lors de la sauvegarde');
    }
  };

  const startEdit = (quinzaine: QuinzaineData) => {
    setEditingId(quinzaine.id || `${quinzaine.annee}-${quinzaine.mois}-${quinzaine.quinzaine}`);
    setEditData({
      commission: quinzaine.commission,
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
  };

  const exportCharges = async (quinzaine: QuinzaineData) => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .gte('date_session', quinzaine.date_debut)
        .lte('date_session', quinzaine.date_fin)
        .order('date_session', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        setError('Aucune charge trouvée pour cette période');
        return;
      }

      const exportData = data.map(session => ({
        'Date Session': session.date_session,
        'Charges': Number(session.charges) || 0,
        'Statut': session.statut,
        'Remarques': session.remarques || ''
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Charges');

      const fileName = `charges_${moisNoms[quinzaine.mois - 1]}_${quinzaine.annee}_Q${quinzaine.quinzaine}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error('Erreur export charges:', err);
      setError('Erreur lors de l\'export des charges');
    }
  };

  const exportDepenses = async (quinzaine: QuinzaineData) => {
    try {
      const excludedTypes = ['Versement Bancaire', 'A/S Ahlem', 'A/S Islem', 'Reprise sur Avance Client'];

      const { data, error } = await supabase
        .from('depenses')
        .select('*')
        .gte('date_depense', quinzaine.date_debut)
        .lte('date_depense', quinzaine.date_fin)
        .order('date_depense', { ascending: false });

      if (error) throw error;

      const filteredData = data?.filter(d => !excludedTypes.includes(d.type_depense));

      if (!filteredData || filteredData.length === 0) {
        setError('Aucune dépense trouvée pour cette période');
        return;
      }

      const exportData = filteredData.map(depense => ({
        'Date Dépense': depense.date_depense,
        'Type Dépense': depense.type_depense,
        'Montant': Number(depense.montant) || 0,
        'Client': depense.Client || '',
        'Numéro Contrat': depense.Numero_Contrat || '',
        'Créé Par': depense.cree_par
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Dépenses');

      const fileName = `depenses_${moisNoms[quinzaine.mois - 1]}_${quinzaine.annee}_Q${quinzaine.quinzaine}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error('Erreur export dépenses:', err);
      setError('Erreur lors de l\'export des dépenses');
    }
  };

  const applyFilters = () => {
    let filtered = [...quinzaines];

    if (filterAnnee !== 'all') {
      filtered = filtered.filter(q => q.annee === Number(filterAnnee));
    }

    if (filterQuinzaine !== 'all') {
      filtered = filtered.filter(q => q.quinzaine === Number(filterQuinzaine));
    }

    setFilteredQuinzaines(filtered);
  };

  const setupSubscriptions = () => {
    // Nettoyer les anciennes subscriptions
    cleanupSubscriptions();

    if (!autoUpdate) return;

    // Subscription pour la table etat_commission
    const etatCommissionSub = supabase
      .channel('etat-commission-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'etat_commission'
        },
        async (payload) => {
          console.log('Changement détecté dans etat_commission:', payload);
          
          if (dataLoadedRef.current) {
            setIsRefreshing(true);
            setSuccess('Mise à jour automatique des données...');
            
            // Délai pour permettre à l'utilisateur de voir le message
            await new Promise(resolve => setTimeout(resolve, 500));
            
            await loadQuinzaines(false);
            setIsRefreshing(false);
            
            // Effacer le message après 3 secondes
            setTimeout(() => {
              setSuccess('');
            }, 3000);
          }
        }
      )
      .subscribe();

    // Subscription pour la table sessions (charges)
    const sessionsSub = supabase
      .channel('sessions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions'
        },
        async (payload) => {
          console.log('Changement détecté dans sessions:', payload);
          
          if (dataLoadedRef.current) {
            // Vérifier si cette session affecte une période actuelle
            const sessionDate = payload.new?.date_session || payload.old?.date_session;
            if (!sessionDate) return;

            const affectedQuinzaines = quinzaines.filter(q => 
              sessionDate >= q.date_debut && sessionDate <= q.date_fin
            );

            if (affectedQuinzaines.length > 0) {
              setIsRefreshing(true);
              setSuccess('Actualisation des charges...');
              
              await new Promise(resolve => setTimeout(resolve, 500));
              
              await loadQuinzaines(false);
              setIsRefreshing(false);
              
              setTimeout(() => {
                setSuccess('');
              }, 3000);
            }
          }
        }
      )
      .subscribe();

    // Subscription pour la table depenses
    const depensesSub = supabase
      .channel('depenses-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'depenses'
        },
        async (payload) => {
          console.log('Changement détecté dans depenses:', payload);
          
          if (dataLoadedRef.current) {
            // Vérifier si c'est un type de dépense qui nous intéresse
            const excludedTypes = ['Versement Bancaire', 'A/S Ahlem', 'A/S Islem', 'Reprise sur Avance Client'];
            const depenseType = payload.new?.type_depense || payload.old?.type_depense;
            
            // Si c'est une dépense exclue, ignorer
            if (excludedTypes.includes(depenseType)) {
              return;
            }

            // Vérifier si cette dépense affecte une période actuelle
            const depenseDate = payload.new?.date_depense || payload.old?.date_depense;
            if (!depenseDate) return;

            const affectedQuinzaines = quinzaines.filter(q => 
              depenseDate >= q.date_debut && depenseDate <= q.date_fin
            );

            if (affectedQuinzaines.length > 0) {
              setIsRefreshing(true);
              setSuccess('Actualisation des dépenses...');
              
              await new Promise(resolve => setTimeout(resolve, 500));
              
              await loadQuinzaines(false);
              setIsRefreshing(false);
              
              setTimeout(() => {
                setSuccess('');
              }, 3000);
            }
          }
        }
      )
      .subscribe();

    // Stocker les subscriptions
    subscriptionsRef.current = [etatCommissionSub, sessionsSub, depensesSub];
  };

  const cleanupSubscriptions = () => {
    subscriptionsRef.current.forEach(sub => {
      if (sub && sub.unsubscribe) {
        sub.unsubscribe();
      }
    });
    subscriptionsRef.current = [];
  };

  const toggleAutoUpdate = () => {
    setAutoUpdate(!autoUpdate);
    if (!autoUpdate) {
      setupSubscriptions();
    } else {
      cleanupSubscriptions();
    }
  };

  useEffect(() => {
    // Charger les données initiales
    loadQuinzaines();
    
    // Configurer les subscriptions
    setupSubscriptions();

    // Nettoyer les subscriptions à la destruction du composant
    return () => {
      cleanupSubscriptions();
    };
  }, []);

  // Re-configurer les subscriptions quand autoUpdate change
  useEffect(() => {
    if (dataLoadedRef.current) {
      setupSubscriptions();
    }
  }, [autoUpdate, quinzaines]);

  useEffect(() => {
    applyFilters();
  }, [quinzaines, filterAnnee, filterQuinzaine]);

  const formatCurrency = (amount: number) => {
    return `${new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }).format(amount)} DT`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  const isEditing = (quinzaine: QuinzaineData) => {
    return editingId === (quinzaine.id || `${quinzaine.annee}-${quinzaine.mois}-${quinzaine.quinzaine}`);
  };

  return (
    <div className="space-y-6">
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
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${autoUpdate ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <button
                onClick={toggleAutoUpdate}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  autoUpdate 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {autoUpdate ? 'Auto-actualisation ON' : 'Auto-actualisation OFF'}
              </button>
            </div>
            <button
              onClick={() => loadQuinzaines()}
              disabled={loading || isRefreshing}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-400 flex items-center space-x-2"
            >
              {loading || isRefreshing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Chargement...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Actualiser</span>
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm flex items-center justify-between">
            <span>{success}</span>
            {success.includes('automatique') && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                <span className="text-xs">En cours...</span>
              </div>
            )}
          </div>
        )}

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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            >
              <option value="all">Toutes les années</option>
              {Array.from(new Set(quinzaines.map(q => q.annee))).sort((a, b) => b - a).map(annee => (
                <option key={annee} value={annee}>{annee}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Quinzaine</label>
            <select
              value={filterQuinzaine}
              onChange={(e) => setFilterQuinzaine(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            >
              <option value="all">Toutes les quinzaines</option>
              <option value="1">Quinzaine 1</option>
              <option value="2">Quinzaine 2</option>
            </select>
          </div>

          {(filterAnnee !== 'all' || filterQuinzaine !== 'all') && (
            <button
              onClick={() => {
                setFilterAnnee('all');
                setFilterQuinzaine('all');
              }}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors mt-5"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Période</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Commission</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Charges</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Dépenses</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Commission Nette</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Liquidation</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Remarques</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredQuinzaines.map((quinzaine) => (
                <tr key={`${quinzaine.annee}-${quinzaine.mois}-${quinzaine.quinzaine}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-gray-900">
                      {moisNoms[quinzaine.mois - 1]} {quinzaine.annee} - Q{quinzaine.quinzaine}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(quinzaine.date_debut)} au {formatDate(quinzaine.date_fin)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {isEditing(quinzaine) ? (
                      <input
                        type="number"
                        step="0.001"
                        value={editData.commission ?? quinzaine.commission}
                        onChange={(e) => setEditData({ ...editData, commission: Number(e.target.value) })}
                        className="w-32 px-2 py-1 border border-gray-300 rounded text-right"
                      />
                    ) : (
                      <span className="font-semibold text-blue-600">{formatCurrency(quinzaine.commission)}</span>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-sm text-right cursor-pointer hover:bg-red-50 transition-colors group"
                    onClick={() => exportCharges(quinzaine)}
                    title="Cliquer pour exporter les détails"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span className="font-semibold text-red-600">{formatCurrency(quinzaine.total_charges)}</span>
                      <Download className="w-3 h-3 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </td>
                  <td
                    className="px-4 py-3 text-sm text-right cursor-pointer hover:bg-orange-50 transition-colors group"
                    onClick={() => exportDepenses(quinzaine)}
                    title="Cliquer pour exporter les détails"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span className="font-semibold text-orange-600">{formatCurrency(quinzaine.total_depenses)}</span>
                      <Download className="w-3 h-3 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={`font-bold ${quinzaine.commission_nette >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(quinzaine.commission_nette)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {isEditing(quinzaine) ? (
                      <select
                        value={editData.statut ?? quinzaine.statut}
                        onChange={(e) => setEditData({ ...editData, statut: e.target.value as 'Non Liquidée' | 'Liquidée' })}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
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
                  <td className="px-4 py-3 text-sm">
                    {isEditing(quinzaine) && (editData.statut === 'Liquidée' || quinzaine.statut === 'Liquidée') ? (
                      <div className="space-y-2">
                        <input
                          type="date"
                          value={editData.date_liquidation ?? quinzaine.date_liquidation ?? ''}
                          onChange={(e) => setEditData({ ...editData, date_liquidation: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Banque"
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
                  <td className="px-4 py-3 text-sm">
                    {isEditing(quinzaine) ? (
                      <textarea
                        value={editData.remarques ?? quinzaine.remarques ?? ''}
                        onChange={(e) => setEditData({ ...editData, remarques: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        rows={2}
                        placeholder="Remarques..."
                      />
                    ) : (
                      <span className="text-gray-600 text-xs">{quinzaine.remarques || '-'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center justify-center space-x-2">
                      {isEditing(quinzaine) ? (
                        <>
                          <button
                            onClick={() => handleSave(quinzaine)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Enregistrer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Annuler"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(quinzaine)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-6 h-6 opacity-80" />
            <span className="text-xl font-bold">
              {formatCurrency(filteredQuinzaines.reduce((sum, q) => sum + q.commission, 0))}
            </span>
          </div>
          <p className="text-blue-100 text-xs font-medium">Total Commissions</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-sm p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="w-6 h-6 opacity-80" />
            <span className="text-xl font-bold">
              {formatCurrency(filteredQuinzaines.reduce((sum, q) => sum + q.total_charges, 0))}
            </span>
          </div>
          <p className="text-red-100 text-xs font-medium">Total Charges</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-sm p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="w-6 h-6 opacity-80" />
            <span className="text-xl font-bold">
              {formatCurrency(filteredQuinzaines.reduce((sum, q) => sum + q.total_depenses, 0))}
            </span>
          </div>
          <p className="text-orange-100 text-xs font-medium">Total Dépenses</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-sm p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-6 h-6 opacity-80" />
            <span className="text-xl font-bold">
              {formatCurrency(filteredQuinzaines.reduce((sum, q) => sum + q.commission_nette, 0))}
            </span>
          </div>
          <p className="text-green-100 text-xs font-medium">Total Net</p>
        </div>
      </div>
    </div>
  );
};

export default EtatCommissions;
