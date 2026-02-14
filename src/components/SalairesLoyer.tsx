import React, { useState, useEffect } from 'react';
import { DollarSign, ChevronLeft, ChevronRight, Check, X, Save } from 'lucide-react';
import {
  SalaireLoyer,
  getSalairesLoyers,
  upsertSalaireLoyer,
  generateMonthsList,
  formatMonthDisplay,
  initializeMissingMonths
} from '../utils/salairesService';

export default function SalairesLoyer() {
  const [salaires, setSalaires] = useState<SalaireLoyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
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
          statut: false,
          mode_liquidation: null,
          date_liquidation: null
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

  const handleEdit = (salaire: SalaireLoyer) => {
    setEditingId(salaire.id || salaire.mois);
    setEditData({
      ...salaire
    });
  };

  const handleSave = async () => {
    if (!editData.mois) return;

    setSaving(true);
    try {
      const success = await upsertSalaireLoyer({
        id: editData.id,
        mois: editData.mois,
        statut: editData.statut || false,
        mode_liquidation: editData.statut ? editData.mode_liquidation || null : null,
        date_liquidation: editData.statut ? editData.date_liquidation || null : null
      });

      if (success) {
        setEditingId(null);
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

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Mois
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Mode de Liquidation
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Date de Liquidation
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {salaires.map((salaire) => {
              const isEditing = editingId === (salaire.id || salaire.mois);

              return (
                <tr key={salaire.id || salaire.mois} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatMonthDisplay(salaire.mois)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isEditing ? (
                      <select
                        value={editData.statut ? 'true' : 'false'}
                        onChange={(e) => setEditData({ ...editData, statut: e.target.value === 'true' })}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="false">Non liquidé</option>
                        <option value="true">Liquidé</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          salaire.statut
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {salaire.statut ? (
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
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isEditing ? (
                      <select
                        value={editData.mode_liquidation || ''}
                        onChange={(e) => setEditData({ ...editData, mode_liquidation: e.target.value || null })}
                        disabled={!editData.statut}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="">Sélectionner...</option>
                        <option value="Compensation sur commission">Compensation sur commission</option>
                        <option value="Virement">Virement</option>
                        <option value="Cheque">Chèque</option>
                      </select>
                    ) : (
                      <span className="text-sm text-gray-900">
                        {salaire.mode_liquidation || '-'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isEditing ? (
                      <input
                        type="date"
                        value={editData.date_liquidation || ''}
                        onChange={(e) => setEditData({ ...editData, date_liquidation: e.target.value || null })}
                        disabled={!editData.statut}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    ) : (
                      <span className="text-sm text-gray-900">
                        {salaire.date_liquidation
                          ? new Date(salaire.date_liquidation).toLocaleDateString('fr-FR')
                          : '-'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <Save className="w-4 h-4 mr-1" />
                          Enregistrer
                        </button>
                        <button
                          onClick={handleCancel}
                          disabled={saving}
                          className="inline-flex items-center px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit(salaire)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                      >
                        Modifier
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
