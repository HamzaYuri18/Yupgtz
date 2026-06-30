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

// ── Splash Screen ─────────────────────────────────────────────────────────────
const SplashScreen: React.FC<{ visible: boolean }> = ({ visible }) => (
  <div
    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-all duration-700"
    style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'scale(1)' : 'scale(1.04)',
      pointerEvents: visible ? 'all' : 'none',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #064e3b 100%)',
    }}
  >
    {/* Cercles décoratifs */}
    <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10"
      style={{ background: 'radial-gradient(circle, #34d399, transparent)', transform: 'translate(30%, -30%)' }} />
    <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-10"
      style={{ background: 'radial-gradient(circle, #6366f1, transparent)', transform: 'translate(-30%, 30%)' }} />

    {/* Logo */}
    <div
      className="mb-8 transition-all duration-1000"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)' }}
    >
      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl mb-6 mx-auto"
        style={{ boxShadow: '0 0 60px rgba(52,211,153,0.4)' }}>
        <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
        </svg>
      </div>
      <h1 className="text-4xl font-extrabold text-white text-center tracking-tight">
        Gestion <span className="text-emerald-400">Assurance</span>
      </h1>
      <p className="text-slate-400 text-center mt-2 text-sm tracking-widest uppercase">Plateforme de gestion</p>
    </div>

    {/* Barre de chargement */}
    <div
      className="w-48 transition-all duration-1000 delay-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 rounded-full"
          style={{
            animation: 'splash-bar 1.8s ease-in-out infinite',
          }}
        />
      </div>
      <p className="text-slate-500 text-xs text-center mt-3">Vérification de la connexion…</p>
    </div>

    <style>{`
      @keyframes splash-bar {
        0%   { width: 0%; margin-left: 0%; }
        50%  { width: 70%; margin-left: 15%; }
        100% { width: 0%; margin-left: 100%; }
      }
    `}</style>
  </div>
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
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
      // Masquer le splash avec animation
      setSplashVisible(false);
      setTimeout(() => setSplashDone(true), 750);
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

  return (
    <>
      {/* Splash screen — monté jusqu'à la fin de l'animation */}
      {!splashDone && <SplashScreen visible={splashVisible} />}

      {/* Contenu principal (masqué pendant le splash) */}
      {splashDone && (
        <div className="App">
          {isOnline === false ? (
            /* ── Écran hors-ligne (inline) ── */
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 flex items-center justify-center p-6">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                <div className="bg-gradient-to-r from-red-600 to-red-700 px-8 py-6 text-center">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M4.929 19.071a9 9 0 010-12.728M8.464 15.536a5 5 0 010-7.072" />
                      <line x1="3" y1="3" x2="21" y2="21" strokeWidth={2} />
                    </svg>
                  </div>
                  <h1 className="text-xl font-bold text-white">Pas de connexion Internet</h1>
                </div>
                <div className="px-8 py-6 text-center">
                  <p className="text-gray-600 text-sm leading-relaxed mb-2">L'application nécessite une connexion Internet active pour fonctionner.</p>
                  <p className="text-gray-500 text-sm leading-relaxed mb-6">Travailler hors connexion entraînerait une <span className="font-semibold text-red-600">perte de données</span>.</p>
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
                      <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Vérification…</>
                    ) : (
                      <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Réessayer la connexion</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : isAuthenticated ? (
            <Dashboard username={currentUser} onLogout={handleLogout} />
          ) : (
            <LoginForm onLogin={handleLogin} />
          )}
        </div>
      )}
    </>
  );
}

export default App;
