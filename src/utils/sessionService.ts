import { supabase } from '../lib/supabase';

export const calculateTotalEspece = async (dateSession: string): Promise<number> => {
  // Calculer le total des recettes en espèces (Termes + Recettes exceptionnelles)
  const { data: rapportData } = await supabase
    .from('rapport')
    .select('montant_recu')
    .eq('date_operation', dateSession)
    .eq('mode_paiement', 'Espèce');

  const rapportTotal = rapportData?.reduce((sum, item) => sum + (parseFloat(item.montant_recu) || 0), 0) || 0;

  const { data: recettesData } = await supabase
    .from('recettes_exceptionnelles')
    .select('montant')
    .eq('date_recette', dateSession);

  const recettesTotal = recettesData?.reduce((sum, item) => sum + (parseFloat(item.montant.toString()) || 0), 0) || 0;

  // Calculer le total des dépenses
  const { data: depensesData } = await supabase
    .from('depenses')
    .select('montant')
    .eq('date_depense', dateSession);

  const depensesTotal = depensesData?.reduce((sum, item) => sum + (parseFloat(item.montant.toString()) || 0), 0) || 0;

  // Total espèce = Recettes - Dépenses
  return rapportTotal + recettesTotal - depensesTotal;
};

export const saveSessionData = async (username: string, dateSession: string): Promise<boolean> => {
  try {
    const totalEspece = await calculateTotalEspece(dateSession);

    // Vérifier si la session existe déjà
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('*')
      .eq('date_session', dateSession)
      .eq('cree_par', username)
      .maybeSingle();

    if (existingSession) {
      // Mettre à jour la session existante
      const { error } = await supabase
        .from('sessions')
        .update({ total_espece: totalEspece })
        .eq('id', existingSession.id);

      return !error;
    } else {
      // Créer une nouvelle session
      const { error } = await supabase
        .from('sessions')
        .insert({
          date_session: dateSession,
          total_espece: totalEspece,
          cree_par: username,
          statut: 'Non versé'
        });

      return !error;
    }
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de la session:', error);
    return false;
  }
};

export const getRecentSessions = async (limit: number = 10) => {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('date_session', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Erreur lors de la récupération des sessions:', error);
    return [];
  }

  return data || [];
};

export const getSessionsByDateRange = async (dateDebut: string, dateFin: string) => {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .gte('date_session', dateDebut)
    .lte('date_session', dateFin)
    .order('date_session', { ascending: false });

  if (error) {
    console.error('Erreur lors de la récupération des sessions:', error);
    return [];
  }

  return data || [];
};

export const updateSessionVersement = async (
  id: number,
  versement: number,
  dateVersement: string,
  banque: string,
  charges: number
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('sessions')
      .update({
        versement,
        date_versement: dateVersement,
        banque,
        charges,
        statut: 'Versé'
      })
      .eq('id', id);

    return !error;
  } catch (error) {
    console.error('Erreur lors de la mise à jour du versement:', error);
    return false;
  }
};
