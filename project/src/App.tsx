import React, { useState, useEffect, useRef } from 'react';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import { getSession, getSessionDate, isAdmin, clearSession, isRestrictedUser, isUserLockedToday } from './utils/auth';
import { isSessionClosed } from './utils/sessionService';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const lockCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const session = getSession();
      if (session) {
        const dateSession = getSessionDate();
        const sessionClosed = await isSessionClosed(dateSession);

        if (sessionClosed && !isAdmin(session.username)) {
          setIsAuthenticated(false);
          setCurrentUser('');
        } else {
          // Vérifier si l'utilisateur restreint est déjà bloqué (déconnexion cascade)
          if (isRestrictedUser(session.username)) {
            const locked = await isUserLockedToday(session.username);
            if (locked) {
              clearSession();
              setIsAuthenticated(false);
              setCurrentUser('');
              setIsLoading(false);
              return;
            }
          }
          setIsAuthenticated(true);
          setCurrentUser(session.username);
        }
      }
      setIsLoading(false);
    };

    checkSession();
  }, []);

  // Vérification périodique : déconnecter Ahlem/Rouae si l'autre a été verrouillée
  useEffect(() => {
    if (!isAuthenticated || !isRestrictedUser(currentUser)) return;

    const checkLock = async () => {
      const locked = await isUserLockedToday(currentUser);
      if (locked) {
        clearSession();
        setIsAuthenticated(false);
        setCurrentUser('');
      }
    };

    // Vérifier toutes les 15 secondes
    lockCheckIntervalRef.current = setInterval(checkLock, 15000);

    return () => {
      if (lockCheckIntervalRef.current) {
        clearInterval(lockCheckIntervalRef.current);
      }
    };
  }, [isAuthenticated, currentUser]);

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
    <div className="App animate-app-enter">
      {isAuthenticated ? (
        <Dashboard username={currentUser} onLogout={handleLogout} />
      ) : (
        <LoginForm onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;
