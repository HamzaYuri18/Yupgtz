import React, { useState, useEffect } from 'react';
import { LogIn, User, Lock } from 'lucide-react';
import { authenticateUser, saveSession, getSession, canReconnect } from '../utils/auth';

interface LoginFormProps {
  onLogin: (username: string) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Nettoyer le cache des champs au chargement du composant
  useEffect(() => {
    clearFormCache();
  }, []);

  const clearFormCache = () => {
    // Réinitialiser les champs
    setUsername('');
    setPassword('');
    setError('');
    
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

    // Vérifier s'il y a une session active
    const existingSession = getSession();
    if (existingSession && existingSession.username !== username) {
      setError('Une autre session est active. Veuillez attendre qu\'elle expire.');
      setIsLoading(false);
      return;
    }

    // Authentifier l'utilisateur
    const user = authenticateUser(username, password);
    
    if (user) {
      saveSession(username);
      setTimeout(() => {
        setIsLoading(false);
        onLogin(username);
      }, 500);
    } else {
      setError('Nom d utilisateur ou mot de passe incorrect');
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
                />
              </div>
            </div>

            {error && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm shadow-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-emerald-600 to-gray-800 hover:from-emerald-700 hover:to-gray-900 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
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
            <p className="bg-gradient-to-r from-gray-600 to-gray-500 bg-clip-text text-transparent font-medium">Utilisateurs autorisés: Hamza, Ahlem, Islem</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;