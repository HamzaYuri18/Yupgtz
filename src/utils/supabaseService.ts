import { supabase } from '../lib/supabase';

// Fonction pour sauvegarder un contrat dans la table rapport (AVEC NOUVELLE LOGIQUE)
export const saveContractToRapport = async (contractData: any): Promise<boolean> => {
  try {
    console.log('📊 Sauvegarde du contrat dans la table rapport...');
    console.log('🔍 Données reçues:');
    console.log('  - Type:', contractData.type);
    console.log('  - Branche:', contractData.branch);
    console.log('  - Type paiement:', contractData.paymentType);
    console.log('  - Prime:', contractData.premiumAmount);
    console.log('  - Crédit:', contractData.creditAmount);

    // Convertir et valider la prime
    const primeValue = Number(contractData.premiumAmount);
    if (isNaN(primeValue) || primeValue <= 0) {
      console.error('❌ Montant de prime invalide:', contractData.premiumAmount);
      return false;
    }

    console.log('✅ Prime validée:', primeValue);

    // Gérer le montant crédit
    let montantCreditValue = null;
    if (contractData.paymentType === 'Crédit') {
      montantCreditValue = contractData.creditAmount ? Number(contractData.creditAmount) : primeValue;
      
      // Validation du crédit
      if (montantCreditValue > primeValue) {
        console.warn('⚠️ Crédit supérieur à la prime, ajustement automatique');
        montantCreditValue = primeValue;
      }
      
      console.log('💰 Montant crédit calculé:', montantCreditValue);
    }

    // Mapper les types de contrat pour la table rapport
    let rapportType = contractData.type;
    if (contractData.type === 'Avenant changement de véhicule') {
      rapportType = 'Avenant';
    }

    // Préparer les données avec la nouvelle logique
    const insertData = {
      // Colonnes principales
      type: rapportType || null,
      branche: contractData.branch || null,
      numero_contrat: contractData.contractNumber || '',
      prime: primeValue, // ✅ TOUJOURS LE MONTANT COMPLET DE LA PRIME
      montant: primeValue, // ✅ INITIALISÉ À LA PRIME (le trigger garantit montant = prime)
      assure: contractData.insuredName || '',
      mode_paiement: contractData.paymentMode || null,
      type_paiement: contractData.paymentType || null,
      cree_par: contractData.createdBy || '',
      
      // Colonnes crédit
      montant_credit: montantCreditValue,
      date_paiement_prevue: contractData.paymentType === 'Crédit' ? contractData.paymentDate : null,
      
      // Échéance pour les contrats Terme
      echeance: contractData.type === 'Terme' && contractData.xmlData?.maturity ? 
        convertExcelDateToISO(contractData.xmlData.maturity) : null,
      
      // Toutes les autres colonnes à NULL
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

    console.log('📋 Données finales à insérer:');
    console.log('  - prime:', insertData.prime);
    console.log('  - montant:', insertData.montant);
    console.log('  - montant_credit:', insertData.montant_credit);
    console.log('  - type_paiement:', insertData.type_paiement);

    const { data, error } = await supabase
      .from('rapport')
      .insert([insertData])
      .select();

    if (error) {
      console.error('❌ Erreur lors de la sauvegarde dans rapport:', error);
      console.error('Détails:', error.details);
      return false;
    }

    console.log('✅ Contrat sauvegardé dans rapport avec succès');
    if (data && data.length > 0) {
      console.log('📊 Données confirmées par Supabase:');
      console.log('  - prime:', data[0].prime);
      console.log('  - montant:', data[0].montant);
      console.log('  - montant_credit:', data[0].montant_credit);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erreur générale lors de la sauvegarde dans rapport:', error);
    return false;
  }
};

// Fonction pour sauvegarder un contrat Affaire
export const saveAffaireContract = async (contractData: any): Promise<boolean> => {
  try {
    console.log('💾 Sauvegarde du contrat Affaire...');

    const primeValue = Number(contractData.premiumAmount);
    if (isNaN(primeValue) || primeValue <= 0) {
      console.error('❌ Montant de prime invalide:', contractData.premiumAmount);
      return false;
    }

    // Gérer le crédit pour Affaire
    let montantCreditValue = null;
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
        cree_par: contractData.createdBy
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

// Fonction pour sauvegarder un crédit
export const saveCreditContract = async (contractData: any): Promise<boolean> => {
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
        statut: 'Non payé'
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

// Fonction pour sauvegarder un contrat Terme
export const saveTermeContract = async (
  contractData: any,
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

    // Ajouter les informations de retour si applicable
    if (retourType) {
      insertData.Retour = retourType;
      if (originalPrimeAmount) {
        insertData['Prime avant retour'] = originalPrimeAmount;
      }
      console.log(`🔄 Retour ${retourType} détecté - Prime avant retour: ${originalPrimeAmount}, Prime actuelle: ${primeValue}`);
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
    return true;
  } catch (error) {
    console.error('❌ Erreur générale lors de la sauvegarde Terme:', error);
    return false;
  }
};

// FONCTIONS DE RÉCUPÉRATION

// Fonction pour récupérer les contrats de la table rapport
export const getRapportContracts = async (): Promise<any[]> => {
  try {
    console.log('🔍 Récupération des contrats rapport...');
    
    const { data, error } = await supabase
      .from('rapport')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur lors de la récupération rapport:', error);
      return [];
    }

    console.log('✅ Contrats rapport récupérés:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ Erreur générale lors de la récupération rapport:', error);
    return [];
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

// Fonction pour récupérer les crédits
export const getCredits = async (): Promise<any[]> => {
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

// FONCTIONS DE RECHERCHE ET VÉRIFICATION

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

// Fonction pour vérifier si un contrat Affaire existe déjà dans la table Affaire
export const checkAffaireContractExists = async (numeroContrat: string, datePaiement: string): Promise<any | null> => {
  try {
    console.log('🔍 Vérification existence contrat Affaire dans table Affaire...');
    console.log('  - Numéro:', numeroContrat);
    console.log('  - Date paiement:', datePaiement);

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
    console.log('  - Numéro:', numeroContrat);
    console.log('  - Date paiement:', datePaiement);

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
    
    console.log(`🔍 Recherche dans ${tableName}...`);
    
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('numero_contrat', contractNumber)
      .single();

    if (error) {
      console.error('Erreur recherche contrat:', error);
      return null;
    }

    console.log('✅ Contrat trouvé');
    return data;
  } catch (error) {
    console.error('Erreur générale recherche contrat:', error);
    return null;
  }
};

// Fonction pour récupérer les mois disponibles
export const getAvailableMonths = async (): Promise<string[]> => {
  try {
    console.log('🔍 Récupération des mois disponibles...');
    
    const { data, error } = await supabase.rpc('get_table_names');
    
    if (error) {
      console.error('❌ Erreur RPC get_table_names:', error);
      return [];
    }

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

    console.log('📅 Mois disponibles:', monthlyTables);
    return monthlyTables;
  } catch (error) {
    console.error('❌ Erreur générale récupération mois:', error);
    return [];
  }
};

// FONCTIONS DE MISE À JOUR

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

// Fonction pour mettre à jour le paiement d'un crédit
export const updateCreditPayment = async (
  id: number,
  montantPaiement: number,
  assure: string,
  modePaiement: 'Espece' | 'Cheque' | 'Carte Bancaire',
  numeroContrat?: string,
  chequeData?: {
    numeroCheque: string;
    banque: string;
    dateEncaissementPrevue: string;
  }
): Promise<boolean> => {
  try {
    console.log('💳 Mise à jour paiement crédit...');

    // 1. Récupérer le crédit actuel pour calculer le nouveau solde et statut
    const { data: creditActuel, error: fetchError } = await supabase
      .from('liste_credits')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !creditActuel) {
      console.error('❌ Erreur récupération crédit:', fetchError);
      return false;
    }

    // 2. Calculer le nouveau paiement total et le nouveau solde
    const nouveauPaiementTotal = (creditActuel.paiement || 0) + montantPaiement;
    const nouveauSolde = (creditActuel.solde || 0) - montantPaiement;

    // 3. Déterminer le nouveau statut
    let nouveauStatut = '';
    if (nouveauSolde === 0) {
      nouveauStatut = 'Payé en total';
    } else if (nouveauSolde > 0) {
      nouveauStatut = 'Payé partiellement';
    } else {
      nouveauStatut = 'Payé';
    }

    // 4. Mettre à jour le crédit dans liste_credits
    const { error: updateError } = await supabase
      .from('liste_credits')
      .update({
        paiement: nouveauPaiementTotal,
        solde: nouveauSolde,
        date_paiement_effectif: new Date().toISOString().split('T')[0],
        statut: nouveauStatut
      })
      .eq('id', id);

    if (updateError) {
      console.error('❌ Erreur mise à jour crédit:', updateError);
      return false;
    }

    // 5. Enregistrer le paiement dans la table rapport
    const datePaiement = new Date().toISOString().split('T')[0];

    const { error: rapportError } = await supabase
      .from('rapport')
      .insert([{
        type: 'Paiement Crédit',
        branche: creditActuel.branche || 'Auto',
        numero_contrat: creditActuel.numero_contrat,
        prime: montantPaiement,
      
        assure: assure,
        mode_paiement: modePaiement,
        type_paiement: 'Au comptant',
        cree_par: 'Système',
        created_at: datePaiement,
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
        montant_credit: null
      }]);

    if (rapportError) {
      console.error('⚠️ Erreur enregistrement dans rapport (paiement crédit ok):', rapportError);
      // On ne retourne pas false ici car le paiement a été enregistré avec succès
    } else {
      console.log('✅ Paiement enregistré dans rapport');
    }

    // 6. Si paiement par chèque, enregistrer dans la table Cheques
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

    console.log('✅ Paiement crédit traité avec succès');
    return true;
  } catch (error) {
    console.error('❌ Erreur générale mise à jour paiement:', error);
    return false;
  }
};

// FONCTIONS DE SUPPRESSION

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
    }

    console.log('✅ Contrat rapport supprimé');
    return true;
  } catch (error) {
    console.error('❌ Erreur générale suppression rapport:', error);
    return false;
  }
};

// Fonction pour supprimer un contrat Affaire (supprime aussi du rapport)
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

    console.log('✅ Contrat Affaire supprimé');
    return true;
  } catch (error) {
    console.error('❌ Erreur générale suppression Affaire:', error);
    return false;
  }
};

// Fonction pour supprimer un contrat Terme (supprime aussi du rapport)
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

    console.log('✅ Contrat Terme supprimé');
    return true;
  } catch (error) {
    console.error('❌ Erreur générale suppression Terme:', error);
    return false;
  }
};

