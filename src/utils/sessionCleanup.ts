import { checkAndCloseExpiredSessions } from './auth';

// Exécuter au chargement de l'application
export const initializeSessionCleanup = async (): Promise<void> => {
  console.log('🔄 Initialisation du nettoyage des sessions...');
  try {
    await checkAndCloseExpiredSessions();
    console.log('✅ Nettoyage des sessions terminé');
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage des sessions:', error);
  }
};

// Exécuter périodiquement (toutes les heures et à minuit)
export const startSessionCleanupInterval = (): NodeJS.Timeout => {
  console.log('⏰ Démarrage de l\'intervalle de nettoyage...');
  
  return setInterval(async () => {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      if (currentHour === 0 && currentMinute === 0) {
        console.log('🕛 Minuit - Nettoyage des sessions...');
        await checkAndCloseExpiredSessions();
      } else if (currentMinute === 0) {
        console.log(`🕐 ${currentHour}h - Vérification des sessions...`);
        await checkAndCloseExpiredSessions();
      }
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage périodique:', error);
    }
  }, 60 * 1000);
};

// Vérifier si nous sommes après minuit
export const isAfterMidnight = (): boolean => {
  const now = new Date();
  return now.getHours() === 0 && now.getMinutes() < 5;
};

// Obtenir la date de la dernière session valide
export const getLastValidSessionDate = (): string => {
  const now = new Date();
  
  if (isAfterMidnight()) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  
  return now.toISOString().split('T')[0];
};