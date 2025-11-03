import { User, Session } from '../types';
import { supabase } from '../lib/supabase';

export const users: User[] = [
  { username: 'Hamza', password: '007H', isAdmin: true },
  { username: 'Ahlem', password: '123', isAdmin: false },
  { username: 'Islem', password: '456', isAdmin: false }
];

export const authenticateUser = (username: string, password: string): User | null => {
  return users.find(user => user.username === username && user.password === password) || null;
};

// Vérifier le statut de la session dans la table sessions
export const checkSessionStatus = async (dateSession: string): Promise<{ 
  exists: boolean; 
  isClosed: boolean; 
  openedBy?: string;
  sessionData?: any;
}> => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('date_session', dateSession)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erreur vérification session:', error);
      return { exists: false, isClosed: true };
    }

    if (!data) {
      return { exists: false, isClosed: true };
    }

    return { 
      exists: true, 
      isClosed: data.session_fermee,
      openedBy: data.cree_par,
      sessionData: data
    };
  } catch (error) {
    console.error('Erreur vérification session:', error);
    return { exists: false, isClosed: true };
  }
};

// Créer une nouvelle session dans la table sessions
export const createNewSession = async (dateSession: string, username: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('sessions')
      .insert({
        date_session: dateSession,
        total_espece: 0, // Initialisé à 0, sera calculé plus tard
        versement: 0,
        date_versement: null,
        charges: 0,
        banque: null,
        statut: 'Non versé',
        cree_par: username,
        session_fermee: false // Session ouverte
      });

    if (error) {
      console.error('Erreur création session:', error);
      return false;
    }

    console.log(`✅ Nouvelle session créée pour ${dateSession} par ${username}`);
    return true;
  } catch (error) {
    console.error('Erreur création session:', error);
    return false;
  }
};

// Fermer la session dans la table sessions
export const closeSession = async (dateSession: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('sessions')
      .update({
        session_fermee: true
      })
      .eq('date_session', dateSession);

    if (error) {
      console.error('Erreur fermeture session:', error);
      return false;
    }

    console.log(`✅ Session fermée pour ${dateSession}`);
    return true;
  } catch (error) {
    console.error('Erreur fermeture session:', error);
    return false;
  }
};

// Vérifier et fermer automatiquement les sessions à minuit
export const checkAndCloseExpiredSessions = async (): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Fermer les sessions des jours précédents qui sont encore ouvertes
    const { data: openSessions, error } = await supabase
      .from('sessions')
      .select('date_session')
      .eq('session_fermee', false)
      .lt('date_session', today);

    if (error) {
      console.error('Erreur récupération sessions ouvertes:', error);
      return;
    }

    if (openSessions && openSessions.length > 0) {
      console.log(`🔍 ${openSessions.length} sessions à fermer automatiquement`);
      
      for (const session of openSessions) {
        await closeSession(session.date_session);
      }
      
      console.log('✅ Fermeture automatique des sessions terminée');
    }
  } catch (error) {
    console.error('Erreur fermeture automatique:', error);
  }
};

// Vérifier si un utilisateur peut se connecter
export const canUserLogin = async (username: string, dateSession: string): Promise<{ 
  canLogin: boolean; 
  message: string; 
  sessionExists: boolean;
  isSessionClosed: boolean;
}> => {
  try {
    // Vérifier si c'est Hamza (admin) - peut toujours se connecter
    if (username === 'Hamza') {
      return { 
        canLogin: true, 
        message: 'Bienvenue Hamza (Admin)',
        sessionExists: false,
        isSessionClosed: false
      };
    }

    // Vérifier le statut de la session du jour
    const sessionStatus = await checkSessionStatus(dateSession);
    
    if (sessionStatus.isClosed) {
      return { 
        canLogin: false, 
        message: 'Session fermée pour aujourd\'hui. Veuillez réessayer demain.',
        sessionExists: sessionStatus.exists,
        isSessionClosed: true
      };
    }

    // Si session ouverte, l'utilisateur peut se connecter
    // (une seule session partagée pour tous les utilisateurs)
    return { 
      canLogin: true, 
      message: sessionStatus.exists ? 'Bienvenue - Session déjà ouverte' : 'Bienvenue - Nouvelle session créée',
      sessionExists: sessionStatus.exists,
      isSessionClosed: false
    };
  } catch (error) {
    console.error('Erreur vérification connexion:', error);
    return { 
      canLogin: false, 
      message: 'Erreur de vérification',
      sessionExists: false,
      isSessionClosed: true
    };
  }
};

