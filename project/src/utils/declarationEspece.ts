import JSZip from 'jszip';

const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

const under100 = (n: number): string => {
  if (n < 20) return UNITS[n];
  if (n < 70) {
    const t = TENS[Math.floor(n / 10)];
    const u = n % 10;
    if (u === 0) return t;
    if (u === 1) return `${t} et un`;
    return `${t}-${UNITS[u]}`;
  }
  if (n < 80) {
    const u = n - 60;
    return u === 11 ? 'soixante et onze' : `soixante-${UNITS[u]}`;
  }
  if (n === 80) return 'quatre-vingts';
  const u = n - 80;
  return `quatre-vingt-${u === 1 ? 'un' : UNITS[u]}`;
};

const under1000 = (n: number): string => {
  if (n < 100) return under100(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  const hundreds = h === 1 ? 'cent' : `${UNITS[h]} cent${r === 0 ? 's' : ''}`;
  return r === 0 ? hundreds : `${hundreds} ${under100(r)}`;
};

const entierEnLettres = (n: number): string => {
  if (n === 0) return 'zéro';
  const millions = Math.floor(n / 1000000);
  const milliers = Math.floor((n % 1000000) / 1000);
  const reste = n % 1000;
  const parts: string[] = [];
  if (millions) parts.push(millions === 1 ? 'un million' : `${under1000(millions)} millions`);
  if (milliers) parts.push(milliers === 1 ? 'mille' : `${under1000(milliers)} mille`);
  if (reste) parts.push(under1000(reste));
  return parts.join(' ');
};

// Montant en dinars tunisiens (3 décimales = millimes), ex: "Mille deux cent trente-quatre dinars et cinq cents millimes"
export const montantEnLettres = (montant: number): string => {
  const abs = Math.abs(montant);
  const dinars = Math.floor(abs);
  const millimes = Math.round((abs - dinars) * 1000);
  const dinarsTxt = `${entierEnLettres(dinars)} ${dinars === 1 ? 'dinar' : 'dinars'}`;
  const texte = millimes > 0
    ? `${dinars > 0 ? `${dinarsTxt} et ` : ''}${entierEnLettres(millimes)} millimes`
    : dinarsTxt;
  return texte.charAt(0).toUpperCase() + texte.slice(1);
};

const formatMontantChiffres = (montant: number): string =>
  `${Math.abs(montant).toFixed(3).replace('.', ',')} DT`;

const formatDateFR = (d: Date): string => d.toLocaleDateString('fr-FR');

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface DeclarationEspeceData {
  nomAssure: string;
  montant: number;
  cin: string;
  numeroSinistre: string;
  date?: Date;
}

// Remplit le modèle "Attestation espece.docx" : X1 nom, X2 montant (chiffres),
// X3 montant (lettres), X4 date, X5 CIN, X6 numéro de sinistre.
export const generateDeclarationEspeceDocx = async (data: DeclarationEspeceData): Promise<Blob> => {
  const response = await fetch('/forms/attestation_espece.docx');
  if (!response.ok) throw new Error('Le modèle de déclaration est introuvable.');
  const zip = await JSZip.loadAsync(await response.arrayBuffer());

  const documentFile = zip.file('word/document.xml');
  if (!documentFile) throw new Error('Modèle Word invalide.');
  const xml = await documentFile.async('string');

  const replacements: Record<string, string> = {
    x1: data.nomAssure,
    x2: formatMontantChiffres(data.montant),
    x3: montantEnLettres(data.montant),
    x5: data.cin,
    x6: data.numeroSinistre,
    X4: formatDateFR(data.date ?? new Date()),
  };

  const filled = xml.replace(/(<w:t[^>]*>)([^<]*)(<\/w:t>)/g, (_match, open: string, text: string, close: string) => {
    let out = text;
    for (const [placeholder, value] of Object.entries(replacements)) {
      out = out.split(placeholder).join(escapeXml(value));
    }
    return open + out + close;
  });

  zip.file('word/document.xml', filled);
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
};

export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export const sendTelegramToHamza = async (message: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const response = await fetch(`${supabaseUrl}/functions/v1/send-telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ message }),
    });
    const result = await response.json();
    return result.success ? { success: true } : { success: false, error: result.error || 'Échec Telegram' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erreur réseau' };
  }
};
