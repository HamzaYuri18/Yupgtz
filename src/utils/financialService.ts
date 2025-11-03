import { supabase } from '../lib/supabase';

export interface Session {
  id?: number;
  date_session: string;
  statut: 'ouverte' | 'fermee';
  created_at?: string;
  updated_at?: string;
}

// Fonction pour obtenir la date de session actuelle
export const getSessionDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

// Vérifier si une session existe pour la date actuelle
export const checkSessionExists = async (): Promise<Session | null> => {
  try {
    const today = getSessionDate();
    
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('date_session', today)
      .maybeSingle();

    if (error) {
      console.error('❌ Erreur lors de la vérification de la session:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Erreur générale lors de la vérification de la session:', error);
    return null;
  }
};

// Créer une nouvelle session
export const createSession = async (): Promise<Session | null> => {
  try {
    const today = getSessionDate();
    
    const { data, error } = await supabase
      .from('sessions')
      .insert([{
        date_session: today,
        statut: 'ouverte'
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur lors de la création de la session:', error);
      return null;
    }

    console.log('✅ Nouvelle session créée:', data);
    return data;
  } catch (error) {
    console.error('❌ Erreur générale lors de la création de la session:', error);
    return null;
  }
};

// Fermer une session
export const closeSession = async (sessionId: number): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('sessions')
      .update({
        statut: 'fermee',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error) {
      console.error('❌ Erreur lors de la fermeture de la session:', error);
      return false;
    }

    console.log('✅ Session fermée avec succès');
    return true;
  } catch (error) {
    console.error('❌ Erreur générale lors de la fermeture de la session:', error);
    return false;
  }
};

// Fonction principale pour gérer la session au login
export const handleSessionOnLogin = async (username: string): Promise<boolean> => {
  try {
    console.log('🔐 Gestion de la session pour:', username);
    
    // Vérifier si une session existe pour aujourd'hui
    const existingSession = await checkSessionExists();
    
    if (existingSession) {
      if (existingSession.statut === 'fermee') {
        // Si la session est fermée, seul Hamza peut se reconnecter
        if (username.toLowerCase() !== 'hamza') {
          console.log('❌ Session fermée - Accès refusé pour:', username);
          return false;
        }
        // Hamza peut se reconnecter même si la session est fermée
        console.log('✅ Hamza autorisé à se reconnecter sur session fermée');
        return true;
      }
      // Session ouverte - tout le monde peut se connecter
      console.log('✅ Session ouverte existante - Connexion autorisée');
      return true;
    } else {
      // Aucune session existante - créer une nouvelle session
      console.log('📅 Aucune session trouvée - création d\'une nouvelle session');
      const newSession = await createSession();
      return newSession !== null;
    }
  } catch (error) {
    console.error('❌ Erreur lors de la gestion de la session:', error);
    return false;
  }
};

// Fonction pour fermer la session au logout
export const handleSessionOnLogout = async (): Promise<boolean> => {
  try {
    const today = getSessionDate();
    
    // Fermer la session du jour
    const { data: session, error: findError } = await supabase
      .from('sessions')
      .select('id')
      .eq('date_session', today)
      .eq('statut', 'ouverte')
      .maybeSingle();

    if (findError) {
      console.error('❌ Erreur lors de la recherche de la session:', findError);
      return false;
    }

    if (!session) {
      console.log('ℹ️ Aucune session ouverte trouvée pour aujourd\'hui');
      return true;
    }

    // Fermer la session
    return await closeSession(session.id);
  } catch (error) {
    console.error('❌ Erreur lors de la fermeture de la session:', error);
    return false;
  }
};

// Fonction pour vérifier périodiquement l'état de la session
export const checkSessionStatus = async (username: string): Promise<boolean> => {
  try {
    const session = await checkSessionExists();
    
    if (!session) {
      console.log('❌ Aucune session trouvée');
      return false;
    }

    if (session.statut === 'fermee' && username.toLowerCase() !== 'hamza') {
      console.log('❌ Session fermée - Accès refusé');
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification du statut de la session:', error);
    return false;
  }
};