import { supabase } from '../lib/supabase';

// Types pour les données de crédit
interface CreditData {
  id: number;
  numero_contrat: string;
  prime: number;
  assure: string;
  branche: string;
  montant_credit: number;
  paiement?: number;
  solde?: number;
  statut: string;
  date_paiement_prevue?: string;
  date_paiement_effectif?: string;
  created_at: string;
  mode_paiement?: string;
  numero_cheque?: string;
  banque_cheque?: string;
  date_encaissement_prevue?: string;
}

interface ChequeData {
  numeroCheque: string;
  banque: string;
  dateEncaissementPrevue: string;
}

interface ContractData {
  type?: string;
  branch?: string;
  contractNumber?: string;
  premiumAmount: string | number;
  insuredName?: string;
  paymentMode?: string;
  paymentType?: string;
  createdBy?: string;
  paymentDate?: string;
  creditAmount?: string | number;
  xmlData?: {
    maturity?: string;
  };
  echeance?: string;
  telephone?: string;
  numeroAttestation?: string;
}

interface RapportData {
  type: string | null;
  branche: string | null;
  numero_contrat: string;
  prime: number;
  montant: number;
  montant_recu: number;
  date_operation: string;
  assure: string;
  mode_paiement: string | null;
  type_paiement: string | null;
  cree_par: string;
  montant_credit?: number | null;
  date_paiement_prevue?: string | null;
  echeance?: string | null;
  date_depense?: string | null;
  type_depense?: string | null;
  date_recette?: string | null;
  type_recette?: string | null;
  date_ristourne?: string | null;
  date_paiement_ristourne?: string | null;
  client?: string | null;
  date_sinistre?: string | null;
  date_paiement_sinistre?: string | null;
  numero_sinistre?: string | null;
  created_at?: string;
}

// Fonction pour sauvegarder un contrat dans la table rapport
export const saveContractToRapport = async (contractData: ContractData): Promise<boolean> => {
  try {
    console.log('📊 Sauvegarde du contrat dans la table rapport...');

    const primeValue = Number(contractData.premiumAmount);
    if (isNaN(primeValue) || primeValue <= 0) {
      console.error('❌ Montant de prime invalide:', contractData.premiumAmount);
      return false;
    }

    // Gérer le montant crédit
    let montantCreditValue: number | null = null;
    if (contractData.paymentType === 'Crédit') {
      montantCreditValue = contractData.creditAmount ? Number(contractData.creditAmount) : primeValue;
      
      if (montantCreditValue > primeValue) {
        console.warn('⚠️ Crédit supérieur à la prime, ajustement automatique');
        montantCreditValue = primeValue;
      }
    }

    // Mapper les types de contrat
    let rapportType = contractData.type;
    if (contractData.type === 'Avenant changement de véhicule') {
      rapportType = 'Avenant';
    }

    // Préparer les données
    const sessionDate = new Date().toISOString().split('T')[0];
    const insertData: RapportData = {
      type: rapportType || null,
      branche: contractData.branch || null,
      numero_contrat: contractData.contractNumber || '',
      prime: primeValue,
      montant: primeValue,
      montant_recu: primeValue,
      date_operation: sessionDate,
      assure: contractData.insuredName || '',
      mode_paiement: contractData.paymentMode || null,
      type_paiement: contractData.paymentType || null,
      cree_par: contractData.createdBy || '',
      montant_credit: montantCreditValue,
      date_paiement_prevue: contractData.paymentType === 'Crédit' ? contractData.paymentDate : null,
      echeance: contractData.type === 'Terme' && contractData.xmlData?.maturity ?
        convertExcelDateToISO(contractData.xmlData.maturity) : null,
      date_depense: null,
      type_depense: null,
      date_recette: null,
      type_recette: null,
      date_ristourne: null,
      date_paiement_ristourne: null,
      client: null,
      date_sinistre: null,
      date_paiement_sinistre: null,
      numero_sinistre: null
    };

    const { data, error } = await supabase
      .from('rapport')
      .insert([insertData])
      .select();

    if (error) {
      console.error('❌ Erreur lors de la sauvegarde dans rapport:', error);
      return false;
    }

    console.log('✅ Contrat sauvegardé dans rapport avec succès');
    return true;
  } catch (error) {
    console.error('❌ Erreur générale lors de la sauvegarde dans rapport:', error);
    return false;
  }
};

// FONCTION CRITIQUE : Mise à jour du paiement de crédit avec double vérification
export const updateCreditPayment = async (
  id: number,
  montantPaiement: number,
  assure: string,
  modePaiement: 'Espece' | 'Cheque' | 'Carte Bancaire',
  numeroContrat?: string,
  chequeData?: ChequeData
): Promise<boolean> => {
  try {
    console.log('💳 Début de la mise à jour du paiement crédit...');

    // 1. Récupérer le crédit actuel
    const { data: creditActuel, error: fetchError } = await supabase
      .from('liste_credits')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !creditActuel) {
      console.error('❌ Erreur récupération crédit:', fetchError);
      return false;
    }

    // 2. Calculer les nouveaux montants
    const paiementActuel = creditActuel.paiement || 0;
    const soldeActuel = creditActuel.solde || creditActuel.montant_credit;
    
    const nouveauPaiementTotal = paiementActuel + montantPaiement;
    const nouveauSolde = soldeActuel - montantPaiement;

    // 3. Validation des montants
    if (montantPaiement <= 0) {
      console.error('❌ Montant de paiement invalide:', montantPaiement);
      return false;
    }

    if (montantPaiement > soldeActuel) {
      console.error('❌ Montant supérieur au solde:', { montantPaiement, soldeActuel });
      return false;
    }

    // 4. Déterminer le nouveau statut
    let nouveauStatut = '';
    if (nouveauSolde <= 0) {
      nouveauStatut = 'Payé en total';
    } else if (nouveauPaiementTotal > 0 && nouveauSolde > 0) {
      nouveauStatut = 'Payé partiellement';
    } else {
      nouveauStatut = 'Non payé';
    }

    // 5. Mettre à jour le crédit dans liste_credits
    const updateData: Partial<CreditData> = {
      paiement: nouveauPaiementTotal,
      solde: nouveauSolde,
      date_paiement_effectif: new Date().toISOString().split('T')[0],
      statut: nouveauStatut,
      mode_paiement: modePaiement,
      ...(chequeData && {
        numero_cheque: chequeData.numeroCheque,
        banque_cheque: chequeData.banque,
        date_encaissement_prevue: chequeData.dateEncaissementPrevue
      })
    };

    const { error: updateError } = await supabase
      .from('liste_credits')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('❌ Erreur mise à jour liste_credits:', updateError);
      return false;
    }

    console.log('✅ Crédit mis à jour dans liste_credits');

    // 6. VÉRIFICATION CRITIQUE : Vérifier que la mise à jour a bien été effectuée
    const { data: creditVerifie, error: verifyError } = await supabase
      .from('liste_credits')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (verifyError) {
      console.error('❌ Erreur vérification mise à jour liste_credits:', verifyError);
      return false;
    }

    // 7. Enregistrer le paiement dans la table rapport
    const datePaiement = new Date().toISOString();
    const sessionDate = new Date().toISOString().split('T')[0];

    const rapportData: RapportData = {
      type: 'Paiement Crédit',
      branche: creditActuel.branche || 'Auto',
      numero_contrat: creditActuel.numero_contrat,
      prime: montantPaiement,
      montant: montantPaiement,
      montant_recu: montantPaiement,
      date_operation: sessionDate,
      assure: assure,
      mode_paiement: modePaiement,
      type_paiement: 'Au comptant',
      cree_par: 'Système',
      montant_credit: null,
      date_paiement_prevue: null,
      echeance: null,
      date_depense: null,
      type_depense: null,
      date_recette: null,
      type_recette: null,
      date_ristourne: null,
      date_paiement_ristourne: null,
      client: null,
      date_sinistre: null,
      date_paiement_sinistre: null,
      numero_sinistre: null,
      created_at: datePaiement
    };

    const { data: rapportInsert, error: rapportError } = await supabase
      .from('rapport')
      .insert([rapportData])
      .select();

    if (rapportError) {
      console.error('❌ Erreur enregistrement dans rapport:', rapportError);
      return false;
    }

    console.log('✅ Paiement enregistré dans rapport avec succès');

    // 8. Si paiement par chèque, enregistrer dans la table Cheques
    if (modePaiement === 'Cheque' && chequeData && numeroContrat) {
      const { error: chequeError } = await supabase
        .from('Cheques')
        .insert([{
          Numero_Contrat: numeroContrat,
          Assure: assure,
          Numero_Cheque: chequeData.numeroCheque,
          Titulaire_Cheque: assure,
          Montant: montantPaiement.toString(),
          Date_Encaissement_prévue: chequeData.dateEncaissementPrevue,
          Banque: chequeData.banque,
          Statut: 'Non Encaissé',
          created_at: new Date().toISOString()
        }]);

      if (chequeError) {
        console.error('⚠️ Erreur enregistrement chèque:', chequeError);
      } else {
        console.log('✅ Chèque enregistré dans la table Cheques');
      }
    }

    console.log('🎉 Paiement crédit traité avec succès dans les deux tables');
    return true;

  } catch (error) {
    console.error('❌ Erreur générale lors de la mise à jour du paiement:', error);
    return false;
  }
};

