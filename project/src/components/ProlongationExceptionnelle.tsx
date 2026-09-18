import React, { useState, useEffect } from 'react';
import { Search, AlertTriangle, CheckCircle, Download, FileText, Car, MapPin, Calendar, RotateCcw, Shield, ListChecks, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getSession } from '../utils/auth';
import ProlongationsList from './ProlongationsList';
import ProlongationValidationModal from './ProlongationValidationModal';
import MissingAttestationModal from './MissingAttestationModal';

// Noms des mois sans accents pour les noms de tables
const MOIS_TABLE: Record<number, string> = {
  0: 'janvier', 1: 'fevrier', 2: 'mars', 3: 'avril', 4: 'mai', 5: 'juin',
  6: 'juillet', 7: 'aout', 8: 'septembre', 9: 'octobre', 10: 'novembre', 11: 'decembre'
};

const USAGE_OPTIONS = ['210_Privé ou affaire Classique'];



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

// ── Utilitaires date ──────────────────────────────────────────────────────────

const formatDateFR = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR');
};

const addDays = (iso: string, n: number): string => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

const daysDiff = (isoA: string, isoB: string): number => {
  const a = new Date(isoA + 'T00:00:00').getTime();
  const b = new Date(isoB + 'T00:00:00').getTime();
  return Math.round((b - a) / 86400000);
};

// ── Génération PDF — reproduit fidèlement la mise en page du template ──────────
//
// Les coordonnées ci-dessous ont été relevées directement sur deux documents
// réels (mêmes positions à la décimale près sur les deux), en mesurant la
// position de base ("baseline") de chaque valeur en mm depuis le haut de page.
// Le document comporte 3 zones : un bloc haut, un bloc "duplicata" identique
// plus bas, et un volet récapitulatif en grand format tout en bas — chacun de
// ces emplacements doit être rempli.

