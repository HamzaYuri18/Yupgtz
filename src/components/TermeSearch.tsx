import React, { useState } from 'react';
import { Search, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

const TermeSearch: React.FC = () => {
  const [contractNumber, setContractNumber] = useState('');
  const [echeance, setEcheance] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error } = await supabase
        .from('rapport')
        .select('*')
        .eq('numero_contrat', contractNumber)
        .eq('type', 'Terme')
        .eq('echeance', echeance)
        .single();

      if (error) {
        setError(`Erreur lors de la recherche: ${error.message}`);
      } else if (data) {
        setResult(data);
        setContractNumber('');
        setEcheance('');
      } else {
        setError('Aucun résultat trouvé pour ce contrat et cette échéance.');
      }
    } catch (err: any) {
      setError(`Erreur inattendue: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!dateDebut || !dateFin) {
      setError('Veuillez sélectionner les dates de début et de fin');
      return;
    }

    setExportLoading(true);
    setError(null);

    try {
      // Récupérer les données de la table terme avec le filtre de date
      const { data, error } = await supabase
        .from('terme')
        .select('*')
        .gte('created_at', `${dateDebut}T00:00:00`)
        .lte('created_at', `${dateFin}T23:59:59`)
        .order('created_at', { ascending: true });

      if (error) {
        setError(`Erreur lors de l'export: ${error.message}`);
        return;
      }

      if (!data || data.length === 0) {
        setError('Aucune donnée trouvée pour la période sélectionnée');
        return;
      }

      // Préparer les données pour l'export avec les nouvelles colonnes
      const exportData = data.map((item, index) => {
        // Calculer la prime avant retour (prime - retour)
        const prime = parseFloat(item.prime) || 0;
        const retour = parseFloat(item.retour) || 0;
        const primeAvantRetour = prime + retour;

        return {
          'N°': index + 1,
          'Numéro Contrat': item.numero_contrat || '',
          'Assuré': item.assure || '',
          'Prime': item.prime || '',
          'Retour': item.retour || '',
          'Prime avant retour': primeAvantRetour,
          'Montant Crédit': item.montant_credit || '',
          'Solde': item.montant || '',
          'Échéance': item.echeance || '',
          'Date Paiement Crédit': item.date_paiement_credit ? new Date(item.date_paiement_credit).toLocaleDateString('fr-FR') : '',
          'Montant Paiement Crédit': item.montant_paiement_credit || '',
          'Utilisateur': item.cree_par || '',
          'Date Création': item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR') : '',
          'Date Modification': item.updated_at ? new Date(item.updated_at).toLocaleDateString('fr-FR') : ''
        };
      });

      // Créer un nouveau classeur
      const wb = XLSX.utils.book_new();
      
      // Créer une feuille à partir des données
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Définir les largeurs de colonnes pour un meilleur affichage
      const colWidths = [
        { wch: 5 },  // N°
        { wch: 15 }, // Numéro Contrat
        { wch: 20 }, // Assuré
        { wch: 12 }, // Prime
        { wch: 12 }, // Retour
        { wch: 15 }, // Prime avant retour
        { wch: 15 }, // Montant Crédit
        { wch: 12 }, // Solde
        { wch: 12 }, // Échéance
        { wch: 15 }, // Date Paiement Crédit
        { wch: 18 }, // Montant Paiement Crédit
        { wch: 15 }, // Utilisateur
        { wch: 12 }, // Date Création
        { wch: 12 }, // Date Modification
      ];
      ws['!cols'] = colWidths;
      
      // Ajouter la feuille au classeur
      XLSX.utils.book_append_sheet(wb, ws, 'Termes');
      
      // Générer le nom du fichier avec les dates
      const fileName = `termes_${dateDebut}_au_${dateFin}.xlsx`;
      
      // Exporter le fichier
      XLSX.writeFile(wb, fileName);

    } catch (err: any) {
      setError(`Erreur lors de l'export: ${err.message}`);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-5">Recherche Terme</h2>

      {/* Section Recherche */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Recherche par contrat</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="contractNumber" className="block text-gray-700 text-sm font-bold mb-2">
              Numéro de Contrat:
            </label>
            <input
              type="text"
              id="contractNumber"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={contractNumber}
              onChange={(e) => setContractNumber(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="echeance" className="block text-gray-700 text-sm font-bold mb-2">
              Échéance (AAAA-MM-JJ):
            </label>
            <input
              type="date"
              id="echeance"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={echeance}
              onChange={(e) => setEcheance(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={handleSearch}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex items-center space-x-2"
          disabled={loading}
        >
          <Search className="w-5 h-5" />
          <span>Rechercher</span>
        </button>
      </div>

      {/* Section Export */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Export des termes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="dateDebut" className="block text-gray-700 text-sm font-bold mb-2">
              Date du:
            </label>
            <input
              type="date"
              id="dateDebut"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="dateFin" className="block text-gray-700 text-sm font-bold mb-2">
              Date au:
            </label>
            <input
              type="date"
              id="dateFin"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={handleExport}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex items-center space-x-2"
          disabled={exportLoading}
        >
          <Download className="w-5 h-5" />
          <span>{exportLoading ? 'Export en cours...' : 'Exporter en Excel'}</span>
        </button>
      </div>

      {loading && <p className="mt-3 text-gray-500">Recherche en cours...</p>}
      {error && <p className="mt-3 text-red-500">{error}</p>}

      {result && (
        <div className="mt-6 border-t pt-4">
          <h3 className="text-lg font-semibold text-gray-900">Résultat:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p><strong>Assuré:</strong> {result.assure}</p>
              <p><strong>Prime:</strong> {result.prime}</p>
              <p><strong>Retour:</strong> {result.retour || 'N/A'}</p>
              <p><strong>Prime avant retour:</strong> {(parseFloat(result.prime || 0) + parseFloat(result.retour || 0)).toFixed(2)}</p>
              <p><strong>Montant Crédit:</strong> {result.montant_credit || 'N/A'}</p>
              <p><strong>Solde:</strong> {result.montant}</p>
              <p><strong>Utilisateur:</strong> {result.cree_par}</p>
            </div>
            <div>
              <p><strong>Date de Paiement:</strong> {result.created_at ? new Date(result.created_at).toLocaleDateString('fr-FR') : 'N/A'}</p>
              <p><strong>Date de Paiement Crédit:</strong> {result.date_paiement_credit ? new Date(result.date_paiement_credit).toLocaleDateString('fr-FR') : 'N/A'}</p>
              <p><strong>Montant Paiement Crédit:</strong> {result.montant_paiement_credit || 'N/A'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TermeSearch;
