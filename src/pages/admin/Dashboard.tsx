import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Users, BookOpen, CheckCircle, Clock, TrendingUp, Award, Mail, Loader2, Download } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Trail, Module, UserProfile, UserProgress } from '../../types';
import { analyticsService } from '../../services/analyticsService';
import { notificationService } from '../../services/notificationService';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useTranslation } from 'react-i18next';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { userProfile } = useAuth();
  const { hasPermission } = usePermissions();
  
  const trailChartRef = useRef<HTMLDivElement>(null);
  const activityChartRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTrails: 0,
    totalModules: 0,
    completedModules: 0,
    activeUsers: 0
  });

  const [trailProgressData, setTrailProgressData] = useState<any[]>([]);
  const [userActivityData, setUserActivityData] = useState<any[]>([]);
  const [topPerformers, setTopPerformers] = useState<UserProfile[]>([]);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const isFullAdmin = hasPermission('manage_users');
      const areaId = !isFullAdmin ? userProfile?.areaId : undefined;

      let usersSnap;
      try {
        if (areaId) {
          usersSnap = await getDocs(query(collection(db, 'users'), where('areaId', '==', areaId)));
        } else {
          usersSnap = await getDocs(collection(db, 'users'));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'users');
        return;
      }

      let trailsSnap;
      try {
        trailsSnap = await getDocs(collection(db, 'trails'));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'trails');
        return;
      }

      let modulesSnap;
      try {
        modulesSnap = await getDocs(collection(db, 'modules'));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'modules');
        return;
      }
      
      let progressSnap;
      try {
        if (areaId) {
          progressSnap = await getDocs(query(collection(db, 'user_progress'), where('areaId', '==', areaId)));
        } else {
          progressSnap = await getDocs(collection(db, 'user_progress'));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'user_progress');
        return;
      }

      const users = usersSnap.docs.map(d => d.data() as UserProfile);
      const userIds = new Set(users.map(u => u.uid));
      
      const trails = trailsSnap.docs.map(d => d.data() as Trail);
      let progress = progressSnap.docs.map(d => d.data() as UserProgress);

      if (areaId) {
        progress = progress.filter(p => userIds.has(p.userId));
      }

      setStats({
        totalUsers: users.length,
        totalTrails: trails.length,
        totalModules: modulesSnap.size,
        completedModules: progress.filter(p => p.status === 'completed').length,
        activeUsers: users.filter(u => u.isActive).length
      });

      // Prepare Trail Progress Data
      const trailData = trails.map(trail => {
        const trailProgress = progress.filter(p => p.trailId === trail.id);
        const completed = trailProgress.filter(p => p.status === 'completed').length;
        return {
          name: trail.title.substring(0, 15) + '...',
          completions: completed,
          inProgress: trailProgress.length - completed
        };
      });
      setTrailProgressData(trailData);

      // Fetch Real User Activity Data
      const weeklyStats = await analyticsService.getWeeklyAccessStats(areaId);
      setUserActivityData(weeklyStats);

      // Fetch Top Performers
      const topUsers = users
        .sort((a, b) => (b.weeklyPoints || 0) - (a.weeklyPoints || 0))
        .slice(0, 3);
      setTopPerformers(topUsers);

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const handleTestEmail = async () => {
    if (!userProfile?.email) return;
    setIsTestingEmail(true);
    setTestEmailStatus('idle');
    try {
      await notificationService.sendEmail(
        userProfile.email,
        'Teste de Configuração de E-mail',
        'Olá! Este é um e-mail de teste da plataforma Xcelerate para confirmar que sua configuração SMTP está funcionando corretamente.'
      );
      setTestEmailStatus('success');
      setTimeout(() => setTestEmailStatus('idle'), 3000);
    } catch (error) {
      console.error('Error testing email:', error);
      setTestEmailStatus('error');
      setTimeout(() => setTestEmailStatus('idle'), 3000);
    } finally {
      setIsTestingEmail(false);
    }
  };

  const exportToCSV = () => {
    // Prepare data for export
    const rows = [
      ['Dashboard Analytics Export - ' + new Date().toLocaleDateString()],
      [''],
      ['Resumo Geral'],
      ['Métrica', 'Valor'],
      ['Total de Usuários', stats.totalUsers],
      ['Trilhas Ativas', stats.totalTrails],
      ['Módulos Concluídos', stats.completedModules],
      ['Usuários Ativos', stats.activeUsers],
      [''],
      ['Engajamento por Trilha'],
      ['Trilha', 'Conclusões', 'Em Andamento'],
      ...trailProgressData.map(d => [d.name, d.completions, d.inProgress]),
      [''],
      ['Acessos Diários (Última Semana)'],
      ['Dia', 'Usuários'],
      ...userActivityData.map(d => [d.name, d.users]),
      [''],
      ['Destaques da Semana'],
      ['Nome', 'Pontos'],
      ...topPerformers.map(u => [u.name, u.weeklyPoints || 0])
    ];

    const csvContent = "data:text/csv;charset=utf-8," 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `analytics_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportChartAsImage = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    const toastId = toast.loading('Gerando imagem...');
    try {
      const dataUrl = await toPng(ref.current, {
        backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
        pixelRatio: 2,
        quality: 1,
      });
      const link = document.createElement('a');
      link.download = `${filename}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Imagem exportada com sucesso!', { id: toastId });
    } catch (error) {
      console.error('Error exporting chart:', error);
      toast.error('Erro ao exportar imagem.', { id: toastId });
    }
  };

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className={`p-6 rounded-2xl shadow-sm border flex items-center gap-4 ${
      theme === 'dark' 
        ? 'bg-slate-900 border-slate-800' 
        : 'bg-white border-slate-100'
    }`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>{title}</p>
        <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.analyticsTitle')}</h1>
          <p className={theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}>{t('admin.analyticsSub')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToCSV}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-bold border ${
              theme === 'dark'
                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <Download className="w-4 h-4" />
            {t('admin.exportData') || 'Exportar Dados'}
          </button>

          <button 
            onClick={fetchStats}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-bold"
          >
            <TrendingUp className="w-4 h-4" />
            {t('admin.refreshData')}
          </button>
          
          <button 
            onClick={handleTestEmail}
            disabled={isTestingEmail}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-bold border ${
              testEmailStatus === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                : testEmailStatus === 'error'
                ? 'bg-red-50 border-red-200 text-red-600'
                : theme === 'dark'
                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'
            }`}
          >
            {isTestingEmail ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            {testEmailStatus === 'success' ? 'E-mail Enviado!' : testEmailStatus === 'error' ? 'Erro no Envio' : 'Testar E-mail'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title={t('admin.totalUsers')} value={stats.totalUsers} icon={Users} color="bg-blue-500" />
        <StatCard title={t('admin.activeTrails')} value={stats.totalTrails} icon={BookOpen} color="bg-emerald-500" />
        <StatCard title={t('admin.completedModules')} value={stats.completedModules} icon={CheckCircle} color="bg-purple-500" />
        <StatCard title={t('admin.activeUsers')} value={stats.activeUsers} icon={Clock} color="bg-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Trail Progress Chart */}
        <div className={`p-6 rounded-2xl shadow-sm border ${
          theme === 'dark' 
            ? 'bg-slate-900 border-slate-800' 
            : 'bg-white border-slate-100'
        }`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.engagementByTrail')}</h3>
            <button 
              onClick={() => exportChartAsImage(trailChartRef, 'engajamento_trilhas')}
              className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
              title="Exportar como Imagem"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <div className="h-80" ref={trailChartRef} style={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', padding: '10px', borderRadius: '12px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trailProgressData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 13, fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontWeight: 700 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 13, fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontWeight: 700 }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)',
                    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                    color: theme === 'dark' ? '#ffffff' : '#000000'
                  }}
                  itemStyle={{ color: theme === 'dark' ? '#ffffff' : '#000000', fontWeight: 600 }}
                  labelStyle={{ color: theme === 'dark' ? '#ffffff' : '#000000', fontWeight: 700 }}
                />
                <Legend 
                  wrapperStyle={{ 
                    paddingTop: '20px'
                  }}
                  formatter={(value) => <span style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', fontWeight: 700 }}>{value}</span>}
                />
                <Bar dataKey="completions" name={t('admin.completions')} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="inProgress" name={t('admin.inProgress')} fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User Activity Chart */}
        <div className={`p-6 rounded-2xl shadow-sm border ${
          theme === 'dark' 
            ? 'bg-slate-900 border-slate-800' 
            : 'bg-white border-slate-100'
        }`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.dailyAccess')}</h3>
            <button 
              onClick={() => exportChartAsImage(activityChartRef, 'acessos_diarios')}
              className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
              title="Exportar como Imagem"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <div className="h-80" ref={activityChartRef} style={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', padding: '10px', borderRadius: '12px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={userActivityData}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 13, fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontWeight: 700 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 13, fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontWeight: 700 }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)',
                    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                    color: theme === 'dark' ? '#ffffff' : '#000000'
                  }}
                  itemStyle={{ color: theme === 'dark' ? '#ffffff' : '#000000', fontWeight: 600 }}
                  labelStyle={{ color: theme === 'dark' ? '#ffffff' : '#000000', fontWeight: 700 }}
                />
                <Area type="monotone" dataKey="users" name={t('admin.users')} stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Performers / Recent Achievements */}
      <div className={`p-6 rounded-2xl shadow-sm border ${
        theme === 'dark' 
          ? 'bg-slate-900 border-slate-800' 
          : 'bg-white border-slate-100'
      }`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.weeklyHighlights')}</h3>
          <Award className="w-5 h-5 text-amber-500" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {topPerformers.length > 0 ? (
            topPerformers.map((user, i) => (
              <div key={user.uid} className={`flex items-center gap-4 p-4 rounded-xl border ${
                theme === 'dark' 
                  ? 'bg-slate-800 border-slate-700' 
                  : 'bg-slate-50 border-slate-100'
              }`}>
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                  #{i + 1}
                </div>
                <div>
                  <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{user.name}</p>
                  <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{user.weeklyPoints || 0} {t('admin.pointsThisWeek')}</p>
                </div>
              </div>
            ))
          ) : (
            <p className={`text-sm col-span-3 text-center py-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t('admin.noPerformanceData')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
