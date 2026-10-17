import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface ProlongForm {
  numero_contrat: string;
  assure: string;
  prime: number;
  date_echeance: string;    // YYYY-MM-DD (référence 49 jours)
  pour_le_compte: string;
  classe: string;
  date_effet: string;
  date_fin_prolongation: string;
  marque: string;
  puissance: string;
  immatriculation: string;
  usage: string;
  adresse: string;
  numero_attestation: string;
}

const formatDateFR = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR');
};

// ── Génération PDF — reproduit fidèlement la mise en page du template ──────────
//
// Les coordonnées ci-dessous ont été relevées directement sur deux documents
// réels (mêmes positions à la décimale près sur les deux), en mesurant la
// position de base ("baseline") de chaque valeur en mm depuis le haut de page.
// Le document comporte 3 zones : un bloc haut, un bloc "duplicata" identique
// plus bas, et un volet récapitulatif en grand format tout en bas — chacun de
// ces emplacements doit être rempli.

export const buildProlongationPDFBytes = async (form: ProlongForm): Promise<Uint8Array> => {
  // L'immatriculation doit toujours s'afficher en majuscules (ex: "TU", pas "tu"),
  // y compris pour d'anciennes prolongations enregistrées avant cette normalisation.
  const f: ProlongForm = { ...form, immatriculation: form.immatriculation.toUpperCase() };

  const response = await fetch('/forms/Mliki_Amel.pdf');
  if (!response.ok) throw new Error('Le modèle PDF est introuvable.');

  const pdf = await PDFDocument.load(await response.arrayBuffer());
  const page = pdf.getPages()[0];
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const white = rgb(1, 1, 1);
  const black = rgb(0, 0, 0);
  const scale = 72 / 25.4; // points par mm
  const pageHeight = page.getHeight();
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR');
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // xMM / topMM : position de la ligne de base du texte, en mm depuis le
  // bord gauche / le haut de la page.
  const baselineY = (topMM: number): number => pageHeight - topMM * scale;

  const value = (text: string, xMM: number, topMM: number, size = 8): void => {
    if (!text) return;
    page.drawText(text, { x: xMM * scale, y: baselineY(topMM), size, font, color: black });
  };

  // Efface la zone occupée par l'ancienne valeur (au-dessus et en-dessous de
  // la ligne de base, pour couvrir hampes et jambages) avant d'écrire la
  // nouvelle. `padMM` ajoute une marge de sécurité tout autour, utile pour
  // les champs où l'ancien texte pourrait déborder légèrement de la zone
  // mesurée (ex : immatriculation, dont la largeur varie d'un contrat à l'autre).
  const clearValue = (xMM: number, topMM: number, widthMM: number, size = 8, padMM = 0): void => {
    const ascentMM = (size * 0.85 * 25.4) / 72 + padMM;
    const descentMM = (size * 0.35 * 25.4) / 72 + padMM;
    const boxTopMM = topMM - ascentMM;
    const boxHeightMM = ascentMM + descentMM;
    page.drawRectangle({
      x: (xMM - padMM) * scale,
      y: pageHeight - (boxTopMM + boxHeightMM) * scale,
      width: (widthMM + padMM * 2) * scale,
      height: boxHeightMM * scale,
      color: white,
    });
  };

  // ── Bloc 1 (haut de page) ────────────────────────────────────────────────
  clearValue(57.5, 36.9, 60);    value(f.numero_contrat, 57.5, 36.9);
  clearValue(65.5, 41.6, 15);    value(f.classe, 65.5, 41.6);
  clearValue(59.5, 46.4, 25);    value(formatDateFR(f.date_effet), 59.5, 46.4);
  clearValue(59.5, 50.1, 25);    value(formatDateFR(f.date_fin_prolongation), 59.5, 50.1);
  clearValue(146.5, 32.0, 40);   value(f.marque, 146.5, 32.0);
  clearValue(154.5, 45.4, 15);   value(f.puissance, 154.5, 45.4);
  clearValue(147.5, 54.4, 35, 8, 1.5); value(f.immatriculation, 147.5, 54.4);
  clearValue(140, 60.6, 55);     value(f.usage, 140, 60.6);
  clearValue(29.5, 64.7, 75);    value(f.assure, 29.5, 64.7);
  clearValue(29.5, 68.1, 100);   value(`Pour le compte de :${f.pour_le_compte}`, 29.5, 68.1);
  clearValue(145.5, 71.6, 20);   value(dateStr, 145.5, 71.6);
  clearValue(149, 75.3, 15);     value(timeStr, 149, 75.3);

  // ── Bloc 2 (duplicata, mêmes informations plus bas) ─────────────────────
  clearValue(104, 114.2, 60);    value(f.numero_contrat, 104, 114.2);
  clearValue(98.5, 121.4, 30);   value(formatDateFR(f.date_effet), 98.5, 121.4);
  clearValue(98.5, 125.7, 30);   value(formatDateFR(f.date_fin_prolongation), 98.5, 125.7);
  clearValue(144.5, 138.1, 40);  value(f.marque, 144.5, 138.1);
  clearValue(30.5, 149.8, 75);   value(f.assure, 30.5, 149.8);
  clearValue(153.5, 154.6, 15);  value(f.puissance, 153.5, 154.6);
  clearValue(30.5, 158.2, 100);  value(`Pour le compte de :${f.pour_le_compte}`, 30.5, 158.2);
  clearValue(141.5, 166.7, 35, 8, 1.5); value(f.immatriculation, 141.5, 166.7);
  clearValue(136.5, 173.7, 55);  value(f.usage, 136.5, 173.7);

  const addressLines = f.adresse.trim().split(/\s+/).reduce<string[]>((lines, word) => {
    const current = lines[lines.length - 1] || '';
    if ((current + ' ' + word).trim().length > 28) lines.push(word);
    else if (lines.length === 0) lines.push(word);
    else lines[lines.length - 1] = `${current} ${word}`.trim();
    return lines;
  }, []);
  // On efface systématiquement les 4 emplacements de ligne, même ceux sans
  // nouvelle valeur : le modèle contient jusqu'à 4 lignes d'adresse et une
  // adresse plus courte que l'original doit quand même couvrir les lignes
  // en trop (ex: l'ancienne adresse du contrat "Mliki Amel" utilisée comme
  // modèle de base).
  for (let index = 0; index < 4; index++) {
    const top = 172.1 + index * 3.44;
    clearValue(30, top, 100);
    if (addressLines[index]) value(addressLines[index], 30, top);
  }

  clearValue(47, 189.7, 25);     value(dateStr, 47, 189.7);
  clearValue(50.5, 193.7, 15);   value(timeStr, 50.5, 193.7);

  // ── Bloc 3 (volet récapitulatif en grand format, bas de page) ──────────
  clearValue(95, 254.5, 45, 11.5, 2); value(formatDateFR(f.date_fin_prolongation), 95, 254.5, 11.5);
  clearValue(94, 267.1, 45, 12.5, 3); value(f.immatriculation, 94, 267.1, 12.5);

  return pdf.save();
};

export const downloadPDFBytes = (bytes: Uint8Array, numeroContrat: string): void => {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `prolongation_${numeroContrat.replace(/\//g, '-')}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};
