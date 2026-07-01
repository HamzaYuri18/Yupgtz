import React, { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, FileText, ChevronRight } from 'lucide-react';

const AUTO_HIDE_MS = 5000;

const MemoireReglementNotification: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startAutoHide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
  };

  useEffect(() => {
    // Initial appearance after 1.8s
    const showTimer = setTimeout(() => {
      setVisible(true);
      startAutoHide();
    }, 1800);

    return () => {
      clearTimeout(showTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleOpen = () => {
    setVisible(true);
    startAutoHide();
  };

  const handleClose = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  return (
    <>
      {/* Persistent badge — always shown when popup is hidden */}
      <button
        onClick={handleOpen}
        title="Mémoires de règlements"
        className={`fixed left-4 bottom-4 z-[109] flex items-center justify-center w-11 h-11 rounded-full shadow-lg hover:shadow-xl bg-gradient-to-br from-gray-900 to-emerald-700 transition-all duration-300 hover:scale-110 ${
          visible ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <FileText className="w-5 h-5 text-white" />
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
      </button>

      {/* Notification popup */}
      <div
        className={`fixed left-4 bottom-4 z-[110] w-80 transition-all duration-500 ease-out ${
          visible
            ? 'translate-x-0 opacity-100'
            : '-translate-x-[22rem] opacity-0 pointer-events-none'
        }`}
      >
        {/* Auto-hide progress bar */}
        {visible && (
          <div className="h-1 rounded-t-2xl overflow-hidden bg-gray-200 mb-0">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{
                animation: `shrink ${AUTO_HIDE_MS}ms linear forwards`
              }}
            />
          </div>
        )}

        <style>{`
          @keyframes shrink {
            from { width: 100%; }
            to   { width: 0%; }
          }
        `}</style>

        <div className="bg-white/96 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-900 via-slate-800 to-emerald-700 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white/15 border border-white/20 rounded-xl flex items-center justify-center shadow-inner">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">Mémoires de règlements</p>
                <p className="text-white/55 text-[10px] mt-0.5">Nouvelle plateforme disponible</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors ml-2 flex-shrink-0"
              title="Fermer"
            >
              <X className="w-4 h-4 text-white/60 hover:text-white" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-4 space-y-3">
            <p className="text-gray-600 text-xs leading-relaxed">
              Établissez et gérez vos{' '}
              <span className="font-semibold text-gray-800">mémoires de règlements</span>{' '}
              depuis la plateforme dédiée — rapide, organisé et sécurisé.
            </p>

            <div className="w-full h-px bg-gray-100" />

            <a
              href="https://memoirereglement2026.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleClose}
              className="group flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-gray-900 text-white hover:from-emerald-400 hover:to-gray-800 active:scale-[0.98] transition-all shadow-md hover:shadow-lg"
            >
              <div className="flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-sm font-semibold">Accéder à la plateforme</span>
              </div>
              <ChevronRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default MemoireReglementNotification;
