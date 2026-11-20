import jsPDF from 'jspdf';
import { numberToWords } from './numberToWords';

export interface OrdreVirementData {
  titulaireEmetteur: string;
  numeroCompteEmetteur: string;
  banqueEmetteur: string;
  beneficiaire: string;
  numeroCompteBeneficiaire: string;
  banqueBeneficiaire: string;
  montant: number;
  objet: string;
  dateVirement: string;
}

export const generateOrdreVirementPDF = (data: OrdreVirementData) => {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 20;
  const marginRight = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;

  let y = 28;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  const title = 'ORDRE DE VIREMENT BANCAIRE';
  doc.text(title, (pageWidth - doc.getTextWidth(title)) / 2, y);

  y += 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const dateFormatted = new Date(data.dateVirement).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const dateLine = `Date : ${dateFormatted}`;
  doc.text(dateLine, (pageWidth - doc.getTextWidth(dateLine)) / 2, y);

  y += 10;
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 14;

  const section = (titre: string) => {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(titre, marginLeft, y);
    y += 3;
    doc.setLineWidth(0.2);
    doc.line(marginLeft, y, marginLeft + 65, y);
    y += 9;
  };

  const row = (label: string, value: string) => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(label, marginLeft, y);
    doc.setFont('helvetica', 'bold');
    const lines = doc.splitTextToSize(value, contentWidth - 65);
    doc.text(lines, marginLeft + 65, y);
    y += Math.max(8, lines.length * 6);
  };

  section('DONNEUR D\'ORDRE (EMETTEUR)');
  row('Titulaire du compte :', data.titulaireEmetteur);
  row('Numero de compte :', data.numeroCompteEmetteur);
  row('Banque :', data.banqueEmetteur);

  y += 6;
  section('BENEFICIAIRE');
  row('Nom du beneficiaire :', data.beneficiaire);
  row('Numero de compte :', data.numeroCompteBeneficiaire);
  row('Banque :', data.banqueBeneficiaire);

  y += 6;
  section('DETAILS DU VIREMENT');
  row('Objet :', data.objet);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Montant :', marginLeft, y);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${data.montant.toFixed(3)} DT`, marginLeft + 65, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  const montantLettres = numberToWords(data.montant);
  const lettresLines = doc.splitTextToSize(`Soit en lettres : ${montantLettres}`, contentWidth);
  doc.text(lettresLines, marginLeft, y);
  y += lettresLines.length * 6 + 18;

  doc.setLineWidth(0.3);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 25;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Signature et Cachet', pageWidth - marginRight - 60, y);
  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('SHIRI FARES HAMZA', pageWidth - marginRight - 60, y);

  y += 25;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  const footer = `Document genere le ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')}`;
  doc.text(footer, (pageWidth - doc.getTextWidth(footer)) / 2, doc.internal.pageSize.getHeight() - 15);

  const fileName = `Ordre_Virement_${data.dateVirement.replace(/-/g, '_')}.pdf`;
  doc.save(fileName);
};
