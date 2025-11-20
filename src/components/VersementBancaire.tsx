
Add Remarks Feature to Session Management
Message pour demander une remise
Api paiement integration tunisia
Link api gateaway payrnent ksa t
Création d'application gestion assurance agents
Demande de réparations provisoires RGA
Optimizing Credit Payment Data Integrity
Demande d'accès API Registre National
Ideas to make money 2025
Clarifications sur prise en charge LASIK et soins
Demande de convention de courtage avec BH Assurance
Proposer avantages exclusifs BRIDGES santé
Offre d'assurance groupe exclusive et innovante
Email pour dire que le client a
Relance pour solution d'assurance groupe KOPP
Nom de page Instagram pour luxe et pouvoir
Helping Aspiring Millionaires Achieve Luxury Lifestyle
Propositions d'assurance santé pour employés
Proposer signature convocation assurance LinkedIn
import React, { useState, useEff
Expertise assurance et technologie avancée
Entrepreneur Assurance & Développement Applications
Assurance santé : clé de motivation en Tunisie
Analyse des paiements et encaissements
Automating SQL Calculations for Payment Data
React Encaissement App with Supabase Integration
PostgreSQL Trigger Error and Solutions
Adding Remarks to VersementBancaire Component
Update Payment Type in Financial Management
Rendre Encaissement accessible à tous
Enregistrement encaissement dans Supabase
Transférer données terme vers RP Supabase
Ajout et calcul cumulatif colonne ReportDeport
وكالة لسحب الأموال من حساب التوفيز
Relations entre tables dans Supabase
React Encaissement System with Supabase Integration
Je veux inserer dans la lage d’a
Ajouter bouton export XLSX aux données
import React, { useState } from
Je veux qu’apres la connexion un
Vérification des données Excel avec couleur
comment verifier l'existance des
أساسيات حصص جماعية للمدربين
import { supabase } from '../lib
أساسيات قيادة حصص جماعية ناجحة
Post linked in pour promoumoire
React Financial Management System Code Implementation
Fixing Remise Saving Error in React
تحليل تمارين الكور بلاست والبطن
مقارنة بين كور بلاست وتمارين البطن
React Encaissement Component with Supabase Integration
Ajout de vérification paiement crédit
Prostate Pain During Farting Explained
Douleur après application d'eau froide prostatique
React Logout Confirmation Button Locking Logic
React Component for Session Total Verification
Post surgery linked in pour prom
import { DollarSign, Calendar, B
حماية محاصيلك من تقلبات الطقس
Demande d'autorisation souscription tracteur classe 5
Analyse technique boursière : principes et outils
قضية خيانة مؤتمن تونس
Vérifier niveau huile moteur voiture
Migration du parc vers contrats flotte
Proposition d'échelonnement des primes et IRDS
Ebe vs ebitda
Fonctionnement du chèque-cadeau expliqué
import { supabase } from '../lib
Create Home Page with STAR Assurances Logo
Update code for credit expiration handling
Assurance Auto Premium : Offre Exclusivité
Reconfiguring Training Schedule Table Layout
Supabase Credit Search with Timestamps
React Credit Payment System Implementation
TypeScript Syntax Error: Unexpected Closing Brace
Supabase Free Tier and Pricing Details
Lock Payment Dates in Financial Management
Ajout d'export Excel pour termes Supabase
React Component for Credit Search and Export
Optimisez votre fiscalité avec assurance épargne
Tableau PDF paysage GX Training Schedule
Amélioration du thème et des couleurs
Verrouiller la date de paiement sinistre
import React, { useState, useEff
Ouverture de comptes en devises Tunisie
Idées de projets en ligne à haut revenu
Erreur insertion contrats PostgreSQL : solutions
Demande d'annulation et réparations à domicile
Ouverture de filiales en France et Arabie Saoudite
Financial Management System with User Input
Acceptation de l'offre et souscription prochaine
Proposition d'offre d'assurance révisée
Bonjou epi esplike ki jan mwen ka asistew.
Modern Dark Green Login Form Design
زيارة عائلية السعودية: تعليمات ومتطلبات
Dépôt quittance règlement Tabarki Kais
Validation devis véhicule X, informations complémentaires
Garantie vol incluse pour engins de chantier
Nouvelle Garantie Protection Juridique Professionnelle
Rachat total contrat assurance-vie 7ayya
ممارسة العادة السرية أثناء الحمل
Add Remarks Feature to Session Management
import { useState, useEffect } from 'react';
import { DollarSign, Calendar, Building2, Download, FileSpreadsheet, TrendingUp, RefreshCw } from 'lucide-react';
import { getRecentSessions, getSessionsByDateRange, updateSessionVersement, getMonthlyStats, verifyAndSyncSessionTotals, calculateTotalEspeceFromRapport } from '../utils/sessionService';
import * as XLSX from 'xlsx';

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

  const [formData, setFormData] = useState({
    sessionId: '',
    dateSession: '',
    versement: '',
    dateVersement: '',
    charges: '',
    banque: 'ATTIJARI'
  });

  useEffect(() => {
    loadSessions();
    loadMonthlyStats();
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    calculateQuinzaineStats();
  }, [filteredSessions, selectedMonth, selectedYear]);

  const loadSessions = async () => {
    const data = await getRecentSessions(15);
    setSessions(data);
    setFilteredSessions(data);
  };

  const loadMonthlyStats = async () => {
    const stats = await getMonthlyStats(selectedMonth, selectedYear);
    setMonthlyStats(stats);
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
      'Créé par': session.cree_par
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sessions');
    XLSX.writeFile(wb, `sessions_${dateDebut || 'toutes'}_${dateFin || 'dates'}.xlsx`);
  };

  const quinzaineDates = getQuinzaineDates();

  return (
    <div className="space-y-6">
      {monthlyStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSessions.map((session) => {
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
      </div>
    </div>
  );
};

export default VersementBancaire;