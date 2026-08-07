import React, { useState, useEffect, useMemo } from 'react';
import { X, Download, RotateCcw, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

interface TermeRetourListProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TermeRetour {
  id: number;
  numero_contrat: string;
  assure: string;
  prime: number;
  retour: string;
  prime_avant_retour: number;
  date_paiement: string | null;
  statut: string | null;
  date_encaissement: string | null;
  echeance: string;
  cree_par: string;
}

export default function TermeRetourList({ isOpen, onClose }: TermeRetourListProps) {
  const [termes, setTermes] = useState<TermeRetour[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadTermes();
    }
  }, [isOpen, dateDebut, dateFin]);

  const loadTermes = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('terme')
        .select('id, numero_contrat, assure, prime, Retour, "Prime avant retour", date_paiement, statut, Date_Encaissement, echeance, cree_par')
        .not('Retour', 'is', null)
        .order('date_paiement', { ascending: false, nullsFirst: false });

      if (dateDebut) {
        query = query.gte('date_paiement', dateDebut);
      }
      if (dateFin) {
        query = query.lte('date_paiement', dateFin);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError('Erreur lors du chargement: ' + fetchError.message);
        return;
      }

      const mapped: TermeRetour[] = (data || []).map((item: any) => ({
        id: item.id,
        numero_contrat: item.numero_contrat || '',
        assure: item.assure || '',
        prime: parseFloat(item.prime) || 0,
        retour: item.Retour || '',
        prime_avant_retour: parseFloat(item['Prime avant retour']) || 0,
        date_paiement: item.date_paiement || null,
        statut: item.statut || null,
        date_encaissement: item.Date_Encaissement || null,
        echeance: item.echeance || '',
        cree_par: item.cree_par || '',
      }));

      setTermes(mapped);
    } catch (err: any) {
      setError('Erreur inattendue: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const termesTechnique = useMemo(() => termes.filter((t) => t.retour === 'Technique'), [termes]);
  const termesContentieux = useMemo(() => termes.filter((t) => t.retour === 'Contentieux'), [termes]);

  const totalTechnique = useMemo(() => termesTechnique.reduce((sum, t) => sum + t.prime, 0), [termesTechnique]);
  const totalContentieux = useMemo(() => termesContentieux.reduce((sum, t) => sum + t.prime, 0), [termesContentieux]);
  const totalPrimeAvantRetourTechnique = useMemo(() => termesTechnique.reduce((sum, t) => sum + t.prime_avant_retour, 0), [termesTechnique]);
  const totalPrimeAvantRetourContentieux = useMemo(() => termesContentieux.reduce((sum, t) => sum + t.prime_avant_retour, 0), [termesContentieux]);
  const totalGeneral = totalTechnique + totalContentieux;

  const handleReset = () => {
    setDateDebut('');
    setDateFin('');
  };

  const handleExport = () => {
    if (termes.length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }

    const exportData = termes.map((terme, index) => ({
      'N°': index + 1,
      'Type Retour': terme.retour,
      'Numéro Contrat': terme.numero_contrat,
      'Assuré': terme.assure,
      'Prime': terme.prime.toFixed(2),
      'Prime avant retour': terme.prime_avant_retour.toFixed(2),
      'Échéance': terme.echeance,
      'Date Paiement': terme.date_paiement ? new Date(terme.date_paiement).toLocaleDateString('fr-FR') : '',
      'Statut': terme.statut || '',
      'Date Encaissement': terme.date_encaissement ? new Date(terme.date_encaissement).toLocaleDateString('fr-FR') : '',
      'Utilisateur': terme.cree_par,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Termes Retour');

    const fileName = `Termes_Retour_${dateDebut || 'debut'}_${dateFin || 'fin'}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const renderTable = (rows: TermeRetour[], label: string, color: string, totalPrime: number, totalAvantRetour: number) => (
    <div className="mb-8">
      <div className={`flex items-center justify-between mb-3 px-4 py-2 rounded-lg ${color}`}>
        <h3 className="text-lg font-bold">{label} ({rows.length})</h3>
        <div className="text-right text-sm">
          <p>Total Prime: <span className="font-bold">{totalPrime.toFixed(2)} TND</span></p>
          <p>Total Prime avant retour: <span className="font-bold">{totalAvantRetour.toFixed(2)} TND</span></p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm px-4 py-3">Aucun terme en {label.toLowerCase()} pour cette période</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">N° Contrat</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Assuré</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Prime</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Prime avant retour</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Échéance</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Date Paiement</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Statut</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((terme) => (
                <tr key={terme.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{terme.numero_contrat}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{terme.assure}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{terme.prime.toFixed(2)} TND</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{terme.prime_avant_retour.toFixed(2)} TND</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{terme.echeance ? new Date(terme.echeance).toLocaleDateString('fr-FR') : ''}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{terme.date_paiement ? new Date(terme.date_paiement).toLocaleDateString('fr-FR') : ''}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {terme.statut ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{terme.statut}</span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">En attente</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-amber-50">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <RotateCcw className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-amber-700">Termes en Retour (Technique & Contentieux)</h2>
              <p className="text-sm text-gray-600">Termes ayant un retour non null, défalqués par catégorie</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date Paiement - Du
              </label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date Paiement - Au
              </label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleReset}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Réinitialiser</span>
              </button>
              <button
                onClick={handleExport}
                disabled={termes.length === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Exporter</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-red-600 font-semibold">{error}</p>
            </div>
          ) : termes.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-600">Aucun terme en retour trouvé pour cette période</p>
            </div>
          ) : (
            <>
              {renderTable(termesTechnique, 'Technique', 'bg-blue-100 text-blue-800', totalTechnique, totalPrimeAvantRetourTechnique)}
              {renderTable(termesContentieux, 'Contentieux', 'bg-purple-100 text-purple-800', totalContentieux, totalPrimeAvantRetourContentieux)}

              <div className="mt-6 p-4 bg-gray-800 rounded-lg text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Total Général</h3>
                  <div className="text-right">
                    <p className="text-sm">Nombre total: <span className="font-bold">{termes.length}</span></p>
                    <p className="text-xl font-bold">{totalGeneral.toFixed(2)} TND</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-amber-600">{termes.length}</span> terme(s) en retour trouvé(s)
            </p>
            <button onClick={onClose} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
