import { checkAndCloseExpiredSessions } from './sessionService';

// Exécuter au chargement de l'application
export const initializeSessionCleanup = async (): Promise<void> => {
  console.log('🔄 Vérification des sessions expirées...');
  await checkAndCloseExpiredSessions();
};

// Exécuter périodiquement (toutes les heures)
export const startSessionCleanupInterval = (): NodeJS.Timeout => {
  return setInterval(async () => {
    await checkAndCloseExpiredSessions();
  }, 60 * 60 * 1000); // Toutes les heures
};