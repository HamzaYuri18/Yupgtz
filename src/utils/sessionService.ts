import { supabase } from '../lib/supabase';

export const calculateTotalEspece = async (dateSession: string): Promise<number> => {
  // Calculer le total de la colonne montant de la table rapport pour la date de session
  const { data: rapportData } = await supabase
    .from('rapport')
    .select('montant')
    .eq('date_operation', dateSession);

  const rapportTotal = rapportData?.reduce((sum, item) => sum + (parseFloat(item.montant) || 0), 0) || 0;

  return rapportTotal;
};

export const saveSessionData = async (username: string, dateSession: string): Promise<boolean> => {
  try {
    const totalEspece = await calculateTotalEspece(dateSession);

    // Vérifier si la session existe déjà pour cette date (peu importe l'utilisateur)
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('*')
      .eq('date_session', dateSession)
      .maybeSingle();

    if (existingSession) {
      // Mettre à jour la session existante et la marquer comme fermée
      const { error } = await supabase
        .from('sessions')
        .update({
          total_espece: totalEspece,
          session_fermee: true
        })
        .eq('id', existingSession.id);

      return !error;
    } else {
      // Créer une nouvelle session fermée
      const { error } = await supabase
        .from('sessions')
        .insert({
          date_session: dateSession,
          total_espece: totalEspece,
          cree_par: username,
          statut: 'Non versé',
          session_fermee: true
        });

      return !error;
    }
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de la session:', error);
    return false;
  }
};

export const isSessionClosed = async (dateSession: string): Promise<boolean> => {
  const { data } = await supabase
    .from('sessions')
    .select('session_fermee')
    .eq('date_session', dateSession)
    .maybeSingle();

  return data?.session_fermee || false;
};

export const getMonthlyStats = async (month: number, year: number) => {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0);
  const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .gte('date_session', startDate)
    .lte('date_session', endDateStr);

  if (error) {
    console.error('Erreur lors de la récupération des stats mensuelles:', error);
    return null;
  }

  const nonVersees = data?.filter(s => s.statut === 'Non versé') || [];
  const versees = data?.filter(s => s.statut === 'Versé') || [];

  return {
    nonVersees: {
      count: nonVersees.length,
      total: nonVersees.reduce((sum, s) => sum + parseFloat(s.total_espece || 0), 0)
    },
    versees: {
      count: versees.length,
      total: versees.reduce((sum, s) => sum + parseFloat(s.versement || 0), 0)
    },
    totalCharges: data?.reduce((sum, s) => sum + parseFloat(s.charges || 0), 0) || 0
  };
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
