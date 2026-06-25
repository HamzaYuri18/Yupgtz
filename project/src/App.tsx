import React, { useState, useEffect, useRef, useCallback } from 'react';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import { getSession, getSessionDate, isAdmin, clearSession, isRestrictedUser, isUserLockedToday } from './utils/auth';
import { isSessionClosed } from './utils/sessionService';
import { supabase } from './lib/supabase';
import { syncMissingCredits } from './utils/supabaseService';

// Vérifie la connectivité en tentant un appel réel à Supabase
const checkConnectivity = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from('rapport').select('id').limit(1);
    if (error) {
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed')) return false;
    }
    return true;
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('fetch') || msg.includes('network')) return false;
    return true;
  }
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [retrying, setRetrying] = useState(false);
  const lockCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runConnectivityCheck = useCallback(async () => {
    const online = await checkConnectivity();
    setIsOnline(online);
    return online;
  }, []);

  useEffect(() => {
    const init = async () => {
      // 1. Vérifier la connectivité d'abord
      const online = await runConnectivityCheck();
      if (!online) {
        setIsLoading(false);
        return;
      }

      // 2. Vérifier la session existante
      const session = getSession();
      if (session) {
        const dateSession = getSessionDate();
        const sessionClosed = await isSessionClosed(dateSession);

        if (sessionClosed && !isAdmin(session.username)) {
          setIsAuthenticated(false);
          setCurrentUser('');
        } else {
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
          // Synchroniser les crédits manquants au reprise de session
          syncMissingCredits().catch(console.error);
        }
      }
      setIsLoading(false);
    };

    init();

    // Écouter les événements réseau natifs
    const handleOffline = () => setIsOnline(false);
    const handleOnline = () => { runConnectivityCheck(); };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // Vérification périodique toutes les 90 secondes
    connCheckRef.current = setInterval(() => { runConnectivityCheck(); }, 90000);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (connCheckRef.current) clearInterval(connCheckRef.current);
    };
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

    lockCheckIntervalRef.current = setInterval(checkLock, 15000);

    return () => {
      if (lockCheckIntervalRef.current) clearInterval(lockCheckIntervalRef.current);
    };
  }, [isAuthenticated, currentUser]);

  const handleLogin = (username: string) => {
    setIsAuthenticated(true);
    setCurrentUser(username);
    // Synchroniser les crédits manquants après connexion
    syncMissingCredits().catch(console.error);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser('');
  };

  const handleRetry = async () => {
    setRetrying(true);
    const online = await checkConnectivity();
    setIsOnline(online);
    if (online) {
      setIsLoading(true);
      // Re-vérifier la session après reconnexion
      const session = getSession();
      if (session) {
        setIsAuthenticated(true);
        setCurrentUser(session.username);
      }
      setIsLoading(false);
    }
    setRetrying(false);
  };

  // ── Écran hors-ligne ──────────────────────────────────────────────────────
  if (isOnline === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
          {/* Header rouge */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 px-8 py-6 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M4.929 19.071a9 9 0 010-12.728M8.464 15.536a5 5 0 010-7.072" />
                <line x1="3" y1="3" x2="21" y2="21" strokeWidth={2} />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">Pas de connexion Internet</h1>
          </div>

          {/* Body */}
          <div className="px-8 py-6 text-center">
            <p className="text-gray-600 text-sm leading-relaxed mb-2">
              L'application nécessite une connexion Internet active pour fonctionner.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Toutes les transactions sont enregistrées en temps réel — travailler hors connexion
              entraînerait une <span className="font-semibold text-red-600">perte de données</span>.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">À vérifier</p>
              <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                <li>Votre connexion Wi-Fi ou câble réseau</li>
                <li>L'accès à Internet sur cet ordinateur</li>
              </ul>
            </div>

            <button
              onClick={handleRetry}
              disabled={retrying}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {retrying ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Vérification en cours…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Réessayer la connexion
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Chargement initial ───────────────────────────────────────────────────
  if (isLoading || isOnline === null) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{isOnline === null ? 'Vérification de la connexion…' : 'Chargement…'}</p>
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
