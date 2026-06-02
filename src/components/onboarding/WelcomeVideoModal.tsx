import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, CheckCircle2, Award } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { gamificationService } from '../../services/gamificationService';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { VideoPlayer } from '../VideoPlayer';

interface WelcomeVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WelcomeVideoModal: React.FC<WelcomeVideoModalProps> = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user, userProfile } = useAuth();
  const [isVideoFinished, setIsVideoFinished] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  useEffect(() => {
    if (isOpen && userProfile?.countryId) {
      const fetchCountryVideo = async () => {
        try {
          const countryRef = doc(db, 'countries', userProfile.countryId!);
          const countrySnap = await getDoc(countryRef);
          if (countrySnap.exists() && countrySnap.data().welcomeVideoUrl) {
            setVideoUrl(countrySnap.data().welcomeVideoUrl);
          }
        } catch (error) {
          console.error("Erro ao buscar link do vídeo do país:", error);
        }
      };
      fetchCountryVideo();
    }
  }, [isOpen, userProfile?.countryId]);

  if (!isOpen || !userProfile?.isOnboarding) return null;

  const handleVideoEnd = () => {
    setIsVideoFinished(true);
  };

  const handleToggleFullScreen = () => {
    if (!modalRef.current) return;
    if (!document.fullscreenElement) {
      modalRef.current.requestFullscreen().catch(err => console.error('Erro de tela cheia:', err));
    } else {
      document.exitFullscreen();
    }
  };

  const handleClaimPoints = async () => {
    if (!user || !userProfile) return;
    setIsClaiming(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'onboardingTasks.welcomeVideo': true
      });
      
      await gamificationService.addPoints(user.uid, 50, 'Onboarding: Vídeo de Boas-vindas');
      toast.success(t('onboarding.taskCompleted', { task: t('onboarding.welcomeVideo'), points: 50 }));
      onClose();
    } catch (error) {
      console.error("Erro ao resgatar pontos do vídeo:", error);
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <AnimatePresence>
      <div className={`fixed inset-0 z-[110] flex items-center justify-center p-4 ${isFullScreen ? 'p-0' : 'p-4'}`}>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/90 backdrop-blur-md"
          onClick={!isFullScreen ? onClose : undefined}
        />
        
        <motion.div 
          ref={modalRef}
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className={`relative w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl max-h-[95vh] flex flex-col ${
            isFullScreen ? 'h-full max-w-none rounded-none max-h-[100vh]' : ''
          } ${
            theme === 'dark' ? 'bg-slate-900' : 'bg-white'
          }`}
        >
          {!isFullScreen && (
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 z-[120] p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          )}

          <div className={`p-6 sm:p-10 text-center overflow-y-auto ${isFullScreen ? 'h-full flex flex-col justify-center p-0 sm:p-0 overflow-hidden' : ''}`}>
            {!isVideoFinished ? (
              <>
                {!isFullScreen && (
                  <div className="mb-6">
                    <h2 className={`text-2xl sm:text-3xl font-black mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {t('onboarding.welcomeTitle')}
                    </h2>
                    <p className="text-sm sm:text-base text-slate-500">{t('onboarding.welcomeSubtitle')}</p>
                  </div>
                )}

                <div className={`relative rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10 group ${isFullScreen ? 'flex-1 rounded-none border-0' : 'aspect-video'}`}>
                  <VideoPlayer 
                    src={videoUrl}
                    onComplete={handleVideoEnd}
                    onToggleFullScreen={handleToggleFullScreen}
                    isFullScreen={isFullScreen}
                  />
                  
                  {/* Botão para simular fim do vídeo se o player não disparar onComplete automaticamente */}
                  {!isFullScreen && (
                    <button 
                      onClick={handleVideoEnd}
                      className="absolute bottom-16 right-4 z-[70] px-4 py-2 bg-blue-600/50 hover:bg-blue-600 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {t('onboarding.skipVideo')}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 flex flex-col items-center"
              >
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-8 animate-bounce">
                  <Award className="w-12 h-12" />
                </div>
                <h2 className={`text-4xl font-black mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {t('onboarding.onboardingCompleted')}
                </h2>
                <p className="text-xl text-slate-500 mb-8 max-w-md">
                  {t('onboarding.onboardingVideoReady')}
                </p>
                
                <button
                  onClick={handleClaimPoints}
                  disabled={isClaiming}
                  className="px-12 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/20 transition-all transform hover:scale-105 flex items-center gap-3 disabled:opacity-50"
                >
                  {isClaiming ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-6 h-6" />
                      RESGATAR 50 PONTOS
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
