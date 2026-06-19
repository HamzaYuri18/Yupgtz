import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { getRapportContracts } from './supabaseService';
import { getSessionDate } from './auth';

export interface SessionReport {
  sessionDate: string;
  username: string;
  contracts: any[];
  statistics: {
    totalContracts: number;
    totalMontant: number;
    totalPrime: number;
    totalCredit: number;
    totalPrimeNette: number;
    totalEspeces: number;
    totalCheque: number;
    totalCarteBancaire: number;
    byPaymentMode: Record<string, number>;
    byPaymentType: Record<string, number>;
    byType: Record<string, number>;
  };
}

export const generateSessionReport = async (username: string): Promise<SessionReport> => {
  const sessionDate = getSessionDate();
  console.log('📊 Génération du rapport de session pour:', username, 'Date:', sessionDate);

  // Récupérer tous les contrats de la session (TOUS LES UTILISATEURS)
  const allContracts = await getRapportContracts();
  const sessionContracts = allContracts.filter(contract => {
    const contractDate = new Date(contract.created_at).toISOString().split('T')[0];
    return contractDate === sessionDate;
  });

  console.log('📋 Contrats de la session (tous utilisateurs):', sessionContracts.length);

  // Calculer les nouvelles statistiques
  const statistics = {
    totalContracts: sessionContracts.length,
    totalMontant: sessionContracts.reduce((sum, contract) => sum + (contract.montant || 0), 0),
    totalPrime: sessionContracts.reduce((sum, contract) => sum + (contract.prime || 0), 0),
    totalCredit: sessionContracts.reduce((sum, contract) => sum + (contract.montant_credit || 0), 0),
    totalPrimeNette: sessionContracts.reduce((sum, contract) => {
      const prime = contract.prime || 0;
      const credit = contract.montant_credit || 0;
      return sum + (prime - credit);
    }, 0),
    totalEspeces: sessionContracts
      .filter(c => c.mode_paiement === 'Espece')
      .reduce((sum, contract) => sum + (contract.montant || 0), 0),
    totalCheque: sessionContracts
      .filter(c => c.mode_paiement === 'Cheque')
      .reduce((sum, contract) => sum + (contract.montant || 0), 0),
    totalCarteBancaire: sessionContracts
      .filter(c => c.mode_paiement === 'Carte Bancaire')
      .reduce((sum, contract) => sum + (contract.montant || 0), 0),
    byPaymentMode: sessionContracts.reduce((acc, contract) => {
      acc[contract.mode_paiement] = (acc[contract.mode_paiement] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byPaymentType: sessionContracts.reduce((acc, contract) => {
      acc[contract.type_paiement] = (acc[contract.type_paiement] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byType: sessionContracts.reduce((acc, contract) => {
      acc[contract.type] = (acc[contract.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };

  return {
    sessionDate,
    username,
    contracts: sessionContracts,
    statistics
  };
};

// Fonction pour formater les nombres en milliers sans décimales
const formatNumber = (num: number): string => {
  return Math.round(num).toLocaleString('fr-FR', {
    useGrouping: true,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).replace(/\s/g, ' ');
};

// Fonction pour formater une date
const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('fr-FR');
  } catch {
    return dateString;
  }
};

// Fonction pour tronquer le texte
const truncateText = (text: string, maxLength: number): string => {
  if (!text) return '-';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

export const generateQRCode = async (text: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(text, {
      width: 80,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  } catch (error) {
    console.error('Erreur génération QR Code:', error);
    return '';
  }
};

export const generateSessionPDF = async (report: SessionReport): Promise<void> => {
  // Mode paysage A4
  const pdf = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;
  
  // Marges responsives
  const leftMargin = 10;
  const rightMargin = 10;
  const topMargin = 15;
  const bottomMargin = 20;
  const contentWidth = pageWidth - leftMargin - rightMargin;
  
  let yPosition = topMargin;

  // Générer le QR Code
  const qrCodeDataUrl = await generateQRCode('FC_' + report.sessionDate + '_' + report.username);

  // En-tête centré
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SHIRI FARES HAMZA', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  pdf.setFontSize(12);
  pdf.text('FICHE DE CAISSE DÉTAILLÉE', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // Informations de session sur 3 colonnes
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  
  const infoCol1 = leftMargin;
  const infoCol2 = pageWidth / 3;
  const infoCol3 = (pageWidth / 3) * 2;
  
  pdf.text(`Date: ${new Date(report.sessionDate).toLocaleDateString('fr-FR')}`, infoCol1, yPosition);
  pdf.text(`Utilisateur: ${report.username}`, infoCol2, yPosition);
  pdf.text(`Opérations: ${report.statistics.totalContracts}`, infoCol3, yPosition);
  yPosition += 15;

  // Section Statistiques avec fond gris
  pdf.setFillColor(240, 240, 240);
  pdf.rect(leftMargin, yPosition, contentWidth, 8, 'F');
  
  pdf.setFont('helvetica', 'bold');
  pdf.text('RÉCAPITULATIF FINANCIER', leftMargin + 5, yPosition + 5);
  yPosition += 12;

  // Statistiques principales sur 4 colonnes
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  
  const statsCol1 = leftMargin;
  const statsCol2 = leftMargin + contentWidth * 0.25;
  const statsCol3 = leftMargin + contentWidth * 0.50;
  const statsCol4 = leftMargin + contentWidth * 0.75;
  
  // Ligne 1
  pdf.text(`Total Prime:`, statsCol1, yPosition);
  pdf.text(`${formatNumber(report.statistics.totalPrime)} DT`, statsCol1 + 25, yPosition);
  
  pdf.text(`Total Crédit:`, statsCol2, yPosition);
  pdf.text(`${formatNumber(report.statistics.totalCredit)} DT`, statsCol2 + 25, yPosition);
  
  pdf.text(`Prime Nette:`, statsCol3, yPosition);
  pdf.text(`${formatNumber(report.statistics.totalPrimeNette)} DT`, statsCol3 + 25, yPosition);
  
  pdf.text(`Total Session:`, statsCol4, yPosition);
  pdf.text(`${formatNumber(report.statistics.totalMontant)} DT`, statsCol4 + 25, yPosition);
  yPosition += 5;

  // Ligne 2 - Modes de paiement
  pdf.text(`Espèces:`, statsCol1, yPosition);
  pdf.text(`${formatNumber(report.statistics.totalEspeces)} DT`, statsCol1 + 25, yPosition);
  
  pdf.text(`Chèque:`, statsCol2, yPosition);
  pdf.text(`${formatNumber(report.statistics.totalCheque)} DT`, statsCol2 + 25, yPosition);
  
  pdf.text(`Carte Bancaire:`, statsCol3, yPosition);
  pdf.text(`${formatNumber(report.statistics.totalCarteBancaire)} DT`, statsCol3 + 25, yPosition);
  
  // Signe du total
  const totalSign = report.statistics.totalMontant >= 0 ? '(Positif)' : '(Négatif)';
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Résultat: ${totalSign}`, statsCol4, yPosition);
  pdf.setFont('helvetica', 'normal');
  yPosition += 8;

  // NOUVELLE SECTION : Nombre d'opérations par type
  pdf.setFillColor(220, 240, 220);
  pdf.rect(leftMargin, yPosition, contentWidth, 8, 'F');
  
  pdf.setFont('helvetica', 'bold');
  pdf.text('NOMBRE D\'OPÉRATIONS PAR TYPE', leftMargin + 5, yPosition + 5);
  yPosition += 12;

  // Afficher les types d'opération sur 2 colonnes
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  
  const types = Object.entries(report.statistics.byType);
  const midIndex = Math.ceil(types.length / 2);
  
  const typeCol1 = leftMargin + 5;
  const typeCol2 = leftMargin + contentWidth * 0.5;
  
  // Première colonne
  types.slice(0, midIndex).forEach(([type, count]) => {
    pdf.text(`• ${type}: ${count} opérations`, typeCol1, yPosition);
    yPosition += 4;
  });
  
  // Deuxième colonne - revenir à la même hauteur
  yPosition -= midIndex * 4;
  types.slice(midIndex).forEach(([type, count]) => {
    pdf.text(`• ${type}: ${count} opérations`, typeCol2, yPosition);
    yPosition += 4;
  });
  
  // Prendre la hauteur maximale
  yPosition += Math.max(midIndex, types.length - midIndex) * 4;
  yPosition += 8;

  // Caisse (espèces uniquement) - mise en évidence
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(0, 100, 0);
  pdf.text(`CAISSE (Espèces): ${formatNumber(report.statistics.totalEspeces)} DT`, leftMargin, yPosition);
  pdf.setTextColor(0, 0, 0);
  yPosition += 12;

  // Tableau des opérations
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('DÉTAIL DES OPÉRATIONS', leftMargin, yPosition);
  yPosition += 8;

  // Vérifier si on a besoin d'une nouvelle page avant le tableau
  if (yPosition > pageHeight - bottomMargin - 30) {
    pdf.addPage('landscape');
    yPosition = topMargin;
  }

  // En-têtes du tableau avec largeurs responsives - MÊME TAILLE POUR CONTRAT ET ASSURÉ
  const headers = ['Type', 'N° Contrat', 'Assuré', 'Échéance', 'Prime', 'Crédit', 'Prime Nette', 'Mode'];
  const colWidths = [
    contentWidth * 0.08,  // Type: 8%
    contentWidth * 0.17,  // N° Contrat: 17% (même taille que Assuré)
    contentWidth * 0.17,  // Assuré: 17% (même taille que N° Contrat)
    contentWidth * 0.10,  // Échéance: 10%
    contentWidth * 0.10,  // Prime: 10%
    contentWidth * 0.10,  // Crédit: 10%
    contentWidth * 0.13,  // Prime Nette: 13%
    contentWidth * 0.15   // Mode: 15%
  ];

  // Dessiner les en-têtes du tableau
  pdf.setFillColor(220, 220, 220);
  pdf.rect(leftMargin, yPosition, contentWidth, 6, 'F');
  
  let xPosition = leftMargin;
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  
  headers.forEach((header, index) => {
    // ALIGNEMENT À DROITE pour toutes les colonnes
    const textWidth = pdf.getTextWidth(header);
    const colRight = xPosition + colWidths[index] - 2;
    pdf.text(header, colRight - textWidth, yPosition + 4);
    xPosition += colWidths[index];
  });
  
  yPosition += 8;

  // Ligne de séparation
  pdf.setDrawColor(200, 200, 200);
  pdf.line(leftMargin, yPosition - 2, leftMargin + contentWidth, yPosition - 2);
  yPosition += 2;

  // Données du tableau
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);

  report.contracts.forEach((contract, index) => {
    // Vérifier si on a besoin d'une nouvelle page
    if (yPosition > pageHeight - bottomMargin - 8) {
      pdf.addPage('landscape');
      yPosition = topMargin;
      
      // Redessiner les en-têtes sur la nouvelle page
      pdf.setFillColor(220, 220, 220);
      pdf.rect(leftMargin, yPosition, contentWidth, 6, 'F');
      
      xPosition = leftMargin;
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      headers.forEach((header, idx) => {
        const textWidth = pdf.getTextWidth(header);
        const colRight = xPosition + colWidths[idx] - 2;
        pdf.text(header, colRight - textWidth, yPosition + 4);
        xPosition += colWidths[idx];
      });
      yPosition += 8;
      pdf.line(leftMargin, yPosition - 2, leftMargin + contentWidth, yPosition - 2);
      yPosition += 2;
    }

    // Alternance de couleurs pour les lignes
    if (index % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
    } else {
      pdf.setFillColor(245, 245, 245);
    }
    pdf.rect(leftMargin, yPosition - 2, contentWidth, 5, 'F');

    // Calculer la prime nette
    const prime = contract.prime || 0;
    const credit = contract.montant_credit || 0;
    const primeNette = prime - credit;

    xPosition = leftMargin;
    const rowData = [
      truncateText(contract.type || '-', 10),
      truncateText(contract.numero_contrat || '-', 15),
      truncateText(contract.assure || '-', 15),
      formatDate(contract.echeance),
      formatNumber(prime),
      credit > 0 ? formatNumber(credit) : '-',
      formatNumber(primeNette),
      contract.mode_paiement || '-'
    ];

    rowData.forEach((data, colIndex) => {
      // ALIGNEMENT À DROITE pour toutes les colonnes
      const colRight = xPosition + colWidths[colIndex] - 2;
      const textWidth = pdf.getTextWidth(data);
      pdf.text(data, colRight - textWidth, yPosition + 2);
      xPosition += colWidths[colIndex];
    });
    
    yPosition += 5;
  });

  // Totaux finaux
  yPosition += 10;
  
  // Ligne de séparation des totaux
  pdf.setDrawColor(0, 0, 0);
  pdf.line(leftMargin, yPosition, leftMargin + contentWidth, yPosition);
  yPosition += 8;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  
  // Totaux détaillés sur 2 lignes
  const totalLine1 = `PRIME TOTALE: ${formatNumber(report.statistics.totalPrime)} DT | CRÉDIT TOTAL: ${formatNumber(report.statistics.totalCredit)} DT | PRIME NETTE: ${formatNumber(report.statistics.totalPrimeNette)} DT`;
  pdf.text(totalLine1, leftMargin, yPosition);
  yPosition += 5;

  const totalLine2 = `TOTAL SESSION: ${formatNumber(report.statistics.totalMontant)} DT | CAISSE (Espèces): ${formatNumber(report.statistics.totalEspeces)} DT`;
  pdf.text(totalLine2, leftMargin, yPosition);
  
  yPosition += 10;

  // QR Code en bas à droite
  if (qrCodeDataUrl) {
    const qrSize = 20;
    const qrX = pageWidth - rightMargin - qrSize;
    const qrY = pageHeight - bottomMargin - qrSize;
    pdf.addImage(qrCodeDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    
    pdf.setFontSize(6);
    pdf.text('Session: ' + report.sessionDate, qrX, qrY + qrSize + 3);
  }

  // Date et heure d'impression
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Imprimé le: ${new Date().toLocaleString('fr-FR')}`, leftMargin, pageHeight - 8);

  // Pied de page
  pdf.setFontSize(8);
  pdf.text('Document généré automatiquement - Fiche de Caisse Détaillée', pageWidth / 2, pageHeight - 8, { align: 'center' });

  // Télécharger le PDF
  const fileName = `FC_Detail_${report.username}_${report.sessionDate}.pdf`;
  pdf.save(fileName);
};

export const printSessionReport = async (username: string): Promise<void> => {
  try {
    console.log('🖨️ Génération du rapport PDF détaillé pour:', username);
    const report = await generateSessionReport(username);
    await generateSessionPDF(report);
    console.log('✅ Rapport PDF détaillé généré avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de la génération du PDF:', error);
    throw error;
  }
};
