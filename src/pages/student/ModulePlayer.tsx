import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { gamificationService } from '../../services/gamificationService';
import { notificationService } from '../../services/notificationService';
import { Module, UserProgress, Trail } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import { ArrowLeft, CheckCircle2, PlayCircle, FileText, MessageSquare, Maximize, Minimize, UploadCloud, ExternalLink, Loader2, AlertCircle, HelpCircle, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import ModuleComments from '../../components/ModuleComments';
import { TrailSurvey } from '../../components/TrailSurvey';
import { VideoPlayer } from '../../components/VideoPlayer';
import { getDirectVideoUrl, getDocumentEmbedUrl } from '../../utils/videoUtils';
import { motion } from 'framer-motion';

export default function ModulePlayer() {
  const { id } = useParams<{ id: string }>();
  const { user, userProfile } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { hasPermission, isManagementAdmin } = usePermissions();
  const navigate = useNavigate();
  const playerContainerRef = React.useRef<HTMLDivElement>(null);
  
  const [moduleData, setModuleData] = useState<Module | null>(null);
  const [trailData, setTrailData] = useState<Trail | null>(null);
  const [trailModules, setTrailModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeSpent, setTimeSpent] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [showSurvey, setShowSurvey] = useState(false);
  const [nextModuleId, setNextModuleId] = useState<string | null>(null);
  const lastSyncedTime = React.useRef<number>(-1);
  const lastVideoProgress = React.useRef({ percentage: 0, currentTime: 0 });

  useEffect(() => {
    if (moduleData && trailModules.length > 0) {
      const currentIndex = trailModules.findIndex(m => m.id === moduleData.id);
      if (currentIndex !== -1 && currentIndex < trailModules.length - 1) {
        setNextModuleId(trailModules[currentIndex + 1].id!);
      } else {
        setNextModuleId(null);
      }
    }
  }, [moduleData, trailModules]);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activityFile, setActivityFile] = useState<File | null>(null);
  
  // Quiz State
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [quizResult, setQuizResult] = useState<{ score: number, passed: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'comments'>('content');

  // Fullscreen tracking
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!playerContainerRef.current) return;
    
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(err => {
        console.error(`Erro ao tentar entrar em tela cheia: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const formatTime = (seconds: number) => {
    const mm = Math.floor(seconds / 60);
    const ss = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  // Page Visibility tracking
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Time tracking effect - now with play/pause and visibility checks
  useEffect(() => {
    if (loading || !id || !user || !isPageVisible || !isVideoPlaying || showQuiz) return;

    const isIframe = moduleData?.videoEmbedUrl || moduleData?.videoUrl?.includes('drive.google.com');
    const isDirect = !!getDirectVideoUrl(moduleData?.videoUrl || moduleData?.videoEmbedUrl || '');
    
    // Only use simulated timer if it's an iframe AND NOT a direct video link
    if (!isIframe || isDirect) return;

    const timer = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, id, user, isPageVisible, isVideoPlaying, showQuiz, moduleData]);

  // Periodic sync to Firestore (every 30 seconds)
  useEffect(() => {
    const shouldSync = timeSpent > 0 && timeSpent % 30 === 0 && timeSpent !== lastSyncedTime.current;
    
    if (shouldSync && progress && id && user?.uid) {
      lastSyncedTime.current = timeSpent;
      const syncTime = async () => {
        const progressId = `${user.uid}_${id}`;
        
        // Use the maximum of simulated time or actual video time
        const currentTotalSeconds = (progress.timeSpentSeconds || 0) + timeSpent;
        let newTotalSeconds = Math.min(currentTotalSeconds, moduleData?.duration || currentTotalSeconds);
        
        // Calculate simulated percentage for iframes
        let newVideoPercentage = progress.videoPercentage || 0;
        if (moduleData?.duration) {
          newVideoPercentage = Math.min(Math.floor((newTotalSeconds / moduleData.duration) * 100), 100);
        }

        // Check for time milestones and award points (secretly)
        let newTimePointsAwarded = progress.timePointsAwarded || 0;
        if (shouldAwardPoints()) {
          newTimePointsAwarded = await gamificationService.awardTimeMilestonePoints(
            user.uid,
            newTotalSeconds,
            progress.timePointsAwarded || 0
          );
        }

        const updates: any = {
          timeSpentSeconds: newTotalSeconds,
          timePointsAwarded: newTimePointsAwarded,
          lastUpdatedAt: Date.now()
        };

        if (newVideoPercentage > (progress.videoPercentage || 0)) {
          updates.videoPercentage = newVideoPercentage;
        }

        try {
          await setDoc(doc(db, 'user_progress', progressId), updates, { merge: true });
          
          setProgress(prev => prev ? {
            ...prev,
            timeSpentSeconds: newTotalSeconds,
            timePointsAwarded: newTimePointsAwarded,
            videoPercentage: updates.videoPercentage || prev.videoPercentage
          } : null);
        } catch (error) {
          console.error("Error syncing time:", error);
        }
      };
      syncTime();
    }
  }, [timeSpent, id, user?.uid, moduleData?.duration]); // Removed progress from dependencies to avoid loop

  // Final sync on unmount
  useEffect(() => {
    return () => {
      if (timeSpent > 0 && progress && id && user?.uid) {
        const finalSync = async () => {
          const progressId = `${user.uid}_${id}`;
          // We use a small trick here: since we can't easily await in unmount, 
          // we hope the browser keeps the request alive or we use sendBeacon if it was a real API.
          // For Firestore, we just fire and forget.
          setDoc(doc(db, 'user_progress', progressId), {
            timeSpentSeconds: (progress.timeSpentSeconds || 0) + (timeSpent % 30),
            lastUpdatedAt: Date.now()
          }, { merge: true });
        };
        finalSync();
      }
    };
  }, [id, user?.uid]); // Only run on unmount/id change

  useEffect(() => {
    if (!id || !user || !userProfile) return;

    const fetchModule = async () => {
      setLoading(true);
      try {
        const modSnap = await getDoc(doc(db, 'modules', id));
        if (!modSnap.exists()) {
          console.error("Módulo não encontrado:", id);
          navigate('/');
          return;
        }
        const mod = { id: modSnap.id, ...modSnap.data() } as Module;
        setModuleData(mod);

        // Fetch Trail or Project to check permissions
        if (mod.trailId) {
          const trailSnap = await getDoc(doc(db, 'trails', mod.trailId));
          if (trailSnap.exists()) {
            const trail = { id: trailSnap.id, ...trailSnap.data() } as Trail;
            
            // Fetch all modules for this trail to enable navigation and robust enrollment check
            const qModules = query(collection(db, 'modules'), where('trailId', '==', mod.trailId));
            const modulesSnap = await getDocs(qModules);
            const mods = modulesSnap.docs
              .map(d => ({ id: d.id, ...d.data() } as Module))
              .sort((a, b) => a.order - b.order);
            setTrailModules(mods);
            const trailModuleIds = mods.map(m => m.id);

            // 1. Check if user is already enrolled (has any progress in this trail)
            // We check for progress in the current module OR any module of this trail
            const qProgressUser = query(
              collection(db, 'user_progress'), 
              where('userId', '==', user.uid)
            );
            const progressUserSnap = await getDocs(qProgressUser);
            const userProgressDocs = progressUserSnap.docs.map(d => d.data() as UserProgress);
            
            let isEnrolled = userProgressDocs.some(up => 
              up.moduleId === id || 
              up.trailId === mod.trailId || 
              trailModuleIds.includes(up.moduleId)
            );

            // 2. Check if trail belongs to any of user's projects
            let isMandatoryByProject = false;
            if (userProfile?.projectIds && userProfile.projectIds.length > 0) {
              const projectsSnap = await getDocs(collection(db, 'projects'));
              const userProjects = projectsSnap.docs.filter(d => 
                userProfile.projectIds?.includes(d.id) || 
                userProfile.projectIds?.includes(d.data().name)
              );
              
              isMandatoryByProject = userProjects.some(doc => {
                const pData = doc.data();
                return pData.trailIds?.includes(mod.trailId);
              });
            }

            // 3. Check Country Permission
            const isCountryMatch = !trail.countryIds || trail.countryIds.length === 0 || 
                                  trail.countryIds.includes(userProfile?.countryId || '') ||
                                  trail.countryIds.includes(userProfile?.country || '');
            
            // 4. Area check (overrides country)
            let isInUserArea = !trail.areaIds || trail.areaIds.length === 0 || 
                               trail.areaIds.includes(userProfile?.areaId || '');
            
            if (!isInUserArea && userProfile?.areaId) {
              const areasSnap = await getDocs(collection(db, 'areas'));
              const userArea = areasSnap.docs.find(d => d.id === userProfile.areaId || d.data().name === userProfile.areaId);
              if (userArea) {
                const userAreaName = userArea.data().name;
                isInUserArea = trail.areaIds?.some(aid => {
                  const trailArea = areasSnap.docs.find(d => d.id === aid);
                  return trailArea?.data().name === userAreaName;
                }) || false;
              }
            }
            
            // 5. Mandatory check (overrides country)
            const isMandatoryByArea = trail.isMandatory && isInUserArea;

            // Access is allowed if:
            // 1. User is Management Admin
            // 2. Country matches
            // 3. User is already enrolled (has progress)
            // 4. Trail is in user's area
            // 5. Trail is in user's project
            // 6. Trail is Public
            const hasAccess = isManagementAdmin || isCountryMatch || isEnrolled || isInUserArea || isMandatoryByProject || trail.isPublic;

            if (!hasAccess) {
              console.warn("Sem permissão de acesso para trilha:", trail.id, { 
                isCountryMatch, 
                isManagementAdmin, 
                isEnrolled, 
                isInUserArea,
                isMandatoryByProject,
                isPublic: trail.isPublic,
                userArea: userProfile?.areaId,
                userProjects: userProfile?.projectIds,
                trailAreas: trail.areaIds,
                trailCountries: trail.countryIds
              });
              toast.error('Você não tem permissão para acessar esta trilha.');
              navigate('/dashboard');
              return;
            }
            
            setTrailData(trail);
          }
        } else if (mod.projectId) {
          const projectSnap = await getDoc(doc(db, 'projects', mod.projectId));
          if (projectSnap.exists()) {
            if (!userProfile?.projectIds?.includes(mod.projectId) && !isManagementAdmin) {
              console.warn("Sem permissão de projeto para módulo:", mod.id);
              toast.error(t('learning.noPermission'));
              navigate('/dashboard');
              return;
            }
          }
        }

        const progressId = `${user.uid}_${id}`;
        const progSnap = await getDoc(doc(db, 'user_progress', progressId));
        
        if (progSnap.exists()) {
          const progressData = progSnap.data() as UserProgress;
          setProgress(progressData);
          
          // Se o conteúdo já foi concluído e tem quiz, mostrar o quiz automaticamente
          const hasQuiz = mod.questions && mod.questions.length > 0;
          const contentFinished = progressData.pointsAwarded?.[mod.type || 'video'] || false;
          if (hasQuiz && contentFinished && !progressData.status.includes('completed')) {
            setShowQuiz(true);
          }
        } else {
          // Inicializa progresso se não existir
          const newProgress: UserProgress = {
            id: progressId,
            userId: user.uid,
            areaId: userProfile?.areaId || null,
            trailId: mod.trailId || '',
            projectId: mod.projectId || '',
            moduleId: id,
            status: 'in_progress',
            videoPercentage: 0,
            timeSpentSeconds: 0,
            highestQuizScore: 0,
            quizAttempts: 0,
            pointsAwarded: {
              video: false,
              quiz: false,
              activity: false
            },
            activitySubmission: null,
            timePointsAwarded: 0,
            lastUpdatedAt: Date.now()
          };
          await setDoc(doc(db, 'user_progress', progressId), newProgress);
          setProgress(newProgress);
        }
      } catch (error) {
        console.error("Erro ao carregar módulo/progresso:", error);
        handleFirestoreError(error, OperationType.GET, `modules/${id}`);
      } finally {
        setLoading(false);
      }
    };

    fetchModule();
  }, [id, user, userProfile, navigate, isManagementAdmin]);

  useEffect(() => {
    if (trailData && progress) {
      checkTrailCompletion();
    }
  }, [trailData, progress]);

  // Helper to check if points should be awarded
  const shouldAwardPoints = () => {
    if (!user || !trailData) return false;
    
    // Se for administrador, só ganha pontos se for de uma das áreas dele ou obrigatório para todos
    if (isManagementAdmin) {
      const isMyArea = trailData.areaIds?.includes(userProfile?.areaId || '');
      const isMandatoryForAll = trailData.isMandatory && (!trailData.areaIds || trailData.areaIds.length === 0);
      
      if (!isMyArea && !isMandatoryForAll) {
        console.log('Admin completing non-relevant trail: no points awarded.');
        return false;
      }
    }
    
    return true;
  };

  // Simulação de Tracking de Vídeo (Em um cenário real, usariamos a API do YouTube/Vimeo)
  const handleMarkContentCompleted = async () => {
    if (!progress || !moduleData || !user) {
      console.error("Missing data for completion:", { 
        progress: !!progress, 
        moduleData: !!moduleData, 
        user: !!user,
        moduleId: id,
        userId: user?.uid
      });
      toast.error("Erro ao processar conclusão. Tente recarregar a página.");
      return;
    }
    
    console.log("Marking content completed for module:", moduleData.id, "Type:", moduleData.type);
    
    // Se não tem quiz obrigatório, marcar conteúdo como concluído já conclui o módulo
    const hasQuiz = moduleData.questions && moduleData.questions.length > 0 && moduleData.quizConfig?.isRequired;
    const newStatus = hasQuiz ? 'in_progress' : 'completed';
    const alreadyAwardedContent = progress.pointsAwarded?.[moduleData.type || 'video'] || false;
    
    const updatedProgress: UserProgress = {
      ...progress,
      videoPercentage: (moduleData.type === 'video' || !moduleData.type) ? 100 : progress.videoPercentage,
      status: newStatus,
      pointsAwarded: {
        ...progress.pointsAwarded,
        [moduleData.type || 'video']: true
      },
      lastUpdatedAt: Date.now()
    };
    
    try {
      console.log("Updating progress in Firestore:", progress.id);
      await setDoc(doc(db, 'user_progress', progress.id!), updatedProgress);
      setProgress(updatedProgress);
      console.log("Progress updated successfully");

      // Award points only once
      if (!alreadyAwardedContent && shouldAwardPoints()) {
        const points = moduleData.type === 'activity' ? 150 : 100;
        await gamificationService.addPoints(user.uid, points);
        toast.success('Parabéns!', {
          description: `Você concluiu o conteúdo do módulo e ganhou ${points} pontos.`
        });
        if (userProfile?.leaderEmail) {
          await notificationService.notifyLeader(userProfile.name, userProfile.leaderEmail, `concluiu o conteúdo do módulo "${moduleData.title}"`);
        }
      }

      // Check for Module Completion Points (if no quiz required)
      if (!hasQuiz && !alreadyAwardedContent && shouldAwardPoints()) {
        await awardModuleCompletionPoints(updatedProgress);
      }
      
      if (hasQuiz && !showQuiz) {
        setShowQuiz(true);
      }
    } catch (error) {
      console.error("Error updating progress:", error);
      handleFirestoreError(error, OperationType.UPDATE, `user_progress/${progress.id}`);
    }
  };

  const handleActivitySubmit = async () => {
    if (!activityFile || !progress || !moduleData || !user) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const storageRef = ref(storage, `submissions/${user.uid}/${moduleData.id}/${Date.now()}_${activityFile.name}`);
      const uploadTask = uploadBytesResumable(storageRef, activityFile);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Submission upload error:', error);
          setIsUploading(false);
          toast.error('Erro ao enviar arquivo. Tente novamente.');
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          const submission = {
            url: downloadURL,
            fileName: activityFile.name,
            submittedAt: Date.now(),
            status: 'pending' as const
          };

          const updatedProgress: UserProgress = {
            ...progress,
            activitySubmission: submission,
            lastUpdatedAt: Date.now()
          };

          await setDoc(doc(db, 'user_progress', progress.id!), updatedProgress);
          setProgress(updatedProgress);
          setIsUploading(false);
          setActivityFile(null);
          toast.success('Atividade enviada com sucesso!', {
            description: 'Um administrador irá revisar seu envio.'
          });

          // Se não tiver quiz, marca como conteúdo concluído para ganhar pontos de participação
          if (!moduleData.quizConfig.isRequired) {
            handleMarkContentCompleted();
          }
        }
      );
    } catch (error) {
      console.error('Activity submission error:', error);
      setIsUploading(false);
      toast.error('Erro ao processar envio.');
    }
  };

  const handleVideoProgress = (percentage: number, currentTime: number) => {
    lastVideoProgress.current = { percentage, currentTime };
    // Update local timeSpent based on actual video progress for direct videos
    if (moduleData?.duration) {
      const actualTimeSpent = Math.floor(currentTime);
      // We only update if it's a direct video, otherwise we use the simulated timer
      const isDirect = !!getDirectVideoUrl(moduleData?.videoUrl || moduleData?.videoEmbedUrl || '');
      if (isDirect) {
        setTimeSpent(actualTimeSpent);
      }
    }
  };

  const handleAnswerOption = (optionIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < (moduleData?.questions.length || 0) - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    if (!moduleData || !progress || !user) return;

    let correctCount = 0;
    moduleData.questions.forEach((q, index) => {
      if (answers[index] === q.correctOptionIndex) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / moduleData.questions.length) * 100);
    const passed = score >= moduleData.quizConfig.passingScore;
    const currentAttempts = (progress.quizAttempts || 0) + 1;

    setQuizResult({ score, passed });

    // Atualiza progresso se passou ou se a nota foi maior que a anterior
    const highestScore = Math.max(score, progress.highestQuizScore);
    const newStatus = passed ? 'completed' : progress.status;
    const alreadyAwardedQuiz = progress.pointsAwarded?.quiz || false;

    const updatedProgress: UserProgress = {
      ...progress,
      highestQuizScore: highestScore,
      quizAttempts: currentAttempts,
      status: newStatus,
      pointsAwarded: {
        ...progress.pointsAwarded,
        quiz: alreadyAwardedQuiz || passed
      },
      lastUpdatedAt: Date.now()
    };

    await setDoc(doc(db, 'user_progress', progress.id!), updatedProgress);
    setProgress(updatedProgress);

    // Handle points based on result
    if (passed) {
      // Award points only once when passing
      if (!alreadyAwardedQuiz && shouldAwardPoints()) {
        // Calculate points based on score
        const basePoints = 200;
        const scoreFactor = score / 100;
        
        // Removed attempt multiplier as requested: "continue ganhando pelo acerto"
        const quizPoints = Math.round(basePoints * scoreFactor);
        
        await gamificationService.addPoints(user.uid, quizPoints, `Quiz aprovado: ${moduleData.title}`);
        toast.success(t('learning.quizPassed'), {
          description: t('onboarding.pointsEarned', { points: quizPoints })
        });
        
        if (userProfile?.leaderEmail) {
          await notificationService.notifyLeader(userProfile.name, userProfile.leaderEmail, `concluiu o quiz do módulo "${moduleData.title}" com nota ${score}% em ${currentAttempts} tentativa(s)`);
        }

        // Check for Module Completion Points
        const isVideoWatched = updatedProgress.videoPercentage === 100;
        if (isVideoWatched && !updatedProgress.pointsAwarded?.module) {
          await awardModuleCompletionPoints(updatedProgress);
        }
      }
    } else {
      // Penalty for failing the quiz
      if (shouldAwardPoints()) {
        const penaltyPoints = 50; // Penalty of 50 points for failing
        await gamificationService.removePoints(user.uid, penaltyPoints, `Falha no quiz: ${moduleData.title}`);
        toast.error(t('learning.quizFailed'), {
          description: t('onboarding.taskCompleted', { task: t('learning.quiz'), points: -penaltyPoints }).replace('Tarefa concluída', 'Quiz Reprovado').replace('+', '')
        });
        
        if (userProfile?.leaderEmail) {
          await notificationService.notifyLeader(userProfile.name, userProfile.leaderEmail, `falhou no quiz do módulo "${moduleData.title}" com nota ${score}%`);
        }
      }
    }
  };

  const awardModuleCompletionPoints = async (currentProgress: UserProgress) => {
    if (!user || !moduleData || currentProgress.pointsAwarded?.module) return;

    const updatedProgress = {
      ...currentProgress,
      pointsAwarded: {
        ...currentProgress.pointsAwarded,
        module: true
      }
    };
    
    await updateDoc(doc(db, 'user_progress', currentProgress.id!), {
      'pointsAwarded.module': true
    });
    setProgress(updatedProgress);

    // Complete onboarding task if applicable
    if (userProfile?.isOnboarding && !userProfile.onboardingTasks?.firstModule) {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'onboardingTasks.firstModule': true
      });
      await gamificationService.addPoints(user.uid, 100, 'Onboarding: Primeiro Módulo');
      toast.success(t('onboarding.taskCompleted', { task: t('onboarding.firstModule'), points: 100 }));
    }

    // Check for Trail Completion
    await checkTrailCompletion();
  };

  const checkTrailCompletion = async () => {
    if (!user || !trailData || !trailData.id) return;

    try {
      // Fetch all modules for this trail
      const modulesQuery = query(collection(db, 'modules'), where('trailId', '==', trailData.id));
      const modulesSnap = await getDocs(modulesQuery);
      const trailModules = modulesSnap.docs;

      // Fetch user progress for all modules in this trail
      const progressQuery = query(
        collection(db, 'user_progress'), 
        where('userId', '==', user.uid),
        where('trailId', '==', trailData.id),
        where('status', '==', 'completed')
      );
      const progressSnap = await getDocs(progressQuery);
      const completedModulesCount = progressSnap.docs.length;

      if (completedModulesCount === trailModules.length && trailModules.length > 0) {
        // Check if survey is already completed
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        
        const completedSurveys = userData?.completedSurveys || [];
        if (!completedSurveys.includes(trailData.id)) {
          setShowSurvey(true);
          return;
        }

        // Check if trail points already awarded
        const awardedTrails = userData?.awardedTrails || [];
        if (!awardedTrails.includes(trailData.id)) {
          await awardTrailCompletionPoints();
        }
      }
    } catch (error) {
      console.error("Error checking trail completion:", error);
    }
  };

  const awardTrailCompletionPoints = async () => {
    if (!user || !trailData || !trailData.id) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      const awardedTrails = userData?.awardedTrails || [];

      if (!awardedTrails.includes(trailData.id)) {
        // Award 500 points for trail completion
        await gamificationService.addPoints(user.uid, 500);
        toast.success(t('learning.trailCompleted'), {
          description: t('onboarding.pointsEarned', { points: 500 }),
          duration: 5000
        });
        
        await updateDoc(userRef, {
          awardedTrails: [...awardedTrails, trailData.id]
        });

        // Notify user
        await notificationService.createNotification({
          userId: user.uid,
          title: 'Trilha Concluída! 🏆',
          message: `Parabéns! Você concluiu a trilha "${trailData.title}" e ganhou 500 pontos extras!`,
          type: 'general'
        }, userData?.email);
      }
    } catch (error) {
      console.error("Error awarding trail points:", error);
    }
  };

  if (loading || !moduleData) return (
    <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}>
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <p className="font-medium animate-pulse">{t('learning.loading')}</p>
      </div>
    </div>
  );

  if (!progress && !loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 text-center ${theme === 'dark' ? 'bg-slate-950' : 'bg-white'}`}>
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('learning.errorLoadingProgress')}</h2>
        <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} mb-6`}>{t('learning.errorLoadingProgressSub')}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors"
        >
          {t('common.reload')}
        </button>
      </div>
    );
  }

  const isCompleted = progress?.status === 'completed';
  const hasQuiz = moduleData.questions && moduleData.questions.length > 0;
  const isQuizRequired = hasQuiz && moduleData.quizConfig?.isRequired;
  const contentFinished = progress?.pointsAwarded?.[moduleData.type || 'video'] || false;

  return (
    <div className="min-h-screen text-slate-700 flex flex-col">
      {/* Navbar do Player */}
      <div className="h-16 bg-[#003366] flex items-center px-6 shadow-lg shrink-0">
        <Link to={`/trail/${moduleData.trailId}`} className="flex items-center gap-2 text-sm font-medium text-blue-200 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar para Trilha
        </Link>
        <div className="mx-auto flex items-center gap-4">
          <h1 className="text-white font-bold">{moduleData.title}</h1>
        </div>
        <div className="w-24"></div> {/* Spacer for centering */}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Área Principal (Vídeo ou Quiz) */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 flex flex-col items-center">
          
          {!showQuiz ? (
            <div className="w-full max-w-5xl">
              {/* Conteúdo do Módulo baseado no Tipo */}
              <div className="mb-8">
                {moduleData.type === 'video' || !moduleData.type ? (
                  <>
                    {/* Progress Header for Iframe Videos (Google Drive/YouTube/Vimeo) */}
                    {(moduleData.videoEmbedUrl || moduleData.videoUrl?.includes('drive.google.com')) && moduleData.duration && (
                      <div className="w-full flex items-center justify-between mb-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status do Treinamento</span>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                                {Math.min(Math.floor(Math.min((progress?.timeSpentSeconds || 0) + timeSpent, moduleData.duration) / moduleData.duration * 100), 100)}%
                              </span>
                              <span className="text-xs font-bold text-slate-500">Concluído</span>
                            </div>
                          </div>
                          <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                          <div className="hidden sm:flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Tempo Assistido</span>
                            <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">
                              {formatTime(Math.min((progress?.timeSpentSeconds || 0) + timeSpent, moduleData.duration))} / {formatTime(moduleData.duration)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex-1 max-w-xs ml-8 hidden md:block">
                          <div className="relative w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(Math.floor(Math.min((progress?.timeSpentSeconds || 0) + timeSpent, moduleData.duration) / moduleData.duration * 100), 100)}%` }}
                              className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium italic ml-4">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span className="hidden lg:inline">Salvamento automático ativo</span>
                        </div>
                      </div>
                    )}

                    <div 
                      ref={playerContainerRef}
                      className={`relative group rounded-xl overflow-hidden shadow-2xl ${isFullScreen ? 'bg-black w-full h-full flex items-center justify-center' : ''}`}
                    >
                      {moduleData.videoUrl || moduleData.videoEmbedUrl ? (
                        <VideoPlayer 
                          src={moduleData.videoUrl || moduleData.videoEmbedUrl}
                          onProgress={handleVideoProgress}
                          onComplete={handleMarkContentCompleted}
                          onPlay={() => setIsVideoPlaying(true)}
                          onPause={() => setIsVideoPlaying(false)}
                          onToggleFullScreen={toggleFullScreen}
                          isFullScreen={isFullScreen}
                          initialTime={progress?.lastTimeSeconds || 0}
                        />
                      ) : (
                        <div className="aspect-video bg-slate-900 flex flex-col items-center justify-center text-slate-500">
                          <PlayCircle className="w-16 h-16 mb-4 opacity-50" />
                          <p>Nenhum vídeo configurado para este módulo.</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : moduleData.type === 'document' ? (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                          <FileText className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                          <h2 className="font-bold text-slate-900 dark:text-white">Documento de Apoio</h2>
                          <p className="text-xs text-slate-500 uppercase font-black tracking-widest">
                            {moduleData.documentType === 'slides' ? 'Apresentação / Slides' : 
                             moduleData.documentType === 'sheets' ? 'Planilha / Sheets' : 
                             moduleData.documentType}
                          </p>
                        </div>
                      </div>
                      {moduleData.documentUrl && (
                        <a 
                          href={moduleData.documentUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-emerald-600/20"
                        >
                          <ExternalLink className="w-4 h-4" /> {moduleData.documentType === 'link' || moduleData.documentType === 'slides' || moduleData.documentType === 'sheets' ? 'Acessar Link' : 'Abrir Documento'}
                        </a>
                      )}
                    </div>
                    <div className="p-8 flex flex-col items-center justify-center min-h-[300px] text-center">
                      {moduleData.documentType === 'image' && moduleData.documentUrl ? (
                        <div className="max-w-full mb-6 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                          <img src={moduleData.documentUrl} alt={moduleData.title} className="max-h-[500px] object-contain" referrerPolicy="no-referrer" />
                        </div>
                      ) : getDocumentEmbedUrl(moduleData.documentUrl || '') ? (
                        <div className="w-full aspect-[4/3] mb-6 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                          <iframe 
                            src={getDocumentEmbedUrl(moduleData.documentUrl!)!} 
                            className="w-full h-full" 
                            allowFullScreen
                          ></iframe>
                        </div>
                      ) : (
                        <FileText className="w-20 h-20 text-slate-200 dark:text-slate-800 mb-4" />
                      )}
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                        {moduleData.documentType === 'image' ? 'Visualize a imagem acima' : 
                         getDocumentEmbedUrl(moduleData.documentUrl || '') ? 'Visualize o conteúdo acima' :
                         'Visualize o documento para prosseguir'}
                      </h3>
                      <p className="text-slate-500 max-w-md mb-8">
                        {moduleData.documentType === 'image' ? 'Este módulo contém uma imagem importante para o seu aprendizado.' : 
                         moduleData.documentType === 'slides' ? 'Este módulo contém uma apresentação de slides. Clique no botão acima para acessar.' :
                         moduleData.documentType === 'sheets' ? 'Este módulo contém uma planilha de dados. Clique no botão acima para acessar.' :
                         'Este módulo contém um documento importante para o seu aprendizado. Clique no botão acima para abrir e ler o conteúdo.'}
                      </p>
                      {!isCompleted && (
                        <button
                          onClick={handleMarkContentCompleted}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-full font-bold shadow-lg transition-all transform hover:scale-105 flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-5 h-5" /> Marcar como Lido
                        </button>
                      )}
                    </div>
                  </div>
                ) : moduleData.type === 'activity' ? (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-3">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <UploadCloud className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <h2 className="font-bold text-slate-900 dark:text-white">Atividade Prática</h2>
                        <p className="text-xs text-slate-500 uppercase font-black tracking-widest">Envio de Arquivo</p>
                      </div>
                    </div>
                    <div className="p-8">
                      <div className="mb-8 p-6 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                        <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" /> Instruções
                        </h3>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                          {moduleData.activityConfig?.instructions || 'Nenhuma instrução fornecida.'}
                        </p>
                        <div className="mt-4 flex gap-4 text-[10px] font-bold uppercase text-slate-500">
                          <span>Formatos: {moduleData.activityConfig?.requiredFileType || 'Qualquer'}</span>
                          <span>Tamanho Máx: {moduleData.activityConfig?.maxFileSizeMB || 10}MB</span>
                        </div>
                      </div>

                      {progress?.activitySubmission ? (
                        <div className="p-6 border-2 border-emerald-500/20 bg-emerald-500/5 rounded-xl flex flex-col items-center text-center">
                          <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Atividade Enviada!</h3>
                          <p className="text-sm text-slate-500 mb-4">
                            Seu arquivo <strong>{progress.activitySubmission.fileName}</strong> foi recebido.
                          </p>
                          <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            progress.activitySubmission.status === 'approved' ? 'bg-emerald-500 text-white' :
                            progress.activitySubmission.status === 'rejected' ? 'bg-red-500 text-white' :
                            'bg-amber-500 text-white'
                          }`}>
                            {progress.activitySubmission.status === 'approved' ? 'Aprovada' :
                             progress.activitySubmission.status === 'rejected' ? 'Rejeitada' : 'Em Revisão'}
                          </div>
                          
                          {progress.activitySubmission.status === 'rejected' && (
                            <div className="mt-6 w-full max-w-md">
                              <p className="text-xs text-red-500 font-bold uppercase mb-3">Sua atividade foi rejeitada. Envie novamente:</p>
                              <label className={`flex flex-col items-center justify-center gap-4 p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                                theme === 'dark' ? 'border-slate-700 hover:border-purple-500 bg-slate-800/50' : 'border-slate-200 hover:border-purple-500 bg-slate-50'
                              }`}>
                                {isUploading ? (
                                  <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                                ) : activityFile ? (
                                  <span className="text-sm font-bold">{activityFile.name}</span>
                                ) : (
                                  <span className="text-xs font-bold uppercase text-slate-500">Selecionar Novo Arquivo</span>
                                )}
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  onChange={(e) => setActivityFile(e.target.files?.[0] || null)}
                                  disabled={isUploading}
                                />
                              </label>
                              {activityFile && !isUploading && (
                                <button
                                  onClick={handleActivitySubmit}
                                  className="mt-4 w-full py-2 bg-purple-600 text-white rounded-lg font-bold text-sm"
                                >
                                  Reenviar Atividade
                                </button>
                              )}
                            </div>
                          )}

                          {progress.activitySubmission.feedback && (
                            <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-lg border border-emerald-500/20 text-sm italic text-slate-600 dark:text-slate-400">
                              "{progress.activitySubmission.feedback}"
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <label className={`flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                            theme === 'dark' ? 'border-slate-700 hover:border-purple-500 bg-slate-800/50' : 'border-slate-200 hover:border-purple-500 bg-slate-50'
                          }`}>
                            {isUploading ? (
                              <div className="flex flex-col items-center gap-4">
                                <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
                                <div className="text-center">
                                  <p className="font-bold text-purple-500">{uploadProgress}%</p>
                                  <p className="text-xs text-slate-500 uppercase font-black">Enviando arquivo...</p>
                                </div>
                              </div>
                            ) : activityFile ? (
                              <div className="flex flex-col items-center gap-2">
                                <FileText className="w-12 h-12 text-purple-500" />
                                <p className="font-bold text-slate-900 dark:text-white">{activityFile.name}</p>
                                <p className="text-xs text-slate-500">{(activityFile.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                            ) : (
                              <>
                                <UploadCloud className="w-12 h-12 text-slate-300" />
                                <div className="text-center">
                                  <p className="font-bold text-slate-900 dark:text-white">Clique para selecionar o arquivo</p>
                                  <p className="text-xs text-slate-500 uppercase font-black mt-1">Ou arraste e solte aqui</p>
                                </div>
                              </>
                            )}
                            <input 
                              type="file" 
                              className="hidden" 
                              onChange={(e) => setActivityFile(e.target.files?.[0] || null)}
                              disabled={isUploading}
                            />
                          </label>

                          {activityFile && !isUploading && (
                            <div className="flex justify-center gap-3">
                              <button
                                onClick={() => setActivityFile(null)}
                                className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-all"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={handleActivitySubmit}
                                className="px-8 py-2.5 text-xs font-black uppercase tracking-widest text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-all shadow-lg shadow-purple-600/20"
                              >
                                Enviar Atividade
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center text-center shadow-xl">
                    <HelpCircle className="w-20 h-20 text-blue-500/20 mb-6" />
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Este módulo é um Quiz</h2>
                    <p className="text-slate-500 max-w-md mb-8">
                      Não há conteúdo prévio para este módulo. Você pode iniciar o quiz diretamente para testar seus conhecimentos.
                    </p>
                    <button
                      onClick={() => setShowQuiz(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-4 rounded-full font-bold shadow-xl transition-all transform hover:scale-105"
                    >
                      Iniciar Quiz Agora
                    </button>
                  </div>
                )}
              </div>

              {/* Status de Conclusão e Navegação */}
              <div className="mt-8 flex flex-col items-center gap-6">
                {isCompleted ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-6 py-3 rounded-full font-bold border border-emerald-200 dark:border-emerald-500/20 shadow-sm">
                      <CheckCircle2 className="w-5 h-5" /> Módulo Concluído
                    </div>
                    
                    <div className="flex flex-wrap justify-center gap-4">
                      {hasQuiz && !showQuiz && (
                        <button
                          onClick={() => setShowQuiz(true)}
                          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-bold shadow-lg transition-all transform hover:scale-105"
                        >
                          <HelpCircle className="w-5 h-5" /> Refazer Quiz
                        </button>
                      )}
                      
                      {nextModuleId && (
                        <Link
                          to={`/module/${nextModuleId}`}
                          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-10 py-4 rounded-full font-bold shadow-xl transition-all transform hover:scale-105"
                        >
                          Próximo Módulo <ChevronRight className="w-5 h-5" />
                        </Link>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    {/* Botão de Concluir Módulo/Vídeo */}
                    {!isCompleted && (
                      <div className="flex flex-col items-center gap-4">
                        <button
                          onClick={handleMarkContentCompleted}
                          className={`flex items-center gap-2 px-10 py-4 rounded-full font-bold shadow-xl transition-all transform hover:scale-105 ${
                            contentFinished 
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          {hasQuiz 
                            ? (contentFinished ? 'Refazer Conteúdo' : (moduleData.type === 'video' || !moduleData.type ? 'Concluir Vídeo' : 'Concluir Leitura'))
                            : (contentFinished ? 'Módulo Concluído' : (moduleData.type === 'video' || !moduleData.type ? 'Concluir Vídeo' : 'Concluir Leitura'))
                          }
                        </button>
                        
                        {!contentFinished && (
                          <div className="text-sm text-slate-500 font-medium italic">
                            {moduleData.type === 'video' || !moduleData.type 
                              ? 'Após assistir, clique no botão acima para concluir.' 
                              : 'Após ler o conteúdo, clique no botão acima para concluir.'}
                          </div>
                        )}

                        {contentFinished && hasQuiz && !showQuiz && (
                          <button
                            onClick={() => setShowQuiz(true)}
                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-10 py-4 rounded-full font-bold shadow-xl transition-all transform hover:scale-105"
                          >
                            Ir para o Quiz <ChevronRight className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Interface do Quiz */
            <div className="w-full max-w-2xl bg-white rounded-2xl p-8 border border-slate-200 shadow-2xl mt-10">
              {quizResult ? (
                <div className="text-center py-8">
                  <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 ${quizResult.passed ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    {quizResult.passed ? <CheckCircle2 className="w-10 h-10" /> : <span className="text-3xl font-bold">!</span>}
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">
                    {quizResult.passed ? 'Aprovado!' : 'Reprovado! Tente Novamente!'}
                  </h2>
                  <p className="text-slate-600 mb-8">
                    Você acertou <span className="text-slate-900 font-bold">{quizResult.score}%</span> do teste. 
                    A nota de corte é {moduleData.quizConfig.passingScore}%.
                  </p>
                  
                  <div className="flex justify-center gap-4">
                    {!quizResult.passed && (
                      <button 
                        onClick={() => {
                          setQuizResult(null);
                          setCurrentQuestionIndex(0);
                          setAnswers([]);
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-lg font-bold transition-colors border border-slate-200"
                      >
                        Tentar Novamente
                      </button>
                    )}
                    <Link 
                      to={`/trail/${moduleData.trailId}`}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-lg font-bold transition-colors border border-slate-200"
                    >
                      Voltar para Trilha
                    </Link>

                    {quizResult.passed && nextModuleId && (
                      <Link 
                        to={`/module/${nextModuleId}`}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-bold transition-colors shadow-md flex items-center gap-2"
                      >
                        Próximo Módulo <ChevronRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-8 text-sm font-bold text-slate-400">
                    <span className="uppercase tracking-wider">Quiz de Fixação</span>
                    <span>Pergunta {currentQuestionIndex + 1} de {moduleData.questions.length}</span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-900 mb-8 leading-relaxed">
                    {moduleData.questions[currentQuestionIndex]?.questionText}
                  </h3>

                  <div className="space-y-3">
                    {moduleData.questions[currentQuestionIndex]?.options.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAnswerOption(idx)}
                        className={`w-full text-left p-4 rounded-xl border transition-all font-medium ${
                          answers[currentQuestionIndex] === idx 
                            ? 'bg-blue-50 border-[#003366] text-[#003366] shadow-sm' 
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  <div className="mt-10 flex justify-end">
                    <button 
                      onClick={handleNextQuestion}
                      disabled={answers[currentQuestionIndex] === undefined}
                      className="bg-[#003366] text-white px-8 py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#004080] transition-colors shadow-md"
                    >
                      {currentQuestionIndex === moduleData.questions.length - 1 ? 'Finalizar Quiz' : 'Próxima Pergunta'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar de Materiais, Descrição e Comentários */}
        <div className="w-full lg:w-96 bg-white dark:bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 shrink-0">
            <button
              onClick={() => setActiveTab('content')}
              className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 ${
                activeTab === 'content'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Conteúdo
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
                activeTab === 'comments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Comentários
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === 'content' ? (
              <div className="h-full overflow-y-auto">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-slate-900 dark:text-white font-bold mb-2">Sobre este módulo</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {moduleData.description || 'Nenhuma descrição fornecida para este módulo.'}
                  </p>
                </div>
                
                <div className="p-6">
                  <h3 className="text-slate-900 dark:text-white font-bold mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#003366]" /> Materiais Complementares
                  </h3>
                  
                  {moduleData.materials && moduleData.materials.length > 0 ? (
                    <div className="space-y-3">
                      {moduleData.materials.map((mat, idx) => (
                        <a 
                          key={idx} 
                          href={mat.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#003366] hover:shadow-sm transition-all text-sm text-slate-700 dark:text-slate-300 font-medium"
                        >
                          {mat.title}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">Nenhum material anexado.</p>
                  )}
                </div>
              </div>
            ) : (
              <ModuleComments moduleId={id!} />
            )}
          </div>
        </div>
      </div>

      {/* Trail Survey Modal */}
      {showSurvey && trailData && user && (
        <TrailSurvey 
          userId={user.uid}
          trailId={trailData.id!}
          trailTitle={trailData.title}
          onComplete={() => {
            setShowSurvey(false);
            awardTrailCompletionPoints();
          }}
        />
      )}
    </div>
  );
}
