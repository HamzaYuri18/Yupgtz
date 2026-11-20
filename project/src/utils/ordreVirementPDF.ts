import jsPDF from 'jspdf';
import { numberToWords } from './numberToWords';

export interface LigneVirementPDF {
  beneficiaire: string;
  numeroCompteBeneficiaire: string;
  banqueBeneficiaire: string;
  montant: number;
  objet: string;
}

export interface OrdreVirementData {
  titulaireEmetteur: string;
  numeroCompteEmetteur: string;
  banqueEmetteur: string;
  dateVirement: string;
  lignes: LigneVirementPDF[];
}

const cellToString = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value);

const truncate = (value: unknown, max: number): string => {
  const str = cellToString(value);
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
};

export const generateOrdreVirementPDF = (data: OrdreVirementData) => {
  const doc = new jsPDF('landscape', 'mm', 'a4');

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 15;
  const marginRight = 15;
  const contentWidth = pageWidth - marginLeft - marginRight;

  let y = 18;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  const title = 'ORDRE DE VIREMENT BANCAIRE';
  doc.text(title, (pageWidth - doc.getTextWidth(title)) / 2, y);

  y += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const dateFormatted = new Date(data.dateVirement).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const dateLine = `Date : ${dateFormatted}`;
  doc.text(dateLine, (pageWidth - doc.getTextWidth(dateLine)) / 2, y);

  y += 8;
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 9;

  // ── Émetteur ──
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DONNEUR D\'ORDRE (EMETTEUR)', marginLeft, y);
  y += 7;

  doc.setFontSize(10);
  const emetteurLine = `Titulaire : ${data.titulaireEmetteur}    |    N° Compte : ${data.numeroCompteEmetteur}    |    Banque : ${data.banqueEmetteur}`;
  doc.setFont('helvetica', 'normal');
  doc.text(emetteurLine, marginLeft, y);
  y += 10;

  // ── Tableau des bénéficiaires ──
  const cols = [
    { label: 'Bénéficiaire', width: 55 },
    { label: 'N° Compte', width: 45 },
    { label: 'Banque', width: 40 },
    { label: 'Objet', width: 60 },
    { label: 'Montant (DT)', width: contentWidth - (55 + 45 + 40 + 60) },
  ];

  const drawRow = (values: string[], yPos: number, bold = false) => {
    let x = marginLeft;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    cols.forEach((col, i) => {
      doc.text(values[i], x + 2, yPos);
      x += col.width;
    });
  };

  doc.setFontSize(10);
  doc.setFillColor(230, 230, 230);
  doc.rect(marginLeft, y - 5, contentWidth, 8, 'F');
  drawRow(cols.map(c => c.label), y, true);
  y += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(marginLeft, y, marginLeft + contentWidth, y);
  y += 6;

  let total = 0;
  data.lignes.forEach(ligne => {
    total += ligne.montant;
    drawRow([
      truncate(ligne.beneficiaire, 32),
      truncate(ligne.numeroCompteBeneficiaire, 26),
      truncate(ligne.banqueBeneficiaire, 22),
      truncate(ligne.objet, 36),
      ligne.montant.toFixed(3),
    ], y);
    y += 7;
    if (y > pageHeight - 45) {
      doc.addPage();
      y = 20;
    }
  });

  y += 2;
  doc.line(marginLeft, y, marginLeft + contentWidth, y);
  y += 9;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Nombre de bénéficiaires : ${data.lignes.length}`, marginLeft, y);
  y += 7;
  doc.text(`Montant total : ${total.toFixed(3)} DT`, marginLeft, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  const montantLettres = numberToWords(total);
  const lettresLines = doc.splitTextToSize(`Soit en lettres : ${montantLettres}`, contentWidth);
  doc.text(lettresLines, marginLeft, y);
  y += lettresLines.length * 6 + 16;

  if (y > pageHeight - 30) {
    doc.addPage();
    y = 25;
  }

  doc.setLineWidth(0.3);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 18;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Signature et Cachet', pageWidth - marginRight - 60, y);
  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.text('SHIRI FARES HAMZA', pageWidth - marginRight - 60, y);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  const footer = `Document genere le ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')}`;
  doc.text(footer, (pageWidth - doc.getTextWidth(footer)) / 2, pageHeight - 10);

  const fileName = `Ordre_Virement_${data.dateVirement.replace(/-/g, '_')}.pdf`;
  doc.save(fileName);
};
