import { supabase } from '../lib/supabase';

// Interface pour les données de session
export interface SessionData {
  id?: number;
  date_session: string;
  total_espece: number;
  versement: number;
  date_versement: string | null;
  charges: number;
  banque: string | null;
  statut: string;
  cree_par: string;
  created_at?: string;
  session_fermee: boolean;
}

// Calculer le total espèce depuis la table rapport
export const calculateTotalEspece = async (dateSession: string): Promise<number> => {
  try {
    console.log('🔍 Calcul du total espèce pour la date:', dateSession);
    
    const { data: rapportData, error } = await supabase
      .from('rapport')
      .select('montant, mode_paiement')
      .eq('date_operation', dateSession)
      .eq('mode_paiement', 'Espece');

    if (error) {
      console.error('❌ Erreur lors du calcul du total espèce:', error);
      return 0;
    }

    const rapportTotal = rapportData?.reduce((sum, item) => sum + (parseFloat(item.montant.toString()) || 0), 0) || 0;
    
    console.log(`✅ Total espèce calculé: ${rapportTotal} DT pour ${dateSession}`);
    console.log(`📊 ${rapportData?.length || 0} transactions en espèces trouvées`);
    
    return rapportTotal;
  } catch (error) {
    console.error('❌ Erreur générale lors du calcul du total espèce:', error);
    return 0;
  }
};

// Sauvegarder les données de session (fermeture de session)
export const saveSessionData = async (username: string, dateSession: string): Promise<boolean> => {
  try {
    const totalEspece = await calculateTotalEspece(dateSession);

    // Vérifier si la session existe déjà pour cette date
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
          session_fermee: true,
          cree_par: username // Mettre à jour avec l'utilisateur qui ferme
        })
        .eq('id', existingSession.id);

      if (error) {
        console.error('❌ Erreur mise à jour session:', error);
        return false;
      }

      console.log(`✅ Session mise à jour et fermée pour ${dateSession}`);
      return true;
    } else {
      // Créer une nouvelle session fermée
      const { error } = await supabase
        .from('sessions')
        .insert({
          date_session: dateSession,
          total_espece: totalEspece,
          versement: 0,
          date_versement: null,
          charges: 0,
          banque: null,
          statut: 'Non versé',
          cree_par: username,
          session_fermee: true
        });

      if (error) {
        console.error('❌ Erreur création session:', error);
        return false;
      }

      console.log(`✅ Nouvelle session créée et fermée pour ${dateSession}`);
      return true;
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement de la session:', error);
    return false;
  }
};

// Vérifier si une session est fermée
export const isSessionClosed = async (dateSession: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('session_fermee')
      .eq('date_session', dateSession)
      .maybeSingle();

    if (error) {
      console.error('❌ Erreur vérification session:', error);
      return true; // Par défaut, considérer comme fermée en cas d'erreur
    }

    return data?.session_fermee || true; // Si pas de session, considérer comme fermée
  } catch (error) {
    console.error('❌ Erreur générale vérification session:', error);
    return true;
  }
};

// Obtenir les statistiques mensuelles
export const getMonthlyStats = async (month: number, year: number) => {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0);
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .gte('date_session', startDate)
      .lte('date_session', endDateStr);

    if (error) {
      console.error('❌ Erreur récupération stats mensuelles:', error);
      return null;
    }

    const nonVersees = data?.filter(s => s.statut === 'Non versé') || [];
    const versees = data?.filter(s => s.statut === 'Versé') || [];

    return {
      nonVersees: {
        count: nonVersees.length,
        total: nonVersees.reduce((sum, s) => sum + parseFloat(s.total_espece?.toString() || '0'), 0)
      },
      versees: {
        count: versees.length,
        total: versees.reduce((sum, s) => sum + parseFloat(s.versement?.toString() || '0'), 0)
      },
      totalCharges: data?.reduce((sum, s) => sum + parseFloat(s.charges?.toString() || '0'), 0) || 0
    };
  } catch (error) {
    console.error('❌ Erreur générale stats mensuelles:', error);
    return null;
  }
};

// Obtenir les sessions récentes
export const getRecentSessions = async (limit: number = 10): Promise<SessionData[]> => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .order('date_session', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Erreur récupération sessions récentes:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Erreur générale récupération sessions:', error);
    return [];
  }
};

// Obtenir les sessions par plage de dates
export const getSessionsByDateRange = async (dateDebut: string, dateFin: string): Promise<SessionData[]> => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .gte('date_session', dateDebut)
      .lte('date_session', dateFin)
      .order('date_session', { ascending: false });

    if (error) {
      console.error('❌ Erreur récupération sessions par date:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Erreur générale récupération sessions par date:', error);
    return [];
  }
};

