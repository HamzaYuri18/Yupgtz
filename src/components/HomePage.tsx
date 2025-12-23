import React, { useState, useEffect } from 'react';
import { AlertCircle, Calendar, CheckCircle, Clock, TrendingUp, Filter, RefreshCw } from 'lucide-react';
import { getAvailableMonths, getUnpaidTermesByMonth, getOverdueUnpaidTermes, getPaidTermesByMonth, getUpcomingTermes, syncTermeStatusesWithMainTable } from '../utils/supabaseService';
import { getSessionDate } from '../utils/auth';

interface CircularStatCardProps {
  title: string;
  subtitle: string;
  count: number;
  total: number;
  percentage: number;
  color: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const CircularStatCard: React.FC<CircularStatCardProps> = ({
  title,
  subtitle,
  count,
  total,
  percentage,
  color,
  icon,
  onClick
}) => {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 border border-gray-100"
    >
      <div className="flex flex-col items-center">
        <div className="relative w-40 h-40 mb-4">
          <svg className="transform -rotate-90 w-40 h-40">
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="#E5E7EB"
              strokeWidth="12"
              fill="none"
            />
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke={color}
              strokeWidth="12"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div style={{ color }} className="mb-1">
              {icon}
            </div>
            <span className="text-3xl font-bold text-gray-900">{count}</span>
            <span className="text-sm text-gray-500 mt-1">{percentage.toFixed(1)}%</span>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1 text-center">{title}</h3>
        <p className="text-sm text-gray-500 mb-2 text-center">{subtitle}</p>
        <div className="text-2xl font-bold" style={{ color }}>{total.toFixed(2)} DT</div>
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

  const [showOverdueDetails, setShowOverdueDetails] = useState(false);
  const [showUnpaidDetails, setShowUnpaidDetails] = useState(false);
  const [showPaidDetails, setShowPaidDetails] = useState(false);
  const [showUpcomingDetails, setShowUpcomingDetails] = useState(false);

  const [daysFilter, setDaysFilter] = useState<number>(7);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [showSyncMessage, setShowSyncMessage] = useState(false);

  const isHamza = username?.toLowerCase() === 'hamza';

  useEffect(() => {
    loadAvailableMonths();
  }, []);

  useEffect(() => {
    if (selectedMonth && selectedYear) {
      loadTermesData();
    }
  }, [selectedMonth, selectedYear, daysFilter]);

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
      'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];

    const sessionDate = getSessionDate();
    const currentDate = sessionDate ? new Date(sessionDate) : new Date();
    const currentMonthIndex = currentDate.getMonth();
    const currentMonthName = monthsFR[currentMonthIndex];
    const currentYear = currentDate.getFullYear().toString();
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

  const calculateTotal = (termes: any[]) => {
    return termes.reduce((sum, terme) => sum + (parseFloat(terme.prime) || 0), 0);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
  };

  const handleSyncStatuses = async () => {
    if (!selectedMonth || !selectedYear) {
      setSyncMessage('Veuillez sélectionner un mois et une année avant de synchroniser');
      setShowSyncMessage(true);
      setTimeout(() => setShowSyncMessage(false), 5000);
      return;
    }

    setIsSyncing(true);
    setSyncMessage('');
    setShowSyncMessage(false);

    try {
      const monthParts = selectedMonth.toLowerCase().split(' ');
      const monthName = monthParts[0];
      const year = monthParts[1];

      console.log(`🔄 Synchronisation pour ${monthName} ${year}...`);

      const result = await syncTermeStatusesWithMainTable(monthName, year);

      if (result.success) {
        setSyncMessage(
          `✅ ${result.message}\n\n` +
          `📊 Statistiques:\n` +
          `   • Tables traitées: ${result.details.totalTables}\n` +
          `   • Contrats vérifiés: ${result.details.totalContracts}\n` +
          `   • Contrats payés: ${result.details.paidCount}\n` +
          `   • Contrats non payés: ${result.details.unpaidCount}\n` +
          `   • Statuts mis à jour: ${result.details.updated}\n` +
          `   • Erreurs: ${result.details.errors}`
        );
        setShowSyncMessage(true);

        console.log('✅ Synchronisation terminée, rechargement des statistiques...');
        await loadTermesData();
      } else {
        setSyncMessage(`❌ Erreur: ${result.message}`);
        setShowSyncMessage(true);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation:', error);
      setSyncMessage('❌ Erreur lors de la synchronisation des statuts');
      setShowSyncMessage(true);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setShowSyncMessage(false), 15000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Tableau de bord des Termes</h1>
        <p className="text-gray-600">Vue d'ensemble des paiements et échéances</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
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

        {isHamza && (
          <div className="mt-6">
            <button
              onClick={handleSyncStatuses}
              disabled={isSyncing || !selectedMonth || !selectedYear}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Synchronisation en cours...' : 'Synchroniser les statuts'}</span>
            </button>
            <p className="text-sm text-gray-600 mt-2">
              Compare les contrats de ce mois avec la table principale et met à jour les statuts
            </p>
          </div>
        )}
      </div>

      {showSyncMessage && (
        <div className={`mb-6 p-4 rounded-lg ${syncMessage.includes('Erreur') ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <pre className={`text-sm whitespace-pre-wrap ${syncMessage.includes('Erreur') ? 'text-red-800' : 'text-green-800'}`}>
            {syncMessage}
          </pre>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : selectedMonth ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {(() => {
              const totalCount = overdueTermes.length + unpaidTermes.length + upcomingTermes.length + paidTermes.length;
              const overduePercentage = totalCount > 0 ? (overdueTermes.length / totalCount) * 100 : 0;
              const unpaidPercentage = totalCount > 0 ? (unpaidTermes.length / totalCount) * 100 : 0;
              const upcomingPercentage = totalCount > 0 ? (upcomingTermes.length / totalCount) * 100 : 0;
              const paidPercentage = totalCount > 0 ? (paidTermes.length / totalCount) * 100 : 0;

              return (
                <>
                  <CircularStatCard
                    title="Termes Échus"
                    subtitle="Non payés et en retard"
                    count={overdueTermes.length}
                    total={calculateTotal(overdueTermes)}
                    percentage={overduePercentage}
                    color="#EF4444"
                    icon={<AlertCircle className="w-8 h-8" />}
                    onClick={() => setShowOverdueDetails(!showOverdueDetails)}
                  />
                  <CircularStatCard
                    title="Termes Non Payés"
                    subtitle="Total dans le mois"
                    count={unpaidTermes.length}
                    total={calculateTotal(unpaidTermes)}
                    percentage={unpaidPercentage}
                    color="#F97316"
                    icon={<Clock className="w-8 h-8" />}
                    onClick={() => setShowUnpaidDetails(!showUnpaidDetails)}
                  />
                  <CircularStatCard
                    title="Échéances Proches"
                    subtitle={`${daysFilter} prochains jours`}
                    count={upcomingTermes.length}
                    total={calculateTotal(upcomingTermes)}
                    percentage={upcomingPercentage}
                    color="#3B82F6"
                    icon={<Calendar className="w-8 h-8" />}
                    onClick={() => setShowUpcomingDetails(!showUpcomingDetails)}
                  />
                  <CircularStatCard
                    title="Termes Payés"
                    subtitle="Total dans le mois"
                    count={paidTermes.length}
                    total={calculateTotal(paidTermes)}
                    percentage={paidPercentage}
                    color="#10B981"
                    icon={<CheckCircle className="w-8 h-8" />}
                    onClick={() => setShowPaidDetails(!showPaidDetails)}
                  />
                </>
              );
            })()}
          </div>

          {showOverdueDetails && overdueTermes.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
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
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Prime (DT)</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Échéance</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Téléphone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {overdueTermes.map((terme, index) => (
                      <tr key={index} className="hover:bg-red-50 transition-colors">
                        <td className="px-4 py-3 text-sm">{terme.numero_contrat}</td>
                        <td className="px-4 py-3 text-sm">{terme.assure}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{parseFloat(terme.prime).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-red-600 font-medium">{formatDate(terme.echeance)}</td>
                        <td className="px-4 py-3 text-sm">{terme.num_tel || terme.num_tel_2 || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showUnpaidDetails && unpaidTermes.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
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
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Prime (DT)</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Échéance</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Téléphone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {unpaidTermes.map((terme, index) => (
                      <tr key={index} className="hover:bg-orange-50 transition-colors">
                        <td className="px-4 py-3 text-sm">{terme.numero_contrat}</td>
                        <td className="px-4 py-3 text-sm">{terme.assure}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{parseFloat(terme.prime).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(terme.echeance)}</td>
                        <td className="px-4 py-3 text-sm">{terme.num_tel || terme.num_tel_2 || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showUpcomingDetails && upcomingTermes.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
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
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Prime (DT)</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Échéance</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Téléphone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {upcomingTermes.map((terme, index) => (
                      <tr key={index} className="hover:bg-blue-50 transition-colors">
                        <td className="px-4 py-3 text-sm">{terme.numero_contrat}</td>
                        <td className="px-4 py-3 text-sm">{terme.assure}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{parseFloat(terme.prime).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-blue-600 font-medium">{formatDate(terme.echeance)}</td>
                        <td className="px-4 py-3 text-sm">{terme.num_tel || terme.num_tel_2 || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showPaidDetails && paidTermes.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
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
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Prime (DT)</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Échéance</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Téléphone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paidTermes.map((terme, index) => (
                      <tr key={index} className="hover:bg-green-50 transition-colors">
                        <td className="px-4 py-3 text-sm">{terme.numero_contrat}</td>
                        <td className="px-4 py-3 text-sm">{terme.assure}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{parseFloat(terme.prime).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(terme.echeance)}</td>
                        <td className="px-4 py-3 text-sm">{terme.num_tel || terme.num_tel_2 || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Veuillez sélectionner une année et un mois pour afficher les données</p>
        </div>
      )}
    </div>
  );
};

export default HomePage;
