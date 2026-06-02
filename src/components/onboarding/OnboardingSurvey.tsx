import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Send, X, CheckCircle2, MessageSquare, Heart, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { onboardingService } from '../../services/onboardingService';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface OnboardingSurveyProps {
  onClose: () => void;
}

export const OnboardingSurvey: React.FC<OnboardingSurveyProps> = ({ onClose }) => {
  const { user, userProfile } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  
  const [step, setStep] = useState(1);
  const [nps, setNps] = useState<number | null>(null);
  const [clarity, setClarity] = useState<number | null>(null);
  const [sentiment, setSentiment] = useState<'very_confident' | 'confident' | 'neutral' | 'confused' | null>(null);
  const [improvement, setImprovement] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [shareOnMural, setShareOnMural] = useState(false);

  const handleSubmit = async () => {
    if (!user || !userProfile || nps === null || clarity === null || !sentiment) return;
    
    setIsSubmitting(true);
    try {
      await onboardingService.submitFeedback({
        userId: user.uid,
        userName: userProfile.name,
        userEmail: userProfile.email,
        nps,
        clarity,
        sentiment,
        improvement: improvement.trim() || undefined
      });

      setIsCompleted(true);
      toast.success('Feedback enviado com sucesso! +50 pontos');
    } catch (error) {
      console.error('Error submitting survey:', error);
      toast.error('Erro ao enviar feedback. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCompleted) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`w-full max-w-md p-8 rounded-3xl text-center shadow-2xl ${
            theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'
          }`}
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className={`text-2xl font-black mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            ¡Obrigado pelo seu feedback!
          </h2>
          <p className={`mb-8 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            {t('onboarding.surveyDescription')}
          </p>
          <button
            onClick={onClose}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg hover:shadow-blue-500/20"
          >
            {t('onboarding.continue')}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden ${
          theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-blue-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black">{t('onboarding.satisfactionSurvey')}</h2>
              <p className="text-xs text-white/80 font-bold uppercase tracking-wider">Onboarding Xcelerate</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black bg-white/20 px-3 py-1 rounded-full">
              Passo {step} de 4
            </span>
          </div>
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <h3 className={`text-xl font-black mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {t('onboarding.howWasYourExperience')}
                  </h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    {t('onboarding.onboardingNPS')}
                  </p>
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-11 gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button
                      key={num}
                      onClick={() => setNps(num)}
                      className={`h-12 rounded-xl font-black transition-all border ${
                        nps === num
                          ? 'bg-blue-600 border-blue-600 text-white scale-110 shadow-lg'
                          : theme === 'dark'
                          ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  <span>{t('onboarding.notLikely')}</span>
                  <span>{t('onboarding.veryLikely')}</span>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <h3 className={`text-xl font-black mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {t('onboarding.infoClarity')}
                  </h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    {t('onboarding.infoClarityDesc')}
                  </p>
                </div>

                <div className="flex justify-center gap-4">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      onClick={() => setClarity(num)}
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border ${
                        clarity && clarity >= num
                          ? 'bg-amber-500 border-amber-500 text-white scale-110 shadow-lg'
                          : theme === 'dark'
                          ? 'bg-slate-800 border-slate-700 text-slate-600'
                          : 'bg-slate-50 border-slate-200 text-slate-300'
                      }`}
                    >
                      <Star className={`w-8 h-8 ${clarity && clarity >= num ? 'fill-current' : ''}`} />
                    </button>
                  ))}
                </div>
                <div className="text-center text-xs font-black text-amber-600 uppercase tracking-widest">
                  {clarity === 1 && t('onboarding.veryConfusing')}
                  {clarity === 2 && t('onboarding.unclear')}
                  {clarity === 3 && t('onboarding.reasonable')}
                  {clarity === 4 && t('onboarding.veryClear')}
                  {clarity === 5 && t('onboarding.exceptional')}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <h3 className={`text-xl font-black mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {t('onboarding.howDoYouFeel')}
                  </h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    {t('onboarding.firstWeekFeeling')}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'very_confident', label: 'Muito Confiante', icon: '🚀' },
                    { id: 'confident', label: 'Confiante', icon: '💪' },
                    { id: 'neutral', label: 'Neutro', icon: '😐' },
                    { id: 'confused', label: 'Um pouco confuso', icon: '🤔' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setSentiment(opt.id as any)}
                      className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-4 ${
                        sentiment === opt.id
                          ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                          : theme === 'dark'
                          ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-2xl">{opt.icon}</span>
                      <span className="font-bold">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <h3 className={`text-xl font-black mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {t('onboarding.whatCanWeImprove')}
                  </h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    {t('onboarding.whatCouldBeBetter')}
                  </p>
                </div>

                <textarea
                  value={improvement}
                  onChange={(e) => setImprovement(e.target.value)}
                  placeholder={t('onboarding.suggestionPlaceholder')}
                  className={`w-full h-32 p-4 rounded-2xl border resize-none focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                    theme === 'dark' 
                      ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-600' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                  }`}
                />

                <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                  theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-blue-50 border-blue-100'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                      <Heart className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        {t('onboarding.wantToShareOnWall')}
                      </p>
                      <p className="text-xs text-slate-500">{t('onboarding.feedbackWall')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShareOnMural(!shareOnMural)}
                    className={`w-12 h-6 rounded-full transition-all relative ${
                      shareOnMural ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <motion.div 
                      animate={{ x: shareOnMural ? 24 : 4 }}
                      className="w-4 h-4 bg-white rounded-full absolute top-1"
                    />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-10 flex items-center justify-between gap-4">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className={`px-8 py-4 rounded-2xl font-black transition-all ${
                  theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {t('common.back')}
              </button>
            )}
            
            <button
              onClick={() => {
                if (step < 4) setStep(step + 1);
                else handleSubmit();
              }}
              disabled={
                (step === 1 && nps === null) ||
                (step === 2 && clarity === null) ||
                (step === 3 && !sentiment) ||
                isSubmitting
              }
              className={`flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                step === 1 ? 'ml-auto max-w-[200px]' : ''
              }`}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : step === 4 ? (
                <>
                  <Send className="w-5 h-5" />
                  {t('onboarding.finishAndEarn', 'Finalizar e Ganhar 50 Pontos')}
                </>
              ) : (
                t('onboarding.next')
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);
