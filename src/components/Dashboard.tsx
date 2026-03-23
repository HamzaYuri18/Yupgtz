import React, { useState, useEffect } from 'react';
import { LogOut, FileText, Upload, BarChart3, Clock, User, Search, Calendar, Receipt, Building2, DollarSign, TrendingUp, Home, Briefcase, Award, Trash2, Shield } from 'lucide-react';
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
import StatisticsChart from './StatisticsChart';
import SalairesLoyer from './SalairesLoyer';
import AttestationSequences from './AttestationSequences';
import ReportingSuppression from './ReportingSuppression';
import GestionAcces from './GestionAcces';
import { getUserPermissions, UserPermissions, DEFAULT_PERMISSIONS } from '../utils/permissionsService';

type TabId =
  | 'home' | 'contract' | 'xml' | 'reports' | 'credits' | 'financial'
  | 'payment' | 'terme' | 'transactions' | 'cheques' | 'versement'
  | 'encaissement' | 'commissions' | 'statistics' | 'salaires'
  | 'attestations' | 'reporting' | 'gestion_acces';

interface DashboardProps {
  username: string;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ username, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const [permissions, setPermissions] = useState<UserPermissions>({ ...DEFAULT_PERMISSIONS });

  const isHamza = username.toLowerCase() === 'hamza';
  const isUserAdmin = isAdmin(username);

  useEffect(() => {
    const session = getSession();
    if (session) {
      setSessionInfo(session);
    }

    const handleBeforeUnload = () => {
      clearSession();
      onLogout();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [onLogout]);

  useEffect(() => {
    if (!isHamza) {
      getUserPermissions(username).then(setPermissions);
    }
  }, [username, isHamza]);

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

  const canAccess = (tab: keyof UserPermissions): boolean => {
    if (isHamza) return true;
    return permissions[tab] ?? true;
  };

  const navBtn = (tab: TabId, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`py-3 sm:py-4 px-3 sm:px-4 font-medium text-xs sm:text-sm transition-all duration-200 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap rounded-t-lg ${
        activeTab === tab
          ? 'bg-white text-emerald-700 shadow-lg transform scale-105'
          : 'text-white/90 hover:bg-white/20 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-600 via-gray-700 to-gray-900 shadow-lg">
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
                  <span className="text-xs text-emerald-300 font-semibold">Admin</span>
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
      <nav className="bg-gradient-to-r from-emerald-500 via-gray-600 to-gray-800 shadow-md overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 sm:space-x-2 min-w-max">
            {navBtn('home', 'Accueil', <Home className="w-4 h-4" />)}

            {canAccess('contract') && navBtn('contract', 'Nouveau Contrat', <FileText className="w-4 h-4" />)}

            {isUserAdmin && navBtn('xml', 'Import XLSX', <Upload className="w-4 h-4" />)}

            {canAccess('reports') && navBtn('reports', 'Rapports', <BarChart3 className="w-4 h-4" />)}

            {canAccess('statistics') && navBtn('statistics', 'Statistiques', <TrendingUp className="w-4 h-4" />)}

            {canAccess('credits') && navBtn('credits', 'Liste des Credits', <FileText className="w-4 h-4" />)}

            {canAccess('financial') && navBtn('financial', 'Gestion Financiere', <DollarSign className="w-4 h-4" />)}

            {canAccess('payment') && navBtn('payment', 'Paiement Credit', <DollarSign className="w-4 h-4" />)}

            {canAccess('terme') && navBtn('terme', 'Terme', <Search className="w-4 h-4" />)}

            {canAccess('transactions') && navBtn('transactions', 'Rapport Transactions', <Calendar className="w-4 h-4" />)}

            {canAccess('reporting') && navBtn('reporting', 'Reporting', <Trash2 className="w-4 h-4" />)}

            {canAccess('encaissement') && navBtn('encaissement', 'Encaissement', <DollarSign className="w-4 h-4" />)}

            {/* Rubriques Hamza ou si permission accordee */}
            {(isHamza || canAccess('cheques')) && navBtn('cheques', 'Cheques', <Receipt className="w-4 h-4" />)}
            {(isHamza || canAccess('versement')) && navBtn('versement', 'Versement Bancaire', <Building2 className="w-4 h-4" />)}
            {(isHamza || canAccess('commissions')) && navBtn('commissions', 'Etat des Commissions', <TrendingUp className="w-4 h-4" />)}
            {(isHamza || canAccess('salaires')) && navBtn('salaires', 'Salaires et Loyer', <Briefcase className="w-4 h-4" />)}
            {(isHamza || canAccess('attestations')) && navBtn('attestations', 'Sequences Attestation', <Award className="w-4 h-4" />)}

            {/* Gestion Acces - Hamza uniquement */}
            {isHamza && navBtn('gestion_acces', 'Gestion Acces', <Shield className="w-4 h-4" />)}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto py-3 sm:py-6 px-2 sm:px-4 lg:px-8">
        {activeTab === 'home' && <HomePage username={username} />}
        {activeTab === 'contract' && canAccess('contract') && <ContractForm username={username} />}
        {activeTab === 'xml' && isUserAdmin && <XLSXUploader />}
        {activeTab === 'reports' && canAccess('reports') && <ReportGenerator />}
        {activeTab === 'statistics' && canAccess('statistics') && <StatisticsChart username={username} />}
        {activeTab === 'credits' && canAccess('credits') && <CreditsList />}
        {activeTab === 'financial' && canAccess('financial') && <FinancialManagement username={username} />}
        {activeTab === 'payment' && canAccess('payment') && <CreditPayment />}
        {activeTab === 'terme' && canAccess('terme') && <TermeSearch />}
        {activeTab === 'transactions' && canAccess('transactions') && <TransactionReport />}
        {activeTab === 'reporting' && canAccess('reporting') && <ReportingSuppression />}
        {activeTab === 'encaissement' && canAccess('encaissement') && <Encaissement username={username} />}
        {activeTab === 'cheques' && (isHamza || canAccess('cheques')) && <ChequesManagement />}
        {activeTab === 'versement' && (isHamza || canAccess('versement')) && <VersementBancaire username={username} />}
        {activeTab === 'commissions' && (isHamza || canAccess('commissions')) && <EtatCommissions />}
        {activeTab === 'salaires' && (isHamza || canAccess('salaires')) && <SalairesLoyer />}
        {activeTab === 'attestations' && (isHamza || canAccess('attestations')) && <AttestationSequences />}
        {activeTab === 'gestion_acces' && isHamza && <GestionAcces currentUser={username} />}
      </main>

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
