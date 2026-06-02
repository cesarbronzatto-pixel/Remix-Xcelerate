import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import { useTranslation } from 'react-i18next';
import { Globe, LogOut, Settings, Play, Info, Bell, X, Lock, CheckCircle2, ChevronRight, ChevronLeft, Search, ChevronDown, BookOpen, GraduationCap, Award, Zap, Trophy, FileText, Presentation, Video as VideoIcon, Link as LinkIcon, ExternalLink, BookMarked, Layout, Star, Briefcase, Trash2 } from 'lucide-react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { collection, getDocs, query, where, setDoc, doc, orderBy, limit, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { Area, Trail, Module, UserProgress, PlaybookContent, Project, PlaybookSession, EirDay } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { BadgeDisplay } from '../components/gamification/BadgeDisplay';
import { LevelUpModal } from '../components/gamification/LevelUpModal';
import { formatDisplayName } from '../lib/utils';
import { notificationService } from '../services/notificationService';
import { OnboardingChecklist } from '../components/onboarding/OnboardingChecklist';
import { WelcomeVideoModal } from '../components/onboarding/WelcomeVideoModal';
import { gamificationService } from '../services/gamificationService';
import { onboardingService } from '../services/onboardingService';
import EirJourneyPlayer from '../components/eir/EirJourneyPlayer';
import { toast } from 'sonner';

// --- Playbook Sessions Constant (Deprecated - now dynamic) ---
// const PLAYBOOK_SESSIONS = (t: any) => [
//   { id: 'fairDecision', title: t('playbook.fairDecision'), icon: '⚖️', description: t('playbook.fairDecisionSub') },
//   { id: 'culture', title: t('playbook.culture'), icon: '🌟', description: t('playbook.cultureSub') },
//   { id: 'gemini', title: t('playbook.gemini'), icon: '✨', description: t('playbook.geminiSub') },
//   { id: 'cloud', title: t('playbook.cloud'), icon: '☁️', description: t('playbook.cloudSub') },
//   { id: 'workspace', title: t('playbook.workspace'), icon: '💼', description: t('playbook.workspaceSub') },
// ];

