import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, User, Play, Award, Trophy, ChevronRight, Zap, Layout } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { gamificationService } from '../../services/gamificationService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { OnboardingSurvey } from './OnboardingSurvey';

interface OnboardingChecklistProps {
  onShowWelcomeVideo: () => void;
}

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({ onShowWelcomeVideo }) => {
  const { user, userProfile } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showSurvey, setShowSurvey] = useState(false);

  if (!userProfile?.isOnboarding) return null;

  const tasks = [
    {
      id: 'welcomeVideo',
      label: t('onboarding.welcomeVideo'),
      icon: <Play className="w-4 h-4" />,
      points: 50,
      completed: userProfile.onboardingTasks?.welcomeVideo,
      action: onShowWelcomeVideo
    },
    {
      id: 'exploreWall',
      label: t('onboarding.exploreWall'),
      icon: <Layout className="w-4 h-4" />,
      points: 20,
      completed: userProfile.onboardingTasks?.exploreWall,
      action: async () => {
        if (!user) return;
        if (!userProfile.onboardingTasks?.exploreWall) {
          await completeTask('exploreWall', 20);
        }
        navigate('/recognition');
      }
    },
    {
      id: 'firstRecognition',
      label: t('onboarding.firstRecognition'),
      icon: <Award className="w-4 h-4" />,
      points: 50,
      completed: userProfile.onboardingTasks?.firstRecognition,
      action: () => navigate('/recognition')
    },
    {
      id: 'checkLeaderboard',
      label: t('onboarding.checkLeaderboard'),
      icon: <Trophy className="w-4 h-4" />,
      points: 20,
      completed: userProfile.onboardingTasks?.checkLeaderboard,
      action: async () => {
        if (!user) return;
        if (!userProfile.onboardingTasks?.checkLeaderboard) {
          await completeTask('checkLeaderboard', 20);
        }
        navigate('/ranking');
      }
    },
    {
      id: 'firstModule',
      label: t('onboarding.firstModule'),
      icon: <CheckCircle2 className="w-4 h-4" />,
      points: 100,
      completed: userProfile.onboardingTasks?.firstModule,
      action: () => toast.info(t('onboarding.chooseTrail'))
    },
    {
      id: 'completeTrail',
      label: t('onboarding.completeTrail'),
      icon: <CheckCircle2 className="w-4 h-4" />,
      points: 200,
      completed: userProfile.onboardingTasks?.completeTrail,
      action: () => toast.info(t('onboarding.finishOnboarding'))
    },
    {
      id: 'satisfactionSurvey',
      label: t('onboarding.satisfactionSurvey'),
      icon: <CheckCircle2 className="w-4 h-4" />,
      points: 50,
      completed: userProfile.onboardingTasks?.satisfactionSurvey,
      action: () => setShowSurvey(true)
    }
  ];

  const completeTask = async (taskId: string, points: number) => {
    if (!user || !userProfile) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        [`onboardingTasks.${taskId}`]: true
      });
      
      await gamificationService.addPoints(user.uid, points, `Onboarding: ${taskId}`);
      toast.success(t('onboarding.taskCompleted', { task: t(`onboarding.${taskId}`), points }));
    } catch (error) {
      console.error("Erro ao completar tarefa de onboarding:", error);
    }
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const progress = Math.round((completedCount / tasks.length) * 100);

  if (progress === 100 && userProfile.onboardingFeedbackCompleted) return null;

  return (
    <>
      {showSurvey && <OnboardingSurvey onClose={() => setShowSurvey(false)} />}
      <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-6 rounded-2xl border shadow-lg relative overflow-hidden ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}
    >
      {completedCount >= tasks.length - 1 && !userProfile.onboardingTasks?.satisfactionSurvey && (
        <div className="absolute inset-0 z-10 bg-blue-600/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 text-white">
          <CheckCircle2 className="w-12 h-12 mb-4" />
          <h3 className="text-xl font-black mb-2">{t('onboarding.almostThere')}</h3>
          <p className="text-sm mb-6 opacity-90">{t('onboarding.finishOnboardingDesc')}</p>
          <button 
            onClick={() => setShowSurvey(true)}
            className="px-8 py-3 bg-white text-blue-600 font-black rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
          >
            {t('onboarding.surveySatisf')}
          </button>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className={`text-lg font-black flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <Zap className="w-5 h-5 text-amber-500" />
            {t('onboarding.checklist')}
          </h3>
          <p className="text-sm text-slate-500">{t('onboarding.completeTasksLabel')}</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-blue-600">{progress}%</span>
          <div className="w-24 h-2 bg-slate-100 rounded-full mt-1 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-blue-600"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={task.action}
            disabled={task.completed}
            className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left group ${
              task.completed 
                ? (theme === 'dark' ? 'bg-emerald-900/10 border-emerald-900/30 opacity-60' : 'bg-emerald-50 border-emerald-100 opacity-60')
                : (theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 border-slate-700' : 'bg-slate-50 hover:bg-slate-100 border-slate-200')
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                task.completed 
                  ? 'bg-emerald-500 text-white' 
                  : (theme === 'dark' ? 'bg-slate-700 text-slate-400 group-hover:text-white' : 'bg-white text-slate-400 group-hover:text-blue-600')
              }`}>
                {task.completed ? <CheckCircle2 className="w-5 h-5" /> : task.icon}
              </div>
              <div>
                <span className={`text-sm font-bold block ${task.completed ? 'text-emerald-600 line-through' : (theme === 'dark' ? 'text-white' : 'text-slate-900')}`}>
                  {task.label}
                </span>
                {!task.completed && (
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">
                    +{task.points} pontos
                  </span>
                )}
              </div>
            </div>
            {!task.completed && <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />}
          </button>
        ))}
      </div>
    </motion.div>
    </>
  );
};
