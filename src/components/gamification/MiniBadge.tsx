import React from 'react';
import { UserBadge } from '../../types';
import { Trophy, Award, Star, Zap, Target, Shield, Flame, Crown, Sparkles } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface MiniBadgeProps {
  badges: UserBadge[];
  maxDisplay?: number;
  showLevel?: boolean;
  level?: number;
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

export const MiniBadge: React.FC<MiniBadgeProps> = ({ badges, maxDisplay = 3, showLevel = false, level }) => {
  const { theme } = useTheme();
  
  if ((!badges || badges.length === 0) && !showLevel) return null;

  return (
    <div className="flex items-center gap-1.5">
      {showLevel && level && (
        <div className={`px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-black shadow-sm`}>
          Lvl {level}
        </div>
      )}
      
      <div className="flex -space-x-1.5">
        {badges?.slice(0, maxDisplay).map((badge, idx) => (
          <div 
            key={badge.id} 
            title={badge.name}
            className={`w-5 h-5 rounded-full flex items-center justify-center border shadow-sm transition-transform hover:scale-110 hover:z-10 ${
              theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
            }`}
            style={{ 
              zIndex: maxDisplay - idx,
              color: badge.color || (theme === 'dark' ? '#60a5fa' : '#2563eb')
            }}
          >
            {getBadgeIcon(badge.icon, "w-3 h-3")}
          </div>
        ))}
        {badges?.length > maxDisplay && (
          <div className={`w-5 h-5 rounded-full flex items-center justify-center border text-[8px] font-bold shadow-sm ${
            theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-100 text-slate-500'
          }`}>
            +{badges.length - maxDisplay}
          </div>
        )}
      </div>
    </div>
  );
};
