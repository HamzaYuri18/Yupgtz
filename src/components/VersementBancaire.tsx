import { useState, useEffect } from 'react';
import { DollarSign, Calendar, Building2, Download, FileSpreadsheet, TrendingUp, RefreshCw, Edit, Save, X, MessageSquare } from 'lucide-react';
import {
  getRecentSessions,
  getSessionsByDateRange,
  updateSessionVersement,
  getMonthlyStats,
  verifyAndSyncSessionTotals,
  calculateTotalEspeceFromRapport,
  updateSessionRemarques
} from '../utils/sessionService';
import * as XLSX from 'xlsx';
import { generateAvisVersementPDF } from '../utils/avisVersementPDF';
import { supabase } from '../lib/supabase';
import { numberToWords } from '../utils/numberToWords';

interface VersementBancaireProps {
  username: string;
}

interface SessionData {
  id: number;
  date_session: string;
  total_espece: number;
  versement: number;
  date_versement: string | null;
  charges: number;
  banque: string | null;
  statut: string;
  cree_par: string;
  Remarques: string | null;
}

interface QuinzaineStats {
  premiere: number;
  deuxieme: number;
  total: number;
}

const VersementBancaire: React.FC<VersementBancaireProps> = ({ username }) => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionData[]>([]);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [message, setMessage] = useState('');
  const [monthlyStats, setMonthlyStats] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [quinzaineStats, setQuinzaineStats] = useState<QuinzaineStats>({ premiere: 0, deuxieme: 0, total: 0 });
  const [isVerifying, setIsVerifying] = useState(false);
  
  // État pour la gestion des remarques en édition
  const [editingRemarque, setEditingRemarque] = useState<number | null>(null);
  const [tempRemarque, setTempRemarque] = useState('');

  // État pour le total à verser aujourd'hui
  const [totalAVerserAujourdhui, setTotalAVerserAujourdhui] = useState(0);
  const [showAvisModal, setShowAvisModal] = useState(false);
  const [avisFormData, setAvisFormData] = useState({
    banque: 'ATTIJARI',
    compteBancaire: ''
  });

  const [formData, setFormData] = useState({
    sessionId: '',
    dateSession: '',
    versement: '',
    dateVersement: '',
    charges: '',
    banque: 'ATTIJARI'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadSessions();
    loadMonthlyStats();
    calculateTotalAVerserAujourdhui();
  }, [selectedMonth, selectedYear, sessions]);

  useEffect(() => {
    calculateQuinzaineStats();
  }, [filteredSessions, selectedMonth, selectedYear]);

  const loadSessions = async () => {
    const data = await getRecentSessions(30);
    setSessions(data);
    setFilteredSessions(data);
    setCurrentPage(1);
  };

  const loadMonthlyStats = async () => {
    const stats = await getMonthlyStats(selectedMonth, selectedYear);
    setMonthlyStats(stats);
  };

  const calculateTotalAVerserAujourdhui = async () => {
    try {
      // Format YYYY-MM-DD pour correspondre au format de la base de données
      const today = new Date().toISOString().split('T')[0];

      console.log('📅 Calcul total versé pour la date:', today);

      const { data, error } = await supabase
        .from('sessions')
        .select('versement, date_session, date_versement')
        .eq('date_versement', today);

      if (error) {
        console.error('❌ Erreur requête sessions:', error);
        throw error;
      }

      console.log(`📊 Sessions avec date_versement = ${today}:`, data?.length || 0);

      const total = data?.reduce((sum, session) => {
        const versement = session.versement || 0;
        console.log(`  - Date session: ${session.date_session}, Date versement: ${session.date_versement}, Versement: ${versement}`);
        return sum + versement;
      }, 0) || 0;

      console.log(`✅ Total versé aujourd'hui: ${total.toFixed(3)} DT`);
      setTotalAVerserAujourdhui(total);
    } catch (error) {
      console.error('❌ Erreur calcul total versé:', error);
      setTotalAVerserAujourdhui(0);
    }
  };

  const handleOpenAvisModal = () => {
    if (totalAVerserAujourdhui > 0) {
      setShowAvisModal(true);
    } else {
      setMessage('Aucun versement à effectuer aujourd\'hui');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleCloseAvisModal = () => {
    setShowAvisModal(false);
    setAvisFormData({
      banque: 'ATTIJARI',
      compteBancaire: ''
    });
  };

  const handleGenerateAvis = async () => {
    if (!avisFormData.compteBancaire.trim()) {
      setMessage('Veuillez saisir le compte bancaire');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Format YYYY-MM-DD pour correspondre au format de la base de données
    const today = new Date().toISOString().split('T')[0];

    console.log('📝 Génération avis de versement pour:', today);

    generateAvisVersementPDF({
      banque: avisFormData.banque,
      compteBancaire: avisFormData.compteBancaire,
      dateSession: today,
      montantTotal: totalAVerserAujourdhui
    });

    try {
      // Récupérer uniquement les sessions non versées pour la date d'aujourd'hui
      const { data: sessionsToUpdate, error: fetchError } = await supabase
        .from('sessions')
        .select('id, total_espece, charges, statut')
        .eq('date_session', today)
        .eq('statut', 'Non versé'); // Filtrer uniquement les sessions non versées

      if (fetchError) {
        console.error('❌ Erreur récupération sessions:', fetchError);
        throw fetchError;
      }

      console.log(`📊 Sessions à mettre à jour: ${sessionsToUpdate?.length || 0}`);

      if (sessionsToUpdate && sessionsToUpdate.length > 0) {
        for (const session of sessionsToUpdate) {
          const versementAmount = session.total_espece - session.charges;

          console.log(`💰 Mise à jour session ${session.id}: versement = ${versementAmount} DT`);

          const { error: updateError } = await supabase
            .from('sessions')
            .update({
              date_versement: today, // Format YYYY-MM-DD
              versement: versementAmount,
              banque: avisFormData.banque,
              statut: 'Versé'
            })
            .eq('id', session.id);

          if (updateError) {
            console.error(`❌ Erreur mise à jour session ${session.id}:`, updateError);
            throw updateError;
          }
        }
      }

      setTotalAVerserAujourdhui(0);
      setMessage('Avis de versement généré avec succès');
      console.log('✅ Avis de versement généré et sessions mises à jour');
      handleCloseAvisModal();
      await loadSessions();
      await calculateTotalAVerserAujourdhui();
    } catch (error) {
      console.error('❌ Erreur mise à jour sessions:', error);
      setMessage('Erreur lors de la mise à jour des sessions');
    }

    setTimeout(() => setMessage(''), 3000);
  };

  const calculateQuinzaineStats = () => {
    const currentMonthSessions = filteredSessions.filter(session => {
      const sessionDate = new Date(session.date_session);
      return sessionDate.getMonth() + 1 === selectedMonth && 
             sessionDate.getFullYear() === selectedYear;
    });

    let premiereQuinzaine = 0;
    let deuxiemeQuinzaine = 0;

    currentMonthSessions.forEach(session => {
      const sessionDate = new Date(session.date_session);
      const day = sessionDate.getDate();
      
      if (day <= 15) {
        premiereQuinzaine += session.charges;
      } else {
        deuxiemeQuinzaine += session.charges;
      }
    });

    const total = premiereQuinzaine + deuxiemeQuinzaine;
    
    setQuinzaineStats({
      premiere: premiereQuinzaine,
      deuxieme: deuxiemeQuinzaine,
      total: total
    });
  };

  const getQuinzaineDates = () => {
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    
    return {
      premiere: `1-15 ${monthNames[selectedMonth - 1]} ${selectedYear}`,
      deuxieme: `16-${new Date(selectedYear, selectedMonth, 0).getDate()} ${monthNames[selectedMonth - 1]} ${selectedYear}`
    };
  };

  // Fonctions pour la gestion des remarques
  const startEditingRemarque = (sessionId: number, currentRemarque: string | null) => {
    setEditingRemarque(sessionId);
    setTempRemarque(currentRemarque || '');
  };

  const cancelEditingRemarque = () => {
    setEditingRemarque(null);
    setTempRemarque('');
  };

  const saveRemarque = async (sessionId: number) => {
    try {
      console.log('💾 Sauvegarde remarque pour session:', sessionId, 'remarque:', tempRemarque);
      
      const success = await updateSessionRemarques(sessionId, tempRemarque.trim());
      
      if (success) {
        setMessage('Remarque enregistrée avec succès');
        // Mettre à jour l'état local
        const updatedSessions = sessions.map(session =>
          session.id === sessionId 
            ? { ...session, Remarques: tempRemarque.trim() } 
            : session
        );
        setSessions(updatedSessions);
        setFilteredSessions(updatedSessions);
        
        setEditingRemarque(null);
        setTempRemarque('');
        
        console.log('✅ Remarque sauvegardée localement');
      } else {
        setMessage('Erreur lors de l\'enregistrement de la remarque');
        console.error('❌ Erreur lors de la sauvegarde');
      }
    } catch (error) {
      setMessage('Erreur lors de l\'enregistrement de la remarque');
      console.error('❌ Erreur sauvegarde remarque:', error);
    }
    
    setTimeout(() => setMessage(''), 3000);
  };

  const deleteRemarque = async (sessionId: number) => {
    try {
      console.log('🗑️ Suppression remarque pour session:', sessionId);
      
      const success = await updateSessionRemarques(sessionId, null);
      
      if (success) {
        setMessage('Remarque supprimée avec succès');
        // Mettre à jour l'état local
        const updatedSessions = sessions.map(session =>
          session.id === sessionId 
            ? { ...session, Remarques: null } 
            : session
        );
        setSessions(updatedSessions);
        setFilteredSessions(updatedSessions);
        
        console.log('✅ Remarque supprimée localement');
      } else {
        setMessage('Erreur lors de la suppression de la remarque');
        console.error('❌ Erreur lors de la suppression');
      }
    } catch (error) {
      setMessage('Erreur lors de la suppression de la remarque');
      console.error('❌ Erreur suppression remarque:', error);
    }
    
    setTimeout(() => setMessage(''), 3000);
  };

  // Fonction pour vérifier et synchroniser tous les totaux espèce
  const verifySessionTotals = async () => {
    setIsVerifying(true);
    setMessage('🔍 Vérification des totaux espèce en cours...');
    
    try {
      await verifyAndSyncSessionTotals();
      
      // Recharger les sessions après vérification
      await loadSessions();
      
      setMessage('✅ Vérification des totaux terminée - Sessions mises à jour');
    } catch (error) {
      setMessage('❌ Erreur lors de la vérification des totaux');
      console.error('Erreur vérification totaux:', error);
    } finally {
      setIsVerifying(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // Fonction pour vérifier une session spécifique
  const verifySingleSessionTotal = async (sessionId: number, dateSession: string) => {
    try {
      const calculatedTotal = await calculateTotalEspeceFromRapport(dateSession);
      
      // Récupérer le total actuel de la session
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;

      const difference = Math.abs(calculatedTotal - session.total_espece);
      
      if (difference > 0.01) {
        console.warn(`⚠️ Session ${sessionId}: Incohérence détectée!`);
        console.log(`   Table sessions: ${session.total_espece} DT`);
        console.log(`   Table rapport: ${calculatedTotal} DT`);
        console.log(`   Différence: ${difference.toFixed(2)} DT`);
        
        setMessage(`⚠️ Incohérence détectée pour la session du ${dateSession}`);
        return {
          sessionId,
          dateSession,
          currentTotal: session.total_espece,
          calculatedTotal,
          difference
        };
      } else {
        console.log(`✅ Session ${sessionId}: Total cohérent (${session.total_espece} DT)`);
        return null;
      }
    } catch (error) {
      console.error('❌ Erreur vérification session:', error);
      return null;
    }
  };

  // Vérification automatique au chargement
  useEffect(() => {
    const verifyAllSessionsOnLoad = async () => {
      if (filteredSessions.length > 0) {
        console.log('🔍 Vérification automatique des totaux au chargement...');
        const inconsistencies = [];
        
        for (const session of filteredSessions) {
          const result = await verifySingleSessionTotal(session.id, session.date_session);
          if (result) {
            inconsistencies.push(result);
          }
        }
        
        if (inconsistencies.length > 0) {
          console.log(`⚠️ ${inconsistencies.length} incohérences détectées`);
          setMessage(`⚠️ ${inconsistencies.length} incohérences détectées - Cliquez sur "Vérifier les Totaux" pour corriger`);
          setTimeout(() => setMessage(''), 7000);
        }
      }
    };

    verifyAllSessionsOnLoad();
  }, [filteredSessions]);

  const handleFilter = async () => {
    if (!dateDebut || !dateFin) {
      setMessage('Veuillez saisir les deux dates');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const data = await getSessionsByDateRange(dateDebut, dateFin);
    setFilteredSessions(data);
  };

  const handleResetFilter = () => {
    setDateDebut('');
    setDateFin('');
    setFilteredSessions(sessions);
    setCurrentPage(1);
  };

  const handleSaveVersement = async () => {
    if (!formData.versement || !formData.dateVersement || !formData.dateSession) {
      setMessage('Veuillez remplir tous les champs obligatoires');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const session = sessions.find(s => s.date_session === formData.dateSession);
    if (!session) {
      setMessage('Session introuvable');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const success = await updateSessionVersement(
      session.id,
      parseFloat(formData.versement),
      formData.dateVersement,
      formData.banque,
      parseFloat(formData.charges) || 0
    );

    if (success) {
      setMessage('Versement enregistré avec succès');

      setFormData({
        sessionId: '',
        dateSession: '',
        versement: '',
        dateVersement: '',
        charges: '',
        banque: 'ATTIJARI'
      });
      loadSessions();
      calculateTotalAVerserAujourdhui();
    } else {
      setMessage('Erreur lors de l\'enregistrement');
    }

    setTimeout(() => setMessage(''), 3000);
  };

  const calculateSolde = (session: SessionData): number => {
    const netEspece = session.total_espece - session.charges;
    return session.versement - netEspece;
  };

  const exportToExcel = () => {
    const dataToExport = filteredSessions.map(session => ({
      'Date Session': session.date_session,
      'Total Espèce': session.total_espece,
      'Charges': session.charges,
      'Net': session.total_espece - session.charges,
      'Versement': session.versement,
      'Date Versement': session.date_versement || '',
      'Banque': session.banque || '',
      'Solde': calculateSolde(session),
      'Statut': session.statut,
      'Remarques': session.Remarques || '',
      'Créé par': session.cree_par
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sessions');
    XLSX.writeFile(wb, `sessions_${dateDebut || 'toutes'}_${dateFin || 'dates'}.xlsx`);
  };

  const quinzaineDates = getQuinzaineDates();

  const getPaginatedSessions = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredSessions.slice(startIndex, endIndex);
  };

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / itemsPerPage));
  const paginatedSessions = getPaginatedSessions();

  return (
    <div className="space-y-6">
      {monthlyStats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-3">
              <TrendingUp className="w-6 h-6 text-orange-600" />
              <h3 className="text-lg font-bold text-orange-900">Sessions Non Versées</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-3 py-1 border border-orange-300 rounded-lg text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2024, i, 1).toLocaleDateString('fr-FR', { month: 'long' })}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-20 px-3 py-1 border border-orange-300 rounded-lg text-sm"
                />
              </div>
              <p className="text-3xl font-bold text-orange-700">{monthlyStats.nonVersees.count}</p>
              <p className="text-sm text-orange-600">Total: {monthlyStats.nonVersees.total.toFixed(2)} DT</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-3">
              <DollarSign className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-bold text-green-900">Sessions Versées</h3>
            </div>
            <p className="text-3xl font-bold text-green-700">{monthlyStats.versees.count}</p>
            <p className="text-sm text-green-600">Total: {monthlyStats.versees.total.toFixed(2)} DT</p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-3">
              <Building2 className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-bold text-blue-900">Charges 1ère Quinzaine</h3>
            </div>
            <p className="text-3xl font-bold text-blue-700">{quinzaineStats.premiere.toFixed(2)} DT</p>
            <p className="text-sm text-blue-600">{quinzaineDates.premiere}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-3">
              <Building2 className="w-6 h-6 text-purple-600" />
              <h3 className="text-lg font-bold text-purple-900">Charges 2ème Quinzaine</h3>
            </div>
            <p className="text-3xl font-bold text-purple-700">{quinzaineStats.deuxieme.toFixed(2)} DT</p>
            <p className="text-sm text-purple-600">{quinzaineDates.deuxieme}</p>
          </div>

          <div
            className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all transform hover:scale-105"
            onClick={handleOpenAvisModal}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <DollarSign className="w-6 h-6 text-emerald-600" />
                <h3 className="text-lg font-bold text-emerald-900">Total à Verser Aujourd'hui</h3>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-emerald-600">Cliquez pour générer l'avis</p>
                <p className="text-3xl font-bold text-emerald-700">
                  {totalAVerserAujourdhui.toFixed(3)} DT
                </p>
              </div>
              <div className="pt-2 border-t border-emerald-200">
                <p className="text-xs text-emerald-600 italic">
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-green-100 rounded-lg">
            <Building2 className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Versement Bancaire</h2>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg ${
            message.includes('✅') || message.includes('succès') ? 'bg-green-100 text-green-800' : 
            message.includes('⚠️') || message.includes('Incohérence') ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de Session
              </label>
              <input
                type="date"
                value={formData.dateSession}
                onChange={(e) => setFormData({ ...formData, dateSession: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Charges
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.charges}
                onChange={(e) => setFormData({ ...formData, charges: e.target.value })}
                placeholder="0.00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Banque
              </label>
              <select
                value={formData.banque}
                onChange={(e) => setFormData({ ...formData, banque: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ATTIJARI">ATTIJARI</option>
                <option value="BIAT">BIAT</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Versement
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.versement}
                onChange={(e) => setFormData({ ...formData, versement: e.target.value })}
                placeholder="0.00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de Versement
              </label>
              <input
                type="date"
                value={formData.dateVersement}
                onChange={(e) => setFormData({ ...formData, dateVersement: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={handleSaveVersement}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
            >
              <DollarSign className="w-5 h-5" />
              <span>Enregistrer le Versement</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-800">Liste des Sessions</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={verifySessionTotals}
              disabled={isVerifying}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center space-x-2"
              title="Vérifier la cohérence des totaux espèce avec la table rapport"
            >
              <RefreshCw className={`w-5 h-5 ${isVerifying ? 'animate-spin' : ''}`} />
              <span>{isVerifying ? 'Vérification...' : 'Vérifier les Totaux'}</span>
            </button>
            <button
              onClick={exportToExcel}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center space-x-2"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span>Exporter Excel</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Début</label>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Fin</label>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-end space-x-2">
            <button
              onClick={handleFilter}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Filtrer
            </button>
            <button
              onClick={handleResetFilter}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Session</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Espèce</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Charges</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Versement</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Versement</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Banque</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Solde</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remarques</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedSessions.map((session) => {
                const solde = calculateSolde(session);
                return (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{session.date_session}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{session.total_espece.toFixed(2)} DT</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{session.charges.toFixed(2)} DT</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{session.versement.toFixed(2)} DT</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{session.date_versement || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{session.banque || '-'}</td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${solde < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {solde.toFixed(2)} DT
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                      {editingRemarque === session.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={tempRemarque}
                            onChange={(e) => setTempRemarque(e.target.value)}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="Saisir une remarque..."
                            autoFocus
                          />
                          <button
                            onClick={() => saveRemarque(session.id)}
                            className="p-1 text-green-600 hover:text-green-800"
                            title="Enregistrer"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEditingRemarque}
                            className="p-1 text-gray-600 hover:text-gray-800"
                            title="Annuler"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className={`${!session.Remarques ? 'text-gray-400 italic' : ''}`}>
                            {session.Remarques || 'Aucune remarque'}
                          </span>
                          <div className="flex items-center space-x-1 ml-2">
                            <button
                              onClick={() => startEditingRemarque(session.id, session.Remarques)}
                              className="p-1 text-blue-600 hover:text-blue-800"
                              title="Modifier la remarque"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {session.Remarques && (
                              <button
                                onClick={() => deleteRemarque(session.id)}
                                className="p-1 text-red-600 hover:text-red-800"
                                title="Supprimer la remarque"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        session.statut === 'Versé' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {session.statut}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-6 px-4">
          <div className="text-sm text-gray-600">
            Affichage {(currentPage - 1) * itemsPerPage + 1} à {Math.min(currentPage * itemsPerPage, filteredSessions.length)} sur {filteredSessions.length} sessions
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
            >
              <span>← Précédent</span>
            </button>
            <span className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
            >
              <span>Suivant →</span>
            </button>
          </div>
        </div>
      </div>

      {showAvisModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Avis de Versement Bancaire</h2>
              <button
                onClick={handleCloseAvisModal}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg p-4 border border-emerald-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-600 font-medium">Date de Session</p>
                    <p className="text-lg font-bold text-emerald-900">
                      {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-emerald-600 font-medium">Montant Total</p>
                    <p className="text-2xl font-bold text-emerald-700">
                      {totalAVerserAujourdhui.toFixed(3)} DT
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 font-medium mb-2">Montant en lettres :</p>
                <p className="text-base text-gray-900 italic">
                  {totalAVerserAujourdhui > 0 ? numberToWords(totalAVerserAujourdhui) : 'zéro dinars'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Banque
                  </label>
                  <select
                    value={avisFormData.banque}
                    onChange={(e) => setAvisFormData({ ...avisFormData, banque: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="ATTIJARI">ATTIJARI</option>
                    <option value="BIAT">BIAT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Compte Bancaire
                  </label>
                  <input
                    type="text"
                    value={avisFormData.compteBancaire}
                    onChange={(e) => setAvisFormData({ ...avisFormData, compteBancaire: e.target.value })}
                    placeholder="Ex: 12345678901234567890"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-500 italic mb-2">Signature :</p>
                <p className="text-base font-bold text-gray-900">SHIRI FARES HAMZA</p>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  onClick={handleGenerateAvis}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
                >
                  <Download className="w-5 h-5" />
                  <span>Générer et Valider</span>
                </button>
                <button
                  onClick={handleCloseAvisModal}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VersementBancaire;
