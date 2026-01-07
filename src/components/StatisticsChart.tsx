import React, { useState, useEffect } from 'react';
import { PieChart, Calendar, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface BrancheStats {
  branche: string;
  count: number;
  totalPrime: number;
  percentage: number;
  color: string;
}

export default function StatisticsChart() {
  const [stats, setStats] = useState<BrancheStats[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalContracts, setTotalContracts] = useState(0);
  const [totalPrimes, setTotalPrimes] = useState(0);
  const [currentUser, setCurrentUser] = useState('');

  const brancheColors: { [key: string]: string } = {
    'Auto': '#3B82F6',
    'Vie': '#10B981',
    'Habitation': '#F59E0B',
    'Santé': '#EF4444',
    'Multirisque': '#8B5CF6',
    'Autre': '#6B7280'
  };

  useEffect(() => {
    const user = localStorage.getItem('currentUser') || '';
    setCurrentUser(user);
    loadAvailableMonths();
  }, []);

  useEffect(() => {
    if (selectedMonth) {
      loadStatistics();
    }
  }, [selectedMonth]);

  const loadAvailableMonths = async () => {
    try {
      const { data: tables } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .like('table_name', 'rapport_%');

      if (tables) {
        const months = tables
          .map(t => t.table_name.replace('rapport_', '').replace(/_/g, '-'))
          .sort()
          .reverse();
        setAvailableMonths(months);
        if (months.length > 0 && !selectedMonth) {
          setSelectedMonth(months[0]);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des mois:', error);
    }
  };

  const loadStatistics = async () => {
    if (!selectedMonth) return;

    setIsLoading(true);
    try {
      const { data: contracts, error } = await supabase
        .from('affaire')
        .select('branche, prime')
        .not('branche', 'is', null);

      if (error) throw error;

      if (!contracts || contracts.length === 0) {
        setStats([]);
        setTotalContracts(0);
        setTotalPrimes(0);
        return;
      }

      const brancheMap = new Map<string, { count: number; totalPrime: number }>();
      let totalPrime = 0;

      contracts.forEach(contract => {
        const branche = contract.branche || 'Autre';
        const prime = parseFloat(contract.prime) || 0;

        if (!brancheMap.has(branche)) {
          brancheMap.set(branche, { count: 0, totalPrime: 0 });
        }

        const current = brancheMap.get(branche)!;
        current.count += 1;
        current.totalPrime += prime;
        totalPrime += prime;
      });

      const statsArray: BrancheStats[] = Array.from(brancheMap.entries()).map(([branche, data]) => ({
        branche,
        count: data.count,
        totalPrime: data.totalPrime,
        percentage: (data.count / contracts.length) * 100,
        color: brancheColors[branche] || brancheColors['Autre']
      }));

      statsArray.sort((a, b) => b.count - a.count);

      setStats(statsArray);
      setTotalContracts(contracts.length);
      setTotalPrimes(totalPrime);
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderPieChart = () => {
    if (stats.length === 0) return null;

    const total = stats.reduce((sum, stat) => sum + stat.count, 0);
    let currentAngle = -90;

    return (
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {stats.map((stat, index) => {
          const percentage = (stat.count / total) * 100;
          const angle = (percentage / 100) * 360;
          const startAngle = currentAngle;
          const endAngle = currentAngle + angle;

          const x1 = 100 + 80 * Math.cos((startAngle * Math.PI) / 180);
          const y1 = 100 + 80 * Math.sin((startAngle * Math.PI) / 180);
          const x2 = 100 + 80 * Math.cos((endAngle * Math.PI) / 180);
          const y2 = 100 + 80 * Math.sin((endAngle * Math.PI) / 180);

          const largeArcFlag = angle > 180 ? 1 : 0;

          const pathData = [
            `M 100 100`,
            `L ${x1} ${y1}`,
            `A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2}`,
            `Z`
          ].join(' ');

          currentAngle = endAngle;

          return (
            <g key={index}>
              <path
                d={pathData}
                fill={stat.color}
                stroke="white"
                strokeWidth="2"
                className="transition-all duration-300 hover:opacity-80"
              />
            </g>
          );
        })}
        <circle cx="100" cy="100" r="50" fill="white" />
        <text x="100" y="95" textAnchor="middle" className="text-2xl font-bold fill-gray-800">
          {total}
        </text>
        <text x="100" y="110" textAnchor="middle" className="text-xs fill-gray-600">
          Contrats
        </text>
      </svg>
    );
  };

  const showTotals = currentUser === 'Hamza';

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-800">Statistiques par Branche</h2>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-gray-500" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Sélectionner un mois</option>
            {availableMonths.map(month => (
              <option key={month} value={month}>
                {new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : stats.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <PieChart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>Aucune donnée disponible pour ce mois</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex items-center justify-center">
            <div className="w-80 h-80">
              {renderPieChart()}
            </div>
          </div>

          <div className="space-y-4">
            {showTotals && (
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Contrats</p>
                    <p className="text-2xl font-bold text-blue-600">{totalContracts}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Primes</p>
                    <p className="text-2xl font-bold text-green-600">
                      {totalPrimes.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {stats.map((stat, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: stat.color }}
                      />
                      <span className="font-semibold text-gray-800">{stat.branche}</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">
                      {stat.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{stat.count} contrats</span>
                    {showTotals && (
                      <span className="font-medium text-green-600">
                        {stat.totalPrime.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT
                      </span>
                    )}
                  </div>
                  <div className="mt-2 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${stat.percentage}%`,
                        backgroundColor: stat.color
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