// Mettre à jour le versement d'une session
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

    if (error) {
      console.error('❌ Erreur mise à jour versement:', error);
      return false;
    }

    console.log(`✅ Versement mis à jour pour la session ${id}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur générale mise à jour versement:', error);
    return false;
  }
};

// Calculer le total espèce depuis la table rapport (version améliorée)
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
      .select('montant, mode_paiement, created_at')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString())
      .eq('mode_paiement', 'Espece');

    if (error) {
      console.error('❌ Erreur lors du calcul du total espèce:', error);
      return 0;
    }

    const total = data?.reduce((sum, record) => sum + (parseFloat(record.montant?.toString()) || 0), 0) || 0;
    
    console.log(`✅ Total espèce calculé: ${total} DT pour ${dateSession}`);
    console.log(`📊 ${data?.length || 0} transactions en espèces trouvées`);
    
    // Log détaillé pour le débogage
    if (data && data.length > 0) {
      console.log('📋 Détail des transactions en espèces:');
      data.forEach((record, index) => {
        console.log(`   ${index + 1}. Montant: ${record.montant} DT, Mode: ${record.mode_paiement}`);
      });
    }
    
    return total;
  } catch (error) {
    console.error('❌ Erreur générale lors du calcul du total espèce:', error);
    return 0;
  }
};

// Vérifier et synchroniser tous les totaux espèce
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
      } else {
        console.log(`✅ Session ${session.id}: Total cohérent (${session.total_espece} DT)`);
      }
    }
    
    console.log('✅ Synchronisation des totaux espèce terminée');
  } catch (error) {
    console.error('❌ Erreur générale lors de la synchronisation:', error);
  }
};

// Créer une session avec vérification du total espèce
export const createSessionWithVerifiedTotal = async (dateSession: string, createdBy: string): Promise<boolean> => {
  try {
    console.log('📅 Création de session avec vérification du total...');
    
    // Calculer le total espèce depuis la table rapport (uniquement espèces)
    const totalEspece = await calculateTotalEspeceFromRapport(dateSession);
    
    const { data, error } = await supabase
      .from('sessions')
      .insert([{
        date_session: dateSession,
        total_espece: totalEspece,
        versement: 0,
        charges: 0,
        banque: null,
        date_versement: null,
        statut: 'Non versé',
        cree_par: createdBy,
        session_fermee: false
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

// Obtenir le détail des transactions pour une session
export const getSessionTransactionsDetail = async (dateSession: string) => {
  try {
    console.log('🔍 Récupération du détail des transactions pour:', dateSession);
    
    const sessionDate = new Date(dateSession);
    const startDate = new Date(sessionDate);
    const endDate = new Date(sessionDate);
    endDate.setDate(endDate.getDate() + 1);

    const { data, error } = await supabase
      .from('rapport')
      .select('montant, mode_paiement, type, created_at')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Erreur récupération détail transactions:', error);
      return { transactions: [], totals: { espece: 0, cheque: 0, carte: 0, virement: 0, totalGeneral: 0 } };
    }

    // Calculer les totaux par mode de paiement
    const totalEspece = data
      ?.filter(record => record.mode_paiement === 'Espece')
      .reduce((sum, record) => sum + (parseFloat(record.montant?.toString()) || 0), 0) || 0;

    const totalCheque = data
      ?.filter(record => record.mode_paiement === 'Cheque')
      .reduce((sum, record) => sum + (parseFloat(record.montant?.toString()) || 0), 0) || 0;

    const totalCarte = data
      ?.filter(record => record.mode_paiement === 'Carte Bancaire')
      .reduce((sum, record) => sum + (parseFloat(record.montant?.toString()) || 0), 0) || 0;

    const totalVirement = data
      ?.filter(record => record.mode_paiement === 'Virement')
      .reduce((sum, record) => sum + (parseFloat(record.montant?.toString()) || 0), 0) || 0;

    console.log('📊 Détail des transactions:');
    console.log(`   💵 Espèces: ${totalEspece} DT`);
    console.log(`   📄 Chèques: ${totalCheque} DT`);
    console.log(`   💳 Cartes: ${totalCarte} DT`);
    console.log(`   🏦 Virements: ${totalVirement} DT`);
    console.log(`   📋 Total transactions: ${data?.length || 0}`);

    return {
      transactions: data || [],
      totals: {
        espece: totalEspece,
        cheque: totalCheque,
        carte: totalCarte,
        virement: totalVirement,
        totalGeneral: (data?.reduce((sum, record) => sum + (parseFloat(record.montant?.toString()) || 0), 0) || 0)
      }
    };
  } catch (error) {
    console.error('❌ Erreur générale récupération détail:', error);
    return { transactions: [], totals: { espece: 0, cheque: 0, carte: 0, virement: 0, totalGeneral: 0 } };
  }
};

// Obtenir la session du jour
export const getTodaySession = async (): Promise<SessionData | null> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('date_session', today)
      .maybeSingle();

    if (error) {
      console.error('❌ Erreur récupération session du jour:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Erreur générale récupération session du jour:', error);
    return null;
  }
};

// Fermer la session du jour
export const closeTodaySession = async (): Promise<boolean> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { error } = await supabase
      .from('sessions')
      .update({
        session_fermee: true
      })
      .eq('date_session', today);

    if (error) {
      console.error('❌ Erreur fermeture session du jour:', error);
      return false;
    }

    console.log(`✅ Session du ${today} fermée`);
    return true;
  } catch (error) {
    console.error('❌ Erreur générale fermeture session:', error);
    return false;
  }
};

// Vérifier si la session du jour existe et est ouverte
export const isTodaySessionOpen = async (): Promise<boolean> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('sessions')
      .select('session_fermee')
      .eq('date_session', today)
      .maybeSingle();

    if (error) {
      console.error('❌ Erreur vérification session du jour:', error);
      return false;
    }

    // Si pas de session pour aujourd'hui, considérer comme fermée
    if (!data) {
      return false;
    }

    return !data.session_fermee;
  } catch (error) {
    console.error('❌ Erreur générale vérification session du jour:', error);
    return false;
  }
};