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
        date_encaissement: currentSessionDate,
        id: termeData.id
      });

      // VÉRIFICATION CRITIQUE : Afficher les données avant mise à jour
      console.log('📋 DONNÉES AVANT MISE À JOUR:', {
        id: termeData.id,
        numero_contrat: termeData.numero_contrat,
        echeance: termeData.echeance,
        statut_actuel: termeData.statut,
        date_encaissement_actuelle: termeData.Date_Encaissement
      });

      // Mettre à jour le statut dans la table terme avec la date de session
      const { data, error } = await supabase
        .from('terme')
        .update({
          statut: 'Encaissé',
          Date_Encaissement: currentSessionDate  // Utiliser la date de session
        })
        .eq('id', termeData.id)  // Utiliser l'ID comme clé primaire pour plus de précision
        .select();

      if (error) {
        console.error('❌ Erreur détaillée encaissement:', error);
        console.error('Code erreur:', error.code);
        console.error('Détails erreur:', error.details);
        console.error('Message erreur:', error.message);
        
        setMessage(`Erreur lors de l'enregistrement de l'encaissement: ${error.message}`);
        setMessageType('error');
        return;
      }

      console.log('✅ Encaissement réussi, données mises à jour:', data);

      // VÉRIFICATION : Vérifier que les données ont bien été mises à jour
      if (data && data.length > 0) {
        const updatedData = data[0];
        console.log('📗 DONNÉES APRÈS MISE À JOUR:', {
          id: updatedData.id,
          statut: updatedData.statut,
          Date_Encaissement: updatedData.Date_Encaissement,
          date_session_utilisee: currentSessionDate
        });

        // Vérifier que la date d'encaissement correspond à la session
        if (updatedData.Date_Encaissement === currentSessionDate) {
          console.log('🎯 SUCCÈS: Date d\'encaissement correctement enregistrée');
        } else {
          console.warn('⚠️ ATTENTION: Date d\'encaissement ne correspond pas à la session', {
            date_attendue: currentSessionDate,
            date_obtenue: updatedData.Date_Encaissement
          });
        }
      }

      setMessage(`Encaissement enregistré avec succès pour la session du ${getDisplayDate()}!`);
      setMessageType('success');
      
      // Réinitialiser le formulaire
      setTermeData(null);
      setNumeroContrat('');
      setEcheance('');

      // Recharger les statistiques après un délai
      setTimeout(() => {
        console.log('🔄 Rechargement des données après encaissement...');
        loadAllData();
      }, 1500);

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

      {/* Formulaire de recherche */}
      <div className="bg-blue-50 p-6 rounded-lg mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Numéro de contrat
            </label>
            <input
              type="text"
              value={numeroContrat}
              onChange={handleNumeroContratChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Saisir le numéro de contrat (sans espaces)"
            />
            <p className="text-xs text-gray-500 mt-1">Les espaces seront automatiquement supprimés</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Échéance
            </label>
            <input
              type="date"
              value={echeance}
              onChange={(e) => setEcheance(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          onClick={searchTerme}
          disabled={loading || !numeroContrat || !echeance}
          className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <Search className="w-4 h-4 mr-2" />
          {loading ? 'Recherche...' : 'Rechercher'}
        </button>
      </div>

      {/* Résultat de la recherche */}
      {termeData && (
        <div className={`p-6 rounded-lg mb-6 border-2 ${
          termeData.Date_Encaissement
            ? 'bg-blue-50 border-blue-200'
            : 'bg-green-50 border-green-200'
        }`}>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
            Données trouvées
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <label className="block text-sm font-medium text-gray-600 mb-1">Assuré</label>
              <p className="text-lg font-semibold text-gray-800 flex items-center">
                <User className="w-4 h-4 mr-2 text-blue-600" />
                {termeData.assure}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <label className="block text-sm font-medium text-gray-600 mb-1">Prime</label>
              <p className="text-lg font-bold text-green-700">{Number(termeData.prime).toLocaleString()} TND</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <label className="block text-sm font-medium text-gray-600 mb-1">Statut</label>
              <p className={`text-lg font-semibold ${
                termeData.statut === 'Encaissé' ? 'text-green-600' : 'text-orange-600'
              }`}>
                {termeData.statut || 'En attente'}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <label className="block text-sm font-medium text-gray-600 mb-1">Date de paiement</label>
              <p className="text-lg font-semibold text-gray-800">
                {termeData.date_paiement ? formatDate(termeData.date_paiement) : 'N/A'}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <label className="block text-sm font-medium text-gray-600 mb-1">Retour</label>
              <p className="text-lg font-semibold text-gray-800">
                {termeData.Retour || 'Aucun'}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <label className="block text-sm font-medium text-gray-600 mb-1">Date d'encaissement</label>
              <p className="text-lg font-semibold text-gray-800">
                {termeData.Date_Encaissement ? formatDate(termeData.Date_Encaissement) : 'Non encaissé'}
              </p>
            </div>
          </div>
          <button
            onClick={enregistrerEncaissement}
            disabled={loading || !!termeData.Date_Encaissement}
            className="mt-6 flex items-center justify-center px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <DollarSign className="w-4 h-4 mr-2" />
            {loading ? 'Enregistrement...' : 'Enregistrer l\'encaissement'}
          </button>
        </div>
      )}

      {/* Filtre de date pour les statistiques de session */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-purple-800 flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Filtre de Date pour les Statistiques de Session
          </h3>
          <div className="flex items-center space-x-2">
            <label className="flex items-center text-sm text-purple-700">
              <input
                type="checkbox"
                checked={useCustomDate}
                onChange={(e) => setUseCustomDate(e.target.checked)}
                className="mr-2 rounded text-purple-600 focus:ring-purple-500"
              />
              Utiliser une date personnalisée
            </label>
          </div>
        </div>

        {useCustomDate && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-purple-700 mb-2">
                Date de session personnalisée
              </label>
              <input
                type="date"
                value={customSessionDate}
                onChange={(e) => setCustomSessionDate(e.target.value)}
                className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex space-x-2">
              <button
                onClick={applyDateFilter}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
              >
                <Filter className="w-4 h-4 mr-2" />
                Appliquer
              </button>
              <button
                onClick={resetDateFilter}
                className="flex items-center px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Réinitialiser
              </button>
            </div>
            <div className="text-sm text-purple-600">
              <p>Session affichée: {getDisplayDate()}</p>
              <p className="text-xs">ID: {getTechnicalDate()}</p>
            </div>
          </div>
        )}
      </div>

      {/* Statistiques de session */}
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Statistiques de la Session ({getDisplayDate()})
          </h3>
          <div className="text-sm text-gray-500">
            {rpData ? '✅ Données RP chargées' : '🔄 Données calculées depuis table terme'}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Paiements Session */}
          <div 
            className="text-center p-4 bg-orange-50 rounded-lg shadow border border-orange-200 cursor-pointer hover:bg-orange-100 transition-colors"
            onClick={() => exportToExcel('paiements')}
            title="Cliquer pour exporter les numéros de contrat en Excel"
          >
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm text-gray-600 flex-1 text-left">Paiements Session</p>
              <Download className="w-4 h-4 text-orange-600 flex-shrink-0" />
            </div>
            <p className="text-xl font-bold text-orange-600">
              {sessionStats.total_paiements.toLocaleString()} TND
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {rpData ? 'Données RP' : 'Calcul manuel'}
            </p>
            <p className="text-xs text-orange-600 mt-1">
              Session: {getTechnicalDate()}
            </p>
            {exportLoading === 'paiements' && (
              <p className="text-xs text-orange-600 mt-1 animate-pulse">Génération Excel...</p>
            )}
          </div>

          {/* Encaissements Session */}
          <div 
            className="text-center p-4 bg-blue-50 rounded-lg shadow border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
            onClick={() => exportToExcel('encaissements')}
            title="Cliquer pour exporter les numéros de contrat en Excel"
          >
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm text-gray-600 flex-1 text-left">Encaissements Session</p>
              <Download className="w-4 h-4 text-blue-600 flex-shrink-0" />
            </div>
            <p className="text-xl font-bold text-blue-600">
              {sessionStats.total_encaissements.toLocaleString()} TND
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {rpData ? 'Données RP' : 'Calcul manuel'}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Session: {getTechnicalDate()}
            </p>
            {exportLoading === 'encaissements' && (
              <p className="text-xs text-blue-600 mt-1 animate-pulse">Génération Excel...</p>
            )}
          </div>

          {/* Différence Session */}
          <div className="text-center p-4 bg-white rounded-lg shadow border border-gray-200">
            <p className="text-sm text-gray-600">Différence Session</p>
            <p className={`text-xl font-bold ${
              sessionStats.difference >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {sessionStats.difference.toLocaleString()} TND
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {sessionStats.difference >= 0 ? 'Excédent' : 'Déficit'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {rpData ? 'Données RP' : 'Calcul manuel'}
            </p>
          </div>

          {/* Balance de Session */}
          <div className={`text-center p-4 rounded-lg shadow border ${
            sessionStats.session_montant >= 0 ? 'bg-green-100 border-green-200' : 'bg-red-100 border-red-200'
          }`}>
            <p className="text-sm text-gray-600">Balance de Session</p>
            <p className={`text-xl font-bold ${
              sessionStats.session_montant >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {Math.abs(sessionStats.session_montant).toLocaleString()} TND
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {sessionStats.session_montant >= 0 ? 'À encaisser' : 'Déficit'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {rpData ? 'Données RP' : 'Calcul manuel'}
            </p>
          </div>
        </div>

        {/* Informations de débogage */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
          <p className="text-sm text-yellow-800">
            <strong>Informations techniques:</strong> Session ID: {getTechnicalDate()} | 
            Données RP: {rpData ? 'Présentes' : 'Absentes'} | 
            Dernier chargement: {new Date().toLocaleTimeString('fr-FR')}
          </p>
        </div>
      </div>

      {/* Statistiques globales */}
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Statistiques Globales</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Paiements depuis 25/10/2025 */}
          <div className="text-center p-4 bg-purple-50 rounded-lg shadow border border-purple-200">
            <p className="text-sm text-gray-600">Paiements depuis 25/10/2025</p>
            <p className="text-xl font-bold text-purple-600">
              {sessionStats.total_paiements_depuis_2510.toLocaleString()} TND
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Depuis le 25/10/2025
            </p>
          </div>

          {/* Encaissements depuis 25/10/2025 */}
          <div className="text-center p-4 bg-indigo-50 rounded-lg shadow border border-indigo-200">
            <p className="text-sm text-gray-600">Encaissements depuis 25/10/2025</p>
            <p className="text-xl font-bold text-indigo-600">
              {sessionStats.total_encaissements_depuis_2510.toLocaleString()} TND
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Depuis le 25/10/2025
            </p>
          </div>

          {/* Déport cumulé */}
          <div className="text-center p-4 bg-red-50 rounded-lg shadow border border-red-200">
            <p className="text-sm text-gray-600">Déport cumulé</p>
            <p className="text-xl font-bold text-red-600">
              {sessionStats.deport_cumule.toLocaleString()} TND
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Suite mission inspection
            </p>
            <p className="text-xs text-red-600 mt-1">
              Au 24/10/2025
            </p>
          </div>

          {/* Balance Globale */}
          <div className={`text-center p-4 rounded-lg shadow border ${
            globalBalance >= 0 ? 'bg-blue-100 border-blue-200' : 'bg-red-100 border-red-200'
          }`}>
            <p className="text-sm text-gray-600">Balance Globale</p>
            <p className={`text-xl font-bold ${
              globalBalance >= 0 ? 'text-blue-600' : 'text-red-600'
            }`}>
              {Math.abs(globalBalance).toLocaleString()} TND
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {globalBalance >= 0 ? 'Solde positif' : 'Solde négatif'}
            </p>
          </div>
        </div>

        {/* Contrats en attente et encaissés */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contrats en attente */}
          <div 
            className="text-center p-4 bg-yellow-50 rounded-lg shadow border border-yellow-200 cursor-pointer hover:bg-yellow-100 transition-colors"
            onClick={() => exportToExcel('statut_null')}
            title="Cliquer pour exporter les numéros de contrat en Excel"
          >
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm text-gray-600 flex-1 text-left">Contrats en attente</p>
              <Download className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            </div>
            <p className="text-xl font-bold text-yellow-600">
              {sessionStats.total_primes_statut_null.toLocaleString()} TND
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {sessionStats.nombre_contrats_statut_null} contrat(s)
            </p>
            <p className="text-xs text-yellow-600 mt-1">
              Statut: null (toutes dates)
            </p>
            {exportLoading === 'statut_null' && (
              <p className="text-xs text-yellow-600 mt-1 animate-pulse">Génération Excel...</p>
            )}
          </div>

          {/* Contrats encaissés */}
          <div 
            className="text-center p-4 bg-green-50 rounded-lg shadow border border-green-200 cursor-pointer hover:bg-green-100 transition-colors"
            onClick={() => exportToExcel('encaisses')}
            title="Cliquer pour exporter les numéros de contrat en Excel"
          >
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm text-gray-600 flex-1 text-left">Contrats encaissés</p>
              <Download className="w-4 h-4 text-green-600 flex-shrink-0" />
            </div>
            <p className="text-xl font-bold text-green-700">
              {sessionStats.total_primes_encaisses.toLocaleString()} TND
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {sessionStats.nombre_contrats_encaisses} contrat(s)
            </p>
            <p className="text-xs text-green-600 mt-1">
              Statut: "Encaissé" (toutes dates)
            </p>
            {exportLoading === 'encaisses' && (
              <p className="text-xs text-green-600 mt-1 animate-pulse">Génération Excel...</p>
            )}
          </div>
        </div>
      </div>

      {/* Message de statut */}
      {message && (
        <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
          messageType === 'success'
            ? 'bg-green-100 text-green-800 border border-green-300'
            : messageType === 'warning'
            ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
            : 'bg-red-100 text-red-800 border border-red-300'
        }`}>
          {messageType === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          {messageType === 'warning' && <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          {messageType === 'error' && <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          <span>{message}</span>
        </div>
      )}
    </div>
  );
};

export default Encaissement;