const buildProlongationPDFBytes = async (form: ProlongForm): Promise<Uint8Array> => {
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

const downloadPDFBytes = (bytes: Uint8Array, numeroContrat: string): void => {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `prolongation_${numeroContrat.replace(/\//g, '-')}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};


// ── Sauvegarde Supabase ───────────────────────────────────────────────────────

const saveProlongation = async (f: ProlongForm): Promise<void> => {
  const now = new Date();
  const { error } = await supabase.from('prolongation').insert([{
    numero_contrat: f.numero_contrat,
    assure: f.assure,
    prime: f.prime,
    date_echeance: f.date_echeance,
    pour_le_compte: f.pour_le_compte,
    classe: f.classe,
    date_effet: f.date_effet,
    date_fin_prolongation: f.date_fin_prolongation,
    marque: f.marque,
    puissance: f.puissance,
    immatriculation: f.immatriculation.toUpperCase(),
    usage: f.usage,
    adresse: f.adresse,
    numero_attestation: f.numero_attestation,
    date_demande: now.toISOString().split('T')[0],
    heure_demande: now.toTimeString().slice(0, 5),
  }]);
  if (error) throw new Error(error.message);
};

// ── Composant principal ───────────────────────────────────────────────────────

type Step = 'search' | 'form' | 'done';

const ProlongationExceptionnelle: React.FC = () => {
  const [showList, setShowList]   = useState(false);
  const [step, setStep]           = useState<Step>('search');
  const [searchNum, setSearchNum] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [form, setForm]           = useState<ProlongForm | null>(null);
  const [sending, setSending]     = useState(false);
  const [finErr, setFinErr]       = useState<string | null>(null);
  const [pdfError, setPdfError]   = useState<string | null>(null);
  const [buildingPdf, setBuildingPdf] = useState(false);
  const [pendingValidation, setPendingValidation] = useState<{ bytes: Uint8Array; numeroContrat: string } | null>(null);

  // ── Attestation ──────────────────────────────────────────────────────────────
  const [attestationsDisponibles, setAttestationsDisponibles] = useState<Array<{
    id: number;
    numero_attestation: string;
    ancien_assure: string;
    ancien_numero_contrat: string;
    libere_le: string;
  }>>([]);
  const [useAttestationDisponible, setUseAttestationDisponible] = useState(false);
  const [attestationCheck, setAttestationCheck] = useState<{
    status: 'idle' | 'checking' | 'ok' | 'blocked' | 'error';
    message?: string;
  }>({ status: 'idle' });
  // Séquence d'attestations manquantes (numéros sautés dans le carnet) — même
  // mécanisme que dans Nouveau Contrat : l'utilisateur doit les régulariser
  // (motif + éventuel scan barré) avant de pouvoir continuer.
  const [showMissingAttestationModal, setShowMissingAttestationModal] = useState(false);
  const [missingAttestationNumbers, setMissingAttestationNumbers] = useState<string[]>([]);
  const [carnetTableName, setCarnetTableName] = useState('');
  const [pendingFormForSubmit, setPendingFormForSubmit] = useState<ProlongForm | null>(null);
  // Le statut de l'attestation (RPC update_attestation_prolongation) ne doit
  // changer qu'au moment du téléchargement effectif du PDF — c-à-d après la
  // saisie et la validation du code d'autorisation envoyé à Hamza pour les
  // utilisateurs non-Hamza. Ce garde-fou évite un double appel.
  const [attestationStatusUpdated, setAttestationStatusUpdated] = useState(false);

  useEffect(() => {
    const loadAttestationsDisponibles = async () => {
      const { data, error: err } = await supabase
        .from('attestations_disponibles')
        .select('id, numero_attestation, ancien_assure, ancien_numero_contrat, libere_le')
        .eq('reutilise', false)
        .order('libere_le', { ascending: false });
      if (!err && data) setAttestationsDisponibles(data);
    };
    loadAttestationsDisponibles();
  }, []);

  // Évalue si une attestation peut être utilisée pour une prolongation.
  // - statut NULL (ou "en_stock") : disponible.
  // - statut "servie" ou "prolongation" : déjà utilisée, bloqué.
  // - statut "annulee" : disponible UNIQUEMENT si elle figure bien dans
  //   attestations_disponibles et n'y a pas déjà été réutilisée — une
  //   attestation annulée mais jamais formellement libérée reste bloquée.
  const ATTESTATION_USED_MESSAGE = 'Cette attestation est utilisée. Veuillez réessayer avec un autre numéro.';

  const evaluateAttestation = async (numeroInt: number): Promise<{ ok: boolean; message?: string }> => {
    const { data, error: rpcErr } = await supabase.rpc('check_attestation_disponible', { attestation_numero: numeroInt });
    if (rpcErr) throw new Error(rpcErr.message);
    const row = data?.[0];
    if (!row || !row.existe) {
      return { ok: false, message: 'Numéro d\'attestation introuvable.' };
    }
    if (row.statut_actuel === 'servie' || row.statut_actuel === 'prolongation') {
      return { ok: false, message: ATTESTATION_USED_MESSAGE };
    }
    if (row.statut_actuel === 'annulee') {
      const { data: dispo } = await supabase
        .from('attestations_disponibles')
        .select('id, reutilise')
        .eq('numero_attestation', String(numeroInt))
        .maybeSingle();
      if (!dispo || dispo.reutilise) {
        return { ok: false, message: ATTESTATION_USED_MESSAGE };
      }
    }
    return { ok: true };
  };

  const checkAttestationStatus = async (numero: string) => {
    if (useAttestationDisponible) { setAttestationCheck({ status: 'ok' }); return; }
    if (!numero.trim()) { setAttestationCheck({ status: 'idle' }); return; }

    const numeroInt = parseInt(numero, 10);
    if (isNaN(numeroInt)) {
      setAttestationCheck({ status: 'error', message: 'Numéro invalide.' });
      return;
    }

    setAttestationCheck({ status: 'checking' });
    try {
      const result = await evaluateAttestation(numeroInt);
      setAttestationCheck(result.ok ? { status: 'ok' } : { status: 'blocked', message: result.message });
    } catch (err: any) {
      setAttestationCheck({ status: 'error', message: err.message || 'Erreur lors de la vérification.' });
    }
  };

  // Vérifie que l'attestation saisie respecte bien l'ordre de séquence du
  // carnet (même règle métier que dans Nouveau Contrat) : si des numéros du
  // carnet ont été sautés et sont toujours au statut NULL (jamais régularisés),
  // ils sont remontés comme "manquants".
  const checkAttestationSequence = async (
    attestationNum: number
  ): Promise<{ ok: boolean; missingNumbers?: string[]; carnetTable?: string; message?: string }> => {
    const { data: validationData, error: validationError } = await supabase
      .rpc('validate_attestation_sequence', { attestation_numero: attestationNum });
    if (validationError) throw new Error(validationError.message);
    if (!validationData || validationData.length === 0) return { ok: true };

    const validation = validationData[0];
    if (validation.is_valid) return { ok: true };

    const numeroAttendu = validation.numero_attendu;
    if (numeroAttendu && parseInt(numeroAttendu) < attestationNum) {
      if (!validation.carnet_table) {
        return { ok: false, message: 'Erreur : table du carnet non trouvée.' };
      }

      const potentialMissingNumbers: string[] = [];
      for (let i = parseInt(numeroAttendu); i < attestationNum; i++) {
        potentialMissingNumbers.push(i.toString());
      }

      const { data: carnetAttestations, error: carnetError } = await supabase
        .from(validation.carnet_table)
        .select('numero_attestation, statut')
        .in('numero_attestation', potentialMissingNumbers);
      if (carnetError) {
        return { ok: false, message: 'Erreur lors de la vérification des attestations manquantes.' };
      }

      const missingNumbers = potentialMissingNumbers.filter(num => {
        const att = carnetAttestations?.find(a => a.numero_attestation === num);
        return att?.statut === null;
      });

      if (missingNumbers.length === 0) return { ok: true };
      return { ok: false, missingNumbers, carnetTable: validation.carnet_table };
    }

    const messageDetail = numeroAttendu ? ` Le numéro attendu est : ${numeroAttendu}.` : '';
    return { ok: false, message: `${validation.message}${messageDetail}` };
  };

  // Vérification complète (statut + séquence), déclenchée par le bouton
  // "Vérifier" et, en filet de sécurité, au moment de l'enregistrement.
  const runAttestationChecks = async (): Promise<{ ok: boolean; missing?: boolean; message?: string }> => {
    if (!form) return { ok: false };
    if (useAttestationDisponible) { setAttestationCheck({ status: 'ok' }); return { ok: true }; }

    const numero = form.numero_attestation.trim();
    if (!numero) {
      setAttestationCheck({ status: 'idle' });
      return { ok: false, message: 'Le numéro d\'attestation est obligatoire.' };
    }

    const numeroInt = parseInt(numero, 10);
    if (isNaN(numeroInt)) {
      setAttestationCheck({ status: 'error', message: 'Numéro invalide.' });
      return { ok: false, message: 'Numéro d\'attestation invalide.' };
    }

    setAttestationCheck({ status: 'checking' });
    try {
      const basic = await evaluateAttestation(numeroInt);
      if (!basic.ok) {
        setAttestationCheck({ status: 'blocked', message: basic.message });
        return { ok: false, message: basic.message };
      }

      const seq = await checkAttestationSequence(numeroInt);
      if (seq.ok) {
        setAttestationCheck({ status: 'ok' });
        return { ok: true };
      }

      if (seq.missingNumbers && seq.carnetTable) {
        setMissingAttestationNumbers(seq.missingNumbers);
        setCarnetTableName(seq.carnetTable);
        const msg = 'Vous avez manqué des attestations. Veuillez les régulariser ci-dessous.';
        setAttestationCheck({ status: 'blocked', message: msg });
        setShowMissingAttestationModal(true);
        return { ok: false, missing: true, message: msg };
      }

      setAttestationCheck({ status: 'blocked', message: seq.message });
      return { ok: false, message: seq.message };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la vérification.';
      setAttestationCheck({ status: 'error', message: msg });
      return { ok: false, message: msg };
    }
  };

  const handleMissingAttestationComplete = async () => {
    setShowMissingAttestationModal(false);
    const check = await runAttestationChecks();
    if (pendingFormForSubmit) {
      const f = pendingFormForSubmit;
      setPendingFormForSubmit(null);
      if (check.ok) {
        await finishSubmit(f);
      }
    }
  };

  // Change le statut de l'attestation en "prolongation" (et marque une
  // éventuelle attestation disponible comme réutilisée). N'est appelé qu'au
  // moment du téléchargement réel du PDF — jamais avant, et jamais avant la
  // validation du code d'autorisation envoyé à Hamza pour les autres utilisateurs.
  const finalizeAttestationStatus = async (f: ProlongForm): Promise<void> => {
    const numeroAttestationInt = parseInt(f.numero_attestation, 10);
    if (isNaN(numeroAttestationInt)) return;

    const { error: markErr } = await supabase.rpc('update_attestation_prolongation', {
      attestation_numero: numeroAttestationInt,
      p_numero_contrat: f.numero_contrat,
      p_assure: f.assure,
    });
    if (markErr) console.error('Erreur marquage attestation (prolongation):', markErr);

    if (useAttestationDisponible) {
      const session = getSession();
      const { error: dispoErr } = await supabase.from('attestations_disponibles')
        .update({
          reutilise: true,
          reutilise_le: new Date().toISOString(),
          reutilise_par: session?.username || 'Inconnu',
          nouveau_numero_contrat: f.numero_contrat,
        })
        .eq('numero_attestation', f.numero_attestation);
      if (dispoErr) console.error('Erreur marquage attestation disponible (réutilisation):', dispoErr);
    }
  };

  // ── Step 1 : Recherche ──────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!searchNum.trim() || !searchDate) {
      setError('Veuillez renseigner le numéro de contrat et la date d\'échéance.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const d = new Date(searchDate + 'T00:00:00');
      const monthKey = MOIS_TABLE[d.getMonth()];
      const year     = d.getFullYear();
      const tableName = `table_terme_${monthKey}_${year}`;

      // 1. Recherche dans la table mensuelle
      const { data: termeData, error: termeErr } = await supabase
        .from(tableName)
        .select('numero_contrat, assure, prime, echeance')
        .ilike('numero_contrat', searchNum.trim())
        .maybeSingle();

      if (termeErr) {
        setError(`Table "${tableName}" introuvable ou erreur : ${termeErr.message}`);
        return;
      }
      if (!termeData) {
        setError(`Aucun contrat trouvé dans la table ${tableName} pour ce numéro.`);
        return;
      }

      // 2. Vérifier si une prolongation existe déjà
      const { data: existing } = await supabase
        .from('prolongation')
        .select('id')
        .ilike('numero_contrat', searchNum.trim())
        .maybeSingle();

      if (existing) {
        setError('⛔ Ce contrat fait déjà l\'objet d\'une prolongation exceptionnelle. Nouvelle demande impossible.');
        return;
      }

      // 3. Initialiser le formulaire
      setForm({
        numero_contrat: termeData.numero_contrat,
        assure: termeData.assure || '',
        prime: Number(termeData.prime) || 0,
        date_echeance: searchDate,
        pour_le_compte: '',
        classe: '',
        date_effet: searchDate,
        date_fin_prolongation: '',
        marque: '',
        puissance: '',
        immatriculation: '',
        usage: USAGE_OPTIONS[0],
        adresse: '',
        numero_attestation: '',
      });
      setUseAttestationDisponible(false);
      setAttestationCheck({ status: 'idle' });
      setShowMissingAttestationModal(false);
      setMissingAttestationNumbers([]);
      setCarnetTableName('');
      setPendingFormForSubmit(null);
      setAttestationStatusUpdated(false);
      setStep('form');
    } catch (err: any) {
      setError(`Erreur inattendue : ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Validation date fin ─────────────────────────────────────────────────────

  const validateFin = (val: string): string | null => {
    if (!val || !form) return null;
    const diff = daysDiff(form.date_echeance, val);
    if (diff <= 0) return 'La date de fin doit être après la date d\'échéance.';
    if (diff > 49) return `Maximum 49 jours après l'échéance (≤ ${addDays(form.date_echeance, 49)}).`;
    return null;
  };

  const handleFinChange = (val: string) => {
    setFinErr(validateFin(val));
    setForm(f => f ? { ...f, date_fin_prolongation: val } : f);
  };

  // ── Step 2 : Soumission ─────────────────────────────────────────────────────

  // Termine réellement l'enregistrement une fois toutes les vérifications
  // d'attestation passées (appelé directement, ou après régularisation des
  // attestations manquantes). Le statut de l'attestation n'est volontairement
  // PAS changé ici : voir finalizeAttestationStatus, appelé uniquement au
  // téléchargement du PDF validé.
  const finishSubmit = async (f: ProlongForm) => {
    setSending(true);
    setError(null);
    try {
      await saveProlongation(f);
      setStep('done');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Erreur lors de l'enregistrement : ${msg}`);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async () => {
    if (!form) return;

    // Validation finale
    const err = validateFin(form.date_fin_prolongation);
    if (err) { setFinErr(err); return; }
    if (!form.date_fin_prolongation) { setFinErr('La date de fin de prolongation est obligatoire.'); return; }
    if (!form.classe.trim())         { setError('La classe est obligatoire.'); return; }
    if (!form.marque.trim())         { setError('La marque est obligatoire.'); return; }
    if (!form.immatriculation.trim()) { setError('L\'immatriculation est obligatoire.'); return; }
    if (!form.numero_attestation.trim()) { setError('Le numéro d\'attestation est obligatoire.'); return; }

    setError(null);

    // Revérifier le statut ET la séquence au moment de l'enregistrement
    // (l'attestation réutilisée via "attestations disponibles" est déjà
    // garantie libre, donc ce contrôle est ignoré dans ce cas, comme dans
    // Nouveau Contrat).
    if (!useAttestationDisponible) {
      const check = await runAttestationChecks();
      if (!check.ok) {
        if (check.missing) {
          // Le modal de régularisation est déjà ouvert ; on mémorise le
          // formulaire pour reprendre l'enregistrement une fois complété.
          setPendingFormForSubmit(form);
        } else if (check.message) {
          setError(`⛔ ${check.message}`);
        }
        return;
      }
    }

    await finishSubmit(form);
  };

  const upd = (field: keyof ProlongForm, val: string) =>
    setForm(f => f ? { ...f, [field]: val } : f);

  // Hamza télécharge directement. Les autres utilisateurs (Ahlem, Rouae...)
  // doivent d'abord saisir le code de validation envoyé à Hamza par Telegram.
  const handleDownloadPDF = async (): Promise<void> => {
    if (!form) return;
    setPdfError(null);
    setBuildingPdf(true);
    try {
      const bytes = await buildProlongationPDFBytes(form);
      const username = getSession()?.username || '';

      if (username === 'Hamza') {
        // Hamza est lui-même l'autorité de validation : le changement de
        // statut de l'attestation se fait donc directement à son téléchargement.
        if (!attestationStatusUpdated) {
          await finalizeAttestationStatus(form);
          setAttestationStatusUpdated(true);
        }
        downloadPDFBytes(bytes, form.numero_contrat);
      } else {
        setPendingValidation({ bytes, numeroContrat: form.numero_contrat });
      }
    } catch (err) {
      console.error('Erreur lors du téléchargement du PDF:', err);
      setPdfError('Le document PDF n’a pas pu être téléchargé. Veuillez réessayer.');
    } finally {
      setBuildingPdf(false);
    }
  };

  const reset = () => {
    setStep('search');
    setSearchNum('');
    setSearchDate('');
    setForm(null);
    setError(null);
    setFinErr(null);
    setUseAttestationDisponible(false);
    setAttestationCheck({ status: 'idle' });
    setShowMissingAttestationModal(false);
    setMissingAttestationNumbers([]);
    setCarnetTableName('');
    setPendingFormForSubmit(null);
    setAttestationStatusUpdated(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-violet-900 rounded-2xl p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Shield className="w-7 h-7 text-violet-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Prolongation</h1>
              <p className="text-slate-400 text-sm mt-0.5">Demande de prolongation de couverture — max. 49 jours</p>
            </div>
          </div>
          <button
            onClick={() => setShowList(v => !v)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium px-4 py-2.5 rounded-xl transition-all text-sm shrink-0"
          >
            <ListChecks className="w-4 h-4" />
            {showList ? 'Nouvelle prolongation' : 'Liste des prolongations'}
          </button>
        </div>

        {/* Étapes */}
        {!showList && (
        <div className="mt-5 flex items-center gap-3">
          {(['search', 'form', 'done'] as Step[]).map((s, i) => {
            const labels = ['Recherche', 'Formulaire', 'Confirmation'];
            const active = step === s;
            const done   = (['search', 'form', 'done'] as Step[]).indexOf(step) > i;
            return (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  active ? 'bg-violet-500 text-white' :
                  done   ? 'bg-emerald-600/60 text-emerald-200' :
                           'bg-white/10 text-white/40'
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    active ? 'bg-white text-violet-600' :
                    done   ? 'bg-emerald-400 text-white' :
                             'bg-white/20 text-white/50'
                  }`}>{done ? '✓' : i + 1}</span>
                  {labels[i]}
                </div>
                {i < 2 && <div className="w-6 h-0.5 bg-white/20 rounded" />}
              </React.Fragment>
            );
          })}
        </div>
        )}
      </div>

      {showList && <ProlongationsList onBack={() => setShowList(false)} />}

      {/* ── ÉTAPE 1 : RECHERCHE ─────────────────────────────────────────────── */}
      {!showList && step === 'search' && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-5 flex items-center gap-2">
            <Search className="w-5 h-5 text-violet-600" />
            Identifier le contrat
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Numéro de contrat
              </label>
              <input
                type="text"
                value={searchNum}
                onChange={e => { setSearchNum(e.target.value); setError(null); }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="ex: CI0554N00478804"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-800 font-mono focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Date d'échéance
                <span className="ml-1 text-xs text-slate-500">(détermine la table terme à consulter)</span>
              </label>
              <input
                type="date"
                value={searchDate}
                onChange={e => { setSearchDate(e.target.value); setError(null); }}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
              {searchDate && (
                <p className="mt-1 text-xs text-slate-500">
                  → Table : <span className="font-mono font-semibold text-violet-700">
                    table_terme_{MOIS_TABLE[new Date(searchDate + 'T00:00:00').getMonth()]}_{new Date(searchDate + 'T00:00:00').getFullYear()}
                  </span>
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleSearch}
            disabled={loading}
            className="mt-6 flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold px-8 py-3 rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-lg"
          >
            {loading ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Recherche en cours…</>
            ) : (
              <><Search className="w-4 h-4" />Rechercher le contrat</>
            )}
          </button>
        </div>
      )}

      {/* ── ÉTAPE 2 : FORMULAIRE ────────────────────────────────────────────── */}
      {!showList && step === 'form' && form && (
        <div className="space-y-5">
          {/* Récapitulatif contrat */}
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-violet-700 uppercase tracking-wide mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Contrat identifié
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'N° Contrat',   value: form.numero_contrat, mono: true },
                { label: 'Assuré',       value: form.assure },
                { label: 'Prime',        value: `${form.prime} DT` },
                { label: 'Échéance',     value: formatDateFR(form.date_echeance) },
              ].map(({ label, value, mono }) => (
                <div key={label} className="bg-white rounded-xl p-3 border border-violet-100">
                  <p className="text-xs text-violet-600 font-medium mb-1">{label}</p>
                  <p className={`text-sm font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Formulaire complet */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-5 flex items-center gap-2">
              <Car className="w-5 h-5 text-violet-600" />
              Informations du véhicule
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field label="Marque *" value={form.marque} onChange={v => upd('marque', v)} placeholder="ex: Peugeot" />
              <Field label="Puissance" value={form.puissance} onChange={v => upd('puissance', v)} placeholder="ex: 5 CV" />
              <Field label="Immatriculation *" value={form.immatriculation} onChange={v => upd('immatriculation', v.toUpperCase())} placeholder="ex: 123 TU 4567" mono />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Usage</label>
                <select
                  value={form.usage}
                  onChange={e => upd('usage', e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none bg-white"
                >
                  {USAGE_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <Field label="Classe *" value={form.classe} onChange={v => upd('classe', v)} placeholder="ex: Classe A" />
              <Field label="Pour le compte de" value={form.pour_le_compte} onChange={v => upd('pour_le_compte', v)} placeholder="Nom de la compagnie" />
            </div>
          </div>

          {/* Attestation */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-5 flex items-center gap-2">
              <FileText className="w-5 h-5 text-violet-600" />
              Attestation
            </h2>

            {attestationsDisponibles.length > 0 && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAttestationDisponible}
                    onChange={e => {
                      setUseAttestationDisponible(e.target.checked);
                      upd('numero_attestation', '');
                      setAttestationCheck({ status: 'idle' });
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-emerald-700">
                    Réutiliser une attestation disponible ({attestationsDisponibles.length})
                  </span>
                </label>
              </div>
            )}

            {useAttestationDisponible ? (
              <select
                value={form.numero_attestation}
                onChange={e => { upd('numero_attestation', e.target.value); setAttestationCheck({ status: 'ok' }); }}
                className="w-full border border-emerald-300 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-emerald-50"
              >
                <option value="">Sélectionner une attestation disponible</option>
                {attestationsDisponibles.map(att => (
                  <option key={att.id} value={att.numero_attestation}>
                    {att.numero_attestation} - {att.ancien_assure} (ex: {att.ancien_numero_contrat})
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  type="number"
                  value={form.numero_attestation}
                  onChange={e => { upd('numero_attestation', e.target.value); setAttestationCheck({ status: 'idle' }); }}
                  onBlur={e => checkAttestationStatus(e.target.value)}
                  placeholder="Ex: 12345"
                  className={`flex-1 min-w-0 border rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:border-transparent outline-none font-mono ${
                    attestationCheck.status === 'blocked' || attestationCheck.status === 'error'
                      ? 'border-red-400 bg-red-50 focus:ring-red-500'
                      : attestationCheck.status === 'ok'
                        ? 'border-emerald-400 bg-emerald-50 focus:ring-emerald-500'
                        : 'border-slate-300 focus:ring-violet-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => runAttestationChecks()}
                  disabled={!form.numero_attestation.trim() || attestationCheck.status === 'checking'}
                  className="shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl border border-violet-300 text-violet-700 font-medium hover:bg-violet-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Vérifier
                </button>
              </div>
            )}

            {attestationCheck.status === 'checking' && (
              <p className="mt-1.5 text-xs text-slate-500">Vérification en cours…</p>
            )}
            {(attestationCheck.status === 'blocked' || attestationCheck.status === 'error') && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />{attestationCheck.message}
              </p>
            )}
            {attestationCheck.status === 'ok' && (
              <p className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />Attestation disponible
              </p>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-5 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-violet-600" />
              Dates de prolongation
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Date effet */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Date d'effet</label>
                <input
                  type="date"
                  value={form.date_effet}
                  onChange={e => upd('date_effet', e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Date fin prolongation */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Date fin de prolongation *
                  <span className="ml-1 text-xs text-slate-500">
                    (max: {formatDateFR(addDays(form.date_echeance, 49))} — 49 j après l'échéance)
                  </span>
                </label>
                <input
                  type="date"
                  value={form.date_fin_prolongation}
                  min={addDays(form.date_echeance, 1)}
                  max={addDays(form.date_echeance, 49)}
                  onChange={e => handleFinChange(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none ${
                    finErr ? 'border-red-400 bg-red-50' : 'border-slate-300'
                  }`}
                />
                {finErr && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />{finErr}
                  </p>
                )}
                {form.date_fin_prolongation && !finErr && (
                  <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {daysDiff(form.date_echeance, form.date_fin_prolongation)} jour(s) de prolongation
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-5 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-violet-600" />
              Assuré
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Assuré</label>
                <input
                  type="text"
                  value={form.assure}
                  readOnly
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 text-slate-600"
                />
              </div>
              <Field
                label="Adresse"
                value={form.adresse}
                onChange={v => upd('adresse', v)}
                placeholder="Adresse de l'assuré"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 transition-all font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Nouvelle recherche
            </button>
            <button
              onClick={handleSubmit}
              disabled={sending || !!finErr || !form.date_fin_prolongation || attestationCheck.status === 'blocked' || attestationCheck.status === 'checking'}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold px-8 py-3 rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-lg"
            >
              {sending ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Enregistrement…</>
              ) : (
                <><CheckCircle className="w-4 h-4" />Enregistrer la prolongation</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── ÉTAPE 3 : CONFIRMATION ──────────────────────────────────────────── */}
      {!showList && step === 'done' && form && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Demande enregistrée</h2>
            <p className="text-slate-500 mt-1">La prolongation a été sauvegardée dans Supabase.</p>
          </div>

          {/* Récap */}
          <div className="bg-slate-50 rounded-xl p-5 text-left max-w-lg mx-auto space-y-2">
            {[
              ['Contrat',              form.numero_contrat],
              ['Assuré',               form.assure],
              ['Classe',               form.classe],
              ['Marque / Immat.',      `${form.marque} — ${form.immatriculation}`],
              ['Date fin prolongation', formatDateFR(form.date_fin_prolongation)],
              ['Durée prolongation',   `${daysDiff(form.date_echeance, form.date_fin_prolongation)} jour(s)`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-slate-500">{k}</span>
                <span className="font-semibold text-slate-800">{v}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={handleDownloadPDF}
              disabled={buildingPdf}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold px-8 py-3 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-60 shadow-lg"
            >
              <Download className="w-4 h-4" />
              {buildingPdf ? 'Préparation…' : 'Télécharger le document PDF'}
            </button>
            {pdfError && <p className="text-sm text-red-600" role="alert">{pdfError}</p>}
            <button
              onClick={reset}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 transition-all font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Nouvelle prolongation
            </button>
          </div>
        </div>
      )}

      {pendingValidation && form && (
        <ProlongationValidationModal
          form={form}
          pdfBytes={pendingValidation.bytes}
          onClose={() => setPendingValidation(null)}
          onValidated={async () => {
            // Le code d'autorisation envoyé à Hamza vient d'être validé :
            // c'est seulement maintenant que l'attestation change de statut.
            if (!attestationStatusUpdated) {
              await finalizeAttestationStatus(form);
              setAttestationStatusUpdated(true);
            }
            downloadPDFBytes(pendingValidation.bytes, pendingValidation.numeroContrat);
            setPendingValidation(null);
          }}
        />
      )}

      <MissingAttestationModal
        isOpen={showMissingAttestationModal}
        onClose={() => { setShowMissingAttestationModal(false); setPendingFormForSubmit(null); }}
        missingNumbers={missingAttestationNumbers}
        currentUser={getSession()?.username || ''}
        carnetTable={carnetTableName}
        onComplete={handleMissingAttestationComplete}
      />
    </div>
  );
};

// ── Champ texte réutilisable ──────────────────────────────────────────────────

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}> = ({ label, value, onChange, placeholder, mono }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none ${mono ? 'font-mono' : ''}`}
    />
  </div>
);

export default ProlongationExceptionnelle;
