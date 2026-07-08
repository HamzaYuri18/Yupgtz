import React, { useState, useEffect } from 'react';
import { CreditCard, ListFilter as Filter, Calendar, CircleCheck as CheckCircle, Circle as XCircle, Clock, TrendingUp, TriangleAlert as AlertTriangle, DollarSign, User, Download, MessageSquare, ChartBar as BarChart2, Trash2, FileText } from 'lucide-react';
import { getCredits, updateCreditStatus, deleteCredit } from '../utils/supabaseService';
import { getSession } from '../utils/auth';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import SMSModal from './SMSModal';
import CreditDetailsModal from './CreditDetailsModal';
import CreditEvolutionModal from './CreditEvolutionModal';

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
  const [activeFilter, setActiveFilter] = useState<'none' | 'echeances' | 'retard'>('none');
  const [isExporting, setIsExporting] = useState(false);
  const [hoveredCredit, setHoveredCredit] = useState<any | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [selectedCreditForSMS, setSelectedCreditForSMS] = useState<any | null>(null);

  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [statsModalData, setStatsModalData] = useState<{
    title: string;
    credits: any[];
    type: 'payes' | 'nonPayes' | 'echeances' | 'retard';
  } | null>(null);
  const [isEvolutionModalOpen, setIsEvolutionModalOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const isHamza = currentUser === 'Hamza';
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const session = getSession();
    if (session && session.username) {
      setCurrentUser(session.username);
    }
    loadCredits();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, credits, viewMode, activeFilter]);

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

  const exportToExcel = () => {
    if (filteredCredits.length === 0) {
      alert('Aucune donnée à exporter.');
      return;
    }

    try {
      setIsExporting(true);

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

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      const colWidths = [
        { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 15 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 15 },
        { wch: 18 }, { wch: 15 }
      ];
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Credits');

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

      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Erreur lors de l\'exportation:', error);
      alert('Erreur lors de l\'exportation. Voir la console pour plus de détails.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToExcelSimple = () => {
    if (filteredCredits.length === 0) {
      alert('Aucune donnée à exporter.');
      return;
    }

    try {
      setIsExporting(true);

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
    } else {
      filtered = filtered.filter(credit => {
        const creditDate = credit.date_credit ? new Date(credit.date_credit) : new Date();
        const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : new Date('1900-01-01');
        const toDate = filters.dateTo ? new Date(filters.dateTo) : new Date('2100-12-31');

        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        creditDate.setHours(0, 0, 0, 0);

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
    setSelectedIds(new Set());
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
    if (mode === 'tous') {
      setFilters(prev => ({
        ...prev,
        mois: new Date().toISOString().slice(0, 7)
      }));
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCredits.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCredits.map(c => c.id)));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generateImpayesPDF = () => {
    const selected = filteredCredits.filter(c => selectedIds.has(c.id));
    if (selected.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const today = new Date().toLocaleDateString('fr-FR');

    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ÉTAT RÉCAPITULATIF DES IMPAYÉS EN COURS', pageW / 2, 10, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Édité le : ${today}`, pageW / 2, 17, { align: 'center' });

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('STAR ASSURANCES', margin, 30);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nombre d'impayés sélectionnés : ${selected.length}`, pageW - margin, 30, { align: 'right' });

    const cols = [
      { label: 'N° Contrat', x: margin, w: 30 },
      { label: 'Assuré', x: margin + 30, w: 50 },
      { label: 'Branche', x: margin + 80, w: 22 },
      { label: 'Prime (DT)', x: margin + 102, w: 28 },
      { label: 'Crédit (DT)', x: margin + 130, w: 28 },
      { label: 'Paiement (DT)', x: margin + 158, w: 30 },
      { label: 'Solde (DT)', x: margin + 188, w: 28 },
      { label: 'Échéance', x: margin + 216, w: 28 },
      { label: 'Statut', x: margin + 244, w: 28 },
    ];

    let y = 38;
    const rowH = 8;

    doc.setFillColor(219, 234, 254);
    doc.rect(margin, y, pageW - margin * 2, rowH, 'F');
    doc.setDrawColor(147, 197, 253);
    doc.rect(margin, y, pageW - margin * 2, rowH, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 64, 175);
    cols.forEach(col => {
      doc.text(col.label, col.x + 1, y + 5.5);
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    let totalSolde = 0;
    let totalPrime = 0;
    let totalCredit = 0;
    let totalPaiement = 0;

    selected.forEach((credit, i) => {
      y += rowH;
      if (y + rowH > pageH - 55) {
        doc.addPage();
        y = 20;
        doc.setFillColor(219, 234, 254);
        doc.rect(margin, y, pageW - margin * 2, rowH, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 64, 175);
        cols.forEach(col => doc.text(col.label, col.x + 1, y + 5.5));
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        y += rowH;
      }

      const isEven = i % 2 === 0;
      doc.setFillColor(isEven ? 249 : 255, isEven ? 250 : 255, isEven ? 251 : 255);
      doc.rect(margin, y, pageW - margin * 2, rowH, 'F');
      doc.setDrawColor(229, 231, 235);
      doc.rect(margin, y, pageW - margin * 2, rowH, 'S');

      const solde = credit.solde || 0;
      const prime = credit.prime || 0;
      const creditAmt = credit.montant_credit || 0;
      const paiement = credit.paiement || 0;
      totalSolde += solde;
      totalPrime += prime;
      totalCredit += creditAmt;
      totalPaiement += paiement;

      doc.setTextColor(50, 50, 50);
      doc.text(credit.numero_contrat || '', cols[0].x + 1, y + 5.5);
      const assureText = (credit.assure || '').length > 22 ? credit.assure.substring(0, 22) + '…' : credit.assure || '';
      doc.text(assureText, cols[1].x + 1, y + 5.5);
      doc.text(credit.branche || '', cols[2].x + 1, y + 5.5);
      doc.setTextColor(70, 70, 70);
      doc.text(prime.toLocaleString('fr-FR', { minimumFractionDigits: 3 }), cols[3].x + cols[3].w - 2, y + 5.5, { align: 'right' });
      doc.text(creditAmt.toLocaleString('fr-FR', { minimumFractionDigits: 3 }), cols[4].x + cols[4].w - 2, y + 5.5, { align: 'right' });
      doc.text(paiement.toLocaleString('fr-FR', { minimumFractionDigits: 3 }), cols[5].x + cols[5].w - 2, y + 5.5, { align: 'right' });
      doc.setTextColor(solde > 0 ? 185 : 22, solde > 0 ? 28 : 163, solde > 0 ? 28 : 74);
      doc.setFont('helvetica', 'bold');
      doc.text(solde.toLocaleString('fr-FR', { minimumFractionDigits: 3 }), cols[6].x + cols[6].w - 2, y + 5.5, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      const echeance = credit.date_paiement_prevue ? new Date(credit.date_paiement_prevue).toLocaleDateString('fr-FR') : '-';
      doc.text(echeance, cols[7].x + 1, y + 5.5);
      doc.text(credit.statut || '', cols[8].x + 1, y + 5.5);
    });

    y += rowH + 2;
    if (y + rowH + 2 > pageH - 50) { doc.addPage(); y = 20; }

    doc.setFillColor(30, 64, 175);
    doc.rect(margin, y, pageW - margin * 2, rowH + 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('TOTAL SOLDE IMPAYÉS', cols[0].x + 1, y + 6);
    doc.text(totalPrime.toLocaleString('fr-FR', { minimumFractionDigits: 3 }) + ' DT', cols[3].x + cols[3].w - 2, y + 6, { align: 'right' });
    doc.text(totalCredit.toLocaleString('fr-FR', { minimumFractionDigits: 3 }) + ' DT', cols[4].x + cols[4].w - 2, y + 6, { align: 'right' });
    doc.text(totalPaiement.toLocaleString('fr-FR', { minimumFractionDigits: 3 }) + ' DT', cols[5].x + cols[5].w - 2, y + 6, { align: 'right' });
    doc.text(totalSolde.toLocaleString('fr-FR', { minimumFractionDigits: 3 }) + ' DT', cols[6].x + cols[6].w - 2, y + 6, { align: 'right' });

    y += rowH + 6;
    if (y + 20 > pageH - 45) { doc.addPage(); y = 20; }
    doc.setFillColor(239, 246, 255);
    doc.rect(margin, y, pageW - margin * 2, 14, 'F');
    doc.setDrawColor(147, 197, 253);
    doc.rect(margin, y, pageW - margin * 2, 14, 'S');
    doc.setTextColor(30, 64, 175);
    doc.setFontSize(9);
    doc.text('Détail du Solde Total :', margin + 4, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.text(
      `Total Crédits accordés : ${totalCredit.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT   |   ` +
      `Total Paiements reçus : ${totalPaiement.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT   |   ` +
      `Solde restant dû : ${totalSolde.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT`,
      margin + 4, y + 11
    );

    y += 22;
    if (y + 36 > pageH) { doc.addPage(); y = 20; }
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.5);
    doc.rect(margin, y, pageW - margin * 2, 34, 'S');
    doc.setFillColor(254, 242, 242);
    doc.rect(margin + 0.3, y + 0.3, pageW - margin * 2 - 0.6, 33.4, 'F');

    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('AVIS DE PAIEMENT', pageW / 2, y + 7, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 50);
    const msgLines = doc.splitTextToSize(
      'Cher client,\n\nPour votre intérêt et pour des raisons comptables, nous vous prions d\'effectuer le paiement des impayés par un versement bancaire direct sur nos comptes :',
      pageW - margin * 2 - 8
    );
    doc.text(msgLines, margin + 4, y + 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 64, 175);
    doc.text('04140222008106615139  —  SHIRI FARES HAMZA STAR ASSURANCES  —  ATTIJARI BANQUE', pageW / 2, y + 25, { align: 'center' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Service Recouvrement', pageW / 2, y + 31, { align: 'center' });

    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${p} / ${totalPages}`, pageW - margin, pageH - 5, { align: 'right' });
      doc.text('STAR ASSURANCES — Document confidentiel', margin, pageH - 5);
    }

    doc.save(`Etat_Impayes_${today.replace(/\//g, '-')}.pdf`);
  };

  const stats = calculateDetailedStats();
  const uniqueUsers = [...new Set(credits.map(c => c.cree_par).filter(Boolean))];

  const getMonthName = (monthString: string) => {
    const [year, month] = monthString.split('-').map(Number);
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
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
      <div className="bg-white rounded-lg shadow-lg p-4 lg:p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <CreditCard className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              {activeFilter === 'echeances'
                ? 'Échéances dans 7 jours'
                : activeFilter === 'retard'
                ? 'Crédits en Retard'
                : viewMode === 'mois'
                ? `Crédits du ${getMonthName(filters.mois)}`
                : 'Tous les Crédits'}
            </h2>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
              activeFilter === 'echeances'
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                : activeFilter === 'retard'
                ? 'bg-red-100 text-red-800 border border-red-300'
                : 'bg-blue-100 text-blue-800 border border-blue-300'
            }`}>
              {activeFilter === 'echeances'
                ? `${filteredCredits.length} échéances`
                : activeFilter === 'retard'
                ? `${filteredCredits.length} en retard`
                : viewMode === 'mois'
                ? `${filteredCredits.length} crédits ce mois`
                : `${filteredCredits.length} crédits au total`}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-gray-100 rounded-lg px-3 py-2">
              <User className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                Connecté en tant que: <span className="text-blue-600">{currentUser || 'Non connecté'}</span>
              </span>
            </div>

            <button
              onClick={generateImpayesPDF}
              disabled={selectedIds.size === 0}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedIds.size === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
              }`}
              title={selectedIds.size === 0 ? 'Cochez des crédits dans le tableau pour générer le PDF' : `Générer PDF pour ${selectedIds.size} crédit(s)`}
            >
              <FileText className="w-4 h-4" />
              <span>PDF Impayés{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}</span>
            </button>

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
              {(activeFilter === 'echeances' || activeFilter === 'retard') && (
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

        <div className="mb-6">
          <button
            onClick={() => setIsEvolutionModalOpen(true)}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center space-x-3"
          >
            <BarChart2 className="w-6 h-6" />
            <span className="text-lg">Evolution P/C - Analyse 15 Derniers Jours</span>
          </button>
        </div>

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

        <div id="credits-table" className="-mx-4 lg:-mx-6 overflow-x-auto scrollbar-thin">
          <div className="inline-block min-w-full align-middle px-4 lg:px-6">
          <table className="min-w-full divide-y divide-gray-200 text-sm" style={{ minWidth: '900px' }}>
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap w-8">
                  <input
                    type="checkbox"
                    checked={filteredCredits.length > 0 && selectedIds.size === filteredCredits.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                    title="Tout sélectionner / désélectionner"
                  />
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">N° Contrat</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Assuré</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Branche</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Prime</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Crédit</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Paiement</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Solde</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Date Crédit</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Échéance</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Statut</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Paiement Effectif</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Créé par</th>
                {isHamza && (
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredCredits.map((credit) => (
                <tr
                  key={credit.id}
                  className={`transition-colors cursor-pointer ${
                    selectedIds.has(credit.id)
                      ? 'bg-red-100 hover:bg-red-200'
                      : credit.statut === 'Payé' || credit.statut === 'Payé en total'
                      ? 'bg-green-50 hover:bg-green-100'
                      : credit.statut === 'Payé partiellement'
                      ? 'bg-blue-50 hover:bg-blue-100'
                      : credit.statut === 'En retard'
                      ? 'bg-red-50 hover:bg-red-100'
                      : 'hover:bg-gray-50'
                  }`}
                  onMouseEnter={(e) => {
                    setHoveredCredit(credit);
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top - 10 });
                  }}
                  onMouseLeave={() => setHoveredCredit(null)}
                >
                  <td className="px-3 py-2.5 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(credit.id)}
                      onChange={() => toggleSelect(credit.id)}
                      className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-medium text-gray-900">{credit.numero_contrat}</td>
                  <td className="px-3 py-2.5 text-gray-900 max-w-[160px] truncate" title={credit.assure}>{credit.assure}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{credit.branche}</span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right text-gray-700 tabular-nums">{(credit.prime || 0).toLocaleString('fr-FR')}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right font-semibold text-blue-700 tabular-nums">{(credit.montant_credit || 0).toLocaleString('fr-FR')}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right text-gray-700 tabular-nums">{(credit.paiement || 0).toLocaleString('fr-FR')}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right tabular-nums">
                    {(credit.solde !== null && credit.solde !== undefined && credit.solde !== 0) ? (
                      <div className="flex items-center justify-end space-x-1.5">
                        <span className={`font-bold ${credit.solde > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {credit.solde.toLocaleString('fr-FR')}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setSelectedCreditForSMS(credit);
                          }}
                          className="p-1 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 hover:text-blue-700 transition-all hover:scale-110 flex-shrink-0"
                          title="Envoyer un SMS de rappel"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="font-semibold text-gray-400">{(credit.solde || 0).toLocaleString('fr-FR')}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
                    {credit.date_credit ? new Date(credit.date_credit).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
                    {credit.date_paiement_prevue ? new Date(credit.date_paiement_prevue).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center space-x-1.5">
                      {getStatusIcon(credit.statut)}
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(credit.statut)}`}>
                        {credit.statut}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
                    {credit.date_paiement_effectif ? new Date(credit.date_paiement_effectif).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{credit.cree_par}</td>
                  {isHamza && (
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        {credit.statut !== 'Payé' && (
                          <button
                            onClick={() => handleStatusUpdate(credit.id, 'Payé')}
                            className="p-1 rounded text-green-600 hover:text-green-800 hover:bg-green-50 transition-colors"
                            title="Marquer comme payé"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {credit.statut === 'Non payé' && (
                          <button
                            onClick={() => handleStatusUpdate(credit.id, 'En retard')}
                            className="p-1 rounded text-orange-500 hover:text-orange-700 hover:bg-orange-50 transition-colors"
                            title="Marquer en retard"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteCredit(credit.id, credit.assure); }}
                          className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                          title="Supprimer ce crédit"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>

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

        <CreditEvolutionModal
          isOpen={isEvolutionModalOpen}
          onClose={() => setIsEvolutionModalOpen(false)}
        />
      </div>
    </div>
  );
};

export default CreditsList;
