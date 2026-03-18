import React, { useState } from 'react';
import { Save, FileText, DollarSign, Calendar, Search, CreditCard, User, Hash, Building, RotateCcw } from 'lucide-react';
import { Contract } from '../types';
import { saveContract, generateContractId, getXMLContracts } from '../utils/storage';
import { findContractInXLSX } from '../utils/xlsxParser';
import { searchContractInTable, getAvailableMonths, saveAffaireContract, saveCreditContract, saveContractToRapport, checkTermeContractExists, saveTermeContract,checkAffaireContractExists,checkAffaireInRapport,checkTermeInRapport, saveCheque, checkEncaissementAutreCodeExists, saveEncaissementAutreCode, checkAvenantChangementVehiculeExists, saveAvenantChangementVehicule, saveTermeSuspenduPaye, updateAttestationServie} from '../utils/supabaseService';
import { supabase } from '../lib/supabase';
import { getSessionDate } from '../utils/auth';
import TermeSuspenduModal from './TermeSuspenduModal';
import MissingAttestationModal from './MissingAttestationModal';

interface ContractFormProps {
  username: string;
}

// Fonction de nettoyage des espaces pour le numéro de contrat uniquement
const trimSpaces = (value: string): string => {
  return value.trim().replace(/\s+/g, ' ');
};

// Fonction pour déterminer automatiquement la branche selon le numéro de contrat pour Affaire
const determineBrancheForAffaire = (contractNumber: string): 'Auto' | 'Vie' | 'Santé' | 'IRDS' => {
  const cleanedNumber = trimSpaces(contractNumber).toUpperCase();

  if (cleanedNumber.startsWith('606')) {
    return 'Santé';
  }

  if (cleanedNumber.startsWith('CI05') || cleanedNumber.startsWith('5')) {
    return 'Auto';
  }

  if (cleanedNumber.startsWith('672')) {
    return 'Vie';
  }

  return 'IRDS';
};

