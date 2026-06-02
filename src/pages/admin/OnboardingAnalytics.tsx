import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Users, CheckCircle, Clock, TrendingUp, Award, Download, Search, ChevronRight, MessageSquare, Star, Smile, Meh, Frown, Rocket, Mail, X, Send } from 'lucide-react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../../lib/firebase';
import { UserProfile, OnboardingFeedback } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { onboardingService } from '../../services/onboardingService';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function OnboardingAnalytics() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  
  const funnelChartRef = useRef<HTMLDivElement>(null);
  const bottlenecksChartRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [feedbacks, setFeedbacks] = useState<OnboardingFeedback[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState(auth.currentUser?.email || '');
  const [testName, setTestName] = useState('Novo Colaborador Teste');
  const [testJob, setTestJob] = useState('Desenvolvedor Full Stack');
  const [testArea, setTestArea] = useState('Tecnologia');
  const [sendingTest, setSendingTest] = useState(false);
  
  const [stats, setStats] = useState({
    avgTTO: 0,
    nps: 0,
    completionRate: 0,
    funnel: [] as any[],
    bottlenecks: [] as any[]
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      let usersSnap;
      try {
        usersSnap = await getDocs(collection(db, 'users'));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'users');
        return;
      }

      let feedbackSnap;
      try {
        feedbackSnap = await getDocs(query(collection(db, 'onboarding_feedback'), orderBy('createdAt', 'desc')));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'onboarding_feedback');
        return;
      }
      
      const usersData = usersSnap.docs.map(d => d.data() as UserProfile);
      const feedbacksData = feedbackSnap.docs.map(d => d.data() as OnboardingFeedback);

      setUsers(usersData);
      setFeedbacks(feedbacksData);

      // 1. Funnel
      const onboardingUsers = usersData.filter(u => u.onboardingActivatedAt);
      const total = onboardingUsers.length;
      const started = onboardingUsers.filter(u => Object.values(u.onboardingTasks || {}).some(v => v)).length;
      const halfway = onboardingUsers.filter(u => {
        const tasks = Object.values(u.onboardingTasks || {});
        return tasks.length > 0 && tasks.filter(v => v).length >= tasks.length / 2;
      }).length;
      const completed = onboardingUsers.filter(u => u.onboardingCompletedAt).length;

      const funnelData = [
        { name: 'Total', value: total },
        { name: 'Iniciaram', value: started },
        { name: '50% Concluído', value: halfway },
        { name: 'Finalizaram', value: completed }
      ];

      // 2. TTO (Time to Onboard)
      const completedUsers = onboardingUsers.filter(u => u.onboardingActivatedAt && u.onboardingCompletedAt);
      const totalTTO = completedUsers.reduce((acc, u) => acc + (u.onboardingCompletedAt! - u.onboardingActivatedAt!), 0);
      const avgTTO = completedUsers.length > 0 ? totalTTO / completedUsers.length / (1000 * 60 * 60 * 24) : 0;

      // 3. Bottlenecks
      const taskCounts: Record<string, number> = {};
      onboardingUsers.forEach(u => {
        if (u.onboardingTasks) {
          Object.entries(u.onboardingTasks).forEach(([task, done]) => {
            if (done) taskCounts[task] = (taskCounts[task] || 0) + 1;
          });
        }
      });
      const bottlenecks = Object.entries(taskCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.count - b.count);

      // 4. NPS
      const avgNPS = feedbacksData.length > 0 ? feedbacksData.reduce((acc, f) => acc + f.nps, 0) / feedbacksData.length : 0;

      setStats({
        avgTTO,
        nps: avgNPS,
        completionRate: total > 0 ? (completed / total) * 100 : 0,
        funnel: funnelData,
        bottlenecks
      });

    } catch (error) {
      console.error('Error fetching onboarding analytics:', error);
      toast.error('Erro ao carregar dados de onboarding.');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const rows = [
      ['Analytics de Onboarding - ' + new Date().toLocaleDateString()],
      [''],
      ['Métricas Gerais'],
      ['Métrica', 'Valor'],
      ['TTO Médio (Dias)', stats.avgTTO.toFixed(1)],
      ['NPS Onboarding', stats.nps.toFixed(1)],
      ['Taxa de Conclusão (%)', stats.completionRate.toFixed(1)],
      [''],
      ['Histórico de Colaboradores'],
      ['Nome', 'E-mail', 'Início', 'Conclusão', 'TTO (Dias)', 'NPS', 'Clareza', 'Sentimento', 'Melhoria'],
      ...users
        .filter(u => u.onboardingActivatedAt)
        .map(u => {
          const feedback = feedbacks.find(f => f.userId === u.uid);
          const tto = u.onboardingCompletedAt && u.onboardingActivatedAt 
            ? ((u.onboardingCompletedAt - u.onboardingActivatedAt) / (1000 * 60 * 60 * 24)).toFixed(1) 
            : '-';
          return [
            u.name,
            u.email,
            u.onboardingActivatedAt ? new Date(u.onboardingActivatedAt).toLocaleDateString() : '-',
            u.onboardingCompletedAt ? new Date(u.onboardingCompletedAt).toLocaleDateString() : '-',
            tto,
            feedback?.nps || '-',
            feedback?.clarity || '-',
            feedback?.sentiment || '-',
            feedback?.improvement || '-'
          ];
        })
    ];

    const csvContent = "data:text/csv;charset=utf-8," 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `onboarding_analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredUsers = users
    .filter(u => u.onboardingActivatedAt)
    .filter(u => 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => (b.onboardingActivatedAt || 0) - (a.onboardingActivatedAt || 0));

  const getSentimentIcon = (sentiment?: string) => {
    switch (sentiment) {
      case 'very_confident': return <Rocket className="w-4 h-4 text-emerald-500" />;
      case 'confident': return <Smile className="w-4 h-4 text-blue-500" />;
      case 'neutral': return <Meh className="w-4 h-4 text-amber-500" />;
      case 'confused': return <Frown className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const getSentimentLabel = (sentiment?: string) => {
    switch (sentiment) {
      case 'very_confident': return 'Muito Confiante';
      case 'confident': return 'Confiante';
      case 'neutral': return 'Neutro';
      case 'confused': return 'Confuso';
      default: return '-';
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail) {
      toast.error('Por favor, insira um e-mail para teste.');
      return;
    }

    setSendingTest(true);
    try {
      await onboardingService.testWelcomeEmail(testEmail, {
        name: testName,
        jobTitle: testJob
      }, testArea);
      toast.success('E-mail de teste enviado com sucesso!');
      setShowTestModal(false);
    } catch (error) {
      console.error('Error sending test email:', error);
      toast.error('Erro ao enviar e-mail de teste.');
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.onboardingAnalytics')}</h1>
          <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>{t('admin.onboardingAnalyticsSub')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowTestModal(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-bold border ${
              theme === 'dark'
                ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700'
                : 'bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100 shadow-sm'
            }`}
          >
            <Mail className="w-4 h-4" />
            Testar E-mail
          </button>
          <button 
            onClick={exportToCSV}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-bold border ${
              theme === 'dark'
                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <Download className="w-4 h-4" />
            {t('admin.exportData')}
          </button>
          <button 
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-bold"
          >
            <TrendingUp className="w-4 h-4" />
            {t('admin.refreshData')}
          </button>
        </div>
      </div>

      {/* Collaborator History */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.onboardingHistory')}</h3>
            <p className="text-sm text-slate-500">{t('admin.onboardingHistorySub')}</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('admin.searchCollaborator')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-10 pr-4 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all w-full sm:w-64 ${
                theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`text-xs font-black uppercase tracking-wider ${theme === 'dark' ? 'bg-slate-800/50 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">{t('admin.startDate')}</th>
                <th className="px-6 py-4">{t('admin.completionDate')}</th>
                <th className="px-6 py-4">{t('admin.tto')}</th>
                <th className="px-6 py-4">NPS</th>
                <th className="px-6 py-4">{t('admin.sentiment')}</th>
                <th className="px-6 py-4">{t('admin.feedback')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => {
                  const feedback = feedbacks.find(f => f.userId === u.uid);
                  const tto = u.onboardingCompletedAt && u.onboardingActivatedAt 
                    ? ((u.onboardingCompletedAt - u.onboardingActivatedAt) / (1000 * 60 * 60 * 24)).toFixed(1) 
                    : null;
                  
                  return (
                    <tr key={u.uid} className={`group transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{u.name}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {u.onboardingActivatedAt ? new Date(u.onboardingActivatedAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {u.onboardingCompletedAt ? (
                          <span className="text-emerald-600 font-bold">{new Date(u.onboardingCompletedAt).toLocaleDateString()}</span>
                        ) : (
                          <span className="text-amber-500 font-bold italic">Em andamento</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-500">
                        {tto ? `${tto} dias` : '-'}
                      </td>
                      <td className="px-6 py-4">
                        {feedback ? (
                          <div className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-black ${
                            feedback.nps >= 9 ? 'bg-emerald-100 text-emerald-700' :
                            feedback.nps >= 7 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {feedback.nps}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4">
                        {feedback ? (
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                            {getSentimentIcon(feedback.sentiment)}
                            {getSentimentLabel(feedback.sentiment)}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4">
                        {feedback?.improvement ? (
                          <div className="relative group/tooltip">
                            <MessageSquare className="w-4 h-4 text-blue-500 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10">
                              {feedback.improvement}
                            </div>
                          </div>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-sm">
                    Nenhum dado de onboarding encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* General Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`p-6 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.avgTTO')}</h3>
          </div>
          <p className="text-3xl font-black text-blue-600">{stats.avgTTO.toFixed(1)} <span className="text-sm font-bold text-slate-400 uppercase">{t('admin.days')}</span></p>
          <p className="text-xs text-slate-500 mt-2">Tempo médio para concluir o onboarding.</p>
        </div>

        <div className={`p-6 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              <Star className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.onboardingNPS')}</h3>
          </div>
          <p className="text-3xl font-black text-emerald-600">{stats.nps.toFixed(1)} <span className="text-sm font-bold text-slate-400 uppercase">/ 10</span></p>
          <p className="text-xs text-slate-500 mt-2">Média de satisfação dos novos colaboradores.</p>
        </div>

        <div className={`p-6 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.completionRate')}</h3>
          </div>
          <p className="text-3xl font-black text-purple-600">{stats.completionRate.toFixed(1)}%</p>
          <p className="text-xs text-slate-500 mt-2">Porcentagem de colaboradores que finalizaram.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Funnel Chart */}
        <div className={`p-6 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <h3 className={`text-lg font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.onboardingFunnel')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={stats.funnel}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={120} axisLine={false} tickLine={false} tick={{ fontWeight: 700, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff'
                  }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottlenecks Chart */}
        <div className={`p-6 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <h3 className={`text-lg font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.taskBottlenecks')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.bottlenecks}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff'
                  }}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Test Email Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Testar E-mail de Boas-vindas</h3>
                  <p className="text-xs text-slate-500">Envie um e-mail de teste para visualizar o layout.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowTestModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSendTestEmail} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1">Enviar para (E-mail)</label>
                <input
                  type="email"
                  required
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className={`w-full px-4 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1">Nome Simulado</label>
                  <input
                    type="text"
                    required
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    className={`w-full px-4 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1">Cargo Simulado</label>
                  <input
                    type="text"
                    required
                    value={testJob}
                    onChange={(e) => setTestJob(e.target.value)}
                    className={`w-full px-4 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1">Departamento Simulado</label>
                <input
                  type="text"
                  required
                  value={testArea}
                  onChange={(e) => setTestArea(e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
                    theme === 'dark'
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sendingTest}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-all text-sm font-bold flex items-center justify-center gap-2"
                >
                  {sendingTest ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Enviar Teste
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
