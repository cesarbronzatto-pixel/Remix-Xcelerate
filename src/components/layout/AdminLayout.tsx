import React, { useState, useEffect, useRef } from 'react';
import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useTranslation } from 'react-i18next';
import { formatDisplayName } from '../../lib/utils';
import { notificationService } from '../../services/notificationService';
import { Notification } from '../../types';
import { Shield, Users, Layout, BookOpen, Video, ArrowLeft, Globe, Bell, ChevronDown, LogOut, Search, Clock, Check, GraduationCap, Moon, Sun, TrendingUp, Award, Briefcase, UploadCloud, ChevronLeft, ChevronRight } from 'lucide-react';

export default function AdminLayout() {
  const { user, userProfile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { hasPermission } = usePermissions();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Notifications State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Verifica se tem permissão básica para ver o painel admin
  if (!hasPermission('view_analytics') && !hasPermission('manage_users') && !hasPermission('manage_roles') && !hasPermission('manage_learning')) {
    return <Navigate to="/" replace />;
  }

  const navItems = [
    { path: '/admin', icon: TrendingUp, label: t('admin.analytics'), permission: 'view_analytics' },
    { path: '/admin/roles', icon: Shield, label: t('admin.roles'), permission: 'manage_roles' },
    { path: '/admin/users', icon: Users, label: t('admin.users'), permission: 'manage_users' },
    { path: '/admin/areas', icon: Layout, label: t('admin.areas'), permission: 'manage_learning' },
    { path: '/admin/countries', icon: Globe, label: t('recognition.allCountries'), permission: 'manage_learning' },
    { path: '/admin/trails', icon: BookOpen, label: t('admin.trails'), permission: 'manage_learning' },
    { path: '/admin/modules', icon: Video, label: t('admin.modules'), permission: 'manage_learning' },
    { path: '/admin/submissions', icon: UploadCloud, label: t('admin.submissions'), permission: 'manage_learning' },
    { path: '/admin/playbook', icon: BookOpen, label: t('nav.playbook'), permission: 'manage_learning' },
    { path: '/admin/projects', icon: Briefcase, label: t('admin.projects'), permission: 'manage_learning' },
    { path: '/admin/ranking', icon: GraduationCap, label: t('admin.ranking'), permission: 'view_analytics' },
    { path: '/admin/onboarding', icon: Award, label: t('onboarding.title'), permission: 'manage_learning' },
    { path: '/admin/onboarding-analytics', icon: TrendingUp, label: t('admin.onboardingAnalytics'), permission: 'view_analytics' },
  ];

  const toggleLanguage = () => {
    const currentLang = i18n.language.split('-')[0];
    const newLang = currentLang === 'pt' ? 'es' : 'pt';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className={`min-h-screen font-sans selection:bg-brand-50 selection:text-black flex flex-col transition-colors duration-300 ${theme === 'dark' ? 'dark bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Navbar (Mesma do Dashboard) */}
      <nav className={`sticky top-0 w-full z-50 shadow-lg transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-900 border-b border-slate-800' : 'bg-[#003366]'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16 sm:h-20">
          <div className="flex items-center">
            <div className="relative flex items-center h-full">
              {/* Logo Container: Centralizado entre o início e a palavra Início */}
              <div className="w-28 sm:w-36 flex items-center justify-center">
                <Link to="/" className="transition-transform hover:scale-105 active:scale-95">
                  <img 
                    src="https://i.imgur.com/pWF2PQU.png" 
                    alt="Logo" 
                    className="h-24 sm:h-28 object-contain drop-shadow-xl z-10" 
                    referrerPolicy="no-referrer" 
                    crossOrigin="anonymous"
                  />
                </Link>
              </div>
              <Link to="/" className="hover:text-white transition-colors relative z-20 text-blue-100">{t('nav.home')}</Link>
            </div>
            
            <div className="hidden md:flex items-center gap-5 ml-8 text-sm font-medium text-blue-100">
              <Link to="/" className="hover:text-white transition-colors">{t('nav.myTrails')}</Link>
              <Link to="/" className="hover:text-white transition-colors">{t('nav.myArea')}</Link>
              <span className="text-white font-bold flex items-center gap-1 border-b-2 border-brand-50 pb-1">
                {t('nav.admin')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <button className="text-white hover:text-blue-200 transition-colors hidden sm:block">
              <Search className="w-5 h-5" />
            </button>

            <button 
              onClick={toggleTheme}
              className={`p-2 rounded-full transition-all ${theme === 'dark' ? 'text-amber-400 hover:bg-slate-800' : 'text-blue-100 hover:bg-blue-900/50'}`}
              title={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <button onClick={toggleLanguage} className="text-sm font-medium text-blue-100 hover:text-white transition-colors flex items-center gap-1">
              <Globe className="w-4 h-4" />
              {i18n.language.startsWith('pt') ? 'ES' : 'PT'}
            </button>
            
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`relative p-1.5 rounded-full transition-all ${isNotifOpen ? 'bg-blue-900/50 text-white' : 'text-white hover:text-blue-200'}`}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-[#003366] flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown de Notificações */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="font-bold text-slate-800">{t('nav.notifications')}</h3>
                    {unreadCount > 0 && (
                      <button 
                        onClick={handleMarkAllAsRead}
                        className="text-xs font-bold text-[#003366] hover:underline flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        {t('nav.markAllAsRead')}
                      </button>
                    )}
                  </div>

                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Bell className="w-6 h-6 text-slate-300" />
                        </div>
                        <p className="text-sm text-slate-500">{t('nav.noNotifications')}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {notifications.map((n) => (
                          <div 
                            key={n.id} 
                            className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer relative group text-left ${!n.isRead ? 'bg-blue-50/30' : ''}`}
                            onClick={() => {
                              if (!n.isRead && n.id) handleMarkAsRead(n.id);
                              if (n.link) {
                                navigate(n.link);
                                setIsNotifOpen(false);
                              }
                            }}
                          >
                            {!n.isRead && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#003366]" />
                            )}
                            <div className="flex gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                n.type === 'new_trail' ? 'bg-emerald-100 text-emerald-600' : 
                                n.type === 'new_module' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {n.type === 'new_trail' ? <GraduationCap className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold text-slate-900 leading-tight mb-1 ${!n.isRead ? 'pr-4' : ''}`}>
                                  {n.title}
                                </p>
                                <p className="text-xs text-slate-600 line-clamp-2 mb-2">
                                  {n.message}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                                  <Clock className="w-3 h-3" />
                                  {new Date(n.createdAt).toLocaleDateString()} {t('common.at')} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="text-right hidden lg:block">
                <p className="text-xs font-bold text-white leading-none">
                  {formatDisplayName(userProfile?.name || user?.displayName || user?.email)}
                </p>
                <p className="text-[10px] text-blue-200 mt-1 uppercase tracking-wider">Admin</p>
              </div>
              <div className="w-8 h-8 rounded bg-blue-900/50 border border-blue-400/30 overflow-hidden">
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
              <ChevronDown className="w-4 h-4 text-white group-hover:rotate-180 transition-transform duration-300 hidden sm:block" />
            </div>
            <button onClick={logout} className="text-blue-200 hover:text-white transition-colors ml-2" title={t('nav.logout')}>
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} border-r flex flex-col transition-all duration-300 relative ${
          theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white/80 backdrop-blur-sm border-slate-200'
        }`}>
          <div className={`h-16 flex items-center px-6 border-b justify-between ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
            {!isSidebarCollapsed && <span className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{t('admin.title')}</span>}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
          </div>
          
          <div className="flex-1 py-4 flex flex-col gap-1 px-3 overflow-y-auto custom-scrollbar">
            {navItems.map((item) => {
              const isActive = item.path === '/admin' 
                ? location.pathname === '/admin' 
                : location.pathname.startsWith(item.path);
              const Icon = item.icon;
              
              if (item.permission && !hasPermission(item.permission)) return null;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive 
                      ? (theme === 'dark' ? 'bg-blue-900/30 text-blue-400 shadow-sm' : 'bg-blue-50 text-[#003366] shadow-sm') 
                      : (theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')
                  } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                  title={isSidebarCollapsed ? item.label : ''}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>

          <div className={`p-4 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
            <Link
              to="/"
              className={`flex items-center gap-2 text-sm font-medium transition-colors ${theme === 'dark' ? 'text-slate-500 hover:text-blue-400' : 'text-slate-500 hover:text-[#003366]'} ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title={isSidebarCollapsed ? t('nav.backToLms') : ''}
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span>{t('nav.backToLms')}</span>}
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 overflow-auto transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
          <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
