import { User, Session } from '../types';
import { supabase } from '../lib/supabase';

export const users: User[] = [
  { username: 'Hamza', password: '007H', isAdmin: true },
  { username: 'Ahlem', password: '123', isAdmin: false },
  { username: 'Islem', password: '456', isAdmin: false },
  { username: 'Rouae', password: '987', isAdmin: false }
];

// Utilisateurs soumis au blocage journalier après déconnexion/FC
const RESTRICTED_USERS = ['Ahlem', 'Rouae'];

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
  const d = (() => {
    const session = getSession();
    return session ? new Date(session.loginTime) : new Date();
  })();
  // Utiliser la date LOCALE (pas UTC) pour éviter le décalage d'une heure (UTC+1 Tunisie)
  // Ex : 00h30 heure locale = 23h30 UTC veille → toISOString() renverrait la mauvaise date
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

export const isRestrictedUser = (username: string): boolean => {
  return RESTRICTED_USERS.includes(username);
};

// Verrouille un utilisateur restreint pour aujourd'hui ET force la déconnexion de l'autre utilisateur restreint
export const lockUserForToday = async (username: string, reason: 'logout' | 'fc_generated'): Promise<void> => {
  if (!isRestrictedUser(username)) return;

  const today = new Date().toISOString().split('T')[0];

  try {
    // Bloquer cet utilisateur
    await supabase
      .from('user_daily_locks')
      .upsert(
        { username, lock_date: today, locked_at: new Date().toISOString(), reason },
        { onConflict: 'username,lock_date' }
      );

    // Bloquer aussi l'autre utilisateur restreint (déconnexion en cascade)
    for (const other of RESTRICTED_USERS) {
      if (other !== username) {
        await supabase
          .from('user_daily_locks')
          .upsert(
            { username: other, lock_date: today, locked_at: new Date().toISOString(), reason: 'cascade_logout' },
            { onConflict: 'username,lock_date' }
          );
      }
    }
  } catch (err) {
    console.error('Erreur lors du verrouillage utilisateur:', err);
  }
};

// Vérifie si un utilisateur est bloqué aujourd'hui
export const isUserLockedToday = async (username: string): Promise<boolean> => {
  if (!isRestrictedUser(username)) return false;

  const today = new Date().toISOString().split('T')[0];

  try {
    const { data } = await supabase
      .from('user_daily_locks')
      .select('id')
      .eq('username', username)
      .eq('lock_date', today)
      .maybeSingle();

    return data !== null;
  } catch (err) {
    console.error('Erreur lors de la vérification du verrou:', err);
    return false;
  }
};

// Vérifie si au moins un des utilisateurs restreints est bloqué aujourd'hui
// (pour forcer la déconnexion de l'autre s'il est encore connecté)
export const isAnyRestrictedUserLockedToday = async (): Promise<string | null> => {
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data } = await supabase
      .from('user_daily_locks')
      .select('username')
      .in('username', RESTRICTED_USERS)
      .eq('lock_date', today)
      .limit(1);

    return data && data.length > 0 ? data[0].username : null;
  } catch (err) {
    console.error('Erreur lors de la vérification des verrous:', err);
    return null;
  }
};
