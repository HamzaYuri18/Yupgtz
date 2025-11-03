import React, { useState, useEffect } from 'react';
import { LogIn, User, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { authenticateUserWithSession, getSession, initializeAuth } from '../utils/auth';

interface LoginFormProps {
  onLogin: (username: string) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Nettoyer le cache des champs et initialiser l'authentification au chargement
  useEffect(() => {
    const initialize = async () => {
      setIsInitializing(true);
      await initializeAuth();
      
      // Vérifier s'il y a une session active
      const existingSession = getSession();
      if (existingSession) {
        // Si session admin (Hamza), reconnecter automatiquement
        if (existingSession.username === 'Hamza') {
          onLogin(existingSession.username);
          return;
        }
        
        // Pour les autres utilisateurs, vérifier si la session est toujours valide
        const now = new Date();
        const sessionDate = new Date(existingSession.loginTime);
        if (sessionDate.toDateString() === now.toDateString()) {
          onLogin(existingSession.username);
          return;
        } else {
          // Session expirée, nettoyer
          localStorage.removeItem('session');
        }
      }
      
      clearFormCache();
      setIsInitializing(false);
    };

    initialize();
  }, [onLogin]);

  const clearFormCache = () => {
    // Réinitialiser les champs
    setUsername('');
    setPassword('');
    setError('');
    setMessage('');
    
    // Nettoyer le cache du navigateur pour ces champs
    if (typeof window !== 'undefined') {
      // Forcer le navigateur à oublier les valeurs autoremplies
      const inputs = document.querySelectorAll('input[type="text"], input[type="password"]');
      inputs.forEach(input => {
        (input as HTMLInputElement).value = '';
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    // Vérifier s'il y a une session active
    const existingSession = getSession();
    if (existingSession && existingSession.username !== username) {
      setError('Une autre session est active. Veuillez attendre qu\'elle expire.');
      setIsLoading(false);
      return;
    }

    // Authentifier l'utilisateur avec vérification de session
    const authResult = await authenticateUserWithSession(username, password);
    
    if (authResult.success) {
      // Afficher le message approprié
      setMessage(authResult.message);
      
      setTimeout(() => {
        setIsLoading(false);
        onLogin(username);
      }, 1500);
    } else {
      setError(authResult.message);
      setIsLoading(false);
    }
  };

  // Fonction pour forcer le nettoyage des champs
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // S'assurer que le champ est vide au focus
    if (e.target.value === '' && (e.target.type === 'text' || e.target.type === 'password')) {
      e.target.value = '';
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-emerald-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20 text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-emerald-600 to-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <User className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Initialisation...</h2>
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-600 mt-4">Vérification des sessions en cours</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-emerald-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-emerald-600 to-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <User className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-emerald-700 bg-clip-text text-transparent">SHIRI FARES HAMZA</h1>
            <p className="text-gray-600 mt-2 font-medium">Système de Gestion d'Agence</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Nom d'utilisateur
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-emerald-600 w-5 h-5" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={handleInputFocus}
                  autoComplete="off"
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 bg-gray-50/50"
                  placeholder="Entrez votre nom d'utilisateur"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-emerald-600 w-5 h-5" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={handleInputFocus}
                  autoComplete="new-password"
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 bg-gray-50/50"
                  placeholder="Entrez votre mot de passe"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {error && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm shadow-sm flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm shadow-sm flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-emerald-600 to-gray-800 hover:from-emerald-700 hover:to-gray-900 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none disabled:hover:shadow-lg"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/70 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Se connecter</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p className="bg-gradient-to-r from-gray-600 to-gray-500 bg-clip-text text-transparent font-medium">
              Utilisateurs autorisés: Hamza, Ahlem, Islem
            </p>
            <div className="mt-2 text-xs text-gray-400 space-y-1">
              <p>• Hamza: Accès administrateur illimité</p>
              <p>• Ahlem/Islem: Session quotidienne (fermeture à minuit)</p>
            </div>
          </div>

          {/* Information sur le statut des sessions */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2 text-xs text-blue-700">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              <span>
                <strong>Info:</strong> Les sessions se ferment automatiquement à minuit
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;