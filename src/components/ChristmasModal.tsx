import React, { useEffect, useState } from 'react';
import { X, Star, Sparkles, Award, Gift } from 'lucide-react';

interface ChristmasModalProps {
  username: string;
  onClose: () => void;
}

const ChristmasModal: React.FC<ChristmasModalProps> = ({ username, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        isVisible ? 'bg-black/50 backdrop-blur-sm' : 'bg-transparent'
      }`}
      onClick={handleClose}
    >
      <div
        className={`relative bg-gradient-to-br from-red-50 via-white to-green-50 rounded-2xl shadow-2xl max-w-2xl w-full transform transition-all duration-500 border-4 border-red-500 ${
          isVisible ? 'scale-100 opacity-100 rotate-0' : 'scale-50 opacity-0 rotate-12'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 0 80px rgba(220, 38, 38, 0.4), 0 0 40px rgba(34, 197, 94, 0.3)',
        }}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-red-100 hover:bg-red-200 text-red-600 transition-all duration-200 z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-red-500/20 to-transparent rounded-t-2xl">
          <div className="absolute top-2 left-4 animate-pulse">
            <Sparkles className="w-6 h-6 text-yellow-500" />
          </div>
          <div className="absolute top-4 right-8 animate-pulse" style={{ animationDelay: '0.5s' }}>
            <Star className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="absolute top-6 left-1/3 animate-pulse" style={{ animationDelay: '1s' }}>
            <Star className="w-4 h-4 text-red-400" />
          </div>
          <div className="absolute top-3 right-1/4 animate-pulse" style={{ animationDelay: '1.5s' }}>
            <Sparkles className="w-5 h-5 text-green-500" />
          </div>
        </div>

        <div className="p-8 pt-16 text-center">
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 animate-ping bg-yellow-400 rounded-full opacity-20"></div>
              <div className="relative bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full p-6 shadow-xl">
                <Award className="w-16 h-16 text-white" />
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Gift className="w-8 h-8 text-red-500 animate-bounce" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 via-green-600 to-red-600 bg-clip-text text-transparent">
                BRAVO {username.toUpperCase()} !
              </h1>
              <Gift className="w-8 h-8 text-green-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>

          <div className="space-y-6 mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border-2 border-red-300">
              <p className="text-xl text-gray-800 font-semibold mb-2">
                Pour vos performances exceptionnelles au cours de 2025
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-yellow-100 via-yellow-50 to-yellow-100 rounded-xl p-8 shadow-lg border-2 border-yellow-400 transform hover:scale-105 transition-transform duration-300">
              <div className="flex items-center justify-center gap-3 mb-3">
                <Award className="w-10 h-10 text-yellow-600" />
                <h2 className="text-3xl font-bold text-yellow-800">
                  MEILLEUR EMPLOYÉ
                </h2>
                <Award className="w-10 h-10 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold bg-gradient-to-r from-yellow-700 to-yellow-900 bg-clip-text text-transparent">
                DE L'ANNÉE 2025
              </p>
            </div>

            <div className="relative overflow-hidden bg-gradient-to-r from-green-500 via-red-500 to-green-500 rounded-xl p-1 shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-red-500 to-green-500 animate-pulse opacity-50"></div>
              <div className="relative bg-white rounded-lg p-8">
                <div className="flex items-center justify-center gap-3">
                  <Sparkles className="w-8 h-8 text-green-600 animate-spin" style={{ animationDuration: '3s' }} />
                  <h3 className="text-4xl font-extrabold bg-gradient-to-r from-green-600 via-red-600 to-green-600 bg-clip-text text-transparent">
                    BONNE ANNÉE 2026 !!
                  </h3>
                  <Sparkles className="w-8 h-8 text-red-600 animate-spin" style={{ animationDuration: '3s', animationDirection: 'reverse' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={handleClose}
              className="px-8 py-3 bg-gradient-to-r from-red-500 to-green-500 hover:from-red-600 hover:to-green-600 text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
            >
              <Star className="w-5 h-5" />
              <span>Merci !</span>
              <Star className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-green-500/20 to-transparent rounded-b-2xl">
          <div className="absolute bottom-2 left-4 animate-pulse" style={{ animationDelay: '2s' }}>
            <Gift className="w-5 h-5 text-red-500" />
          </div>
          <div className="absolute bottom-3 right-8 animate-pulse" style={{ animationDelay: '2.5s' }}>
            <Gift className="w-6 h-6 text-green-500" />
          </div>
          <div className="absolute bottom-4 left-1/3 animate-pulse" style={{ animationDelay: '3s' }}>
            <Star className="w-4 h-4 text-yellow-400" />
          </div>
        </div>

        <style>{`
          @keyframes snowfall {
            0% { transform: translateY(-100px) translateX(0); opacity: 1; }
            100% { transform: translateY(100vh) translateX(100px); opacity: 0; }
          }
        `}</style>
      </div>
    </div>
  );
};

export default ChristmasModal;
