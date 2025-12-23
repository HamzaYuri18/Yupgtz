import React, { useState } from 'react';
import { Upload, FileX, CheckCircle, AlertCircle } from 'lucide-react';
import { parseXLSXFile } from '../utils/xlsxParser';
import { saveXMLContracts, getXMLContracts } from '../utils/storage';
import { createMonthlyTable, insertContractsToTable, getAvailableMonths } from '../utils/supabaseService';

const XLSXUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [month, setMonth] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [parsedContracts, setParsedContracts] = useState<any[]>([]);
  const [existingContracts, setExistingContracts] = useState<any[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  React.useEffect(() => {
    setExistingContracts(getXMLContracts());
    loadAvailableMonths();
  }, []);

  const loadAvailableMonths = async () => {
    const months = await getAvailableMonths();
    setAvailableMonths(months);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || selectedFile.name.endsWith('.xlsx')) {
        setFile(selectedFile);
        setMessage('');
      } else {
        setMessage('Veuillez sélectionner un fichier XLSX valide');
        setFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !month.trim()) {
      setMessage('Veuillez sélectionner un fichier et saisir le mois');
      return;
    }

    setIsUploading(true);
    setMessage('');

    try {
      console.log('🚀 Début du processus d\'upload XLSX');
      console.log('📁 Fichier:', file.name);
      console.log('📅 Mois:', month);
      
      const contracts = await parseXLSXFile(file);
      console.log('📊 Contrats parsés:', contracts.length);
      console.log('🔍 Premier contrat:', contracts[0]);
      
      setParsedContracts(contracts);
      saveXMLContracts(contracts);
      
      console.log('🔧 Tentative de création de table pour le mois:', month);
      
      // Créer la table mensuelle dans Supabase
      try {
        console.log('🔧 Tentative de création de table pour le mois:', month);
        await createMonthlyTable(month);
        console.log('✅ Table Supabase créée avec succès');
        
        // Attendre que le cache de schéma Supabase se rafraîchisse
        console.log('⏳ Attente du rafraîchissement du cache de schéma...');
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('✅ Cache de schéma rafraîchi');
      } catch (tableError) {
        console.error('❌ Erreur lors de la création de la table:', tableError);
        setMessage(`❌ Erreur création table: ${(tableError as Error).message}`);
        setIsUploading(false);
        return;
      }

      // Insérer les contrats dans la table Supabase seulement si la table a été créée
      try {
        console.log('🔄 Début de l\'insertion des contrats dans Supabase...');
        console.log('📊 Nombre de contrats à insérer:', contracts.length);
        console.log('🎯 Mois pour insertion:', month);
        const insertSuccess = await insertContractsToTable(month, contracts);
        console.log('📊 Résultat de l\'insertion:', insertSuccess);
        
        if (!insertSuccess) {
          throw new Error('Échec de l\'insertion des données - Vérifiez la console pour plus de détails');
        }
        
        const cleanMonth = month.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').trim();
        setMessage(`✅ ${contracts.length} contrats importés avec succès dans Supabase (table: table_terme_${cleanMonth})`);
        console.log('🎉 Import XLSX terminé avec succès!');
      } catch (insertError) {
        console.error('❌ Erreur lors de l\'insertion:', insertError);
        setMessage(`❌ Table créée mais erreur lors de l'insertion: ${(insertError as Error).message}`);
      }

      setExistingContracts(contracts);
      
      // Recharger la liste des mois disponibles
      await loadAvailableMonths();
    } catch (error) {
      console.error('❌ Erreur générale lors du parsing XLSX:', error);
      setMessage('❌ Erreur lors du parsing du fichier XLSX: ' + (error as Error).message);
    }

    setIsUploading(false);
  };

  const clearFile = () => {
    setFile(null);
    setMonth('');
    setMessage('');
    setParsedContracts([]);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-2xl p-8 border border-white/20">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg shadow-md">
            <Upload className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Import de fichiers XLSX</h2>
        </div>

        {/* Saisie du mois */}
        <div className="mb-6">
          <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-2">
            Mois pour la table (ex: Janvier 2024, Février 2024, etc.)
          </label>
          <input
            type="text"
            id="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-gradient-to-r from-green-50 to-white"
            placeholder="Saisissez le mois (ex: Janvier 2024)"
            required
          />
        </div>

        {/* Liste des mois disponibles */}
        {availableMonths.length > 0 && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200 shadow-sm">
            <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              Mois déjà importés:
            </h3>
            <div className="flex flex-wrap gap-2">
              {availableMonths.map((availableMonth, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 rounded-full text-sm shadow-sm border border-blue-200"
                >
                  {availableMonth}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Zone d'upload */}
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-green-400 hover:bg-green-50/30 transition-all duration-200 bg-gradient-to-br from-gray-50 to-white">
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFileChange}
            className="hidden"
            id="xlsx-upload"
          />
          
          {!file ? (
            <label htmlFor="xlsx-upload" className="cursor-pointer">
              <div className="w-12 h-12 mx-auto mb-4 p-2 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <p className="text-lg text-gray-600 mb-2">Cliquez pour sélectionner un fichier XLSX</p>
              <p className="text-sm text-gray-400">Ou glissez-déposez votre fichier ici</p>
            </label>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-3">
                <div className="p-1 bg-green-100 rounded-full">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <span className="text-lg font-medium text-gray-900">{file.name}</span>
                <button
                  onClick={clearFile}
                  className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-full transition-all duration-200"
                >
                  <FileX className="w-6 h-6" />
                </button>
              </div>
              
              <button
                onClick={handleUpload}
                disabled={isUploading || !month.trim()}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center space-x-2 mx-auto shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {isUploading ? (
                  <div className="w-5 h-5 border-2 border-white/70 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <Upload className="w-5 h-5" />
                )}
                <span>{isUploading ? 'Import en cours...' : 'Importer vers Supabase'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Message */}
        {message && (
          <div className={`mt-4 p-4 rounded-lg text-sm flex items-center space-x-2 ${
            message.includes('succès') 
             ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200 shadow-sm' 
             : 'bg-gradient-to-r from-red-50 to-pink-50 text-red-700 border border-red-200 shadow-sm'
          }`}>
            {message.includes('succès') ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span>{message}</span>
          </div>
        )}

        {/* Format XML attendu */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <div className="w-3 h-3 bg-gray-500 rounded-full mr-2"></div>
            Format XLSX attendu:
          </h3>
          <pre className="bg-gradient-to-r from-white to-gray-50 p-4 rounded-lg border border-gray-200 text-sm overflow-x-auto shadow-sm">
{`Fichier Excel (.xlsx) avec les colonnes suivantes:

| Numéro Contrat | Prime (DT) | Échéance   | Assuré       | NUM_TEL    | NUM_TEL_2  |
|----------------|------------|------------|--------------|------------|------------|
| CTR-001        | 1500.00    | 2024-12-31 | Jean Dupont  | 12345678   | 87654321   |
| CTR-002        | 2000.00    | 2025-06-15 | Marie Martin | 23456789   | 98765432   |

Note: La première ligne doit contenir les en-têtes. Les colonnes NUM_TEL et NUM_TEL_2 sont optionnelles.`}
          </pre>
        </div>

        {/* Liste des contrats XLSX existants */}
        {existingContracts.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Contrats XLSX en mémoire ({existingContracts.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Numéro
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prime (DT)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Échéance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assuré
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      NUM_TEL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      NUM_TEL_2
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {existingContracts.map((contract, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {contract.contractNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(contract.premium ?? 0).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {contract.maturity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {contract.insured}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {contract.numTel || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {contract.numTel2 || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default XLSXUploader;