import React, { useState, useEffect } from 'react';
import { CreditCard, Filter, Calendar, CheckCircle, XCircle, Clock, TrendingUp, AlertTriangle, DollarSign, User } from 'lucide-react';
import { getCredits, updateCreditStatus } from '../utils/supabaseService';
import { getSession } from '../utils/auth';

const CreditsList: React.FC = () => {
  const [credits, setCredits] = useState<any[]>([]);
  const [filteredCredits, setFilteredCredits] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    statut: 'all',
    branche: 'all',
    createdBy: 'all',
    dateFrom: '',
    dateTo: '',
    mois: new Date().toISOString().slice(0, 7) // Format YYYY-MM par défaut (mois actuel)
  });
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'mois' | 'tous'>('mois');
  const [activeFilter, setActiveFilter] = useState<'none' | 'echeances' | 'retard'>('none');
  
  // Récupérer l'utilisateur connecté depuis la session
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const isHamza = currentUser === 'Hamza';

  useEffect(() => {
    // Vérifier la session au chargement du composant
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
      // S'assurer que les données sont bien formatées pour la table Liste_credits
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
        date_credit: credit.created_at, // Utilisation de created_at comme date de crédit
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

    // Appliquer les filtres spéciaux selon activeFilter
    if (activeFilter === 'echeances') {
      filtered = getCreditsDueIn7Days();
    } else if (activeFilter === 'retard') {
      filtered = getOverdueCredits();
    } else {
      // Appliquer les filtres normaux
      filtered = filtered.filter(credit => {
        const creditDate = credit.date_credit ? new Date(credit.date_credit) : new Date();
        const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : new Date('1900-01-01');
        const toDate = filters.dateTo ? new Date(filters.dateTo) : new Date('2100-12-31');
        
        // Gérer les dates pour la comparaison
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

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    // Réinitialiser le filtre actif quand on change les filtres manuels
    setActiveFilter('none');
  };

  const handleStatusUpdate = async (id: number, newStatus: string) => {
    // Vérifier que l'utilisateur est Hamza avant de permettre l'action
    if (!isHamza) {
      alert('Seul Hamza peut modifier le statut des crédits.');
      return;
    }

    const datePaiement = newStatus === 'Payé' ? new Date().toISOString().split('T')[0] : null;
    
    try {
      const success = await updateCreditStatus(id, newStatus, datePaiement);
      if (success) {
        await loadCredits();
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
    }
  };

  const showDueIn7Days = () => {
    setActiveFilter('echeances');
    setViewMode('tous');
    setFilters(prev => ({ 
      ...prev, 
      statut: 'all',
      branche: 'all',
      createdBy: 'all',
      dateFrom: '',
      dateTo: ''
    }));
    // Scroll vers le tableau
    setTimeout(() => {
      document.getElementById('credits-table')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const showOverdueCredits = () => {
    setActiveFilter('retard');
    setViewMode('tous');
    setFilters(prev => ({ 
      ...prev, 
      statut: 'all',
      branche: 'all',
      createdBy: 'all',
      dateFrom: '',
      dateTo: ''
    }));
    // Scroll vers le tableau
    setTimeout(() => {
      document.getElementById('credits-table')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const clearFilters = () => {
    setActiveFilter('none');
    setFilters({
      statut: 'all',
      branche: 'all',
      createdBy: 'all',
      dateFrom: '',
      dateTo: '',
      mois: new Date().toISOString().slice(0, 7)
    });
  };

  const calculateDetailedStats = () => {
    // IMPORTANT: Utiliser TOUS les crédits pour les statistiques globales
    // mais filtrer pour l'affichage du tableau
    const creditsForStats = viewMode === 'mois'
      ? getCreditsByMonth(filters.mois)
      : credits;

    const creditsDueIn7Days = getCreditsDueIn7Days();
    const overdueCredits = getOverdueCredits();

    const totalCredits = creditsForStats.length;
    const totalMontant = creditsForStats.reduce((sum, credit) => sum + (credit.montant_credit || 0), 0);

    // Inclure tous les statuts payés (Payé, Payé partiellement, Payé en total)
    const payes = creditsForStats.filter(c =>
      c.statut === 'Payé' || c.statut === 'Payé partiellement' || c.statut === 'Payé en total'
    );
    const nonPayes = creditsForStats.filter(c => c.statut === 'Non payé');
    const enRetard = creditsForStats.filter(c => c.statut === 'En retard');

    // Calculer le montant payé en additionnant tous les paiements effectués
    const montantPaye = creditsForStats.reduce((sum, credit) => sum + (credit.paiement || 0), 0);

    // Calculer le montant non payé en additionnant tous les soldes restants
    const montantNonPaye = creditsForStats
      .filter(c => c.statut !== 'Payé en total')
      .reduce((sum, credit) => sum + (credit.solde || 0), 0);

    const montantEnRetard = enRetard.reduce((sum, credit) => sum + (credit.solde || 0), 0);

    const tauxRecouvrement = totalMontant > 0 ? (montantPaye / totalMontant) * 100 : 0;

    return {
      totalCredits,
      totalMontant,
      payes: payes.length,
      nonPayes: nonPayes.length,
      enRetard: enRetard.length,
      montantPaye,
      montantNonPaye,
      montantEnRetard,
      tauxRecouvrement,
      creditsDueIn7Days: creditsDueIn7Days.length,
      montantDueIn7Days: creditsDueIn7Days.reduce((sum, credit) => sum + (credit.montant_credit || 0), 0),
      overdueCredits: overdueCredits.length,
      montantOverdue: overdueCredits.reduce((sum, credit) => sum + (credit.montant_credit || 0), 0)
    };
  };

  const getStatusIcon = (statut: string) => {
    switch (statut) {
      case 'Payé':
      case 'Payé en total':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'Payé partiellement':
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
      case 'En retard':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-orange-500" />;
    }
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'Payé':
      case 'Payé en total':
        return 'bg-green-100 text-green-800';
      case 'Payé partiellement':
        return 'bg-blue-100 text-blue-800';
      case 'En retard':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-orange-100 text-orange-800';
    }
  };

  const handleViewModeChange = (mode: 'mois' | 'tous') => {
    setViewMode(mode);
    setActiveFilter('none'); // Réinitialiser le filtre actif quand on change de mode
    // Réinitialiser certains filtres quand on change de mode
    if (mode === 'tous') {
      setFilters(prev => ({
        ...prev,
        mois: new Date().toISOString().slice(0, 7) // Garder le mois actuel mais ne pas l'utiliser
      }));
    }
  };

  const stats = calculateDetailedStats();
  const uniqueUsers = [...new Set(credits.map(c => c.cree_par).filter(Boolean))];
  const uniqueMonths = [...new Set(credits
    .map(c => c.date_credit ? c.date_credit.slice(0, 7) : null)
    .filter(Boolean)
  )].sort().reverse();

  // Obtenir le nom du mois en français
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
            {/* Indicateur utilisateur */}
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

        {/* Bannière d'information pour les permissions */}
        {!isHamza && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <p className="text-blue-700 text-sm">
                <strong>Mode consultation uniquement :</strong> Seul Hamza peut modifier le statut des crédits.
              </p>
            </div>
          </div>
        )}

        {/* Indicateur mode édition pour Hamza */}
        {isHamza && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-green-700 text-sm font-medium">
                <strong>Mode édition activé :</strong> Vous pouvez modifier les statuts des crédits.
              </p>
            </div>
          </div>
        )}

        {/* Statistiques Détaillées */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">
                  {viewMode === 'mois' ? 'Crédits du Mois' : 'Total Crédits'}
                </p>
                <p className="text-xl font-bold text-blue-900">{stats.totalCredits}</p>
                <p className="text-sm text-blue-700">{stats.totalMontant.toLocaleString('fr-FR')} DT</p>
              </div>
              <CreditCard className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Montant Payé</p>
                <p className="text-xl font-bold text-green-900">{stats.montantPaye.toLocaleString('fr-FR')} DT</p>
                <p className="text-sm text-green-700">{stats.payes} crédits</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Montant Non Payé</p>
                <p className="text-xl font-bold text-orange-900">{stats.montantNonPaye.toLocaleString('fr-FR')} DT</p>
                <p className="text-sm text-orange-700">{stats.nonPayes} crédits</p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </div>

          <div 
            className={`rounded-lg p-4 cursor-pointer transition-colors ${
              activeFilter === 'echeances' 
                ? 'bg-yellow-100 border-2 border-yellow-400' 
                : 'bg-purple-50 hover:bg-purple-100'
            }`}
            onClick={showDueIn7Days}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Échéances 7 jours</p>
                <p className="text-xl font-bold text-purple-900">{stats.montantDueIn7Days.toLocaleString('fr-FR')} DT</p>
                <p className="text-sm text-purple-700">{stats.creditsDueIn7Days} crédits</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Taux de Recouvrement et Retards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <TrendingUp className="w-6 h-6 text-cyan-600" />
                <div>
                  <h3 className="text-lg font-semibold text-cyan-900">
                    {viewMode === 'mois' ? 'Taux de Recouvrement Mois' : 'Taux de Recouvrement Global'}
                  </h3>
                  <p className="text-cyan-700">Pourcentage du montant total récupéré</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-cyan-900">{stats.tauxRecouvrement.toFixed(1)}%</p>
                <p className="text-cyan-700">
                  {stats.montantPaye.toLocaleString('fr-FR')} DT / {stats.totalMontant.toLocaleString('fr-FR')} DT
                </p>
              </div>
            </div>
            <div className="mt-3 w-full bg-cyan-200 rounded-full h-2">
              <div 
                className="bg-cyan-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(stats.tauxRecouvrement, 100)}%` }}
              ></div>
            </div>
          </div>

          <div 
            className={`rounded-lg p-4 cursor-pointer transition-colors ${
              activeFilter === 'retard' 
                ? 'bg-red-100 border-2 border-red-400' 
                : 'bg-red-50 hover:bg-red-100'
            }`}
            onClick={showOverdueCredits}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Crédits en Retard</p>
                <p className="text-xl font-bold text-red-900">{stats.montantOverdue.toLocaleString('fr-FR')} DT</p>
                <p className="text-sm text-red-700">{stats.overdueCredits} crédits</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* Filtres (masqués quand un filtre spécial est actif) */}
        {activeFilter === 'none' && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <Filter className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Filtres</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {viewMode === 'mois' && (
                <select
                  name="mois"
                  value={filters.mois}
                  onChange={handleFilterChange}
                  className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {uniqueMonths.map(month => (
                    <option key={month} value={month}>
                      {getMonthName(month)}
                    </option>
                  ))}
                </select>
              )}

              <select
                name="statut"
                value={filters.statut}
                onChange={handleFilterChange}
                className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les statuts</option>
                <option value="Non payé">Non payé</option>
                <option value="Payé">Payé</option>
                <option value="Payé partiellement">Payé partiellement</option>
                <option value="Payé en total">Payé en total</option>
                <option value="En retard">En retard</option>
              </select>

              <select
                name="branche"
                value={filters.branche}
                onChange={handleFilterChange}
                className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Toutes les branches</option>
                <option value="Auto">Auto</option>
                <option value="Vie">Vie</option>
                <option value="Santé">Santé</option>
                <option value="IRDS">IRDS</option>
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
                placeholder="Date début"
              />

              <input
                type="date"
                name="dateTo"
                value={filters.dateTo}
                onChange={handleFilterChange}
                className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Date fin"
              />
            </div>
          </div>
        )}

        {/* Indicateur de filtre actif */}
        {(activeFilter === 'echeances' || activeFilter === 'retard') && (
          <div className={`rounded-lg p-4 mb-6 ${
            activeFilter === 'echeances' ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {activeFilter === 'echeances' ? (
                  <>
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <p className="text-yellow-700 font-medium">
                      Affichage des crédits avec échéance dans les 7 prochains jours
                    </p>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-600" />
                    <p className="text-red-700 font-medium">
                      Affichage des crédits en retard de paiement
                    </p>
                  </>
                )}
              </div>
              <button
                onClick={clearFilters}
                className="text-sm text-gray-600 hover:text-gray-800 underline"
              >
                Effacer le filtre
              </button>
            </div>
          </div>
        )}

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
