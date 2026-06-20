import React, { useState, useEffect } from 'react';
import { X, ExternalLink, FileText, ChevronRight } from 'lucide-react';

const STORAGE_KEY = 'memoire-notif-dismissed-v1';

const MemoireReglementNotification: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY)) {
      setDismissed(true);
      return;
    }
    const show = setTimeout(() => setVisible(true), 1800);
    const stopPulse = setTimeout(() => setPulse(false), 6000);
    return () => { clearTimeout(show); clearTimeout(stopPulse); };
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => {
      setDismissed(true);
      sessionStorage.setItem(STORAGE_KEY, '1');
    }, 450);
  };

  if (dismissed) return null;

  return (
    <div
      className={`fixed left-4 bottom-4 z-[110] w-80 transition-all duration-500 ease-out ${
        visible ? 'translate-x-0 opacity-100' : '-translate-x-[22rem] opacity-0'
      }`}
    >
      {/* Pulsing indicator dot */}
      {visible && pulse && (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 z-10">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500" />
        </span>
      )}

      <div className="bg-white/96 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">

        {/* Header gradient */}
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
            onClick={handleDismiss}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors ml-2 flex-shrink-0"
            title="Fermer"
          >
            <X className="w-4 h-4 text-white/60 hover:text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-3">
          {/* Description */}
          <p className="text-gray-600 text-xs leading-relaxed">
            Établissez et gérez vos{' '}
            <span className="font-semibold text-gray-800">mémoires de règlements</span>{' '}
            depuis la plateforme dédiée — rapide, organisé et sécurisé.
          </p>

          {/* Divider */}
          <div className="w-full h-px bg-gray-100" />

          {/* CTA button */}
          <a
            href="https://memoirereglement2026.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-gray-900 text-white hover:from-emerald-400 hover:to-gray-800 active:scale-[0.98] transition-all shadow-md hover:shadow-lg"
            onClick={handleDismiss}
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-sm font-semibold">Accéder à la plateforme</span>
            </div>
            <ChevronRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
          </a>

          {/* Dismiss link */}
          <button
            onClick={handleDismiss}
            className="w-full text-center text-[10px] text-gray-400 hover:text-gray-500 transition-colors"
          >
            Ne plus afficher pour cette session
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemoireReglementNotification;