// FONCTIONS UTILITAIRES

// Fonction pour créer une table mensuelle
export const createMonthlyTable = async (month: string): Promise<void> => {
  try {
    const cleanMonth = month.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').trim();
    const tableName = `table_terme_${cleanMonth}`;
    
    console.log(`🔧 Création table ${tableName}...`);
    
    const { data, error } = await supabase.rpc('create_monthly_table', {
      p_table_name: tableName
    });

    if (error) throw error;
    
    console.log(`✅ Table créée: ${tableName}`);
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
    
    const contractsData = contracts.map(contract => ({
      numero_contrat: contract.contractNumber,
      prime: contract.premium || 0,
      echeance: convertExcelDateToISO(contract.maturity),
      assure: contract.insured
    }));

    const { error } = await supabase
      .from(tableName)
      .insert(contractsData);

    if (error) {
      console.error('❌ Erreur insertion contrats:', error);
      return false;
    }

    console.log(`✅ Contrats insérés dans ${tableName}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur générale insertion contrats:', error);
    return false;
  }
};

// Fonction pour rechercher un crédit par numéro de contrat
export const searchCreditByContractNumber = async (contractNumber: string): Promise<any | null> => {
  try {
    const { data, error } = await supabase
      .from('liste_credits')
      .select('*')
      .eq('numero_contrat', contractNumber)
      .single();

    if (error) return null;
    return data;
  } catch (error) {
    console.error('Erreur recherche crédit:', error);
    return null;
  }
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
    console.log('Données du chèque:', chequeData);

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
      console.error('Détails de l\'erreur:', error.message, error.details);
      return false;
    }

    console.log('✅ Chèque enregistré avec succès');
    console.log('Données insérées:', data);
    return true;
  } catch (error) {
    console.error('❌ Erreur générale lors de l\'enregistrement du chèque:', error);
    return false;
  }
};

// Fonction utilitaire pour convertir les dates Excel
const convertExcelDateToISO = (excelDate: string | number): string => {
  if (typeof excelDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(excelDate)) {
    return excelDate;
  }
  
  if (typeof excelDate === 'number' || /^\d+$/.test(excelDate.toString())) {
    const serialNumber = typeof excelDate === 'number' ? excelDate : parseInt(excelDate.toString());
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (serialNumber - 2) * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  try {
    const date = new Date(excelDate);
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  } catch (error) {
    console.warn('Conversion date impossible:', excelDate);
  }
  
  return new Date().toISOString().split('T')[0];
};

// Fonction pour récupérer les données filtrées depuis Supabase pour l'export
export const getFilteredDataForExport = async (
  type: string,
  dateFrom: string,
  dateTo: string
): Promise<any[]> => {
  try {
    console.log('🔍 Récupération des données filtrées pour export...');
    console.log('Filtres:', { type, dateFrom, dateTo });

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

// Vérifier si un encaissement pour autre code existe
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

// Sauvegarder un encaissement pour autre code
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

// Vérifier si un avenant changement véhicule existe
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

// Sauvegarder un avenant changement véhicule
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

export default {
  saveContractToRapport,
  saveAffaireContract,
  saveCreditContract,
  saveTermeContract,
  getRapportContracts,
  getAffaireContracts,
  getCredits,
  getTermeContracts,
  checkTermeContractExists,
  searchContractInTable,
  getAvailableMonths,
  updateCreditStatus,
  updateCreditPayment,
  deleteRapportContract,
  deleteAffaireContract,
  deleteTermeContract,
  createMonthlyTable,
  insertContractsToTable,
  searchCreditByContractNumber,
  getFilteredDataForExport,
  saveCheque,
  checkEncaissementAutreCodeExists,
  saveEncaissementAutreCode,
  checkAvenantChangementVehiculeExists,
  saveAvenantChangementVehicule
};
