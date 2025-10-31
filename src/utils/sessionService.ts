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
// Fonction pour calculer le total espèce depuis la table rapport
export const calculateTotalEspeceFromRapport = async (dateSession: string): Promise<number> => {
  try {
    console.log('🔍 Calcul du total espèce depuis rapport pour la date:', dateSession);
    
    // Convertir la date de session en format Date pour la comparaison
    const sessionDate = new Date(dateSession);
    const startDate = new Date(sessionDate);
    const endDate = new Date(sessionDate);
    endDate.setDate(endDate.getDate() + 1); // Jour suivant à minuit

    const { data, error } = await supabase
      .from('rapport')
      .select('montant, created_at')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString());

    if (error) {
      console.error('❌ Erreur lors du calcul du total espèce:', error);
      return 0;
    }

    const total = data?.reduce((sum, record) => sum + (record.montant || 0), 0) || 0;
    
    console.log(`✅ Total espèce calculé: ${total} DT pour ${dateSession}`);
    console.log(`📊 ${data?.length || 0} enregistrements trouvés`);
    
    return total;
  } catch (error) {
    console.error('❌ Erreur générale lors du calcul du total espèce:', error);
    return 0;
  }
};

// Fonction pour vérifier et synchroniser tous les totaux espèce
export const verifyAndSyncSessionTotals = async (): Promise<void> => {
  try {
    console.log('🔄 Vérification et synchronisation des totaux espèce...');
    
    // Récupérer toutes les sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, date_session, total_espece');

    if (sessionsError) {
      console.error('❌ Erreur récupération sessions:', sessionsError);
      return;
    }

    console.log(`🔍 ${sessions?.length || 0} sessions à vérifier`);

    for (const session of sessions || []) {
      const calculatedTotal = await calculateTotalEspeceFromRapport(session.date_session);
      
      // Vérifier si le total calculé diffère du total enregistré
      if (Math.abs(calculatedTotal - session.total_espece) > 0.01) {
        console.log(`🔄 Correction session ${session.id}: ${session.total_espece} → ${calculatedTotal} DT`);
        
        // Mettre à jour le total espèce dans la table sessions
        const { error: updateError } = await supabase
          .from('sessions')
          .update({ total_espece: calculatedTotal })
          .eq('id', session.id);

        if (updateError) {
          console.error(`❌ Erreur mise à jour session ${session.id}:`, updateError);
        } else {
          console.log(`✅ Session ${session.id} corrigée`);
        }
      }
    }
    
    console.log('✅ Synchronisation des totaux espèce terminée');
  } catch (error) {
    console.error('❌ Erreur générale lors de la synchronisation:', error);
  }
};

// Fonction pour créer une session avec vérification du total espèce
export const createSessionWithVerifiedTotal = async (dateSession: string, createdBy: string): Promise<boolean> => {
  try {
    console.log('📅 Création de session avec vérification du total...');
    
    // Calculer le total espèce depuis la table rapport
    const totalEspece = await calculateTotalEspeceFromRapport(dateSession);
    
    const { data, error } = await supabase
      .from('sessions')
      .insert([{
        date_session: dateSession,
        total_espece: totalEspece,
        versement: 0,
        charges: 0,
        statut: 'Non Versé',
        cree_par: createdBy
      }])
      .select();

    if (error) {
      console.error('❌ Erreur création session:', error);
      return false;
    }

    console.log(`✅ Session créée avec total espèce: ${totalEspece} DT`);
    return true;
  } catch (error) {
    console.error('❌ Erreur générale création session:', error);
    return false;
  }
};