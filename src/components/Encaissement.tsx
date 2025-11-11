import React, { useState, useEffect } from 'react';
import { Search, DollarSign, Calendar, FileText, User, CheckCircle, XCircle, AlertCircle, Download, RefreshCw, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

interface EncaissementProps {
  username: string;
}

interface TermeData {
  id: string;
  numero_contrat: string;
  echeance: string;
  prime: number;
  assure: string;
  branche: string;
  date_paiement: string | null;
  cree_par: string;
  created_at: string;
  Retour: string | null;
  "Prime avant retour": string | null;
  statut: string | null;
  Date_Encaissement: string | null;
  "prime NETTE": number | null;
}

interface SessionStats {
  total_encaissements: number;
  total_paiements: number;
  difference: number;
  session_montant: number;
  cumul_sessions: number;
  nombre_contrats_paiements: number;
  nombre_contrats_encaissements: number;
  total_primes_statut_null: number;
  nombre_contrats_statut_null: number;
  total_primes_encaisses: number;
  nombre_contrats_encaisses: number;
  total_paiements_depuis_2510: number;
  total_encaissements_depuis_2510: number;
  deport_cumule: number;
}

interface ContratData {
  numero_contrat: string;
  prime: number;
  assure: string;
  echeance: string;
  date_paiement: string | null;
  Date_Encaissement: string | null;
  statut: string | null;
}

interface RPData {
  session: string;
  paiement: number;
  encaissement: number;
  difference: number;
}

const Encaissement: React.FC<EncaissementProps> = ({ username }) => {
  const [numeroContrat, setNumeroContrat] = useState('');
  const [echeance, setEcheance] = useState('');
  const [termeData, setTermeData] = useState<TermeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'warning'>('success');
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    total_encaissements: 0,
    total_paiements: 0,
    difference: 0,
    session_montant: 0,
    cumul_sessions: 0,
    nombre_contrats_paiements: 0,
    nombre_contrats_encaissements: 0,
    total_primes_statut_null: 0,
    nombre_contrats_statut_null: 0,
    total_primes_encaisses: 0,
    nombre_contrats_encaisses: 0,
    total_paiements_depuis_2510: 0,
    total_encaissements_depuis_2510: 0,
    deport_cumule: -47369.10
  });
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState<string>('');
  const [customSessionDate, setCustomSessionDate] = useState<string>('');
  const [useCustomDate, setUseCustomDate] = useState<boolean>(false);
  const [globalBalance, setGlobalBalance] = useState<number>(0);
  const [rpData, setRpData] = useState<RPData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialisation au chargement du composant
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      await initializeSessionDate();
      await loadAllData();
      setIsLoading(false);
    };
    
    initializeData();
  }, []);

  // Recharger les données quand la session change
  useEffect(() => {
    if (sessionDate || customSessionDate) {
      loadAllData();
    }
  }, [sessionDate, customSessionDate, useCustomDate]);

  const loadAllData = async () => {
    setIsLoading(true);
    await Promise.all([
      loadRPData(),
      loadSessionStats(),
      calculateGlobalBalance()
    ]);
    setIsLoading(false);
  };

  // Fonction pour charger les données de la table RP
  const loadRPData = async () => {
    try {
      const currentSessionDate = useCustomDate ? customSessionDate : sessionDate;
      
      console.log('🔍 CHARGEMENT DONNÉES RP - Date recherchée:', currentSessionDate);

      const { data, error } = await supabase
        .from('rp')
        .select('*')
        .eq('session', currentSessionDate)
        .maybeSingle();

      if (error) {
        console.error('❌ Erreur chargement RP:', error);
        setRpData(null);
        
        // Si pas de données RP, on calcule manuellement depuis la table terme
        await calculateStatsFromTerme(currentSessionDate);
        return;
      }

      if (!data) {
        console.warn('⚠️ Aucune donnée RP trouvée pour la date:', currentSessionDate);
        setRpData(null);
        await calculateStatsFromTerme(currentSessionDate);
        return;
      }

      console.log('✅ Données RP chargées:', data);
      setRpData(data);

      // Mettre à jour les stats avec les données RP
      setSessionStats(prev => ({
        ...prev,
        total_paiements: data.paiement || 0,
        total_encaissements: data.encaissement || 0,
        difference: data.difference || 0,
        session_montant: data.difference || 0
      }));

    } catch (error) {
      console.error('❌ Erreur lors du chargement RP:', error);
      setRpData(null);
    }
  };

  // Fonction de secours pour calculer les stats depuis la table terme si RP est vide
  const calculateStatsFromTerme = async (currentSessionDate: string) => {
    try {
      console.log('🔄 Calcul manuel des stats depuis table terme pour:', currentSessionDate);

      // Paiements de la session (statut null + date_paiement = session)
      const { data: paiementsData } = await supabase
        .from('terme')
        .select('prime')
        .is('statut', null)
        .eq('date_paiement', currentSessionDate);

      // Encaissements de la session (statut Encaissé + Date_Encaissement = session)
      const { data: encaissementsData } = await supabase
        .from('terme')
        .select('prime')
        .eq('statut', 'Encaissé')
        .eq('Date_Encaissement', currentSessionDate);

      const totalPaiements = paiementsData?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;
      const totalEncaissements = encaissementsData?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;
      const difference = totalPaiements - totalEncaissements;

      console.log('📊 Stats calculées manuellement:', {
        totalPaiements,
        totalEncaissements,
        difference
      });

      setSessionStats(prev => ({
        ...prev,
        total_paiements: totalPaiements,
        total_encaissements: totalEncaissements,
        difference: difference,
        session_montant: difference
      }));

    } catch (error) {
      console.error('❌ Erreur calcul manuel stats:', error);
    }
  };

  // Fonction pour initialiser et vérifier la date de session
  const initializeSessionDate = () => {
    const today = new Date();
    const todayISO = formatDateForQuery(today);
    console.log('📅 Initialisation session date:', todayISO);
    setSessionDate(todayISO);
    setCustomSessionDate(todayISO);
  };

  // Fonction pour calculer la balance globale
  const calculateGlobalBalance = async () => {
    try {
      console.log('💰 CALCUL BALANCE GLOBALE');

      // Total des primes des contrats avec statut null (à encaisser)
      const { data: statutNullData } = await supabase
        .from('terme')
        .select('prime')
        .is('statut', null);

      // Total des primes des contrats encaissés
      const { data: encaissesData } = await supabase
        .from('terme')
        .select('prime')
        .eq('statut', 'Encaissé');

      const totalAttente = statutNullData?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;
      const totalEncaisses = encaissesData?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;

      // Balance globale = Total encaissé - Total en attente
      const balance = totalEncaisses - totalAttente;
      console.log('📈 Balance globale calculée:', { totalEncaisses, totalAttente, balance });
      setGlobalBalance(balance);

    } catch (error) {
      console.error('❌ Erreur calcul balance globale:', error);
    }
  };

  // Fonction pour nettoyer le numéro de contrat des espaces
  const cleanContractNumber = (contract: string): string => {
    return contract.replace(/\s+/g, '');
  };

  const searchTerme = async () => {
    const cleanedNumeroContrat = cleanContractNumber(numeroContrat);
    
    if (!cleanedNumeroContrat || !echeance) {
      setMessage('Veuillez saisir le numéro de contrat et l\'échéance');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');
    setTermeData(null);

    try {
      console.log('🔍 Recherche terme:', { cleanedNumeroContrat, echeance });

      const { data, error } = await supabase
        .from('terme')
        .select('*')
        .eq('numero_contrat', cleanedNumeroContrat)
        .eq('echeance', echeance)
        .maybeSingle();

      if (error) {
        console.error('❌ Erreur recherche terme:', error);
        setMessage('Erreur lors de la recherche dans la base de données');
        setMessageType('error');
        return;
      }

      if (!data) {
        setMessage('Ce terme n\'est pas payé. Impossible de l\'encaisser !!!');
        setMessageType('error');
        return;
      }

      console.log('✅ Données trouvées:', data);
      setTermeData(data);
      setMessage('');

    } catch (error) {
      console.error('❌ Erreur lors de la recherche:', error);
      setMessage('Erreur lors de la recherche');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const enregistrerEncaissement = async () => {
    if (!termeData) {
      setMessage('Aucune donnée terme à enregistrer');
      setMessageType('error');
      return;
    }

    // Vérifier si déjà encaissé
    if (termeData.Date_Encaissement) {
      setMessage(`Ce terme est déjà encaissé en ${formatDate(termeData.Date_Encaissement)}`);
      setMessageType('warning');
      return;
    }

    setLoading(true);

    try {
      // Utiliser la date de session actuelle (personnalisée ou du jour)
      const currentSessionDate = useCustomDate ? customSessionDate : sessionDate;
      
      console.log('💾 Enregistrement encaissement:', {
        numero_contrat: termeData.numero_contrat,
        echeance: termeData.echeance,
        date_encaissement: currentSessionDate
      });

      // Mettre à jour le statut dans la table terme avec la date de session
      const { data, error } = await supabase
        .from('terme')
        .update({
          statut: 'Encaissé',
          Date_Encaissement: currentSessionDate
        })
        .eq('numero_contrat', termeData.numero_contrat)
        .eq('echeance', termeData.echeance)
        .select();

      if (error) {
        console.error('❌ Erreur détaillée encaissement:', error);
        setMessage(`Erreur lors de l'enregistrement de l'encaissement: ${error.message}`);
        setMessageType('error');
        return;
      }

      console.log('✅ Encaissement réussi, données mises à jour:', data);

      setMessage(`Encaissement enregistré avec succès pour la session du ${getDisplayDate()}!`);
      setMessageType('success');
      setTermeData(null);
      setNumeroContrat('');
      setEcheance('');

      // Recharger les statistiques après un délai
      setTimeout(() => {
        loadAllData();
      }, 1000);

    } catch (error) {
      console.error('❌ Erreur lors de l\'enregistrement:', error);
      setMessage('Erreur lors de l\'enregistrement');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  // Fonction pour formater la date au format YYYY-MM-DD
  const formatDateForQuery = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const loadSessionStats = async () => {
    try {
      console.log('📊 CHARGEMENT STATISTIQUES GLOBALES');

      // 1. Statistiques des PAIEMENTS depuis le 25/10/2025
      const { data: paiementsDepuis2510Data } = await supabase
        .from('terme')
        .select('prime, date_paiement')
        .gte('date_paiement', '2025-10-25')
        .is('statut', null);

      // 2. Statistiques des ENCAISSEMENTS depuis le 25/10/2025
      const { data: encaissementsDepuis2510Data } = await supabase
        .from('terme')
        .select('prime, Date_Encaissement')
        .gte('Date_Encaissement', '2025-10-25')
        .eq('statut', 'Encaissé');

      // 3. Statistiques des contrats avec statut null (toutes dates)
      const { data: statutNullData } = await supabase
        .from('terme')
        .select('prime, statut, numero_contrat')
        .is('statut', null);

      // 4. Statistiques des contrats encaissés (toutes dates)
      const { data: encaissesData } = await supabase
        .from('terme')
        .select('prime, statut, numero_contrat')
        .eq('statut', 'Encaissé');

      // CALCUL DES STATISTIQUES GLOBALES DEPUIS 25/10/2025
      const totalPaiementsDepuis2510 = paiementsDepuis2510Data?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;
      const totalEncaissementsDepuis2510 = encaissementsDepuis2510Data?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;

      // CALCUL DES STATISTIQUES GLOBALES
      const totalPrimesStatutNull = statutNullData?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;
      const nombreContratsStatutNull = statutNullData?.length || 0;

      const totalPrimesEncaisses = encaissesData?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;
      const nombreContratsEncaisses = encaissesData?.length || 0;

      console.log('📈 Statistiques globales calculées:', {
        totalPaiementsDepuis2510,
        totalEncaissementsDepuis2510,
        totalPrimesStatutNull,
        totalPrimesEncaisses
      });

      // Mettre à jour seulement les stats globales
      setSessionStats(prev => ({
        ...prev,
        total_primes_statut_null: totalPrimesStatutNull,
        nombre_contrats_statut_null: nombreContratsStatutNull,
        total_primes_encaisses: totalPrimesEncaisses,
        nombre_contrats_encaisses: nombreContratsEncaisses,
        total_paiements_depuis_2510: totalPaiementsDepuis2510,
        total_encaissements_depuis_2510: totalEncaissementsDepuis2510
      }));

    } catch (error) {
      console.error('❌ Erreur calcul stats globales:', error);
    }
  };

  // Fonction pour appliquer le filtre de date
  const applyDateFilter = () => {
    if (useCustomDate && !customSessionDate) {
      setMessage('Veuillez sélectionner une date');
      setMessageType('error');
      return;
    }
    console.log('🎯 Application filtre date:', useCustomDate ? customSessionDate : sessionDate);
    loadAllData();
  };

  // Fonction pour réinitialiser le filtre de date
  const resetDateFilter = () => {
    setUseCustomDate(false);
    const today = new Date();
    const todayISO = formatDateForQuery(today);
    setCustomSessionDate(todayISO);
    console.log('🔄 Réinitialisation filtre date:', todayISO);
    setTimeout(() => {
      loadAllData();
    }, 100);
  };

  // Fonction pour rafraîchir les statistiques
  const refreshStats = () => {
    console.log('🔄 RAFRAÎCHISSEMENT MANUEL');
    if (!useCustomDate) {
      const today = new Date();
      const todayISO = formatDateForQuery(today);
      setSessionDate(todayISO);
      console.log('📅 Date session actualisée:', todayISO);
    }
    loadAllData();
  };

  // Fonction pour exporter les données en Excel
  const exportToExcel = async (type: 'paiements' | 'encaissements' | 'statut_null' | 'encaisses') => {
    setExportLoading(type);
    
    try {
      const currentSessionDate = useCustomDate ? customSessionDate : sessionDate;
      
      let data: ContratData[] = [];
      let fileName = '';
      let sheetName = '';

      console.log(`📤 Export ${type} - Date utilisée:`, currentSessionDate);

      switch (type) {
        case 'paiements':
          const { data: paiementsData } = await supabase
            .from('terme')
            .select('numero_contrat, prime, assure, echeance, date_paiement, Date_Encaissement, statut')
            .is('statut', null)
            .eq('date_paiement', currentSessionDate);
          data = paiementsData || [];
          fileName = `paiements_${currentSessionDate}.xlsx`;
          sheetName = 'Paiements Session';
          break;

        case 'encaissements':
          const { data: encaissementsData } = await supabase
            .from('terme')
            .select('numero_contrat, prime, assure, echeance, date_paiement, Date_Encaissement, statut')
            .eq('Date_Encaissement', currentSessionDate);
          data = encaissementsData || [];
          fileName = `encaissements_${currentSessionDate}.xlsx`;
          sheetName = 'Encaissements Session';
          break;

        case 'statut_null':
          const { data: statutNullData } = await supabase
            .from('terme')
            .select('numero_contrat, prime, assure, echeance, date_paiement, Date_Encaissement, statut')
            .is('statut', null);
          data = statutNullData || [];
          fileName = `contrats_attente_${currentSessionDate}.xlsx`;
          sheetName = 'Contrats en Attente';
          break;

        case 'encaisses':
          const { data: encaissesData } = await supabase
            .from('terme')
            .select('numero_contrat, prime, assure, echeance, date_paiement, Date_Encaissement, statut')
            .eq('statut', 'Encaissé');
          data = encaissesData || [];
          fileName = `contrats_encaisses_${currentSessionDate}.xlsx`;
          sheetName = 'Contrats Encaisses';
          break;
      }

      console.log(`📊 Données exportées (${type}):`, data.length);

      if (data.length === 0) {
        setMessage('Aucune donnée à exporter pour cette catégorie');
        setMessageType('warning');
        setExportLoading(null);
        return;
      }

      // Préparer les données pour l'export
      const excelData = data.map(contrat => ({
        'Numéro Contrat': contrat.numero_contrat,
        'Prime': Number(contrat.prime),
        'Assuré': contrat.assure,
        'Échéance': formatDate(contrat.echeance),
        'Date Paiement': contrat.date_paiement ? formatDate(contrat.date_paiement) : 'Non payé',
        'Date Encaissement': contrat.Date_Encaissement ? formatDate(contrat.Date_Encaissement) : 'Non encaissé',
        'Statut': contrat.statut || 'En attente'
      }));

      // Créer un workbook et une worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Ajouter la worksheet au workbook
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      // Générer le fichier Excel et le télécharger
      XLSX.writeFile(wb, fileName);

      setMessage(`Fichier Excel "${fileName}" téléchargé avec succès!`);
      setMessageType('success');

    } catch (error) {
      console.error('❌ Erreur lors de l\'export Excel:', error);
      setMessage('Erreur lors de l\'export Excel');
      setMessageType('error');
    } finally {
      setExportLoading(null);
    }
  };

  // Gestionnaire de changement pour le numéro de contrat (supprime les espaces)
  const handleNumeroContratChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = cleanContractNumber(e.target.value);
    setNumeroContrat(value);
  };

  // Obtenir la date d'affichage
  const getDisplayDate = () => {
    const dateToDisplay = useCustomDate ? customSessionDate : sessionDate;
    try {
      const date = new Date(dateToDisplay);
      return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return dateToDisplay;
    }
  };

  // Obtenir la date formatée pour l'affichage technique
  const getTechnicalDate = () => {
    return useCustomDate ? customSessionDate : sessionDate;
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mr-3" />
          <p className="text-lg text-gray-600">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
              <DollarSign className="w-6 h-6 mr-2 text-green-600" />
              Encaissement
            </h2>
            <p className="text-gray-600">Saisie des encaissements par numéro de contrat et échéance</p>
          </div>
          <button
            onClick={refreshStats}
            className="flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            title="Rafraîchir les statistiques"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </button>
        </div>
        {username && (
          <p className="text-sm text-blue-600 mt-1">
            Utilisateur connecté : {username}
          </p>
        )}
      </div>

      {/* Bannière de vérification de date */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <div>
              <p className="font-semibold text-green-800">
                {useCustomDate ? 'Session personnalisée active' : 'Session du jour active'}
              </p>
              <p className="text-green-600 text-sm">Date de session: {getDisplayDate()}</p>
              <p className="text-green-500 text-xs">
                Données: {rpData ? 'RP' : 'Calcul manuel'} | 
                ID: {getTechnicalDate()}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-green-700 text-sm">Heure: {new Date().toLocaleTimeString('fr-FR')}</p>
            <p className="text-green-600 text-xs">Dernier refresh: {new Date().toLocaleTimeString('fr-FR')}</p>
          </div>
        </div>
      </div>

      {/* Affichage des données en temps réel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-blue-800 mb-2">
          {rpData ? '✅ Données RP chargées' : '🔄 Données calculées depuis table terme'}
        </h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-blue-600">Paiement Session:</span> {sessionStats.total_paiements.toLocaleString()} TND
          </div>
          <div>
            <span className="text-blue-600">Encaissement Session:</span> {sessionStats.total_encaissements.toLocaleString()} TND
          </div>
          <div>
            <span className="text-blue-600">Différence:</span> {sessionStats.difference.toLocaleString()} TND
          </div>
        </div>
      </div>

      {/* Le reste du code reste identique... */}
      {/* [Le reste de votre code avec le formulaire, les résultats, les filtres, les statistiques...] */}

    </div>
  );
};

export default Encaissement;