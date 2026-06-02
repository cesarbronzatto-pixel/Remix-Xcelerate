import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { login } = useAuth();

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login();
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Login cancelado. Se o problema persistir, tente abrir o app em uma nova aba.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('O popup foi bloqueado pelo seu navegador. Por favor, permita popups para este site ou abra em uma nova aba.');
      } else {
        setError(t('auth.error') + (err.message ? ` (${err.message})` : ''));
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'pt' ? 'es' : 'pt');
  };

  return (
    <div 
      className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans bg-slate-50 bg-cover bg-center bg-no-repeat"
      style={{ 
        backgroundImage: 'url(https://i.imgur.com/gFtzgER.png)'
      }}
    >
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Xcelerate</h2>
          <p className="mt-2 text-slate-600">Plataforma de Conhecimento e Performance</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md py-10 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-white/20">
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-3 mb-6">
              <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {t('auth.selectLanguage', 'Idioma / Lenguaje')}
              </label>
              <div className="flex bg-white/40 p-1 rounded-xl w-full max-w-xs shadow-inner">
                <button
                  onClick={() => i18n.changeLanguage('pt')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                    i18n.language === 'pt' 
                      ? 'bg-white text-blue-700 shadow-md transform scale-105' 
                      : 'text-slate-700 hover:bg-white/50'
                  }`}
                >
                  🇧🇷 Português
                </button>
                <button
                  onClick={() => i18n.changeLanguage('es')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                    i18n.language === 'es' 
                      ? 'bg-white text-blue-700 shadow-md transform scale-105' 
                      : 'text-slate-700 hover:bg-white/50'
                  }`}
                >
                  🇪🇸 Español
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/30 text-red-100 px-4 py-3 rounded-xl text-sm font-medium space-y-2">
                <p>{error}</p>
                <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="text-xs underline font-bold hover:text-white block"
                >
                  Abrir em nova aba
                </button>
              </div>
            )}

            <div className="text-center mt-6">
              <p className="text-sm text-slate-800 mb-6 font-medium bg-white/40 inline-block px-4 py-1.5 rounded-full">
                {t('auth.onlyXertica')}
              </p>
              
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 border border-xertica-light/20 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] text-base font-bold text-slate-800 bg-white hover:bg-slate-50 hover:shadow-[0_8px_30px_rgb(0,0,0,0.16)] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer transition-all border-b-4 border-slate-200 active:border-b active:translate-y-1"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                ) : (
                  <>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                    {t('auth.loginWithGoogle', 'Entrar com Google')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        
        <p className="mt-8 text-center text-xs text-slate-500 font-medium">
          &copy; {new Date().getFullYear()} Xertica. All rights reserved.
        </p>
      </div>
    </div>
  );
}
