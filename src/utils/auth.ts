import { User, Session } from '../types';

export const users: User[] = [
  { username: 'Hamza', password: '007H', isAdmin: true },
  { username: 'Ahlem', password: '123', isAdmin: false },
  { username: 'Islem', password: '456', isAdmin: false }
];

export const authenticateUser = (username: string, password: string): User | null => {
  return users.find(user => user.username === username && user.password === password) || null;
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
  
  // Vérifier si la session a expiré à minuit pour TOUS les utilisateurs
  if (sessionDate.toDateString() !== now.toDateString()) {
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