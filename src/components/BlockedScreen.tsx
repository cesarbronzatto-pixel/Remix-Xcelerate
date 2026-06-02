import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Lock, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export default function BlockedScreen() {
  const { logout, userProfile } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${
      theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'
    }`}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`max-w-md w-full p-8 rounded-3xl border shadow-2xl text-center ${
          theme === 'dark' ? 'bg-slate-900 border-rose-500/30' : 'bg-white border-rose-100'
        }`}
      >
        <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-rose-600" />
        </div>
        
        <h1 className={`text-2xl font-black mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          {t('blocked.title')}
        </h1>
        
        <p className={`text-lg mb-8 leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          {t('blocked.subtitle')}
        </p>

        {userProfile?.leaderName && (
          <div className={`mb-8 p-4 rounded-xl text-sm ${theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
            <p className="font-bold mb-1">{t('blocked.yourLeader')}</p>
            <p>{userProfile.leaderName} ({userProfile.leaderEmail})</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => logout()}
            className={`w-full flex items-center justify-center gap-2 px-6 py-3 font-bold rounded-xl transition-all ${
              theme === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <LogOut className="w-5 h-5" />
            {t('blocked.logout')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