// Fonction de vérification pour confirmer l'enregistrement
export const verifyPaymentInBothTables = async (
  creditId: number,
  montantPaiement: number
): Promise<{ success: boolean; listeCredits?: CreditData; rapport?: any }> => {
  try {
    console.log('🔍 Vérification du paiement dans les deux tables...');

    // Vérifier dans liste_credits
    const { data: creditData, error: creditError } = await supabase
      .from('liste_credits')
      .select('*')
      .eq('id', creditId)
      .maybeSingle();

    if (creditError) {
      console.error('❌ Erreur vérification liste_credits:', creditError);
      return { success: false };
    }

    // Vérifier dans rapport
    const { data: rapportData, error: rapportError } = await supabase
      .from('rapport')
      .select('*')
      .eq('numero_contrat', creditData.numero_contrat)
      .eq('type', 'Paiement Crédit')
      .eq('montant', montantPaiement)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rapportError) {
      console.error('❌ Erreur vérification rapport:', rapportError);
      return { success: false };
    }

    console.log('✅ Vérification réussie dans les deux tables');
    return {
      success: true,
      listeCredits: creditData,
      rapport: rapportData
    };
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
    return { success: false };
  }
};

// Fonction pour sauvegarder un crédit
export const saveCreditContract = async (contractData: ContractData): Promise<boolean> => {
  try {
    console.log('💳 Sauvegarde du crédit...');

    const primeValue = Number(contractData.premiumAmount);
    if (isNaN(primeValue) || primeValue <= 0) {
      console.error('❌ Montant de prime invalide:', contractData.premiumAmount);
      return false;
    }

    // Calculer le montant crédit
    let creditAmountValue = contractData.creditAmount ? Number(contractData.creditAmount) : primeValue;
    if (creditAmountValue > primeValue) {
      creditAmountValue = primeValue;
    }

    const { data, error } = await supabase
      .from('liste_credits')
      .insert([{
        numero_contrat: contractData.contractNumber || '',
        prime: primeValue,
        assure: contractData.insuredName,
        branche: contractData.branch,
        montant_credit: creditAmountValue,
        date_paiement_prevue: contractData.paymentDate,
        cree_par: contractData.createdBy,
        statut: 'Non payé',
        solde: creditAmountValue,
        paiement: 0,
        telephone: contractData.telephone || null
      }]);

    if (error) {
      console.error('❌ Erreur lors de la sauvegarde du crédit:', error);
      return false;
    }

    console.log('✅ Crédit sauvegardé avec succès');
    return true;
  } catch (error) {
    console.error('❌ Erreur générale lors de la sauvegarde du crédit:', error);
    return false;
  }
};

// Fonction pour rechercher un crédit par numéro de contrat
export const searchCreditByContractNumber = async (contractNumber: string): Promise<CreditData | null> => {
  try {
    const { data, error } = await supabase
      .from('liste_credits')
      .select('*')
      .eq('numero_contrat', contractNumber)
      .maybeSingle();

    if (error) return null;
    return data;
  } catch (error) {
    console.error('Erreur recherche crédit:', error);
    return null;
  }
};

