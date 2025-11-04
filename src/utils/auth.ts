import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import { getSession, getSessionDate, isAdmin, initializeAuth, logoutUser } from './utils/auth';
import { isSessionClosed } from './utils/sessionService';
import { initializeSessionCleanup, startSessionCleanupInterval } from './utils/sessionCleanup';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState('');

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Initialisation de l\'application...');
        
        await initializeAuth();
        
        const cleanupInterval = startSessionCleanupInterval();
        
        const session = getSession();
        if (session) {
          console.log(`🔍 Session trouvée pour: ${session.username}`);
          
          const today = new Date().toISOString().split('T')[0];
          const sessionDate = getSessionDate();
          
          const now = new Date();
          const sessionTime = new Date(session.loginTime);
          
          if (session.username !== 'Hamza' && sessionTime.toDateString() !== now.toDateString()) {
            console.log('⏰ Session expirée - déconnexion automatique');
            await logoutUser(session.username);
            setIsAuthenticated(false);
            setCurrentUser('');
            setSessionMessage('Votre session a expiré (minuit). Veuillez vous reconnecter.');
          } else {
            const sessionClosed = await isSessionClosed(today);
            
            if (sessionClosed && !isAdmin(session.username)) {
              console.log('🔒 Session fermée dans la base - déconnexion');
              setIsAuthenticated(false);
              setCurrentUser('');
              setSessionMessage('Session fermée pour aujourd\'hui. Veuillez réessayer demain.');
            } else {
              console.log('✅ Session valide - connexion automatique');
              setIsAuthenticated(true);
              setCurrentUser(session.username);
              
              if (session.username === 'Hamza') {
                setSessionMessage('Bienvenue Hamza (Admin) - Session réactivée');
              } else {
                setSessionMessage('Bienvenue - Session réactivée');
              }
            }
          }
        } else {
          console.log('🔍 Aucune session active trouvée');
        }
        
        setIsLoading(false);
        
        return () => {
          clearInterval(cleanupInterval);
        };
      } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  const handleLogin = async (username: string) => {
    try {
      setIsAuthenticated(true);
      setCurrentUser(username);
      
      if (username === 'Hamza') {
        setSessionMessage('Bienvenue Hamza - Mode Administrateur');
      } else {
        setSessionMessage(`Bienvenue ${username} - Session active`);
      }
      
      setTimeout(() => {
        setSessionMessage('');
      }, 3000);
      
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
    }
  };

  const handleLogout = async () => {
    try {
      console.log('🚪 Déconnexion en cours...');
      
      if (currentUser) {
        await logoutUser(currentUser);
      }
      
      setIsAuthenticated(false);
      setCurrentUser('');
      
      if (currentUser === 'Hamza') {
        setSessionMessage('Déconnexion réussie - Session admin maintenue');
      } else {
        setSessionMessage('Déconnexion réussie - Session fermée');
      }
      
      console.log('✅ Déconnexion réussie, retour à l écran de login');
      
      setTimeout(() => {
        setSessionMessage('');
      }, 3000);
      
    } catch (error) {
      console.error('❌ Erreur lors de la déconnexion:', error);
      setIsAuthenticated(false);
      setCurrentUser('');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Initialisation</h2>
          <p className="text-gray-500">Vérification des sessions en cours...</p>
          <div className="mt-4 text-xs text-gray-400">
            <p>Fermeture automatique à minuit</p>
            <p>Nettoyage des sessions expirées</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App min-h-screen bg-gray-50">
      {sessionMessage && (
        <div className={`fixed top-0 left-0 right-0 z-50 p-4 text-center text-white font-semibold shadow-lg ${
          sessionMessage.includes('Bienvenue') || sessionMessage.includes('réussie') 
            ? 'bg-green-600' 
            : sessionMessage.includes('expiré') || sessionMessage.includes('fermée')
            ? 'bg-orange-600'
            : 'bg-blue-600'
        }`}>
          <div className="container mx-auto flex items-center justify-center space-x-2">
            {sessionMessage.includes('Bienvenue') && (
              <span className="text-lg">🎉</span>
            )}
            {sessionMessage.includes('expiré') && (
              <span className="text-lg">⏰</span>
            )}
            <span>{sessionMessage}</span>
            <button 
              onClick={() => setSessionMessage('')}
              className="ml-4 text-white/80 hover:text-white text-lg"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className={sessionMessage ? 'pt-16' : ''}>
        {isAuthenticated ? (
          <Dashboard username={currentUser} onLogout={handleLogout} />
        ) : (
          <LoginForm onLogin={handleLogin} />
        )}
      </div>

      {!isAuthenticated && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-gray-200 py-2">
          <div className="container mx-auto text-center">
            <div className="flex flex-col md:flex-row justify-center items-center space-y-1 md:space-y-0 md:space-x-6 text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Hamza: Accès admin illimité</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span>Ahlem/Islem: Session quotidienne</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                <span>Fermeture automatique à minuit</span>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default App;