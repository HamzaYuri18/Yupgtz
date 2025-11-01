import { supabase } from '../lib/supabase';

export interface VerificationResult {
  success: boolean;
  liste_credits: boolean;
  rapport: boolean;
  liste_credits_details?: any;
  rapport_details?: any;
  errors?: string[];
}

export const verifyPaymentInTables = async (
  creditId: string, 
  paymentAmount: number
): Promise<VerificationResult> => {
  const result: VerificationResult = {
    success: false,
    liste_credits: false,
    rapport: false,
    errors: []
  };

  try {
    // Vérification dans liste_credits
    const { data: creditData, error: creditError } = await supabase
      .from('liste_credits')
      .select('*')
      .eq('id', creditId)
      .single();

    if (creditError) {
      result.errors?.push(`Erreur liste_credits: ${creditError.message}`);
    } else if (creditData) {
      result.liste_credits = true;
      result.liste_credits_details = {
        nouveau_solde: creditData.solde,
        paiement_total: creditData.paiement,
        statut: creditData.statut
      };
      
      // Vérifier que le solde a été correctement mis à jour
      const expectedSolde = creditData.montant_credit - (creditData.paiement || 0);
      if (Math.abs(creditData.solde - expectedSolde) > 0.01) {
        result.errors?.push(`Incohérence de solde: ${creditData.solde} au lieu de ${expectedSolde}`);
      }
    }

    // Vérification dans rapport (recherche du dernier enregistrement)
    const { data: rapportData, error: rapportError } = await supabase
      .from('rapport')
      .select('*')
      .eq('credit_id', creditId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (rapportError && rapportError.code !== 'PGRST116') { // PGRST116 = no rows
      result.errors?.push(`Erreur rapport: ${rapportError.message}`);
    } else if (rapportData) {
      result.rapport = true;
      result.rapport_details = {
        montant: rapportData.montant,
        type_operation: rapportData.type_operation,
        date_creation: rapportData.created_at
      };
      
      // Vérifier que le montant correspond
      if (Math.abs(rapportData.montant - paymentAmount) > 0.01) {
        result.errors?.push(`Montant rapport incorrect: ${rapportData.montant} au lieu de ${paymentAmount}`);
      }
    } else {
      result.errors?.push('Aucun enregistrement trouvé dans la table rapport');
    }

    // Déterminer le succès global
    result.success = result.liste_credits && result.rapport && (result.errors?.length === 0);

  } catch (error) {
    console.error('Erreur lors de la vérification:', error);
    result.errors?.push(`Erreur générale: ${error}`);
  }

  return result;
};