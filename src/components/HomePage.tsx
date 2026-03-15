import React, { useState, useEffect } from 'react';
import { AlertCircle, Calendar, CheckCircle, Clock, TrendingUp, Filter, DollarSign, X } from 'lucide-react';
import { getAvailableMonths, getUnpaidTermesByMonth, getOverdueUnpaidTermes, getPaidTermesByMonth, getUpcomingTermes, getCreditsDueToday, verifyTermeStatusWithEcheance } from '../utils/supabaseService';
import { getSessionDate } from '../utils/auth';
import { isSessionClosed } from '../utils/sessionService';
import { supabase } from '../lib/supabase';
import TaskManagement from './TaskManagement';
import RemarqueModal from './RemarqueModal';

interface CircularStatCardProps {
  title: string;
  subtitle: string;
  count: number;
  total: number;
  percentage: number;
  color: string;
  icon: React.ReactNode;
  onClick: () => void;
  showAmount?: boolean;
}

const CircularStatCard: React.FC<CircularStatCardProps> = ({
  title,
  subtitle,
  count,
  total,
  percentage,
  color,
  icon,
  onClick,
  showAmount = true
}) => {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
    >
      <div className="flex flex-col items-center">
        <div className="relative w-32 h-32 mb-3">
          <svg className="transform -rotate-90 w-32 h-32">
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="#E5E7EB"
              strokeWidth="10"
              fill="none"
            />
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke={color}
              strokeWidth="10"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div style={{ color }} className="mb-0.5">
              {icon}
            </div>
            <span className="text-2xl font-bold text-gray-900">{count}</span>
            <span className="text-xs text-gray-500">{percentage.toFixed(0)}%</span>
          </div>
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-0.5 text-center">{title}</h3>
        <p className="text-xs text-gray-500 mb-2 text-center">{subtitle}</p>
        {showAmount && (
          <div className="text-xl font-bold" style={{ color }}>{total.toFixed(2)} DT</div>
        )}
      </div>
    </div>
  );
};

interface HomePageProps {
  username?: string;
}

