import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import { getSession, getSessionDate, isAdmin } from './utils/auth';
import { isSessionClosed } from './utils/sessionService';
import { initializeSessionCleanup, startSessionCleanupInterval } from './utils/sessionCleanup';
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Vérifier s'il y a une session active au démarrage
    const checkSession = async () => {
      const session = getSession();
      if (session) {
        const dateSession = getSessionDate();
        const sessionClosed = await isSessionClosed(dateSession);

        // Si la session est fermée et l'utilisateur n'est pas admin, déconnecter
        if (sessionClosed && !isAdmin(session.username)) {
          setIsAuthenticated(false);
          setCurrentUser('');
        } else {
          setIsAuthenticated(true);
          setCurrentUser(session.username);
        }
      }
      setIsLoading(false);
    };

    checkSession();
  }, []);

  const handleLogin = (username: string) => {
    setIsAuthenticated(true);
    setCurrentUser(username);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {isAuthenticated ? (
        <Dashboard username={currentUser} onLogout={handleLogout} />
      ) : (
        <LoginForm onLogin={handleLogin} />
      )}
    </div>
  );
}
// Au chargement de l'application
useEffect(() => {
  initializeSessionCleanup();
  const interval = startSessionCleanupInterval();
  
  return () => clearInterval(interval);
}, []);

export default App;
