import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, Award, Sparkles, Zap, Crown, Target, Shield, Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { LEVEL_CONFIGS, DEFAULT_LEVEL_CONFIG } from '../../constants/gamification';
import confetti from 'canvas-confetti';

interface LevelUpModalProps {
  level: number;
  onClose: () => void;
  isDemo?: boolean;
}

const getBadgeIcon = (iconName: string, className: string) => {
  switch (iconName) {
    case 'Trophy': return <Trophy className={className} />;
    case 'Award': return <Award className={className} />;
    case 'Star': return <Star className={className} />;
    case 'Zap': return <Zap className={className} />;
    case 'Target': return <Target className={className} />;
    case 'Shield': return <Shield className={className} />;
    case 'Flame': return <Flame className={className} />;
    case 'Crown': return <Crown className={className} />;
    case 'Sparkles': return <Sparkles className={className} />;
    default: return <Award className={className} />;
  }
};

export const LevelUpModal: React.FC<LevelUpModalProps> = ({ level: initialLevel, onClose, isDemo = false }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [currentLevel, setCurrentLevel] = useState(initialLevel);
  const [showConfetti, setShowConfetti] = useState(false);

  const config = LEVEL_CONFIGS[currentLevel] || { 
    ...DEFAULT_LEVEL_CONFIG,
    name: `${DEFAULT_LEVEL_CONFIG.name} Nível ${currentLevel}`, 
    desc: `${DEFAULT_LEVEL_CONFIG.desc} Você alcançou o nível ${currentLevel}.` 
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentLevel > 1) setCurrentLevel(prev => prev - 1);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentLevel(prev => prev + 1);
  };

  useEffect(() => {
    // Trigger confetti
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-black/80 backdrop-blur-md" 
        onClick={onClose} 
      />
      
      <motion.div 
        initial={{ scale: 0.5, opacity: 0, y: 100 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.5, opacity: 0, y: 100 }} 
        transition={{ type: "spring", damping: 15, stiffness: 100 }}
        className={`relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center text-center p-8 ${
          theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'
        }`}
      >
        {/* Navigation Arrows for Demo */}
        {isDemo && (
          <>
            <button 
              onClick={handlePrev}
              disabled={currentLevel <= 1}
              className={`absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full border transition-all ${
                theme === 'dark' 
                  ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700 disabled:opacity-30' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30'
              }`}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              onClick={handleNext}
              className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full border transition-all ${
                theme === 'dark' 
                  ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none" />
        
        {/* Badge Icon */}
        <motion.div 
          initial={{ rotate: -20, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ delay: 0.3, type: "spring", damping: 10 }}
          className="relative mb-8"
        >
          <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-30 animate-pulse" />
          <div 
            className={`w-32 h-32 rounded-full flex items-center justify-center relative z-10 border-4 shadow-2xl transition-all duration-500`}
            style={{ 
              borderColor: config.color,
              background: `linear-gradient(135deg, ${config.color}44, ${config.color}aa)`
            }}
          >
            <div className="text-white drop-shadow-lg scale-125">
              {getBadgeIcon(config.icon, "w-16 h-16")}
            </div>
            
            {/* Level Number Badge */}
            <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-blue-600 border-4 border-white dark:border-slate-900 flex items-center justify-center text-white font-black text-xl shadow-lg">
              {currentLevel}
            </div>
          </div>
          
          {/* Decorative Stars */}
          <motion.div 
            animate={{ scale: [1, 1.2, 1], rotate: [0, 15, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -top-4 -left-4 text-amber-400"
          >
            <Star className="w-8 h-8 fill-current" />
          </motion.div>
          <motion.div 
            animate={{ scale: [1, 1.3, 1], rotate: [0, -15, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, delay: 0.5 }}
            className="absolute top-0 -right-6 text-blue-400"
          >
            <Sparkles className="w-6 h-6 fill-current" />
          </motion.div>
        </motion.div>

        <h2 className={`text-3xl font-black mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          PARABÉNS! 🎉
        </h2>
        <p className={`text-lg font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          {isDemo ? 'Demonstração de Nível' : 'Você subiu para o'} <span className="text-blue-500 font-black">Nível {currentLevel}</span>
        </p>
        <p className={`text-sm italic mb-6 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
          "{config.phrase}"
        </p>

        <div className={`w-full p-4 rounded-2xl mb-8 flex items-center gap-4 text-left border transition-all duration-500 ${
          theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-blue-50 border-blue-100'
        }`}>
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${config.color}22`, color: config.color }}
          >
            {getBadgeIcon(config.icon, "w-7 h-7")}
          </div>
          <div>
            <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{config.name}</p>
            <p className="text-xs text-slate-500">{config.desc}</p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-600/20 active:scale-95"
        >
          CONTINUAR JORNADA
        </button>
      </motion.div>
    </div>
  );
};
