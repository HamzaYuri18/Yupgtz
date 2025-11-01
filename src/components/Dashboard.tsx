import React, { useState, useEffect } from 'react';
import { LogOut, FileText, Upload, BarChart3, Clock, User, Search, Calendar, Receipt, Building2, DollarSign } from 'lucide-react';
import { getSession, clearSession, isAdmin } from '../utils/auth';
import LogoutConfirmation from './LogoutConfirmation';
import { shouldShowLogoutConfirmation } from '../utils/auth';
import ContractForm from './ContractForm';
import XLSXUploader from './XMLUploader';
import ReportGenerator from './ReportGenerator';
import CreditsList from './CreditsList';
import FinancialManagement from './FinancialManagement';
import CreditPayment from './CreditPayment';
import TermeSearch from './TermeSearch';
import TransactionReport from './TransactionReport';
import ChequesManagement from './ChequesManagement';
import VersementBancaire from './VersementBancaire';
import Encaissement from './Encaissement'; // Ajouter cet import

interface DashboardProps {
  username: string;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ username, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'contract' | 'xml' | 'reports' | 'credits' | 'financial' | 'payment' | 'terme' | 'transactions' | 'cheques' | 'versement' | 'encaissement'>('contract');
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (session) {
      setSessionInfo(session);
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      clearSession();
      onLogout();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [onLogout]);

  const handleLogout = () => {
    if (shouldShowLogoutConfirmation(username)) {
      setShowLogoutConfirmation(true);
    } else {
      clearSession();
      onLogout();
    }
  };

  const handleConfirmLogout = () => {
    setShowLogoutConfirmation(false);
    clearSession();
    onLogout();
  };

  const handleCancelLogout = () => {
    setShowLogoutConfirmation(false);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('fr-FR');
  };

  const isUserAdmin = isAdmin(username);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-base sm:text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">SHIRI FARES HAMZA</h1>
                  <p className="text-xs text-gray-600 font-medium">Gestion d'Agence</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="text-right">
                <p className="text-xs sm:text-sm font-semibold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">{username}</p>
                {isUserAdmin && (
                  <span className="text-xs bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">Admin</span>
                )}
              </div>
              {sessionInfo && (
                <div className="hidden md:flex items-center text-xs text-gray-600">
                  <Clock className="w-4 h-4 mr-1 text-indigo-500" />
                  <span>Connecté depuis {formatDate(sessionInfo.loginTime)}</span>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1 sm:space-x-2 text-gray-700 hover:text-red-600 transition-all duration-200 px-2 sm:px-3 py-2 rounded-lg hover:bg-red-50"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white/70 backdrop-blur-md border-b border-white/30 shadow-sm overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4 sm:space-x-8 min-w-max">
            <button
              onClick={() => setActiveTab('contract')}
              className={`py-3 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors duration-200 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap ${
                activeTab === 'contract'
                  ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Nouveau Contrat</span>
            </button>

            {isUserAdmin && (
              <button
                onClick={() => setActiveTab('xml')}
                className={`py-3 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors duration-200 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap ${
                  activeTab === 'xml'
                    ? 'border-green-500 text-green-600 bg-green-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Import XLSX</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('reports')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center space-x-2 ${
                activeTab === 'reports'
                  ? 'border-purple-500 text-purple-600 bg-purple-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Rapports</span>
            </button>

            <button
              onClick={() => setActiveTab('credits')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center space-x-2 ${
                activeTab === 'credits'
                  ? 'border-orange-500 text-orange-600 bg-orange-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Liste des Crédits</span>
            </button>

            <button
              onClick={() => setActiveTab('financial')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center space-x-2 ${
                activeTab === 'financial'
                  ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Gestion Financière</span>
            </button>

            <button
              onClick={() => setActiveTab('payment')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center space-x-2 ${
                activeTab === 'payment'
                  ? 'border-pink-500 text-pink-600 bg-pink-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Paiement Crédit</span>
            </button>

            <button
              onClick={() => setActiveTab('terme')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center space-x-2 ${
                activeTab === 'terme'
                  ? 'border-sky-500 text-sky-600 bg-sky-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Terme</span>
            </button>

            <button
              onClick={() => setActiveTab('transactions')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center space-x-2 ${
                activeTab === 'transactions'
                  ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Rapport Transactions</span>
            </button>

            {/* Section réservée à Hamza */}
            {username.toLowerCase() === 'hamza' && (
              <>
                <button
                  onClick={() => setActiveTab('cheques')}
                  className={`py-3 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors duration-200 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap ${
                    activeTab === 'cheques'
                      ? 'border-teal-500 text-teal-600 bg-teal-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Receipt className="w-4 h-4" />
                  <span>Chèques</span>
                </button>

                <button
                  onClick={() => setActiveTab('versement')}
                  className={`py-3 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors duration-200 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap ${
                    activeTab === 'versement'
                      ? 'border-green-500 text-green-600 bg-green-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Versement Bancaire</span>
                </button>

                <button
                  onClick={() => setActiveTab('encaissement')}
                  className={`py-3 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors duration-200 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap ${
                    activeTab === 'encaissement'
                      ? 'border-green-500 text-green-600 bg-green-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Encaissement</span>
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto py-3 sm:py-6 px-2 sm:px-4 lg:px-8">
        {activeTab === 'contract' && <ContractForm username={username} />}
        {activeTab === 'xml' && isUserAdmin && <XLSXUploader />}
        {activeTab === 'reports' && <ReportGenerator />}
        {activeTab === 'credits' && <CreditsList />}
        {activeTab === 'financial' && <FinancialManagement username={username} />}
        {activeTab === 'payment' && <CreditPayment />}
        {activeTab === 'terme' && <TermeSearch />}
        {activeTab === 'transactions' && <TransactionReport />}
        {activeTab === 'cheques' && username.toLowerCase() === 'hamza' && <ChequesManagement />}
        {activeTab === 'versement' && username.toLowerCase() === 'hamza' && <VersementBancaire username={username} />}
        {activeTab === 'encaissement' && username.toLowerCase() === 'hamza' && <Encaissement username={username} />}
      </main>

      {/* Modal de confirmation de déconnexion */}
      {showLogoutConfirmation && (
        <LogoutConfirmation
          username={username}
          onConfirm={handleConfirmLogout}
          onCancel={handleCancelLogout}
        />
      )}
    </div>
  );
};

export default Dashboard;