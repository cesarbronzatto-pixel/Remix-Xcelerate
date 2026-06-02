import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'sonner';
import { User, Camera, Save, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function Settings() {
  const { user, userProfile } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState(userProfile?.name || '');
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const updateData: any = {
        name,
        photoURL
      };

      await updateDoc(userRef, updateData);
      toast.success(t('settings.success'));
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      toast.error(t('settings.error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 lg:p-12 max-w-4xl mx-auto">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {t('common.back')}
      </button>

      <div className="mb-8">
        <h1 className={`text-3xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('settings.title')}</h1>
        <p className="text-slate-500 mt-2">{t('settings.profile')}</p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl border p-8 ${
          theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <form onSubmit={handleSave} className="space-y-8">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="relative group">
              <div className={`w-32 h-32 rounded-3xl overflow-hidden border-4 transition-all ${
                theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-blue-50 border-white shadow-lg'
              }`}>
                {photoURL ? (
                  <img src={photoURL} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <User className="w-12 h-12" />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg cursor-pointer hover:bg-blue-700 transition-colors">
                <Camera className="w-5 h-5" />
              </div>
            </div>

            <div className="flex-1 w-full space-y-4">
              <div>
                <label className={`block text-sm font-bold mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                  {t('settings.name')}
                </label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('settings.name')}
                  className={`w-full px-4 py-3 rounded-xl text-sm outline-none transition-all ${
                    theme === 'dark' 
                      ? 'bg-slate-800 text-white border-slate-700 focus:border-blue-500' 
                      : 'bg-slate-50 text-slate-900 border-slate-200 focus:border-blue-300'
                  } border`}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block text-sm font-bold mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                {t('settings.name')}
              </label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={`w-full px-4 py-3 rounded-xl text-sm outline-none transition-all ${
                  theme === 'dark' 
                    ? 'bg-slate-800 text-white border-slate-700 focus:border-blue-500' 
                    : 'bg-slate-50 text-slate-900 border-slate-200 focus:border-blue-300'
                } border`}
              />
            </div>
            <div>
              <label className={`block text-sm font-bold mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                {t('settings.email')}
              </label>
              <input 
                type="email" 
                value={user?.email || ''}
                disabled
                className={`w-full px-4 py-3 rounded-xl text-sm bg-slate-100 dark:bg-slate-800/50 text-slate-400 border-slate-200 dark:border-slate-700 border cursor-not-allowed`}
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {t('settings.save')}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
