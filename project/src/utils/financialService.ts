import { supabase } from '../lib/supabase';

// Types pour les données financières
export interface Depense {
  id?: number;
  type_depense: string;
  montant: number;
  date_depense?: string;
  cree_par: string;
  created_at?: string;
  Numero_Contrat?: string;
  Client?: string;
  libelle?: string;
  date_recuperation_prevue?: string;
  statut_depense?: string | null;
  type_paiement?: string;
}

export interface RecetteExceptionnelle {
  id?: number;
  type_recette: string;
  montant: number;
  date_recette?: string;
  cree_par: string;
  created_at?: string;
  Numero_Contrat?: string;
  Echeance?: string;
  Assure?: string;
  id_depense?: number;
  libelle?: string;
}

export interface Ristourne {
  id?: number;
  numero_contrat: string;
  client: string;
  montant_ristourne: number;
  date_ristourne?: string;
  date_paiement_ristourne?: string;
  type_paiement?: 'Espece' | 'Cheque' | 'Banque';
  type_ristourne?: 'BNS' | 'Ristourne';
  cree_par: string;
  created_at?: string;
}

export interface Sinistre {
  id?: number;
  numero_sinistre: string;
  montant: number;
  client: string;
  date_sinistre?: string;
  date_paiement_sinistre?: string;
  type_paiement?: string;
  cree_par: string;
  created_at?: string;
}

// ===== FONCTIONS POUR LES DÉPENSES =====

