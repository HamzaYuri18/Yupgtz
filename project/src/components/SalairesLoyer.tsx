import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, Check, X, Save, Briefcase, Home as HomeIcon, Filter } from 'lucide-react';
import {
  SalaireLoyer,
  getAllSalairesLoyers,
  upsertSalaireLoyer,
  formatMonthDisplay,
  initializeMissingMonths,
  generateMonthsList
} from '../utils/salairesService';

type EditType = 'salaires' | 'loyer';

const MONTH_NAMES = [
  'Tous les mois', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function SalairesLoyer() {
  const [allSalaires, setAllSalaires] = useState<SalaireLoyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editType, setEditType] = useState<EditType | null>(null);
  const [editData, setEditData] = useState<Partial<SalaireLoyer>>({});
  const [saving, setSaving] = useState(false);
  const [filterMonth, setFilterMonth] = useState(0);
  const [filterYear, setFilterYear] = useState(0);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const load = async () => {
    setLoading(true);
    try {
      const monthsList = generateMonthsList('2025-06', 36);
      const upToCurrent = monthsList.filter(m => {
        const [y, mo] = m.split('-').map(Number);
        return y < currentYear || (y === currentYear && mo <= currentMonth);
      });
      await initializeMissingMonths(upToCurrent);
      const data = await getAllSalairesLoyers();
      setAllSalaires(data);
    } catch (err) {
      console.error('Erreur chargement salaires:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    allSalaires.filter(s => {
      if (filterMonth > 0 && s.mois !== filterMonth) return false;
      if (filterYear > 0 && s.annee !== filterYear) return false;
      return true;
    }),
    [allSalaires, filterMonth, filterYear]
  );

  const stats = useMemo(() => ({
    salairesPayes: allSalaires.filter(s => s.statut_salaires).length,
    salairesNonPayes: allSalaires.filter(s => !s.statut_salaires).length,
    totalSalairesPayes: allSalaires.filter(s => s.statut_salaires).reduce((a, s) => a + s.montant_salaires, 0),
    totalSalairesNonPayes: allSalaires.filter(s => !s.statut_salaires).reduce((a, s) => a + s.montant_salaires, 0),
    loyerPayes: allSalaires.filter(s => s.statut_loyer).length,
    loyerNonPayes: allSalaires.filter(s => !s.statut_loyer).length,
    totalLoyerPayes: allSalaires.filter(s => s.statut_loyer).reduce((a, s) => a + s.montant_loyer, 0),
    totalLoyerNonPayes: allSalaires.filter(s => !s.statut_loyer).reduce((a, s) => a + s.montant_loyer, 0),
  }), [allSalaires]);

  const handleEdit = (salaire: SalaireLoyer, type: EditType) => {
    const key = `${salaire.annee}-${salaire.mois}`;
    if (editingKey === key && editType === type) {
      setEditingKey(null); setEditType(null); setEditData({});
    } else {
      setEditingKey(key); setEditType(type); setEditData({ ...salaire });
    }
  };

  const handleSave = async () => {
    if (!editData.mois || !editData.annee) return;
    setSaving(true);
    try {
      const success = await upsertSalaireLoyer({
        id: editData.id,
        mois: editData.mois,
        annee: editData.annee,
        montant_salaires: editData.montant_salaires || 0,
        statut_salaires: editData.statut_salaires || false,
        mode_liquidation_salaires: editData.statut_salaires ? editData.mode_liquidation_salaires || null : null,
        date_liquidation_salaires: editData.statut_salaires ? editData.date_liquidation_salaires || null : null,
        montant_loyer: editData.montant_loyer || 0,
        statut_loyer: editData.statut_loyer || false,
        mode_liquidation_loyer: editData.statut_loyer ? editData.mode_liquidation_loyer || null : null,
        date_liquidation_loyer: editData.statut_loyer ? editData.date_liquidation_loyer || null : null
      });
      if (success) {
        setEditingKey(null); setEditType(null); setEditData({});
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => { setEditingKey(null); setEditType(null); setEditData({}); };

  const yearOptions: number[] = [];
  for (let y = currentYear + 1; y >= 2025; y--) yearOptions.push(y);

  const moisDisplay = (s: SalaireLoyer) =>
    formatMonthDisplay(s.moisDisplay || `${s.annee}-${s.mois.toString().padStart(2, '0')}`);

  if (loading) return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Salaires Payés</span>
            <Briefcase className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-green-600">{stats.salairesPayes}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">{stats.totalSalairesPayes.toFixed(3)} TND</p>
        </div>

        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-red-400">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Salaires Non Payés</span>
            <Briefcase className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-3xl font-bold text-red-500">{stats.salairesNonPayes}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">{stats.totalSalairesNonPayes.toFixed(3)} TND</p>
        </div>

        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Loyer Payé</span>
            <HomeIcon className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-blue-600">{stats.loyerPayes}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">{stats.totalLoyerPayes.toFixed(3)} TND</p>
        </div>

        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-orange-400">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Loyer Non Payé</span>
            <HomeIcon className="w-4 h-4 text-orange-400" />
          </div>
          <p className="text-3xl font-bold text-orange-500">{stats.loyerNonPayes}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">{stats.totalLoyerNonPayes.toFixed(3)} TND</p>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl shadow">
        {/* Header + Filters */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <DollarSign className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-800">Salaires et Loyer</h2>
              <span className="text-sm text-gray-400">({filtered.length} période{filtered.length > 1 ? 's' : ''})</span>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                value={filterMonth}
                onChange={e => setFilterMonth(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <select
                value={filterYear}
                onChange={e => setFilterYear(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={0}>Toutes années</option>
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              {(filterMonth > 0 || filterYear > 0) && (
                <button
                  onClick={() => { setFilterMonth(0); setFilterYear(0); }}
                  className="text-xs text-red-500 hover:text-red-700 font-medium underline whitespace-nowrap"
                >
                  Effacer
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 text-left font-semibold">Période</th>
                <th className="px-4 py-3 text-right font-semibold">
                  <div className="flex items-center justify-end space-x-1">
                    <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                    <span>Salaires</span>
                  </div>
                </th>
                <th className="px-4 py-3 text-center font-semibold">Statut Salaires</th>
                <th className="px-4 py-3 text-right font-semibold">
                  <div className="flex items-center justify-end space-x-1">
                    <HomeIcon className="w-3.5 h-3.5 text-green-600" />
                    <span>Loyer</span>
                  </div>
                </th>
                <th className="px-4 py-3 text-center font-semibold">Statut Loyer</th>
                <th className="px-4 py-3 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((salaire) => {
                const key = `${salaire.annee}-${salaire.mois}`;
                const isEditingSalaires = editingKey === key && editType === 'salaires';
                const isEditingLoyer = editingKey === key && editType === 'loyer';
                const isEditing = isEditingSalaires || isEditingLoyer;
                const isSalairesPaid = salaire.statut_salaires;
                const isLoyerPaid = salaire.statut_loyer;

                return (
                  <React.Fragment key={key}>
                    <tr className={`transition-colors ${isEditing ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3 font-semibold text-gray-800">{moisDisplay(salaire)}</td>

                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-gray-900">
                          {salaire.montant_salaires.toFixed(3)}
                          <span className="text-xs font-normal text-gray-400 ml-1">TND</span>
                        </span>
                        {isSalairesPaid && salaire.mode_liquidation_salaires && (
                          <p className="text-xs text-gray-400">{salaire.mode_liquidation_salaires}</p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          isSalairesPaid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
                        }`}>
                          {isSalairesPaid
                            ? <><Check className="w-3 h-3" />Liquidé</>
                            : <><X className="w-3 h-3" />Non liquidé</>
                          }
                        </span>
                        {isSalairesPaid && salaire.date_liquidation_salaires && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(salaire.date_liquidation_salaires).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-gray-900">
                          {salaire.montant_loyer.toFixed(3)}
                          <span className="text-xs font-normal text-gray-400 ml-1">TND</span>
                        </span>
                        {isLoyerPaid && salaire.mode_liquidation_loyer && (
                          <p className="text-xs text-gray-400">{salaire.mode_liquidation_loyer}</p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          isLoyerPaid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
                        }`}>
                          {isLoyerPaid
                            ? <><Check className="w-3 h-3" />Liquidé</>
                            : <><X className="w-3 h-3" />Non liquidé</>
                          }
                        </span>
                        {isLoyerPaid && salaire.date_liquidation_loyer && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(salaire.date_liquidation_loyer).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEdit(salaire, 'salaires')}
                            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                              isEditingSalaires
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                          >
                            {isEditingSalaires ? '▲' : '▼'} Salaires
                          </button>
                          <button
                            onClick={() => handleEdit(salaire, 'loyer')}
                            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                              isEditingLoyer
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {isEditingLoyer ? '▲' : '▼'} Loyer
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Inline edit panel */}
                    {isEditing && (
                      <tr>
                        <td colSpan={6} className="px-4 pb-4 bg-blue-50/40">
                          <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-200 mt-1">
                            <h4 className="font-semibold text-gray-700 mb-3 text-sm flex items-center gap-2">
                              {editType === 'salaires'
                                ? <Briefcase className="w-4 h-4 text-blue-600" />
                                : <HomeIcon className="w-4 h-4 text-emerald-600" />
                              }
                              Modifier {editType === 'salaires' ? 'Salaires' : 'Loyer'} — {moisDisplay(salaire)}
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Montant (TND)</label>
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  value={editType === 'salaires' ? (editData.montant_salaires ?? 0) : (editData.montant_loyer ?? 0)}
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setEditData(editType === 'salaires'
                                      ? { ...editData, montant_salaires: val }
                                      : { ...editData, montant_loyer: val });
                                  }}
                                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
                                <select
                                  value={editType === 'salaires'
                                    ? (editData.statut_salaires ? 'true' : 'false')
                                    : (editData.statut_loyer ? 'true' : 'false')}
                                  onChange={e => {
                                    const val = e.target.value === 'true';
                                    setEditData(editType === 'salaires'
                                      ? { ...editData, statut_salaires: val }
                                      : { ...editData, statut_loyer: val });
                                  }}
                                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  <option value="false">Non liquidé</option>
                                  <option value="true">Liquidé</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Mode liquidation</label>
                                <select
                                  value={editType === 'salaires'
                                    ? (editData.mode_liquidation_salaires || '')
                                    : (editData.mode_liquidation_loyer || '')}
                                  onChange={e => {
                                    const val = e.target.value || null;
                                    setEditData(editType === 'salaires'
                                      ? { ...editData, mode_liquidation_salaires: val }
                                      : { ...editData, mode_liquidation_loyer: val });
                                  }}
                                  disabled={editType === 'salaires' ? !editData.statut_salaires : !editData.statut_loyer}
                                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                >
                                  <option value="">Sélectionner...</option>
                                  <option value="Compensation sur commission">Compensation sur commission</option>
                                  <option value="Virement">Virement</option>
                                  <option value="Cheque">Chèque</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Date liquidation</label>
                                <input
                                  type="date"
                                  value={editType === 'salaires'
                                    ? (editData.date_liquidation_salaires || '')
                                    : (editData.date_liquidation_loyer || '')}
                                  onChange={e => {
                                    const val = e.target.value || null;
                                    setEditData(editType === 'salaires'
                                      ? { ...editData, date_liquidation_salaires: val }
                                      : { ...editData, date_liquidation_loyer: val });
                                  }}
                                  disabled={editType === 'salaires' ? !editData.statut_salaires : !editData.statut_loyer}
                                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={handleSave}
                                disabled={saving}
                                className="inline-flex items-center px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                              >
                                <Save className="w-4 h-4 mr-1.5" />
                                {saving ? 'Enregistrement...' : 'Enregistrer'}
                              </button>
                              <button
                                onClick={handleCancel}
                                disabled={saving}
                                className="inline-flex items-center px-4 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                              >
                                <X className="w-4 h-4 mr-1.5" />
                                Annuler
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Aucune période trouvée pour les filtres sélectionnés.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
            <span>{filtered.length} période{filtered.length > 1 ? 's' : ''} affichée{filtered.length > 1 ? 's' : ''} · Du plus récent au plus ancien</span>
            <span>
              Total affiché — Salaires: <strong>{filtered.reduce((a, s) => a + s.montant_salaires, 0).toFixed(3)} TND</strong>
              &nbsp;|&nbsp;
              Loyer: <strong>{filtered.reduce((a, s) => a + s.montant_loyer, 0).toFixed(3)} TND</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
