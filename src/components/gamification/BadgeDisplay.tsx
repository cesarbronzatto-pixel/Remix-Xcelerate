import React from 'react';
import { UserBadge } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { Trophy, Award, Star, Zap, Target, Shield, Flame, Crown, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface BadgeDisplayProps {
  badges: UserBadge[];
  title?: string;
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

export const BadgeDisplay: React.FC<BadgeDisplayProps> = ({ badges, title = "Minhas Conquistas" }) => {
  const { theme } = useTheme();

  if (!badges || badges.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
          <Award className={`w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-[#003366]'}`} />
          {title}
        </h2>
      </div>

      <div className="flex flex-wrap gap-4">
        {badges.map((badge) => (
          <motion.div
            key={badge.id}
            whileHover={{ scale: 1.05, y: -5 }}
            className={`group relative p-4 rounded-2xl border transition-all flex flex-col items-center text-center w-32 ${
              theme === 'dark' 
                ? 'bg-slate-900 border-slate-800 hover:border-blue-500/50 shadow-lg' 
                : 'bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200'
            }`}
          >
            <div 
              className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 transition-transform group-hover:rotate-12 ${
                theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'
              }`}
              style={{ color: badge.color || (theme === 'dark' ? '#60a5fa' : '#2563eb') }}
            >
              {getBadgeIcon(badge.icon, "w-8 h-8")}
            </div>
            <h3 className={`text-xs font-bold line-clamp-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {badge.name}
            </h3>
            
            {/* Tooltip */}
            <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 rounded-lg text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border ${
              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
            }`}>
              <p className="font-bold mb-1 text-blue-500">{badge.name}</p>
              <p>{badge.description}</p>
              <p className="mt-1 text-slate-500 italic">Conquistado em {new Date(badge.earnedAt).toLocaleDateString()}</p>
              <div className={`absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent ${
                theme === 'dark' ? 'border-t-slate-800' : 'border-t-white'
              }`} />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