export const saveDepense = async (depense: Depense): Promise<boolean> => {
  try {
    console.log('💰 Sauvegarde de la dépense:', depense);

    const insertData: any = {
      type_depense: depense.type_depense,
      montant: depense.montant,
      date_depense: depense.date_depense || new Date().toISOString().split('T')[0],
      cree_par: depense.cree_par
    };

    if (depense.Numero_Contrat) {
      insertData.Numero_Contrat = depense.Numero_Contrat;
    }
    if (depense.Client) {
      insertData.Client = depense.Client;
    }
    if (depense.libelle) {
      insertData.libelle = depense.libelle;
    }
    if (depense.date_recuperation_prevue) {
      insertData.date_recuperation_prevue = depense.date_recuperation_prevue;
    }
    if (depense.type_paiement) {
      insertData.type_paiement = depense.type_paiement;
    }

    const { data, error } = await supabase
      .from('depenses')
      .insert([insertData])
      .select();

    if (error) {
      console.error('❌ Erreur lors de la sauvegarde de la dépense:', error);
      return false;
    }

    console.log('✅ Dépense sauvegardée avec succès:', data);
    
    // Sauvegarder aussi dans la table rapport
    try {
      await saveToRapport({
        type: 'Dépense',
        branche: 'Financier',
        numero_contrat: `DEP-${data[0].id}`,
        montant: -Math.abs(depense.montant), // Négatif pour les dépenses
        assure: depense.type_depense,
        mode_paiement: depense.type_paiement === 'Cheque' ? 'Cheque' : 'Espece',
        type_paiement: 'Au comptant',
        cree_par: depense.cree_par
      }, {
        date_depense: depense.date_depense,
        type_depense: depense.type_depense
      });
    } catch (rapportError) {
      console.error('⚠️ Erreur lors de la sauvegarde dans rapport:', rapportError);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erreur générale lors de la sauvegarde de la dépense:', error);
    return false;
  }
};

export const getDepenses = async (): Promise<Depense[]> => {
  try {
    const { data, error } = await supabase
      .from('depenses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur lors de la récupération des dépenses:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Erreur générale lors de la récupération des dépenses:', error);
    return [];
  }
};

// ===== FONCTIONS POUR LES RECETTES EXCEPTIONNELLES =====

export const saveRecetteExceptionnelle = async (recette: RecetteExceptionnelle): Promise<boolean> => {
  try {
    console.log('💵 Sauvegarde de la recette exceptionnelle:', recette);

    const insertData: any = {
      type_recette: recette.type_recette,
      montant: recette.montant,
      date_recette: recette.date_recette || new Date().toISOString().split('T')[0],
      cree_par: recette.cree_par
    };

    if (recette.Numero_Contrat) {
      insertData.Numero_Contrat = recette.Numero_Contrat;
    }
    if (recette.Echeance) {
      insertData.Echeance = recette.Echeance;
    }
    if (recette.Assure) {
      insertData.Assure = recette.Assure;
    }
    if (recette.id_depense) {
      insertData.id_depense = recette.id_depense;
    }
    if (recette.libelle) {
      insertData.libelle = recette.libelle;
    }

    const { data, error } = await supabase
      .from('recettes_exceptionnelles')
      .insert([insertData])
      .select();

    if (error) {
      console.error('❌ Erreur lors de la sauvegarde de la recette:', error);
      return false;
    }

    console.log('✅ Recette exceptionnelle sauvegardée avec succès:', data);
    
    // Sauvegarder aussi dans la table rapport
    try {
      await saveToRapport({
        type: 'Recette Exceptionnelle',
        branche: 'Financier',
        numero_contrat: `REC-${data[0].id}`,
        montant: recette.montant, // Positif pour les recettes
        assure: recette.type_recette,
        mode_paiement: 'Espece', // Par défaut Espèce pour les recettes
        type_paiement: 'Au comptant',
        cree_par: recette.cree_par
      }, {
        date_recette: recette.date_recette,
        type_recette: recette.type_recette
      });
    } catch (rapportError) {
      console.error('⚠️ Erreur lors de la sauvegarde dans rapport:', rapportError);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erreur générale lors de la sauvegarde de la recette:', error);
    return false;
  }
};

export const getRecettesExceptionnelles = async (): Promise<RecetteExceptionnelle[]> => {
  try {
    const { data, error } = await supabase
      .from('recettes_exceptionnelles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur lors de la récupération des recettes:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Erreur générale lors de la récupération des recettes:', error);
    return [];
  }
};

// ===== FONCTIONS POUR LES RISTOURNES =====

export const checkRistourneExists = async (
  numeroContrat: string,
  dateRistourne: string,
  montantRistourne: number,
  client: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('ristournes')
      .select('id')
      .eq('numero_contrat', numeroContrat)
      .eq('date_ristourne', dateRistourne)
      .eq('montant_ristourne', montantRistourne)
      .eq('client', client)
      .maybeSingle();

    if (error) {
      console.error('❌ Erreur lors de la vérification de la ristourne:', error);
      return false;
    }

    return data !== null;
  } catch (error) {
    console.error('❌ Erreur générale lors de la vérification de la ristourne:', error);
    return false;
  }
};

export const saveRistourne = async (ristourne: Ristourne): Promise<boolean> => {
  try {
    console.log('🎁 Sauvegarde de la ristourne:', ristourne);

    // Vérifier si la ristourne existe déjà
    const exists = await checkRistourneExists(
      ristourne.numero_contrat,
      ristourne.date_ristourne || new Date().toISOString().split('T')[0],
      ristourne.montant_ristourne,
      ristourne.client
    );

    if (exists) {
      console.log('⚠️ Cette ristourne existe déjà');
      return false;
    }

    const { data, error } = await supabase
      .from('ristournes')
      .insert([{
        numero_contrat: ristourne.numero_contrat,
        client: ristourne.client,
        montant_ristourne: ristourne.montant_ristourne,
        date_ristourne: ristourne.date_ristourne || new Date().toISOString().split('T')[0],
        date_paiement_ristourne: ristourne.date_paiement_ristourne,
        type_paiement: ristourne.type_paiement || 'Espece',
        type_ristourne: ristourne.type_ristourne || 'Ristourne',
        created_at: new Date().toISOString().split('T')[0],
        cree_par: ristourne.cree_par
      }])
      .select();

    if (error) {
      console.error('❌ Erreur lors de la sauvegarde de la ristourne:', error);
      return false;
    }

    console.log('✅ Ristourne sauvegardée avec succès:', data);
    
    // Sauvegarder aussi dans la table rapport
    try {
      await saveToRapport({
        type: 'Ristourne',
        branche: 'Financier',
        numero_contrat: ristourne.numero_contrat,
        montant: -Math.abs(ristourne.montant_ristourne), // Négatif pour les ristournes
        assure: ristourne.client,
        mode_paiement: ristourne.type_paiement || 'Espece', // Ici on utilise le type_paiement de la ristourne
        type_paiement: 'Au comptant',
        cree_par: ristourne.cree_par
      }, {
        date_ristourne: ristourne.date_ristourne,
        date_paiement_ristourne: data[0].date_paiement_ristourne,
        client: ristourne.client
      });
    } catch (rapportError) {
      console.error('⚠️ Erreur lors de la sauvegarde dans rapport:', rapportError);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erreur générale lors de la sauvegarde de la ristourne:', error);
    return false;
  }
};

export const getRistournes = async (): Promise<Ristourne[]> => {
  try {
    const { data, error } = await supabase
      .from('ristournes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur lors de la récupération des ristournes:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Erreur générale lors de la récupération des ristournes:', error);
    return [];
  }
};

// ===== FONCTIONS POUR LES SINISTRES =====

export const checkSinistreExists = async (numeroSinistre: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('sinistres')
      .select('id')
      .eq('numero_sinistre', numeroSinistre)
      .maybeSingle();

    if (error) {
      console.error('❌ Erreur lors de la vérification du sinistre:', error);
      return false;
    }

    return data !== null;
  } catch (error) {
    console.error('❌ Erreur générale lors de la vérification du sinistre:', error);
    return false;
  }
};

export const saveSinistre = async (sinistre: Sinistre): Promise<boolean> => {
  try {
    console.log('🚨 Sauvegarde du sinistre:', sinistre);

    // Vérifier si le sinistre existe déjà
    const exists = await checkSinistreExists(sinistre.numero_sinistre);

    if (exists) {
      console.log('⚠️ Ce numéro de sinistre existe déjà');
      return false;
    }

    const { data, error } = await supabase
      .from('sinistres')
      .insert([{
        numero_sinistre: sinistre.numero_sinistre,
        montant: sinistre.montant,
        client: sinistre.client,
        date_sinistre: sinistre.date_sinistre || new Date().toISOString().split('T')[0],
        date_paiement_sinistre: sinistre.date_paiement_sinistre,
        type_paiement: sinistre.type_paiement || 'Espece',
        created_at: new Date().toISOString().split('T')[0],
        cree_par: sinistre.cree_par
      }])
      .select();

    if (error) {
      console.error('❌ Erreur lors de la sauvegarde du sinistre:', error);
      return false;
    }

    console.log('✅ Sinistre sauvegardé avec succès:', data);

    // Sauvegarder aussi dans la table rapport
    try {
      await saveToRapport({
        type: 'Sinistre',
        branche: 'Financier',
        numero_contrat: sinistre.numero_sinistre,
        montant: -Math.abs(sinistre.montant), // Négatif pour les sinistres
        assure: sinistre.client,
        mode_paiement: sinistre.type_paiement || 'Espece',
        type_paiement: 'Au comptant',
        cree_par: sinistre.cree_par
      }, {
        date_sinistre: sinistre.date_sinistre,
        date_paiement_sinistre: data[0].date_paiement_sinistre,
        numero_sinistre: sinistre.numero_sinistre,
        client: sinistre.client
      });
    } catch (rapportError) {
      console.error('⚠️ Erreur lors de la sauvegarde dans rapport:', rapportError);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erreur générale lors de la sauvegarde du sinistre:', error);
    return false;
  }
};

export const getSinistres = async (): Promise<Sinistre[]> => {
  try {
    const { data, error } = await supabase
      .from('sinistres')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur lors de la récupération des sinistres:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Erreur générale lors de la récupération des sinistres:', error);
    return [];
  }
};

// Fonction pour sauvegarder dans la table rapport
const saveToRapport = async (baseData: any, additionalData?: any): Promise<void> => {
  console.log('📊 Sauvegarde dans la table rapport...');
  console.log('📋 Données de base:', baseData);
  console.log('📋 Données additionnelles:', additionalData);

  const dateDepense = additionalData?.date_depense;
  const sessionDate = dateDepense || new Date().toISOString().split('T')[0];
  const createdAt = dateDepense ? `${dateDepense}T00:00:00.000Z` : new Date().toISOString();

  // Vérifier les doublons dans rapport
  const { data: existing } = await supabase
    .from('rapport')
    .select('id')
    .eq('numero_contrat', baseData.numero_contrat)
    .eq('type', baseData.type)
    .eq('date_operation', sessionDate)
    .maybeSingle();

  if (existing) {
    console.log('⚠️ Donnée rapport déjà existante, pas d\'insertion');
    return;
  }

  const rapportData = {
    type: baseData.type,
    branche: baseData.branche,
    numero_contrat: baseData.numero_contrat,
    prime: baseData.montant || 0,
    montant: baseData.montant,
    montant_recu: baseData.montant || 0,
    date_operation: sessionDate,
    created_at: createdAt,
    assure: baseData.assure,
    mode_paiement: baseData.mode_paiement,
    type_paiement: baseData.type_paiement,
    cree_par: baseData.cree_par,
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
    ...additionalData
  };

  console.log('📊 Données finales pour rapport:', rapportData);

  const { error } = await supabase
    .from('rapport')
    .insert([rapportData]);

  if (error) {
    console.error('❌ Erreur lors de la sauvegarde dans rapport:', error);
    throw error;
  }

  console.log('✅ Données sauvegardées dans rapport avec succès');
};