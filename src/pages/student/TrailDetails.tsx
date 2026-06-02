import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Trail, Module, UserProgress, TrailSurvey, UserProfile } from '../../types';
import { formatDisplayName } from '../../lib/utils';
import { notificationService } from '../../services/notificationService';
import { toast } from 'sonner';
import { ArrowLeft, PlayCircle, Lock, CheckCircle2, Award, Download, UserPlus, Star, Users, MessageSquare, BarChart3, X, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function TrailDetails() {
  const { id } = useParams<{ id: string }>();
  const { user, userProfile } = useAuth();
  const { theme } = useTheme();
  const { isManagementAdmin } = usePermissions();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const certificateRef = useRef<HTMLDivElement>(null);
  
  const [trail, setTrail] = useState<Trail | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [dynamicDeadline, setDynamicDeadline] = useState<string | null>(null);

  // Admin Survey States
  const [surveys, setSurveys] = useState<TrailSurvey[]>([]);
  const [surveyUserProfiles, setSurveyUserProfiles] = useState<Record<string, UserProfile>>({});
  const [showSurveyDetails, setShowSurveyDetails] = useState(false);
  const [loadingSurveys, setLoadingSurveys] = useState(false);

  const handleEnroll = async () => {
    if (!trail || !user) return;
    
    if (!modules.length) {
      toast.error('Esta trilha ainda não possui módulos disponíveis.');
      return;
    }

    setIsEnrolling(true);
    try {
      // 1. Notify leader
      if (userProfile?.leaderEmail) {
        await notificationService.notifyLeader(
          userProfile.name,
          userProfile.leaderEmail,
          `se inscreveu na trilha "${trail.title}"`
        );
      }

      // 2. Create initial progress for first module
      const firstModule = modules[0];
      const progressId = `${user.uid}_${firstModule.id}`;
      const newProgress: UserProgress = {
        id: progressId,
        userId: user.uid,
        areaId: userProfile?.areaId || null,
        trailId: trail.id!,
        moduleId: firstModule.id!,
        status: 'in_progress',
        videoPercentage: 0,
        timeSpentSeconds: 0,
        highestQuizScore: 0,
        quizAttempts: 0,
        pointsAwarded: {
          video: false,
          quiz: false
        },
        lastUpdatedAt: Date.now(),
        enrolledAt: Date.now()
      };
      await setDoc(doc(db, 'user_progress', progressId), newProgress);
      
      // Update dynamic deadline if it's a public or slow training
      if (trail.isPublic || trail.isSlowTraining) {
        const deadlineDate = new Date(newProgress.enrolledAt! + (90 * 24 * 60 * 60 * 1000));
        setDynamicDeadline(deadlineDate.toISOString().split('T')[0]);
      }

      // 3. Update local state
      setProgress([newProgress]);
      setIsEnrolled(true);
    } catch (error) {
      console.error("Erro ao se inscrever:", error);
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleDownloadCertificate = async () => {
    if (!trail || !user || !certificateRef.current) return;
    setIsGenerating(true);
    const toastId = toast.loading(t('certificate.generating'));
    
    try {
      // Ensure images are loaded
      const images = certificateRef.current.querySelectorAll('img');
      await Promise.all(Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }));

      // Small delay to ensure rendering is complete
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(certificateRef.current, {
        scale: 3, // Higher scale for better quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: true,
        windowWidth: 1123,
        windowHeight: 794
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${t('certificate.filename', { title: trail.title.replace(/\s+/g, '_') })}.pdf`);
      toast.success(t('certificate.success'), { id: toastId });
    } catch (error) {
      console.error('Erro ao gerar certificado:', error);
      toast.error(t('certificate.error'), { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (!id || !user || !userProfile) return;

    const fetchTrailData = async () => {
      try {
        // Fetch Trail
        const trailSnap = await getDoc(doc(db, 'trails', id));
        if (!trailSnap.exists()) {
          navigate('/');
          return;
        }
        const trailData = { id: trailSnap.id, ...trailSnap.data() } as Trail;

        // Fetch User Progress
        const qProgress = query(collection(db, 'user_progress'), where('userId', '==', user.uid), where('trailId', '==', id));
        const progressSnap = await getDocs(qProgress);
        const progressData = progressSnap.docs.map(d => d.data() as UserProgress);
        
        // 1. Check if user is already enrolled (has any progress in this trail)
        const isEnrolledCheck = progressData.length > 0;

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
            return pData.trailIds?.includes(id);
          });
        }

        // 3. Check Country Permission
        const isCountryMatch = !trailData.countryIds || trailData.countryIds.length === 0 || 
                              trailData.countryIds.includes(userProfile?.countryId || '') ||
                              trailData.countryIds.includes(userProfile?.country || '');
        
        // 4. Area check (overrides country)
        let isInUserArea = !trailData.areaIds || trailData.areaIds.length === 0 || 
                           trailData.areaIds.includes(userProfile?.areaId || '');
        
        if (!isInUserArea && userProfile?.areaId) {
          const areasSnap = await getDocs(collection(db, 'areas'));
          const userArea = areasSnap.docs.find(d => d.id === userProfile.areaId || d.data().name === userProfile.areaId);
          if (userArea) {
            const userAreaName = userArea.data().name;
            isInUserArea = trailData.areaIds?.some(aid => {
              const trailArea = areasSnap.docs.find(d => d.id === aid);
              return trailArea?.data().name === userAreaName;
            }) || false;
          }
        }

        // Access is allowed if:
        // 1. User is Management Admin
        // 2. Country matches
        // 3. User is already enrolled (has progress)
        // 4. Trail is in user's area
        // 5. Trail is in user's project
        // 6. Trail is Public
        const hasAccess = isManagementAdmin || isCountryMatch || isEnrolledCheck || isInUserArea || isMandatoryByProject || trailData.isPublic;

        if (!hasAccess) {
          console.warn("Sem permissão de acesso para trilha:", trailData.id, { 
            isCountryMatch, 
            isManagementAdmin, 
            isEnrolled: isEnrolledCheck, 
            isInUserArea,
            isMandatoryByProject,
            isPublic: trailData.isPublic
          });
          toast.error('Você não tem permissão para acessar esta trilha.');
          navigate('/dashboard');
          return;
        }

        setTrail(trailData);

        // Fetch Modules
        const qModules = query(collection(db, 'modules'), where('trailId', '==', id));
        const modulesSnap = await getDocs(qModules);
        const mods = modulesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Module).sort((a, b) => a.order - b.order);
        setModules(mods);

        // Update progress state
        setProgress(progressData);

        // Check enrollment
        const isPublic = trailData?.isPublic === true;
        const isMandatory = trailData?.isMandatory === true;
        const hasProgress = progressData.length > 0;
        
        // Se for pública, precisa de progresso para estar inscrito.
        // Se for obrigatória ou tiver progresso, já está inscrito.
        // Se não for pública e nem obrigatória, assumimos que o acesso é por atribuição (já inscrito).
        setIsEnrolled(hasProgress || isMandatory || !isPublic);

        // Calculate Dynamic Deadline
        if (trailData.isPublic || trailData.isSlowTraining) {
          // 90 days from enrollment
          const firstProgress = progressData.find(p => p.enrolledAt);
          if (firstProgress?.enrolledAt) {
            const deadlineDate = new Date(firstProgress.enrolledAt + (90 * 24 * 60 * 60 * 1000));
            setDynamicDeadline(deadlineDate.toISOString().split('T')[0]);
          }
        } else if (trailData.isOnboardingTrail && userProfile?.onboardingActivatedAt) {
          // 7 days from onboarding activation
          const deadlineDate = new Date(userProfile.onboardingActivatedAt + (7 * 24 * 60 * 60 * 1000));
          setDynamicDeadline(deadlineDate.toISOString().split('T')[0]);
        } else {
          setDynamicDeadline(null);
        }

      } catch (error) {
        console.error("Erro ao carregar trilha:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrailData();
  }, [id, user, navigate]);

  useEffect(() => {
    const fetchSurveys = async () => {
      if (!id || !isManagementAdmin) return;
      setLoadingSurveys(true);
      try {
        const q = query(collection(db, 'trail_surveys'), where('trailId', '==', id));
        const snap = await getDocs(q);
        const surveyData = snap.docs.map(d => ({ id: d.id, ...d.data() } as TrailSurvey));
        setSurveys(surveyData);

        // Fetch user profiles for these surveys
        const uids = [...new Set(surveyData.map(s => s.userId))];
        if (uids.length > 0) {
          const profiles: Record<string, UserProfile> = {};
          // Firestore 'in' query supports up to 10 elements, so we might need chunks if there are many
          // For simplicity in this context, we'll fetch them individually or in chunks of 10
          for (let i = 0; i < uids.length; i += 10) {
            const chunk = uids.slice(i, i + 10);
            const uQuery = query(collection(db, 'users'), where('uid', 'in', chunk));
            const uSnap = await getDocs(uQuery);
            uSnap.docs.forEach(d => {
              const p = d.data() as UserProfile;
              profiles[p.uid] = p;
            });
          }
          setSurveyUserProfiles(profiles);
        }
      } catch (error) {
        console.error("Error fetching surveys:", error);
      } finally {
        setLoadingSurveys(false);
      }
    };

    fetchSurveys();
  }, [id, isManagementAdmin]);

  const isModuleLocked = (index: number) => {
    if (index === 0) return false; // Primeiro módulo sempre liberado
    
    const previousModule = modules[index - 1];
    const previousProgress = progress.find(p => p.moduleId === previousModule.id);
    
    // Se o módulo anterior exige quiz, precisa estar completed
    if (previousModule.quizConfig.isRequired) {
      return previousProgress?.status !== 'completed';
    }
    
    // Se não exige quiz, basta ter iniciado ou assistido (aqui podemos definir a regra de negócio)
    // Vamos assumir que se não tem quiz, basta ter status completed (que seria setado ao terminar o vídeo)
    return previousProgress?.status !== 'completed';
  };

  if (loading) return <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>{t('common.loading')}</div>;
  if (!trail) return null;

  const completedCount = progress.filter(p => p.status === 'completed').length;
  const progressPercentage = modules.length > 0 ? Math.round((completedCount / modules.length) * 100) : 0;
  const isSurveyCompleted = userProfile?.completedSurveys?.includes(trail.id!);
  const isFullyCompleted = progressPercentage === 100 && isSurveyCompleted;

  const averageRating = surveys.length > 0 
    ? (surveys.reduce((acc, s) => acc + s.rating, 0) / surveys.length).toFixed(1)
    : '0.0';

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className={`border-b transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'} backdrop-blur-sm`}>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex justify-between items-start mb-6">
            <Link to="/" className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-blue-400' : 'text-slate-500 hover:text-[#003366]'}`}>
              <ArrowLeft className="w-4 h-4" /> {t('nav.home')}
            </Link>
          </div>
          <h1 className={`text-3xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{trail.title}</h1>
          
          {(dynamicDeadline || trail.deadline) && (
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold mb-4 ${
              theme === 'dark' ? 'bg-amber-900/30 text-amber-400 border border-amber-900/50' : 'bg-amber-50 text-amber-700 border border-amber-100'
            }`}>
              <Award className="w-4 h-4" />
              {t('admin.deadline')}: {new Date((dynamicDeadline || trail.deadline) + 'T12:00:00').toLocaleDateString(i18n.language === 'pt' ? 'pt-BR' : 'es-ES')}
            </div>
          )}

          <p className={`text-lg mb-8 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{trail.description}</p>
          
          {/* Admin Satisfaction View */}
          {isManagementAdmin && (
            <div className={`mb-8 p-6 rounded-2xl border transition-all ${
              theme === 'dark' ? 'bg-slate-900/50 border-blue-500/30' : 'bg-blue-50/50 border-blue-100'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Satisfação da Trilha</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center text-amber-500">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="ml-1 font-bold text-lg">{averageRating}</span>
                      </div>
                      <span className="text-slate-400 text-sm">•</span>
                      <div className="flex items-center gap-1 text-slate-500 text-sm">
                        <Users className="w-4 h-4" />
                        <span>{surveys.length} avaliações</span>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowSurveyDetails(true)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                    theme === 'dark' 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-[#003366] hover:bg-blue-900 text-white'
                  }`}
                >
                  Ver Detalhes
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          <div className={`rounded-full h-3 w-full overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <div 
              className="bg-blue-600 h-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <p className="text-sm font-medium text-slate-500 mt-2 text-right">
            {t('dashboard.completedPercent', { percent: progressPercentage })} ({completedCount} de {modules.length} {t('admin.modules').toLowerCase()})
          </p>
        </div>
      </div>

      {/* Modules List */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {!isEnrolled ? (
          <div className={`rounded-2xl border-2 p-12 text-center shadow-xl ${
            theme === 'dark' ? 'bg-slate-900 border-blue-500/30' : 'bg-white border-blue-100'
          }`}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
              <UserPlus className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className={`text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {t('learning.notEnrolled')}
            </h2>
            <p className={`text-lg mb-8 max-w-md mx-auto ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('learning.enrollToAccess')}
            </p>
            <button
              disabled={isEnrolling}
              onClick={handleEnroll}
              className="bg-green-600 hover:bg-green-700 !text-white !opacity-100 px-10 py-4 rounded-xl font-black transition-all shadow-xl hover:shadow-green-500/20 flex items-center gap-2 mx-auto disabled:opacity-50"
            >
              {isEnrolling ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <UserPlus className="w-5 h-5 !text-white" />
              )}
              {isEnrolling ? t('learning.enrolling') : t('learning.enrollInTrail')}
            </button>
          </div>
        ) : (
          <>
            {progressPercentage === 100 && !isSurveyCompleted && (
              <div className={`rounded-2xl border-2 p-8 mb-12 text-center shadow-xl ${
                theme === 'dark' ? 'bg-amber-900/20 border-amber-500/50' : 'bg-amber-50 border-amber-500'
              }`}>
                <h2 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-900'}`}>
                  Pesquisa de Satisfação Pendente
                </h2>
                <p className={`text-lg mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  Você concluiu todos os módulos! Agora, por favor, responda à pesquisa de satisfação para finalizar a trilha e ganhar seus pontos.
                </p>
                <button
                  onClick={() => navigate(`/module/${modules[modules.length - 1].id}`)}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg"
                >
                  Ir para a Pesquisa
                </button>
              </div>
            )}

            {isFullyCompleted && (
          <div className={`rounded-2xl border-2 p-8 mb-12 text-center shadow-xl animate-in fade-in zoom-in duration-700 ${
            theme === 'dark' ? 'bg-slate-900 border-emerald-500/50' : 'bg-white border-emerald-500'
          }`}>
            <div className="flex justify-center mb-8">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <img 
                  src="https://i.imgur.com/cDpIOoe.png" 
                  alt="Trilha Concluída" 
                  className="relative max-w-full h-auto rounded-xl shadow-2xl border border-white/20"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
              </div>
            </div>
            <h2 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('certificate.congratulations')}</h2>
            <p className={`text-lg mb-8 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('certificate.successMessage', { title: trail.title })}
            </p>
            <div className="flex justify-center gap-4">
              <button 
                disabled={isGenerating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-emerald-200 flex items-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleDownloadCertificate}
              >
                {isGenerating ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Award className="w-5 h-5" />
                )}
                {isGenerating ? t('certificate.generating') : t('certificate.download')}
              </button>
            </div>
          </div>
        )}

            <h3 className={`text-xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('trail.modules')}</h3>
            <div className="space-y-4">
              {modules.map((mod, index) => {
            const locked = isModuleLocked(index);
            const modProgress = progress.find(p => p.moduleId === mod.id);
            const isCompleted = modProgress?.status === 'completed';

            return (
              <div 
                key={mod.id} 
                className={`rounded-xl border p-6 flex items-center gap-6 transition-all ${
                  locked 
                    ? (theme === 'dark' ? 'border-slate-800 opacity-40 bg-slate-900/50' : 'border-slate-200 opacity-60 bg-slate-50') 
                    : (theme === 'dark' ? 'bg-slate-900 border-slate-800 hover:border-blue-500/50 hover:shadow-lg' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md') + ' cursor-pointer'
                }`}
                onClick={() => !locked && navigate(`/module/${mod.id}`)}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  isCompleted ? 'bg-emerald-100 text-emerald-600' : 
                  locked ? 'bg-slate-200 text-slate-400' : (theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-[#003366]')
                }`}>
                  {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : 
                   locked ? <Lock className="w-5 h-5" /> : <PlayCircle className="w-6 h-6" />}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('admin.modules').slice(0, -1)} {index + 1}</span>
                    {mod.quizConfig?.isRequired && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-800'}`}>
                        {t('trail.requiredQuiz')}
                      </span>
                    )}
                  </div>
                  <h3 className={`text-lg font-bold ${locked ? 'text-slate-500' : (theme === 'dark' ? 'text-white' : 'text-slate-900')}`}>{mod.title}</h3>
                  <p className={`text-sm mt-1 line-clamp-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{mod.description}</p>
                </div>

                {!locked && (
                  <div className="shrink-0">
                    <button className={`font-bold text-sm transition-colors ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-[#003366] hover:text-blue-800'}`}>
                      {isCompleted ? t('common.edit') : t('dashboard.start')}
                    </button>
                  </div>
                )}
              </div>
            );
              })}
            </div>
          </>
        )}
      </div>

      {/* Hidden Certificate Template for PDF Generation */}
      <div className="absolute opacity-0 pointer-events-none overflow-hidden" style={{ width: '1123px', height: '794px', top: '0', left: '0', zIndex: -100 }}>
        <div 
          ref={certificateRef}
          className="w-[1123px] h-[794px] bg-white p-12 flex flex-col items-center justify-between border-[20px] border-[#003366] relative font-sans"
          style={{ boxSizing: 'border-box' }}
        >
          {/* Inner Border */}
          <div className="absolute inset-4 border-2 border-[#003366]/20 pointer-events-none" />
          
          {/* Corner Ornaments */}
          <div className="absolute top-8 left-8 w-16 h-16 border-t-4 border-l-4 border-[#003366]" />
          <div className="absolute top-8 right-8 w-16 h-16 border-t-4 border-r-4 border-[#003366]" />
          <div className="absolute bottom-8 left-8 w-16 h-16 border-b-4 border-l-4 border-[#003366]" />
          <div className="absolute bottom-8 right-8 w-16 h-16 border-b-4 border-r-4 border-[#003366]" />

          {/* Content */}
          <div className="flex flex-col items-center text-center w-full">
            <img 
              src="https://i.imgur.com/pWF2PQU.png" 
              alt="Logo" 
              className="h-24 mb-8"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
            
            <h1 className="text-6xl font-black text-[#003366] mb-2 font-heading uppercase tracking-tight">
              {t('certificate.title')}
            </h1>
            <p className="text-2xl text-[#003366] font-medium mb-12 uppercase tracking-widest">
              {t('certificate.subtitle')}
            </p>

            <p className="text-xl text-slate-500 italic mb-4">
              {t('certificate.certifyThat')}
            </p>
            
            <h2 className="text-5xl font-bold text-slate-900 mb-6 font-heading">
              {formatDisplayName(userProfile?.name || user?.displayName || user?.email)}
            </h2>

            <p className="text-xl text-slate-500 italic mb-4">
              {t('certificate.completedSuccess')}
            </p>
            
            <h3 className="text-3xl font-bold text-[#003366] mb-12 font-heading">
              "{trail.title}"
            </h3>
          </div>

          <div className="w-full flex flex-col items-center">
            <p className="text-slate-400 mb-16">
              {t('certificate.issuedAt', { date: new Date().toLocaleDateString(i18n.language === 'pt' ? 'pt-BR' : 'es-ES') })}
            </p>

            <div className="w-full flex justify-center items-end px-20">
              {/* Seal */}
              <div className="w-32 h-32 bg-[#003366] rounded-full flex flex-col items-center justify-center text-white shadow-xl border-4 border-white/20">
                <span className="text-[10px] font-black tracking-tighter">XCELERATE</span>
                <div className="w-12 h-[1px] bg-white/30 my-1" />
                <span className="text-[8px] font-bold">QUALIDADE</span>
                <span className="text-[8px] font-bold">GARANTIDA</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Admin Survey Details Modal */}
      {showSurveyDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl ${
            theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'
          }`}>
            <div className={`p-6 border-b flex items-center justify-between ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
              <div>
                <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Detalhes de Satisfação</h2>
                <p className="text-sm text-slate-500">{trail.title}</p>
              </div>
              <button 
                onClick={() => setShowSurveyDetails(false)}
                className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {surveys.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">Nenhuma avaliação recebida ainda.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {surveys.sort((a, b) => b.createdAt - a.createdAt).map((survey) => {
                    const profile = surveyUserProfiles[survey.userId];
                    return (
                      <div 
                        key={survey.id} 
                        className={`p-4 rounded-xl border transition-all ${
                          theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                              theme === 'dark' ? 'bg-blue-600' : 'bg-[#003366]'
                            }`}>
                              {profile?.photoURL ? (
                                <img src={profile.photoURL} alt={profile.name} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                profile?.name?.charAt(0) || 'U'
                              )}
                            </div>
                            <div>
                              <h4 className={`font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                {profile?.name || 'Usuário'}
                              </h4>
                              <p className="text-[10px] text-slate-500">
                                {new Date(survey.createdAt).toLocaleDateString()} às {new Date(survey.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 text-amber-500">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                className={`w-3.5 h-3.5 ${i < survey.rating ? 'fill-current' : 'text-slate-300 dark:text-slate-600'}`} 
                              />
                            ))}
                          </div>
                        </div>
                        {survey.feedback && (
                          <div className={`p-3 rounded-lg text-sm italic ${
                            theme === 'dark' ? 'bg-slate-900/50 text-slate-300' : 'bg-white text-slate-600'
                          }`}>
                            "{survey.feedback}"
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={`p-6 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
              <button
                onClick={() => setShowSurveyDetails(false)}
                className="w-full py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
