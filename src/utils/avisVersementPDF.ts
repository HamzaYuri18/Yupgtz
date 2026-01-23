import jsPDF from 'jspdf';
import { numberToWords } from './numberToWords';

interface AvisVersementData {
  banque: string;
  compteBancaire: string;
  dateSession: string;
  montantTotal: number;
}

export const generateAvisVersementPDF = (data: AvisVersementData) => {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 20;
  const marginRight = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;

  let yPosition = 30;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  const title = 'AVIS DE VERSEMENT BANCAIRE';
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (pageWidth - titleWidth) / 2, yPosition);

  yPosition += 20;
  doc.setLineWidth(0.5);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);

  yPosition += 20;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');

  doc.text('Banque :', marginLeft, yPosition);
  doc.setFont('helvetica', 'bold');
  doc.text(data.banque, marginLeft + 40, yPosition);

  yPosition += 15;
  doc.setFont('helvetica', 'normal');
  doc.text('Compte Bancaire :', marginLeft, yPosition);
  doc.setFont('helvetica', 'bold');
  doc.text(data.compteBancaire, marginLeft + 60, yPosition);

  yPosition += 15;
  doc.setFont('helvetica', 'normal');
  doc.text('Date de Session :', marginLeft, yPosition);
  doc.setFont('helvetica', 'bold');
  const formattedDate = new Date(data.dateSession).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  doc.text(formattedDate, marginLeft + 60, yPosition);

  yPosition += 25;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Montant Total :', marginLeft, yPosition);

  yPosition += 10;
  doc.setFontSize(16);
  const montantText = `${data.montantTotal.toFixed(3)} DT`;
  doc.text(montantText, marginLeft + 10, yPosition);

  yPosition += 15;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'italic');
  const montantEnLettres = numberToWords(data.montantTotal);
  const lines = doc.splitTextToSize(`Arrêté le présent avis à la somme de : ${montantEnLettres}`, contentWidth);
  doc.text(lines, marginLeft, yPosition);

  yPosition += lines.length * 7 + 20;

  doc.setLineWidth(0.3);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);

  yPosition += 30;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Signature et Cachet', pageWidth - marginRight - 60, yPosition);

  yPosition += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('SHIRI FARES HAMZA', pageWidth - marginRight - 60, yPosition);

  yPosition += 30;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  const footer = `Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`;
  const footerWidth = doc.getTextWidth(footer);
  doc.text(footer, (pageWidth - footerWidth) / 2, doc.internal.pageSize.getHeight() - 20);

  const fileName = `Avis_Versement_${data.dateSession.replace(/-/g, '_')}.pdf`;
  doc.save(fileName);
};