export const authenticateUserWithSession = async (username: string, password: string): Promise<{ 
  success: boolean; 
  user?: User; 
  message: string;
  sessionExists?: boolean;
}> => {
  try {
    // Vérifier d'abord les identifiants
    const user = authenticateUser(username, password);
    if (!user) {
      return { 
        success: false, 
        message: 'Nom d\'utilisateur ou mot de passe incorrect' 
      };
    }

    // Vérifier et fermer les sessions expirées
    await checkAndCloseExpiredSessions();

    const today = new Date().toISOString().split('T')[0];
    
    // Vérifier si l'utilisateur peut se connecter
    const loginCheck = await canUserLogin(username, today);
    
    if (!loginCheck.canLogin) {
      return { 
        success: false, 
        message: loginCheck.message 
      };
    }

    // Si c'est une nouvelle session, la créer (sauf pour Hamza qui n'a pas besoin de session spécifique)
    if (!loginCheck.sessionExists && loginCheck.canLogin && username !== 'Hamza') {
      const sessionCreated = await createNewSession(today, username);
      if (!sessionCreated) {
        return { 
          success: false, 
          message: 'Erreur lors de la création de la session' 
        };
      }
    }

    // Sauvegarder la session locale
    saveSession(username);
    
    return { 
      success: true, 
      user, 
      message: loginCheck.message,
      sessionExists: loginCheck.sessionExists
    };
  } catch (error) {
    console.error('Erreur authentification:', error);
    return { 
      success: false, 
      message: 'Erreur lors de l\'authentification' 
    };
  }
};

export const saveSession = (username: string): void => {
  const session: Session = {
    username,
    loginTime: Date.now(),
    isActive: true
  };
  localStorage.setItem('session', JSON.stringify(session));
};

export const getSession = (): Session | null => {
  const sessionData = localStorage.getItem('session');
  if (!sessionData) return null;
  
  const session: Session = JSON.parse(sessionData);
  const now = new Date();
  const sessionDate = new Date(session.loginTime);
  
  // Vérifier si la session a expiré à minuit pour les utilisateurs normaux
  if (session.username !== 'Hamza' && sessionDate.toDateString() !== now.toDateString()) {
    clearSession();
    return null;
  }
  
  return session.isActive ? session : null;
};

export const getSessionDate = (): string => {
  const session = getSession();
  if (!session) return new Date().toISOString().split('T')[0];
  return new Date(session.loginTime).toISOString().split('T')[0];
};

export const shouldShowLogoutConfirmation = (username: string): boolean => {
  return true; // Tous les utilisateurs doivent imprimer la FC
};

export const clearSession = (): void => {
  localStorage.removeItem('session');
};

export const isAdmin = (username: string): boolean => {
  return username === 'Hamza';
};

export const canReconnect = (username: string): boolean => {
  return isAdmin(username);
};

// Fonction pour fermer la session utilisateur
export const logoutUser = async (username: string): Promise<boolean> => {
  try {
    const dateSession = getSessionDate();
    
    // Pour Hamza, ne pas fermer la session globale
    if (username === 'Hamza') {
      console.log('🛡️ Hamza se déconnecte - session globale maintenue');
      clearSession();
      return true;
    }

    // Pour les autres utilisateurs, fermer la session globale
    const sessionClosed = await closeSession(dateSession);
    clearSession();
    
    return sessionClosed;
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    clearSession();
    return false;
  }
};

// Initialisation du nettoyage des sessions
export const initializeAuth = async (): Promise<void> => {
  await checkAndCloseExpiredSessions();
};