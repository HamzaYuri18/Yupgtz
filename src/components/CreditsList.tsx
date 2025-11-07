import React, { useState, useEffect } from 'react';
import { CreditCard, Filter, Calendar, CheckCircle, XCircle, Clock, TrendingUp, AlertTriangle, DollarSign, User, Download } from 'lucide-react';
import { getCredits, updateCreditStatus } from '../utils/supabaseService';
import { getSession } from '../utils/auth';

// Import direct de la bibliothèque xlsx
import * as XLSX from 'xlsx';

const CreditsList: React.FC = () => {
  const [credits, setCredits] = useState<any[]>([]);
  const [filteredCredits, setFilteredCredits] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    statut: 'all',
    branche: 'all',
    createdBy: 'all',
    dateFrom: '',
    dateTo: '',
    mois: new Date().toISOString().slice(0, 7)
  });
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'mois' | 'tous'>('mois');
  const [activeFilter, setActiveFilter] = useState<'none' | 'echeances' | 'retard'>('none');
  const [isExporting, setIsExporting] = useState(false);
  
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const isHamza = currentUser === 'Hamza';

  useEffect(() => {
    const session = getSession();
    if (session && session.username) {
      setCurrentUser(session.username);
    }
    loadCredits();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, credits, viewMode, activeFilter]);

  const loadCredits = async () => {
    try {
      setIsLoading(true);
      const data = await getCredits();
      const formattedData = data.map(credit => ({
        id: credit.id,
        numero_contrat: credit.numero_contrat,
        assure: credit.assure,
        branche: credit.branche,
        prime: credit.prime || 0,
        montant_credit: credit.montant_credit || 0,
        paiement: credit.paiement || 0,
        solde: credit.solde || 0,
        date_paiement_prevue: credit.date_paiement_prevue,
        date_paiement_effectif: credit.date_paiement_effectif,
        statut: credit.statut || 'Non payé',
        cree_par: credit.cree_par || 'Utilisateur',
        date_credit: credit.created_at,
        created_at: credit.created_at,
        updated_at: credit.updated_at
      }));
      setCredits(formattedData);
    } catch (error) {
      console.error('Erreur lors du chargement des crédits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction corrigée pour exporter les données en XLSX
  const exportToExcel = () => {
    if (filteredCredits.length === 0) {
      alert('Aucune donnée à exporter.');
      return;
    }

    try {
      setIsExporting(true);
      
      // Préparer les données pour l'export
      const exportData = filteredCredits.map(credit => ({
        'Numéro Contrat': credit.numero_contrat || '',
        'Assuré': credit.assure || '',
        'Branche': credit.branche || '',
        'Prime (DT)': credit.prime || 0,
        'Montant Crédit (DT)': credit.montant_credit || 0,
        'Paiement (DT)': credit.paiement || 0,
        'Solde (DT)': credit.solde || 0,
        'Date Crédit': credit.date_credit ? new Date(credit.date_credit).toLocaleDateString('fr-FR') : '-',
        'Date Paiement Prévue': credit.date_paiement_prevue ? new Date(credit.date_paiement_prevue).toLocaleDateString('fr-FR') : '-',
        'Statut': credit.statut || '',
        'Date Paiement Effectif': credit.date_paiement_effectif ? new Date(credit.date_paiement_effectif).toLocaleDateString('fr-FR') : '-',
        'Créé par': credit.cree_par || ''
      }));

      // Créer un nouveau workbook
      const workbook = XLSX.utils.book_new();
      
      // Créer une worksheet à partir des données
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // Ajuster la largeur des colonnes
      const colWidths = [
        { wch: 15 }, // Numéro Contrat
        { wch: 20 }, // Assuré
        { wch: 10 }, // Branche
        { wch: 12 }, // Prime
        { wch: 15 }, // Montant Crédit
        { wch: 12 }, // Paiement
        { wch: 12 }, // Solde
        { wch: 12 }, // Date Crédit
        { wch: 18 }, // Date Paiement Prévue
        { wch: 15 }, // Statut
        { wch: 18 }, // Date Paiement Effectif
        { wch: 15 }  // Créé par
      ];
      worksheet['!cols'] = colWidths;

      // Ajouter la worksheet au workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Credits');

      // Générer le nom du fichier
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      let fileName = '';
      
      if (activeFilter === 'echeances') {
        fileName = `Credits_Echeances_7_Jours_${date}.xlsx`;
      } else if (activeFilter === 'retard') {
        fileName = `Credits_En_Retard_${date}.xlsx`;
      } else if (viewMode === 'mois') {
        const monthName = getMonthName(filters.mois).replace(' ', '_');
        fileName = `Credits_${monthName}_${date}.xlsx`;
      } else {
        fileName = `Tous_Les_Credits_${date}.xlsx`;
      }

      // Exporter le fichier
      XLSX.writeFile(workbook, fileName);
      
      console.log(`Export réussi: ${fileName}, ${exportData.length} enregistrements`);
      
    } catch (error) {
      console.error('Erreur lors de l\'exportation:', error);
      alert('Erreur lors de l\'exportation. Voir la console pour plus de détails.');
    } finally {
      setIsExporting(false);
    }
  };

  // Version alternative plus simple de l'exportation
  const exportToExcelSimple = () => {
    if (filteredCredits.length === 0) {
      alert('Aucune donnée à exporter.');
      return;
    }

    try {
      setIsExporting(true);
      
      // Données simplifiées pour le test
      const exportData = filteredCredits.map(credit => ({
        'Contrat': credit.numero_contrat,
        'Assuré': credit.assure,
        'Branche': credit.branche,
        'Montant': credit.montant_credit,
        'Statut': credit.statut
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Credits');
      XLSX.writeFile(wb, 'test_export_credits.xlsx');
      
      console.log('Export simple réussi');
      
    } catch (error) {
      console.error('Erreur export simple:', error);
      alert('Erreur export: ' + error);
    } finally {
      setIsExporting(false);
    }
  };

  const getCreditsByMonth = (month: string) => {
    const [year, monthNum] = month.split('-').map(Number);
    return credits.filter(credit => {
      if (!credit.date_credit) return false;
      const creditDate = new Date(credit.date_credit);
      return creditDate.getFullYear() === year && creditDate.getMonth() + 1 === monthNum;
    });
  };

  const getCreditsDueIn7Days = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    return credits.filter(credit => {
      if (!credit.date_paiement_prevue || credit.statut === 'Payé' || credit.statut === 'Payé en total') return false;

      const dueDate = new Date(credit.date_paiement_prevue);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= today && dueDate <= nextWeek;
    });
  };

  const getOverdueCredits = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return credits.filter(credit => {
      if (!credit.date_paiement_prevue || credit.statut === 'Payé' || credit.statut === 'Payé en total') return false;

      const dueDate = new Date(credit.date_paiement_prevue);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    });
  };

  const applyFilters = () => {
    let filtered = viewMode === 'mois' 
      ? getCreditsByMonth(filters.mois)
      : credits;

    if (activeFilter === 'echeances') {
      filtered = getCreditsDueIn7Days();
    } else if (activeFilter === 'retard') {
      filtered = getOverdueCredits();
    } else {
      filtered = filtered.filter(credit => {
        const creditDate = credit.date_credit ? new Date(credit.date_credit) : new Date();
        const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : new Date('1900-01-01');
        const toDate = filters.dateTo ? new Date(filters.dateTo) : new Date('2100-12-31');
        
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        creditDate.setHours(0, 0, 0, 0);
        
        return (
          (filters.statut === 'all' || credit.statut === filters.statut) &&
          (filters.branche === 'all' || credit.branche === filters.branche) &&
          (filters.createdBy === 'all' || credit.cree_par === filters.createdBy) &&
          creditDate >= fromDate && creditDate <= toDate
        );
      });
    }
    
    setFilteredCredits(filtered);
  };

  // ... (le reste des fonctions reste inchangé)

  const getMonthName = (monthString: string) => {
    const [year, month] = monthString.split('-').map(Number);
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2">Chargement des crédits...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* En-tête avec informations utilisateur */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <CreditCard className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              {activeFilter === 'echeances' 
                ? 'Échéances dans 7 jours' 
                : activeFilter === 'retard' 
                ? 'Crédits en Retard' 
                : viewMode === 'mois' 
                ? `Crédits du ${getMonthName(filters.mois)}` 
                : 'Tous les Crédits'}
            </h2>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
              activeFilter === 'echeances' 
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                : activeFilter === 'retard'
                ? 'bg-red-100 text-red-800 border border-red-300'
                : 'bg-blue-100 text-blue-800 border border-blue-300'
            }`}>
              {activeFilter === 'echeances' 
                ? `${filteredCredits.length} échéances` 
                : activeFilter === 'retard'
                ? `${filteredCredits.length} en retard`
                : viewMode === 'mois' 
                ? `${filteredCredits.length} crédits ce mois` 
                : `${filteredCredits.length} crédits au total`}
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-gray-100 rounded-lg px-3 py-2">
              <User className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                Connecté en tant que: <span className="text-blue-600">{currentUser || 'Non connecté'}</span>
              </span>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => handleViewModeChange('mois')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'mois' && activeFilter === 'none'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Vue Mensuelle
              </button>
              <button
                onClick={() => handleViewModeChange('tous')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'tous' && activeFilter === 'none'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Tous les Crédits
              </button>
              {(activeFilter === 'echeances' || activeFilter === 'retard') && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Effacer Filtres
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bouton d'exportation */}
        <div className="flex justify-between items-center mb-4">
          <div>
            {(activeFilter === 'echeances' || activeFilter === 'retard') && (
              <div className={`text-sm font-medium ${
                activeFilter === 'echeances' ? 'text-yellow-700' : 'text-red-700'
              }`}>
                Filtre actif: {activeFilter === 'echeances' ? 'Échéances 7 jours' : 'Crédits en retard'}
              </div>
            )}
          </div>
          
          <div className="flex space-x-2">
            {/* Bouton de test simple */}
            <button
              onClick={exportToExcelSimple}
              disabled={filteredCredits.length === 0 || isExporting}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                filteredCredits.length === 0 || isExporting
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Export Simple (Test)</span>
            </button>
            
            {/* Bouton d'exportation complet */}
            <button
              onClick={exportToExcel}
              disabled={filteredCredits.length === 0 || isExporting}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                filteredCredits.length === 0 || isExporting
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Export...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Export Complet</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ... (le reste du code reste inchangé) */}

        {/* Liste des crédits */}
        <div id="credits-table" className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Numéro Contrat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assuré
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Branche
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prime (DT)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant Crédit (DT)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paiement (DT)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Solde (DT)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Crédit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Paiement Prévue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Paiement Effectif
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Créé par
                </th>
                {isHamza && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCredits.map((credit) => (
                <tr key={credit.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {credit.numero_contrat}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {credit.assure}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {credit.branche}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {(credit.prime || 0).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    {(credit.montant_credit || 0).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {(credit.paiement || 0).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`font-semibold ${
                      (credit.solde || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {(credit.solde || 0).toLocaleString('fr-FR')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {credit.date_credit ? new Date(credit.date_credit).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {credit.date_paiement_prevue ? new Date(credit.date_paiement_prevue).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(credit.statut)}
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(credit.statut)}`}>
                        {credit.statut}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {credit.date_paiement_effectif ? new Date(credit.date_paiement_effectif).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {credit.cree_par}
                  </td>
                  {isHamza && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {credit.statut !== 'Payé' && (
                          <button
                            onClick={() => handleStatusUpdate(credit.id, 'Payé')}
                            className="text-green-600 hover:text-green-900 transition-colors duration-200"
                            title="Marquer comme payé"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {credit.statut === 'Non payé' && (
                          <button
                            onClick={() => handleStatusUpdate(credit.id, 'En retard')}
                            className="text-red-600 hover:text-red-900 transition-colors duration-200"
                            title="Marquer en retard"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredCredits.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {activeFilter === 'echeances' 
                ? 'Aucun crédit avec échéance dans les 7 prochains jours' 
                : activeFilter === 'retard'
                ? 'Aucun crédit en retard'
                : 'Aucun crédit trouvé avec les filtres sélectionnés'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreditsList;