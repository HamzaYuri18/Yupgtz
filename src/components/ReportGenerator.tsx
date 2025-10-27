import React, { useState, useEffect } from 'react';
import { BarChart3, Download, Calendar, DollarSign, FileText, Users, Trash2, Banknote, CreditCard, Landmark } from 'lucide-react';
import { getContracts, exportToXLSX } from '../utils/storage';
import { Contract } from '../types';
import { getAffaireContracts, getRapportContracts, getTermeContracts, deleteRapportContract, deleteAffaireContract, deleteTermeContract, getFilteredDataForExport } from '../utils/supabaseService';
import { getSessionDate } from '../utils/auth';

const ReportGenerator: React.FC = () => {
  const [rapportContracts, setRapportContracts] = useState<any[]>([]);
  const [sessionRapportContracts, setSessionRapportContracts] = useState<any[]>([]);
  const [localContracts, setLocalContracts] = useState<Contract[]>([]);
  const [affaireContracts, setAffaireContracts] = useState<any[]>([]);
  const [sessionAffaireContracts, setSessionAffaireContracts] = useState<any[]>([]);
  const [termeContracts, setTermeContracts] = useState<any[]>([]);
  const [sessionTermeContracts, setSessionTermeContracts] = useState<any[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    type: 'all',
    branch: 'all',
    paymentMode: 'all',
    dateFrom: '',
    dateTo: '',
    createdBy: 'all'
  });
  const [showSessionData, setShowSessionData] = useState(true);

  useEffect(() => {
    const localData = getContracts();
    setLocalContracts(localData);
    loadRapportContracts();
    loadAffaireContracts();
    loadTermeContracts();
  }, []);

  const loadRapportContracts = async () => {
    try {
      console.log('🔄 Chargement des contrats rapport...');
      const rapportData = await getRapportContracts();
      console.log('📊 Données rapport reçues:', rapportData.length, 'contrats');
      console.log('🔍 Premier contrat:', rapportData[0]);
      setRapportContracts(rapportData);
      
      // Filtrer les données de session par défaut
      const sessionDate = getSessionDate();
      const sessionData = rapportData.filter(contract => {
        const contractDate = new Date(contract.created_at).toISOString().split('T')[0];
        return contractDate === sessionDate;
      });
      
      setSessionRapportContracts(sessionData);
      setFilteredContracts(showSessionData ? sessionData : rapportData);
    } catch (error) {
      console.error('❌ Erreur lors du chargement des contrats rapport:', error);
    }
  };

  const loadAffaireContracts = async () => {
    try {
      const affaires = await getAffaireContracts();
      setAffaireContracts(affaires);
      
      // Filtrer les données de session
      const sessionDate = getSessionDate();
      const sessionAffaires = affaires.filter(contract => {
        const contractDate = new Date(contract.created_at).toISOString().split('T')[0];
        return contractDate === sessionDate;
      });
      setSessionAffaireContracts(sessionAffaires);
      
      console.log('Contrats Affaire chargés:', affaires.length);
    } catch (error) {
      console.error('Erreur lors du chargement des contrats Affaire:', error);
    }
  };

  const loadTermeContracts = async () => {
    try {
      const termes = await getTermeContracts();
      setTermeContracts(termes);
      
      // Filtrer les données de session
      const sessionDate = getSessionDate();
      const sessionTermes = termes.filter(contract => {
        const contractDate = new Date(contract.created_at).toISOString().split('T')[0];
        return contractDate === sessionDate;
      });
      setSessionTermeContracts(sessionTermes);
      
      console.log('Contrats Terme chargés:', termes.length);
    } catch (error) {
      console.error('Erreur lors du chargement des contrats Terme:', error);
    }
  };

  useEffect(() => {
    applyFilters();
  }, [filters, rapportContracts, sessionRapportContracts, showSessionData]);

  const applyFilters = () => {
    const sourceData = showSessionData ? sessionRapportContracts : rapportContracts;
    let filtered = sourceData.filter(contract => {
      const contractDate = new Date(contract.created_at);
      const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : new Date('1900-01-01');
      const toDate = filters.dateTo ? new Date(filters.dateTo) : new Date('2100-12-31');
      
      return (
        (filters.type === 'all' || contract.type === filters.type) &&
        (filters.branch === 'all' || contract.branche === filters.branch) &&
        (filters.paymentMode === 'all' || contract.mode_paiement === filters.paymentMode) &&
        (filters.createdBy === 'all' || contract.cree_par === filters.createdBy) &&
        contractDate >= fromDate && contractDate <= toDate
      );
    });
    
    console.log('🔍 Filtres appliqués:', filters, 'Session:', showSessionData);
    console.log('📊 Contrats filtrés:', filtered.length, 'sur', sourceData.length);
    setFilteredContracts(filtered);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const calculateStats = () => {
    const totalContracts = filteredContracts.length;
    const totalPremium = filteredContracts.reduce((sum, contract) => sum + (contract.prime || 0), 0);
    const totalMontant = filteredContracts.reduce((sum, contract) => sum + (contract.montant || 0), 0);
    const avgPremium = totalContracts > 0 ? totalPremium / totalContracts : 0;
    
    const totalEspeces = filteredContracts
      .filter(contract => contract.mode_paiement === 'Espece')
      .reduce((sum, contract) => sum + (contract.montant || 0), 0);

    const totalCheque = filteredContracts
      .filter(contract => contract.mode_paiement === 'Cheque')
      .reduce((sum, contract) => sum + (contract.montant || 0), 0);

    const totalBanque = filteredContracts
      .filter(contract => contract.mode_paiement === 'Banque' || contract.mode_paiement === 'Carte Bancaire')
      .reduce((sum, contract) => sum + (contract.montant || 0), 0);

    const byType = filteredContracts.reduce((acc, contract) => {
      acc[contract.type] = (acc[contract.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const byBranch = filteredContracts.reduce((acc, contract) => {
      acc[contract.branche] = (acc[contract.branche] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const byPaymentMode = filteredContracts.reduce((acc, contract) => {
      acc[contract.mode_paiement] = (acc[contract.mode_paiement] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalContracts,
      totalPremium,
      totalMontant,
      avgPremium,
      totalEspeces,
      totalCheque,
      totalBanque,
      byType,
      byBranch,
      byPaymentMode
    };
  };

  const exportToExcel = async () => {
    // Vérifier que les filtres sont remplis
    if (!filters.type || filters.type === 'all') {
      alert('Veuillez sélectionner un type avant d\'exporter');
      return;
    }

    if (!filters.dateFrom) {
      alert('Veuillez sélectionner une date de début');
      return;
    }

    if (!filters.dateTo) {
      alert('Veuillez sélectionner une date de fin');
      return;
    }

    try {
      let filteredData = [];

      // Si le type est "Rapport", exporter directement toutes les données de la table rapport
      if (filters.type === 'Rapport') {
        // Récupérer toutes les données de la table rapport dans la plage de dates
        filteredData = await getFilteredDataForExport(
          'all', // Tous les types pour obtenir toute la table rapport
          filters.dateFrom,
          filters.dateTo
        );
      } else {
        // Récupérer les données filtrées par type spécifique
        filteredData = await getFilteredDataForExport(
          filters.type,
          filters.dateFrom,
          filters.dateTo
        );
      }

      if (filteredData.length === 0) {
        alert('Aucune donnée à exporter avec les filtres sélectionnés');
        return;
      }

      // Convertir les données rapport au format attendu par exportToXLSX
      const contractsForExport = filteredData.map(contract => ({
        id: contract.id.toString(),
        type: contract.type,
        branch: contract.branche,
        contractNumber: contract.numero_contrat,
        premiumAmount: contract.prime,
        insuredName: contract.assure,
        paymentMode: contract.mode_paiement,
        paymentType: contract.type_paiement,
        creditAmount: contract.montant_credit,
        paymentDate: contract.date_paiement_prevue,
        createdBy: contract.cree_par,
        createdAt: new Date(contract.created_at).getTime()
      }));

      const filename = `rapport_${filters.type}_${filters.dateFrom}_${filters.dateTo}.xlsx`;
      exportToXLSX(contractsForExport, filename);
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      alert('Erreur lors de l\'export des données');
    }
  };

  const handleDeleteRapport = async (id: number, numeroContrat: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce contrat du rapport et des tables liées ?')) {
      return;
    }

    const success = await deleteRapportContract(id, numeroContrat);
    if (success) {
      loadRapportContracts();
      loadAffaireContracts();
      loadTermeContracts();
    } else {
      alert('Erreur lors de la suppression du contrat');
    }
  };

  const handleDeleteAffaire = async (id: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce contrat Affaire et du rapport ?')) {
      return;
    }

    const success = await deleteAffaireContract(id);
    if (success) {
      loadAffaireContracts();
      loadRapportContracts();
    } else {
      alert('Erreur lors de la suppression du contrat');
    }
  };

  const handleDeleteTerme = async (id: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce contrat Terme et du rapport ?')) {
      return;
    }

    const success = await deleteTermeContract(id);
    if (success) {
      loadTermeContracts();
      loadRapportContracts();
    } else {
      alert('Erreur lors de la suppression du contrat');
    }
  };

  const stats = calculateStats();
  const uniqueUsers = [...new Set(rapportContracts.map(c => c.cree_par))];
  const sessionDate = getSessionDate();

  const formatCurrency = (amount: number) => {
    return `${new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }).format(amount)} DT`;
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Rapports et Statistiques {showSessionData && `- Session du ${new Date(sessionDate).toLocaleDateString('fr-FR')}`}
            </h2>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowSessionData(!showSessionData)}
              className={`py-2 px-4 rounded-lg font-semibold transition-colors duration-200 ${
                showSessionData
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              {showSessionData ? 'Voir toutes les données' : 'Voir session actuelle'}
            </button>
            <button
              onClick={exportToExcel}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Exporter XLSX</span>
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtres</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <select
              name="type"
              value={filters.type}
              onChange={handleFilterChange}
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tous les types</option>
              <option value="Terme">Terme</option>
              <option value="Affaire">Affaire</option>
              <option value="Credit">Credit</option>
              <option value="Rapport">Rapport</option>
              <option value="Dépense">Dépense</option>
              <option value="Recette Exceptionnelle">Recette Exceptionnelle</option>
              <option value="Ristourne">Ristourne</option>
              <option value="Sinistre">Sinistre</option>
              <option value="Paiement Crédit">Paiement Crédit</option>
            </select>

            <select
              name="branch"
              value={filters.branch}
              onChange={handleFilterChange}
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Toutes les branches</option>
              <option value="Auto">Auto</option>
              <option value="Vie">Vie</option>
              <option value="Santé">Santé</option>
              <option value="IRDS">IRDS</option>
              <option value="Financier">Financier</option>
            </select>

            <select
              name="paymentMode"
              value={filters.paymentMode}
              onChange={handleFilterChange}
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tous les modes</option>
              <option value="Espece">Espèce</option>
              <option value="Cheque">Chèque</option>
              <option value="Carte Bancaire">Carte Bancaire</option>
              <option value="Banque">Banque</option>
            </select>

            <select
              name="createdBy"
              value={filters.createdBy}
              onChange={handleFilterChange}
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tous les utilisateurs</option>
              {uniqueUsers.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>

            <input
              type="date"
              name="dateFrom"
              value={filters.dateFrom}
              onChange={handleFilterChange}
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <input
              type="date"
              name="dateTo"
              value={filters.dateTo}
              onChange={handleFilterChange}
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Statistiques générales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-blue-50 rounded-lg p-6">
            <div className="flex items-center space-x-3">
              <FileText className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-600">Total Contrats</p>
                <p className="text-2xl font-bold text-blue-900">{stats.totalContracts}</p>
                <p className="text-xs text-blue-600">{showSessionData ? 'Session actuelle' : 'Toutes données'}</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-6">
            <div className="flex items-center space-x-3">
              <DollarSign className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-600">Prime Totale</p>
                <p className="text-2xl font-bold text-green-900">
                  {formatCurrency(stats.totalPremium)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 rounded-lg p-6">
            <div className="flex items-center space-x-3">
              <DollarSign className="w-8 h-8 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-emerald-600">Total Montant</p>
                <p className={`text-2xl font-bold ${stats.totalMontant >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>
                  {formatCurrency(stats.totalMontant)}
                </p>
                <p className="text-xs text-emerald-600">
                  {stats.totalMontant >= 0 ? 'Résultat positif' : 'Résultat négatif'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-6">
            <div className="flex items-center space-x-3">
              <BarChart3 className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-purple-600">Prime Moyenne</p>
                <p className="text-2xl font-bold text-purple-900">
                  {formatCurrency(stats.avgPremium)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-6">
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-orange-600">Utilisateurs</p>
                <p className="text-2xl font-bold text-orange-900">{uniqueUsers.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Nouveaux totaux de paiement */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-indigo-50 rounded-lg p-6">
            <div className="flex items-center space-x-3">
              <Banknote className="w-8 h-8 text-indigo-600" />
              <div>
                <p className="text-sm font-medium text-indigo-600">Total Espèces</p>
                <p className="text-2xl font-bold text-indigo-900">
                  {formatCurrency(stats.totalEspeces)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-teal-50 rounded-lg p-6">
            <div className="flex items-center space-x-3">
              <CreditCard className="w-8 h-8 text-teal-600" />
              <div>
                <p className="text-sm font-medium text-teal-600">Total Chèque</p>
                <p className="text-2xl font-bold text-teal-900">
                  {formatCurrency(stats.totalCheque)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-cyan-50 rounded-lg p-6">
            <div className="flex items-center space-x-3">
              <Landmark className="w-8 h-8 text-cyan-600" />
              <div>
                <p className="text-sm font-medium text-cyan-600">Total Banque</p>
                <p className="text-2xl font-bold text-cyan-900">
                  {formatCurrency(stats.totalBanque)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Graphiques et répartitions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Répartition par Type */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Par Type</h3>
            <div className="space-y-3">
              {Object.entries(stats.byType).map(([type, count]) => (
                <div key={type} className="flex justify-between items-center">
                  <span className="text-gray-700">{type}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${(count / stats.totalContracts) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Répartition par Branche */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Par Branche</h3>
            <div className="space-y-3">
              {Object.entries(stats.byBranch).map(([branch, count]) => (
                <div key={branch} className="flex justify-between items-center">
                  <span className="text-gray-700">{branch}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2"> {/* Added missing div wrapper */}
                      <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${(count / stats.totalContracts) * 100}%` }}
                        ></div>
                    </div> {/* Closed the div */}
                    <span className="text-sm font-medium text-gray-900 w-8">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Répartition par Mode de Paiement */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Par Mode de Paiement</h3>
            <div className="space-y-3">
              {Object.entries(stats.byPaymentMode).map(([mode, count]) => (
                <div key={mode} className="flex justify-between items-center">
                  <span className="text-gray-700">{mode}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${(count / stats.totalContracts) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section Contrats Terme de la session */}
        {showSessionData && sessionTermeContracts.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Contrats Terme - Session actuelle ({sessionTermeContracts.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                      Numéro
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                      Branche
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                      Assuré
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                      Prime (DT)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                      Échéance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                      Date Paiement
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sessionTermeContracts.map((contract) => (
                    <tr key={contract.id} className="hover:bg-blue-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {contract.numero_contrat}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {contract.branche}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {contract.assure}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(contract.prime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(contract.echeance).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(contract.date_paiement).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <button
                          onClick={() => handleDeleteTerme(contract.id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section Contrats Affaire depuis Supabase */}
        {(showSessionData ? sessionAffaireContracts : affaireContracts).length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Contrats Affaire {showSessionData ? '- Session actuelle' : '(Toutes données)'} - {(showSessionData ? sessionAffaireContracts : affaireContracts).length}
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-green-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">
                      Numéro
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">
                      Branche
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">
                      Assuré
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">
                      Prime (DT)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">
                      Paiement
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">
                      Créé par
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(showSessionData ? sessionAffaireContracts : affaireContracts).map((contract) => (
                    <tr key={contract.id} className="hover:bg-green-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {contract.numero_contrat}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {contract.branche}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {contract.assure}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(contract.prime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div>{contract.mode_paiement}</div>
                          <div className="text-xs text-gray-500">{contract.type_paiement}</div>
                          {contract.montant_credit && (
                            <div className="text-xs text-orange-600">
                              Crédit: {formatCurrency(contract.montant_credit)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {contract.cree_par}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(contract.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <button
                          onClick={() => handleDeleteAffaire(contract.id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Liste des contrats */}
        <div className="overflow-x-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Table Rapport {showSessionData ? '- Session actuelle' : '- Toutes données'} ({filteredContracts.length} contrats)
          </h3>
          
          {/* Debug info */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm">
            <p><strong>Debug:</strong> Contrats rapport: {showSessionData ? sessionRapportContracts.length : rapportContracts.length}, Filtrés: {filteredContracts.length}</p>
            {rapportContracts.length === 0 && (
              <p className="text-red-600">⚠️ Aucun contrat dans la table rapport. Vérifiez que des contrats ont été sauvegardés.</p>
            )}
          </div>
          
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Numéro
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Branche
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assuré
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prime (DT)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant (DT)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mode Paiement
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type Paiement
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant Crédit (DT)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Paiement Prévue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Échéance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Créé par
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredContracts.map((contract) => (
                <tr key={contract.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {contract.numero_contrat}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      contract.type === 'Terme' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {contract.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contract.branche}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contract.assure}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(contract.prime || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`font-semibold ${(contract.montant || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(contract.montant || 0)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contract.mode_paiement}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      contract.type_paiement === 'Au comptant'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {contract.type_paiement}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contract.montant_credit ? (
                      <span className="font-semibold text-orange-600">
                        {formatCurrency(contract.montant_credit)}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contract.date_paiement_prevue ? (
                      new Date(contract.date_paiement_prevue).toLocaleDateString('fr-FR')
                    ) : (
                      <span className="text-gray-400 italic">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contract.echeance ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {new Date(contract.echeance).toLocaleDateString('fr-FR')}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contract.cree_par}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(contract.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <button
                      onClick={() => handleDeleteRapport(contract.id, contract.numero_contrat)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredContracts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Aucun contrat trouvé avec les filtres sélectionnés
            </div>
          )}
        </div>

        {/* Section pour les contrats locaux (optionnel) */}
        {localContracts.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Contrats locaux (stockage navigateur) - {localContracts.length}
            </h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm">
                Ces contrats sont stockés localement dans le navigateur. 
                Ils devraient maintenant être sauvegardés dans la table rapport.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportGenerator;
