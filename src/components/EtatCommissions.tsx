import React, { useState, useEffect } from 'react';
import { Calendar, Save, Edit2, Check, X, DollarSign, TrendingDown, TrendingUp, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<QuinzaineData>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const loadQuinzaines = async () => {
    setLoading(true);
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
      await loadQuinzaines();
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

  useEffect(() => {
    loadQuinzaines();
  }, []);

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
          <button
            onClick={loadQuinzaines}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-400"
          >
            {loading ? 'Chargement...' : 'Actualiser'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
            {success}
          </div>
        )}
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
              {quinzaines.map((quinzaine) => (
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
                  <td className="px-4 py-3 text-sm text-right">
                    <span className="font-semibold text-red-600">{formatCurrency(quinzaine.total_charges)}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className="font-semibold text-orange-600">{formatCurrency(quinzaine.total_depenses)}</span>
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
              {formatCurrency(quinzaines.reduce((sum, q) => sum + q.commission, 0))}
            </span>
          </div>
          <p className="text-blue-100 text-xs font-medium">Total Commissions</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-sm p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="w-6 h-6 opacity-80" />
            <span className="text-xl font-bold">
              {formatCurrency(quinzaines.reduce((sum, q) => sum + q.total_charges, 0))}
            </span>
          </div>
          <p className="text-red-100 text-xs font-medium">Total Charges</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-sm p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="w-6 h-6 opacity-80" />
            <span className="text-xl font-bold">
              {formatCurrency(quinzaines.reduce((sum, q) => sum + q.total_depenses, 0))}
            </span>
          </div>
          <p className="text-orange-100 text-xs font-medium">Total Dépenses</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-sm p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-6 h-6 opacity-80" />
            <span className="text-xl font-bold">
              {formatCurrency(quinzaines.reduce((sum, q) => sum + q.commission_nette, 0))}
            </span>
          </div>
          <p className="text-green-100 text-xs font-medium">Total Net</p>
        </div>
      </div>
    </div>
  );
};

export default EtatCommissions;
