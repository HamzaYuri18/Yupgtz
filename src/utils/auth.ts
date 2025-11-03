import { User, Session } from '../types';
import { canUserLogin, createNewSession, checkAndCloseExpiredSessions, closeUserSession } from './sessionService';

export const users: User[] = [
  { username: 'Hamza', password: '007H', isAdmin: true },
  { username: 'Ahlem', password: '123', isAdmin: false },
  { username: 'Islem', password: '456', isAdmin: false }
];

export const authenticateUser = (username: string, password: string): User | null => {
  return users.find(user => user.username === username && user.password === password) || null;
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

    // Si c'est une nouvelle session, la créer
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

    // Pour les autres utilisateurs, fermer leur session
    const sessionClosed = await closeUserSession(username, dateSession);
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