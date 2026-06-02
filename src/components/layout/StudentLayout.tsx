import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useTranslation } from 'react-i18next';
import { formatDisplayName } from '../../lib/utils';
import { notificationService } from '../../services/notificationService';
import { gamificationService } from '../../services/gamificationService';
import { Notification } from '../../types';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'sonner';
import { 
  Globe, 
  LogOut, 
  Settings, 
  Bell, 
  Search, 
  ChevronDown, 
  BookOpen, 
  GraduationCap,
  Home,
  Layout,
  BookMarked,
  Menu,
  X,
  Clock,
  Check,
  Moon,
  Sun,
  Award,
  Lock,
  Trophy,
  Star,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function StudentLayout() {
  const { user, userProfile, roleName, logout, isAdminMode, toggleAdminMode } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { hasPermission, isManagementAdmin } = usePermissions();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'inicio' | 'playbook' | 'trainings' | 'myTrails' | 'myArea' | 'ranking'>('inicio');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLeader, setIsLeader] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  // Check if user is in the management team to show the switch
  const canSwitchMode = user?.email && [
    'cesar.bronzatto@xertica.com',
    'gustavo.paula@xertica.com',
    'kefreen.batista@xertica.com'
  ].includes(user.email);
  
  // Notifications State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

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
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    if (!user) return;
    const data = await notificationService.getNotifications(user.uid);
    setNotifications(data);
  };

  const handleMarkAsRead = async (id: string) => {
    await notificationService.markAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    await notificationService.markAllAsRead(user.uid);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // For now, just alert or navigate to a search results page
      // In a real app, we would have a dedicated search results page
      console.log('Searching for:', searchQuery);
    }
  };

  const toggleLanguage = () => {
    const currentLang = i18n.language.split('-')[0];
    const newLang = currentLang === 'pt' ? 'es' : 'pt';
    i18n.changeLanguage(newLang);
  };

  const simulateOverdue = async () => {
    if (!user || !userProfile) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      
      // 1. Simular estado de atraso no perfil
      await updateDoc(userRef, {
        hasOverdueTrails: true,
        overdueTrailsCount: (userProfile.overdueTrailsCount || 0) + 1
      });

      // 2. Penalizar Colaborador e Líder (Simulação)
      const penaltyAmount = 300;
      await gamificationService.removePoints(user.uid, penaltyAmount, 'Penalidade: Prazo de trilha expirado (Simulação)');
      
      if (userProfile.leaderEmail) {
        // Buscar o UID do líder pelo e-mail
        const leaderQuery = query(collection(db, 'users'), where('email', '==', userProfile.leaderEmail.toLowerCase()));
        const leaderSnap = await getDocs(leaderQuery);
        if (!leaderSnap.empty) {
          const leaderId = leaderSnap.docs[0].id;
          await gamificationService.removePoints(leaderId, penaltyAmount, `Penalidade: Prazo expirado pelo liderado (${userProfile.name})`);
        }
      }
      
      // Limpar flag de sessão para forçar o modal a aparecer no Dashboard
      sessionStorage.removeItem('overdue_modal_shown');
      
      // 3. Notificação visual imediata (Toast)
      toast.error(t('toasts.deadlineExpired'), {
        description: t('onboarding.errorExiting'), // Using a generic error message or similar
        duration: 5000
      });

      // 4. Criar notificação real no sistema para visualização no sino
      await notificationService.createNotification({
        userId: user.uid,
        title: `⚠️ ${t('toasts.deadlineExpired')} (Simulação)`,
        message: `Você perdeu o prazo da trilha "Trilha de Exemplo". Você perdeu ${penaltyAmount} pontos e seu líder foi notificado.`,
        type: 'general',
        link: '/'
      });

      // 5. Enviar e-mails reais de alerta (Simulação)
      if (userProfile.leaderEmail) {
        await notificationService.sendEmail(
          userProfile.leaderEmail,
          `⚠️ ALERTA: ${t('toasts.deadlineExpired')} - ${userProfile.name}`,
          `Olá,\n\nInformamos que o colaborador ${userProfile.name} (${userProfile.email}) possui trilhas com o prazo de conclusão expirado.\n\nPor favor, acompanhe a regularização desta pendência.`
        );
      }
      
      // 5. Simular a mensagem que o líder receberia no Toast
      setTimeout(() => {
        toast.info(t('toasts.leaderMessage'), {
          description: `E-mail enviado para ${userProfile.leaderEmail || 'lider@empresa.com'}: "${userProfile.name} perdeu o prazo da trilha..."`,
          duration: 8000
        });
      }, 2000);

      // Resetar flag do modal para que ele apareça no Dashboard
      sessionStorage.removeItem('overdue_modal_shown');
      
      // Atualizar lista de notificações local
      fetchNotifications();
      
      // Ir para o Dashboard para ver o banner e o modal
      if (location.pathname !== '/') navigate('/');
      
    } catch (error) {
      console.error("Erro ao simular atraso:", error);
      toast.error('Erro ao simular atraso');
    }
  };

  const clearSimulation = async () => {
    if (!user || !userProfile) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      
      await updateDoc(userRef, {
        hasOverdueTrails: false,
        overdueTrailsCount: 0
      });
      
      // Limpar flag de sessão para permitir nova exibição se simular novamente
      sessionStorage.removeItem('overdue_modal_shown');
      
      toast.success(t('recognition.simulationComplete'), {
        description: t('settings.success'),
        duration: 3000
      });

      if (location.pathname !== '/') navigate('/');
      
    } catch (error) {
      console.error("Erro ao limpar simulação:", error);
      toast.error('Erro ao limpar simulação');
    }
  };

  const canSeeAdmin = isManagementAdmin;

  return (
    <div className={`min-h-screen font-sans selection:bg-brand-50 selection:text-black flex transition-colors duration-300 ${theme === 'dark' ? 'dark bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Vertical (A Barra que o usuário pediu) */}
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} fixed inset-y-0 left-0 z-50 flex flex-col shadow-2xl transition-all duration-300 lg:translate-x-0 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } ${theme === 'dark' ? 'bg-slate-900 border-r border-slate-800' : 'bg-[#003366] text-white'}`}>
        {/* Logo Area */}
        <div className={`p-6 flex items-center border-b border-white/10 relative ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          <Link 
            to="/" 
            onClick={() => setActiveTab('inicio')}
            className={`transition-transform hover:scale-105 active:scale-95 ${isSidebarCollapsed ? 'w-10 overflow-hidden' : ''}`}
          >
            <img 
              src="https://i.imgur.com/pWF2PQU.png" 
              alt="Logo" 
              className={`${isSidebarCollapsed ? 'h-8 min-w-[40px]' : 'h-16'} w-auto object-contain drop-shadow-xl`} 
              referrerPolicy="no-referrer" 
              crossOrigin="anonymous"
            />
          </Link>
          
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden absolute top-4 right-4 text-white/50 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Collapse Toggle Button (Desktop) */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full items-center justify-center shadow-lg transition-all ${
              theme === 'dark' ? 'bg-slate-800 text-blue-400 border border-slate-700' : 'bg-white text-[#003366] border border-slate-200'
            } hover:scale-110 active:scale-95`}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          <div className="pb-4 mb-4 border-b border-white/10">
            <button 
              onClick={() => {
                setActiveTab('inicio');
                if (location.pathname !== '/') navigate('/');
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-all ${
                activeTab === 'inicio' && location.pathname === '/' 
                  ? 'bg-white text-[#003366] shadow-lg scale-[1.02]' 
                  : 'text-blue-100 hover:bg-white/5'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title={isSidebarCollapsed ? t('nav.home') : ''}
            >
              <Home className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>{t('nav.home')}</span>}
            </button>
            {userProfile?.onboardingJourney !== 'eir' && (
              <>
            <button 
              onClick={() => {
                setActiveTab('ranking');
                if (location.pathname !== '/ranking') navigate('/ranking');
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-all ${
                activeTab === 'ranking' && location.pathname === '/ranking'
                  ? 'bg-white text-[#003366] shadow-lg scale-[1.02]' 
                  : 'text-blue-100 hover:bg-white/5'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title={isSidebarCollapsed ? t('admin.ranking') : ''}
            >
              <Trophy className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>{t('admin.ranking')}</span>}
            </button>
            <button 
              onClick={() => {
                if (location.pathname !== '/recognition') navigate('/recognition');
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-all ${
                location.pathname === '/recognition'
                  ? 'bg-white text-[#003366] shadow-lg scale-[1.02]' 
                  : 'text-blue-100 hover:bg-white/5'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title={isSidebarCollapsed ? t('recognition.title') : ''}
            >
              <Star className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>{t('recognition.title')}</span>}
            </button>
            </>
            )}
          </div>

          {userProfile?.onboardingJourney !== 'eir' && (
          <div className="space-y-1">
            {!isSidebarCollapsed && <p className="px-4 text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-2">{t('nav.navigation')}</p>}
            <button 
              onClick={() => {
                setActiveTab('trainings');
                if (location.pathname !== '/') navigate('/');
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-all ${
                activeTab === 'trainings' && location.pathname === '/'
                  ? 'bg-white text-[#003366] shadow-lg scale-[1.02]' 
                  : 'text-blue-100 hover:bg-white/5'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title={isSidebarCollapsed ? t('nav.trainings') : ''}
            >
              <GraduationCap className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>{t('nav.trainings')}</span>}
            </button>
            <button 
              onClick={() => {
                setActiveTab('playbook');
                if (location.pathname !== '/') navigate('/');
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-all ${
                activeTab === 'playbook' && location.pathname === '/'
                  ? 'bg-white text-[#003366] shadow-lg scale-[1.02]' 
                  : 'text-blue-100 hover:bg-white/5'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title={isSidebarCollapsed ? t('nav.playbook') : ''}
            >
              <BookOpen className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>{t('nav.playbook')}</span>}
            </button>
          </div>
          )}

          <div className="pt-6 space-y-1 pb-12">
            {userProfile?.onboardingJourney !== 'eir' && (
              <>
            {!isSidebarCollapsed && <p className="px-4 text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-2">{t('nav.myAccount')}</p>}
            <button 
              onClick={() => {
                setActiveTab('myTrails');
                if (location.pathname !== '/') navigate('/');
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-all ${
                activeTab === 'myTrails' && location.pathname === '/'
                  ? 'bg-white text-[#003366] shadow-lg scale-[1.02]' 
                  : 'text-blue-100 hover:bg-white/5'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title={isSidebarCollapsed ? t('nav.myTrails') : ''}
            >
              <BookMarked className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>{t('nav.myTrails')}</span>}
            </button>
            <button 
              onClick={() => {
                setActiveTab('myArea');
                if (location.pathname !== '/') navigate('/');
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-all ${
                activeTab === 'myArea' && location.pathname === '/'
                  ? 'bg-white text-[#003366] shadow-lg scale-[1.02]' 
                  : 'text-blue-100 hover:bg-white/5'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title={isSidebarCollapsed ? t('nav.myArea') : ''}
            >
              <Layout className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>{t('nav.myArea')}</span>}
            </button>
            </>
            )}
            {(isLeader || isManagementAdmin) && (
              <Link 
                to="/team" 
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-all ${
                  location.pathname === '/team'
                    ? 'bg-white text-[#003366] shadow-lg scale-[1.02]' 
                    : 'text-blue-100 hover:bg-white/5'
                } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                title={isSidebarCollapsed ? t('nav.teamManagement') : ''}
              >
                <Award className="w-5 h-5 shrink-0" />
                {!isSidebarCollapsed && <span>{t('nav.teamManagement')}</span>}
              </Link>
            )}
            {canSeeAdmin && (
              <Link 
                to="/admin" 
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-bold text-blue-100 hover:bg-white/5 transition-all whitespace-nowrap ${isSidebarCollapsed ? 'justify-center' : ''}`}
                title={isSidebarCollapsed ? t('nav.admin') : ''}
              >
                <Settings className="w-5 h-5 shrink-0" />
                {!isSidebarCollapsed && <span>{t('nav.admin')}</span>}
              </Link>
            )}
          </div>
        </nav>

      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} flex flex-col min-h-screen transition-all duration-300 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
        {/* Top Navbar */}
        <header className={`sticky top-0 z-40 border-b h-16 sm:h-20 flex items-center px-4 sm:px-8 gap-4 sm:gap-8 justify-between backdrop-blur-md transition-colors duration-300 ${
          theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'
        }`}>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className={`lg:hidden p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className={`text-xl font-bold transition-colors ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
              {location.pathname === '/' ? (
                activeTab === 'inicio' ? t('nav.home') : 
                activeTab === 'trainings' ? t('nav.trainings') : 
                activeTab === 'playbook' ? t('nav.playbook') :
                activeTab === 'myTrails' ? t('nav.myTrails') :
                t('nav.myArea')
              ) : t('nav.trailDetails')}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-6 flex-1 justify-end md:justify-start">
            <form onSubmit={handleSearch} className="relative flex-1 max-w-[150px] sm:max-w-md md:max-w-lg lg:max-w-2xl group">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${theme === 'dark' ? 'text-slate-500 group-focus-within:text-blue-400' : 'text-slate-400 group-focus-within:text-[#003366]'}`} />
              <input 
                type="text" 
                placeholder="O que você quer aprender hoje?" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-10 pr-4 py-2 rounded-lg text-sm transition-all outline-none w-64 md:w-80 lg:w-[450px] ${
                  theme === 'dark' 
                    ? 'bg-slate-800 text-white placeholder-slate-500 border border-slate-700 focus:bg-slate-700 focus:border-blue-500/50' 
                    : 'bg-slate-100 text-slate-900 placeholder-slate-400 border border-transparent focus:bg-white focus:border-blue-300'
                }`}
              />
            </form>

            <button 
              onClick={toggleTheme}
              className={`p-2 rounded-full transition-all ${theme === 'dark' ? 'text-amber-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
              title={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <button onClick={toggleLanguage} className={`text-sm font-bold transition-colors flex items-center gap-1 ${theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-[#003366]'}`}>
              <Globe className="w-4 h-4" />
              {i18n.language.startsWith('pt') ? 'ES' : 'PT'}
            </button>

            {canSwitchMode && (
              <div className="flex items-center gap-2">
                {user?.email === 'cesar.bronzatto@xertica.com' && (
                  <button 
                    onClick={async () => {
                      if (!user) return;
                      await updateDoc(doc(db, 'users', user.uid), {
                        onboardingJourney: userProfile?.onboardingJourney === 'eir' ? 'standard' : 'eir'
                      });
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border outline-none ${
                      theme === 'dark' ? 'bg-slate-800 text-purple-400 border-purple-500/30 hover:bg-purple-500/10' : 'bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100'
                    }`}
                  >
                    <Star className="w-3 h-3" />
                    {userProfile?.onboardingJourney === 'eir' ? 'Sair Visão EIR' : 'Testar Visão EIR'}
                  </button>
                )}
                <button 
                  onClick={simulateOverdue}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                    theme === 'dark' ? 'bg-slate-800 text-amber-400 border-amber-500/30 hover:bg-amber-500/10' : 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100'
                  }`}
                  title={t('dashboard.debug.simulateOverdueTitle')}
                >
                  <Clock className="w-3 h-3" />
                  {t('dashboard.debug.simulateOverdue')}
                </button>
                {userProfile?.hasOverdueTrails && (
                  <button 
                    onClick={clearSimulation}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      theme === 'dark' ? 'bg-slate-800 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10' : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
                    }`}
                    title={t('dashboard.debug.clearSimulationTitle')}
                  >
                    <Check className="w-3 h-3" />
                    {t('dashboard.debug.clearSimulation')}
                  </button>
                )}
                <button 
                  onClick={toggleAdminMode}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                    isAdminMode 
                      ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20' 
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${isAdminMode ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
                  {isAdminMode ? t('nav.adminMode') : t('nav.leaderMode')}
                </button>
              </div>
            )}

            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`relative p-2 rounded-full transition-all ${
                  isNotifOpen 
                    ? (theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-blue-50 text-[#003366]') 
                    : (theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-[#003366] hover:bg-slate-100')
                }`}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown de Notificações */}
              {isNotifOpen && (
                <div className={`absolute right-0 mt-2 w-80 sm:w-96 rounded-xl shadow-2xl border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                    <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{t('nav.notifications')}</h3>
                    {unreadCount > 0 && (
                      <button 
                        onClick={handleMarkAllAsRead}
                        className="text-xs font-bold text-blue-500 hover:underline flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        {t('nav.markAllAsRead')}
                      </button>
                    )}
                  </div>

                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                          <Bell className={`w-6 h-6 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`} />
                        </div>
                        <p className="text-sm text-slate-500">{t('nav.noNotifications')}</p>
                      </div>
                    ) : (
                      <div className={`divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-50'}`}>
                        {notifications.map((n) => (
                          <div 
                            key={n.id} 
                            className={`p-4 transition-colors cursor-pointer relative group ${
                              !n.isRead 
                                ? (theme === 'dark' ? 'bg-blue-900/10' : 'bg-blue-50/30') 
                                : (theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-slate-50')
                            }`}
                            onClick={() => {
                              if (!n.isRead && n.id) handleMarkAsRead(n.id);
                              if (n.link) {
                                navigate(n.link);
                                setIsNotifOpen(false);
                              }
                            }}
                          >
                            {!n.isRead && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                            )}
                            <div className="flex gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                n.type === 'new_trail' ? 'bg-emerald-100 text-emerald-600' : 
                                n.type === 'new_module' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {n.type === 'new_trail' ? <GraduationCap className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold leading-tight mb-1 ${!n.isRead ? 'pr-4' : ''} ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                  {n.title}
                                </p>
                                <p className={`text-xs line-clamp-2 mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                  {n.message}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                                  <Clock className="w-3 h-3" />
                                  {new Date(n.createdAt).toLocaleDateString()} às {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {notifications.length > 0 && (
                    <div className="p-3 border-t border-slate-100 text-center bg-slate-50/50">
                      <button 
                        onClick={() => setIsNotifOpen(false)}
                        className="text-xs font-bold text-slate-500 hover:text-slate-700"
                      >
                        {t('common.close')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="relative" ref={userMenuRef}>
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={`flex items-center gap-3 pl-6 border-l transition-all hover:opacity-80 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}
              >
                <div className="text-right hidden sm:block">
                  <p className={`text-sm font-bold leading-none ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {formatDisplayName(userProfile?.name || user?.displayName || user?.email)}
                  </p>
                  <p className="text-[10px] font-medium text-slate-500 mt-1 uppercase tracking-wider flex items-center justify-end gap-1">
                    {userProfile?.jobTitle || (isManagementAdmin && isAdminMode ? t('nav.managementTeam') : (roleName || (isLeader ? t('nav.leader') : t('nav.collaborator'))))}
                    <ChevronDown className="w-3 h-3" />
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-lg overflow-hidden border transition-all ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-blue-100 border-blue-200'}`}>
                  {(userProfile?.photoURL || user?.photoURL) ? (
                    <img 
                      src={userProfile?.photoURL || user?.photoURL || ''} 
                      alt="Avatar" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || 'user'}&backgroundColor=1e3a8a`} alt="Avatar" />
                  )}
                </div>
              </button>

              {/* Dropdown de Usuário */}
              {isUserMenuOpen && (
                <div className={`absolute right-0 mt-2 w-56 rounded-xl shadow-2xl border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  <div className={`p-4 border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                    <p className={`text-sm font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {userProfile?.name || user?.displayName || user?.email}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{user?.email}</p>
                  </div>
                  
                  <div className="p-2 space-y-1">
                    <button 
                      onClick={() => {
                        navigate('/settings');
                        setIsUserMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                        theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Settings className="w-4 h-4" />
                      {t('nav.settings')}
                    </button>
                    <button 
                      onClick={logout}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold text-red-500 hover:bg-red-500/10 transition-colors mt-1"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('nav.logout')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
            <Outlet context={{ activeTab, setActiveTab, searchQuery, setSearchQuery }} />
          </div>
        </main>
      </div>
    </div>
  );
}
