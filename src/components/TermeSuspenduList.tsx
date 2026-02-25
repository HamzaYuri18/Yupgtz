import React, { useState, useEffect } from 'react';
import { X, Download, AlertTriangle, Calendar } from 'lucide-react';
import { getSessionDate } from '../utils/auth';
import { getTermeSuspenduPaye } from '../utils/supabaseService';
import * as XLSX from 'xlsx';

interface TermeSuspenduListProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TermeSuspendu {
  id: string;
  session_date: string;
  num_police: string;
  code_ste: string;
  num_av: string;
  souscripteur: string;
  date_echeance: string;
  jours_depasses: number;
  prime_totale: number;
  created_at: string;
}

export default function TermeSuspenduList({ isOpen, onClose }: TermeSuspenduListProps) {
  const [termes, setTermes] = useState<TermeSuspendu[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    sessionDateFrom: getSessionDate(),
    sessionDateTo: getSessionDate(),
    echeanceDateFrom: '',
    echeanceDateTo: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadTermes();
    }
  }, [isOpen, filters]);

  const loadTermes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTermeSuspenduPaye(
        filters.sessionDateFrom,
        filters.sessionDateTo,
        filters.echeanceDateFrom,
        filters.echeanceDateTo
      );
      setTermes(data);
    } catch (err: any) {
      setError('Erreur lors du chargement des données: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleExport = () => {
    if (termes.length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }

    const exportData = termes.map(terme => ({
      'Date Session': new Date(terme.session_date).toLocaleDateString('fr-FR'),
      'Numéro Police': terme.num_police,
      'Code Société': terme.code_ste,
      'Numéro Avenant': terme.num_av,
      'Souscripteur': terme.souscripteur,
      'Date Échéance': new Date(terme.date_echeance).toLocaleDateString('fr-FR'),
      'Jours Dépassés': terme.jours_depasses,
      'Prime Totale (TND)': terme.prime_totale,
      'Date Enregistrement': new Date(terme.created_at).toLocaleDateString('fr-FR')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Termes Suspendus');

    const fileName = `Termes_Suspendus_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-red-50">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-red-700">Termes Suspendus Payés</h2>
              <p className="text-sm text-gray-600">Termes ayant dépassé le délai de garde de 45 jours</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Session - Date Du
              </label>
              <input
                type="date"
                value={filters.sessionDateFrom}
                onChange={(e) => handleFilterChange('sessionDateFrom', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Session - Date Au
              </label>
              <input
                type="date"
                value={filters.sessionDateTo}
                onChange={(e) => handleFilterChange('sessionDateTo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Échéance - Date Du
              </label>
              <input
                type="date"
                value={filters.echeanceDateFrom}
                onChange={(e) => handleFilterChange('echeanceDateFrom', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Échéance - Date Au
              </label>
              <input
                type="date"
                value={filters.echeanceDateTo}
                onChange={(e) => handleFilterChange('echeanceDateTo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={handleExport}
              disabled={termes.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Exporter en Excel</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600 font-semibold">{error}</p>
              </div>
            </div>
          ) : termes.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Aucun terme suspendu trouvé pour cette période</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Date Session
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Numéro Police
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Code Sté
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      N° Av
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Souscripteur
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Date Échéance
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Jours Dépassés
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Prime Totale
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {termes.map((terme) => (
                    <tr key={terme.id} className="hover:bg-red-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {new Date(terme.session_date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {terme.num_police}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {terme.code_ste}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {terme.num_av}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {terme.souscripteur}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {new Date(terme.date_echeance).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {terme.jours_depasses} jours
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {terme.prime_totale.toFixed(2)} TND
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-red-600">{termes.length}</span> terme(s) suspendu(s) trouvé(s)
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