// --- Componente Modal Quick View ---
const QuickViewModal = ({ trail, onClose, user, userProfile, isMandatory }: { 
  trail: Trail, 
  onClose: () => void,
  user: any,
  userProfile: any,
  isMandatory: boolean
}) => {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [dynamicDeadline, setDynamicDeadline] = useState<string | null>(null);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        // Fetch Modules
        const qModules = query(collection(db, 'modules'), where('trailId', '==', trail.id));
        const snapModules = await getDocs(qModules);
        const mods = snapModules.docs.map(d => ({ id: d.id, ...d.data() } as Module)).sort((a, b) => a.order - b.order);
        setModules(mods);

        // Check Enrollment
        const qProgress = query(
          collection(db, 'user_progress'), 
          where('userId', '==', user.uid), 
          where('trailId', '==', trail.id)
        );
        const snapProgress = await getDocs(qProgress);
        
        const progressData = snapProgress.docs.map(d => d.data() as UserProgress);
        const hasProgress = !snapProgress.empty;
        const isPublic = trail.isPublic;

        setIsEnrolled(hasProgress || isMandatory || !isPublic);

        // Calculate progress percentage
        if (mods.length > 0) {
          const completedCount = progressData.filter(p => p.status === 'completed').length;
          setProgressPercentage(Math.round((completedCount / mods.length) * 100));
        }

        // Calculate Dynamic Deadline
        if (trail.isPublic || trail.isSlowTraining) {
          const firstProgress = progressData[0];
          if (firstProgress?.enrolledAt) {
            const date = new Date(firstProgress.enrolledAt);
            date.setDate(date.getDate() + 90);
            setDynamicDeadline(date.toISOString().split('T')[0]);
          }
        } else if (trail.isOnboardingTrail && userProfile?.onboardingActivatedAt) {
          const date = new Date(userProfile.onboardingActivatedAt);
          date.setDate(date.getDate() + 7);
          setDynamicDeadline(date.toISOString().split('T')[0]);
        }
      } catch (error) {
        console.error("Erro ao buscar dados da trilha:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [trail.id, user, trail.isMandatory, trail.isPublic, trail.isSlowTraining, trail.isOnboardingTrail, userProfile?.onboardingActivatedAt]);

  const handleEnroll = async () => {
    if (!trail || !user || !modules.length) return;
    setIsEnrolling(true);
    try {
      // 1. Notify leader
      if (userProfile?.leaderEmail) {
        await notificationService.notifyLeader(
          userProfile.name,
          userProfile.leaderEmail,
          t('learning.enrolledNotifyLeader', { trailTitle: trail.title })
        );
      }

      // 2. Create initial progress for first module
      const firstModule = modules[0];
      const progressId = `${user.uid}_${firstModule.id}`;
      const now = Date.now();
      const newProgress: UserProgress = {
        id: progressId,
        userId: user.uid,
        areaId: userProfile?.areaId || null,
        trailId: trail.id!,
        moduleId: firstModule.id!,
        status: 'in_progress', // Changed to in_progress to show in dashboard
        videoPercentage: 0,
        timeSpentSeconds: 0,
        highestQuizScore: 0,
        quizAttempts: 0,
        pointsAwarded: {
          video: false,
          quiz: false
        },
        lastUpdatedAt: now,
        enrolledAt: now
      };
      await setDoc(doc(db, 'user_progress', progressId), newProgress);
      
      setIsEnrolled(true);
      toast.success(t('learning.enrolledSuccess'));

      // Update dynamic deadline if public or slow training
      if (trail.isPublic || trail.isSlowTraining) {
        const date = new Date(now);
        date.setDate(date.getDate() + 90);
        setDynamicDeadline(date.toISOString().split('T')[0]);
      }
    } catch (error) {
        console.error("Erro ao se inscrever:", error);
        toast.error(t('learning.enrolledError'));
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
        onClick={onClose} 
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.95, opacity: 0, y: 20 }} 
        className={`relative w-full max-w-4xl rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}
      >
        {/* Header com Imagem/Gradiente */}
        <div className={`relative h-64 sm:h-80 flex-shrink-0 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
          <div className={`absolute inset-0 z-10 ${theme === 'dark' ? 'bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent' : 'bg-gradient-to-t from-white via-white/40 to-transparent'}`} />
          <img 
            src={trail.imageUrl || `https://picsum.photos/seed/${trail.id}/1920/1080`} 
            alt={trail.title}
            className="w-full h-full object-cover opacity-80"
            referrerPolicy="no-referrer"
          />
          <button 
            onClick={onClose}
            className={`absolute top-4 right-4 z-20 p-2 rounded-full transition-colors shadow-sm ${theme === 'dark' ? 'bg-slate-800/60 hover:bg-slate-700 text-white' : 'bg-white/60 hover:bg-white text-slate-900'}`}
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="absolute bottom-6 left-6 sm:left-10 z-20 right-6">
            <h2 className={`text-3xl sm:text-4xl font-bold mb-2 drop-shadow-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{trail.title}</h2>
            
            {(dynamicDeadline || trail.deadline) && (
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4 ${
                theme === 'dark' ? 'bg-amber-900/50 text-amber-400 border border-amber-900/50' : 'bg-amber-50 text-amber-700 border border-amber-100'
              }`}>
                <Award className="w-3.5 h-3.5" />
                {t('dashboard.deadline')} {new Date((dynamicDeadline || trail.deadline) + 'T12:00:00').toLocaleDateString(i18n.language === 'pt' ? 'pt-BR' : 'es-ES')}
              </div>
            )}

            <div className="flex items-center gap-3">
              {isEnrolled ? (
                <button 
                  onClick={() => navigate(`/trail/${trail.id}`)}
                  className={`flex items-center gap-2 px-6 py-2.5 font-bold rounded-md transition-colors shadow-lg ${
                    progressPercentage === 100 && !userProfile?.completedSurveys?.includes(trail.id!)
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Play className="w-5 h-5 fill-current" />
                  {progressPercentage === 100 && !userProfile?.completedSurveys?.includes(trail.id!) 
                    ? t('learning.takeSurvey') 
                    : t('learning.accessTrail')}
                </button>
              ) : (
                <button 
                  onClick={handleEnroll}
                  disabled={isEnrolling || modules.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 !text-white !opacity-100 font-black rounded-md transition-all shadow-xl hover:shadow-green-500/20 disabled:opacity-50"
                >
                  {isEnrolling ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <GraduationCap className="w-5 h-5 !text-white" />
                  )}
                  {isEnrolling ? t('learning.enrolling') : t('learning.enrollInTrail')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Conteúdo Scrollável */}
        <div className="p-6 sm:p-10 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <p className={`text-lg leading-relaxed mb-8 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                {trail.description || t('learning.noDescription')}
              </p>

              <h3 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('trail.modules')}</h3>
              {!isEnrolled ? (
                <div className={`p-8 rounded-xl border-2 border-dashed text-center ${theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50/50'}`}>
                  <Lock className="w-10 h-10 text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">
                    {t('learning.enrollToViewModules')}
                  </p>
                </div>
              ) : loading ? (
                <div className="text-slate-500">{t('trail.loadingModules')}</div>
              ) : modules.length === 0 ? (
                <div className="text-slate-500">{t('trail.noModules')}</div>
              ) : (
                <div className="space-y-3">
                  {modules.map((mod, index) => (
                    <div key={mod.id} className={`flex items-center gap-4 p-4 rounded-lg transition-colors border ${
                      theme === 'dark' 
                        ? 'bg-slate-800 hover:bg-slate-700 border-slate-700' 
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                    }`}>
                      <div className="text-2xl font-bold text-slate-400 w-8 text-center">{index + 1}</div>
                      <div className="flex-1">
                        <h4 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{mod.title}</h4>
                        <p className={`text-sm line-clamp-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{mod.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {mod.quizConfig?.isRequired && (
                          <span className="text-[10px] uppercase tracking-wider font-bold text-blue-500 border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 rounded">
                            Quiz: {mod.quizConfig.passingScore} pts
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="w-full md:w-64 flex-shrink-0 space-y-4">
              <div className="text-sm">
                <span className="text-slate-500">{t('trail.totalModules')}: </span>
                <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{modules.length}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Componente Horizontal Carousel ---
const HorizontalCarousel = ({ children, theme }: { children: React.ReactNode, theme: 'light' | 'dark' }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeft(scrollLeft > 5);
      setShowRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    const timer = setTimeout(checkScroll, 100);
    window.addEventListener('resize', checkScroll);
    return () => {
      window.removeEventListener('resize', checkScroll);
      clearTimeout(timer);
    };
  }, [children]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="relative group/carousel">
      <div 
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-6 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Hiding scrollbar for Chrome/Safari */}
        <style dangerouslySetInnerHTML={{ __html: `
          .group\\/carousel div::-webkit-scrollbar { display: none; }
        `}} />
        
        {React.Children.map(children, (child) => (
          <div className="flex-shrink-0 w-[280px] sm:w-[320px] snap-start">
            {child}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showLeft && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            onClick={() => scroll('left')}
            className={`absolute left-0 top-[40%] -translate-y-1/2 -translate-x-4 z-10 p-2 rounded-full shadow-xl border transition-all hidden sm:flex ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' 
                : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ChevronLeft className="w-6 h-6" />
          </motion.button>
        )}
        {showRight && (
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            onClick={() => scroll('right')}
            className={`absolute right-0 top-[40%] -translate-y-1/2 translate-x-4 z-10 p-2 rounded-full shadow-xl border transition-all hidden sm:flex ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' 
                : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ChevronRight className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Componente Principal Dashboard ---
export default function Dashboard() {
  const { user, userProfile, logout, isAdminMode } = useAuth();
  const { theme } = useTheme();
  const { hasPermission, isManagementAdmin } = usePermissions();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { activeTab, setActiveTab, searchQuery, setSearchQuery } = useOutletContext<{ 
    activeTab: 'inicio' | 'playbook' | 'trainings' | 'myTrails' | 'myArea',
    setActiveTab: (tab: 'inicio' | 'playbook' | 'trainings' | 'myTrails' | 'myArea') => void,
    searchQuery: string,
    setSearchQuery: (query: string) => void
  }>();
  
  const [areas, setAreas] = useState<Area[]>([]);
  const [trails, setTrails] = useState<Trail[]>([]);
  const [eirDays, setEirDays] = useState<EirDay[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [playbookContents, setPlaybookContents] = useState<PlaybookContent[]>([]);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [playbookSessions, setPlaybookSessions] = useState<PlaybookSession[]>([]);
  const [latestRecognitions, setLatestRecognitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [isEirPlayerOpen, setIsEirPlayerOpen] = useState(false);
  const [isBannerMinimized, setIsBannerMinimized] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [showWelcomeVideo, setShowWelcomeVideo] = useState(false);
  const [isActivatingOnboarding, setIsActivatingOnboarding] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastCountRef = useRef<number>(0);
  const modalShownInMountRef = useRef<boolean>(false);
  const prevLevelRef = useRef<number | null>(null);

  // --- Funções Auxiliares (Hoisted) ---
  function getTrailProgress(trailId: string) {
    const trailModules = allModules.filter(m => m.trailId === trailId);
    if (trailModules.length === 0) return 0;
    
    const completedModules = userProgress.filter(p => {
      if (p.trailId === trailId) return p.status === 'completed';
      // Robust check: if trailId is missing in progress, check if moduleId belongs to this trail
      const mod = allModules.find(m => m.id === p.moduleId);
      return mod?.trailId === trailId && p.status === 'completed';
    });
    return Math.round((completedModules.length / trailModules.length) * 100);
  }

  function isMandatoryForMe(trail: Trail) {
    if (!userProfile) return false;
    const isMandatoryByArea = trail.isMandatory && (!trail.areaIds || trail.areaIds.length === 0 || trail.areaIds.includes(userProfile.areaId || ''));
    const isMandatoryByProject = projectTrailIds.has(trail.id!);
    return isMandatoryByArea || isMandatoryByProject;
  }

  function isRelevantToMe(trail: Trail) {
    if (!userProfile) return false;
    
    // 1. Obrigatória por Área ou Projeto (Sempre visível)
    if (isMandatoryForMe(trail)) return true;

    // 2. Pertence à Área ou Projeto do usuário (Sempre visível)
    const userArea = areas.find(a => a.id === userProfile.areaId || a.name === userProfile.areaId);
    const isInMyArea = trail.areaIds?.includes(userProfile.areaId || '') || 
                      (userArea && trail.areaIds?.some(aid => {
                        const trailArea = areas.find(a => a.id === aid);
                        return trailArea?.name === userArea.name || trailArea?.id === userProfile.areaId;
                      }));
    
    const isInMyProject = userProfile.projectIds?.some(pid => {
      const userProj = userProjects.find(p => p.id === pid || p.name === pid);
      return userProj?.trailIds?.includes(trail.id || '');
    });
    if (isInMyArea || isInMyProject) return true;

    // 3. Se não for obrigatória nem da área/projeto, deve respeitar o país
    return matchesCountry(trail);
  }

  function getProjectProgress(projectId: string) {
    const projectModules = allModules.filter(m => m.projectId === projectId);
    const project = userProjects.find(p => p.id === projectId);
    const projectTrails = trails.filter(t => project?.trailIds.includes(t.id!));
    
    const totalItems = projectModules.length + projectTrails.length;
    if (totalItems === 0) return 0;

    const completedModules = userProgress.filter(p => p.projectId === projectId && p.status === 'completed');
    const completedTrails = projectTrails.filter(t => getTrailProgress(t.id!) === 100);

    return Math.round(((completedModules.length + completedTrails.length) / totalItems) * 100);
  }

  function matchesCountry(t: Trail) {
    if (!t.countryIds || t.countryIds.length === 0) return true;
    // Check by ID (preferred) or by name (fallback for legacy data)
    return t.countryIds.includes(userProfile?.countryId || '') || 
           t.countryIds.includes(userProfile?.country || '');
  }

  useEffect(() => {
    if (userProfile?.hasOverdueTrails) {
      const currentCount = userProfile.overdueTrailsCount || 0;
      
      // Mostrar se:
      // 1. Ainda não foi mostrado nesta montagem do componente (toda vez que entra no Dashboard)
      // 2. OU o contador de atrasos aumentou (nova simulação ou novo atraso real)
      if (!modalShownInMountRef.current || currentCount > lastCountRef.current) {
        setShowOverdueModal(true);
        modalShownInMountRef.current = true;
        lastCountRef.current = currentCount;
      }
    } else {
      // Se não houver mais atrasos, resetamos os controles
      modalShownInMountRef.current = false;
      lastCountRef.current = 0;
    }
  }, [userProfile?.hasOverdueTrails, userProfile?.overdueTrailsCount]);

  // Efeito sonoro para o modal de atraso
  useEffect(() => {
    const playSound = () => {
      if (showOverdueModal) {
        if (!audioRef.current) {
          audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audioRef.current.volume = 0.3;
          audioRef.current.loop = true;
        }
        
        audioRef.current.play().catch(err => {
          console.warn("Som bloqueado pelo navegador. Aguardando interação...", err);
          // Se falhar, tentaremos novamente no próximo clique global
          const retryPlay = () => {
            audioRef.current?.play();
            window.removeEventListener('click', retryPlay);
          };
          window.addEventListener('click', retryPlay);
        });
      }
    };

    playSound();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, [showOverdueModal]);

  useEffect(() => {
    if (userProfile?.level) {
      if (prevLevelRef.current !== null && userProfile.level > prevLevelRef.current) {
        setShowLevelUp(true);
      }
      prevLevelRef.current = userProfile.level;
    }
  }, [userProfile?.level]);

  useEffect(() => {
    const checkLeaderStatus = async () => {
      if (!user?.email) return;
      try {
        const q = query(collection(db, 'users'), where('leaderEmail', '==', user.email));
        const snap = await getDocs(q);
        setIsLeader(!snap.empty);
      } catch (error) {
        console.error("Error checking leader status:", error);
      }
    };
    checkLeaderStatus();
  }, [user?.email]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!user) return;

    // Fetch User Progress (Real-time)
    const qProgress = query(collection(db, 'user_progress'), where('userId', '==', user.uid));
    const unsubscribeProgress = onSnapshot(qProgress, (snapshot) => {
      setUserProgress(snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as UserProgress));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'user_progress');
    });

    return () => unsubscribeProgress();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const fetchLearningData = async () => {
      try {
        // Fetch Areas
        try {
          const areasSnap = await getDocs(collection(db, 'areas'));
          const activeAreas = areasSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Area).filter(a => a.isActive);
          setAreas(activeAreas);
        } catch (err) {
          console.error("Error fetching areas:", err);
        }

        // Fetch Trails
        try {
          const trailsSnap = await getDocs(collection(db, 'trails'));
          const activeTrails = trailsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Trail).filter(t => t.isActive).sort((a, b) => a.order - b.order);
          setTrails(activeTrails);
        } catch (err) {
          console.error("Error fetching trails:", err);
        }

        // Fetch All Modules (to calculate trail completion)
        try {
          const modulesSnap = await getDocs(collection(db, 'modules'));
          setAllModules(modulesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Module));
        } catch (err) {
          console.error("Error fetching modules:", err);
        }

        // Fetch Playbook Contents
        try {
          const playbookSnap = await getDocs(collection(db, 'playbook_content'));
          setPlaybookContents(playbookSnap.docs.map(d => ({ id: d.id, ...d.data() }) as PlaybookContent));
        } catch (err) {
          console.error("Error fetching playbook_content:", err);
        }

        // Fetch Playbook Sessions
        try {
          const sessionsSnap = await getDocs(query(collection(db, 'playbook_sessions'), orderBy('order', 'asc')));
          const sessionsData = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as PlaybookSession);
          
          // Deduplicar por título para evitar exibição duplicada na UI se houver lixo no banco
          const uniqueSessions = sessionsData.reduce((acc: PlaybookSession[], current) => {
            const x = acc.find(item => item.title.trim().toLowerCase() === current.title.trim().toLowerCase());
            if (!x) {
              return acc.concat([current]);
            } else {
              return acc;
            }
          }, []);
          
          setPlaybookSessions(uniqueSessions);
        } catch (err) {
          console.error("Error fetching playbook_sessions:", err);
        }

        // Fetch EIR Days if applicable
        if (userProfile?.onboardingJourney === 'eir') {
          try {
            const eirSnap = await getDocs(query(collection(db, 'eirDays'), orderBy('dayNumber', 'asc')));
            setEirDays(eirSnap.docs.map(d => ({ id: d.id, ...d.data() }) as EirDay));
          } catch (err) {
            console.error("Error fetching eirDays:", err);
          }
        }

        // Fetch Projects
        const projectsQuery = userProfile?.roleId === 'admin' 
          ? collection(db, 'projects')
          : query(collection(db, 'projects'), where('userIds', 'array-contains', user.uid));
        let projectsSnap;
        try {
          projectsSnap = await getDocs(projectsQuery);
        } catch (err) {
          console.error("Error fetching projects:", err);
          projectsSnap = { docs: [] };
        }
        const allProjects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
        const myProjects = allProjects.filter(p => p.isActive && (userProfile?.roleId === 'admin' || userProfile?.projectIds?.includes(p.id!)));
        setUserProjects(myProjects);

        // Fetch Latest Recognitions
        try {
          const qRecognitions = query(collection(db, 'recognitions'), orderBy('createdAt', 'desc'), limit(20));
          const recognitionsSnap = await getDocs(qRecognitions);
          const recognitionsData = recognitionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          // Filter out test recognitions
          const filteredRecs = recognitionsData.filter((r: any) => {
            const isFromTest = r.fromUserName?.toLowerCase().includes('teste') || r.fromUserId?.toLowerCase().includes('teste');
            const isToTest = r.toUserName?.toLowerCase().includes('teste') || r.toUserId?.toLowerCase().includes('teste');
            return !isFromTest && !isToTest;
          }).slice(0, 5);

          setLatestRecognitions(filteredRecs);
        } catch (recError) {
          console.error("Error fetching recognitions for dashboard:", recError);
        }
      } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLearningData();
  }, [user, userProfile]);

  useEffect(() => {
    if (user && userProfile && userProfile.isOnboarding) {
      const checkOnboardingTasks = async () => {
        const tasks = userProfile.onboardingTasks || {};
        const updates: any = {};
        let pointsToAdd = 0;

        // 1. Check Complete Onboarding Trail
        const onboardingTrailsForMe = trails.filter(t => {
          if (!t.isOnboardingTrail) return false;
          const userJourney = userProfile?.onboardingJourney || 'standard';
          const trailJourney = t.onboardingJourney || 'standard';
          if (userJourney !== trailJourney) return false;
          if (!t.areaIds || t.areaIds.length === 0) return true;
          return t.areaIds.includes(userProfile?.areaId || '');
        });
        
        if (onboardingTrailsForMe.length > 0) {
          const hasCompletedOnboardingTrail = onboardingTrailsForMe.some(t => getTrailProgress(t.id!) === 100);
          if (hasCompletedOnboardingTrail && !tasks.completeTrail) {
            updates['onboardingTasks.completeTrail'] = true;
            pointsToAdd += 200;
          }
        }

        if (Object.keys(updates).length > 0) {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, updates);
          if (pointsToAdd > 0) {
            await gamificationService.addPoints(user.uid, pointsToAdd, 'Onboarding: Tarefas automáticas');
            toast.success(t('onboarding.taskCompleted', { task: t('onboarding.title'), points: pointsToAdd }));
          }
        }
      };
      
      checkOnboardingTasks();
    }
  }, [user, userProfile?.isOnboarding, userProfile?.photoURL, userProgress, allModules, trails, areas]);

  useEffect(() => {
    if (user && userProfile) {
      notificationService.checkDeadlines(user.uid, userProfile);
    }
  }, [user, userProfile]);

  const handleActivateOnboarding = async () => {
    if (!user) return;
    setIsActivatingOnboarding(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        isOnboarding: true,
        onboardingActivatedAt: Date.now(),
        onboardingTasks: {
          welcomeVideo: false,
          exploreWall: false,
          firstRecognition: false,
          checkLeaderboard: false,
          firstModule: false,
          completeTrail: false,
          satisfactionSurvey: false
        }
      });

      // Send welcome email to country colleagues
      const area = areas.find(a => a.id === userProfile?.areaId);
      await onboardingService.sendWelcomeEmail(userProfile!, area?.name || 'Xcelerate');

      toast.success(t('onboarding.activated'));
    } catch (error) {
      console.error("Erro ao ativar onboarding:", error);
      toast.error(t('onboarding.errorActivating'));
    } finally {
      setIsActivatingOnboarding(false);
    }
  };

  const handleExitOnboarding = async () => {
    if (!user) return;
    setIsActivatingOnboarding(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        isOnboarding: false
      });
      toast.success(t('onboarding.exited'));
    } catch (error) {
      console.error("Erro ao sair do onboarding:", error);
      toast.error(t('onboarding.errorExiting'));
    } finally {
      setIsActivatingOnboarding(false);
    }
  };

  const handleDeleteOnboardingPoints = async () => {
    if (!user || !userProfile) return;
    setIsActivatingOnboarding(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const pointsToRemove = userProfile.onboardingPoints || 0;
      
      // Reset tasks and onboardingPoints field
      await updateDoc(userRef, {
        onboardingTasks: {},
        onboardingPoints: 0
      });
      
      // Remove the points using the service to ensure history and level are updated
      if (pointsToRemove > 0) {
        await gamificationService.removePoints(user.uid, pointsToRemove, t('dashboard.debug.deletePointsTitle'));
      }
      
      toast.success(t('dashboard.debug.pointsDeleted'));
    } catch (error) {
      console.error("Erro ao excluir pontos de onboarding:", error);
      toast.error(t('dashboard.debug.errorDeletePoints'));
    } finally {
      setIsActivatingOnboarding(false);
    }
  };

  const projectTrailIds = new Set(userProjects.flatMap(p => p.trailIds || []));
  // const playbookSessions = PLAYBOOK_SESSIONS(t); // Removed in favor of dynamic state

  const inProgressTrails = trails.filter(t => {
    const p = getTrailProgress(t.id!);
    
    // Robust check for progress entry
    const hasProgressEntry = userProgress.some(up => {
      if (up.trailId === t.id) return true;
      const mod = allModules.find(m => m.id === up.moduleId);
      return mod?.trailId === t.id;
    });

    // If user has progress, always show it in "Continue Watching" regardless of country
    if (hasProgressEntry) {
      const surveyDone = userProfile?.completedSurveys?.includes(t.id!);
      return p < 100 || (p === 100 && !surveyDone);
    }

    // Otherwise, check country
    if (!matchesCountry(t)) return false;

    return false;
  });

  const enrolledTrails = trails.filter(t => {
    // 1. Obrigatória para o usuário (Geral, Área ou Projeto)
    if (isMandatoryForMe(t)) return true;

    // 2. Inscrita (tem algum progresso)
    return userProgress.some(up => {
      if (up.trailId === t.id) return true;
      const mod = allModules.find(m => m.id === up.moduleId);
      return mod?.trailId === t.id;
    });
  });

  const startedTrails = trails.filter(t => {
    // 1. Check if user has any progress in this trail (Enrolled)
    const hasProgress = userProgress.some(up => {
      if (up.trailId === t.id) return true;
      const mod = allModules.find(m => m.id === up.moduleId);
      return mod?.trailId === t.id;
    });

    if (hasProgress) return true;

    // 2. Check if mandatory for area or project (Relevant overrides country)
    if (isMandatoryForMe(t)) return true;

    // 3. Finally, check country for non-mandatory, non-enrolled trails
    if (!matchesCountry(t)) return false;
    
    return false;
  });

  const onboardingTrails = trails.filter(t => {
    // Check if it's an onboarding trail
    if (!t.isOnboardingTrail) return false;
    
    // Check Journey Matching
    const userJourney = userProfile?.onboardingJourney || 'standard';
    const trailJourney = t.onboardingJourney || 'standard';
    if (userJourney !== trailJourney) return false;
    
    // Check if it's targeted for this user
    let isForMe = false;
    
    if (!t.areaIds || t.areaIds.length === 0) {
      // General onboarding trail
      isForMe = true;
    } else {
      // Area specific onboarding trail
      isForMe = t.areaIds.includes(userProfile?.areaId || '');
    }
    
    // Must match country
    if (isForMe && matchesCountry(t)) return true;
    
    return false;
  });

  const areaTrails = trails.filter(t => {
    // Não incluir trilhas de onboarding aqui
    if (t.isOnboardingTrail) return false;

    // Se a trilha for de uma das áreas do usuário, ela aparece aqui
    const isForMyArea = t.areaIds?.includes(userProfile?.areaId || '');
    if (isForMyArea) return true;

    // Se a trilha for de um dos projetos do usuário
    const isForMyProject = projectTrailIds.has(t.id!);
    if (isForMyProject) return true;

    return false;
  });

  const completedTrails = trails.filter(t => 
    getTrailProgress(t.id!) === 100 && userProfile?.completedSurveys?.includes(t.id!)
  );
  
  const publicTrails = trails.filter(t => {
    if (!matchesCountry(t)) return false;
    if (!t.isActive) return false;

    // Se for marcada como pública, aparece aqui.
    if (t.isPublic) return true;

    // NOVO REQUISITO: Se for obrigatória para OUTRAS áreas, aparece como trilha livre aqui.
    if (t.isMandatory) {
      const isForMyArea = t.areaIds?.includes(userProfile?.areaId || '');
      const isGeneralMandatory = !t.areaIds || t.areaIds.length === 0;
      if (!isForMyArea && !isGeneralMandatory) return true;
    }

    return false;
  });

  const filteredResults = [
    ...trails.filter(t => 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ).map(t => ({ ...t, searchType: 'trail' as const })),
    ...playbookContents.filter(p => 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ).map(p => ({ ...p, searchType: 'playbook_content' as const })),
    ...playbookSessions.filter(s => 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ).map(s => ({ ...s, searchType: 'playbook_session' as const }))
  ];

  const getDynamicDeadline = (trail: Trail) => {
    if (trail.isPublic || trail.isSlowTraining) {
      const progress = userProgress.find(p => p.trailId === trail.id);
      if (progress?.enrolledAt) {
        const date = new Date(progress.enrolledAt);
        date.setDate(date.getDate() + 90);
        return date.toISOString().split('T')[0];
      }
    } else if (trail.isOnboardingTrail && userProfile?.onboardingActivatedAt) {
      const date = new Date(userProfile.onboardingActivatedAt);
      date.setDate(date.getDate() + 7);
      return date.toISOString().split('T')[0];
    }
    return trail.deadline || null;
  };

  const recommendedTrails = trails.filter(t => {
    // Se já finalizou, não aparece em recomendados
    if (getTrailProgress(t.id!) === 100) return false;

    if (!matchesCountry(t)) return false;

    // Se for obrigatória (Geral, Área ou Projeto), recomenda para o usuário
    if (isMandatoryForMe(t)) return true;

    return false;
  });

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'pt' ? 'es' : 'pt');
  };

  const canSeeAdmin = hasPermission('view_analytics') || hasPermission('manage_users') || hasPermission('manage_roles') || hasPermission('manage_learning');
  const featuredTrail = trails.length > 0 ? trails[0] : null;

  return (
    <div className={`min-h-0 font-sans selection:bg-brand-50 selection:text-black transition-colors duration-300 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
      <div className="flex">
        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {/* Banner de Prazo Expirado */}
          {userProfile?.hasOverdueTrails && (
            <div className="relative z-50">
              <AnimatePresence mode="wait">
                {!isBannerMinimized ? (
                  <motion.div 
                    key="expanded-banner"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-red-600 text-white px-6 py-3 flex items-center justify-between overflow-hidden shadow-lg border-b border-red-500"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center animate-pulse">
                        <Zap className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <span className="font-black block sm:inline">ATENÇÃO: PRAZO EXPIRADO! ⚠️</span>
                        <span className="text-sm opacity-90 ml-0 sm:ml-2 block sm:inline">Você possui trilhas pendentes fora do prazo. Conclua-as agora para regularizar sua situação.</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setActiveTab('myTrails')}
                        className="px-4 py-1.5 bg-white text-red-600 rounded-lg text-xs font-black hover:bg-red-50 transition-colors shadow-lg whitespace-nowrap"
                      >
                        VER TRILHAS
                      </button>
                      <button 
                        onClick={() => setIsBannerMinimized(true)}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                        title="Minimizar aviso"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="minimized-banner"
                    initial={{ scale: 0.8, opacity: 0, y: -20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.8, opacity: 0, y: -20 }}
                    className="fixed top-24 right-8 z-[100]"
                  >
                    <button 
                      onClick={() => setIsBannerMinimized(false)}
                      className="group flex items-center gap-3 bg-red-600 text-white pl-4 pr-2 py-2 rounded-full shadow-2xl hover:bg-red-700 transition-all transform hover:scale-105 border-2 border-white/20"
                    >
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 animate-pulse" />
                        <span className="text-xs font-black tracking-tighter">PRAZO EXPIRADO</span>
                      </div>
                      <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Hero Section */}
          {loading ? (
            <div className="h-[80vh] flex items-center justify-center">
              <div className={`w-12 h-12 border-4 border-t-transparent rounded-full animate-spin ${theme === 'dark' ? 'border-blue-500' : 'border-[#003366]'}`}></div>
            </div>
          ) : activeTab === 'inicio' ? (
            <div className="max-w-7xl mx-auto p-4 sm:p-8 lg:p-12 space-y-12">
              {searchQuery ? (
                <section className="animate-in fade-in slide-in-from-top-4 duration-500 min-h-[60vh]">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className={`text-2xl font-black flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                      <Search className={`w-6 h-6 ${theme === 'dark' ? 'text-blue-400' : 'text-[#003366]'}`} />
                      Resultados para: <span className="text-blue-500">"{searchQuery}"</span>
                    </h2>
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="text-sm font-bold text-slate-500 hover:text-slate-700"
                    >
                      Limpar Busca
                    </button>
                  </div>
                  
                  {filteredResults.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {filteredResults.map((item) => (
                        <div 
                          key={`${item.searchType}-${item.id}`} 
                          className={`group relative rounded-xl border transition-all cursor-pointer overflow-hidden h-full flex flex-col ${
                            theme === 'dark' 
                              ? 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-lg' 
                              : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                          }`}
                          onClick={() => {
                            if (item.searchType === 'trail') {
                              setSelectedTrail(item as any);
                            } else if (item.searchType === 'playbook_session') {
                              navigate(`/playbook/${(item as any).id}`);
                            } else {
                              navigate(`/playbook/${(item as any).sessionId}`);
                            }
                          }}
                        >
                          <div className="aspect-video relative overflow-hidden">
                            <img 
                              src={(item as any).imageUrl || `https://picsum.photos/seed/${item.id}/600/340`} 
                              alt={item.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                            <div className="absolute top-2 right-2">
                              <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm ${
                                item.searchType === 'trail' 
                                  ? 'bg-blue-600 text-white' 
                                  : item.searchType === 'playbook_session'
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-amber-500 text-white'
                              }`}>
                                {item.searchType === 'trail' ? 'Trilha' : t('nav.playbook')}
                              </span>
                            </div>
                          </div>
                          <div className="p-4 flex-1 flex flex-col">
                            <h3 className={`font-bold line-clamp-1 transition-colors ${theme === 'dark' ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-[#003366]'}`}>{item.title}</h3>
                            <p className={`text-xs mt-1 line-clamp-2 flex-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>{item.description || (item.searchType === 'trail' ? t('dashboard.recommendedSub') : '')}</p>
                            
                            <div className="mt-4 flex items-center justify-between">
                              <span className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                {item.searchType === 'trail' ? (
                                  <div className="flex items-center gap-1">
                                    <GraduationCap className="w-3 h-3" />
                                    {t('learning.accessTrail')}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <BookOpen className="w-3 h-3" />
                                    {t('playbook.accessContent')}
                                  </div>
                                )}
                              </span>
                              <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`py-20 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center text-center ${
                      theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50/50'
                    }`}>
                      <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <Search className="w-10 h-10 text-slate-300" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-400">Nenhum resultado encontrado</h3>
                      <p className="text-slate-400 max-w-xs mt-2">Tente buscar por termos diferentes ou verifique a ortografia.</p>
                    </div>
                  )}
                </section>
              ) : (
                <>

              {/* Boas vindas e Gamificação */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mt-6">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <h1 className={`text-3xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {t('dashboard.welcomeUser', { name: formatDisplayName(userProfile?.name || user?.displayName || user?.email) })}
                    </h1>
                    {isManagementAdmin && (
                      <div className="flex items-center gap-2">
                        {!userProfile?.isOnboarding ? (
                          <button
                            onClick={handleActivateOnboarding}
                            disabled={isActivatingOnboarding}
                            className="p-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-lg transition-all flex items-center gap-2 text-xs font-bold"
                            title={t('dashboard.debug.activateOnboardingTitle')}
                          >
                            {isActivatingOnboarding ? (
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Zap className="w-3 h-3" />
                            )}
                            {t('dashboard.debug.activateOnboarding')}
                          </button>
                        ) : (
                          <button
                            onClick={handleExitOnboarding}
                            disabled={isActivatingOnboarding}
                            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-lg transition-all flex items-center gap-2 text-xs font-bold"
                            title={t('dashboard.debug.exitOnboardingTitle')}
                          >
                            {isActivatingOnboarding ? (
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <LogOut className="w-3 h-3" />
                            )}
                            {t('dashboard.debug.exitOnboarding')}
                          </button>
                        )}
                        <button
                          onClick={handleDeleteOnboardingPoints}
                          disabled={isActivatingOnboarding}
                          className="p-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg shadow-lg transition-all flex items-center gap-2 text-xs font-bold"
                          title={t('dashboard.debug.deletePointsTitle')}
                        >
                          {isActivatingOnboarding ? (
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          {t('dashboard.debug.deletePoints')}
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-slate-500 mt-2">{t('dashboard.welcomeSub')}</p>
                  
                  {isLeader && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate('/team')}
                      className="mt-8 flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all"
                    >
                      <Award className="w-5 h-5" />
                      {t('dashboard.leaderDashboard')}
                      <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  )}
                </div>

                <div className="flex items-center gap-6">
                  <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                      <Zap className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>{t('common.points')}</p>
                      <p className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{userProfile?.points || 0}</p>
                    </div>
                  </div>

                  {userProfile?.onboardingPoints !== undefined && userProfile.onboardingPoints > 0 && (
                    <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-blue-900/20 border-blue-500/30' : 'bg-blue-50 border-blue-100 shadow-sm'}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                          <Award className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <p className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>{t('dashboard.onboardingPoints')}</p>
                          <p className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-blue-900'}`}>{userProfile.onboardingPoints}</p>
                        </div>
                      </div>
                      <button
                        onClick={handleDeleteOnboardingPoints}
                        disabled={isActivatingOnboarding}
                        className={`p-2 rounded-lg transition-all ${
                          theme === 'dark' ? 'text-rose-400 hover:bg-rose-500/10' : 'text-rose-600 hover:bg-rose-50'
                        }`}
                        title={t('dashboard.debug.deletePointsTitle')}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>{t('common.level')}</p>
                      <p className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{userProfile?.level || 1}</p>
                    </div>
                  </div>

                  {user?.email?.toLowerCase() === 'cesar.bronzatto@xertica.com' && (
                    <button 
                      onClick={() => {
                        setIsDemoMode(true);
                        setShowLevelUp(true);
                      }}
                      className="p-4 rounded-2xl border border-dashed border-blue-500 text-blue-500 hover:bg-blue-500/10 transition-all font-bold text-xs"
                    >
                      {t('dashboard.demonstrateBadge')}
                    </button>
                  )}
                </div>
              </div>

              {/* Seção de Onboarding - Destaque para novos colaboradores */}
              {(userProfile?.isOnboarding || userProfile?.onboardingJourney === 'eir') && (
                <div className="space-y-8 mt-8">
                  {userProfile?.onboardingJourney === 'eir' ? (
                     <div className={`p-6 sm:p-8 rounded-3xl border-2 transition-all relative overflow-hidden shadow-sm ${theme === 'dark' ? 'bg-amber-900/20 border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.1)]' : 'bg-amber-50 border-amber-200'}`}>
                       <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                       <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                         <div className="flex items-center gap-4">
                           <div className="w-14 h-14 bg-amber-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                             <Trophy className="w-8 h-8" />
                           </div>
                           <div>
                             <h2 className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-amber-900'}`}>
                               {t('dashboard.eirJourneyTitle', 'Jornada EIR (Líderes do Futuro)')} 🌟
                             </h2>
                             <p className={`text-sm mt-1 max-w-xl ${theme === 'dark' ? 'text-amber-300' : 'text-amber-700'}`}>
                               {t('dashboard.eirJourneyDesc', 'Sua jornada exclusiva de integração está pronta. Comece agora sua imersão interativa de onboarding!')}
                             </p>
                           </div>
                         </div>
                         <button 
                           onClick={() => setIsEirPlayerOpen(true)}
                           className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl shadow-lg transition-all transform hover:scale-105 flex items-center gap-2 whitespace-nowrap"
                         >
                           <Play className="w-5 h-5 fill-current" />
                           {t('dashboard.accessEirJourney', 'ACESSAR JORNADA EIR')}
                         </button>
                       </div>
                     </div>
                  ) : (
                    <>
                      <OnboardingChecklist onShowWelcomeVideo={() => setShowWelcomeVideo(true)} />
                      <motion.section 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-6 sm:p-8 rounded-3xl border-2 transition-all relative overflow-hidden ${
                          theme === 'dark' 
                            ? 'bg-blue-900/20 border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.1)]' 
                            : 'bg-blue-50 border-blue-100 shadow-sm'
                        }`}
                      >
                        {/* Background Decorativo */}
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                        
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 relative z-10">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                              <Award className="w-8 h-8" />
                            </div>
                            <div>
                              <h2 className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-blue-900'}`}>
                                Bem-vindo ao Xcelerate! 🚀
                              </h2>
                              <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                                Sua jornada de integração começou. Conclua estas trilhas para conhecer nosso DNA.
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <button 
                              onClick={() => navigate('/live/default')}
                              className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-black rounded-xl shadow-lg transition-all transform hover:scale-105 flex items-center gap-2"
                            >
                              <VideoIcon className="w-4 h-4" />
                              SESSÃO AO VIVO
                            </button>
                            <button 
                              onClick={() => setShowWelcomeVideo(true)}
                              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg transition-all transform hover:scale-105 flex items-center gap-2"
                            >
                              <Play className="w-4 h-4 fill-current" />
                              ASSISTIR BOAS-VINDAS
                            </button>
                          </div>
                        </div>

                        {onboardingTrails.length > 0 ? (
                          <HorizontalCarousel theme={theme}>
                            {onboardingTrails.map((trail) => (
                              <div 
                                key={`onboarding-${trail.id}`} 
                                className={`group relative rounded-xl border transition-all cursor-pointer overflow-hidden h-full ${
                                  theme === 'dark' 
                                    ? 'bg-slate-900/80 border-slate-800 hover:border-blue-500/50 shadow-lg' 
                                    : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200'
                                }`}
                                onClick={() => setSelectedTrail(trail)}
                              >
                                <div className="aspect-video relative overflow-hidden">
                                  <img 
                                    src={trail.imageUrl || `https://picsum.photos/seed/${trail.id}/600/340`} 
                                    alt={trail.title}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-0 bg-blue-600/10 group-hover:bg-blue-600/30 transition-colors" />
                                  <div className="absolute top-2 right-2 px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded uppercase tracking-wider">
                                    Onboarding
                                  </div>
                                  {getTrailProgress(trail.id!) === 100 && (
                                    <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center backdrop-blur-[1px]">
                                      <CheckCircle2 className="w-12 h-12 text-white drop-shadow-lg" />
                                    </div>
                                  )}
                                </div>
                                <div className="p-4">
                                  <h3 className={`font-bold line-clamp-1 transition-colors ${theme === 'dark' ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-blue-600'}`}>{trail.title}</h3>
                                  
                                  {getDynamicDeadline(trail) && (
                                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-amber-500">
                                      <Award className="w-3 h-3" />
                                      {t('dashboard.deadline')} {new Date(getDynamicDeadline(trail) + 'T12:00:00').toLocaleDateString(i18n.language === 'pt' ? 'pt-BR' : 'es-ES')}
                                    </div>
                                  )}

                                  <div className="mt-2 flex items-center justify-between">
                                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mr-3">
                                      <div 
                                        className="h-full bg-blue-500 transition-all duration-500" 
                                        style={{ width: `${getTrailProgress(trail.id!)}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500">{getTrailProgress(trail.id!)}%</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </HorizontalCarousel>
                        ) : (hasPermission('manage_learning')) ? (
                          <div className={`p-8 rounded-xl border-2 border-dashed text-center ${theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50/50'}`}>
                            <p className="text-slate-500 font-medium">
                              {t('dashboard.onboarding.noTrails')}
                              <br />
                              <span className="text-xs">{t('dashboard.onboarding.createArea')}</span>
                            </p>
                          </div>
                        ) : null}
                      </motion.section>
                    </>
                  )}
                </div>
              )}

              {userProfile?.onboardingJourney !== 'eir' && (
                <>
                  {/* Badges Section */}
                  {userProfile?.badges && userProfile.badges.length > 0 && (
                <BadgeDisplay badges={userProfile.badges} />
              )}

              {/* Seção: Meus Projetos */}
              {userProjects.length > 0 && (
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                      <Briefcase className={`w-5 h-5 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`} />
                      {t('dashboard.activeProjects')}
                    </h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {userProjects.map((project) => {
                      const projectTrails = trails.filter(t => project.trailIds.includes(t.id!));
                      const projectModules = allModules.filter(m => m.projectId === project.id);
                      const progress = getProjectProgress(project.id!);

                      return (
                        <div 
                          key={`project-${project.id}`}
                          className={`p-6 rounded-2xl border transition-all relative overflow-hidden group ${
                            theme === 'dark' 
                              ? 'bg-slate-900 border-slate-800 hover:border-amber-500/30' 
                              : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-amber-200'
                          }`}
                        >
                          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Briefcase className="w-12 h-12" />
                          </div>
                          
                          <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase tracking-wider">{t('dashboard.project')}</span>
                              {progress === 100 && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase tracking-wider">{t('dashboard.completed')}</span>}
                            </div>
                            <h3 className={`text-lg font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{project.name}</h3>
                            <p className="text-xs text-slate-500 line-clamp-2 mb-4">{project.description}</p>
                            
                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                <span>{t('dashboard.projectProgress')}</span>
                                <span>{progress}%</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-amber-500 transition-all duration-1000" 
                                   />
                              </div>
                              
                              {projectTrails.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('dashboard.trails')}</span>
                                  <div className="flex flex-wrap gap-1">
                                    {projectTrails.map(t => (
                                      <div 
                                        key={t.id}
                                        onClick={() => setSelectedTrail(t)}
                                        className={`px-2 py-1 rounded text-[10px] font-medium cursor-pointer transition-colors ${
                                          getTrailProgress(t.id!) === 100
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                      >
                                        {t.title}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {projectModules.length > 0 && (
                                <div className="space-y-1 mt-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('dashboard.directModules')}</span>
                                  <div className="flex flex-wrap gap-1">
                                    {projectModules.map(m => (
                                      <div 
                                        key={m.id}
                                        onClick={() => navigate(`/module/${m.id}`)}
                                        className={`px-2 py-1 rounded text-[10px] font-medium cursor-pointer transition-colors ${
                                          userProgress.find(p => p.moduleId === m.id && p.status === 'completed')
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                      >
                                        {m.title}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Seção: Recomendados / Devem Fazer */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                    <GraduationCap className={`w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-[#003366]'}`} />
                    {t('dashboard.recommended')}
                  </h2>
                </div>
                
                {recommendedTrails.length > 0 || trails.length > 0 ? (
                  <HorizontalCarousel theme={theme}>
                    {(recommendedTrails.length > 0 ? recommendedTrails : trails).map((trail) => (
                      <div 
                        key={`recommended-${trail.id}`} 
                        className={`group relative rounded-xl border transition-all cursor-pointer overflow-hidden h-full ${
                          theme === 'dark' 
                            ? 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-lg' 
                            : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                        }`}
                        onClick={() => setSelectedTrail(trail)}
                      >
                        <div className="aspect-video relative overflow-hidden">
                          <img 
                            src={trail.imageUrl || `https://picsum.photos/seed/${trail.id}/600/340`} 
                            alt={trail.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                          <div className={`absolute top-2 right-2 px-2 py-1 text-white text-[10px] font-bold rounded uppercase tracking-wider ${
                            isMandatoryForMe(trail) ? 'bg-red-600' : 'bg-blue-600'
                          }`}>
                            {isMandatoryForMe(trail) ? t('dashboard.mandatory') : t('dashboard.freeTraining')}
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className={`font-bold line-clamp-1 transition-colors ${theme === 'dark' ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-[#003366]'}`}>{trail.title}</h3>
                          
                          {getDynamicDeadline(trail) && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-amber-500">
                              <Award className="w-3 h-3" />
                              {t('dashboard.deadline')} {new Date(getDynamicDeadline(trail) + 'T12:00:00').toLocaleDateString(i18n.language === 'pt' ? 'pt-BR' : 'es-ES')}
                            </div>
                          )}

                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{trail.description || t('dashboard.recommendedSub')}</p>
                        </div>
                      </div>
                    ))}
                  </HorizontalCarousel>
                ) : (
                  <div className={`py-12 px-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-colors ${
                    theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50/50'
                  }`}>
                    <p className="text-slate-400">{t('dashboard.noRecommended') || 'Nenhuma recomendação disponível.'}</p>
                  </div>
                )}
              </section>

              {/* Seção: Explorar Trilhas Livres */}
              {publicTrails.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                      <Globe className={`w-5 h-5 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} />
                      {t('dashboard.exploreFree')}
                    </h2>
                  </div>
                  
                  <HorizontalCarousel theme={theme}>
                    {publicTrails.map((trail) => (
                      <div 
                        key={trail.id} 
                        className={`group relative rounded-xl border transition-all cursor-pointer overflow-hidden h-full ${
                          theme === 'dark' 
                            ? 'bg-slate-900 border-slate-800 hover:border-emerald-500/30 shadow-lg' 
                            : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-200'
                        }`}
                        onClick={() => setSelectedTrail(trail)}
                      >
                        <div className="aspect-video relative overflow-hidden">
                          <img 
                            src={trail.imageUrl || `https://picsum.photos/seed/${trail.id}/600/340`} 
                            alt={trail.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-emerald-600/10 group-hover:bg-emerald-600/20 transition-colors" />
                          <div className="absolute top-2 right-2 px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded uppercase tracking-wider">
                            {t('dashboard.freeTraining')}
                          </div>
                          {getTrailProgress(trail.id!) === 100 && (
                            <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center backdrop-blur-[1px]">
                              <CheckCircle2 className="w-12 h-12 text-white drop-shadow-lg" />
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <h3 className={`font-bold line-clamp-1 transition-colors ${theme === 'dark' ? 'text-white group-hover:text-emerald-400' : 'text-slate-900 group-hover:text-emerald-600'}`}>{trail.title}</h3>
                          
                          {getDynamicDeadline(trail) && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-amber-500">
                              <Award className="w-3 h-3" />
                              {t('dashboard.deadline')} {new Date(getDynamicDeadline(trail) + 'T12:00:00').toLocaleDateString(i18n.language === 'pt' ? 'pt-BR' : 'es-ES')}
                            </div>
                          )}

                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mr-3">
                              <div 
                                className="h-full bg-emerald-500 transition-all duration-500" 
                                style={{ width: `${getTrailProgress(trail.id!)}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500">{getTrailProgress(trail.id!)}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </HorizontalCarousel>
                </section>
              )}

              {/* Seção: Continuar Assistindo */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                    <Play className={`w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-[#003366]'}`} />
                    {t('dashboard.continueWatching')}
                  </h2>
                </div>
                
                {inProgressTrails.length > 0 ? (
                  <HorizontalCarousel theme={theme}>
                    {inProgressTrails.map((trail) => (
                      <div 
                        key={`in-progress-${trail.id}`} 
                        className={`group relative rounded-xl border transition-all cursor-pointer overflow-hidden h-full ${
                          theme === 'dark' 
                            ? 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-lg' 
                            : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                        }`}
                        onClick={() => navigate(`/trail/${trail.id}`)}
                      >
                        <div className="aspect-video relative overflow-hidden">
                          <img 
                            src={trail.imageUrl || `https://picsum.photos/seed/${trail.id}/600/340`} 
                            alt={trail.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <Play className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className={`absolute bottom-0 left-0 right-0 h-1 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}>
                            <div 
                              className="h-full bg-blue-500" 
                              style={{ width: `${getTrailProgress(trail.id!)}%` }}
                            />
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className={`font-bold line-clamp-1 transition-colors ${theme === 'dark' ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-[#003366]'}`}>{trail.title}</h3>
                          
                          {getDynamicDeadline(trail) && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-amber-500">
                              <Award className="w-3 h-3" />
                              {t('dashboard.deadline')} {new Date(getDynamicDeadline(trail) + 'T12:00:00').toLocaleDateString(i18n.language === 'pt' ? 'pt-BR' : 'es-ES')}
                            </div>
                          )}

                          <p className="text-xs text-slate-500 mt-1">{t('dashboard.completedPercent', { percent: getTrailProgress(trail.id!) })}</p>
                        </div>
                      </div>
                    ))}
                  </HorizontalCarousel>
                ) : (
                  <div className={`py-12 px-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-colors ${
                    theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50/50'
                  }`}>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <Play className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-400">{t('dashboard.noInProgress')}</h3>
                    <p className="text-slate-400 max-w-xs mt-1">{t('dashboard.noInProgressSub')}</p>
                  </div>
                )}
              </section>

              {/* Seção: Playbook */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                    <BookOpen className={`w-5 h-5 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`} />
                    {t('nav.playbook')}
                  </h2>
                  <button 
                    onClick={() => setActiveTab('playbook')}
                    className={`text-xs font-bold uppercase tracking-widest flex items-center gap-1 transition-colors ${
                      theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-[#003366]'
                    }`}
                  >
                    {t('common.viewAll')}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                
                {playbookSessions.length > 0 ? (
                  <HorizontalCarousel theme={theme}>
                    {playbookSessions.slice(0, 8).map((session) => (
                      <div 
                        key={`playbook-${session.id}`} 
                        className={`group relative rounded-xl border transition-all cursor-pointer overflow-hidden h-full ${
                          theme === 'dark' 
                            ? 'bg-slate-900 border-slate-800 hover:border-amber-500/30 shadow-lg' 
                            : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-amber-200'
                        }`}
                        onClick={() => navigate(`/playbook/${session.id}`)}
                      >
                        <div className="aspect-video relative overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          {session.icon ? (
                            <span className="text-6xl">{session.icon}</span>
                          ) : (
                            <img 
                              src={`https://picsum.photos/seed/${session.id}/600/340`} 
                              alt={session.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <div className="absolute inset-0 bg-amber-600/10 group-hover:bg-amber-600/20 transition-colors" />
                          <div className="absolute top-2 right-2 px-2 py-1 bg-amber-500 text-white text-[10px] font-bold rounded uppercase tracking-wider">
                            {t('nav.playbook')}
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className={`font-bold line-clamp-1 transition-colors ${theme === 'dark' ? 'text-white group-hover:text-amber-400' : 'text-slate-900 group-hover:text-amber-600'}`}>{session.title}</h3>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{session.description}</p>
                        </div>
                      </div>
                    ))}
                  </HorizontalCarousel>
                ) : (
                  <div className={`py-12 px-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-colors ${
                    theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50/50'
                  }`}>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <BookOpen className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-400">{t('dashboard.noPlaybook')}</h3>
                  </div>
                )}
              </section>

              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    {t('dashboard.completedRecently')}
                  </h2>
                </div>
                {completedTrails.length > 0 ? (
                  <HorizontalCarousel theme={theme}>
                    {completedTrails.map((trail) => (
                      <div 
                        key={`completed-${trail.id}`} 
                        className={`group relative rounded-xl border transition-all cursor-pointer overflow-hidden h-full ${
                          theme === 'dark' 
                            ? 'bg-slate-900 border-emerald-900/30 hover:border-emerald-800 shadow-lg' 
                            : 'bg-white border-emerald-100 shadow-sm hover:shadow-md'
                        }`}
                        onClick={() => navigate(`/trail/${trail.id}`)}
                      >
                        <div className="aspect-video relative overflow-hidden">
                          <img 
                            src="https://i.imgur.com/cDpIOoe.png" 
                            alt="Concluído"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-emerald-600/10 group-hover:bg-emerald-600/20 transition-colors" />
                          <div className="absolute top-2 right-2 px-2 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> {t('common.completed')}
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className={`font-bold line-clamp-1 transition-colors ${theme === 'dark' ? 'text-white group-hover:text-emerald-400' : 'text-slate-900 group-hover:text-emerald-600'}`}>{trail.title}</h3>
                          <p className="text-xs text-emerald-600 font-medium mt-1">{t('dashboard.certificateAvailable')}</p>
                        </div>
                      </div>
                    ))}
                  </HorizontalCarousel>
                ) : (
                  <div className={`py-12 px-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-colors ${
                    theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50/50'
                  }`}>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <CheckCircle2 className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-400">{t('dashboard.noCompleted')}</h3>
                    <p className="text-slate-400 max-w-xs mt-1">{t('dashboard.noCompletedSub')}</p>
                  </div>
                )}
              </section>
              </>
              )}
            </>
          )}
        </div>
      ) : activeTab === 'myTrails' ? (
            <div className="max-w-7xl mx-auto p-4 sm:p-8 lg:p-12 space-y-12">
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                    <BookMarked className={`w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-[#003366]'}`} />
                    {t('nav.myTrails')}
                  </h2>
                </div>
                {enrolledTrails.length > 0 ? (
                  <HorizontalCarousel theme={theme}>
                    {enrolledTrails.map((trail) => (
                      <div 
                        key={trail.id} 
                        className={`group relative rounded-xl border transition-all cursor-pointer overflow-hidden h-full ${
                          theme === 'dark' 
                            ? 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-lg' 
                            : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                        }`}
                        onClick={() => navigate(`/trail/${trail.id}`)}
                      >
                        <div className="aspect-video relative overflow-hidden">
                          <img 
                            src={trail.imageUrl || `https://picsum.photos/seed/${trail.id}/600/340`} 
                            alt={trail.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <Play className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className={`absolute bottom-0 left-0 right-0 h-1 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}>
                            <div 
                              className="h-full bg-blue-500" 
                              style={{ width: `${getTrailProgress(trail.id!)}%` }}
                            />
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className={`font-bold line-clamp-1 transition-colors ${theme === 'dark' ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-[#003366]'}`}>{trail.title}</h3>
                          
                          {getDynamicDeadline(trail) && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-amber-500">
                              <Award className="w-3 h-3" />
                              {t('dashboard.deadline')} {new Date(getDynamicDeadline(trail) + 'T12:00:00').toLocaleDateString(i18n.language === 'pt' ? 'pt-BR' : 'es-ES')}
                            </div>
                          )}

                          <p className="text-xs text-slate-500 mt-1">{t('dashboard.completedPercent', { percent: getTrailProgress(trail.id!) })}</p>
                        </div>
                      </div>
                    ))}
                  </HorizontalCarousel>
                ) : (
                  <div className={`py-12 px-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-colors ${
                    theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50/50'
                  }`}>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <BookMarked className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-400">{t('dashboard.noInProgress')}</h3>
                    <p className="text-slate-400 max-w-xs mt-1">{t('dashboard.noInProgressSub')}</p>
                  </div>
                )}
              </section>
            </div>
          ) : activeTab === 'myArea' ? (
            <div className="max-w-7xl mx-auto p-4 sm:p-8 lg:p-12 space-y-12">
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                    <Layout className={`w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-[#003366]'}`} />
                    {t('nav.myArea')}
                  </h2>
                </div>
                {areaTrails.length > 0 ? (
                  <HorizontalCarousel theme={theme}>
                    {areaTrails.map((trail) => (
                      <div 
                        key={trail.id} 
                        className={`group relative rounded-xl border transition-all cursor-pointer overflow-hidden h-full ${
                          theme === 'dark' 
                            ? 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-lg' 
                            : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                        }`}
                        onClick={() => setSelectedTrail(trail)}
                      >
                        <div className="aspect-video relative overflow-hidden">
                          <img 
                            src={trail.imageUrl || `https://picsum.photos/seed/${trail.id}/600/340`} 
                            alt={trail.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                          <div className={`absolute top-2 right-2 px-2 py-1 text-white text-[10px] font-bold rounded uppercase tracking-wider ${
                            isMandatoryForMe(trail) ? 'bg-red-600' : 'bg-blue-600'
                          }`}>
                            {isMandatoryForMe(trail) ? t('dashboard.mandatory') : t('dashboard.freeTraining')}
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className={`font-bold line-clamp-1 transition-colors ${theme === 'dark' ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-[#003366]'}`}>{trail.title}</h3>
                          
                          {getDynamicDeadline(trail) && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-amber-500">
                              <Award className="w-3 h-3" />
                              {t('dashboard.deadline')} {new Date(getDynamicDeadline(trail) + 'T12:00:00').toLocaleDateString(i18n.language === 'pt' ? 'pt-BR' : 'es-ES')}
                            </div>
                          )}

                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{trail.description || t('dashboard.recommendedSub')}</p>
                        </div>
                      </div>
                    ))}
                  </HorizontalCarousel>
                ) : (
                  <div className={`py-12 px-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-colors ${
                    theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50/50'
                  }`}>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <Layout className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-400">{t('dashboard.noAreaTrails')}</h3>
                    <p className="text-slate-400 max-w-xs mt-1">{t('dashboard.noAreaTrailsSub')}</p>
                  </div>
                )}
              </section>
            </div>
          ) : activeTab === 'trainings' ? (
            <>
              {featuredTrail ? (
                <div className="relative h-[60vh] sm:h-[70vh] w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                  <div className="absolute inset-0">
                    <img 
                      src={featuredTrail.imageUrl || `https://picsum.photos/seed/${featuredTrail.id}/1920/1080`} 
                      alt={featuredTrail.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {/* Gradientes para mesclar com o fundo */}
                    <div className={`absolute inset-0 ${theme === 'dark' ? 'bg-gradient-to-r from-slate-950 via-slate-950/60 to-transparent' : 'bg-gradient-to-r from-white via-white/60 to-transparent'}`} />
                    <div className={`absolute inset-0 ${theme === 'dark' ? 'bg-gradient-to-t from-slate-950/80 via-transparent to-transparent' : 'bg-gradient-to-t from-white/80 via-transparent to-transparent'}`} />
                  </div>
                  
                  <div className="absolute bottom-[10%] sm:bottom-[15%] left-6 sm:left-12 w-full max-w-2xl z-10">
                    {/* Glow Effect */}
                    <div className="absolute -inset-4 bg-blue-500/10 blur-3xl rounded-full opacity-30 animate-pulse pointer-events-none" />
                    
                    <motion.h1 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8 }}
                      className={`relative text-4xl sm:text-6xl font-black mb-4 leading-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                    >
                      {featuredTrail.title}
                    </motion.h1>
                    <motion.p 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      className={`relative text-lg sm:text-xl mb-8 line-clamp-3 font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}
                    >
                      {featuredTrail.description || t('dashboard.featuredSub')}
                    </motion.p>
                    
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, delay: 0.4 }}
                      className="relative flex flex-wrap items-center gap-3 sm:gap-4"
                    >
                      <button 
                        onClick={() => navigate(`/trail/${featuredTrail.id}`)}
                        className="flex items-center gap-2 px-6 sm:px-8 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md transition-colors text-lg shadow-lg"
                      >
                        <Play className="w-6 h-6 fill-current" />
                        {t('common.start')}
                      </button>
                      <button 
                        onClick={() => setSelectedTrail(featuredTrail)}
                        className={`flex items-center gap-2 px-6 sm:px-8 py-2.5 sm:py-3 font-bold rounded-md backdrop-blur-sm transition-all border text-lg shadow-sm ${
                          theme === 'dark' 
                            ? 'bg-slate-800/60 hover:bg-slate-800 text-white border-slate-700' 
                            : 'bg-white/60 hover:bg-white/80 text-slate-900 border-slate-200'
                        }`}
                      >
                        <Info className="w-6 h-6" />
                        {t('common.moreInfo')}
                      </button>
                    </motion.div>
                  </div>
                </div>
              ) : (
                <div className="h-[70vh] flex flex-col items-center justify-center text-center px-4 relative">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`max-w-xl p-12 rounded-2xl border shadow-xl ${
                      theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white/20 backdrop-blur-md border-white/40'
                    }`}
                  >
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${theme === 'dark' ? 'bg-slate-800' : 'bg-[#003366]/10'}`}>
                      <Search className={`w-10 h-10 opacity-50 ${theme === 'dark' ? 'text-slate-400' : 'text-[#003366]'}`} />
                    </div>
                    <h2 className={`text-3xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{t('dashboard.noTrails')}</h2>
                    <p className={`text-lg leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {t('dashboard.noTrailsSub')}
                    </p>
                  </motion.div>
                </div>
              )}

              {/* Carrosséis de Trilhas */}
              <main className="relative z-20 pb-20 mt-8">
                {areas.filter(a => a.isActive).map((area, index) => {
                  const areaTrails = trails.filter(t => t.areaIds?.includes(area.id!));
                  if (areaTrails.length === 0) return null;

                  return (
                    <div key={area.id} className="mb-10 sm:mb-14">
                      <h2 className={`text-xl sm:text-2xl font-bold mb-3 sm:mb-4 px-4 sm:px-6 lg:px-8 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                        {area.name}
                      </h2>
                      
                      {/* Container do Carrossel */}
                      <div className="group relative">
                        <div className="flex overflow-x-auto gap-2 sm:gap-4 px-4 sm:px-6 lg:px-8 pb-8 pt-4 snap-x snap-mandatory hide-scrollbar">
                          {areaTrails.map((trail) => (
                            <div 
                              key={trail.id} 
                              className={`relative flex-none w-[260px] sm:w-[300px] aspect-video rounded-md snap-start transition-transform duration-300 hover:scale-105 hover:z-30 cursor-pointer shadow-md border ${
                                theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                              }`}
                              onClick={() => setSelectedTrail(trail)}
                            >
                              <img 
                                src={trail.imageUrl || `https://picsum.photos/seed/${trail.id}/600/340`} 
                                alt={trail.title}
                                className="w-full h-full object-cover rounded-md"
                                referrerPolicy="no-referrer"
                              />
                              
                              {/* Overlay Gradiente Base */}
                              <div className={`absolute inset-0 rounded-md opacity-80 ${theme === 'dark' ? 'bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent' : 'bg-gradient-to-t from-white/90 via-white/20 to-transparent'}`} />
                              
                              {/* Título sempre visível embaixo */}
                              <div className="absolute bottom-3 left-4 right-4 z-10">
                                <h3 className={`font-bold text-sm sm:text-base line-clamp-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{trail.title}</h3>
                              </div>

                              {/* Hover Overlay (Aparece no hover) */}
                              <div className={`absolute inset-0 rounded-md opacity-0 hover:opacity-100 transition-opacity duration-300 flex flex-col justify-center p-4 z-20 shadow-xl border ${
                                theme === 'dark' ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-blue-100'
                              }`}>
                                <div className="flex items-center justify-center gap-3 mb-4">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); navigate(`/trail/${trail.id}`); }}
                                    className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center hover:bg-blue-700 transition-colors"
                                  >
                                    <Play className="w-5 h-5 text-white fill-current ml-1" />
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setSelectedTrail(trail); }}
                                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors ${
                                      theme === 'dark' ? 'border-slate-700 text-slate-400 hover:border-blue-400 hover:text-blue-400' : 'border-slate-300 text-slate-500 hover:border-[#003366] hover:text-[#003366]'
                                    }`}
                                  >
                                    <ChevronDown className="w-5 h-5" />
                                  </button>
                                </div>
                                
                                <div className="text-center">
                                  <div className="flex items-center justify-center gap-2 text-xs font-bold mb-2">
                                  <span className="text-blue-500">{t('dashboard.relevant')}</span>
                                  <span className={`border px-1 rounded ${theme === 'dark' ? 'text-slate-400 border-slate-700' : 'text-slate-500 border-slate-300'}`}>HD</span>
                                </div>
                                <p className={`text-xs line-clamp-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                  {trail.description || t('dashboard.corporateTraining')}
                                </p>
                                </div>

                                {/* Barra de Progresso */}
                                <div className={`absolute bottom-0 left-0 right-0 h-1 rounded-b-md overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                  <div className="h-full bg-blue-500 w-1/3" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </main>
            </>
          ) : (
            <div className="p-8 sm:p-12">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <div>
                    <h1 className={`text-3xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('playbook.title')}</h1>
                    <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>{t('playbook.subtitle')}</p>
                  </div>
                </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {playbookSessions.map((item, i) => {
                    const sessionContents = playbookContents.filter(c => c.sessionId === item.id);
                    const isExpanded = expandedSession === item.id;

                    return (
                      <motion.div 
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`p-6 rounded-xl border transition-all cursor-pointer group flex flex-col ${
                          theme === 'dark' 
                            ? 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-lg' 
                            : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                        }`}
                        onClick={() => navigate(`/playbook/${item.id}`)}
                      >
                        <div className="flex items-start justify-between mb-4">
                          {item.imageUrl ? (
                            <div className="w-16 h-16 rounded-xl overflow-hidden shadow-md border border-slate-200 dark:border-slate-800">
                              <img src={item.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                          ) : (
                            <div className="text-4xl">{item.icon}</div>
                          )}
                          <div className={`p-2 rounded-full transition-transform ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                            <ChevronRight className="w-5 h-5" />
                          </div>
                        </div>
                        <h3 className={`text-xl font-bold mb-2 transition-colors ${theme === 'dark' ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-[#003366]'}`}>{item.title}</h3>
                        <p className={`mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{item.description}</p>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

        {/* Modal Quick View */}
        <AnimatePresence>
          {selectedTrail && (
            <QuickViewModal 
              trail={selectedTrail} 
              onClose={() => setSelectedTrail(null)} 
              user={user}
              userProfile={userProfile}
              isMandatory={isMandatoryForMe(selectedTrail)}
            />
          )}
          {showWelcomeVideo && (
            <WelcomeVideoModal 
              isOpen={showWelcomeVideo}
              onClose={() => setShowWelcomeVideo(false)}
            />
          )}
        </AnimatePresence>

        {/* Level Up Modal */}
        <AnimatePresence>
          {showLevelUp && (
            <LevelUpModal 
              level={userProfile?.level || 1} 
              onClose={() => {
                setShowLevelUp(false);
                setIsDemoMode(false);
              }} 
              isDemo={isDemoMode}
            />
          )}
        </AnimatePresence>

        {/* Modal de Prazo Expirado (Attention Grabber) */}
        <AnimatePresence>
          {showOverdueModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-red-950/90 backdrop-blur-md"
                onClick={() => setShowOverdueModal(false)}
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className={`relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border-4 border-red-500 ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}
              >
                <div className="bg-red-600 p-6 text-center text-white">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-xl rotate-3 ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
                    <Zap className="w-8 h-8 text-red-600" />
                  </div>
                  <h2 className="text-2xl font-black mb-1">{t('dashboard.deadlineMissed')}</h2>
                  <p className="text-white text-sm font-medium leading-tight">{t('dashboard.accountNotBlocked')}</p>
                </div>
                <div className="p-6 text-center">
                  <p className={`mb-6 text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                    {t('dashboard.overdueIdentify', { count: userProfile?.overdueTrailsCount || 1 })}
                    <br /><br />
                    {t('dashboard.leaderNotified')}
                  </p>
                  <button 
                    onClick={() => {
                      setShowOverdueModal(false);
                      setActiveTab('myTrails');
                    }}
                    className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg shadow-red-600/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {t('dashboard.goToMyTrails')}
                  </button>
                  <button 
                    onClick={() => setShowOverdueModal(false)}
                    className="mt-4 text-slate-400 text-xs font-bold hover:text-slate-600 transition-colors"
                  >
                    {t('dashboard.gotIt')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      {isEirPlayerOpen && (
        <EirJourneyPlayer 
          days={eirDays} 
          onClose={() => setIsEirPlayerOpen(false)} 
          onFinish={async () => {
            if (user?.uid) {
              try {
                await updateDoc(doc(db, 'users', user.uid), {
                  onboardingJourney: 'standard'
                });
                setIsEirPlayerOpen(false);
                toast.success('Jornada concluída com sucesso! Bem-vindo(a).');
              } catch (e) {
                console.error('Erro ao finalizar onboarding:', e);
                toast.error('Erro ao finalizar jornada.');
              }
            }
          }}
          isPreview={false} 
        />
      )}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #181818; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3f3f46; 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #52525b; 
        }
      `}</style>
    </div>
  );
}
