import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import { getSession, initializeAuth } from './utils/auth';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initApp = async () => {
      try {
        console.log('🚀 Initialisation de l application...');
        await initializeAuth();
        
        const session = getSession();
        if (session) {
          console.log('✅ Session trouvée:', session.username);
          setIsAuthenticated(true);
          setCurrentUser(session.username);
        } else {
          console.log('🔍 Aucune session trouvée');
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('❌ Erreur initialisation:', error);
        setIsLoading(false);
      }
    };

    initApp();
  }, []);

  const handleLogin = (username: string) => {
    console.log('✅ Connexion réussie:', username);
    setIsAuthenticated(true);
    setCurrentUser(username);
  };

  const handleLogout = () => {
    console.log('🚪 Déconnexion');
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

export default App;