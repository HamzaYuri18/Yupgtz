import React, { useState, useEffect } from 'react';
import { CreditCard, ListFilter as Filter, Calendar, CheckCircle, XCircle, Clock, TrendingUp, AlertTriangle, User, Download, MessageSquare, BarChart3, Trash2, X, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import { getCredits, updateCreditStatus, deleteCredit, syncMissingCredits } from '../utils/supabaseService';
import { getSession } from '../utils/auth';
import * as XLSX from 'xlsx';
import SMSModal from './SMSModal';
import CreditDetailsModal from './CreditDetailsModal';
import CreditEvolutionModal from './CreditEvolutionModal';
import CreditPaymentModal from './CreditPaymentModal';

const CreditsList: React.FC = () => {
  const [credits, setCredits] = useState<any[]>([]);
  const [filteredCredits, setFilteredCredits] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    statut: 'all',
    branche: 'all',
    createdBy: 'all',
    dateFrom: '',
    dateTo: '',
    mois: new Date().toISOString().slice(0, 7),
    nomClient: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'mois' | 'tous'>('mois');
  const [activeFilter, setActiveFilter] = useState<'none' | 'echeances' | 'retard' | 'calendrier'>('none');
  const [calendarDate, setCalendarDate] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [hoveredCredit, setHoveredCredit] = useState<any | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [selectedCreditForSMS, setSelectedCreditForSMS] = useState<any | null>(null);
  const [selectedCreditForPayment, setSelectedCreditForPayment] = useState<any | null>(null);

  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [statsModalData, setStatsModalData] = useState<{
    title: string;
    credits: any[];
    type: 'payes' | 'nonPayes' | 'echeances' | 'retard';
  } | null>(null);
  const [isEvolutionModalOpen, setIsEvolutionModalOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const isHamza = currentUser === 'Hamza';
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [paidRangeFrom, setPaidRangeFrom] = useState('');
  const [paidRangeTo, setPaidRangeTo] = useState('');
  const [showPaidDetails, setShowPaidDetails] = useState(false);
  const [selectedCreditIds, setSelectedCreditIds] = useState<Set<number>>(new Set());
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (session && session.username) {
      setCurrentUser(session.username);
    }
    loadCredits();
    // Synchroniser automatiquement les crédits manquants au chargement
    handleSync(true);
  }, []);

  const handleSync = async (silent = false) => {
    setSyncing(true);
    try {
      const count = await syncMissingCredits();
      if (count > 0) {
        setSyncMsg(`✅ ${count} crédit(s) manquant(s) ajouté(s) à la liste`);
        await loadCredits();
      } else if (!silent) {
        setSyncMsg('✅ Tous les crédits sont déjà synchronisés');
      }
    } catch (e) {
      if (!silent) setSyncMsg('❌ Erreur lors de la synchronisation');
    } finally {
      setSyncing(false);
      if (!silent) setTimeout(() => setSyncMsg(null), 4000);
    }
  };

  useEffect(() => {
    applyFilters();
  }, [filters, credits, viewMode, activeFilter, calendarDate]);

  const loadCredits = async () => {
    try {
      setIsLoading(true);
      const data = await getCredits();
      const formattedData = data.map(credit => ({
        id: credit.id,
        numero_contrat: credit.numero_contrat,
        assure: credit.assure,
        branche: credit.branche,
        prime: credit.prime || 0,
        montant_credit: credit.montant_credit || 0,
        paiement: credit.paiement || 0,
        solde: credit.solde || 0,
        date_paiement_prevue: credit.date_paiement_prevue,
        date_paiement_effectif: credit.date_paiement_effectif,
        statut: credit.statut || 'Non payé',
        cree_par: credit.cree_par || 'Utilisateur',
        date_credit: credit.created_at,
        created_at: credit.created_at,
        updated_at: credit.updated_at,
        telephone: (credit as any).telephone || ''
      }));
      setCredits(formattedData);
    } catch (error) {
      console.error('Erreur lors du chargement des crédits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour obtenir l'icône de statut
  const getStatusIcon = (statut: string) => {
    switch (statut) {
      case 'Payé':
      case 'Payé en total':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'Payé partiellement':
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
      case 'En retard':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-orange-500" />;
    }
  };

  // Fonction pour obtenir la couleur du statut
  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'Payé':
      case 'Payé en total':
        return 'bg-green-100 text-green-800';
      case 'Payé partiellement':
        return 'bg-blue-100 text-blue-800';
      case 'En retard':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-orange-100 text-orange-800';
    }
  };

  // Fonction pour exporter en Excel
  const exportToExcel = () => {
    if (filteredCredits.length === 0) {
      alert('Aucune donnée à exporter.');
      return;
    }

    try {
      setIsExporting(true);
      
      // Préparer les données pour l'export
      const exportData = filteredCredits.map(credit => ({
        'Numéro Contrat': credit.numero_contrat || '',
        'Assuré': credit.assure || '',
        'Branche': credit.branche || '',
        'Prime (DT)': credit.prime || 0,
        'Montant Crédit (DT)': credit.montant_credit || 0,
        'Paiement (DT)': credit.paiement || 0,
        'Solde (DT)': credit.solde || 0,
        'Date Crédit': credit.date_credit ? new Date(credit.date_credit).toLocaleDateString('fr-FR') : '-',
        'Date Paiement Prévue': credit.date_paiement_prevue ? new Date(credit.date_paiement_prevue).toLocaleDateString('fr-FR') : '-',
        'Statut': credit.statut || '',
        'Date Paiement Effectif': credit.date_paiement_effectif ? new Date(credit.date_paiement_effectif).toLocaleDateString('fr-FR') : '-',
        'Créé par': credit.cree_par || ''
      }));

      // Créer un nouveau workbook
      const workbook = XLSX.utils.book_new();
      
      // Créer une worksheet à partir des données
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // Ajuster la largeur des colonnes
      const colWidths = [
        { wch: 15 }, // Numéro Contrat
        { wch: 20 }, // Assuré
        { wch: 10 }, // Branche
        { wch: 12 }, // Prime
        { wch: 15 }, // Montant Crédit
        { wch: 12 }, // Paiement
        { wch: 12 }, // Solde
        { wch: 12 }, // Date Crédit
        { wch: 18 }, // Date Paiement Prévue
        { wch: 15 }, // Statut
        { wch: 18 }, // Date Paiement Effectif
        { wch: 15 }  // Créé par
      ];
      worksheet['!cols'] = colWidths;

      // Ajouter la worksheet au workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Credits');

      // Générer le nom du fichier
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      let fileName = '';
      
      if (activeFilter === 'echeances') {
        fileName = `Credits_Echeances_7_Jours_${date}.xlsx`;
      } else if (activeFilter === 'retard') {
        fileName = `Credits_En_Retard_${date}.xlsx`;
      } else if (viewMode === 'mois') {
        const monthName = getMonthName(filters.mois).replace(' ', '_');
        fileName = `Credits_${monthName}_${date}.xlsx`;
      } else {
        fileName = `Tous_Les_Credits_${date}.xlsx`;
      }

      // Exporter le fichier
      XLSX.writeFile(workbook, fileName);
      
      console.log(`Export réussi: ${fileName}, ${exportData.length} enregistrements`);
      
    } catch (error) {
      console.error('Erreur lors de l\'exportation:', error);
      alert('Erreur lors de l\'exportation. Voir la console pour plus de détails.');
    } finally {
      setIsExporting(false);
    }
  };

  // Version alternative plus simple de l'exportation
  const exportToExcelSimple = () => {
    if (filteredCredits.length === 0) {
      alert('Aucune donnée à exporter.');
      return;
    }

    try {
      setIsExporting(true);
      
      // Données simplifiées pour le test
      const exportData = filteredCredits.map(credit => ({
        'Contrat': credit.numero_contrat,
        'Assuré': credit.assure,
        'Branche': credit.branche,
        'Montant': credit.montant_credit,
        'Statut': credit.statut
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Credits');
      XLSX.writeFile(wb, 'test_export_credits.xlsx');
      
      console.log('Export simple réussi');
      
    } catch (error) {
      console.error('Erreur export simple:', error);
      alert('Erreur export: ' + error);
    } finally {
      setIsExporting(false);
    }
  };

  const getCreditsByMonth = (month: string) => {
    const [year, monthNum] = month.split('-').map(Number);
    return credits.filter(credit => {
      if (!credit.date_credit) return false;
      const creditDate = new Date(credit.date_credit);
      return creditDate.getFullYear() === year && creditDate.getMonth() + 1 === monthNum;
    });
  };

  const getCreditsDueIn7Days = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    return credits.filter(credit => {
      if (!credit.date_paiement_prevue || credit.statut === 'Payé' || credit.statut === 'Payé en total') return false;

      const dueDate = new Date(credit.date_paiement_prevue);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= today && dueDate <= nextWeek;
    });
  };

  const getOverdueCredits = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return credits.filter(credit => {
      if (!credit.date_paiement_prevue || credit.statut === 'Payé' || credit.statut === 'Payé en total') return false;

      const dueDate = new Date(credit.date_paiement_prevue);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    });
  };

  const normalizeString = (str: string) => {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const applyFilters = () => {
    let filtered = viewMode === 'mois'
      ? getCreditsByMonth(filters.mois)
      : credits;

    if (activeFilter === 'echeances') {
      filtered = getCreditsDueIn7Days();
    } else if (activeFilter === 'retard') {
      filtered = getOverdueCredits();
    } else if (activeFilter === 'calendrier' && calendarDate) {
      filtered = credits.filter(c => {
        if (!c.date_paiement_prevue) return false;
        if (c.statut === 'Payé' || c.statut === 'Payé en total') return false;
        return c.date_paiement_prevue.slice(0, 10) === calendarDate;
      });
    } else {
      filtered = filtered.filter(credit => {
        const creditDate = credit.date_credit ? new Date(credit.date_credit) : new Date();
        const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : new Date('1900-01-01');
        const toDate = filters.dateTo ? new Date(filters.dateTo) : new Date('2100-12-31');

        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        creditDate.setHours(0, 0, 0, 0);

        // Filtre par nom de client avec tolérance
        const matchesClientName = filters.nomClient
          ? normalizeString(credit.assure || '').includes(normalizeString(filters.nomClient))
          : true;

        return (
          (filters.statut === 'all' || credit.statut === filters.statut) &&
          (filters.branche === 'all' || credit.branche === filters.branche) &&
          (filters.createdBy === 'all' || credit.cree_par === filters.createdBy) &&
          creditDate >= fromDate && creditDate <= toDate &&
          matchesClientName
        );
      });
    }

    setFilteredCredits(filtered);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setActiveFilter('none');
  };

  const handleStatusUpdate = async (id: number, newStatus: string) => {
    if (!isHamza) {
      alert('Seul Hamza peut modifier le statut des crédits.');
      return;
    }

    const datePaiement = newStatus === 'Payé' ? new Date().toISOString().split('T')[0] : null;
    
    try {
      const success = await updateCreditStatus(id, newStatus, datePaiement);
      if (success) {
        await loadCredits();
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
    }
  };

  const handleDeleteCredit = async (id: number, assure: string) => {
    if (!isHamza) {
      alert('Seul Hamza peut supprimer des crédits.');
      return;
    }

    if (!confirm(`Supprimer définitivement le crédit de "${assure}" ? Cette action est irréversible.`)) {
      return;
    }

    try {
      const success = await deleteCredit(id);
      if (success) {
        await loadCredits();
      } else {
        alert('Erreur lors de la suppression du crédit.');
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  const handleCalendarDateChange = (date: string) => {
    setCalendarDate(date);
    if (date) {
      setActiveFilter('calendrier');
      setViewMode('tous');
      setTimeout(() => {
        document.getElementById('credits-table')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      setActiveFilter('none');
    }
  };

  const showDueIn7Days = () => {
    setActiveFilter('echeances');
    setViewMode('tous');
    setFilters(prev => ({ 
      ...prev, 
      statut: 'all',
      branche: 'all',
      createdBy: 'all',
      dateFrom: '',
      dateTo: ''
    }));
    setTimeout(() => {
      document.getElementById('credits-table')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const showOverdueCredits = () => {
    setActiveFilter('retard');
    setViewMode('tous');
    setFilters(prev => ({ 
      ...prev, 
      statut: 'all',
      branche: 'all',
      createdBy: 'all',
      dateFrom: '',
      dateTo: ''
    }));
    setTimeout(() => {
      document.getElementById('credits-table')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const openStatsModal = (type: 'payes' | 'nonPayes' | 'echeances' | 'retard') => {
    let title = '';
    let creditsToShow: any[] = [];

    switch (type) {
      case 'payes':
        title = 'Crédits Payés - Détails';
        creditsToShow = filteredCredits.filter(c =>
          c.statut === 'Payé' || c.statut === 'Payé en total'
        );
        break;
      case 'nonPayes':
        title = 'Crédits Non Payés - Détails';
        creditsToShow = filteredCredits.filter(c =>
          c.statut === 'Non payé'
        );
        break;
      case 'echeances':
        title = 'Échéances 7 Jours - Détails';
        creditsToShow = getCreditsDueIn7Days();
        break;
      case 'retard':
        title = 'Crédits en Retard - Détails';
        creditsToShow = getOverdueCredits();
        break;
    }

    setStatsModalData({
      title,
      credits: creditsToShow,
      type
    });
    setIsStatsModalOpen(true);
  };

  const clearFilters = () => {
    setActiveFilter('none');
    setCalendarDate('');
    setFilters({
      statut: 'all',
      branche: 'all',
      createdBy: 'all',
      dateFrom: '',
      dateTo: '',
      mois: new Date().toISOString().slice(0, 7),
      nomClient: ''
    });
  };

  const calculateDetailedStats = () => {
    const creditsForStats = viewMode === 'mois'
      ? getCreditsByMonth(filters.mois)
      : credits;

    const creditsDueIn7Days = getCreditsDueIn7Days();
    const overdueCredits = getOverdueCredits();

    const totalCredits = creditsForStats.length;
    const totalMontant = creditsForStats.reduce((sum, credit) => sum + (credit.montant_credit || 0), 0);

    const payes = creditsForStats.filter(c =>
      c.statut === 'Payé' || c.statut === 'Payé partiellement' || c.statut === 'Payé en total'
    );
    const nonPayes = creditsForStats.filter(c => c.statut === 'Non payé');
    const enRetard = creditsForStats.filter(c => c.statut === 'En retard');

    const montantPaye = creditsForStats.reduce((sum, credit) => sum + (credit.paiement || 0), 0);
    const montantNonPaye = creditsForStats
      .filter(c => c.statut !== 'Payé en total')
      .reduce((sum, credit) => sum + (credit.solde || 0), 0);

    const montantEnRetard = enRetard.reduce((sum, credit) => sum + (credit.solde || 0), 0);

    const tauxRecouvrement = totalMontant > 0 ? (montantPaye / totalMontant) * 100 : 0;

    return {
      totalCredits,
      totalMontant,
      payes: payes.length,
      nonPayes: nonPayes.length,
      enRetard: enRetard.length,
      montantPaye,
      montantNonPaye,
      montantEnRetard,
      tauxRecouvrement,
      creditsDueIn7Days: creditsDueIn7Days.length,
      montantDueIn7Days: creditsDueIn7Days.reduce((sum, credit) => sum + (credit.montant_credit || 0), 0),
      overdueCredits: overdueCredits.length,
      montantOverdue: overdueCredits.reduce((sum, credit) => sum + (credit.montant_credit || 0), 0)
    };
  };

  const handleViewModeChange = (mode: 'mois' | 'tous') => {
    setViewMode(mode);
    setActiveFilter('none');
    setCalendarDate('');
    if (mode === 'tous') {
      setFilters(prev => ({
        ...prev,
        mois: new Date().toISOString().slice(0, 7)
      }));
    }
  };

  const stats = calculateDetailedStats();

  const paidInRange = (paidRangeFrom || paidRangeTo)
    ? credits.filter(c => {
        const isPaid = c.statut === 'Payé' || c.statut === 'Payé en total' || c.statut === 'Payé partiellement';
        if (!isPaid || !c.date_paiement_effectif) return false;
        const d = new Date(c.date_paiement_effectif);
        d.setHours(0, 0, 0, 0);
        if (paidRangeFrom) { const f = new Date(paidRangeFrom); f.setHours(0, 0, 0, 0); if (d < f) return false; }
        if (paidRangeTo)   { const t = new Date(paidRangeTo);   t.setHours(23, 59, 59, 999); if (d > t) return false; }
        return true;
      })
    : [];

  const uniqueUsers = [...new Set(credits.map(c => c.cree_par).filter(Boolean))];
  const uniqueMonths = [...new Set(credits
    .map(c => c.date_credit ? c.date_credit.slice(0, 7) : null)
    .filter(Boolean)
  )].sort().reverse();

  // Obtenir le nom du mois en français
  const getMonthName = (monthString: string) => {
    const [year, month] = monthString.split('-').map(Number);
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  const toggleSelectCredit = (id: number) => {
    setSelectedCreditIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const unpaidIds = filteredCredits
      .filter(c => c.statut !== 'Payé' && c.statut !== 'Payé en total')
      .map(c => c.id);
    const allSelected = unpaidIds.every(id => selectedCreditIds.has(id));
    if (allSelected) {
      setSelectedCreditIds(prev => {
        const next = new Set(prev);
        unpaidIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedCreditIds(prev => {
        const next = new Set(prev);
        unpaidIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const generateImpayesPDF = () => {
    const selected = filteredCredits.filter(c => selectedCreditIds.has(c.id));
    if (selected.length === 0) {
      alert('Veuillez sélectionner au moins un crédit.');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = 210;
      const marginL = 15;
      const marginR = 15;
      const contentW = pageW - marginL - marginR;

      // Header
      doc.setFillColor(220, 38, 38);
      doc.rect(0, 0, pageW, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('ETAT RÉCAPITULATIF DES IMPAYÉS EN COURS', pageW / 2, 12, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`STAR ASSURANCES — Édité le ${new Date().toLocaleDateString('fr-FR')}`, pageW / 2, 22, { align: 'center' });

      // Table header
      let y = 36;
      const colX = [marginL, marginL + 28, marginL + 72, marginL + 92, marginL + 112, marginL + 132, marginL + 152];
      const headers = ['N° Contrat', 'Assuré', 'Branche', 'Crédit (DT)', 'Paiement (DT)', 'Solde (DT)', 'Échéance'];

      doc.setFillColor(37, 99, 235);
      doc.rect(marginL, y, contentW, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      headers.forEach((h, i) => {
        const align = i >= 3 && i <= 5 ? 'right' : 'left';
        if (align === 'right') {
          const nextX = i < headers.length - 1 ? colX[i + 1] : marginL + contentW;
          doc.text(h, nextX - 2, y + 5.5, { align: 'right' });
        } else {
          doc.text(h, colX[i] + 1, y + 5.5);
        }
      });
      y += 8;

      // Table rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      selected.forEach((c, idx) => {
        if (y > 260) {
          doc.addPage();
          y = 15;
        }
        const bg = idx % 2 === 0;
        if (bg) {
          doc.setFillColor(254, 242, 242);
          doc.rect(marginL, y, contentW, 7, 'F');
        }
        doc.setTextColor(30, 30, 30);

        const contrat = (c.numero_contrat || '').substring(0, 14);
        const assure = (c.assure || '').substring(0, 22);
        const branche = (c.branche || '').substring(0, 8);
        const credit = (c.montant_credit || 0).toLocaleString('fr-FR');
        const paiement = (c.paiement || 0).toLocaleString('fr-FR');
        const solde = (c.solde || 0).toLocaleString('fr-FR');
        const echeance = c.date_paiement_prevue
          ? new Date(c.date_paiement_prevue).toLocaleDateString('fr-FR')
          : '-';

        doc.text(contrat, colX[0] + 1, y + 4.8);
        doc.text(assure, colX[1] + 1, y + 4.8);
        doc.text(branche, colX[2] + 1, y + 4.8);
        doc.text(credit, colX[4] - 2, y + 4.8, { align: 'right' });
        doc.text(paiement, colX[5] - 2, y + 4.8, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        doc.text(solde, colX[6] - 2, y + 4.8, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        doc.text(echeance, colX[6] + 1, y + 4.8);
        y += 7;
      });

      // Totals row
      y += 2;
      doc.setFillColor(30, 58, 138);
      doc.rect(marginL, y, contentW, 9, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      const totalCredit = selected.reduce((s, c) => s + (c.montant_credit || 0), 0);
      const totalPaiement = selected.reduce((s, c) => s + (c.paiement || 0), 0);
      const totalSolde = selected.reduce((s, c) => s + (c.solde || 0), 0);
      doc.text(`TOTAL — ${selected.length} crédit(s)`, marginL + 2, y + 6);
      doc.text(totalCredit.toLocaleString('fr-FR'), colX[4] - 2, y + 6, { align: 'right' });
      doc.text(totalPaiement.toLocaleString('fr-FR'), colX[5] - 2, y + 6, { align: 'right' });
      doc.text(totalSolde.toLocaleString('fr-FR'), colX[6] - 2, y + 6, { align: 'right' });
      y += 9;

      // Solde detail box
      y += 6;
      doc.setFillColor(254, 226, 226);
      doc.setDrawColor(220, 38, 38);
      doc.setLineWidth(0.5);
      doc.rect(marginL, y, contentW, 14, 'FD');
      doc.setTextColor(153, 27, 27);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('TOTAL SOLDE IMPAYÉ :', marginL + 4, y + 6);
      doc.setFontSize(13);
      doc.text(`${totalSolde.toLocaleString('fr-FR')} DT`, marginL + 4, y + 12);
      y += 14;

      // Banking message
      y += 8;
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.5);
      const msgLines = [
        'Cher client,',
        'Nous vous prions de régulariser ces impayés par versement bancaire direct sur notre compte :',
        'Numéro : 04140222008106615139  |  Titulaire : SHIRI FARES HAMZA STAR ASSURANCE',
        'Banque : ATTIJARI',
        'Veuillez présenter l\'avis de versement à l\'agence ou par email : ShiriFares.star@agence.com.tn',
        '',
        'Service Recouvrement'
      ];
      const msgH = msgLines.length * 6 + 8;
      doc.rect(marginL, y, contentW, msgH, 'FD');
      doc.setTextColor(30, 64, 175);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      let ly = y + 7;
      msgLines.forEach((line, i) => {
        if (i === 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(30, 64, 175);
        } else if (i === 2) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(220, 38, 38);
        } else if (i === 3 || i === 4) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(30, 64, 175);
        } else if (i === 6) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(30, 64, 175);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(30, 64, 175);
        }
        if (line) doc.text(line, pageW / 2, ly, { align: 'center' });
        ly += 6;
      });

      // Footer
      const footerY = 287;
      doc.setFillColor(220, 38, 38);
      doc.rect(0, footerY - 4, pageW, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('STAR ASSURANCES — Service Recouvrement', pageW / 2, footerY + 2, { align: 'center' });

      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      doc.save(`Etat_Impayes_${date}.pdf`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2">Chargement des crédits...</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <style>{`
        @keyframes neon-slide {
          0%   { transform: translateX(0px);  box-shadow: 0 0 4px 1px rgba(239,68,68,0.9), 0 0 10px 3px rgba(239,68,68,0.5); }
          30%  { transform: translateX(4px);  box-shadow: 0 0 8px 2px rgba(239,68,68,1),   0 0 18px 6px rgba(239,68,68,0.7); }
          60%  { transform: translateX(-4px); box-shadow: 0 0 8px 2px rgba(239,68,68,1),   0 0 18px 6px rgba(239,68,68,0.7); }
          100% { transform: translateX(0px);  box-shadow: 0 0 4px 1px rgba(239,68,68,0.9), 0 0 10px 3px rgba(239,68,68,0.5); }
        }
        .neon-overdue-badge {
          animation: neon-slide 1.4s ease-in-out infinite;
          display: inline-flex; align-items: center; gap: 3px;
          padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 800;
          color: #fff; background: #dc2626; border: 1px solid #ef4444;
          letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap;
        }
        @keyframes neon-slide-yellow {
          0%   { transform: translateX(0px);  box-shadow: 0 0 4px 1px rgba(234,179,8,0.9), 0 0 10px 3px rgba(234,179,8,0.5); }
          30%  { transform: translateX(4px);  box-shadow: 0 0 8px 2px rgba(234,179,8,1),   0 0 18px 6px rgba(234,179,8,0.7); }
          60%  { transform: translateX(-4px); box-shadow: 0 0 8px 2px rgba(234,179,8,1),   0 0 18px 6px rgba(234,179,8,0.7); }
          100% { transform: translateX(0px);  box-shadow: 0 0 4px 1px rgba(234,179,8,0.9), 0 0 10px 3px rgba(234,179,8,0.5); }
        }
        .neon-due-soon-badge {
          animation: neon-slide-yellow 1.4s ease-in-out infinite;
          display: inline-flex; align-items: center; gap: 3px;
          padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 800;
          color: #713f12; background: #fef08a; border: 1px solid #eab308;
          letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap;
        }
      `}</style>
      <div className="bg-white rounded-lg shadow-lg p-4 lg:p-6">
        {/* En-tête avec informations utilisateur */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <CreditCard className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              {activeFilter === 'echeances'
                ? 'Échéances dans 7 jours'
                : activeFilter === 'retard'
                ? 'Crédits en Retard'
                : activeFilter === 'calendrier' && calendarDate
                ? `Échéances du ${new Date(calendarDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`
                : viewMode === 'mois'
                ? `Crédits du ${getMonthName(filters.mois)}`
                : 'Tous les Crédits'}
            </h2>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
              activeFilter === 'echeances'
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                : activeFilter === 'retard'
                ? 'bg-red-100 text-red-800 border border-red-300'
                : activeFilter === 'calendrier'
                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                : 'bg-blue-100 text-blue-800 border border-blue-300'
            }`}>
              {activeFilter === 'echeances'
                ? `${filteredCredits.length} échéances`
                : activeFilter === 'retard'
                ? `${filteredCredits.length} en retard`
                : activeFilter === 'calendrier'
                ? `${filteredCredits.length} crédit${filteredCredits.length !== 1 ? 's' : ''}`
                : viewMode === 'mois'
                ? `${filteredCredits.length} crédits ce mois`
                : `${filteredCredits.length} crédits au total`}
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            {syncMsg && (
              <span className="text-sm font-medium px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg">
                {syncMsg}
              </span>
            )}
            <button
              onClick={() => handleSync(false)}
              disabled={syncing}
              title="Synchroniser les crédits manquants depuis le rapport"
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors disabled:opacity-60"
            >
              <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncing ? 'Sync...' : 'Synchroniser'}
            </button>
            <div className="flex items-center space-x-2 bg-gray-100 rounded-lg px-3 py-2">
              <User className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                Connecté en tant que: <span className="text-blue-600">{currentUser || 'Non connecté'}</span>
              </span>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => handleViewModeChange('mois')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'mois' && activeFilter === 'none'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Vue Mensuelle
              </button>
              <button
                onClick={() => handleViewModeChange('tous')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'tous' && activeFilter === 'none'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Tous les Crédits
              </button>
              {(activeFilter === 'echeances' || activeFilter === 'retard' || activeFilter === 'calendrier') && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Effacer Filtres
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bouton d'exportation */}
        <div className="flex justify-between items-center mb-4">
          <div>
            {(activeFilter === 'echeances' || activeFilter === 'retard') && (
              <div className={`text-sm font-medium ${
                activeFilter === 'echeances' ? 'text-yellow-700' : 'text-red-700'
              }`}>
                Filtre actif: {activeFilter === 'echeances' ? 'Échéances 7 jours' : 'Crédits en retard'}
              </div>
            )}
          </div>
          
          <div className="flex space-x-2">
            {selectedCreditIds.size > 0 && (
              <button
                onClick={generateImpayesPDF}
                disabled={isGeneratingPdf}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                <FileText className="w-4 h-4" />
                <span>
                  {isGeneratingPdf ? 'Génération...' : `État Impayés PDF (${selectedCreditIds.size})`}
                </span>
              </button>
            )}
            <button
              onClick={exportToExcelSimple}
              disabled={filteredCredits.length === 0 || isExporting}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                filteredCredits.length === 0 || isExporting
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Export Simple (Test)</span>
            </button>
            
            <button
              onClick={exportToExcel}
              disabled={filteredCredits.length === 0 || isExporting}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                filteredCredits.length === 0 || isExporting
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Export...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Export Complet</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Bannière d'information pour les permissions */}
        {!isHamza && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <p className="text-blue-700 text-sm">
                <strong>Mode consultation uniquement :</strong> Seul Hamza peut modifier ou supprimer des crédits.
              </p>
            </div>
          </div>
        )}

        {/* Indicateur mode édition pour Hamza */}
        {isHamza && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-green-700 text-sm font-medium">
                <strong>Mode édition activé :</strong> Vous pouvez modifier les statuts et supprimer des crédits.
              </p>
            </div>
          </div>
        )}

        {/* Filtre calendrier — date d'échéance précise */}
        <div className="flex flex-wrap items-center gap-3 mb-5 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Calendar className="w-4.5 h-4.5 text-indigo-600" />
            </div>
            <span className="text-sm font-semibold text-indigo-800 whitespace-nowrap">
              Filtrer par date d'échéance :
            </span>
          </div>
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <input
              type="date"
              value={calendarDate}
              onChange={(e) => handleCalendarDateChange(e.target.value)}
              className="px-3 py-2 border border-indigo-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm cursor-pointer"
            />
            {calendarDate && (
              <button
                onClick={() => handleCalendarDateChange('')}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm font-medium transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Effacer
              </button>
            )}
          </div>
          {activeFilter === 'calendrier' && (
            <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
              <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-bold">
                {filteredCredits.length} crédit{filteredCredits.length !== 1 ? 's' : ''} à échéance
              </span>
              {filteredCredits.length === 0 && (
                <span className="text-xs text-indigo-500 italic">Aucun crédit non payé à cette date</span>
              )}
            </div>
          )}
        </div>

        {/* Statistiques Détaillées */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 cursor-pointer hover:bg-blue-100 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">
                  {viewMode === 'mois' ? 'Crédits du Mois' : 'Total Crédits'}
                </p>
                <p className="text-xl font-bold text-blue-900">{stats.totalCredits}</p>
                <p className="text-sm text-blue-700">{stats.totalMontant.toLocaleString('fr-FR')} DT</p>
              </div>
              <CreditCard className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div
            className="bg-green-50 rounded-lg p-4 cursor-pointer hover:bg-green-100 transition-colors"
            onClick={() => openStatsModal('payes')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Montant Payé</p>
                <p className="text-xl font-bold text-green-900">{stats.montantPaye.toLocaleString('fr-FR')} DT</p>
                <p className="text-sm text-green-700">{stats.payes} crédits</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div
            className="bg-orange-50 rounded-lg p-4 cursor-pointer hover:bg-orange-100 transition-colors"
            onClick={() => openStatsModal('nonPayes')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Montant Non Payé</p>
                <p className="text-xl font-bold text-orange-900">{stats.montantNonPaye.toLocaleString('fr-FR')} DT</p>
                <p className="text-sm text-orange-700">{stats.nonPayes} crédits</p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </div>

          <div
            className={`rounded-lg p-4 cursor-pointer transition-colors ${
              activeFilter === 'echeances'
                ? 'bg-yellow-100 border-2 border-yellow-400'
                : 'bg-purple-50 hover:bg-purple-100'
            }`}
            onClick={() => {
              showDueIn7Days();
              openStatsModal('echeances');
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Échéances 7 jours</p>
                <p className="text-xl font-bold text-purple-900">{stats.montantDueIn7Days.toLocaleString('fr-FR')} DT</p>
                <p className="text-sm text-purple-700">{stats.creditsDueIn7Days} crédits</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Taux de Recouvrement et Retards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <TrendingUp className="w-6 h-6 text-cyan-600" />
                <div>
                  <h3 className="text-lg font-semibold text-cyan-900">
                    {viewMode === 'mois' ? 'Taux de Recouvrement Mois' : 'Taux de Recouvrement Global'}
                  </h3>
                  <p className="text-cyan-700">Pourcentage du montant total récupéré</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-cyan-900">{stats.tauxRecouvrement.toFixed(1)}%</p>
                <p className="text-cyan-700">
                  {stats.montantPaye.toLocaleString('fr-FR')} DT / {stats.totalMontant.toLocaleString('fr-FR')} DT
                </p>
              </div>
            </div>
            <div className="mt-3 w-full bg-cyan-200 rounded-full h-2">
              <div 
                className="bg-cyan-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(stats.tauxRecouvrement, 100)}%` }}
              ></div>
            </div>
          </div>

          <div
            className={`rounded-lg p-4 cursor-pointer transition-colors ${
              activeFilter === 'retard'
                ? 'bg-red-100 border-2 border-red-400'
                : 'bg-red-50 hover:bg-red-100'
            }`}
            onClick={() => {
              showOverdueCredits();
              openStatsModal('retard');
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Crédits en Retard</p>
                <p className="text-xl font-bold text-red-900">{stats.montantOverdue.toLocaleString('fr-FR')} DT</p>
                <p className="text-sm text-red-700">{stats.overdueCredits} crédits</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* Bouton Evolution P/C */}
        <div className="mb-6">
          <button
            onClick={() => setIsEvolutionModalOpen(true)}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center space-x-3"
          >
            <BarChart3 className="w-6 h-6" />
            <span className="text-lg">Evolution P/C - Analyse 15 Derniers Jours</span>
          </button>
        </div>

        {/* Section: Crédits Payés par Période */}
        <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="text-base font-bold text-green-900">Crédits Payés — Par Période</h3>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="text-sm text-green-700 font-medium whitespace-nowrap">Du</span>
            <input
              type="date"
              value={paidRangeFrom}
              onChange={e => { setPaidRangeFrom(e.target.value); setShowPaidDetails(false); }}
              className="px-3 py-1.5 border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 bg-white shadow-sm"
            />
            <span className="text-sm text-green-700 font-medium whitespace-nowrap">au</span>
            <input
              type="date"
              value={paidRangeTo}
              onChange={e => { setPaidRangeTo(e.target.value); setShowPaidDetails(false); }}
              className="px-3 py-1.5 border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 bg-white shadow-sm"
            />
            {(paidRangeFrom || paidRangeTo) && (
              <button
                onClick={() => { setPaidRangeFrom(''); setPaidRangeTo(''); setShowPaidDetails(false); }}
                className="text-xs text-red-500 hover:text-red-700 font-medium underline"
              >
                Effacer
              </button>
            )}
          </div>

          {(paidRangeFrom || paidRangeTo) && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-white rounded-xl p-3 shadow-sm border border-green-100 text-center">
                  <p className="text-3xl font-bold text-green-700">{paidInRange.length}</p>
                  <p className="text-xs text-gray-500 font-medium mt-1">Crédits payés</p>
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm border border-green-100 text-center">
                  <p className="text-xl font-bold text-green-700 tabular-nums">
                    {paidInRange.reduce((a, c) => a + (c.paiement || 0), 0).toLocaleString('fr-FR')} DT
                  </p>
                  <p className="text-xs text-gray-500 font-medium mt-1">Montant encaissé</p>
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm border border-blue-100 text-center">
                  <p className="text-xl font-bold text-blue-700 tabular-nums">
                    {paidInRange.reduce((a, c) => a + (c.montant_credit || 0), 0).toLocaleString('fr-FR')} DT
                  </p>
                  <p className="text-xs text-gray-500 font-medium mt-1">Total crédits</p>
                </div>
              </div>

              {paidInRange.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Aucun crédit payé dans cette période.</p>
              ) : (
                <>
                  <button
                    onClick={() => setShowPaidDetails(v => !v)}
                    className="flex items-center gap-1.5 text-sm font-semibold text-green-700 hover:text-green-900 transition-colors mb-3"
                  >
                    {showPaidDetails ? '▲ Masquer' : '▼ Voir'} les détails ({paidInRange.length} crédit{paidInRange.length > 1 ? 's' : ''})
                  </button>

                  {showPaidDetails && (
                    <div className="overflow-x-auto rounded-lg border border-green-200">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-green-100 border-b border-green-200">
                            <th className="px-3 py-2 text-left font-semibold text-green-800">N° Contrat</th>
                            <th className="px-3 py-2 text-left font-semibold text-green-800">Assuré</th>
                            <th className="px-3 py-2 text-left font-semibold text-green-800">Branche</th>
                            <th className="px-3 py-2 text-right font-semibold text-green-800">Crédit (DT)</th>
                            <th className="px-3 py-2 text-right font-semibold text-green-800">Payé (DT)</th>
                            <th className="px-3 py-2 text-right font-semibold text-green-800">Solde (DT)</th>
                            <th className="px-3 py-2 text-left font-semibold text-green-800">Date Paiement</th>
                            <th className="px-3 py-2 text-left font-semibold text-green-800">Statut</th>
                            <th className="px-3 py-2 text-left font-semibold text-green-800">Créé par</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-green-50 bg-white">
                          {paidInRange.map(c => (
                            <tr key={c.id} className="hover:bg-green-50 transition-colors">
                              <td className="px-3 py-2 font-medium text-gray-900">{c.numero_contrat}</td>
                              <td className="px-3 py-2 text-gray-700">{c.assure}</td>
                              <td className="px-3 py-2">
                                <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700">{c.branche}</span>
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-blue-700 tabular-nums">
                                {(c.montant_credit || 0).toLocaleString('fr-FR')}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-green-700 tabular-nums">
                                {(c.paiement || 0).toLocaleString('fr-FR')}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                                {(c.solde || 0).toLocaleString('fr-FR')}
                              </td>
                              <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                                {c.date_paiement_effectif
                                  ? new Date(c.date_paiement_effectif).toLocaleDateString('fr-FR')
                                  : '-'}
                              </td>
                              <td className="px-3 py-2">
                                <span className={`px-1.5 py-0.5 rounded-full font-semibold ${getStatusColor(c.statut)}`}>
                                  {c.statut}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-600">{c.cree_par}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-green-50 border-t border-green-200 font-semibold text-green-900">
                            <td colSpan={3} className="px-3 py-2">Total</td>
                            <td className="px-3 py-2 text-right tabular-nums text-blue-800">
                              {paidInRange.reduce((a, c) => a + (c.montant_credit || 0), 0).toLocaleString('fr-FR')}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-green-800">
                              {paidInRange.reduce((a, c) => a + (c.paiement || 0), 0).toLocaleString('fr-FR')}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                              {paidInRange.reduce((a, c) => a + (c.solde || 0), 0).toLocaleString('fr-FR')}
                            </td>
                            <td colSpan={3} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Filtres (masqués quand un filtre spécial est actif) */}
        {activeFilter === 'none' && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <Filter className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Filtres</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {viewMode === 'mois' && (
                <input
                  type="month"
                  name="mois"
                  value={filters.mois}
                  onChange={handleFilterChange}
                  className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}

              <input
                type="text"
                name="nomClient"
                value={filters.nomClient}
                onChange={handleFilterChange}
                placeholder="Nom du client..."
                className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              <select
                name="statut"
                value={filters.statut}
                onChange={handleFilterChange}
                className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les statuts</option>
                <option value="Non payé">Non payé</option>
                <option value="Payé">Payé</option>
                <option value="Payé partiellement">Payé partiellement</option>
                <option value="Payé en total">Payé en total</option>
                <option value="En retard">En retard</option>
              </select>

              <select
                name="branche"
                value={filters.branche}
                onChange={handleFilterChange}
                className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Toutes les branches</option>
                <option value="Auto">Auto</option>
                <option value="Vie">Vie</option>
                <option value="Santé">Santé</option>
                <option value="IRDS">IRDS</option>
              </select>

              <select
                name="createdBy"
                value={filters.createdBy}
                onChange={handleFilterChange}
                className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les utilisateurs</option>
                {uniqueUsers.map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>

              <input
                type="date"
                name="dateFrom"
                value={filters.dateFrom}
                onChange={handleFilterChange}
                className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Date début"
              />

              <input
                type="date"
                name="dateTo"
                value={filters.dateTo}
                onChange={handleFilterChange}
                className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Date fin"
              />
            </div>
          </div>
        )}

        {/* Indicateur de filtre actif */}
        {(activeFilter === 'echeances' || activeFilter === 'retard') && (
          <div className={`rounded-lg p-4 mb-6 ${
            activeFilter === 'echeances' ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {activeFilter === 'echeances' ? (
                  <>
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <p className="text-yellow-700 font-medium">
                      Affichage des crédits avec échéance dans les 7 prochains jours
                    </p>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-600" />
                    <p className="text-red-700 font-medium">
                      Affichage des crédits en retard de paiement
                    </p>
                  </>
                )}
              </div>
              <button
                onClick={clearFilters}
                className="text-sm text-gray-600 hover:text-gray-800 underline"
              >
                Effacer le filtre
              </button>
            </div>
          </div>
        )}

        {/* Liste des crédits */}
        <div id="credits-table" className="overflow-x-auto rounded-lg border border-gray-100 mt-2 w-full">
          <table className="w-full divide-y divide-gray-200 text-sm" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '32px' }} />   {/* Checkbox */}
              <col style={{ width: '108px' }} />  {/* N° Contrat */}
              <col />                              {/* Assuré — prend l'espace restant */}
              <col style={{ width: '62px' }} />   {/* Branche */}
              <col style={{ width: '66px' }} />   {/* Prime */}
              <col style={{ width: '66px' }} />   {/* Crédit */}
              <col style={{ width: '66px' }} />   {/* Paiement */}
              <col style={{ width: '80px' }} />   {/* Solde */}
              <col style={{ width: '80px' }} />   {/* Date Crédit */}
              <col style={{ width: '118px' }} />  {/* Échéance */}
              <col style={{ width: '100px' }} />  {/* Statut */}
              <col style={{ width: '82px' }} />   {/* Paiement Effectif */}
              <col style={{ width: '66px' }} />   {/* Créé par */}
              {isHamza && <col style={{ width: '64px' }} />}  {/* Actions */}
            </colgroup>
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  <input
                    type="checkbox"
                    title="Tout sélectionner (impayés)"
                    onChange={toggleSelectAll}
                    checked={
                      filteredCredits.filter(c => c.statut !== 'Payé' && c.statut !== 'Payé en total').length > 0 &&
                      filteredCredits.filter(c => c.statut !== 'Payé' && c.statut !== 'Payé en total').every(c => selectedCreditIds.has(c.id))
                    }
                    className="w-3.5 h-3.5 cursor-pointer"
                  />
                </th>
                <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">N° Contrat</th>
                <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Assuré</th>
                <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Branche</th>
                <th className="px-2 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Prime</th>
                <th className="px-2 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Crédit</th>
                <th className="px-2 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Paiem.</th>
                <th className="px-2 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Solde</th>
                <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Dt Crédit</th>
                <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Échéance</th>
                <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Statut</th>
                <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Dt Paiement</th>
                <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Créé par</th>
                {isHamza && <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredCredits.map((credit) => {
                const isPaid = credit.statut === 'Payé' || credit.statut === 'Payé en total';
                const isPartial = credit.statut === 'Payé partiellement';
                const rowBg = isPaid
                  ? 'bg-green-50 hover:bg-green-100'
                  : isPartial
                  ? 'bg-orange-50 hover:bg-orange-100'
                  : 'bg-red-50 hover:bg-red-100';
                const todayMidnight = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
                const isOverdue = !isPaid && !!credit.date_paiement_prevue && (() => {
                  const due = new Date(credit.date_paiement_prevue);
                  due.setHours(0, 0, 0, 0);
                  return due < todayMidnight;
                })();
                const isDueSoon = !isPaid && !isOverdue && !!credit.date_paiement_prevue && (() => {
                  const due = new Date(credit.date_paiement_prevue);
                  due.setHours(0, 0, 0, 0);
                  const in5 = new Date(todayMidnight);
                  in5.setDate(todayMidnight.getDate() + 5);
                  return due >= todayMidnight && due <= in5;
                })();
                return (
                <tr
                  key={credit.id}
                  className={`transition-colors ${rowBg} ${!isPaid ? 'cursor-pointer' : 'cursor-default'}`}
                  onClick={() => { if (!isPaid) setSelectedCreditForPayment(credit); }}
                  onMouseEnter={(e) => {
                    setHoveredCredit(credit);
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top - 10 });
                  }}
                  onMouseLeave={() => setHoveredCredit(null)}
                >
                  <td className="px-2 py-2.5 text-center overflow-hidden" onClick={e => e.stopPropagation()}>
                    {!isPaid && (
                      <input
                        type="checkbox"
                        checked={selectedCreditIds.has(credit.id)}
                        onChange={() => toggleSelectCredit(credit.id)}
                        className="w-3.5 h-3.5 cursor-pointer accent-red-600"
                      />
                    )}
                  </td>
                  <td className="px-2 py-2.5 font-medium text-gray-900 truncate" title={credit.numero_contrat}>
                    {credit.numero_contrat}
                  </td>
                  <td className="px-2 py-2.5 text-gray-900 truncate" title={credit.assure}>
                    {credit.assure}
                  </td>
                  <td className="px-2 py-2.5 truncate">
                    <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {credit.branche}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right text-gray-700 tabular-nums whitespace-nowrap overflow-hidden">
                    {(credit.prime || 0).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-2 py-2.5 text-right font-semibold text-blue-700 tabular-nums whitespace-nowrap overflow-hidden">
                    {(credit.montant_credit || 0).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-2 py-2.5 text-right text-gray-700 tabular-nums whitespace-nowrap overflow-hidden">
                    {(credit.paiement || 0).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap overflow-hidden">
                    {(credit.solde !== null && credit.solde !== undefined && credit.solde !== 0) ? (
                      <div className="flex items-center justify-end gap-1">
                        <span className={`font-bold text-xs ${credit.solde > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {credit.solde.toLocaleString('fr-FR')}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedCreditForSMS(credit); }}
                          className="p-0.5 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 hover:text-blue-700 transition-all flex-shrink-0"
                          title="Envoyer un SMS de rappel"
                        >
                          <MessageSquare className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="font-semibold text-xs text-gray-400">
                        {(credit.solde || 0).toLocaleString('fr-FR')}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-gray-700 whitespace-nowrap overflow-hidden text-xs">
                    {credit.date_credit ? new Date(credit.date_credit).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-2 py-2.5 overflow-hidden">
                    {credit.date_paiement_prevue ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs whitespace-nowrap ${
                          isOverdue ? 'font-semibold text-red-700' :
                          isDueSoon ? 'font-semibold text-yellow-700' :
                          'text-gray-700'
                        }`}>
                          {new Date(credit.date_paiement_prevue).toLocaleDateString('fr-FR')}
                        </span>
                        {isOverdue && <span className="neon-overdue-badge">⚠ RETARD</span>}
                        {isDueSoon && <span className="neon-due-soon-badge">⏰ PROCHE</span>}
                      </div>
                    ) : <span className="text-xs text-gray-400">-</span>}
                  </td>
                  <td className="px-2 py-2.5 overflow-hidden">
                    <div className="flex items-center gap-1">
                      {getStatusIcon(credit.statut)}
                      <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full whitespace-nowrap ${getStatusColor(credit.statut)}`}>
                        {credit.statut}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-gray-700 whitespace-nowrap overflow-hidden text-xs">
                    {credit.date_paiement_effectif ? new Date(credit.date_paiement_effectif).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-2 py-2.5 text-gray-700 truncate text-xs" title={credit.cree_par}>
                    {credit.cree_par}
                  </td>
                  {isHamza && (
                    <td className="px-2 py-2.5 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5">
                        {credit.statut !== 'Payé' && credit.statut !== 'Payé en total' && (
                          <button
                            onClick={() => handleStatusUpdate(credit.id, 'Payé')}
                            className="p-1 rounded text-green-600 hover:text-green-800 hover:bg-green-100 transition-colors"
                            title="Marquer comme payé"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {credit.statut === 'Non payé' && (
                          <button
                            onClick={() => handleStatusUpdate(credit.id, 'En retard')}
                            className="p-1 rounded text-orange-500 hover:text-orange-700 hover:bg-orange-100 transition-colors"
                            title="Marquer en retard"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteCredit(credit.id, credit.assure); }}
                          className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-100 transition-colors"
                          title="Supprimer ce crédit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>

          {filteredCredits.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {activeFilter === 'echeances'
                ? 'Aucun crédit avec échéance dans les 7 prochains jours'
                : activeFilter === 'retard'
                ? 'Aucun crédit en retard'
                : 'Aucun crédit trouvé avec les filtres sélectionnés'}
            </div>
          )}
        </div>

        {hoveredCredit && (
          <div
            className="fixed z-50 bg-white border-2 border-blue-500 shadow-2xl rounded-lg p-6 max-w-md"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: 'translate(-50%, -100%)',
              pointerEvents: 'none'
            }}
          >
            <div className="space-y-3">
              <div className="border-b border-gray-200 pb-2">
                <h3 className="text-lg font-bold text-blue-900">Détails du Crédit</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 font-medium">Numéro Contrat</p>
                  <p className="font-semibold text-gray-900">{hoveredCredit.numero_contrat}</p>
                </div>
                <div>
                  <p className="text-gray-500 font-medium">Branche</p>
                  <p className="font-semibold text-gray-900">{hoveredCredit.branche}</p>
                </div>

                <div className="col-span-2">
                  <p className="text-gray-500 font-medium">Assuré</p>
                  <p className="font-semibold text-gray-900">{hoveredCredit.assure}</p>
                </div>

                {hoveredCredit.telephone && (
                  <div className="col-span-2">
                    <p className="text-gray-500 font-medium">Téléphone</p>
                    <p className="font-semibold text-blue-600">{hoveredCredit.telephone}</p>
                  </div>
                )}

                <div>
                  <p className="text-gray-500 font-medium">Prime</p>
                  <p className="font-semibold text-blue-600">{(hoveredCredit.prime || 0).toLocaleString('fr-FR')} DT</p>
                </div>
                <div>
                  <p className="text-gray-500 font-medium">Montant Crédit</p>
                  <p className="font-semibold text-blue-600">{(hoveredCredit.montant_credit || 0).toLocaleString('fr-FR')} DT</p>
                </div>

                <div>
                  <p className="text-gray-500 font-medium">Paiement</p>
                  <p className="font-semibold text-green-600">{(hoveredCredit.paiement || 0).toLocaleString('fr-FR')} DT</p>
                </div>
                <div>
                  <p className="text-gray-500 font-medium">Solde</p>
                  <p className={`font-semibold ${(hoveredCredit.solde || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {(hoveredCredit.solde || 0).toLocaleString('fr-FR')} DT
                  </p>
                </div>

                <div>
                  <p className="text-gray-500 font-medium">Date Crédit</p>
                  <p className="font-semibold text-gray-900">
                    {hoveredCredit.date_credit ? new Date(hoveredCredit.date_credit).toLocaleDateString('fr-FR') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 font-medium">Date Prévue</p>
                  <p className="font-semibold text-gray-900">
                    {hoveredCredit.date_paiement_prevue ? new Date(hoveredCredit.date_paiement_prevue).toLocaleDateString('fr-FR') : '-'}
                  </p>
                </div>

                <div>
                  <p className="text-gray-500 font-medium">Statut</p>
                  <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(hoveredCredit.statut)}`}>
                    {hoveredCredit.statut}
                  </span>
                </div>
                <div>
                  <p className="text-gray-500 font-medium">Date Effectif</p>
                  <p className="font-semibold text-gray-900">
                    {hoveredCredit.date_paiement_effectif ? new Date(hoveredCredit.date_paiement_effectif).toLocaleDateString('fr-FR') : '-'}
                  </p>
                </div>

                <div className="col-span-2">
                  <p className="text-gray-500 font-medium">Créé par</p>
                  <p className="font-semibold text-gray-900">{hoveredCredit.cree_par}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Credit Payment Modal */}
        <CreditPaymentModal
          isOpen={!!selectedCreditForPayment}
          credit={selectedCreditForPayment}
          isHamza={isHamza}
          onClose={() => setSelectedCreditForPayment(null)}
          onPaymentSuccess={loadCredits}
        />

        {/* SMS Modal */}
        <SMSModal
          isOpen={!!selectedCreditForSMS}
          onClose={() => setSelectedCreditForSMS(null)}
          credit={selectedCreditForSMS || {
            numero_contrat: '',
            assure: '',
            solde: 0,
            telephone: ''
          }}
        />

        {/* Stats Detail Modal */}
        {statsModalData && (
          <CreditDetailsModal
            isOpen={isStatsModalOpen}
            onClose={() => {
              setIsStatsModalOpen(false);
              setStatsModalData(null);
            }}
            title={statsModalData.title}
            credits={statsModalData.credits}
            type={statsModalData.type}
          />
        )}

        {/* Evolution P/C Modal */}
        <CreditEvolutionModal
          isOpen={isEvolutionModalOpen}
          onClose={() => setIsEvolutionModalOpen(false)}
        />
      </div>
    </div>
  );
};

export default CreditsList;