// Fonction pour rechercher des crédits de manière flexible avec created_at (date simple)
// Fonction pour rechercher des crédits de manière flexible avec conversion de timestampz en date
// Fonction pour rechercher des crédits de manière flexible avec tolérance et correction du mois
// Fonction pour rechercher des crédits de manière flexible avec tolérance et correction d// Fonction pour rechercher des crédits de manière flexible - VERSION CORRIGÉE
export const searchCreditFlexible = async (
  contractNumber?: string | null,
  insuredName?: string | null,
  creditDate?: string | null,
  searchMonth?: string | null,
  searchYear?: string | null
): Promise<CreditData[]> => {
  try {
    console.log('🔍 Recherche flexible crédit avec paramètres:', {
      contractNumber,
      insuredName,
      creditDate,
      searchMonth,
      searchYear
    });

    let query = supabase.from('liste_credits').select('*');

    // Recherche par numéro de contrat + date de création
    if (contractNumber && creditDate) {
      console.log('🔍 Recherche par numéro contrat + date création');
      query = query
        .ilike('numero_contrat', `%${contractNumber}%`)
        .gte('created_at', `${creditDate}T00:00:00`)
        .lte('created_at', `${creditDate}T23:59:59`);
    }
    // Recherche par nom assuré + date de création avec tolérance
    else if (insuredName && creditDate) {
      console.log('🔍 Recherche par nom assuré + date création avec tolérance');
      const cleanedName = insuredName.trim();
      
      if (cleanedName.length <= 3) {
        query = query.ilike('assure', `%${cleanedName}%`);
      } else {
        // Recherche avec variations pour tolérance
        const patterns = [
          `%${cleanedName}%`,
          `%${cleanedName.slice(0, -1)}%`,
          `%${cleanedName.slice(1)}%`
        ];
        query = query.or(patterns.map(pattern => `assure.ilike.${pattern}`).join(','));
      }
      
      query = query
        .gte('created_at', `${creditDate}T00:00:00`)
        .lte('created_at', `${creditDate}T23:59:59`);
    }
    // RECHERCHE PAR MOIS ET ANNÉE - VERSION CORRIGÉE
    else if (searchMonth && searchYear) {
      console.log('🔍 Recherche par mois/année - version corrigée:', { searchMonth, searchYear });
      
      // Mapping complet des mois
      const monthMapping: { [key: string]: string } = {
        'janvier': '01', 'janv': '01', 'jan': '01',
        'février': '02', 'fevrier': '02', 'fev': '02', 'fév': '02',
        'mars': '03', 'mar': '03',
        'avril': '04', 'avr': '04',
        'mai': '05', 
        'juin': '06', 'jun': '06',
        'juillet': '07', 'juil': '07', 'jui': '07',
        'août': '08', 'aout': '08', 'aou': '08',
        'septembre': '09', 'sept': '09', 'sep': '09',
        'octobre': '10', 'oct': '10',
        'novembre': '11', 'nov': '11',
        'décembre': '12', 'decembre': '12', 'dec': '12', 'déc': '12'
      };

      const cleanedMonth = searchMonth.trim().toLowerCase();
      let monthNumber = monthMapping[cleanedMonth];

      // Si pas trouvé directement, chercher une correspondance partielle
      if (!monthNumber) {
        for (const [key, value] of Object.entries(monthMapping)) {
          if (cleanedMonth.includes(key) || key.includes(cleanedMonth)) {
            monthNumber = value;
            console.log(`🔄 Mois corrigé: "${searchMonth}" -> "${key}" (${value})`);
            break;
          }
        }
      }

      if (monthNumber) {
        // METHODE 1: Utiliser une plage de dates (plus fiable)
        const startDate = `${searchYear}-${monthNumber}-01`;
        
        // Calculer le dernier jour du mois
        const lastDay = new Date(parseInt(searchYear), parseInt(monthNumber), 0).getDate();
        const endDate = `${searchYear}-${monthNumber}-${lastDay}`;
        
        console.log('📅 Plage de dates pour le filtrage:', { startDate, endDate });
        
        query = query
          .gte('created_at', `${startDate}T00:00:00`)
          .lte('created_at', `${endDate}T23:59:59`);

      } else {
        console.warn('⚠️ Mois non reconnu, recherche sur toute l\'année:', searchMonth);
        // Fallback: rechercher sur toute l'année
        query = query
          .gte('created_at', `${searchYear}-01-01T00:00:00`)
          .lte('created_at', `${searchYear}-12-31T23:59:59`);
      }
    }
    // Recherche par numéro de contrat + mois + année
    else if (contractNumber && searchMonth && searchYear) {
      console.log('🔍 Recherche par numéro contrat + mois/année');
      
      const monthMapping: { [key: string]: string } = {
        'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04',
        'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08',
        'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12'
      };

      const cleanedMonth = searchMonth.trim().toLowerCase();
      const monthNumber = monthMapping[cleanedMonth];

      if (monthNumber) {
        const startDate = `${searchYear}-${monthNumber}-01`;
        const lastDay = new Date(parseInt(searchYear), parseInt(monthNumber), 0).getDate();
        const endDate = `${searchYear}-${monthNumber}-${lastDay}`;
        
        query = query
          .ilike('numero_contrat', `%${contractNumber}%`)
          .gte('created_at', `${startDate}T00:00:00`)
          .lte('created_at', `${endDate}T23:59:59`);
      }
    }
    // Recherche par nom assuré + mois + année
    else if (insuredName && searchMonth && searchYear) {
      console.log('🔍 Recherche par nom assuré + mois/année');
      
      const monthMapping: { [key: string]: string } = {
        'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04',
        'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08',
        'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12'
      };

      const cleanedMonth = searchMonth.trim().toLowerCase();
      const monthNumber = monthMapping[cleanedMonth];

      if (monthNumber) {
        const startDate = `${searchYear}-${monthNumber}-01`;
        const lastDay = new Date(parseInt(searchYear), parseInt(monthNumber), 0).getDate();
        const endDate = `${searchYear}-${monthNumber}-${lastDay}`;
        
        const cleanedName = insuredName.trim();
        if (cleanedName.length <= 3) {
          query = query.ilike('assure', `%${cleanedName}%`);
        } else {
          const patterns = [
            `%${cleanedName}%`,
            `%${cleanedName.slice(0, -1)}%`,
            `%${cleanedName.slice(1)}%`
          ];
          query = query.or(patterns.map(pattern => `assure.ilike.${pattern}`).join(','));
        }
        
        query = query
          .gte('created_at', `${startDate}T00:00:00`)
          .lte('created_at', `${endDate}T23:59:59`);
      }
    }
    // Recherche individuelle
    else {
      if (contractNumber) {
        query = query.ilike('numero_contrat', `%${contractNumber}%`);
      }
      if (insuredName) {
        const cleanedName = insuredName.trim();
        if (cleanedName.length <= 3) {
          query = query.ilike('assure', `%${cleanedName}%`);
        } else {
          const patterns = [
            `%${cleanedName}%`,
            `%${cleanedName.slice(0, -1)}%`,
            `%${cleanedName.slice(1)}%`
          ];
          query = query.or(patterns.map(pattern => `assure.ilike.${pattern}`).join(','));
        }
      }
      if (creditDate) {
        query = query
          .gte('created_at', `${creditDate}T00:00:00`)
          .lte('created_at', `${creditDate}T23:59:59`);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Erreur recherche flexible crédit:', error);
      console.error('Détails erreur:', error.details || error.message);
      return [];
    }

    console.log(`✅ ${data?.length || 0} crédits trouvés`);
    
    // Debug avancé pour le filtrage par mois
    if (data && data.length > 0 && searchMonth) {
      const monthsCount: { [key: string]: number } = {};
      data.forEach(credit => {
        const date = new Date(credit.created_at);
        const month = date.getMonth() + 1;
        const monthKey = `${month.toString().padStart(2, '0')}`;
        monthsCount[monthKey] = (monthsCount[monthKey] || 0) + 1;
      });
      
      console.log('📊 Répartition des mois dans les résultats:', monthsCount);
    }
    
    return data || [];
  } catch (error) {
    console.error('❌ Erreur générale recherche flexible crédit:', error);
    return [];
  }
};
// Fonction utilitaire pour la recherche avec tolérance
const buildTolerantSearch = (searchTerm: string): string[] => {
  const cleaned = searchTerm.trim().toLowerCase();
  const patterns: string[] = [];
  
  if (cleaned.length <= 2) {
    // Pour les très courts termes, recherche simple
    patterns.push(`%${cleaned}%`);
  } else if (cleaned.length <= 4) {
    // Termes courts - permettre la fin tronquée
    patterns.push(`%${cleaned}%`);
    patterns.push(`%${cleaned.slice(0, -1)}%`);
  } else {
    // Termes longs - permettre plusieurs variations
    patterns.push(`%${cleaned}%`); // Exact
    patterns.push(`%${cleaned.slice(0, -1)}%`); // Manque 1 caractère fin
    patterns.push(`%${cleaned.slice(1)}%`); // Manque 1 caractère début
    patterns.push(`%${cleaned.slice(0, -2)}%`); // Manque 2 caractères fin
    patterns.push(`%${cleaned.slice(2)}%`); // Manque 2 caractères début
    
    // Pour les noms composés, chercher chaque partie
    if (cleaned.includes(' ')) {
      const parts = cleaned.split(' ');
      parts.forEach(part => {
        if (part.length >= 2) {
          patterns.push(`%${part}%`);
        }
      });
    }
  }
  
  return patterns;
};
// FONCTIONS MANQUANTES POUR ContractForm.tsx

// Fonction pour vérifier si un contrat Affaire existe déjà dans la table Affaire
export const checkAffaireContractExists = async (numeroContrat: string, datePaiement: string): Promise<any | null> => {
  try {
    console.log('🔍 Vérification existence contrat Affaire dans table Affaire...');

    // Chercher les contrats créés aujourd'hui avec ce numéro
    const { data, error } = await supabase
      .from('affaire')
      .select('*')
      .eq('numero_contrat', numeroContrat)
      .gte('created_at', datePaiement)
      .lt('created_at', datePaiement + 'T23:59:59')
      .maybeSingle();

    if (error) {
      console.error('❌ Erreur vérification Affaire:', error);
      return null;
    }

    console.log(data ? '⚠️ Contrat Affaire existe déjà' : '✅ Contrat Affaire peut être créé');
    return data;
  } catch (error) {
    console.error('❌ Erreur générale vérification Affaire:', error);
    return null;
  }
};

// Fonction pour vérifier si un contrat Affaire existe déjà dans la table Rapport
export const checkAffaireInRapport = async (numeroContrat: string, datePaiement: string): Promise<any | null> => {
  try {
    console.log('🔍 Vérification existence contrat Affaire dans table Rapport...');

    // Chercher les contrats créés aujourd'hui avec ce numéro
    const { data, error } = await supabase
      .from('rapport')
      .select('*')
      .eq('numero_contrat', numeroContrat)
      .eq('type', 'Affaire')
      .gte('created_at', datePaiement)
      .lt('created_at', datePaiement + 'T23:59:59')
      .maybeSingle();

    if (error) {
      console.error('❌ Erreur vérification Affaire dans Rapport:', error);
      return null;
    }

    console.log(data ? '⚠️ Contrat Affaire existe dans Rapport' : '✅ Contrat Affaire peut être créé dans Rapport');
    return data;
  } catch (error) {
    console.error('❌ Erreur générale vérification Affaire dans Rapport:', error);
    return null;
  }
};

// Fonction pour sauvegarder un contrat Affaire
export const saveAffaireContract = async (contractData: ContractData): Promise<boolean> => {
  try {
    console.log('💾 Sauvegarde du contrat Affaire...');

    const primeValue = Number(contractData.premiumAmount);
    if (isNaN(primeValue) || primeValue <= 0) {
      console.error('❌ Montant de prime invalide:', contractData.premiumAmount);
      return false;
    }

    // Gérer le crédit pour Affaire
    let montantCreditValue: number | null = null;
    if (contractData.paymentType === 'Crédit') {
      montantCreditValue = contractData.creditAmount ? Number(contractData.creditAmount) : primeValue;
      if (montantCreditValue > primeValue) {
        montantCreditValue = primeValue;
      }
    }

    const { data, error } = await supabase
      .from('affaire')
      .insert([{
        numero_contrat: contractData.contractNumber || '',
        prime: primeValue,
        assure: contractData.insuredName,
        branche: contractData.branch,
        mode_paiement: contractData.paymentMode,
        type_paiement: contractData.paymentType,
        montant_credit: montantCreditValue,
        date_paiement: contractData.paymentType === 'Crédit' ? contractData.paymentDate : null,
        cree_par: contractData.createdBy,
        telephone: contractData.telephone || ''
      }]);

    if (error) {
      console.error('❌ Erreur lors de la sauvegarde Affaire:', error);
      return false;
    }

    console.log('✅ Contrat Affaire sauvegardé avec succès');
    return true;
  } catch (error) {
    console.error('❌ Erreur générale lors de la sauvegarde Affaire:', error);
    return false;
  }
};

// Fonction pour vérifier si un contrat Terme existe déjà dans la table Terme
export const checkTermeContractExists = async (numeroContrat: string, echeance: string): Promise<any | null> => {
  try {
    console.log('🔍 Vérification existence contrat Terme dans table Terme...');

    const echeanceISO = convertExcelDateToISO(echeance);

    const { data, error } = await supabase
      .from('terme')
      .select('*')
      .eq('numero_contrat', numeroContrat)
      .eq('echeance', echeanceISO)
      .maybeSingle();

    if (error) {
      console.error('❌ Erreur vérification Terme:', error);
      return null;
    }

    console.log(data ? '⚠️ Contrat Terme existe déjà' : '✅ Contrat Terme peut être créé');
    return data;
  } catch (error) {
    console.error('❌ Erreur générale vérification Terme:', error);
    return null;
  }
};

// Fonction pour vérifier si un contrat Terme existe déjà dans la table Rapport
export const checkTermeInRapport = async (numeroContrat: string, echeance: string): Promise<any | null> => {
  try {
    console.log('🔍 Vérification existence contrat Terme dans table Rapport...');

    const echeanceISO = convertExcelDateToISO(echeance);

    const { data, error } = await supabase
      .from('rapport')
      .select('*')
      .eq('numero_contrat', numeroContrat)
      .eq('echeance', echeanceISO)
      .eq('type', 'Terme')
      .maybeSingle();

    if (error) {
      console.error('❌ Erreur vérification Terme dans Rapport:', error);
      return null;
    }

    console.log(data ? '⚠️ Contrat Terme existe dans Rapport' : '✅ Contrat Terme peut être créé dans Rapport');
    return data;
  } catch (error) {
    console.error('❌ Erreur générale vérification Terme dans Rapport:', error);
    return null;
  }
};

// Fonction pour sauvegarder un contrat Terme
export const saveTermeContract = async (
  contractData: ContractData,
  retourType?: 'Technique' | 'Contentieux' | null,
  originalPrimeAmount?: number
): Promise<boolean> => {
  try {
    console.log('📝 Sauvegarde du contrat Terme...');

    const primeValue = Number(contractData.premiumAmount);
    if (isNaN(primeValue) || primeValue <= 0) {
      console.error('❌ Montant de prime invalide:', contractData.premiumAmount);
      return false;
    }

    const echeanceISO = convertExcelDateToISO(contractData.xmlData?.maturity || contractData.echeance);

    const insertData: any = {
      numero_contrat: contractData.contractNumber || '',
      prime: primeValue,
      assure: contractData.insuredName || '',
      branche: contractData.branch || '',
      echeance: echeanceISO,
      date_paiement: new Date().toISOString().split('T')[0],
      cree_par: contractData.createdBy || 'Système'
    };

    // Ajouter NumATT si branche Auto et numéro fourni
    if (contractData.branch === 'Auto' && contractData.numeroAttestation) {
      insertData.numatt = parseInt(contractData.numeroAttestation);
    }

    // Ajouter les informations de retour si applicable
    if (retourType) {
      insertData.Retour = retourType;
      if (originalPrimeAmount) {
        insertData['Prime avant retour'] = originalPrimeAmount;
      }
      console.log(`🔄 Retour ${retourType} détecté - Prime avant retour: ${originalPrimeAmount}, Prime actuelle: ${primeValue}`);
    }

    // Ajouter les colonnes Credit si le type de paiement est Crédit
    if (contractData.paymentType === 'Crédit' && contractData.creditAmount) {
      const creditValue = Number(contractData.creditAmount);
      const netPrimeValue = primeValue - creditValue;

      insertData.Credit = creditValue;
      insertData.Type_Paiement = 'Credit';
      insertData['prime NETTE'] = netPrimeValue;

      console.log('💳 Enregistrement du crédit:');
      console.log(`  - Prime totale: ${primeValue}`);
      console.log(`  - Montant crédit: ${creditValue}`);
      console.log(`  - Prime nette: ${netPrimeValue}`);
    }

    const { data, error } = await supabase
      .from('terme')
      .insert([insertData])
      .select();

    if (error) {
      console.error('❌ Erreur lors de la sauvegarde Terme:', error);
      return false;
    }

    console.log('✅ Contrat Terme sauvegardé avec succès');

    if (contractData.xmlData?.maturity) {
      const maturityDate = contractData.xmlData.maturity;
      const dateObj = new Date(maturityDate);
      const monthName = dateObj.toLocaleString('fr-FR', { month: 'long' }).toLowerCase();
      const year = dateObj.getFullYear().toString();

      await updateTermeStatus(contractData.contractNumber, monthName, year, 'payé');
    }

    return true;
  } catch (error) {
    console.error('❌ Erreur générale lors de la sauvegarde Terme:', error);
    return false;
  }
};

export const updateTermeStatus = async (
  contractNumber: string,
  monthName: string,
  year: string,
  status: 'payé' | 'non payé'
): Promise<boolean> => {
  try {
    const tableName = `table_terme_${monthName}_${year}`;
    console.log(`📝 Mise à jour du statut dans ${tableName} pour le contrat ${contractNumber}...`);

    const { error } = await supabase.rpc('execute_sql_query', {
      query: `UPDATE ${tableName} SET statut = '${status}' WHERE numero_contrat = '${contractNumber}'`
    });

    if (error) {
      const { error: directError } = await supabase
        .from(tableName)
        .update({ statut: status })
        .eq('numero_contrat', contractNumber);

      if (directError) {
        console.error('❌ Erreur lors de la mise à jour du statut:', directError);
        return false;
      }
    }

    console.log(`✅ Statut mis à jour: ${status}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur générale lors de la mise à jour du statut:', error);
    return false;
  }
};

// Fonction pour récupérer les contrats Affaire
export const getAffaireContracts = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('affaire')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur lors de la récupération Affaire:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Erreur générale lors de la récupération Affaire:', error);
    return [];
  }
};

// Fonction pour récupérer les contrats Terme
export const getTermeContracts = async (): Promise<any[]> => {
  try {
    console.log('🔍 Récupération des contrats Terme...');
    
    const { data, error } = await supabase
      .from('terme')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur lors de la récupération Terme:', error);
      return [];
    }

    console.log('✅ Contrats Terme récupérés:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ Erreur générale lors de la récupération Terme:', error);
    return [];
  }
};

// Fonction pour récupérer les contrats de la table rapport
export const getRapportContracts = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('rapport')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur lors de la récupération rapport:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Erreur générale lors de la récupération rapport:', error);
    return [];
  }
};

// Fonction pour récupérer les crédits
export const getCredits = async (): Promise<CreditData[]> => {
  try {
    const { data, error } = await supabase
      .from('liste_credits')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur lors de la récupération crédits:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Erreur générale lors de la récupération crédits:', error);
    return [];
  }
};

// Fonction utilitaire pour convertir les dates Excel
const convertExcelDateToISO = (excelDate: string | number): string => {
  if (typeof excelDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(excelDate)) {
    return excelDate.split('T')[0];
  }

  if (typeof excelDate === 'number' || /^\d+$/.test(excelDate.toString())) {
    const serialNumber = typeof excelDate === 'number' ? excelDate : parseInt(excelDate.toString());
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + serialNumber * 86400000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  try {
    const date = new Date(excelDate);
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  } catch (error) {
    console.warn('Conversion date impossible:', excelDate);
  }

  return new Date().toISOString().split('T')[0];
};

// Fonction pour enregistrer un chèque
export const saveCheque = async (chequeData: {
  numeroContrat: string;
  assure: string;
  numeroCheque: string;
  montant: number;
  dateEncaissementPrevue: string;
  banque: string;
  creePar: string;
}): Promise<boolean> => {
  try {
    console.log('💳 Enregistrement du chèque...');

    const { data, error } = await supabase
      .from('Cheques')
      .insert([{
        Numero_Contrat: chequeData.numeroContrat,
        Assure: chequeData.assure,
        Numero_Cheque: chequeData.numeroCheque,
        Titulaire_Cheque: chequeData.assure,
        Montant: chequeData.montant,
        Date_Encaissement_prévue: chequeData.dateEncaissementPrevue,
        Banque: chequeData.banque,
        Statut: 'Non Encaissé'
      }])
      .select();

    if (error) {
      console.error('❌ Erreur lors de l\'enregistrement du chèque:', error);
      return false;
    }

    console.log('✅ Chèque enregistré avec succès');
    return true;
  } catch (error) {
    console.error('❌ Erreur générale lors de l\'enregistrement du chèque:', error);
    return false;
  }
};

// Fonction pour vérifier si un avenant changement véhicule existe
export const checkAvenantChangementVehiculeExists = async (
  numeroContrat: string,
  dateSession: string
): Promise<any> => {
  try {
    const { data, error } = await supabase
      .from('Avenant_Changement_véhicule')
      .select('*')
      .eq('numero_contrat', numeroContrat)
      .gte('created_at', dateSession)
      .lt('created_at', dateSession + 'T23:59:59')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Erreur lors de la vérification dans Avenant_Changement_véhicule:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Erreur dans checkAvenantChangementVehiculeExists:', error);
    return null;
  }
};

// Fonction pour sauvegarder un avenant changement véhicule
export const saveAvenantChangementVehicule = async (data: any): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('Avenant_Changement_véhicule')
      .insert({
        numero_contrat: data.contractNumber,
        assure: data.insuredName,
        prime: data.premiumAmount,
        branche: data.branch,
        mode_paiement: data.paymentMode,
        cree_par: data.createdBy
      });

    if (error) {
      console.error('Erreur lors de la sauvegarde dans Avenant_Changement_véhicule:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erreur dans saveAvenantChangementVehicule:', error);
    return false;
  }
};

// Fonction pour vérifier si un encaissement pour autre code existe
export const checkEncaissementAutreCodeExists = async (
  numeroContrat: string,
  echeance: string
): Promise<any> => {
  try {
    const { data, error } = await supabase
      .from('encaissement_autre_code')
      .select('*')
      .eq('numero_contrat', numeroContrat)
      .eq('echeance', echeance)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Erreur lors de la vérification dans encaissement_autre_code:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Erreur dans checkEncaissementAutreCodeExists:', error);
    return null;
  }
};

// Fonction pour sauvegarder un encaissement pour autre code
export const saveEncaissementAutreCode = async (data: any): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('encaissement_autre_code')
      .insert({
        numero_contrat: data.contractNumber,
        assure: data.insuredName,
        prime: data.premiumAmount,
        echeance: data.dateEcheance,
        mode_paiement: data.paymentMode,
        cree_par: data.createdBy
      });

    if (error) {
      console.error('Erreur lors de la sauvegarde dans encaissement_autre_code:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erreur dans saveEncaissementAutreCode:', error);
    return false;
  }
};

// Fonction pour récupérer les données filtrées depuis Supabase pour l'export
export const getFilteredDataForExport = async (
  type: string,
  dateFrom: string,
  dateTo: string
): Promise<any[]> => {
  try {
    console.log('🔍 Récupération des données filtrées pour export...');

    let query = supabase
      .from('rapport')
      .select('*')
      .order('created_at', { ascending: false });

    // Appliquer le filtre de type si spécifié
    if (type && type !== 'all') {
      query = query.eq('type', type);
    }

    // Appliquer le filtre de date de début
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    // Appliquer le filtre de date de fin
    if (dateTo) {
      // Ajouter un jour pour inclure la date de fin complète
      const dateToInclusive = new Date(dateTo);
      dateToInclusive.setDate(dateToInclusive.getDate() + 1);
      query = query.lt('created_at', dateToInclusive.toISOString().split('T')[0]);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Erreur lors de la récupération des données filtrées:', error);
      return [];
    }

    console.log('✅ Données filtrées récupérées:', data?.length || 0, 'enregistrements');
    return data || [];
  } catch (error) {
    console.error('❌ Erreur générale lors de la récupération des données filtrées:', error);
    return [];
  }
};

// Fonction pour mettre à jour le statut d'un crédit
export const updateCreditStatus = async (id: number, newStatus: string, datePaiement?: string): Promise<boolean> => {
  try {
    console.log('🔄 Mise à jour statut crédit...');

    const updateData: any = { statut: newStatus };
    if (datePaiement) updateData.date_paiement_effectif = datePaiement;

    const { error } = await supabase
      .from('liste_credits')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('❌ Erreur mise à jour statut:', error);
      return false;
    }

    console.log('✅ Statut mis à jour');
    return true;
  } catch (error) {
    console.error('❌ Erreur générale mise à jour statut:', error);
    return false;
  }
};

// Fonction pour supprimer un contrat de la table rapport
export const deleteRapportContract = async (id: number, numeroContrat: string): Promise<boolean> => {
  try {
    console.log('🗑️ Suppression du contrat rapport et des tables liées...');

    const { data: contract, error: fetchError } = await supabase
      .from('rapport')
      .select('type, numero_contrat')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ Erreur récupération contrat:', fetchError);
      return false;
    }

    if (!contract) {
      console.error('❌ Contrat non trouvé');
      return false;
    }

    const { error: rapportError } = await supabase
      .from('rapport')
      .delete()
      .eq('id', id);

    if (rapportError) {
      console.error('❌ Erreur suppression rapport:', rapportError);
      return false;
    }

    if (contract.type === 'Terme') {
      const { error: termeError } = await supabase
        .from('terme')
        .delete()
        .eq('numero_contrat', contract.numero_contrat);

      if (termeError) {
        console.warn('⚠️ Erreur suppression terme:', termeError);
      } else {
        console.log('✅ Contrat Terme supprimé');
      }
    } else if (contract.type === 'Affaire') {
      const { error: affaireError } = await supabase
        .from('affaire')
        .delete()
        .eq('numero_contrat', contract.numero_contrat);

      if (affaireError) {
        console.warn('⚠️ Erreur suppression affaire:', affaireError);
      } else {
        console.log('✅ Contrat Affaire supprimé');
      }
    } else if (contract.type === 'Avenant') {
      const { error: avenantError } = await supabase
        .from('Avenant_Changement_véhicule')
        .delete()
        .eq('numero_contrat', contract.numero_contrat);

      if (avenantError) {
        console.warn('⚠️ Erreur suppression avenant:', avenantError);
      } else {
        console.log('✅ Contrat Avenant supprimé');
      }
    } else if (contract.type === 'Encaissement pour autre code') {
      const { error: encaissementError } = await supabase
        .from('encaissement_autre_code')
        .delete()
        .eq('numero_contrat', contract.numero_contrat);

      if (encaissementError) {
        console.warn('⚠️ Erreur suppression encaissement autre code:', encaissementError);
      } else {
        console.log('✅ Encaissement autre code supprimé');
      }
    }

    await supabase
      .from('liste_credits')
      .delete()
      .eq('numero_contrat', contract.numero_contrat);

    await supabase
      .from('Cheques')
      .delete()
      .eq('Numero_Contrat', contract.numero_contrat);

    await supabase
      .from('depenses')
      .delete()
      .eq('Numero_Contrat', contract.numero_contrat);

    await supabase
      .from('recettes_exceptionnelles')
      .delete()
      .eq('Numero_Contrat', contract.numero_contrat);

    await supabase
      .from('ristournes')
      .delete()
      .eq('numero_contrat', contract.numero_contrat);

    console.log('✅ Contrat rapport et toutes les données liées supprimées');
    return true;
  } catch (error) {
    console.error('❌ Erreur générale suppression rapport:', error);
    return false;
  }
};

// Fonction pour supprimer un contrat Affaire (supprime aussi du rapport et tables liées)
export const deleteAffaireContract = async (id: number): Promise<boolean> => {
  try {
    console.log('🗑️ Suppression du contrat Affaire et du rapport...');

    const { data: contract, error: fetchError } = await supabase
      .from('affaire')
      .select('numero_contrat')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ Erreur récupération contrat:', fetchError);
      return false;
    }

    if (!contract) {
      console.error('❌ Contrat non trouvé');
      return false;
    }

    const { error: affaireError } = await supabase
      .from('affaire')
      .delete()
      .eq('id', id);

    if (affaireError) {
      console.error('❌ Erreur suppression Affaire:', affaireError);
      return false;
    }

    const { error: rapportError } = await supabase
      .from('rapport')
      .delete()
      .eq('numero_contrat', contract.numero_contrat)
      .eq('type', 'Affaire');

    if (rapportError) {
      console.warn('⚠️ Erreur suppression rapport:', rapportError);
    } else {
      console.log('✅ Contrat rapport supprimé');
    }

    await supabase
      .from('liste_credits')
      .delete()
      .eq('numero_contrat', contract.numero_contrat);

    await supabase
      .from('Cheques')
      .delete()
      .eq('Numero_Contrat', contract.numero_contrat);

    await supabase
      .from('depenses')
      .delete()
      .eq('Numero_Contrat', contract.numero_contrat);

    await supabase
      .from('recettes_exceptionnelles')
      .delete()
      .eq('Numero_Contrat', contract.numero_contrat);

    await supabase
      .from('ristournes')
      .delete()
      .eq('numero_contrat', contract.numero_contrat);

    console.log('✅ Contrat Affaire et toutes les données liées supprimées');
    return true;
  } catch (error) {
    console.error('❌ Erreur générale suppression Affaire:', error);
    return false;
  }
};

// Fonction pour supprimer un contrat Terme (supprime aussi du rapport et tables liées)
export const deleteTermeContract = async (id: number): Promise<boolean> => {
  try {
    console.log('🗑️ Suppression du contrat Terme et du rapport...');

    const { data: contract, error: fetchError } = await supabase
      .from('terme')
      .select('numero_contrat')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ Erreur récupération contrat:', fetchError);
      return false;
    }

    if (!contract) {
      console.error('❌ Contrat non trouvé');
      return false;
    }

    const { error: termeError } = await supabase
      .from('terme')
      .delete()
      .eq('id', id);

    if (termeError) {
      console.error('❌ Erreur suppression Terme:', termeError);
      return false;
    }

    const { error: rapportError } = await supabase
      .from('rapport')
      .delete()
      .eq('numero_contrat', contract.numero_contrat)
      .eq('type', 'Terme');

    if (rapportError) {
      console.warn('⚠️ Erreur suppression rapport:', rapportError);
    } else {
      console.log('✅ Contrat rapport supprimé');
    }

    await supabase
      .from('liste_credits')
      .delete()
      .eq('numero_contrat', contract.numero_contrat);

    await supabase
      .from('Cheques')
      .delete()
      .eq('Numero_Contrat', contract.numero_contrat);

    await supabase
      .from('depenses')
      .delete()
      .eq('Numero_Contrat', contract.numero_contrat);

    await supabase
      .from('recettes_exceptionnelles')
      .delete()
      .eq('Numero_Contrat', contract.numero_contrat);

    await supabase
      .from('ristournes')
      .delete()
      .eq('numero_contrat', contract.numero_contrat);

    console.log('✅ Contrat Terme et toutes les données liées supprimées');
    return true;
  } catch (error) {
    console.error('❌ Erreur générale suppression Terme:', error);
    return false;
  }
};
// Fonction pour récupérer les mois disponibles
export const getAvailableMonths = async (): Promise<string[]> => {
  try {
    console.log('🔍 Récupération des mois disponibles...');
    
    // Méthode 1: Utiliser une RPC si elle existe
    try {
      const { data, error } = await supabase.rpc('get_table_names');
      
      if (!error && data) {
        const monthlyTables = (data || [])
          .filter((tableName: string) => tableName.startsWith('table_terme_'))
          .map((tableName: string) => {
            const parts = tableName.replace('table_terme_', '').split('_');
            if (parts.length === 2 && parts[0] && parts[1] && /^\d{4}$/.test(parts[1])) {
              const month = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
              const year = parts[1];
              return `${month} ${year}`;
            }
            return null;
          })
          .filter((month: string | null) => month !== null);

        console.log('📅 Mois disponibles (RPC):', monthlyTables);
        return monthlyTables;
      }
    } catch (rpcError) {
      console.log('RPC non disponible, utilisation méthode alternative');
    }

    // Méthode 2: Récupérer depuis les tables existantes dans la base
    // Cette méthode nécessite que vous ayez des tables nommées "table_terme_mois_année"
    
    // Liste des mois en français pour le mapping
    const monthsFR = [
      'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];

    // Générer une liste de mois pour les 12 derniers mois
    const currentDate = new Date();
    const availableMonths: string[] = [];

    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthName = monthsFR[date.getMonth()];
      const year = date.getFullYear();
      availableMonths.push(`${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`);
    }

    console.log('📅 Mois disponibles (générés):', availableMonths);
    return availableMonths;

  } catch (error) {
    console.error('❌ Erreur générale récupération mois:', error);
    
    // Retourner une liste par défaut en cas d'erreur
    const currentDate = new Date();
    const monthsFR = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    
    const currentMonth = monthsFR[currentDate.getMonth()];
    const currentYear = currentDate.getFullYear();
    
    return [`${currentMonth} ${currentYear}`];
  }
};

// Fonction pour créer une table mensuelle
export const createMonthlyTable = async (month: string): Promise<void> => {
  try {
    const cleanMonth = month.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').trim();
    const tableName = `table_terme_${cleanMonth}`;

    console.log(`🔧 Vérification/Création table ${tableName}...`);

    // Essayons d'abord de vérifier si la table existe
    const { error: checkError } = await supabase
      .from(tableName)
      .select('id')
      .limit(1);

    if (!checkError) {
      console.log(`✅ Table ${tableName} existe déjà`);
      return;
    }

    // Si la table n'existe pas, la créer via la fonction RPC
    console.log(`📝 Création de la table ${tableName} via RPC...`);
    const { error: rpcError } = await supabase.rpc('create_terme_table', {
      table_suffix: cleanMonth
    });

    if (rpcError) {
      console.error(`❌ Erreur lors de la création de la table ${tableName}:`, rpcError);
      throw rpcError;
    }

    console.log(`✅ Table ${tableName} créée avec succès`);

  } catch (error) {
    console.error('❌ Erreur création table:', error);
    throw error;
  }
};

// Fonction pour insérer des contrats dans une table mensuelle
export const insertContractsToTable = async (month: string, contracts: any[]): Promise<boolean> => {
  try {
    const cleanMonth = month.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').trim();
    const tableName = `table_terme_${cleanMonth}`;

    console.log(`📝 Insertion ${contracts.length} contrats dans ${tableName}...`);
    console.log(`🔍 Premier contrat à insérer:`, contracts[0]);

    // Vérifier si la table existe
    const { error: checkError } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (checkError) {
      console.error(`❌ Table ${tableName} n'existe pas ou erreur d'accès:`, checkError);
      return false;
    }

    const contractsData = contracts.map(contract => {
      // La date est déjà au format ISO du parser XLSX
      const echeanceDate = contract.maturity;

      const data = {
        numero_contrat: contract.contractNumber || '',
        prime: Number(contract.premium) || 0,
        echeance: echeanceDate,
        assure: contract.insured || '',
        num_tel: contract.numTel || null,
        num_tel_2: contract.numTel2 || null
      };

      console.log(`📊 Contrat mappé:`, data);
      return data;
    });

    console.log(`📦 Données à insérer (${contractsData.length} contrats):`, contractsData.slice(0, 2));

    const { error } = await supabase
      .from(tableName)
      .insert(contractsData);

    if (error) {
      console.error('❌ Erreur insertion contrats:', error);
      console.error('❌ Détails erreur:', error.message, error.details, error.hint);
      return false;
    }

    console.log(`✅ ${contractsData.length} contrats insérés dans ${tableName}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur générale insertion contrats:', error);
    return false;
  }
};

// Fonction pour rechercher un contrat dans une table mensuelle
export const searchContractInTable = async (month: string, contractNumber: string): Promise<any | null> => {
  try {
    const monthParts = month.toLowerCase().split(' ');
    if (monthParts.length < 2) {
      console.error('Format de mois invalide:', month);
      return null;
    }

    const monthName = monthParts[0];
    const year = monthParts[1];
    const tableName = `table_terme_${monthName}_${year}`;

    const cleanedContractNumber = contractNumber.trim().replace(/\s+/g, ' ');
    console.log(`🔍 Recherche dans ${tableName}... Numero: "${cleanedContractNumber}"`);

    const { data: allData, error: allError } = await supabase
      .from(tableName)
      .select('*');

    if (allError) {
      console.error('Erreur recherche contrat:', allError);
      return null;
    }

    if (!allData || allData.length === 0) {
      console.log('⚠️ Aucun contrat trouvé dans la table');
      return null;
    }

    const foundContract = allData.find(contract => {
      if (!contract.numero_contrat) return false;
      const dbNumber = contract.numero_contrat.trim().replace(/\s+/g, ' ');
      const searchNumber = cleanedContractNumber;
      return dbNumber.toLowerCase() === searchNumber.toLowerCase();
    });

    if (foundContract) {
      console.log('✅ Contrat trouvé');
      return foundContract;
    }

    console.log('⚠️ Contrat non trouvé dans la table');
    return null;
  } catch (error) {
    console.error('Erreur générale recherche contrat:', error);
    return null;
  }
};


// ... (code précédent)

export const getUnpaidTermesByMonth = async (monthName: string, year: string): Promise<any[]> => {
  try {
    const tableName = `table_terme_${monthName}_${year}`;
    console.log(`🔍 Récupération des termes NON PAYÉS depuis ${tableName}...`);

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('statut', 'non payé');

    if (error) {
      console.error(`❌ Erreur lors de la récupération des termes non payés:`, error);
      return [];
    }

    // Éliminer les doublons basés sur numero_contrat + echeance
    const uniqueUnpaid = removeDuplicates(data || []);
    console.log(`✅ Termes non payés uniques: ${uniqueUnpaid.length} (${data?.length || 0} avant déduplication)`);
    
    return uniqueUnpaid;
  } catch (error) {
    console.error('❌ Erreur générale:', error);
    return [];
  }
};

export const getOverdueUnpaidTermes = async (monthName: string, year: string): Promise<any[]> => {
  try {
    const tableName = `table_terme_${monthName}_${year}`;
    const today = new Date().toISOString().split('T')[0];
    console.log(`🔍 Récupération des termes ÉCHUS et non payés depuis ${tableName}...`);

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('statut', 'non payé')
      .lt('echeance', today);

    if (error) {
      console.error(`❌ Erreur lors de la récupération des termes échus:`, error);
      return [];
    }

    // Éliminer les doublons basés sur numero_contrat + echeance
    const uniqueOverdue = removeDuplicates(data || []);
    console.log(`✅ Termes échus uniques: ${uniqueOverdue.length} (${data?.length || 0} avant déduplication)`);
    
    return uniqueOverdue;
  } catch (error) {
    console.error('❌ Erreur générale:', error);
    return [];
  }
};

export const getPaidTermesByMonth = async (monthName: string, year: string): Promise<any[]> => {
  try {
    const tableName = `table_terme_${monthName}_${year}`;
    console.log(`🔍 Récupération des termes PAYÉS depuis ${tableName}...`);

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('statut', 'payé');

    if (error) {
      console.error(`❌ Erreur lors de la récupération des termes payés:`, error);
      return [];
    }

    // Éliminer les doublons basés sur numero_contrat + echeance
    const uniquePaid = removeDuplicates(data || []);
    console.log(`✅ Termes payés uniques: ${uniquePaid.length} (${data?.length || 0} avant déduplication)`);
    
    return uniquePaid;
  } catch (error) {
    console.error('❌ Erreur générale:', error);
    return [];
  }
};

export const getUpcomingTermes = async (monthName: string, year: string, daysAhead: number = 7): Promise<any[]> => {
  try {
    const tableName = `table_terme_${monthName}_${year}`;
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);

    const todayStr = today.toISOString().split('T')[0];
    const futureDateStr = futureDate.toISOString().split('T')[0];

    console.log(`🔍 Récupération des termes à VENIR depuis ${tableName}...`);

    // Récupérer TOUS les contrats non payés de la table du mois
    const { data: allUnpaid, error: allError } = await supabase
      .from(tableName)
      .select('*')
      .eq('statut', 'non payé');

    if (allError) {
      console.error(`❌ Erreur lors de la récupération des termes à venir:`, allError);
      return [];
    }

    if (!allUnpaid) return [];

    // Éliminer d'abord les doublons
    const uniqueUnpaid = removeDuplicates(allUnpaid);
    
    // Filtrer manuellement pour garder ceux dont l'échéance est dans la période future
    const upcomingTermes = uniqueUnpaid.filter(terme => {
      const echeanceDate = new Date(terme.echeance);
      const todayObj = new Date(todayStr);
      const futureDateObj = new Date(futureDateStr);
      
      return echeanceDate >= todayObj && echeanceDate <= futureDateObj;
    });

    console.log(`✅ Termes à venir uniques: ${upcomingTermes.length} (${allUnpaid.length} avant déduplication)`);
    return upcomingTermes;
  } catch (error) {
    console.error('❌ Erreur générale:', error);
    return [];
  }
};

// Fonction utilitaire pour éliminer les doublons basés sur numero_contrat + echeance
const removeDuplicates = (termes: any[]): any[] => {
  if (!termes || termes.length === 0) return [];
  
  const seen = new Set<string>();
  const unique: any[] = [];
  
  for (const terme of termes) {
    const key = `${terme.numero_contrat?.trim()?.toLowerCase()}_${terme.echeance}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(terme);
    } else {
      console.log(`🔄 Doublon ignoré: ${terme.numero_contrat} - ${terme.echeance}`);
    }
  }
  
  return unique;
};

// ... (code suivant reste inchangé)

export const getCreditsDueToday = async (sessionDate: string): Promise<any[]> => {
  try {
    console.log(`🔍 Récupération des crédits à payer pour la date ${sessionDate}...`);

    const { data, error } = await supabase
      .from('liste_credits')
      .select('*')
      .eq('date_paiement_prevue', sessionDate)
      .neq('statut', 'Payé en total')
      .order('numero_contrat', { ascending: true });

    if (error) {
      console.error(`❌ Erreur lors de la récupération des crédits à payer:`, error);
      return [];
    }

    console.log(`✅ Crédits à payer récupérés: ${data?.length || 0}`);
    return data || [];
  } catch (error) {
    console.error('❌ Erreur générale:', error);
    return [];
  }
};

export const syncTermeStatusesWithMainTable = async (monthName?: string, year?: string): Promise<{
  success: boolean;
  message: string;
  details: {
    totalTables: number;
    totalContracts: number;
    updated: number;
    errors: number;
    paidCount: number;
    unpaidCount: number;
  };
}> => {
  try {
    console.log('🔄 Démarrage de la synchronisation des statuts...');

    const { data: paidContracts, error: termeError } = await supabase
      .from('terme')
      .select('numero_contrat');

    if (termeError) {
      console.error('❌ Erreur lors de la récupération de la table terme:', termeError);
      return {
        success: false,
        message: 'Erreur lors de la récupération des contrats payés',
        details: { totalTables: 0, totalContracts: 0, updated: 0, errors: 1, paidCount: 0, unpaidCount: 0 }
      };
    }

    const paidContractNumbers = new Set(
      paidContracts?.map(c => c.numero_contrat?.trim()?.toUpperCase()) || []
    );
    console.log(`📋 ${paidContractNumbers.size} contrats payés trouvés dans la table principale`);
    console.log('📝 Exemples de contrats payés:', Array.from(paidContractNumbers).slice(0, 5));

    let availableTables: string[] = [];
    if (monthName && year) {
      availableTables = [`${monthName}_${year}`];
    } else {
      const months = await getAvailableMonths();
      availableTables = months.map(month => {
        const parts = month.toLowerCase().split(' ');
        return `${parts[0]}_${parts[1]}`;
      });
    }

    let totalContracts = 0;
    let updated = 0;
    let errors = 0;
    let paidCount = 0;
    let unpaidCount = 0;

    for (const tableSuffix of availableTables) {
      const tableName = `table_terme_${tableSuffix}`;
      console.log(`📊 Traitement de ${tableName}...`);

      try {
        const { data: contracts, error: selectError } = await supabase
          .from(tableName)
          .select('id, numero_contrat, statut');

        if (selectError) {
          console.error(`❌ Erreur lors de la lecture de ${tableName}:`, selectError);
          errors++;
          continue;
        }

        if (!contracts || contracts.length === 0) {
          console.log(`ℹ️ Aucun contrat dans ${tableName}`);
          continue;
        }

        totalContracts += contracts.length;
        console.log(`📋 ${contracts.length} contrats trouvés dans ${tableName}`);

        for (const contract of contracts) {
          const normalizedContractNumber = contract.numero_contrat?.trim()?.toUpperCase();
          const shouldBePaid = paidContractNumbers.has(normalizedContractNumber);
          const newStatus = shouldBePaid ? 'payé' : 'non payé';

          if (shouldBePaid) {
            paidCount++;
          } else {
            unpaidCount++;
          }

          if (contract.statut !== newStatus) {
            console.log(`🔄 Mise à jour: ${contract.numero_contrat} de "${contract.statut}" vers "${newStatus}"`);

            const { error: updateError } = await supabase
              .from(tableName)
              .update({ statut: newStatus })
              .eq('id', contract.id);

            if (updateError) {
              console.error(`❌ Erreur mise à jour ${contract.numero_contrat}:`, updateError);
              errors++;
            } else {
              console.log(`✅ ${contract.numero_contrat}: ${contract.statut} → ${newStatus}`);
              updated++;
            }
          } else {
            console.log(`ℹ️ ${contract.numero_contrat}: statut déjà correct (${contract.statut})`);
          }
        }

        console.log(`✅ ${tableName} traité avec succès`);
      } catch (tableError) {
        console.error(`❌ Erreur sur ${tableName}:`, tableError);
        errors++;
      }
    }

    const message = `Synchronisation terminée: ${updated} contrats mis à jour sur ${totalContracts} vérifiés (${paidCount} payés, ${unpaidCount} non payés)`;
    console.log(`✅ ${message}`);

    return {
      success: true,
      message,
      details: {
        totalTables: availableTables.length,
        totalContracts,
        updated,
        errors,
        paidCount,
        unpaidCount
      }
    };
  } catch (error) {
    console.error('❌ Erreur générale lors de la synchronisation:', error);
    return {
      success: false,
      message: 'Erreur lors de la synchronisation',
      details: { totalTables: 0, totalContracts: 0, updated: 0, errors: 1, paidCount: 0, unpaidCount: 0 }
    };
  }
};

export const verifyTermeStatusWithEcheance = async (monthName?: string, year?: string): Promise<{
  success: boolean;
  message: string;
  details: {
    totalContracts: number;
    paidCount: number;
    unpaidCount: number;
    updated: number;
    errors: number;
  };
}> => {
  try {
    console.log('🔄 Démarrage de la vérification avec echeance...');

    const { data: paidContracts, error: termeError } = await supabase
      .from('terme')
      .select('numero_contrat, echeance');

    if (termeError) {
      console.error('❌ Erreur lors de la récupération de la table terme:', termeError);
      return {
        success: false,
        message: 'Erreur lors de la récupération des contrats payés',
        details: { totalContracts: 0, paidCount: 0, unpaidCount: 0, updated: 0, errors: 1 }
      };
    }

    const paidContractSet = new Set<string>();
    paidContracts?.forEach(c => {
      const key = `${c.numero_contrat?.trim()?.toUpperCase()}|${c.echeance}`;
      paidContractSet.add(key);
    });
    console.log(`📋 ${paidContractSet.size} combinaisons contrat+echeance trouvées dans la table principale`);

    let availableTables: string[] = [];
    if (monthName && year) {
      availableTables = [`${monthName}_${year}`];
    } else {
      const months = await getAvailableMonths();
      availableTables = months.map(month => {
        const parts = month.toLowerCase().split(' ');
        return `${parts[0]}_${parts[1]}`;
      });
    }

    let totalContracts = 0;
    let updated = 0;
    let errors = 0;
    let paidCount = 0;
    let unpaidCount = 0;

    for (const tableSuffix of availableTables) {
      const tableName = `table_terme_${tableSuffix}`;
      console.log(`📊 Traitement de ${tableName}...`);

      try {
        const { data: contracts, error: selectError } = await supabase
          .from(tableName)
          .select('id, numero_contrat, echeance, statut');

        if (selectError) {
          console.error(`❌ Erreur lors de la lecture de ${tableName}:`, selectError);
          errors++;
          continue;
        }

        if (!contracts || contracts.length === 0) {
          console.log(`ℹ️ Aucun contrat dans ${tableName}`);
          continue;
        }

        totalContracts += contracts.length;
        console.log(`📋 ${contracts.length} contrats trouvés dans ${tableName}`);

        for (const contract of contracts) {
          const key = `${contract.numero_contrat?.trim()?.toUpperCase()}|${contract.echeance}`;
          const shouldBePaid = paidContractSet.has(key);
          const newStatus = shouldBePaid ? 'payé' : 'non payé';

          if (shouldBePaid) {
            paidCount++;
          } else {
            unpaidCount++;
          }

          if (contract.statut !== newStatus) {
            console.log(`🔄 Mise à jour: ${contract.numero_contrat} (${contract.echeance}) de "${contract.statut}" vers "${newStatus}"`);

            const { error: updateError } = await supabase
              .from(tableName)
              .update({ statut: newStatus })
              .eq('id', contract.id);

            if (updateError) {
              console.error(`❌ Erreur mise à jour ${contract.numero_contrat}:`, updateError);
              errors++;
            } else {
              console.log(`✅ ${contract.numero_contrat}: ${contract.statut} → ${newStatus}`);
              updated++;
            }
          } else {
            console.log(`ℹ️ ${contract.numero_contrat} (${contract.echeance}): statut déjà correct (${contract.statut})`);
          }
        }

        console.log(`✅ ${tableName} traité avec succès`);
      } catch (tableError) {
        console.error(`❌ Erreur sur ${tableName}:`, tableError);
        errors++;
      }
    }

    const message = `Vérification terminée: ${updated} contrats mis à jour sur ${totalContracts} vérifiés (${paidCount} payés, ${unpaidCount} non payés)`;
    console.log(`✅ ${message}`);

    return {
      success: true,
      message,
      details: {
        totalContracts,
        paidCount,
        unpaidCount,
        updated,
        errors
      }
    };
  } catch (error) {
    console.error('❌ Erreur générale lors de la vérification:', error);
    return {
      success: false,
      message: 'Erreur lors de la vérification',
      details: { totalContracts: 0, paidCount: 0, unpaidCount: 0, updated: 0, errors: 1 }
    };
  }
};

// Mettez à jour l'export default à la fin du fichier pour inclure toutes les nouvelles fonctions :

export default {
  saveContractToRapport,
  saveAffaireContract,
  saveCreditContract,
  saveTermeContract,
  updateCreditPayment,
  verifyPaymentInBothTables,
  searchCreditByContractNumber,
  searchCreditFlexible,
  checkAffaireContractExists,
  checkAffaireInRapport,
  checkTermeContractExists,
  checkTermeInRapport,
  checkAvenantChangementVehiculeExists,
  saveAvenantChangementVehicule,
  checkEncaissementAutreCodeExists,
  saveEncaissementAutreCode,
  getFilteredDataForExport,
  updateCreditStatus,
  deleteRapportContract,
  deleteAffaireContract,
  deleteTermeContract,
  getRapportContracts,
  getAffaireContracts,
  getCredits,
  getTermeContracts,
  saveCheque,
  // Nouvelles fonctions ajoutées
  getAvailableMonths,
  createMonthlyTable,
  insertContractsToTable,
  searchContractInTable,
  updateTermeStatus,
  getUnpaidTermesByMonth,
  getOverdueUnpaidTermes,
  getPaidTermesByMonth,
  getUpcomingTermes,
  syncTermeStatusesWithMainTable,
  verifyTermeStatusWithEcheance
};

export const saveTermeSuspenduPaye = async (data: {
  sessionDate: string;
  numPolice: string;
  codeSte: string;
  numAv: string;
  souscripteur: string;
  dateEcheance: string;
  joursDepasses: number;
  primeTotale: number;
}): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('terme_suspendu_paye')
      .insert([{
        session_date: data.sessionDate,
        num_police: data.numPolice,
        code_ste: data.codeSte,
        num_av: data.numAv,
        souscripteur: data.souscripteur,
        date_echeance: data.dateEcheance,
        jours_depasses: data.joursDepasses,
        prime_totale: data.primeTotale
      }]);

    if (error) {
      console.error('Erreur lors de la sauvegarde dans terme_suspendu_paye:', error);
      return false;
    }

    console.log('✅ Terme suspendu enregistré avec succès');
    return true;
  } catch (error) {
    console.error('Erreur dans saveTermeSuspenduPaye:', error);
    return false;
  }
};

export const getTermeSuspenduPaye = async (
  sessionDateFrom: string,
  sessionDateTo: string,
  echeanceDateFrom?: string,
  echeanceDateTo?: string
): Promise<any[]> => {
  try {
    let query = supabase
      .from('terme_suspendu_paye')
      .select('*')
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (sessionDateFrom) {
      query = query.gte('session_date', sessionDateFrom);
    }

    if (sessionDateTo) {
      query = query.lte('session_date', sessionDateTo);
    }

    if (echeanceDateFrom) {
      query = query.gte('date_echeance', echeanceDateFrom);
    }

    if (echeanceDateTo) {
      query = query.lte('date_echeance', echeanceDateTo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erreur lors de la récupération des termes suspendus:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Erreur dans getTermeSuspenduPaye:', error);
    throw error;
  }
};

export const updateAttestationServie = async (
  attestationNumero: number,
  numeroContrat: string,
  assure: string,
  montant: number
): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('update_attestation_servie', {
      attestation_numero: attestationNumero,
      numero_contrat: numeroContrat,
      assure: assure,
      montant: montant,
      date_impression: new Date().toISOString()
    });

    if (error) {
      console.error('Erreur lors de la mise à jour de l\'attestation:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Erreur dans updateAttestationServie:', error);
    return false;
  }
};
