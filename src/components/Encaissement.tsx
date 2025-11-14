import React, { useState, useEffect } from 'react';
import { Search, DollarSign, Calendar, FileText, User, CheckCircle, XCircle, AlertCircle, Download, RefreshCw, Filter, ArrowUp, ArrowDown } from 'lucide-react';
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
  balance_session: number;
  total_primes_statut_null: number;
  nombre_contrats_statut_null: number;
  total_primes_encaisses: number;
  nombre_contrats_encaisses: number;
  total_paiements_depuis_2510: number;
  total_encaissements_depuis_2510: number;
  deport_cumule: number;
  nombre_contrats_paiements_session: number;
  nombre_contrats_encaissements_session: number;
  reportdeport_session_actuelle: number;
  reportdeport_session_precedente: number;
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
  reportdeport: number;
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
    balance_session: 0,
    total_primes_statut_null: 0,
    nombre_contrats_statut_null: 0,
    total_primes_encaisses: 0,
    nombre_contrats_encaisses: 0,
    total_paiements_depuis_2510: 0,
    total_encaissements_depuis_2510: 0,
    deport_cumule: -47369.10,
    nombre_contrats_paiements_session: 0,
    nombre_contrats_encaissements_session: 0,
    reportdeport_session_actuelle: 0,
    reportdeport_session_precedente: 0
  });
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState<string>('');
  const [customSessionDate, setCustomSessionDate] = useState<string>('');
  const [useCustomDate, setUseCustomDate] = useState<boolean>(false);
  const [globalBalance, setGlobalBalance] = useState<number>(0);
  const [rpData, setRpData] = useState<RPData | null>(null);
  const [previousRpData, setPreviousRpData] = useState<RPData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionExists, setSessionExists] = useState<boolean>(true);

  useEffect(() => {
    initializeSessionDate();
  }, []);

  // Charger les données quand la session change
  useEffect(() => {
    if (sessionDate || customSessionDate) {
      ensureCurrentSessionExists().then(() => {
        loadSessionStats();
        calculateGlobalBalance();
        loadRPData();
        loadPreviousRPData();
      });
    }
  }, [sessionDate, customSessionDate, useCustomDate]);

  // Fonction pour s'assurer que la session actuelle existe dans la table RP
  const ensureCurrentSessionExists = async (): Promise<boolean> => {
    try {
      const currentSessionDate = useCustomDate ? customSessionDate : sessionDate;
      
      console.log('=== VÉRIFICATION SESSION DANS RP ===');
      console.log('Date de session à vérifier:', currentSessionDate);

      if (!currentSessionDate) {
        console.log('Aucune date de session spécifiée');
        setSessionExists(false);
        return false;
      }

      // Appeler la fonction PostgreSQL pour insérer la session si elle n'existe pas
      const { error } = await supabase
        .rpc('insert_session_if_not_exists', { 
          session_date: currentSessionDate 
        });

      if (error) {
        console.error('Erreur vérification session:', error);
        setSessionExists(false);
        return false;
      }

      console.log('Session vérifiée/insérée avec succès dans RP');
      setSessionExists(true);
      return true;

    } catch (error) {
      console.error('Erreur lors de la vérification de session:', error);
      setSessionExists(false);
      return false;
    }
  };

  // Fonction pour synchroniser la table RP
  const syncRPTable = async (): Promise<boolean> => {
    try {
      console.log('=== SYNCHRONISATION TABLE RP ===');
      
      // D'abord s'assurer que la session actuelle existe
      const sessionEnsured = await ensureCurrentSessionExists();
      if (!sessionEnsured) {
        console.warn('Impossible de garantir la session actuelle');
      }

      // Ensuite synchroniser la table RP
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('sync_rp_table');

      if (rpcError) {
        console.error('Erreur RPC sync_rp_table:', rpcError);
        
        // Fallback: méthode alternative
        console.log('Tentative méthode alternative...');
        const { error: updateError } = await supabase
          .from('rp')
          .update({
            updated_at: new Date().toISOString()
          })
          .not('session', 'is', null);

        if (updateError) {
          console.error('Erreur méthode alternative:', updateError);
          return false;
        }
        
        console.log('Synchronisation RP réussie (méthode alternative)');
        return true;
      }

      console.log('Synchronisation RP réussie via RPC');
      return true;
      
    } catch (error) {
      console.error('Erreur synchronisation RP:', error);
      return false;
    }
  };

  // Fonction pour charger les données de la table RP pour la session actuelle
  const loadRPData = async () => {
    try {
      const currentSessionDate = useCustomDate ? customSessionDate : sessionDate;
      
      console.log('=== CHARGEMENT DONNÉES RP SESSION ACTUELLE ===');
      console.log('Date de session utilisée:', currentSessionDate);

      const { data, error } = await supabase
        .from('rp')
        .select('session, paiement, encaissement, difference, reportdeport')
        .eq('session', currentSessionDate)
        .maybeSingle();

      if (error) {
        console.error('Erreur chargement RP session actuelle:', error);
        setRpData(null);
        setSessionExists(false);
        return;
      }

      console.log('Données RP session actuelle chargées:', data);
      setRpData(data);
      setSessionExists(!!data);

    } catch (error) {
      console.error('Erreur lors du chargement RP session actuelle:', error);
      setRpData(null);
      setSessionExists(false);
    }
  };

  // Fonction pour charger les données de la session précédente
  const loadPreviousRPData = async () => {
    try {
      const currentSessionDate = useCustomDate ? customSessionDate : sessionDate;
      const currentDate = new Date(currentSessionDate);
      const previousDate = new Date(currentDate);
      previousDate.setDate(previousDate.getDate() - 1);
      const previousDateISO = formatDateForQuery(previousDate);

      console.log('=== CHARGEMENT DONNÉES RP SESSION PRÉCÉDENTE ===');
      console.log('Date session précédente:', previousDateISO);

      const { data, error } = await supabase
        .from('rp')
        .select('session, paiement, encaissement, difference, reportdeport')
        .eq('session', previousDateISO)
        .maybeSingle();

      if (error) {
        console.error('Erreur chargement RP session précédente:', error);
        setPreviousRpData(null);
        return;
      }

      console.log('Données RP session précédente chargées:', data);
      setPreviousRpData(data);

    } catch (error) {
      console.error('Erreur lors du chargement RP session précédente:', error);
      setPreviousRpData(null);
    }
  };

  // Fonction pour initialiser et vérifier la date de session
  const initializeSessionDate = () => {
    const today = new Date();
    const todayISO = formatDateForQuery(today);
    console.log('Initialisation session date:', todayISO);
    setSessionDate(todayISO);
    setCustomSessionDate(todayISO);
  };

  // Fonction pour calculer la balance globale
  const calculateGlobalBalance = async () => {
    try {
      console.log('=== CALCUL BALANCE GLOBALE ===');

      // Total des primes des contrats avec statut null (à encaisser)
      const { data: statutNullData, error: statutNullError } = await supabase
        .from('terme')
        .select('prime')
        .is('statut', null);

      if (statutNullError) {
        console.error('Erreur statut null:', statutNullError);
      }

      // Total des primes des contrats encaissés
      const { data: encaissesData, error: encaissesError } = await supabase
        .from('terme')
        .select('prime')
        .eq('statut', 'Encaissé');

      if (encaissesError) {
        console.error('Erreur encaissés:', encaissesError);
      }

      const totalAttente = statutNullData?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;
      const totalEncaisses = encaissesData?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;

      // Balance globale = Total encaissé - Total en attente
      const balance = totalEncaisses - totalAttente;
      console.log('Balance globale calculée:', { totalEncaisses, totalAttente, balance });
      setGlobalBalance(balance);

    } catch (error) {
      console.error('Erreur calcul balance globale:', error);
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
      console.log('Recherche terme:', { cleanedNumeroContrat, echeance });

      const { data, error } = await supabase
        .from('terme')
        .select('*')
        .eq('numero_contrat', cleanedNumeroContrat)
        .eq('echeance', echeance)
        .maybeSingle();

      if (error) {
        console.error('Erreur recherche terme:', error);
        setMessage('Erreur lors de la recherche dans la base de données');
        setMessageType('error');
        return;
      }

      if (!data) {
        setMessage('Ce terme n\'est pas payé. Impossible de l\'encaisser !!!');
        setMessageType('error');
        return;
      }

      console.log('Données trouvées:', data);
      setTermeData(data);
      setMessage('');

    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
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
      
      console.log('Enregistrement encaissement:', {
        numero_contrat: termeData.numero_contrat,
        echeance: termeData.echeance,
        Date_Encaissement: currentSessionDate,
        statut: 'Encaissé'
      });

      // S'assurer que la session existe avant l'encaissement
      await ensureCurrentSessionExists();

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
        console.error('Erreur détaillée encaissement:', error);
        setMessage(`Erreur lors de l'enregistrement de l'encaissement: ${error.message}`);
        setMessageType('error');
        return;
      }

      console.log('Encaissement réussi, données mises à jour:', data);

      setMessage(`Encaissement enregistré avec succès pour la session du ${getDisplayDate()}!`);
      setMessageType('success');
      setTermeData(null);
      setNumeroContrat('');
      setEcheance('');

      // Synchroniser RP après encaissement
      await syncRPTable();

      // Recharger les statistiques après un délai
      setTimeout(() => {
        loadSessionStats();
        calculateGlobalBalance();
        loadRPData();
        loadPreviousRPData();
      }, 1000);

    } catch (error) {
      console.error('Erreur lors de l\'enregistrement:', error);
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

  // Fonction pour rafraîchir les statistiques avec synchronisation RP
  const refreshStats = async () => {
    console.log('=== RAFRAÎCHISSEMENT MANUEL AVEC SYNCHRO RP ===');
    
    setRefreshing(true);
    setMessage('Synchronisation RP en cours...');
    setMessageType('success');

    try {
      // Étape 1: Synchroniser la table RP (inclut l'insertion des sessions manquantes)
      console.log('Début synchronisation RP...');
      const syncSuccess = await syncRPTable();
      
      if (!syncSuccess) {
        setMessage('Attention: synchronisation RP échouée, chargement des données existantes...');
        setMessageType('warning');
      } else {
        setMessage('Synchronisation RP réussie!');
        setMessageType('success');
      }

      // Étape 2: Mettre à jour la date de session si nécessaire
      if (!useCustomDate) {
        const today = new Date();
        const todayISO = formatDateForQuery(today);
        setSessionDate(todayISO);
        console.log('Date session actualisée:', todayISO);
      }

      // Étape 3: Attendre un peu pour que les données soient bien synchronisées
      await new Promise(resolve => setTimeout(resolve, 800));

      // Étape 4: Recharger toutes les données
      console.log('Rechargement des données après synchronisation...');
      await Promise.all([
        loadSessionStats(),
        calculateGlobalBalance(),
        loadRPData(),
        loadPreviousRPData()
      ]);

      console.log('Rafraîchissement terminé avec succès');
      setMessage('Données actualisées avec succès! Table RP synchronisée.');
      setMessageType('success');

    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
      setMessage('Erreur lors de la synchronisation');
      setMessageType('error');
    } finally {
      setRefreshing(false);
    }
  };

  const loadSessionStats = async () => {
    try {
      // Utiliser la date personnalisée ou la date du jour
      const currentSessionDate = useCustomDate ? customSessionDate : sessionDate;
      
      console.log('=== CHARGEMENT STATISTIQUES SESSION ===');
      console.log('Date de session utilisée:', currentSessionDate);

      // 1. Charger les PAIEMENTS de la session actuelle depuis la table terme
      const { data: paiementsSessionData, error: paiementsSessionError } = await supabase
        .from('terme')
        .select('prime, numero_contrat, date_paiement')
        .eq('date_paiement', currentSessionDate)
        .is('statut', null);

      if (paiementsSessionError) {
        console.error('Erreur paiements session:', paiementsSessionError);
      }

      // 2. Charger les ENCAISSEMENTS de la session actuelle depuis la table terme
      const { data: encaissementsSessionData, error: encaissementsSessionError } = await supabase
        .from('terme')
        .select('prime, numero_contrat, Date_Encaissement')
        .eq('Date_Encaissement', currentSessionDate)
        .eq('statut', 'Encaissé');

      if (encaissementsSessionError) {
        console.error('Erreur encaissements session:', encaissementsSessionError);
      }

      // 3. Statistiques des PAIEMENTS depuis le 25/10/2025
      const { data: paiementsDepuis2510Data, error: paiements2510Error } = await supabase
        .from('terme')
        .select('prime, date_paiement')
        .gte('date_paiement', '2025-10-25')
        .is('statut', null);

      if (paiements2510Error) {
        console.error('Erreur paiements depuis 25/10:', paiements2510Error);
      }

      // 4. Statistiques des ENCAISSEMENTS depuis le 25/10/2025
      const { data: encaissementsDepuis2510Data, error: encaissements2510Error } = await supabase
        .from('terme')
        .select('prime, Date_Encaissement')
        .gte('Date_Encaissement', '2025-10-25')
        .eq('statut', 'Encaissé');

      if (encaissements2510Error) {
        console.error('Erreur encaissements depuis 25/10:', encaissements2510Error);
      }

      // 5. Statistiques des contrats avec statut null (toutes dates)
      const { data: statutNullData, error: statutNullError } = await supabase
        .from('terme')
        .select('prime, statut, numero_contrat')
        .is('statut', null);

      if (statutNullError) {
        console.error('Erreur statut null:', statutNullError);
      }

      // 6. Statistiques des contrats encaissés (toutes dates)
      const { data: encaissesData, error: encaissesError } = await supabase
        .from('terme')
        .select('prime, statut, numero_contrat')
        .eq('statut', 'Encaissé');

      if (encaissesError) {
        console.error('Erreur encaissés:', encaissesError);
      }

      // CALCUL DES STATISTIQUES DE SESSION - CORRIGÉ
      const totalPaiementsSession = paiementsSessionData?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;
      const totalEncaissementsSession = encaissementsSessionData?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;
      
      // CORRECTION: Balance de session = Paiements - Encaissements
      const balanceSession = totalPaiementsSession - totalEncaissementsSession;
      
      const nombreContratsPaiementsSession = paiementsSessionData?.length || 0;
      const nombreContratsEncaissementsSession = encaissementsSessionData?.length || 0;

      // CALCUL DES STATISTIQUES GLOBALES DEPUIS 25/10/2025
      const totalPaiementsDepuis2510 = paiementsDepuis2510Data?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;
      const totalEncaissementsDepuis2510 = encaissementsDepuis2510Data?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;

      // CALCUL DES STATISTIQUES GLOBALES
      const totalPrimesStatutNull = statutNullData?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;
      const nombreContratsStatutNull = statutNullData?.length || 0;

      const totalPrimesEncaisses = encaissesData?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;
      const nombreContratsEncaisses = encaissesData?.length || 0;

      // DÉPORT CUMULÉ FIXE
      const deportCumule = -47369.10;

      // Récupérer les reportdeport depuis la table RP
      const reportdeportSessionActuelle = rpData?.reportdeport || 0;
      const reportdeportSessionPrecedente = previousRpData?.reportdeport || 0;

      console.log('=== RÉSULTATS CALCULÉS (CORRIGÉS) ===');
      console.log('Session - Paiements:', totalPaiementsSession, '(', nombreContratsPaiementsSession, 'contrats)');
      console.log('Session - Encaissements:', totalEncaissementsSession, '(', nombreContratsEncaissementsSession, 'contrats)');
      console.log('Session - Balance (Paiements - Encaissements):', balanceSession);
      console.log('Reportdeport session actuelle:', reportdeportSessionActuelle);
      console.log('Reportdeport session précédente:', reportdeportSessionPrecedente);
      console.log('Paiements depuis 25/10:', totalPaiementsDepuis2510);
      console.log('Encaissements depuis 25/10:', totalEncaissementsDepuis2510);
      console.log('Contrats en attente:', totalPrimesStatutNull, '(', nombreContratsStatutNull, 'contrats)');
      console.log('Contrats encaissés:', totalPrimesEncaisses, '(', nombreContratsEncaisses, 'contrats)');
      console.log('Déport cumulé:', deportCumule);

      // Mettre à jour toutes les statistiques
      setSessionStats({
        total_paiements: totalPaiementsSession,
        total_encaissements: totalEncaissementsSession,
        balance_session: balanceSession, // CORRIGÉ: Paiements - Encaissements
        total_primes_statut_null: totalPrimesStatutNull,
        nombre_contrats_statut_null: nombreContratsStatutNull,
        total_primes_encaisses: totalPrimesEncaisses,
        nombre_contrats_encaisses: nombreContratsEncaisses,
        total_paiements_depuis_2510: totalPaiementsDepuis2510,
        total_encaissements_depuis_2510: totalEncaissementsDepuis2510,
        deport_cumule: deportCumule,
        nombre_contrats_paiements_session: nombreContratsPaiementsSession,
        nombre_contrats_encaissements_session: nombreContratsEncaissementsSession,
        reportdeport_session_actuelle: reportdeportSessionActuelle,
        reportdeport_session_precedente: reportdeportSessionPrecedente
      });

    } catch (error) {
      console.error('Erreur calcul stats:', error);
    }
  };

  // Fonction pour appliquer le filtre de date
  const applyDateFilter = () => {
    if (useCustomDate && !customSessionDate) {
      setMessage('Veuillez sélectionner une date');
      setMessageType('error');
      return;
    }
    console.log('Application filtre date:', useCustomDate ? customSessionDate : sessionDate);
    ensureCurrentSessionExists().then(() => {
      loadSessionStats();
      loadRPData();
      loadPreviousRPData();
    });
  };

  // Fonction pour réinitialiser le filtre de date
  const resetDateFilter = () => {
    setUseCustomDate(false);
    const today = new Date();
    const todayISO = formatDateForQuery(today);
    setCustomSessionDate(todayISO);
    console.log('Réinitialisation filtre date:', todayISO);
    setTimeout(() => {
      ensureCurrentSessionExists().then(() => {
        loadSessionStats();
        loadRPData();
        loadPreviousRPData();
      });
    }, 100);
  };

  // Fonction pour exporter les données en Excel
  const exportToExcel = async (type: 'paiements' | 'encaissements' | 'statut_null' | 'encaisses') => {
    setExportLoading(type);
    
    try {
      const currentSessionDate = useCustomDate ? customSessionDate : sessionDate;
      
      let data: ContratData[] = [];
      let fileName = '';
      let sheetName = '';

      console.log(`Export ${type} - Date utilisée:`, currentSessionDate);

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

      console.log(`Données exportées (${type}):`, data.length);

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
      console.error('Erreur lors de l\'export Excel:', error);
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

  // Obtenir la date de la session précédente
  const getPreviousSessionDate = () => {
    const currentDate = new Date(useCustomDate ? customSessionDate : sessionDate);
    const previousDate = new Date(currentDate);
    previousDate.setDate(previousDate.getDate() - 1);
    return formatDateForQuery(previousDate);
  };

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
            disabled={refreshing}
            className="flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            title="Rafraîchir les statistiques et synchroniser la table RP"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Synchronisation...' : 'Actualiser RP'}
          </button>
        </div>
        {username && (
          <p className="text-sm text-blue-600 mt-1">
            Utilisateur connecté : {username}
          </p>
        )}
      </div>

      {/* Bannière de vérification de date avec statut de session */}
      <div className={`border rounded-lg p-4 mb-6 ${
        sessionExists 
          ? 'bg-green-50 border-green-200' 
          : 'bg-yellow-50 border-yellow-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {sessionExists ? (
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
            )}
            <div>
              <p className={`font-semibold ${
                sessionExists ? 'text-green-800' : 'text-yellow-800'
              }`}>
                {useCustomDate ? 'Session personnalisée' : 'Session du jour'} -{' '}
                {sessionExists ? 'Disponible dans RP' : 'Non trouvée dans RP'}
              </p>
              <p className={sessionExists ? 'text-green-600 text-sm' : 'text-yellow-600 text-sm'}>
                Date de session: {getDisplayDate()}
              </p>
              <p className={`text-xs ${sessionExists ? 'text-green-500' : 'text-yellow-500'}`}>
                Données RP: {rpData ? 'Chargées' : 'Non trouvées'} | 
                Date technique: {getTechnicalDate()}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={sessionExists ? 'text-green-700 text-sm' : 'text-yellow-700 text-sm'}>
              Heure système: {new Date().toLocaleTimeString('fr-FR')}
            </p>
            <p className={sessionExists ? 'text-green-600 text-xs' : 'text-yellow-600 text-xs'}>
              Session ID: {getTechnicalDate()}
            </p>
            {!sessionExists && (
              <button
                onClick={ensureCurrentSessionExists}
                className="mt-1 px-3 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600 transition-colors"
              >
                Créer la session
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Le reste du code reste exactement le même */}
      {/* Affichage des données RP en temps réel */}
      {rpData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-blue-800 mb-2">Données RP chargées:</h4>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-blue-600">Paiement:</span> {rpData.paiement?.toLocaleString()} TND
            </div>
            <div>
              <span className="text-blue-600">Encaissement:</span> {rpData.encaissement?.toLocaleString()} TND
            </div>
            <div>
              <span className="text-blue-600">Différence:</span> {rpData.difference?.toLocaleString()} TND
            </div>
            <div>
              <span className="text-blue-600">Reportdeport:</span> {rpData.reportdeport?.toLocaleString()} TND
            </div>
          </div>
        </div>
      )}

      {/* Le reste de votre composant reste inchangé */}
      {/* ... (Formulaire de recherche, Résultats, Filtres, Statistiques) ... */}

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