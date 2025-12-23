import React, { useState, useEffect } from 'react';
import { AlertCircle, Calendar, CheckCircle, Clock, TrendingUp, Filter } from 'lucide-react';
import { getAvailableMonths, getUnpaidTermesByMonth, getOverdueUnpaidTermes, getPaidTermesByMonth, getUpcomingTermes } from '../utils/supabaseService';

const HomePage: React.FC = () => {
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

    const currentDate = new Date();
    const currentMonthName = currentDate.toLocaleString('fr-FR', { month: 'long' });
    const currentYear = currentDate.getFullYear().toString();
    const currentMonthYear = `${currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1)} ${currentYear}`;

    if (months.includes(currentMonthYear)) {
      setSelectedMonth(currentMonthYear);
      setSelectedYear(currentYear);
    } else if (months.length > 0) {
      setSelectedMonth(months[0]);
      const parts = months[0].split(' ');
      if (parts[1]) {
        setSelectedYear(parts[1]);
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
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : selectedMonth ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div
              onClick={() => setShowOverdueDetails(!showOverdueDetails)}
              className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white cursor-pointer hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <AlertCircle className="w-8 h-8" />
                <span className="text-3xl font-bold">{overdueTermes.length}</span>
              </div>
              <h3 className="text-lg font-semibold mb-1">Termes Échus</h3>
              <p className="text-red-100 text-sm mb-2">Non payés et en retard</p>
              <div className="text-2xl font-bold">{calculateTotal(overdueTermes).toFixed(2)} DT</div>
            </div>

            <div
              onClick={() => setShowUnpaidDetails(!showUnpaidDetails)}
              className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white cursor-pointer hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <Clock className="w-8 h-8" />
                <span className="text-3xl font-bold">{unpaidTermes.length}</span>
              </div>
              <h3 className="text-lg font-semibold mb-1">Termes Non Payés</h3>
              <p className="text-orange-100 text-sm mb-2">Total dans le mois</p>
              <div className="text-2xl font-bold">{calculateTotal(unpaidTermes).toFixed(2)} DT</div>
            </div>

            <div
              onClick={() => setShowUpcomingDetails(!showUpcomingDetails)}
              className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white cursor-pointer hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <Calendar className="w-8 h-8" />
                <span className="text-3xl font-bold">{upcomingTermes.length}</span>
              </div>
              <h3 className="text-lg font-semibold mb-1">Échéances Proches</h3>
              <p className="text-blue-100 text-sm mb-2">{daysFilter} prochains jours</p>
              <div className="text-2xl font-bold">{calculateTotal(upcomingTermes).toFixed(2)} DT</div>
            </div>

            <div
              onClick={() => setShowPaidDetails(!showPaidDetails)}
              className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white cursor-pointer hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <CheckCircle className="w-8 h-8" />
                <span className="text-3xl font-bold">{paidTermes.length}</span>
              </div>
              <h3 className="text-lg font-semibold mb-1">Termes Payés</h3>
              <p className="text-green-100 text-sm mb-2">Total dans le mois</p>
              <div className="text-2xl font-bold">{calculateTotal(paidTermes).toFixed(2)} DT</div>
            </div>
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
