import React, { useState, useEffect } from 'react';
import { DollarSign, ChevronLeft, ChevronRight, Check, X, Save, Briefcase, Home as HomeIcon } from 'lucide-react';
import {
  SalaireLoyer,
  getSalairesLoyers,
  upsertSalaireLoyer,
  generateMonthsList,
  formatMonthDisplay,
  initializeMissingMonths
} from '../utils/salairesService';

type EditType = 'salaires' | 'loyer';

export default function SalairesLoyer() {
  const [salaires, setSalaires] = useState<SalaireLoyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<EditType | null>(null);
  const [editData, setEditData] = useState<Partial<SalaireLoyer>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [saving, setSaving] = useState(false);

  const MONTHS_PER_PAGE = 6;
  const START_MONTH = '2025-06';

  const loadSalaires = async () => {
    setLoading(true);
    try {
      const startIndex = currentPage * MONTHS_PER_PAGE;
      const monthsList = generateMonthsList(START_MONTH, startIndex + MONTHS_PER_PAGE);
      const displayMonths = monthsList.slice(startIndex, startIndex + MONTHS_PER_PAGE);

      await initializeMissingMonths(displayMonths);

      const data = await getSalairesLoyers(displayMonths[displayMonths.length - 1], displayMonths[0]);

      const sortedData = displayMonths.map(month => {
        return data.find(s => s.mois === month) || {
          mois: month,
          montant_salaires: 0,
          statut_salaires: false,
          mode_liquidation_salaires: null,
          date_liquidation_salaires: null,
          montant_loyer: 0,
          statut_loyer: false,
          mode_liquidation_loyer: null,
          date_liquidation_loyer: null
        };
      });

      setSalaires(sortedData);
    } catch (error) {
      console.error('Erreur lors du chargement des salaires:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSalaires();
  }, [currentPage]);

  const handleEdit = (salaire: SalaireLoyer, type: EditType) => {
    setEditingId(salaire.id || salaire.mois);
    setEditType(type);
    setEditData({ ...salaire });
  };

  const handleSave = async () => {
    if (!editData.mois) return;

    setSaving(true);
    try {
      const success = await upsertSalaireLoyer({
        id: editData.id,
        mois: editData.mois,
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
        setEditingId(null);
        setEditType(null);
        setEditData({});
        await loadSalaires();
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditType(null);
    setEditData({});
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    setCurrentPage(currentPage + 1);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <DollarSign className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-800">Salaires et Loyer</h2>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 0}
                className={`p-2 rounded-lg transition-colors ${
                  currentPage === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-600 px-3">
                Page {currentPage + 1}
              </span>
              <button
                onClick={handleNextPage}
                className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
              <div className="flex items-center space-x-2 mb-4">
                <Briefcase className="w-5 h-5 text-blue-700" />
                <h3 className="text-lg font-bold text-blue-900">Salaires</h3>
              </div>
              <div className="space-y-3">
                {salaires.map((salaire) => {
                  const isEditing = editingId === (salaire.id || salaire.mois) && editType === 'salaires';

                  return (
                    <div key={`salaires-${salaire.id || salaire.mois}`} className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-700">
                          {formatMonthDisplay(salaire.mois)}
                        </span>
                        {isEditing ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              editData.statut_salaires
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {editData.statut_salaires ? 'Liquidé' : 'Non liquidé'}
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              salaire.statut_salaires
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {salaire.statut_salaires ? (
                              <>
                                <Check className="w-3 h-3 mr-1" />
                                Liquidé
                              </>
                            ) : (
                              <>
                                <X className="w-3 h-3 mr-1" />
                                Non liquidé
                              </>
                            )}
                          </span>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Montant</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editData.montant_salaires || 0}
                              onChange={(e) => setEditData({ ...editData, montant_salaires: parseFloat(e.target.value) || 0 })}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
                            <select
                              value={editData.statut_salaires ? 'true' : 'false'}
                              onChange={(e) => setEditData({ ...editData, statut_salaires: e.target.value === 'true' })}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="false">Non liquidé</option>
                              <option value="true">Liquidé</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Mode de Liquidation</label>
                            <select
                              value={editData.mode_liquidation_salaires || ''}
                              onChange={(e) => setEditData({ ...editData, mode_liquidation_salaires: e.target.value || null })}
                              disabled={!editData.statut_salaires}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                              <option value="">Sélectionner...</option>
                              <option value="Compensation sur commission">Compensation sur commission</option>
                              <option value="Virement">Virement</option>
                              <option value="Cheque">Chèque</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Date de Liquidation</label>
                            <input
                              type="date"
                              value={editData.date_liquidation_salaires || ''}
                              onChange={(e) => setEditData({ ...editData, date_liquidation_salaires: e.target.value || null })}
                              disabled={!editData.statut_salaires}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                          </div>
                          <div className="flex space-x-2 pt-2">
                            <button
                              onClick={handleSave}
                              disabled={saving}
                              className="flex-1 inline-flex items-center justify-center px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              <Save className="w-4 h-4 mr-1" />
                              Enregistrer
                            </button>
                            <button
                              onClick={handleCancel}
                              disabled={saving}
                              className="flex-1 inline-flex items-center justify-center px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                            >
                              <X className="w-4 h-4 mr-1" />
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">Montant:</span>
                            <span className="text-sm font-medium text-gray-900">{salaire.montant_salaires.toFixed(2)} TND</span>
                          </div>
                          {salaire.statut_salaires && (
                            <>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">Mode:</span>
                                <span className="text-xs text-gray-700">{salaire.mode_liquidation_salaires || '-'}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">Date:</span>
                                <span className="text-xs text-gray-700">
                                  {salaire.date_liquidation_salaires
                                    ? new Date(salaire.date_liquidation_salaires).toLocaleDateString('fr-FR')
                                    : '-'}
                                </span>
                              </div>
                            </>
                          )}
                          <button
                            onClick={() => handleEdit(salaire, 'salaires')}
                            className="w-full mt-2 text-blue-600 hover:text-blue-800 text-xs font-medium transition-colors"
                          >
                            Modifier
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
              <div className="flex items-center space-x-2 mb-4">
                <HomeIcon className="w-5 h-5 text-green-700" />
                <h3 className="text-lg font-bold text-green-900">Loyer</h3>
              </div>
              <div className="space-y-3">
                {salaires.map((salaire) => {
                  const isEditing = editingId === (salaire.id || salaire.mois) && editType === 'loyer';

                  return (
                    <div key={`loyer-${salaire.id || salaire.mois}`} className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-700">
                          {formatMonthDisplay(salaire.mois)}
                        </span>
                        {isEditing ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              editData.statut_loyer
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {editData.statut_loyer ? 'Liquidé' : 'Non liquidé'}
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              salaire.statut_loyer
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {salaire.statut_loyer ? (
                              <>
                                <Check className="w-3 h-3 mr-1" />
                                Liquidé
                              </>
                            ) : (
                              <>
                                <X className="w-3 h-3 mr-1" />
                                Non liquidé
                              </>
                            )}
                          </span>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Montant</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editData.montant_loyer || 0}
                              onChange={(e) => setEditData({ ...editData, montant_loyer: parseFloat(e.target.value) || 0 })}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
                            <select
                              value={editData.statut_loyer ? 'true' : 'false'}
                              onChange={(e) => setEditData({ ...editData, statut_loyer: e.target.value === 'true' })}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            >
                              <option value="false">Non liquidé</option>
                              <option value="true">Liquidé</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Mode de Liquidation</label>
                            <select
                              value={editData.mode_liquidation_loyer || ''}
                              onChange={(e) => setEditData({ ...editData, mode_liquidation_loyer: e.target.value || null })}
                              disabled={!editData.statut_loyer}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                              <option value="">Sélectionner...</option>
                              <option value="Compensation sur commission">Compensation sur commission</option>
                              <option value="Virement">Virement</option>
                              <option value="Cheque">Chèque</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Date de Liquidation</label>
                            <input
                              type="date"
                              value={editData.date_liquidation_loyer || ''}
                              onChange={(e) => setEditData({ ...editData, date_liquidation_loyer: e.target.value || null })}
                              disabled={!editData.statut_loyer}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                          </div>
                          <div className="flex space-x-2 pt-2">
                            <button
                              onClick={handleSave}
                              disabled={saving}
                              className="flex-1 inline-flex items-center justify-center px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              <Save className="w-4 h-4 mr-1" />
                              Enregistrer
                            </button>
                            <button
                              onClick={handleCancel}
                              disabled={saving}
                              className="flex-1 inline-flex items-center justify-center px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                            >
                              <X className="w-4 h-4 mr-1" />
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">Montant:</span>
                            <span className="text-sm font-medium text-gray-900">{salaire.montant_loyer.toFixed(2)} TND</span>
                          </div>
                          {salaire.statut_loyer && (
                            <>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">Mode:</span>
                                <span className="text-xs text-gray-700">{salaire.mode_liquidation_loyer || '-'}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">Date:</span>
                                <span className="text-xs text-gray-700">
                                  {salaire.date_liquidation_loyer
                                    ? new Date(salaire.date_liquidation_loyer).toLocaleDateString('fr-FR')
                                    : '-'}
                                </span>
                              </div>
                            </>
                          )}
                          <button
                            onClick={() => handleEdit(salaire, 'loyer')}
                            className="w-full mt-2 text-green-600 hover:text-green-800 text-xs font-medium transition-colors"
                          >
                            Modifier
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
