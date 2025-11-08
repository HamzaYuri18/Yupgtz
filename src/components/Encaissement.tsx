import React, { useState, useEffect } from 'react';
import { Search, DollarSign, Calendar, FileText, User, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react';
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
  statut: string;
  date_paiement: string | null;
  Retour: string | null;
  Date_Encaissement: string | null;
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
}

interface ContratData {
  numero_contrat: string;
  prime: number;
  assure: string;
  echeance: string;
  date_paiement: string | null;
  Date_Encaissement: string | null;
  statut: string;
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
    nombre_contrats_encaisses: 0
  });
  const [exportLoading, setExportLoading] = useState<string | null>(null);

  useEffect(() => {
    loadSessionStats();
  }, []);

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
      const { data, error } = await supabase
        .from('terme')
        .select('*')
        .eq('numero_contrat', cleanedNumeroContrat)
        .eq('echeance', echeance)
        .maybeSingle();

      if (error || !data) {
        setMessage('Ce terme n\'est pas payé Impossible de l\'encaisser !!!');
        setMessageType('error');
        return;
      }

      setTermeData(data);
      setMessage('');
    } catch (error) {
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
      setMessage(`Ce terme est deja encaissé en ${formatDate(termeData.Date_Encaissement)}`);
      setMessageType('warning');
      return;
    }

    setLoading(true);

    try {
      const today = new Date().toISOString().split('T')[0];

      // Mettre à jour le statut dans la table terme
      const { error } = await supabase
        .from('terme')
        .update({
          statut: 'Encaissé',
          Date_Encaissement: today
        })
        .eq('numero_contrat', termeData.numero_contrat)
        .eq('echeance', termeData.echeance);

      if (error) {
        setMessage('Erreur lors de l\'enregistrement de l\'encaissement');
        setMessageType('error');
        return;
      }

      setMessage('Encaissement enregistré avec succès!');
      setMessageType('success');
      setTermeData(null);
      setNumeroContrat('');
      setEcheance('');

      // Recharger les statistiques
      loadSessionStats();
    } catch (error) {
      setMessage('Erreur lors de l\'enregistrement');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Fonction pour formater la date au format YYYY-MM-DD
  const formatDateForQuery = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const loadSessionStats = async () => {
    try {
      // Récupérer la date de début de session (aujourd'hui)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = formatDateForQuery(today);
      
      console.log('Date de session pour requêtes:', todayISO);

      // 1. Statistiques des PAIEMENTS (statut null ET date_paiement = aujourd'hui)
      const { data: paiementsData, error: paiementsError } = await supabase
        .from('terme')
        .select('prime, statut, date_paiement, numero_contrat, assure, echeance, Date_Encaissement')
        .is('statut', null)
        .eq('date_paiement', todayISO);

      if (paiementsError) {
        console.error('Erreur paiements:', paiementsError);
      } else {
        console.log('Paiements trouvés aujourd\'hui:', paiementsData);
        console.log('Critères paiements: statut=null, date_paiement=', todayISO);
      }

      // 2. Statistiques des ENCAISSEMENTS (date_encaissement = aujourd'hui)
      const { data: encaissementsData, error: encaissementsError } = await supabase
        .from('terme')
        .select('prime, Date_Encaissement, numero_contrat, assure, echeance, date_paiement, statut')
        .eq('Date_Encaissement', todayISO);

      if (encaissementsError) {
        console.error('Erreur encaissements:', encaissementsError);
      } else {
        console.log('Encaissements trouvés aujourd\'hui:', encaissementsData);
        console.log('Critères encaissements: Date_Encaissement=', todayISO);
      }

      // 3. Statistiques des contrats avec statut null (toutes dates)
      const { data: statutNullData, error: statutNullError } = await supabase
        .from('terme')
        .select('prime, statut, numero_contrat, assure, echeance, date_paiement, Date_Encaissement')
        .is('statut', null);

      if (statutNullError) {
        console.error('Erreur statut null:', statutNullError);
      } else {
        console.log('Contrats avec statut null (toutes dates):', statutNullData?.length);
      }

      // 4. Statistiques des contrats encaissés (toutes dates)
      const { data: encaissesData, error: encaissesError } = await supabase
        .from('terme')
        .select('prime, statut, Date_Encaissement, numero_contrat, assure, echeance, date_paiement')
        .eq('statut', 'Encaissé');

      if (encaissesError) {
        console.error('Erreur encaissés:', encaissesError);
      } else {
        console.log('Contrats encaissés (toutes dates):', encaissesData?.length);
      }

      // CALCUL DES STATISTIQUES DE PAIEMENTS (Session)
      const totalPaiements = paiementsData?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;
      const nombreContratsPaiements = paiementsData?.length || 0;

      // CALCUL DES STATISTIQUES D'ENCAISSEMENTS (Session)
      const totalEncaissements = encaissementsData?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;
      const nombreContratsEncaissements = encaissementsData?.length || 0;

      // CALCUL DES STATISTIQUES GLOBALES
      const totalPrimesStatutNull = statutNullData?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;
      const nombreContratsStatutNull = statutNullData?.length || 0;

      const totalPrimesEncaisses = encaissesData?.reduce((sum, item) => sum + (Number(item.prime) || 0), 0) || 0;
      const nombreContratsEncaisses = encaissesData?.length || 0;

      const difference = totalPaiements - totalEncaissements;

      console.log('Résultats calculés:', {
        totalPaiements,
        nombreContratsPaiements,
        totalEncaissements,
        nombreContratsEncaissements,
        difference
      });

      setSessionStats({
        total_encaissements: totalEncaissements,
        total_paiements: totalPaiements,
        difference: difference,
        session_montant: difference,
        cumul_sessions: 0,
        nombre_contrats_paiements: nombreContratsPaiements,
        nombre_contrats_encaissements: nombreContratsEncaissements,
        total_primes_statut_null: totalPrimesStatutNull,
        nombre_contrats_statut_null: nombreContratsStatutNull,
        total_primes_encaisses: totalPrimesEncaisses,
        nombre_contrats_encaisses: nombreContratsEncaisses
      });

    } catch (error) {
      console.error('Erreur calcul stats:', error);
    }
  };

  // Fonction pour exporter les données en Excel
  const exportToExcel = async (type: 'paiements' | 'encaissements' | 'statut_null' | 'encaisses') => {
    setExportLoading(type);
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = formatDateForQuery(today);
      
      let data: ContratData[] = [];
      let fileName = '';
      let sheetName = '';

      switch (type) {
        case 'paiements':
          const { data: paiementsData } = await supabase
            .from('terme')
            .select('numero_contrat, prime, assure, echeance, date_paiement, Date_Encaissement, statut')
            .is('statut', null)
            .eq('date_paiement', todayISO);
          data = paiementsData || [];
          fileName = `paiements_${todayISO}.xlsx`;
          sheetName = 'Paiements Aujourdhui';
          break;

        case 'encaissements':
          const { data: encaissementsData } = await supabase
            .from('terme')
            .select('numero_contrat, prime, assure, echeance, date_paiement, Date_Encaissement, statut')
            .eq('Date_Encaissement', todayISO);
          data = encaissementsData || [];
          fileName = `encaissements_${todayISO}.xlsx`;
          sheetName = 'Encaissements Aujourdhui';
          break;

        case 'statut_null':
          const { data: statutNullData } = await supabase
            .from('terme')
            .select('numero_contrat, prime, assure, echeance, date_paiement, Date_Encaissement, statut')
            .is('statut', null);
          data = statutNullData || [];
          fileName = `contrats_attente_${todayISO}.xlsx`;
          sheetName = 'Contrats en Attente';
          break;

        case 'encaisses':
          const { data: encaissesData } = await supabase
            .from('terme')
            .select('numero_contrat, prime, assure, echeance, date_paiement, Date_Encaissement, statut')
            .eq('statut', 'Encaissé');
          data = encaissesData || [];
          fileName = `contrats_encaisses_${todayISO}.xlsx`;
          sheetName = 'Contrats Encaisses';
          break;
      }

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

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
          <DollarSign className="w-6 h-6 mr-2 text-green-600" />
          Encaissement
        </h2>
        <p className="text-gray-600">Saisie des encaissements par numéro de contrat et échéance</p>
        {username && (
          <p className="text-sm text-blue-600 mt-1">
            Utilisateur connecté : {username}
          </p>
        )}
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
                {termeData.statut}
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

      {/* Statistiques de session */}
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Statistiques de la Session ({new Date().toLocaleDateString('fr-FR')})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Paiements */}
          <div 
            className="text-center p-4 bg-orange-50 rounded-lg shadow border border-orange-200 cursor-pointer hover:bg-orange-100 transition-colors"
            onClick={() => exportToExcel('paiements')}
            title="Cliquer pour exporter les numéros de contrat en Excel"
          >
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm text-gray-600 flex-1 text-left">Paiements (Aujourd'hui)</p>
              <Download className="w-4 h-4 text-orange-600 flex-shrink-0" />
            </div>
            <p className="text-xl font-bold text-orange-600">
              {sessionStats.total_paiements.toLocaleString()} TND
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {sessionStats.nombre_contrats_paiements} contrat(s)
            </p>
            <p className="text-xs text-orange-600 mt-1">
              Statut: null + Date paiement: aujourd'hui
            </p>
            {exportLoading === 'paiements' && (
              <p className="text-xs text-orange-600 mt-1 animate-pulse">Génération Excel...</p>
            )}
          </div>

          {/* Encaissements */}
          <div 
            className="text-center p-4 bg-blue-50 rounded-lg shadow border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
            onClick={() => exportToExcel('encaissements')}
            title="Cliquer pour exporter les numéros de contrat en Excel"
          >
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm text-gray-600 flex-1 text-left">Encaissements (Aujourd'hui)</p>
              <Download className="w-4 h-4 text-blue-600 flex-shrink-0" />
            </div>
            <p className="text-xl font-bold text-blue-600">
              {sessionStats.total_encaissements.toLocaleString()} TND
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {sessionStats.nombre_contrats_encaissements} contrat(s)
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Date encaissement: aujourd'hui
            </p>
            {exportLoading === 'encaissements' && (
              <p className="text-xs text-blue-600 mt-1 animate-pulse">Génération Excel...</p>
            )}
          </div>

          {/* Différence */}
          <div className="text-center p-4 bg-white rounded-lg shadow border border-gray-200">
            <p className="text-sm text-gray-600">Différence (Paiements - Encaissements)</p>
            <p className={`text-xl font-bold ${
              sessionStats.difference >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {sessionStats.difference.toLocaleString()} TND
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {sessionStats.difference >= 0 ? 'Excédent' : 'Déficit'}
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
          </div>
        </div>

        {/* Statistiques globales */}
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Statistiques Globales</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contrats en attente */}
          <div 
            className="text-center p-4 bg-yellow-50 rounded-lg shadow border border-yellow-200 cursor-pointer hover:bg-yellow-100 transition-colors"
            onClick={() => exportToExcel('statut_null')}
            title="Cliquer pour exporter les numéros de contrat en Excel"
          >
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm text-gray-600 flex-1 text-left">Contrats en attente d'encaissement</p>
              <Download className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            </div>
            <p className="text-xl font-bold text-yellow-600">
              {sessionStats.total_primes_statut_null.toLocaleString()} TND
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {sessionStats.nombre_contrats_statut_null} contrat(s)
            </p>
            <p className="text-xs text-yellow-600 mt-1">
              Tous les contrats avec statut null
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
              <p className="text-sm text-gray-600 flex-1 text-left">Total des contrats encaissés</p>
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