const HomePage: React.FC<HomePageProps> = ({ username }) => {
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [availableYears, setAvailableYears] = useState<string[]>([]);

  const [overdueTermes, setOverdueTermes] = useState<any[]>([]);
  const [unpaidTermes, setUnpaidTermes] = useState<any[]>([]);
  const [paidTermes, setPaidTermes] = useState<any[]>([]);
  const [upcomingTermes, setUpcomingTermes] = useState<any[]>([]);
  const [creditsDueToday, setCreditsDueToday] = useState<any[]>([]);
  const [carnetStats, setCarnetStats] = useState<{
    carnets_accomplis: number;
    total_carnets: number;
  } | null>(null);

  const [showOverdueDetails, setShowOverdueDetails] = useState(false);
  const [showUnpaidDetails, setShowUnpaidDetails] = useState(false);
  const [showPaidDetails, setShowPaidDetails] = useState(false);
  const [showUpcomingDetails, setShowUpcomingDetails] = useState(false);
  const [showCreditsDueTodayDetails, setShowCreditsDueTodayDetails] = useState(false);

  const [daysFilter, setDaysFilter] = useState<number>(7);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreditAlert, setShowCreditAlert] = useState(false);
  const [showTaskAlert, setShowTaskAlert] = useState(false);
  const [sessionClosed, setSessionClosed] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [sessionTasks, setSessionTasks] = useState<any[]>([]);
  const [totalUncompletedTasks, setTotalUncompletedTasks] = useState<number>(0);

  const [isRemarqueModalOpen, setIsRemarqueModalOpen] = useState(false);
  const [selectedContrat, setSelectedContrat] = useState<any>(null);
  const [hasShownCreditAlert, setHasShownCreditAlert] = useState(false);
  const [hasShownTaskAlert, setHasShownTaskAlert] = useState(false);

  const isHamza = username?.toLowerCase() === 'hamza';

  useEffect(() => {
    loadAvailableMonths();
    checkSessionStatus();
    loadCreditsDueToday();
    loadSessionTasks();
    loadTotalUncompletedTasks();
    loadCarnetStatistics();
  }, []);

  useEffect(() => {
    if (selectedMonth && selectedYear) {
      syncAndLoadData();
    }
  }, [selectedMonth, selectedYear, daysFilter]);

  const syncAndLoadData = async () => {
    if (!selectedMonth || !selectedYear) return;

    setIsLoading(true);
    try {
      const monthParts = selectedMonth.toLowerCase().split(' ');
      const monthName = monthParts[0];
      const year = monthParts[1];

      console.log(`🔄 Synchronisation automatique pour ${monthName} ${year}...`);

      await verifyTermeStatusWithEcheance(monthName, year);

      console.log('✅ Synchronisation automatique terminée, chargement des données...');
      await loadTermesData();
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation automatique:', error);
      await loadTermesData();
    }
  };

  useEffect(() => {
    if (creditsDueToday.length > 0 && !showCreditAlert && !hasShownCreditAlert) {
      setShowCreditAlert(true);
      setHasShownCreditAlert(true);
    }
  }, [creditsDueToday, showCreditAlert, hasShownCreditAlert]);

  useEffect(() => {
    if (sessionTasks.length > 0 && !showTaskAlert && !showCreditAlert && !hasShownTaskAlert) {
      setTimeout(() => {
        setShowTaskAlert(true);
        setHasShownTaskAlert(true);
      }, 500);
    }
  }, [sessionTasks, showCreditAlert, showTaskAlert, hasShownTaskAlert]);

  useEffect(() => {
    if (showCreditAlert || showTaskAlert) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showCreditAlert, showTaskAlert]);

  const checkSessionStatus = async () => {
    const sessionDate = getSessionDate();
    if (sessionDate) {
      const closed = await isSessionClosed(sessionDate);
      setSessionClosed(closed);

      // Vérifier si une session existe déjà pour cette date
      const { data } = await supabase
        .from('sessions')
        .select('id')
        .eq('date_session', sessionDate)
        .maybeSingle();

      if (data) {
        setCurrentSessionId(data.id);
      } else {
        // Créer une nouvelle session vide si elle n'existe pas
        console.log('📅 Aucune session trouvée pour', sessionDate, '- Création automatique...');

        const { data: newSession, error } = await supabase
          .from('sessions')
          .insert({
            date_session: sessionDate,
            total_espece: 0,
            cree_par: username,
            statut: 'Non versé',
            session_fermee: false
          })
          .select('id')
          .maybeSingle();

        if (error) {
          console.error('❌ Erreur création session automatique:', error);
        } else if (newSession) {
          console.log('✅ Session créée automatiquement:', newSession.id);
          setCurrentSessionId(newSession.id);
        }
      }
    }
  };

  const loadAvailableMonths = async () => {
    const months = await getAvailableMonths();
    setAvailableMonths(months);

    const years = Array.from(new Set(
      months.map(month => {
        const parts = month.split(' ');
        return parts[1];
      }).filter(year => year)
    )).sort((a, b) => parseInt(b) - parseInt(a));

    setAvailableYears(years);

    const monthsFR = [
      'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'
    ];

    const sessionDate = getSessionDate();

    let currentMonthIndex: number;
    let currentYear: string;

    if (sessionDate) {
      const dateParts = sessionDate.split('-');
      currentYear = dateParts[0];
      currentMonthIndex = parseInt(dateParts[1], 10) - 1;
    } else {
      const now = new Date();
      currentYear = now.getFullYear().toString();
      currentMonthIndex = now.getMonth();
    }

    const currentMonthName = monthsFR[currentMonthIndex];
    const currentMonthYear = `${currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1)} ${currentYear}`;

    console.log('Date de session:', sessionDate);
    console.log('Mois calculé:', currentMonthYear);
    console.log('Mois disponibles:', months);

    setSelectedYear(currentYear);

    if (months.includes(currentMonthYear)) {
      setSelectedMonth(currentMonthYear);
      console.log('Mois trouvé et sélectionné:', currentMonthYear);
    } else if (months.length > 0) {
      const currentYearMonths = months.filter(m => m.includes(currentYear));
      if (currentYearMonths.length > 0) {
        setSelectedMonth(currentYearMonths[0]);
        console.log('Mois de l\'année en cours sélectionné:', currentYearMonths[0]);
      } else {
        setSelectedMonth(months[0]);
        const parts = months[0].split(' ');
        if (parts[1]) {
          setSelectedYear(parts[1]);
        }
        console.log('Premier mois disponible sélectionné:', months[0]);
      }
    }
  };

  const loadTermesData = async () => {
    setIsLoading(true);
    try {
      const monthParts = selectedMonth.toLowerCase().split(' ');
      if (monthParts.length < 2) return;

      const monthName = monthParts[0];
      const year = monthParts[1];

      const [overdue, unpaid, paid, upcoming] = await Promise.all([
        getOverdueUnpaidTermes(monthName, year),
        getUnpaidTermesByMonth(monthName, year),
        getPaidTermesByMonth(monthName, year),
        getUpcomingTermes(monthName, year, daysFilter)
      ]);

      setOverdueTermes(overdue);
      setUnpaidTermes(unpaid);
      setPaidTermes(paid);
      setUpcomingTermes(upcoming);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCreditsDueToday = async () => {
    try {
      const sessionDate = getSessionDate();
      if (sessionDate) {
        const credits = await getCreditsDueToday(sessionDate);
        setCreditsDueToday(credits);
        console.log('Crédits à payer chargés:', credits.length);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des crédits à payer aujourd\'hui:', error);
    }
  };

  const loadSessionTasks = async () => {
    try {
      const sessionDate = getSessionDate();
      if (sessionDate) {
        const { data, error } = await supabase
          .from('taches')
          .select('*')
          .eq('date_effectuer', sessionDate)
          .eq('statut', 'A faire')
          .order('degre_importance', { ascending: true });

        if (error) throw error;
        setSessionTasks(data || []);
      } else {
        setSessionTasks([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des tâches de la session:', error);
    }
  };

  const loadTotalUncompletedTasks = async () => {
    try {
      const { count, error } = await supabase
        .from('taches')
        .select('*', { count: 'exact', head: true })
        .eq('statut', 'A faire');

      if (error) throw error;
      setTotalUncompletedTasks(count || 0);
    } catch (error) {
      console.error('Erreur lors du chargement du nombre total de tâches non accomplies:', error);
    }
  };

  const loadCarnetStatistics = async () => {
    try {
      const { data, error } = await supabase.rpc('get_carnet_statistics');

      if (error) throw error;

      if (data && data.length > 0) {
        setCarnetStats({
          carnets_accomplis: data[0].carnets_accomplis || 0,
          total_carnets: data[0].total_carnets || 0
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques de carnets:', error);
    }
  };

  const calculateTotal = (termes: any[]) => {
    return termes.reduce((sum, terme) => {
      const prime = parseFloat(terme.prime);
      return sum + (isNaN(prime) ? 0 : prime);
    }, 0);
  };

  const calculateCreditTotal = (credits: any[]) => {
    return credits.reduce((sum, credit) => {
      const solde = parseFloat(credit.solde || credit.montant_credit);
      return sum + (isNaN(solde) ? 0 : solde);
    }, 0);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
  };

  const handleTermeClick = (terme: any) => {
    // Extraire le mois et l'année du mois sélectionné
    const monthParts = selectedMonth.split(' ');
    const mois = monthParts.length >= 2 
      ? `${monthParts[1]}-${String(monthsFR.indexOf(monthParts[0].toLowerCase()) + 1).padStart(2, '0')}`
      : '';

    setSelectedContrat({
      police: terme.numero_contrat,
      mois: mois,
      terme: 0,
      remarque: terme.remarque,
      date_remarque: terme.date_remarque,
      user_remarque: terme.user_remarque,
      echeance: terme.echeance,
      assure: terme.assure,
      prime: terme.prime,
      id: terme.id, // Important pour la mise à jour dans la table
      table_mois: selectedMonth // Ajouté pour référence
    });
    setIsRemarqueModalOpen(true);
  };

  const monthsFR = [
    'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'
  ];


  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-800">Dashboard</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-100 rounded-lg">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {username?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-700">{username}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {showCreditAlert && creditsDueToday.length > 0 && (
          <div
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowCreditAlert(false);
                if (sessionTasks.length > 0 && !hasShownTaskAlert) {
                  setTimeout(() => {
                    setShowTaskAlert(true);
                    setHasShownTaskAlert(true);
                  }, 300);
                }
              }
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-10 h-10" />
                  <div>
                    <h2 className="text-2xl font-bold">RAPPEL URGENT</h2>
                    <p className="text-red-100">Crédits à payer aujourd'hui</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowCreditAlert(false);
                    if (sessionTasks.length > 0 && !hasShownTaskAlert) {
                      setTimeout(() => {
                        setShowTaskAlert(true);
                        setHasShownTaskAlert(true);
                      }, 300);
                    }
                  }}
                  className="p-2 hover:bg-red-800 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <div className="mb-4 text-center">
                  <p className="text-lg text-gray-700">
                    <span className="font-bold text-red-600">{creditsDueToday.length}</span> crédit(s) à régler aujourd'hui
                  </p>
                  {isHamza && (
                    <p className="text-2xl font-bold text-red-600 mt-2">
                      Total: {calculateCreditTotal(creditsDueToday).toFixed(2)} DT
                    </p>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-red-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">N° Contrat</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Assuré</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Branche</th>
                        {isHamza && (
                          <>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Crédit (DT)</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Solde (DT)</th>
                          </>
                        )}
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Statut</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date Prévue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {creditsDueToday.map((credit, index) => (
                        <tr key={index} className="hover:bg-red-50">
                          <td className="px-4 py-3 text-sm font-medium">{credit.numero_contrat}</td>
                          <td className="px-4 py-3 text-sm">{credit.assure}</td>
                          <td className="px-4 py-3 text-sm">{credit.branche}</td>
                          {isHamza && (
                            <>
                              <td className="px-4 py-3 text-sm font-semibold">{parseFloat(credit.montant_credit).toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm text-red-600 font-semibold">
                                {parseFloat(credit.solde || credit.montant_credit).toFixed(2)}
                              </td>
                            </>
                          )}
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              credit.statut === 'Non payé' ? 'bg-red-100 text-red-800' :
                              credit.statut === 'Payé partiellement' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {credit.statut}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-red-600 font-medium">
                            {formatDate(credit.date_paiement_prevue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => {
                      setShowCreditAlert(false);
                      if (sessionTasks.length > 0 && !hasShownTaskAlert) {
                        setTimeout(() => {
                          setShowTaskAlert(true);
                          setHasShownTaskAlert(true);
                        }, 300);
                      }
                    }}
                    className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showTaskAlert && sessionTasks.length > 0 && (
          <div
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowTaskAlert(false);
              }
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-10 h-10" />
                  <div>
                    <h2 className="text-2xl font-bold">RAPPEL DES TACHES NON ACCOMPLIES</h2>
                    <p className="text-blue-100">{sessionTasks.length} tâche(s) en attente</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTaskAlert(false)}
                  className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <div className="mb-4 text-center">
                  <p className="text-lg text-gray-700">
                    Vous avez <span className="font-bold text-blue-600">{sessionTasks.length}</span> tâche(s) non accomplie(s) à effectuer aujourd'hui
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Veuillez consulter ces tâches et les accomplir dès que possible
                  </p>
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-base text-red-800 font-semibold">
                      Total de toutes les tâches non accomplies : <span className="text-2xl">{totalUncompletedTasks}</span>
                    </p>
                  </div>
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800 font-medium">
                      Important : Assurez-vous de marquer chaque tâche comme "Accomplie" une fois terminée
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-blue-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Titre</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Importance</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Statut</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Chargé à</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {sessionTasks.map((task, index) => (
                        <tr key={index} className="hover:bg-blue-50">
                          <td className="px-4 py-3 text-sm font-medium">{task.titre}</td>
                          <td className="px-4 py-3 text-sm">{task.description || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-blue-600 font-medium">
                            {formatDate(task.date_effectuer)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              task.degre_importance === 'Urgent' ? 'bg-red-100 text-red-800' :
                              task.degre_importance === 'Haute' ? 'bg-orange-100 text-orange-800' :
                              task.degre_importance === 'Moyenne' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {task.degre_importance}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                              {task.statut}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">{task.utilisateur_charge}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => setShowTaskAlert(false)}
                    className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Tableau de bord des Termes</h1>
          <p className="text-sm text-gray-600">Vue d'ensemble des paiements et échéances</p>
        </div>

        <div className="mb-6">
          <TaskManagement
            currentUser={username || 'Inconnu'}
            sessionId={currentSessionId}
            isSessionClosed={sessionClosed}
            onTaskUpdate={() => {
              loadTotalUncompletedTasks();
              loadSessionTasks();
            }}
          />
        </div>

        {carnetStats && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Carnets d'Attestations</h3>
                  <p className="text-sm text-gray-600">Statistique des carnets accomplis</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-600">
                  {carnetStats.carnets_accomplis} / {carnetStats.total_carnets}
                </div>
                <p className="text-sm text-gray-600">carnets accomplis</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filtres</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Année
              </label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setSelectedMonth('');
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
              >
                <option value="">Choisir une année...</option>
                {availableYears.map((year, index) => (
                  <option key={index} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mois
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                disabled={!selectedYear}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Choisir un mois...</option>
                {availableMonths
                  .filter(month => month.includes(selectedYear))
                  .map((month, index) => (
                    <option key={index} value={month}>{month}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Échéances à venir (jours)
              </label>
              <select
                value={daysFilter}
                onChange={(e) => setDaysFilter(parseInt(e.target.value))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
              >
                <option value={7}>7 jours</option>
                <option value={15}>15 jours</option>
                <option value={30}>30 jours</option>
              </select>
            </div>
          </div>

        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : selectedMonth ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
              {(() => {
                // Calculer les totaux uniquement pour les contrats du mois sélectionné
                const totalPaid = calculateTotal(paidTermes);
                const totalUnpaid = calculateTotal(unpaidTermes);
                const totalUpcoming = calculateTotal(upcomingTermes);
                const totalOverdue = calculateTotal(overdueTermes);
                
                // Pour les pourcentages: payés vs non payés = 100%
                const totalTermesCount = paidTermes.length + unpaidTermes.length;
                const paidPercentage = totalTermesCount > 0 ? (paidTermes.length / totalTermesCount) * 100 : 0;
                const unpaidPercentage = totalTermesCount > 0 ? (unpaidTermes.length / totalTermesCount) * 100 : 0;
                
                // Pour les termes à venir et échus, on utilise leur propre total comme référence
                const upcomingPercentage = totalUnpaid > 0 ? (totalUpcoming / totalUnpaid) * 100 : 0;
                const overduePercentage = totalUnpaid > 0 ? (totalOverdue / totalUnpaid) * 100 : 0;

                return (
                  <>
                    <CircularStatCard
                      title="Termes Échus"
                      subtitle="Non payés et en retard"
                      count={overdueTermes.length}
                      total={totalOverdue}
                      percentage={overduePercentage}
                      color="#EF4444"
                      icon={<AlertCircle className="w-7 h-7" />}
                      onClick={() => setShowOverdueDetails(!showOverdueDetails)}
                      showAmount={isHamza}
                    />
                    <CircularStatCard
                      title="Termes Non Payés"
                      subtitle="Total dans le mois"
                      count={unpaidTermes.length}
                      total={totalUnpaid}
                      percentage={unpaidPercentage}
                      color="#F97316"
                      icon={<Clock className="w-7 h-7" />}
                      onClick={() => setShowUnpaidDetails(!showUnpaidDetails)}
                      showAmount={isHamza}
                    />
                    <CircularStatCard
                      title="Échéances Proches"
                      subtitle={`${daysFilter} prochains jours`}
                      count={upcomingTermes.length}
                      total={totalUpcoming}
                      percentage={upcomingPercentage}
                      color="#3B82F6"
                      icon={<Calendar className="w-7 h-7" />}
                      onClick={() => setShowUpcomingDetails(!showUpcomingDetails)}
                      showAmount={isHamza}
                    />
                    <CircularStatCard
                      title="Termes Payés"
                      subtitle="Total dans le mois"
                      count={paidTermes.length}
                      total={totalPaid}
                      percentage={paidPercentage}
                      color="#10B981"
                      icon={<CheckCircle className="w-7 h-7" />}
                      onClick={() => setShowPaidDetails(!showPaidDetails)}
                      showAmount={isHamza}
                    />
                  </>
                );
              })()}
            </div>

            {creditsDueToday.length > 0 && (
              <div className="mb-6">
                <CircularStatCard
                  title="Crédits à Payer Aujourd'hui"
                  subtitle={`Date de session: ${getSessionDate()}`}
                  count={creditsDueToday.length}
                  total={calculateCreditTotal(creditsDueToday)}
                  percentage={100}
                  color="#8B5CF6"
                  icon={<DollarSign className="w-7 h-7" />}
                  onClick={() => setShowCreditsDueTodayDetails(!showCreditsDueTodayDetails)}
                  showAmount={isHamza}
                />
              </div>
            )}

            {showOverdueDetails && overdueTermes.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h3 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-6 h-6" />
                  Détails des Termes Échus ({overdueTermes.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-red-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">N° Contrat</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Assuré</th>
                        {isHamza && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Prime (DT)</th>}
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Échéance</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Téléphone</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Remarque</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {overdueTermes.map((terme, index) => {
                        const remarqueLower = terme.remarque?.toLowerCase() || '';
                        const bgColor = remarqueLower === 'vendu' ? 'bg-yellow-100 hover:bg-yellow-200' :
                                       remarqueLower === 'rt' ? 'bg-blue-100 hover:bg-blue-200' :
                                       remarqueLower === 'a récupérer' ? 'bg-purple-100 hover:bg-purple-200' :
                                       'hover:bg-red-50';

                        return (
                          <tr
                            key={index}
                            className={`transition-colors cursor-pointer ${bgColor}`}
                            onClick={() => handleTermeClick(terme)}
                            title="Cliquez pour ajouter/modifier une remarque"
                          >
                            <td className="px-4 py-3 text-sm font-medium">{terme.numero_contrat}</td>
                            <td className="px-4 py-3 text-sm">{terme.assure}</td>
                            {isHamza && <td className="px-4 py-3 text-sm font-semibold">{parseFloat(terme.prime).toFixed(2)}</td>}
                            <td className="px-4 py-3 text-sm text-red-600 font-medium">{formatDate(terme.echeance)}</td>
                            <td className="px-4 py-3 text-sm">{terme.num_tel || terme.num_tel_2 || 'N/A'}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                !terme.remarque ? 'bg-gray-100 text-gray-800' :
                                terme.remarque.toLowerCase() === 'vendu' ? 'bg-yellow-100 text-yellow-800' :
                                terme.remarque.toLowerCase() === 'rt' ? 'bg-blue-100 text-blue-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {terme.remarque || 'Aucune'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {showUnpaidDetails && unpaidTermes.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h3 className="text-xl font-bold text-orange-600 mb-4 flex items-center gap-2">
                  <Clock className="w-6 h-6" />
                  Détails des Termes Non Payés ({unpaidTermes.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-orange-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">N° Contrat</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Assuré</th>
                        {isHamza && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Prime (DT)</th>}
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Échéance</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Téléphone</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Remarque</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {unpaidTermes.map((terme, index) => {
                        const remarqueLower = terme.remarque?.toLowerCase() || '';
                        const bgColor = remarqueLower === 'vendu' ? 'bg-yellow-100 hover:bg-yellow-200' :
                                       remarqueLower === 'rt' ? 'bg-blue-100 hover:bg-blue-200' :
                                       remarqueLower === 'a récupérer' ? 'bg-purple-100 hover:bg-purple-200' :
                                       'hover:bg-orange-50';

                        return (
                          <tr
                            key={index}
                            className={`transition-colors cursor-pointer ${bgColor}`}
                            onClick={() => handleTermeClick(terme)}
                            title="Cliquez pour ajouter/modifier une remarque"
                          >
                            <td className="px-4 py-3 text-sm font-medium">{terme.numero_contrat}</td>
                            <td className="px-4 py-3 text-sm">{terme.assure}</td>
                            {isHamza && <td className="px-4 py-3 text-sm font-semibold">{parseFloat(terme.prime).toFixed(2)}</td>}
                            <td className="px-4 py-3 text-sm">{formatDate(terme.echeance)}</td>
                            <td className="px-4 py-3 text-sm">{terme.num_tel || terme.num_tel_2 || 'N/A'}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                !terme.remarque ? 'bg-gray-100 text-gray-800' :
                                terme.remarque.toLowerCase() === 'vendu' ? 'bg-yellow-100 text-yellow-800' :
                                terme.remarque.toLowerCase() === 'rt' ? 'bg-blue-100 text-blue-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {terme.remarque || 'Aucune'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {showUpcomingDetails && upcomingTermes.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h3 className="text-xl font-bold text-blue-600 mb-4 flex items-center gap-2">
                  <Calendar className="w-6 h-6" />
                  Détails des Échéances Proches ({upcomingTermes.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-blue-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">N° Contrat</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Assuré</th>
                        {isHamza && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Prime (DT)</th>}
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Échéance</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Téléphone</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Remarque</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {upcomingTermes.map((terme, index) => {
                        const remarqueLower = terme.remarque?.toLowerCase() || '';
                        const bgColor = remarqueLower === 'vendu' ? 'bg-yellow-100 hover:bg-yellow-200' :
                                       remarqueLower === 'rt' ? 'bg-blue-100 hover:bg-blue-200' :
                                       remarqueLower === 'a récupérer' ? 'bg-purple-100 hover:bg-purple-200' :
                                       'hover:bg-blue-50';

                        return (
                          <tr
                            key={index}
                            className={`transition-colors cursor-pointer ${bgColor}`}
                            onClick={() => handleTermeClick(terme)}
                            title="Cliquez pour ajouter/modifier une remarque"
                          >
                            <td className="px-4 py-3 text-sm font-medium">{terme.numero_contrat}</td>
                            <td className="px-4 py-3 text-sm">{terme.assure}</td>
                            {isHamza && <td className="px-4 py-3 text-sm font-semibold">{parseFloat(terme.prime).toFixed(2)}</td>}
                            <td className="px-4 py-3 text-sm text-blue-600 font-medium">{formatDate(terme.echeance)}</td>
                            <td className="px-4 py-3 text-sm">{terme.num_tel || terme.num_tel_2 || 'N/A'}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                !terme.remarque ? 'bg-gray-100 text-gray-800' :
                                terme.remarque.toLowerCase() === 'vendu' ? 'bg-yellow-100 text-yellow-800' :
                                terme.remarque.toLowerCase() === 'rt' ? 'bg-blue-100 text-blue-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {terme.remarque || 'Aucune'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {showPaidDetails && paidTermes.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h3 className="text-xl font-bold text-green-600 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-6 h-6" />
                  Détails des Termes Payés ({paidTermes.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-green-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">N° Contrat</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Assuré</th>
                        {isHamza && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Prime (DT)</th>}
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Échéance</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Téléphone</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Remarque</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paidTermes.map((terme, index) => {
                        const remarqueLower = terme.remarque?.toLowerCase() || '';
                        const bgColor = remarqueLower === 'vendu' ? 'bg-yellow-100 hover:bg-yellow-200' :
                                       remarqueLower === 'rt' ? 'bg-blue-100 hover:bg-blue-200' :
                                       remarqueLower === 'a récupérer' ? 'bg-purple-100 hover:bg-purple-200' :
                                       'hover:bg-green-50';

                        return (
                          <tr
                            key={index}
                            className={`transition-colors cursor-pointer ${bgColor}`}
                            onClick={() => handleTermeClick(terme)}
                            title="Cliquez pour ajouter/modifier une remarque"
                          >
                            <td className="px-4 py-3 text-sm font-medium">{terme.numero_contrat}</td>
                            <td className="px-4 py-3 text-sm">{terme.assure}</td>
                            {isHamza && <td className="px-4 py-3 text-sm font-semibold">{parseFloat(terme.prime).toFixed(2)}</td>}
                            <td className="px-4 py-3 text-sm">{formatDate(terme.echeance)}</td>
                            <td className="px-4 py-3 text-sm">{terme.num_tel || terme.num_tel_2 || 'N/A'}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                !terme.remarque ? 'bg-gray-100 text-gray-800' :
                                terme.remarque.toLowerCase() === 'vendu' ? 'bg-yellow-100 text-yellow-800' :
                                terme.remarque.toLowerCase() === 'rt' ? 'bg-blue-100 text-blue-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {terme.remarque || 'Aucune'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {showCreditsDueTodayDetails && creditsDueToday.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h3 className="text-xl font-bold text-purple-600 mb-4 flex items-center gap-2">
                  <DollarSign className="w-6 h-6" />
                  Crédits à Payer Aujourd'hui ({creditsDueToday.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-purple-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">N° Contrat</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Assuré</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Branche</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Crédit (DT)</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Payé (DT)</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Solde (DT)</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Statut</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date Prévue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {creditsDueToday.map((credit, index) => (
                        <tr key={index} className="hover:bg-purple-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium">{credit.numero_contrat}</td>
                          <td className="px-4 py-3 text-sm">{credit.assure}</td>
                          <td className="px-4 py-3 text-sm">{credit.branche}</td>
                          <td className="px-4 py-3 text-sm">{parseFloat(credit.montant_credit).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-green-600 font-semibold">
                            {parseFloat(credit.paiement || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-red-600 font-semibold">
                            {parseFloat(credit.solde || credit.montant_credit).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              credit.statut === 'Non payé' ? 'bg-red-100 text-red-800' :
                              credit.statut === 'Payé partiellement' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {credit.statut}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-purple-600 font-medium">
                            {formatDate(credit.date_paiement_prevue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">Veuillez sélectionner une année et un mois pour afficher les données</p>
          </div>
        )}

        <RemarqueModal
          isOpen={isRemarqueModalOpen}
          onClose={() => setIsRemarqueModalOpen(false)}
          contrat={selectedContrat || { police: '', mois: '', terme: 0, echeance: '' }}
          onSave={() => {
            if (selectedMonth && selectedYear) {
              loadTermesData();
            }
          }}
          username={username || 'Utilisateur'}
        />
      </div>
    </div>
  );
};

export default HomePage;
