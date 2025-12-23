import React, { useState, useEffect } from 'react';
import { LogOut, FileText, Upload, BarChart3, Clock, User, Search, Calendar, Receipt, Building2, DollarSign, TrendingUp, Home } from 'lucide-react';
import { getSession, clearSession, isAdmin } from '../utils/auth';
import LogoutConfirmation from './LogoutConfirmation';
import { shouldShowLogoutConfirmation } from '../utils/auth';
import HomePage from './HomePage';
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
import Encaissement from './Encaissement';
import EtatCommissions from './EtatCommissions';

interface DashboardProps {
  username: string;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ username, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'contract' | 'xml' | 'reports' | 'credits' | 'financial' | 'payment' | 'terme' | 'transactions' | 'cheques' | 'versement' | 'encaissement' | 'commissions'>('home');
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
  const isHamza = username.toLowerCase() === 'hamza';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-md">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-base sm:text-lg font-bold text-white">SHIRI FARES HAMZA</h1>
                  <p className="text-xs text-white/80 font-medium">Gestion d'Agence</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="text-right">
                <p className="text-xs sm:text-sm font-semibold text-white">{username}</p>
                {isUserAdmin && (
                  <span className="text-xs text-yellow-300 font-semibold">Admin</span>
                )}
              </div>
              {sessionInfo && (
                <div className="hidden md:flex items-center text-xs text-white/90">
                  <Clock className="w-4 h-4 mr-1 text-white/80" />
                  <span>Connecte depuis {formatDate(sessionInfo.loginTime)}</span>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1 sm:space-x-2 text-white hover:text-red-300 transition-all duration-200 px-2 sm:px-3 py-2 rounded-lg hover:bg-white/10 backdrop-blur-sm"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Deconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-gradient-to-r from-purple-500 via-purple-600 to-indigo-600 shadow-md overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 sm:space-x-2 min-w-max">
            <button
              onClick={() => setActiveTab('home')}
              className={`py-3 sm:py-4 px-3 sm:px-4 font-medium text-xs sm:text-sm transition-all duration-200 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap rounded-t-lg ${
                activeTab === 'home'
                  ? 'bg-white text-purple-700 shadow-lg transform scale-105'
                  : 'text-white/90 hover:bg-white/20 hover:text-white'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Accueil</span>
            </button>

            <button
              onClick={() => setActiveTab('contract')}
              className={`py-3 sm:py-4 px-3 sm:px-4 font-medium text-xs sm:text-sm transition-all duration-200 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap rounded-t-lg ${
                activeTab === 'contract'
                  ? 'bg-white text-purple-700 shadow-lg transform scale-105'
                  : 'text-white/90 hover:bg-white/20 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Nouveau Contrat</span>
            </button>

            {isUserAdmin && (
              <button
                onClick={() => setActiveTab('xml')}
                className={`py-3 sm:py-4 px-3 sm:px-4 font-medium text-xs sm:text-sm transition-all duration-200 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap rounded-t-lg ${
                  activeTab === 'xml'
                    ? 'bg-white text-purple-700 shadow-lg transform scale-105'
                    : 'text-white/90 hover:bg-white/20 hover:text-white'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Import XLSX</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('reports')}
              className={`py-3 sm:py-4 px-3 sm:px-4 font-medium text-xs sm:text-sm transition-all duration-200 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap rounded-t-lg ${
                activeTab === 'reports'
                  ? 'bg-white text-purple-700 shadow-lg transform scale-105'
                  : 'text-white/90 hover:bg-white/20 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Rapports</span>
            </button>

            <button
              onClick={() => setActiveTab('credits')}
              className={`py-3 sm:py-4 px-3 sm:px-4 font-medium text-xs sm:text-sm transition-all duration-200 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap rounded-t-lg ${
                activeTab === 'credits'
                  ? 'bg-white text-purple-700 shadow-lg transform scale-105'
                  : 'text-white/90 hover:bg-white/20 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Liste des Credits</span>
            </button>

            <button
              onClick={() => setActiveTab('financial')}
              className={`py-3 sm:py-4 px-3 sm:px-4 font-medium text-xs sm:text-sm transition-all duration-200 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap rounded-t-lg ${
                activeTab === 'financial'
                  ? 'bg-white text-purple-700 shadow-lg transform scale-105'
                  : 'text-white/90 hover:bg-white/20 hover:text-white'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Gestion Financiere</span>
            </button>

            <button
              onClick={() => setActiveTab('payment')}
              className={`py-3 sm:py-4 px-3 sm:px-4 font-medium text-xs sm:text-sm transition-all duration-200 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap rounded-t-lg ${
                activeTab === 'payment'
                  ? 'bg-white text-purple-700 shadow-lg transform scale-105'
                  : 'text-white/90 hover:bg-white/20 hover:text-white'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Paiement Credit</span>
            </button>

            <button
              onClick={() => setActiveTab('terme')}
              className={`py-3 sm:py-4 px-3 sm:px-4 font-medium text-xs sm:text-sm transition-all duration-200 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap rounded-t-lg ${
                activeTab === 'terme'
                  ? 'bg-white text-purple-700 shadow-lg transform scale-105'
                  : 'text-white/90 hover:bg-white/20 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Terme</span>
            </button>

            <button
              onClick={() => setActiveTab('transactions')}
              className={`py-3 sm:py-4 px-3 sm:px-4 font-medium text-xs sm:text-sm transition-all duration-200 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap rounded-t-lg ${
                activeTab === 'transactions'
                  ? 'bg-white text-purple-700 shadow-lg transform scale-105'
                  : 'text-white/90 hover:bg-white/20 hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Rapport Transactions</span>
            </button>

            {/* Section reservee a Hamza */}
            {isHamza && (
              <>
                <button
                  onClick={() => setActiveTab('cheques')}
                  className={`py-3 sm:py-4 px-3 sm:px-4 font-medium text-xs sm:text-sm transition-all duration-200 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap rounded-t-lg ${
                    activeTab === 'cheques'
                      ? 'bg-white text-purple-700 shadow-lg transform scale-105'
                      : 'text-white/90 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  <Receipt className="w-4 h-4" />
                  <span>Cheques</span>
                </button>

                <button
                  onClick={() => setActiveTab('versement')}
                  className={`py-3 sm:py-4 px-3 sm:px-4 font-medium text-xs sm:text-sm transition-all duration-200 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap rounded-t-lg ${
                    activeTab === 'versement'
                      ? 'bg-white text-purple-700 shadow-lg transform scale-105'
                      : 'text-white/90 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Versement Bancaire</span>
                </button>

                <button
                  onClick={() => setActiveTab('commissions')}
                  className={`py-3 sm:py-4 px-3 sm:px-4 font-medium text-xs sm:text-sm transition-all duration-200 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap rounded-t-lg ${
                    activeTab === 'commissions'
                      ? 'bg-white text-purple-700 shadow-lg transform scale-105'
                      : 'text-white/90 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>Etat des Commissions</span>
                </button>
              </>
            )}

            {/* Encaissement - visible pour tous les utilisateurs */}
            <button
              onClick={() => setActiveTab('encaissement')}
              className={`py-3 sm:py-4 px-3 sm:px-4 font-medium text-xs sm:text-sm transition-all duration-200 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap rounded-t-lg ${
                activeTab === 'encaissement'
                  ? 'bg-white text-purple-700 shadow-lg transform scale-105'
                  : 'text-white/90 hover:bg-white/20 hover:text-white'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Encaissement</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto py-3 sm:py-6 px-2 sm:px-4 lg:px-8">
        {activeTab === 'home' && <HomePage username={username} />}
        {activeTab === 'contract' && <ContractForm username={username} />}
        {activeTab === 'xml' && isUserAdmin && <XLSXUploader />}
        {activeTab === 'reports' && <ReportGenerator />}
        {activeTab === 'credits' && <CreditsList />}
        {activeTab === 'financial' && <FinancialManagement username={username} />}
        {activeTab === 'payment' && <CreditPayment />}
        {activeTab === 'terme' && <TermeSearch />}
        {activeTab === 'transactions' && <TransactionReport />}
        {activeTab === 'cheques' && isHamza && <ChequesManagement />}
        {activeTab === 'versement' && isHamza && <VersementBancaire username={username} />}
        {activeTab === 'encaissement' && <Encaissement username={username} />}
        {activeTab === 'commissions' && isHamza && <EtatCommissions />}
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