const ContractForm: React.FC<ContractFormProps> = ({ username }) => {
  const [formData, setFormData] = useState({
    type: 'Affaire' as 'Terme' | 'Affaire' | 'Avenant changement de véhicule' | 'Encaissement pour autre code',
    branch: 'Auto' as 'Auto' | 'Vie' | 'Santé' | 'IRDS',
    contractNumber: '',
    premiumAmount: '',
    insuredName: '',
    paymentMode: 'Espece' as 'Espece' | 'Cheque' | 'Carte Bancaire',
    paymentType: 'Au comptant' as 'Au comptant' | 'Crédit',
    creditAmount: '',
    paymentDate: '',
    numeroCheque: '',
    banque: '',
    dateEncaissementPrevue: '',
    dateEcheance: '',
    telephone: '',
    numeroAttestation: ''
  });

  const [xmlSearchResult, setXmlSearchResult] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isRetourTechniqueMode, setIsRetourTechniqueMode] = useState(false);
  const [isRetourContentieuxMode, setIsRetourContentieuxMode] = useState(false);
  const [originalPremiumAmount, setOriginalPremiumAmount] = useState('');
  const [showAutreCodeMessage, setShowAutreCodeMessage] = useState(false);
  const [showTermeSuspenduModal, setShowTermeSuspenduModal] = useState(false);
  const [termeSuspenduData, setTermeSuspenduData] = useState<{
    contractNumber: string;
    insuredName: string;
    dateEcheance: string;
    joursDepasses: number;
    primeTotale: number;
  } | null>(null);
  const [showMissingAttestationModal, setShowMissingAttestationModal] = useState(false);
  const [missingAttestationNumbers, setMissingAttestationNumbers] = useState<string[]>([]);
  const [carnetTableName, setCarnetTableName] = useState<string>('');
  const [pendingSubmitData, setPendingSubmitData] = useState<any>(null);

  React.useEffect(() => {
    loadAvailableMonths();
  }, []);

  const loadAvailableMonths = async () => {
    const months = await getAvailableMonths();
    setAvailableMonths(months);

    const years = Array.from(new Set(
      months.map(month => {
        const parts = month.split(' ');
        return parts[1];
      }).filter(year => year)
    )).sort((a, b) => parseInt(b) - parseInt(a));

    setAvailableYears(years);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Nettoyer les espaces uniquement pour le numéro de contrat
    let cleanedValue = value;
    if (name === 'contractNumber') {
      cleanedValue = trimSpaces(value);
    }

    let updatedData = {
      ...formData,
      [name]: cleanedValue
    };

    // Déterminer automatiquement la branche pour les contrats Affaire UNIQUEMENT si la valeur change réellement
    if (name === 'contractNumber' && formData.type === 'Affaire' && cleanedValue && cleanedValue !== formData.contractNumber) {
      const autoBranche = determineBrancheForAffaire(cleanedValue);
      updatedData.branch = autoBranche;
    }

    // LOGIQUE AMÉLIORÉE POUR CRÉDIT
    if (name === 'paymentType' && value === 'Crédit') {
      // Lorsqu'on passe en mode Crédit, initialiser le montant crédit
      if (formData.premiumAmount && !updatedData.creditAmount) {
        updatedData.creditAmount = formData.premiumAmount;
      }
    } else if (name === 'premiumAmount' && formData.paymentType === 'Crédit') {
      // Si la prime change en mode Crédit, ajuster le crédit si nécessaire
      const newPremium = parseFloat(cleanedValue) || 0;
      const currentCredit = parseFloat(updatedData.creditAmount) || 0;
      
      if (currentCredit > newPremium) {
        updatedData.creditAmount = cleanedValue; // Ajuster le crédit à la nouvelle prime
      }
    } else if (name === 'creditAmount' && formData.paymentType === 'Crédit') {
      // Valider que le crédit ne dépasse pas la prime
      const creditValue = parseFloat(cleanedValue) || 0;
      const premiumValue = parseFloat(formData.premiumAmount) || 0;
      
      if (creditValue > premiumValue) {
        setMessage('⚠️ Le montant du crédit ne peut pas dépasser la prime totale');
        setTimeout(() => setMessage(''), 3000);
      }
    }

    setFormData(updatedData);
  };

  const searchInXML = async () => {
    // Réinitialiser les résultats précédents
    setXmlSearchResult(null);
    setMessage('');

    // Nettoyer le numéro de contrat avant la recherche
    const cleanedContractNumber = trimSpaces(formData.contractNumber);

    if (!cleanedContractNumber) {
      setMessage('⚠️ Veuillez saisir un numéro de contrat');
      return;
    }

    if (formData.type === 'Terme' && cleanedContractNumber && selectedMonth) {
      // Mettre à jour le formulaire avec la valeur nettoyée
      setFormData(prev => ({
        ...prev,
        contractNumber: cleanedContractNumber,
        premiumAmount: '',
        insuredName: ''
      }));

      setIsLoading(true);

      // Rechercher d'abord dans Supabase
      const supabaseResult = await searchContractInTable(selectedMonth, cleanedContractNumber);

      if (supabaseResult) {
        // Normaliser le résultat Supabase pour correspondre à l'interface XMLContract
        const normalizedResult = {
          ...supabaseResult,
          premium: supabaseResult.prime,
          insured: supabaseResult.assure,
          maturity: supabaseResult.echeance,
          numTel: supabaseResult.num_tel,
          numTel2: supabaseResult.num_tel_2
        };

        setXmlSearchResult(normalizedResult);
        setFormData(prev => ({
          ...prev,
          premiumAmount: supabaseResult.prime.toString(),
          insuredName: supabaseResult.assure
        }));
        setMessage(`✅ Contrat trouvé dans la table Supabase "${selectedMonth}"`);
        setIsLoading(false);
        return;
      }

      // Si pas trouvé dans Supabase, chercher localement
      const xmlContracts = getXMLContracts();
      const result = findContractInXLSX(xmlContracts, cleanedContractNumber);

      if (result) {
        setXmlSearchResult(result);
        setFormData(prev => ({
          ...prev,
          premiumAmount: result.premium.toString(),
          insuredName: result.insured
        }));
        setMessage('✅ Contrat trouvé dans les données XLSX locales');
      } else {
        setXmlSearchResult(null);
        setFormData(prev => ({
          ...prev,
          premiumAmount: '',
          insuredName: ''
        }));
        setMessage('❌ Contrat non trouvé. Veuillez vérifier le numéro et réessayer.');
      }
      setIsLoading(false);
    } else if (formData.type === 'Terme' && !selectedMonth) {
      setMessage('⚠️ Veuillez sélectionner un mois pour la recherche');
    }
  };

  const handleRetourTechniqueClick = () => {
    if (!isRetourTechniqueMode) {
      setOriginalPremiumAmount(formData.premiumAmount);
    }
    setIsRetourTechniqueMode(!isRetourTechniqueMode);
    if (isRetourContentieuxMode) {
      setIsRetourContentieuxMode(false);
    }
  };

  const handleRetourContentieuxClick = () => {
    if (!isRetourContentieuxMode) {
      setOriginalPremiumAmount(formData.premiumAmount);
    }
    setIsRetourContentieuxMode(!isRetourContentieuxMode);
    if (isRetourTechniqueMode) {
      setIsRetourTechniqueMode(false);
    }
  };

  const resetForm = () => {
    const form = document.querySelector('form') as HTMLFormElement;
    if (form) {
      form.reset();
    }

    setFormData({
      type: 'Affaire',
      branch: 'Auto',
      contractNumber: '',
      premiumAmount: '',
      insuredName: '',
      paymentMode: 'Espece',
      paymentType: 'Au comptant',
      creditAmount: '',
      paymentDate: '',
      numeroCheque: '',
      banque: '',
      dateEncaissementPrevue: '',
      dateEcheance: '',
      telephone: '',
      numeroAttestation: ''
    });
    setXmlSearchResult(null);
    setSelectedMonth('');
    setSelectedYear('');
    setIsRetourTechniqueMode(false);
    setIsRetourContentieuxMode(false);
    setOriginalPremiumAmount('');
    setShowAutreCodeMessage(false);
    setMessage('');

    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
      input.value = '';
    });
  };

  // Fonction pour déterminer si les champs doivent être verrouillés
  const isFieldLocked = (fieldName: string): boolean => {
    if (formData.type === 'Terme') {
      // Pour les champs "Nom de l'assuré" et "Montant de la prime", verrouiller sauf en mode retour
      if (fieldName === 'insuredName' || fieldName === 'premiumAmount') {
        return !isRetourTechniqueMode && !isRetourContentieuxMode;
      }
    }
    return false;
  };

  const handleMissingAttestationComplete = () => {
    if (pendingSubmitData) {
      continueSubmitAfterAttestationCheck();
      setPendingSubmitData(null);
    }
  };

  const continueSubmitAfterAttestationCheck = async () => {
    const cleanedFormData = pendingSubmitData;

    // On passe directement à l'enregistrement car toutes les validations ont déjà été faites
    await performContractSave(cleanedFormData);
  };

  const performContractSave = async (cleanedFormData: any) => {
    console.log('🔍 Vérification avant sauvegarde (CRÉDIT):');
    console.log('  - Type de paiement:', cleanedFormData.paymentType);
    console.log('  - Prime saisie:', cleanedFormData.premiumAmount);
    console.log('  - Crédit saisi:', cleanedFormData.creditAmount);
    console.log('  - Date paiement:', cleanedFormData.paymentDate);

    setIsLoading(true);

    try {
      const contract: Contract = {
        id: generateContractId(),
        type: cleanedFormData.type,
        branch: cleanedFormData.branch,
        contractNumber: cleanedFormData.contractNumber,
        premiumAmount: parseFloat(cleanedFormData.premiumAmount),
        insuredName: cleanedFormData.insuredName,
        paymentMode: cleanedFormData.paymentMode,
        paymentType: cleanedFormData.paymentType,
        creditAmount: cleanedFormData.paymentType === 'Crédit' ? parseFloat(cleanedFormData.creditAmount) : undefined,
        paymentDate: cleanedFormData.paymentDate || undefined,
        createdBy: username,
        createdAt: Date.now(),
        telephone: cleanedFormData.type === 'Affaire' ? cleanedFormData.telephone : undefined,
        numeroAttestation: cleanedFormData.branch === 'Auto' ? cleanedFormData.numeroAttestation : undefined,
        xmlData: xmlSearchResult || undefined
      };

      console.log('📊 Données du contrat avant sauvegarde (CRÉDIT):');
      console.log('  - contract.premiumAmount:', contract.premiumAmount);
      console.log('  - contract.creditAmount:', contract.creditAmount);
      console.log('  - Calcul montant comptant:', contract.premiumAmount - (contract.creditAmount || 0));

      // VÉRIFICATIONS DES DOUBLONS AVANT SAUVEGARDE
      if (contract.type === 'Terme' && xmlSearchResult) {
        const existingInTerme = await checkTermeContractExists(
          contract.contractNumber,
          xmlSearchResult.maturity
        );

        if (existingInTerme) {
          const datePaiement = new Date(existingInTerme.date_paiement).toLocaleDateString('fr-FR');
          setMessage(`❌ Le terme est déjà payé en date du ${datePaiement}`);
          setIsLoading(false);
          resetForm();
          return;
        }

        const existingInRapport = await checkTermeInRapport(
          contract.contractNumber,
          xmlSearchResult.maturity
        );

        if (existingInRapport) {
          const datePaiement = new Date(existingInRapport.created_at).toLocaleDateString('fr-FR');
          setMessage(`❌ Le terme est déjà payé en date du ${datePaiement}`);
          setIsLoading(false);
          resetForm();
          return;
        }
      }

      if (contract.type === 'Affaire') {
        const sessionDate = getSessionDate();

        const existingInAffaire = await checkAffaireContractExists(
          contract.contractNumber,
          sessionDate
        );

        if (existingInAffaire) {
          const datePaiement = new Date(existingInAffaire.created_at).toLocaleDateString('fr-FR');
          setMessage(`❌ Ce contrat est déjà souscrit en date du ${datePaiement}`);
          setIsLoading(false);
          resetForm();
          return;
        }

        const existingInRapport = await checkAffaireInRapport(
          contract.contractNumber,
          sessionDate
        );

        if (existingInRapport) {
          const datePaiement = new Date(existingInRapport.created_at).toLocaleDateString('fr-FR');
          setMessage(`❌ Ce contrat est déjà souscrit en date du ${datePaiement}`);
          setIsLoading(false);
          resetForm();
          return;
        }
      }

      if (contract.type === 'Encaissement pour autre code') {
        const existing = await checkEncaissementAutreCodeExists(
          contract.contractNumber,
          cleanedFormData.dateEcheance
        );

        if (existing) {
          const datePaiement = new Date(existing.created_at).toLocaleDateString('fr-FR');
          setMessage(`❌ Ce contrat est déjà payé le ${datePaiement}`);
          setIsLoading(false);
          resetForm();
          return;
        }

        const autreCodeSuccess = await saveEncaissementAutreCode({
          contractNumber: contract.contractNumber,
          insuredName: contract.insuredName,
          premiumAmount: contract.premiumAmount,
          dateEcheance: cleanedFormData.dateEcheance,
          paymentMode: contract.paymentMode,
          createdBy: username
        });

        if (!autreCodeSuccess) {
          setMessage('❌ Erreur lors de la sauvegarde dans Encaissement_autre_code');
          setIsLoading(false);
          return;
        }
      }

      if (contract.type === 'Avenant changement de véhicule') {
        const sessionDate = getSessionDate();
        const existing = await checkAvenantChangementVehiculeExists(
          contract.contractNumber,
          sessionDate
        );

        if (existing) {
          const dateCreation = new Date(existing.created_at).toLocaleDateString('fr-FR');
          setMessage(`❌ Cet avenant est déjà effectué le ${dateCreation}`);
          setIsLoading(false);
          resetForm();
          return;
        }

        const avenantSuccess = await saveAvenantChangementVehicule({
          contractNumber: contract.contractNumber,
          insuredName: contract.insuredName,
          premiumAmount: contract.premiumAmount,
          branch: contract.branch,
          paymentMode: contract.paymentMode,
          createdBy: username
        });

        if (!avenantSuccess) {
          setMessage('❌ Erreur lors de la sauvegarde dans Avenant_Changement_véhicule');
          setIsLoading(false);
          return;
        }
      }

      saveContract(contract);

      // Pour les types Terme et Affaire, saveTermeContract et saveAffaireContract
      // enregistrent automatiquement dans rapport, donc on ne doit pas appeler saveContractToRapport
      const shouldSaveToRapportDirectly = contract.type !== 'Terme' && contract.type !== 'Affaire';

      if (shouldSaveToRapportDirectly) {
        try {
          console.log('💾 Début de la sauvegarde dans la table rapport...');
          const rapportSuccess = await saveContractToRapport(contract);

          if (rapportSuccess) {
            let successMessage = '✅ Contrat enregistré avec succès';

            if (contract.paymentType === 'Crédit') {
              const montantComptant = contract.premiumAmount - (contract.creditAmount || 0);
              successMessage += ` - Prime: ${contract.premiumAmount} DT, Crédit: ${contract.creditAmount} DT, Comptant: ${montantComptant} DT`;
            } else {
              successMessage += ` - Montant: ${contract.premiumAmount} DT`;
            }

            setMessage(successMessage);
          } else {
            setMessage('❌ Erreur lors de la sauvegarde dans la base de données');
            setIsLoading(false);
            return;
          }
        } catch (rapportError) {
          console.error('Erreur rapport:', rapportError);
          setMessage('❌ Erreur critique lors de la sauvegarde');
          setIsLoading(false);
          return;
        }
      }

      if (contract.type === 'Terme' && xmlSearchResult) {
        try {
          let retourType: 'Technique' | 'Contentieux' | null = null;
          let originalPrime: number | undefined = undefined;

          if (isRetourTechniqueMode) {
            retourType = 'Technique';
            originalPrime = parseFloat(originalPremiumAmount);
          } else if (isRetourContentieuxMode) {
            retourType = 'Contentieux';
          }

          const termeData = {
            contractNumber: contract.contractNumber,
            insuredName: contract.insuredName,
            paymentMode: contract.paymentMode,
            maturity: xmlSearchResult.maturity,
            paymentDate: getSessionDate(),
            premiumAmount: contract.premiumAmount,
            creditAmount: contract.creditAmount,
            branch: contract.branch,
            createdBy: username,
            paymentType: contract.paymentType,
            retour: retourType,
            primeOriginale: originalPrime,
            numeroAttestation: contract.numeroAttestation
          };

          const termeSuccess = await saveTermeContract(termeData);

          if (termeSuccess) {
            let successMessage = '✅ Contrat Terme enregistré avec succès';
            if (contract.paymentType === 'Crédit') {
              const montantComptant = contract.premiumAmount - (contract.creditAmount || 0);
              successMessage += ` - Prime: ${contract.premiumAmount} DT, Crédit: ${contract.creditAmount} DT, Comptant: ${montantComptant} DT`;
            } else {
              successMessage += ` - Montant: ${contract.premiumAmount} DT`;
            }
            setMessage(successMessage);
          } else {
            setMessage('❌ Erreur lors de la sauvegarde du contrat Terme');
            setIsLoading(false);
            return;
          }
        } catch (termeError) {
          console.error('❌ Erreur terme:', termeError);
          setMessage('❌ Erreur lors de la sauvegarde du contrat Terme');
          setIsLoading(false);
          return;
        }
      }

      if (contract.type === 'Affaire') {
        try {
          const sessionDate = getSessionDate();

          const affaireSuccess = await saveAffaireContract({
            contractNumber: contract.contractNumber,
            insuredName: contract.insuredName,
            premiumAmount: contract.premiumAmount,
            creditAmount: contract.creditAmount,
            branch: contract.branch,
            paymentDate: sessionDate,
            paymentMode: contract.paymentMode,
            paymentType: contract.paymentType,
            createdBy: username,
            telephone: contract.telephone,
            numeroAttestation: contract.numeroAttestation
          });

          if (affaireSuccess) {
            let successMessage = '✅ Contrat Affaire enregistré avec succès';
            if (contract.paymentType === 'Crédit') {
              const montantComptant = contract.premiumAmount - (contract.creditAmount || 0);
              successMessage += ` - Prime: ${contract.premiumAmount} DT, Crédit: ${contract.creditAmount} DT, Comptant: ${montantComptant} DT`;
            } else {
              successMessage += ` - Montant: ${contract.premiumAmount} DT`;
            }
            setMessage(successMessage);
          } else {
            setMessage('❌ Erreur lors de la sauvegarde du contrat Affaire');
            setIsLoading(false);
            return;
          }
        } catch (affaireError) {
          console.error('❌ Erreur affaire:', affaireError);
          setMessage('❌ Erreur lors de la sauvegarde du contrat Affaire');
          setIsLoading(false);
          return;
        }
      }

      if (contract.paymentType === 'Crédit') {
        try {
          const creditSuccess = await saveCreditContract({
            contractNumber: contract.contractNumber,
            insuredName: contract.insuredName,
            premiumAmount: contract.premiumAmount,
            creditAmount: contract.creditAmount || 0,
            paymentDate: contract.paymentDate || '',
            branch: contract.branch,
            createdBy: username
          });

          if (!creditSuccess) {
            setMessage(prev => prev + ' (erreur crédit)');
          }
        } catch (creditError) {
          console.error('❌ Erreur crédit:', creditError);
          setMessage(prev => prev + ' (erreur crédit)');
        }
      }

      if (contract.paymentMode === 'Cheque') {
        try {
          const chequeSuccess = await saveCheque({
            contractNumber: contract.contractNumber,
            insuredName: contract.insuredName,
            premiumAmount: contract.premiumAmount,
            numeroCheque: cleanedFormData.numeroCheque,
            banque: cleanedFormData.banque,
            dateEncaissementPrevue: cleanedFormData.dateEncaissementPrevue,
            createdBy: username
          });

          if (!chequeSuccess) {
            setMessage(prev => prev + ' (erreur chèque)');
          }
        } catch (chequeError) {
          console.error('❌ Erreur chèque:', chequeError);
          setMessage(prev => prev + ' (erreur chèque)');
        }
      }

      if (contract.numeroAttestation && contract.branch === 'Auto') {
        try {
          const attestationSuccess = await updateAttestationServie(
            parseInt(contract.numeroAttestation),
            contract.contractNumber,
            contract.insuredName,
            contract.premiumAmount
          );

          if (attestationSuccess) {
            console.log(`✅ Attestation ${contract.numeroAttestation} marquée comme imprimée`);
          } else {
            console.warn(`⚠️ Impossible de marquer l'attestation ${contract.numeroAttestation} comme imprimée`);
          }
        } catch (attestationError) {
          console.error('❌ Erreur attestation:', attestationError);
          setMessage(prev => prev + ' (erreur attestation)');
        }
      }

      resetForm();

    } catch (error) {
      console.error('Erreur générale:', error);
      setMessage('❌ Erreur générale lors de l\'enregistrement');
    }

    setIsLoading(false);
    setTimeout(() => setMessage(''), 6000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Nettoyer uniquement le numéro de contrat avant validation
    const cleanedFormData = {
      ...formData,
      contractNumber: trimSpaces(formData.contractNumber)
    };

    // Mettre à jour le state avec les valeurs nettoyées
    setFormData(cleanedFormData);

    // VALIDATION POUR TELEPHONE (obligatoire pour les contrats Affaire)
    if (cleanedFormData.type === 'Affaire') {
      if (!cleanedFormData.telephone || cleanedFormData.telephone.trim() === '') {
        setMessage('❌ Le numéro de téléphone est obligatoire pour les contrats Affaire');
        setTimeout(() => setMessage(''), 5000);
        return;
      }

      const phoneRegex = /^\+216[0-9]{8}$/;
      if (!phoneRegex.test(cleanedFormData.telephone.trim())) {
        setMessage('❌ Le format du numéro de téléphone est invalide. Format requis: +216 suivi de 8 chiffres (ex: +21623502362)');
        setTimeout(() => setMessage(''), 5000);
        return;
      }
    }

    // VALIDATION POUR NUMERO D'ATTESTATION (obligatoire pour branche Auto sauf Terme avec Retour Contentieux)
    const isRetourContentieuxTerme = cleanedFormData.type === 'Terme' && isRetourContentieuxMode;
    if (cleanedFormData.branch === 'Auto' && !isRetourContentieuxTerme) {
      if (!cleanedFormData.numeroAttestation || cleanedFormData.numeroAttestation.trim() === '') {
        setMessage('❌ Le numéro d\'attestation est obligatoire pour les contrats Auto');
        setTimeout(() => setMessage(''), 5000);
        return;
      }

      const attestationNum = parseInt(cleanedFormData.numeroAttestation);
      if (isNaN(attestationNum) || attestationNum <= 0) {
        setMessage('❌ Le numéro d\'attestation doit être un nombre valide');
        setTimeout(() => setMessage(''), 5000);
        return;
      }

      // Vérifier si l'attestation existe et est disponible
      const { data: attestationCheck, error: attestationError } = await supabase
        .rpc('check_attestation_disponible', { attestation_numero: attestationNum });

      if (attestationError) {
        console.error('Erreur lors de la vérification de l\'attestation:', attestationError);
        setMessage('❌ Erreur lors de la vérification du numéro d\'attestation');
        setTimeout(() => setMessage(''), 5000);
        return;
      }

      if (!attestationCheck || attestationCheck.length === 0 || !attestationCheck[0].existe) {
        setMessage('❌ Le numéro d\'attestation n\'existe pas dans le système');
        setTimeout(() => setMessage(''), 5000);
        return;
      }

      if (!attestationCheck[0].disponible) {
        const statut = attestationCheck[0].statut_actuel;
        if (statut === 'servie') {
          setMessage('❌ Cette attestation a déjà été servie');
        } else if (statut === 'annulee') {
          setMessage('❌ Cette attestation a été annulée');
        } else {
          setMessage('❌ Cette attestation n\'est pas disponible');
        }
        setTimeout(() => setMessage(''), 5000);
        return;
      }

      // Vérifier la séquence d'attestation avec la nouvelle fonction
      const { data: validationData, error: validationError } = await supabase
        .rpc('validate_attestation_sequence', { attestation_numero: attestationNum });

      if (validationError) {
        console.error('Erreur lors de la validation de la séquence d\'attestation:', validationError);
        setMessage('❌ Erreur lors de la validation du numéro d\'attestation');
        setTimeout(() => setMessage(''), 5000);
        return;
      }

      if (validationData && validationData.length > 0) {
        const validation = validationData[0];

        if (!validation.is_valid) {
          // L'attestation n'est pas dans la bonne séquence
          const numeroAttendu = validation.numero_attendu;

          // Vérifier s'il y a des numéros manquants (le numéro saisi est supérieur au numéro attendu)
          if (numeroAttendu && parseInt(numeroAttendu) < attestationNum) {
            // Vérifier que carnet_table existe
            if (!validation.carnet_table) {
              console.error('Nom de table du carnet manquant');
              setMessage('❌ Erreur: Table du carnet non trouvée');
              setTimeout(() => setMessage(''), 5000);
              return;
            }

            // Générer tous les numéros manquants potentiels
            const potentialMissingNumbers: string[] = [];
            for (let i = parseInt(numeroAttendu); i < attestationNum; i++) {
              potentialMissingNumbers.push(i.toString());
            }

            // Interroger la table du carnet pour vérifier le statut de chaque attestation
            const { data: carnetAttestations, error: carnetError } = await supabase
              .from(validation.carnet_table)
              .select('numero_attestation, statut')
              .in('numero_attestation', potentialMissingNumbers);

            if (carnetError) {
              console.error('Erreur lors de la vérification des attestations manquantes:', carnetError);
              setMessage('❌ Erreur lors de la vérification des attestations manquantes');
              setTimeout(() => setMessage(''), 5000);
              return;
            }

            // Filtrer seulement les attestations avec statut === null (vraiment manquantes)
            const missingNumbers = potentialMissingNumbers.filter(num => {
              const attestation = carnetAttestations?.find(a => a.numero_attestation === num);
              return attestation?.statut === null;
            });

            // Si toutes les attestations ont un statut (annulée ou servie), ne pas afficher le modal
            if (missingNumbers.length === 0) {
              // Continuer avec la soumission normale
              // Pas d'attestations réellement manquantes
            } else {
              setMissingAttestationNumbers(missingNumbers);
              setCarnetTableName(validation.carnet_table);
              setPendingSubmitData(cleanedFormData);
              setShowMissingAttestationModal(true);
              return;
            }
          } else {
            // Autre type d'erreur de séquence (déjà utilisé ou autre problème)
            // Message personnalisé avec le numéro attendu
            const messageDetail = numeroAttendu
              ? `\nLe numéro attendu est : ${numeroAttendu}`
              : '';
            setMessage(`❌ ${validation.message}${messageDetail}`);
            setTimeout(() => setMessage(''), 8000);
            return;
          }
        }
      }
    }

    // VALIDATION POUR PAIEMENT PAR CHÈQUE
    if (cleanedFormData.paymentMode === 'Cheque') {
      if (!cleanedFormData.numeroCheque || !cleanedFormData.banque || !cleanedFormData.dateEncaissementPrevue) {
        setMessage('❌ Veuillez remplir tous les champs du chèque (numéro, banque, date d\'encaissement prévue)');
        setTimeout(() => setMessage(''), 5000);
        return;
      }

      // Validation de la date d'encaissement prévue
      const dateEncaissement = new Date(cleanedFormData.dateEncaissementPrevue);
      const dateActuelle = new Date();
      dateActuelle.setHours(0, 0, 0, 0);

      const dateLimite = new Date(dateActuelle);
      dateLimite.setDate(dateLimite.getDate() + 7);

      if (dateEncaissement < dateActuelle) {
        setMessage('❌ La date d\'encaissement prévue ne peut pas être antérieure à la date actuelle');
        setTimeout(() => setMessage(''), 5000);
        return;
      }

      if (dateEncaissement > dateLimite) {
        setMessage('❌ La date d\'encaissement prévue ne peut pas être supérieure à 7 jours à partir d\'aujourd\'hui');
        setTimeout(() => setMessage(''), 5000);
        return;
      }
    }

    // VALIDATION SPÉCIFIQUE POUR CRÉDIT
    if (cleanedFormData.paymentType === 'Crédit') {
      const primeAmount = parseFloat(cleanedFormData.premiumAmount);
      const creditAmount = parseFloat(cleanedFormData.creditAmount);
      
      // Validation de la prime
      if (isNaN(primeAmount) || primeAmount <= 0) {
        setMessage('❌ Veuillez saisir un montant de prime valide');
        setTimeout(() => setMessage(''), 5000);
        return;
      }
      
      // Validation du crédit
      if (isNaN(creditAmount) || creditAmount <= 0) {
        setMessage('❌ Veuillez saisir un montant de crédit valide');
        setTimeout(() => setMessage(''), 5000);
        return;
      }
      
      // Vérifier que le crédit ne dépasse pas la prime
      if (creditAmount > primeAmount) {
        setMessage('❌ Le montant du crédit ne peut pas dépasser la prime totale');
        setTimeout(() => setMessage(''), 5000);
        return;
      }
      
      // Validation de la date pour crédit
      if (!cleanedFormData.paymentDate) {
        setMessage('❌ Veuillez saisir une date de paiement prévue pour le crédit');
        setTimeout(() => setMessage(''), 5000);
        return;
      }
      
      const sessionDate = getSessionDate();
      if (cleanedFormData.paymentDate <= sessionDate) {
        setMessage('❌ La date de paiement prévue doit être postérieure à la date de session actuelle');
        setTimeout(() => setMessage(''), 5000);
        return;
      }
    } else {
      // Validation pour paiement au comptant
      const primeAmount = parseFloat(cleanedFormData.premiumAmount);
      if (isNaN(primeAmount) || primeAmount <= 0) {
        setMessage('❌ Veuillez saisir un montant de prime valide');
        setTimeout(() => setMessage(''), 5000);
        return;
      }
    }

    // Toutes les validations sont passées, procéder à l'enregistrement
    await performContractSave(cleanedFormData);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-2xl p-4 sm:p-6 lg:p-8 border border-white/20">
        <div className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
          <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg shadow-md">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Nouveau Contrat</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Type et Branche */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Type de contrat *
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={(e) => {
                  handleInputChange(e);
                  if (e.target.value === 'Encaissement pour autre code') {
                    setShowAutreCodeMessage(true);
                  } else {
                    setShowAutreCodeMessage(false);
                  }
                  if (e.target.value !== 'Terme') {
                    setSelectedYear('');
                    setSelectedMonth('');
                    setXmlSearchResult(null);
                  }
                  setFormData(prev => ({
                    ...prev,
                    type: e.target.value as 'Terme' | 'Affaire' | 'Avenant changement de véhicule' | 'Encaissement pour autre code',
                    contractNumber: '',
                    premiumAmount: '',
                    insuredName: '',
                    paymentMode: 'Espece',
                    paymentType: 'Au comptant',
                    creditAmount: '',
                    paymentDate: '',
                    numeroCheque: '',
                    banque: '',
                    dateEncaissementPrevue: '',
                    dateEcheance: '',
                    telephone: '',
                    numeroAttestation: ''
                  }));
                  setMessage('');
                }}
                className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white text-sm sm:text-base"
                required
              >
                <option value="Affaire">Affaire</option>
                <option value="Terme">Terme</option>
                <option value="Avenant changement de véhicule">Avenant changement de véhicule</option>
                <option value="Encaissement pour autre code">Encaissement pour autre code</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Building className="w-4 h-4 mr-2" />
                Branche *
              </label>
              <select
                name="branch"
                value={formData.branch}
                onChange={handleInputChange}
                className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white text-sm sm:text-base"
                required
              >
                <option value="Auto">Auto</option>
                <option value="Vie">Vie</option>
                <option value="Santé">Santé</option>
                <option value="IRDS">IRDS</option>
              </select>
            </div>
          </div>

          {/* Recherche pour les contrats Terme */}
          {formData.type === 'Terme' && availableMonths.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-blue-700 mb-2">
                📅 Sélectionner l'année et le mois pour la recherche des contrats Terme
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Année
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      setSelectedYear(e.target.value);
                      setSelectedMonth('');
                    }}
                    className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                  >
                    <option value="">Choisir une année...</option>
                    {availableYears.map((year, index) => (
                      <option key={index} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Mois
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    disabled={!selectedYear}
                    className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Choisir un mois...</option>
                    {availableMonths
                      .filter(month => month.includes(selectedYear))
                      .map((month, index) => (
                        <option key={index} value={month}>{month}</option>
                      ))}
                  </select>
                </div>
              </div>

              <p className="text-xs text-blue-600 mt-2">
                Sélectionnez d'abord une année, puis un mois pour rechercher automatiquement les données du contrat
              </p>
            </div>
          )}

          {/* Numéro de contrat avec recherche */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Hash className="w-4 h-4 mr-2" />
              Numéro de contrat *
              <span className="text-xs text-blue-600 ml-2">(Les espaces en début/fin seront automatiquement supprimés)</span>
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                name="contractNumber"
                value={formData.contractNumber}
                onChange={handleInputChange}
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white"
                placeholder="Entrez le numéro de contrat"
                required
              />
              {formData.type === 'Terme' && selectedMonth && (
                <button
                  type="button"
                  onClick={searchInXML}
                  className="px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl"
                >
                  <Search className="w-4 h-4" />
                  <span>Rechercher</span>
                </button>
              )}
            </div>
          </div>

          {/* Champ Date d'échéance pour Encaissement autre code */}
          {formData.type === 'Encaissement pour autre code' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Date d'échéance *
              </label>
              <input
                type="date"
                name="dateEcheance"
                value={formData.dateEcheance}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white"
                required
              />
            </div>
          )}

          {/* Message pour Encaissement autre code */}
          {showAutreCodeMessage && (
            <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium">
                📢 Veuillez proposer au client le transfert de son contrat chez notre agence pour proximité de service!!!
              </p>
              <p className="text-sm text-blue-700 mt-2">
                S'il est d'accord lui faire signer une demande de résiliation à échéance et envoyez à l'E-mail contrat individuel.
              </p>
            </div>
          )}

          {/* Résultats de recherche */}
          {xmlSearchResult && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-green-800 mb-2 flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                📋 Données du contrat trouvées:
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-green-700">Prime:</span> {xmlSearchResult.premium} DT
                </div>
                <div>
                  <span className="font-medium text-green-700">Échéance:</span> {xmlSearchResult.maturity}
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-green-700">Assuré:</span> {xmlSearchResult.insured}
                </div>
                {xmlSearchResult.numTel && (
                  <div>
                    <span className="font-medium text-green-700">Tél 1:</span> {xmlSearchResult.numTel}
                  </div>
                )}
                {xmlSearchResult.numTel2 && (
                  <div>
                    <span className="font-medium text-green-700">Tél 2:</span> {xmlSearchResult.numTel2}
                  </div>
                )}
              </div>
              {selectedMonth && (
                <p className="text-xs text-green-600 mt-2">Source: Table Supabase "{selectedMonth}"</p>
              )}
            </div>
          )}

          {/* Montant Prime et Nom Assuré */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <DollarSign className="w-4 h-4 mr-2" />
                Montant Prime TTC (DT) *
                {formData.paymentType === 'Crédit' && (
                  <span className="text-xs text-orange-600 ml-2">(Prime totale)</span>
                )}
                {formData.type === 'Terme' && originalPremiumAmount && (
                  <span className="text-xs text-red-600 ml-2">
                    (Original: {originalPremiumAmount} DT)
                  </span>
                )}
                {formData.type === 'Terme' && isFieldLocked('premiumAmount') && (
                  <span className="text-xs text-blue-600 ml-2">(Verrouillé - Auto-rempli)</span>
                )}
              </label>
              <input
                type="number"
                name="premiumAmount"
                value={formData.premiumAmount}
                onChange={handleInputChange}
                step="0.01"
                min="0"
                className={`w-full p-3 border ${
                  (isRetourTechniqueMode || isRetourContentieuxMode) ? 'border-red-500' : 
                  isFieldLocked('premiumAmount') ? 'border-gray-400 bg-gray-100 text-gray-600' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 ${
                  isFieldLocked('premiumAmount') ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                }`}
                placeholder="0.00"
                required
                disabled={isFieldLocked('premiumAmount')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <User className="w-4 h-4 mr-2" />
                Nom de l'assuré *
                {formData.type === 'Terme' && isFieldLocked('insuredName') && (
                  <span className="text-xs text-blue-600 ml-2">(Verrouillé - Auto-rempli)</span>
                )}
              </label>
              <input
                type="text"
                name="insuredName"
                value={formData.insuredName}
                onChange={handleInputChange}
                className={`w-full p-2 sm:p-3 border ${
                  isFieldLocked('insuredName') ? 'border-gray-400 bg-gray-100 text-gray-600' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 ${
                  isFieldLocked('insuredName') ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                } text-sm sm:text-base`}
                placeholder="Nom complet de l'assuré"
                required
                disabled={isFieldLocked('insuredName')}
              />
            </div>
          </div>

          {/* Champ Téléphone pour les contrats Affaire */}
          {formData.type === 'Affaire' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <span className="text-lg mr-2">📱</span>
                Numéro de téléphone *
                <span className="text-xs text-red-600 ml-2">(Format: +21612345678)</span>
              </label>
              <input
                type="tel"
                name="telephone"
                value={formData.telephone}
                onChange={handleInputChange}
                pattern="\+216[0-9]{8}"
                maxLength={12}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white"
                placeholder="+21623502362"
                title="Format: +216 suivi de 8 chiffres (ex: +21623502362)"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Format requis: +216 suivi de 8 chiffres (ex: +21623502362)
              </p>
            </div>
          )}

          {/* Numéro Attestation pour branche Auto (Affaire ET Terme) */}
          {/* Ne pas demander l'attestation pour Terme avec Retour Contentieux */}
          {formData.branch === 'Auto' && !(formData.type === 'Terme' && isRetourContentieuxMode) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Numéro d'attestation *
                <span className="text-xs text-blue-600 ml-2">(Obligatoire pour Auto)</span>
              </label>
              <input
                type="number"
                name="numeroAttestation"
                value={formData.numeroAttestation}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white"
                placeholder="Ex: 12345"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Saisir le numéro d'attestation Auto
              </p>
            </div>
          )}

          {/* Mode et Type de Paiement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💳 Mode de paiement *
              </label>
              <select
                name="paymentMode"
                value={formData.paymentMode}
                onChange={handleInputChange}
                className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white text-sm sm:text-base"
                required
              >
                <option value="Espece">Espèce</option>
                <option value="Cheque">Chèque</option>
                <option value="Carte Bancaire">Carte Bancaire</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ⏰ Type de paiement *
              </label>
              <select
                name="paymentType"
                value={formData.paymentType}
                onChange={handleInputChange}
                className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white text-sm sm:text-base"
                required
              >
                <option value="Au comptant">Au comptant</option>
                <option value="Crédit">Crédit</option>
              </select>
            </div>
          </div>

          {/* Section CHÈQUE (conditionnelle) */}
          {formData.paymentMode === 'Cheque' && (
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Informations du Chèque
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Numéro du chèque *
                  </label>
                  <input
                    type="text"
                    name="numeroCheque"
                    value={formData.numeroCheque}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                    placeholder="Numéro du chèque"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Banque *
                  </label>
                  <input
                    type="text"
                    name="banque"
                    value={formData.banque}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                    placeholder="Nom de la banque"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Date d'encaissement prévue *
                  </label>
                  <input
                    type="date"
                    name="dateEncaissementPrevue"
                    value={formData.dateEncaissementPrevue}
                    onChange={handleInputChange}
                    min={new Date().toISOString().split('T')[0]}
                    max={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                  />
                  <p className="text-xs text-blue-600 mt-1">
                    Date entre aujourd'hui et {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Section CRÉDIT (conditionnelle) */}
          {formData.paymentType === 'Crédit' && (
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-orange-800 mb-4 flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Informations de Crédit
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Montant du crédit (DT) *
                    <span className="text-xs text-orange-600 ml-2">Max: {formData.premiumAmount || 0} DT</span>
                  </label>
                  <input
                    type="number"
                    name="creditAmount"
                    value={formData.creditAmount}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    max={formData.premiumAmount || undefined}
                    className="w-full p-3 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Date de paiement prévue *
                  </label>
                  <input
                    type="date"
                    name="paymentDate"
                    value={formData.paymentDate}
                    onChange={handleInputChange}
                    min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    className="w-full p-3 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white"
                    required
                  />
                  <p className="text-xs text-orange-600 mt-1">
                    Date minimum: {new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              
              {/* Récapitulatif du crédit */}
              {formData.premiumAmount && formData.creditAmount && (
                <div className="mt-4 p-4 bg-white rounded-lg border border-orange-200">
                  <h4 className="font-semibold text-orange-700 text-sm mb-3">📊 Récapitulatif du crédit:</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center p-2 bg-green-50 rounded-lg">
                      <div className="font-medium text-green-700">Prime totale</div>
                      <div className="text-green-600 font-bold">{parseFloat(formData.premiumAmount).toFixed(2)} DT</div>
                    </div>
                    <div className="text-center p-2 bg-blue-50 rounded-lg">
                      <div className="font-medium text-blue-700">Montant crédit</div>
                      <div className="text-blue-600 font-bold">{parseFloat(formData.creditAmount).toFixed(2)} DT</div>
                    </div>
                    <div className="text-center p-2 bg-purple-50 rounded-lg">
                      <div className="font-medium text-purple-700">À payer comptant</div>
                      <div className="text-purple-600 font-bold">
                        {(parseFloat(formData.premiumAmount) - parseFloat(formData.creditAmount)).toFixed(2)} DT
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Boutons Retour Technique et Contentieux (conditionnels) */}
          {formData.type === 'Terme' && (
            <div className="flex justify-start space-x-4">
              <button
                type="button"
                onClick={handleRetourTechniqueClick}
                className={`px-4 py-2 bg-gradient-to-r ${isRetourTechniqueMode ? 'from-red-600 to-red-700 hover:from-red-700 hover:to-red-800' : 'from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'} text-white rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-md hover:shadow-lg`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isRetourTechniqueMode ? 'Annuler Modification' : 'Retour Technique'}</span>
              </button>

              <button
                type="button"
                onClick={handleRetourContentieuxClick}
                className={`px-4 py-2 bg-gradient-to-r ${isRetourContentieuxMode ? 'from-red-600 to-red-700 hover:from-red-700 hover:to-red-800' : 'from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800'} text-white rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-md hover:shadow-lg`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isRetourContentieuxMode ? 'Annuler Modification' : 'Retour Contentieux'}</span>
              </button>
            </div>
          )}

          {/* Message de statut */}
          {message && (
            <div className={`p-4 rounded-lg border ${
              message.includes('✅') || message.includes('succès') || message.includes('trouvé')
                ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200'
                : message.includes('⚠️')
                ? 'bg-gradient-to-r from-yellow-50 to-amber-50 text-yellow-700 border-yellow-200'
                : 'bg-gradient-to-r from-red-50 to-pink-50 text-red-700 border-red-200'
            }`}>
              <div className="flex items-center">
                {message.includes('✅') && <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>}
                {message.includes('❌') && <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>}
                {message.includes('⚠️') && <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>}
                <span>{message}</span>
              </div>
            </div>
          )}

          {/* Bouton de soumission */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-2 sm:py-3 px-4 sm:px-8 rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none text-sm sm:text-base"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Enregistrer le contrat</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {termeSuspenduData && (
        <TermeSuspenduModal
          isOpen={showTermeSuspenduModal}
          onClose={() => setShowTermeSuspenduModal(false)}
          contractNumber={termeSuspenduData.contractNumber}
          insuredName={termeSuspenduData.insuredName}
          dateEcheance={termeSuspenduData.dateEcheance}
          joursDepasses={termeSuspenduData.joursDepasses}
          primeTotale={termeSuspenduData.primeTotale}
        />
      )}

      <MissingAttestationModal
        isOpen={showMissingAttestationModal}
        onClose={() => setShowMissingAttestationModal(false)}
        missingNumbers={missingAttestationNumbers}
        currentUser={username}
        carnetTable={carnetTableName}
        onComplete={handleMissingAttestationComplete}
      />
    </div>
  );
};

export default ContractForm;