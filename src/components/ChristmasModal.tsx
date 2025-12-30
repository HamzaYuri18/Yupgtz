import React, { useEffect, useState, useRef } from 'react';
import { X, Star, Sparkles, Award, Gift, Music } from 'lucide-react';

interface ChristmasModalProps {
  username: string;
  onClose: () => void;
}

interface Firework {
  id: number;
  x: number;
  y: number;
  color: string;
  particles: Particle[];
}

interface Particle {
  id: number;
  angle: number;
  speed: number;
  life: number;
}

const ChristmasModal: React.FC<ChristmasModalProps> = ({ username, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [fireworks, setFireworks] = useState<Firework[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fireworkIdRef = useRef(0);

  const playSound = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (!soundEnabled || !audioContextRef.current) return;

    try {
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + duration);

      oscillator.start(audioContextRef.current.currentTime);
      oscillator.stop(audioContextRef.current.currentTime + duration);
    } catch (error) {
      console.log('Audio error:', error);
    }
  };

  const playCelebrationSound = () => {
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((note, index) => {
      setTimeout(() => playSound(note, 0.3, 'triangle'), index * 100);
    });
  };

  const createFirework = () => {
    const colors = ['#ef4444', '#22c55e', '#eab308', '#3b82f6', '#a855f7', '#ec4899'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const x = Math.random() * 100;
    const y = Math.random() * 60 + 10;

    const particles: Particle[] = [];
    for (let i = 0; i < 30; i++) {
      particles.push({
        id: i,
        angle: (Math.PI * 2 * i) / 30,
        speed: Math.random() * 3 + 2,
        life: 1
      });
    }

    const newFirework: Firework = {
      id: fireworkIdRef.current++,
      x,
      y,
      color: randomColor,
      particles
    };

    playSound(800 + Math.random() * 400, 0.2, 'sawtooth');

    setFireworks(prev => [...prev, newFirework]);

    setTimeout(() => {
      setFireworks(prev => prev.filter(fw => fw.id !== newFirework.id));
    }, 1500);
  };

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();

    setTimeout(() => {
      setIsVisible(true);
      playCelebrationSound();
    }, 100);

    const fireworkInterval = setInterval(() => {
      createFirework();
    }, 800);

    setTimeout(() => {
      playCelebrationSound();
    }, 2000);

    return () => {
      clearInterval(fireworkInterval);
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
    if (!soundEnabled) {
      playCelebrationSound();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        isVisible ? 'bg-black/70 backdrop-blur-sm' : 'bg-transparent'
      }`}
      onClick={handleClose}
    >
      {fireworks.map(firework => (
        <div
          key={firework.id}
          className="absolute pointer-events-none"
          style={{
            left: `${firework.x}%`,
            top: `${firework.y}%`,
          }}
        >
          {firework.particles.map(particle => (
            <div
              key={particle.id}
              className="absolute w-2 h-2 rounded-full animate-firework"
              style={{
                backgroundColor: firework.color,
                transform: `rotate(${particle.angle}rad) translateX(0px)`,
                animation: `fireworkParticle 1.5s ease-out forwards`,
                '--particle-distance': `${particle.speed * 50}px`,
                boxShadow: `0 0 10px ${firework.color}, 0 0 20px ${firework.color}`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      ))}

      <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-snow"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-20px`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 5}s`,
            }}
          >
            <div
              className="w-2 h-2 bg-white rounded-full opacity-80"
              style={{
                boxShadow: '0 0 10px rgba(255, 255, 255, 0.8)',
              }}
            />
          </div>
        ))}
      </div>

      <div
        className={`relative bg-gradient-to-br from-red-50 via-white to-green-50 rounded-2xl shadow-2xl max-w-2xl w-full transform transition-all duration-500 border-4 border-red-500 ${
          isVisible ? 'scale-100 opacity-100 rotate-0' : 'scale-50 opacity-0 rotate-12'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 0 80px rgba(220, 38, 38, 0.4), 0 0 40px rgba(34, 197, 94, 0.3)',
        }}
      >
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <button
            onClick={toggleSound}
            className="p-2 rounded-full bg-yellow-100 hover:bg-yellow-200 text-yellow-600 transition-all duration-200 shadow-lg hover:scale-110"
            title={soundEnabled ? 'Désactiver le son' : 'Activer le son'}
          >
            <Music className={`w-5 h-5 ${soundEnabled ? '' : 'opacity-50'}`} />
          </button>
          <button
            onClick={handleClose}
            className="p-3 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all duration-200 shadow-lg hover:scale-110 font-bold"
            title="Fermer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-red-500/20 to-transparent rounded-t-2xl pointer-events-none">
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
              <div className="relative bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full p-6 shadow-xl animate-bounce">
                <Award className="w-16 h-16 text-white" />
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Gift className="w-8 h-8 text-red-500 animate-bounce" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 via-green-600 to-red-600 bg-clip-text text-transparent animate-pulse">
                BRAVO {username.toUpperCase()} !
              </h1>
              <Gift className="w-8 h-8 text-green-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>

          <div className="space-y-6 mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border-2 border-red-300 hover:scale-105 transition-transform duration-300">
              <p className="text-xl text-gray-800 font-semibold mb-2">
                Pour vos performances exceptionnelles au cours de 2025
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-6 h-6 text-yellow-500 fill-yellow-500 animate-pulse"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-r from-yellow-100 via-yellow-50 to-yellow-100 rounded-xl p-8 shadow-lg border-2 border-yellow-400 transform hover:scale-105 transition-transform duration-300">
              <div className="flex items-center justify-center gap-3 mb-3">
                <Award className="w-10 h-10 text-yellow-600 animate-spin" style={{ animationDuration: '3s' }} />
                <h2 className="text-3xl font-bold text-yellow-800">
                  MEILLEUR EMPLOYÉ
                </h2>
                <Award className="w-10 h-10 text-yellow-600 animate-spin" style={{ animationDuration: '3s', animationDirection: 'reverse' }} />
              </div>
              <p className="text-2xl font-bold bg-gradient-to-r from-yellow-700 to-yellow-900 bg-clip-text text-transparent">
                DE L'ANNÉE 2025
              </p>
            </div>

            <div className="relative overflow-hidden bg-gradient-to-r from-green-500 via-red-500 to-green-500 rounded-xl p-1 shadow-xl animate-pulse">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-red-500 to-green-500 opacity-50"></div>
              <div className="relative bg-white rounded-lg p-8">
                <div className="flex items-center justify-center gap-3">
                  <Sparkles className="w-8 h-8 text-green-600 animate-spin" style={{ animationDuration: '2s' }} />
                  <h3 className="text-4xl font-extrabold bg-gradient-to-r from-green-600 via-red-600 to-green-600 bg-clip-text text-transparent">
                    BONNE ANNÉE 2026 !!
                  </h3>
                  <Sparkles className="w-8 h-8 text-red-600 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={handleClose}
              className="px-8 py-4 bg-gradient-to-r from-red-500 to-green-500 hover:from-red-600 hover:to-green-600 text-white font-bold text-lg rounded-lg shadow-lg transform hover:scale-110 transition-all duration-200 flex items-center gap-2"
            >
              <Star className="w-6 h-6 animate-spin" style={{ animationDuration: '2s' }} />
              <span>Merci ! Fermer</span>
              <Star className="w-6 h-6 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
            </button>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-green-500/20 to-transparent rounded-b-2xl pointer-events-none">
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
          @keyframes fireworkParticle {
            0% {
              transform: rotate(var(--rotation, 0deg)) translateX(0px);
              opacity: 1;
            }
            100% {
              transform: rotate(var(--rotation, 0deg)) translateX(var(--particle-distance, 50px));
              opacity: 0;
            }
          }

          @keyframes snow {
            0% {
              transform: translateY(0) rotate(0deg);
            }
            100% {
              transform: translateY(100vh) rotate(360deg);
            }
          }

          .animate-firework {
            animation: fireworkParticle 1.5s ease-out forwards;
          }

          .animate-snow {
            animation: snow 10s linear infinite;
          }

          @keyframes twinkle {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.3;
              transform: scale(0.8);
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default ChristmasModal;
