import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { UserProfile, UserProgress, Trail, Module } from '../../types';
import { Users, BookOpen, CheckCircle, Search, ChevronRight, Clock, ChevronDown, Award, Unlock, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../contexts/ThemeContext';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BadgeDisplay } from '../../components/gamification/BadgeDisplay';
import { MiniBadge } from '../../components/gamification/MiniBadge';
import { gamificationService } from '../../services/gamificationService';
import { usePermissions } from '../../hooks/usePermissions';
import { leaderActionService } from '../../services/leaderActionService';
import { LeaderAction, PointHistory, Area } from '../../types';
import { useTranslation } from 'react-i18next';
import { MessageSquarePlus, History, ThumbsUp, Hourglass, AlertCircle, MoreHorizontal, X, TrendingUp, TrendingDown, FileDown, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function LeaderDashboard() {
  const { t } = useTranslation();
  const { user, userProfile } = useAuth();
  const { theme } = useTheme();
  const { hasPermission } = usePermissions();
  const [team, setTeam] = useState<UserProfile[]>([]);
  const [teamProgress, setTeamProgress] = useState<UserProgress[]>([]);
  const [trails, setTrails] = useState<Trail[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionMessage, setCorrectionMessage] = useState<string | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [leaderActions, setLeaderActions] = useState<Record<string, LeaderAction[]>>({});
  const [pointHistory, setPointHistory] = useState<Record<string, PointHistory[]>>({});
  const [leaderPointHistory, setLeaderPointHistory] = useState<PointHistory[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [showActionModal, setShowActionModal] = useState<{ userId: string; userName: string } | null>(null);
  const [newAction, setNewAction] = useState<{ type: LeaderAction['type']; note: string }>({ type: 'congratulate', note: '' });
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);

  useEffect(() => {
    if (!userProfile?.email) return;
    fetchTeamData();
  }, [userProfile]);

  const fetchTeamData = async () => {
    try {
      let teamData: UserProfile[] = [];
      
      if (hasPermission('view_admin')) {
        // Fetch all users for admin
        const usersSnap = await getDocs(collection(db, 'users'));
        teamData = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
        
        // Fetch all areas for filter
        const areasSnap = await getDocs(collection(db, 'areas'));
        setAreas(areasSnap.docs.map(d => ({ id: d.id, ...d.data() } as Area)));
      } else {
        // Fetch users where current user is the leader
        const teamQuery = query(
          collection(db, 'users'),
          where('leaderEmail', '==', userProfile!.email.toLowerCase())
        );
        const teamSnap = await getDocs(teamQuery);
        teamData = teamSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      }
      
      setTeam(teamData);

      if (teamData.length > 0) {
        const userIds = teamData.map(u => u.uid);
        // Fetch progress for all team members
        const progressSnap = await getDocs(collection(db, 'user_progress'));
        const allProgress = progressSnap.docs.map(d => d.data() as UserProgress);
        const filteredProgress = allProgress.filter(p => userIds.includes(p.userId));
        setTeamProgress(filteredProgress);
      }

      const trailsSnap = await getDocs(collection(db, 'trails'));
      setTrails(trailsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Trail)));

      const modulesSnap = await getDocs(collection(db, 'modules'));
      setModules(modulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Module)));

      // Fetch leader's own point history
      if (userProfile) {
        const history = await gamificationService.getPointHistory(userProfile.uid, userProfile.areaId);
        setLeaderPointHistory(history);
      }

      // Fetch actions for all team members
      if (teamData.length > 0) {
        const allActions: Record<string, LeaderAction[]> = {};
        const allPointHistory: Record<string, PointHistory[]> = {};
        for (const member of teamData) {
          const actions = await leaderActionService.getActionsByUser(member.uid);
          allActions[member.uid] = actions;
          
          const history = await gamificationService.getPointHistory(member.uid, member.areaId);
          allPointHistory[member.uid] = history;
        }
        setLeaderActions(allActions);
        setPointHistory(allPointHistory);
      }

    } catch (error) {
      console.error("Error fetching team data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getMemberProgress = (userId: string) => {
    const memberProgress = teamProgress.filter(p => p.userId === userId);
    const completed = memberProgress.filter(p => p.status === 'completed').length;
    const timeSpent = memberProgress.reduce((acc, p) => acc + (p.timeSpentSeconds || 0), 0);
    const quizScores = memberProgress.filter(p => p.highestQuizScore > 0).map(p => p.highestQuizScore);
    const avgQuizScore = quizScores.length > 0 
      ? Math.round(quizScores.reduce((acc, s) => acc + s, 0) / quizScores.length)
      : 0;

    return {
      total: memberProgress.length,
      completed,
      timeSpent,
      avgQuizScore
    };
  };

  const formatTime = (seconds: number) => {
    if (!seconds) return '0m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const filteredTeam = team.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArea = selectedArea === 'all' || member.areaId === selectedArea;
    return matchesSearch && matchesArea;
  });

  const quizProgress = teamProgress.filter(p => p.highestQuizScore > 0);
  const teamAvgQuizScore = quizProgress.length > 0
    ? Math.round(quizProgress.reduce((acc, p) => acc + p.highestQuizScore, 0) / quizProgress.length)
    : 0;

  const overdueCount = team.filter(u => u.hasOverdueTrails).length;

  const handleCorrectPoints = async () => {
    if (!user) return;
    setIsCorrecting(true);
    try {
      // Remove 300 points (100 video + 200 quiz)
      await gamificationService.removePoints(user.uid, 300);
      toast.info(t('leader.pointsCorrected'), {
        description: t('leader.pointsRemovedDescription', { count: 300 })
      });
      setCorrectionMessage(t('leader.pointsRemovedDescription', { count: 300 }));
      // Refresh page after a delay
      setTimeout(() => window.location.reload(), 3000);
    } catch (error) {
      console.error("Error correcting points:", error);
      setCorrectionMessage(t('leader.correctPointsError'));
    } finally {
      setIsCorrecting(false);
    }
  };

  const handleUnblockUser = async (userId: string) => {
    // Note: We are keeping window.confirm for now as it's a simple way to get user confirmation, 
    // but we'll localize the message.
    if (!window.confirm(t('leader.unblockConfirm'))) return;
    
    setUnblockingId(userId);
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isBlocked: false,
        blockReason: null
      });
      
      // Update local state
      setTeam(prev => prev.map(u => u.uid === userId ? { ...u, isBlocked: false, blockReason: undefined } : u));
      toast.success(t('leader.unblockSuccess'));
    } catch (error) {
      console.error("Error unblocking user:", error);
      toast.error(t('leader.unblockError'));
    } finally {
      setUnblockingId(null);
    }
  };

  const handleExportReport = async () => {
    try {
      // General Summary Sheet
      const summaryData = filteredTeam.map(member => {
        const areaName = areas.find(a => a.id === member.areaId)?.name || member.areaId || 'N/A';
        return {
          [t('leader.report.name')]: member.name,
          [t('leader.report.email')]: member.email,
          [t('leader.report.jobTitle')]: member.jobTitle || 'N/A',
          [t('leader.report.area')]: areaName,
          [t('leader.report.points')]: member.points || 0,
          [t('leader.report.level')]: member.level || 1,
          [t('leader.report.id')]: member.uid
        };
      });

      // Leader Actions (Mural) Sheet
      const actionsData: any[] = [];
      filteredTeam.forEach(member => {
        const actions = leaderActions[member.uid] || [];
        actions.forEach(action => {
          actionsData.push({
            [t('leader.report.collaborator')]: member.name,
            [t('leader.report.email')]: member.email,
            [t('leader.report.date')]: new Date(action.createdAt).toLocaleDateString(),
            [t('leader.report.type')]: getActionLabel(action.type),
            [t('leader.report.observation')]: action.note || ''
          });
        });
      });

      // Point History Sheet
      const historyData: any[] = [];
      filteredTeam.forEach(member => {
        const history = pointHistory[member.uid] || [];
        history.forEach(h => {
          historyData.push({
            [t('leader.report.collaborator')]: member.name,
            [t('leader.report.email')]: member.email,
            [t('leader.report.date')]: new Date(h.createdAt).toLocaleDateString(),
            [t('leader.report.change')]: `${h.change > 0 ? '+' : ''}${h.change}`,
            [t('leader.report.reason')]: h.reason,
            [t('leader.report.totalPoints')]: h.points
          });
        });
      });

      // Progress Details Sheet
      const progressData: any[] = [];
      filteredTeam.forEach(member => {
        const progress = teamProgress.filter(p => p.userId === member.uid);
        progress.forEach(p => {
          const module = modules.find(m => m.id === p.moduleId);
          const trail = trails.find(t => t.id === p.trailId);
          progressData.push({
            [t('leader.report.collaborator')]: member.name,
            [t('leader.report.email')]: member.email,
            [t('leader.report.trail')]: trail?.title || 'N/A',
            [t('leader.report.module')]: module?.title || p.moduleId,
            [t('leader.report.status')]: p.status === 'completed' ? t('common.completed') : t('common.inProgress'),
            [t('leader.report.quizScore')]: p.highestQuizScore || 0,
            [t('leader.report.timeSeconds')]: p.timeSpentSeconds || 0
          });
        });
      });

      const workbook = XLSX.utils.book_new();
      
      // Add sheets
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, t('leader.report.summary'));

      if (actionsData.length > 0) {
        const actionsSheet = XLSX.utils.json_to_sheet(actionsData);
        XLSX.utils.book_append_sheet(workbook, actionsSheet, t('leader.report.actionsWall'));
      }

      if (historyData.length > 0) {
        const historySheet = XLSX.utils.json_to_sheet(historyData);
        XLSX.utils.book_append_sheet(workbook, historySheet, t('leader.report.pointHistory'));
      }

      if (progressData.length > 0) {
        const progressSheet = XLSX.utils.json_to_sheet(progressData);
        XLSX.utils.book_append_sheet(workbook, progressSheet, t('leader.report.progressDetails'));
      }
      
      // Auto-size columns for all sheets
      const sheets = [
        { sheet: summarySheet, data: summaryData },
        { sheet: workbook.Sheets[t('leader.report.actionsWall')], data: actionsData },
        { sheet: workbook.Sheets[t('leader.report.pointHistory')], data: historyData },
        { sheet: workbook.Sheets[t('leader.report.progressDetails')], data: progressData }
      ];

      sheets.forEach(({ sheet, data }) => {
        if (!sheet || !data || data.length === 0) return;
        const maxWidths = data.reduce((acc: any, row: any) => {
          Object.keys(row).forEach((key, i) => {
            const value = String(row[key]);
            acc[i] = Math.max(acc[i] || 0, value.length, key.length);
          });
          return acc;
        }, []);
        sheet['!cols'] = maxWidths.map((w: number) => ({ w: Math.min(w, 50) }));
      });
      
      XLSX.writeFile(workbook, `${t('leader.report.filename')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error("Error exporting report:", error);
      toast.error(t('leader.exportError'));
    }
  };

  const handleCreateAction = async () => {
    if (!showActionModal || !user) return;
    
    setIsSubmittingAction(true);
    try {
      const actionData: Omit<LeaderAction, 'id'> = {
        leaderId: user.uid,
        userId: showActionModal.userId,
        type: newAction.type,
        note: newAction.note,
        createdAt: Date.now()
      };
      
      const actionId = await leaderActionService.createAction(actionData);
      
      // Update local state
      const newActionWithId: LeaderAction = { id: actionId, ...actionData };
      setLeaderActions(prev => ({
        ...prev,
        [showActionModal.userId]: [newActionWithId, ...(prev[showActionModal.userId] || [])]
      }));
      
      setShowActionModal(null);
      setNewAction({ type: 'congratulate', note: '' });
    } catch (error) {
      console.error("Error creating action:", error);
      alert('Erro ao registrar ação.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const getActionIcon = (type: LeaderAction['type']) => {
    switch (type) {
      case 'congratulate': return <ThumbsUp className="w-4 h-4 text-emerald-500" />;
      case 'wait': return <Hourglass className="w-4 h-4 text-blue-500" />;
      case 'attention': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default: return <MoreHorizontal className="w-4 h-4 text-slate-500" />;
    }
  };

  const getActionLabel = (type: LeaderAction['type']) => {
    switch (type) {
      case 'congratulate': return t('leader.congratulated');
      case 'wait': return t('leader.wait');
      case 'attention': return t('leader.attention');
      default: return t('leader.other');
    }
  };

  if (loading) return <div className="p-8 text-center">{t('leader.loading')}</div>;

  if (team.length === 0) {
    return (
      <div className={`p-8 text-center rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <Users className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`} />
        <h2 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('leader.noTeam')}</h2>
        <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
          {t('leader.noTeamSub', { email: userProfile?.email })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('leader.dashboardTitle')}</h1>
          <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>{t('leader.dashboardSub')}</p>
        </div>
        
        {hasPermission('view_admin') && (
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={handleCorrectPoints}
              disabled={isCorrecting}
              className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              {isCorrecting ? t('leader.correcting') : t('leader.correctPoints')}
            </button>
            {correctionMessage && (
              <span className="text-xs font-medium text-amber-600">{correctionMessage}</span>
            )}
          </div>
        )}

        {leaderPointHistory.filter(h => h.change < 0).length > 0 && (
          <button
            onClick={() => setShowPenaltyModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-sm font-bold hover:bg-rose-100 transition-all shadow-sm"
          >
            <AlertCircle className="w-4 h-4" />
            {t('leader.penaltyHistory')}
          </button>
        )}

        <div className="relative w-full md:w-64">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
          <input 
            type="text"
            placeholder={t('leader.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/20 text-sm ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
                : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>

        {hasPermission('view_admin') && (
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-48">
              <Filter className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/20 text-sm appearance-none ${
                  theme === 'dark' 
                    ? 'bg-slate-800 border-slate-700 text-white' 
                    : 'bg-white border-slate-200 text-slate-900'
                }`}
              >
                <option value="all">{t('leader.allAreas')}</option>
                {areas.map(area => (
                  <option key={area.id} value={area.id}>{area.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleExportReport}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 whitespace-nowrap"
            >
              <FileDown className="w-4 h-4" />
              {t('leader.exportReport')}
            </button>
          </div>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className={`p-4 rounded-2xl border shadow-sm flex items-center gap-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>{t('leader.stats.team')}</p>
            <p className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{team.length}</p>
          </div>
        </div>
        
        <div className={`p-4 rounded-2xl border shadow-sm flex items-center gap-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>{t('leader.stats.completed')}</p>
            <p className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {teamProgress.filter(p => p.status === 'completed').length}
            </p>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border shadow-sm flex items-center gap-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-rose-900/30 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>{t('leader.stats.overdue')}</p>
            <p className={`text-lg font-bold ${overdueCount > 0 ? 'text-rose-500' : (theme === 'dark' ? 'text-white' : 'text-slate-900')}`}>
              {overdueCount}
            </p>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border shadow-sm flex items-center gap-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>{t('leader.stats.avgPoints')}</p>
            <p className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {team.length > 0 ? Math.round(team.reduce((acc, u) => acc + (u.points || 0), 0) / team.length) : 0}
            </p>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border shadow-sm flex items-center gap-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-rose-900/30 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>{t('leader.stats.avgQuiz')}</p>
            <p className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{teamAvgQuizScore}%</p>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border shadow-sm flex items-center gap-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>{t('leader.stats.totalTime')}</p>
            <p className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {formatTime(teamProgress.reduce((acc, p) => acc + (p.timeSpentSeconds || 0), 0))}
            </p>
          </div>
        </div>
      </div>

      {/* Team List */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-6 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
          <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('leader.teamMembers')}</h3>
        </div>
        <div className={`divide-y ${theme === 'dark' ? 'divide-slate-700' : 'divide-slate-100'}`}>
          {filteredTeam.map(member => {
            const progress = getMemberProgress(member.uid);
            const isExpanded = expandedUser === member.uid;
            const memberProgress = teamProgress.filter(p => p.userId === member.uid);

            return (
              <div key={member.uid} className="flex flex-col">
                <div 
                  className={`p-4 transition-colors flex items-center justify-between cursor-pointer ${
                    isExpanded 
                      ? (theme === 'dark' ? 'bg-slate-700/50' : 'bg-slate-50') 
                      : (theme === 'dark' ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50')
                  }`}
                  onClick={() => setExpandedUser(isExpanded ? null : member.uid)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{member.name}</h4>
                        <MiniBadge badges={member.badges || []} level={member.level} showLevel />
                        {member.isBlocked && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black uppercase">
                            <ShieldAlert className="w-3 h-3" />
                            {t('leader.blocked')}
                          </span>
                        )}
                        {member.hasOverdueTrails && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black uppercase">
                            <Clock className="w-3 h-3" />
                            {t('leader.overdueTrail')}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{member.jobTitle || t('nav.collaborator')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {member.isBlocked && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnblockUser(member.uid);
                        }}
                        disabled={unblockingId === member.uid}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        {unblockingId === member.uid ? t('leader.unblocking') : t('leader.unblock')}
                      </button>
                    )}
                    
                    <div className={`hidden md:flex flex-col items-end gap-1 px-8 border-r ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
                      <div className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>{t('leader.progress')}</div>
                      <div className="flex items-center gap-2">
                        <div className={`w-32 h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-100'}`}>
                          <div 
                            className="h-full bg-blue-600 transition-all" 
                            style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>{progress.completed} {t('common.completed').toLowerCase()}</span>
                      </div>
                    </div>

                    <div className={`hidden md:flex flex-col items-end gap-1 px-8 border-r ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
                      <div className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>{t('leader.studyTime')}</div>
                      <div className={`flex items-center gap-2 font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                        <Clock className="w-3 h-3" />
                        {formatTime(progress.timeSpent)}
                      </div>
                    </div>

                    <div className={`hidden md:flex flex-col items-end gap-1 px-8 border-r ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
                      <div className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>{t('leader.avgQuiz')}</div>
                      <div className={`flex items-center gap-2 font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                        <Award className="w-3 h-3 text-rose-500" />
                        {progress.avgQuizScore}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{member.points || 0} {t('leader.points')}</p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t('leader.level')} {member.level || 1}</p>
                    </div>
                    <div className={`p-2 rounded-lg transition-all ${isExpanded ? 'rotate-180 text-blue-600' : (theme === 'dark' ? 'text-slate-500' : 'text-slate-400')}`}>
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Detalhes por Módulo */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className={`overflow-hidden border-t ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50/50 border-slate-100'}`}
                    >
                      <div className="p-6 space-y-8">
                        {/* Badges Section */}
                        {member.badges && member.badges.length > 0 && (
                          <div className="mb-8">
                            <BadgeDisplay badges={member.badges} title={t('leader.achievementsTitle')} />
                          </div>
                        )}

                        {/* Mural de Ações */}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <History className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                              <h5 className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{t('leader.actionWall')}</h5>
                            </div>
                            <button
                              onClick={() => setShowActionModal({ userId: member.uid, userName: member.name })}
                              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
                            >
                              <MessageSquarePlus className="w-3.5 h-3.5" />
                              {t('leader.newAction')}
                            </button>
                          </div>

                          <div className="space-y-2">
                            {leaderActions[member.uid]?.length > 0 ? (
                              leaderActions[member.uid].slice(0, 5).map(action => (
                                <div 
                                  key={action.id} 
                                  className={`flex items-center justify-between p-3 rounded-xl border ${
                                    theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    {getActionIcon(action.type)}
                                    <div>
                                      <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                        {getActionLabel(action.type)}
                                      </p>
                                      {action.note && (
                                        <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{action.note}</p>
                                      )}
                                    </div>
                                  </div>
                                  <span className={`text-[10px] font-medium ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {new Date(action.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className={`py-4 text-center text-xs italic ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                {t('leader.noActions')}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Histórico de Pontuação */}
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                            <h5 className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{t('leader.pointHistory')}</h5>
                          </div>

                          <div className="space-y-2">
                            {pointHistory[member.uid]?.length > 0 ? (
                              pointHistory[member.uid].slice(0, 5).map(history => (
                                <div 
                                  key={history.id} 
                                  className={`flex items-center justify-between p-3 rounded-xl border ${
                                    theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded-lg ${history.change >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                                      {history.change >= 0 ? (
                                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                                      ) : (
                                        <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                                      )}
                                    </div>
                                    <div>
                                      <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                        {history.change >= 0 ? '+' : ''}{history.change} {t('leader.points')}
                                      </p>
                                      <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{history.reason}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className={`text-[10px] font-medium ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                      {new Date(history.createdAt).toLocaleDateString()}
                                    </p>
                                    <p className={`text-[10px] font-bold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                                      {t('leader.total')}: {history.points}
                                    </p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className={`py-4 text-center text-xs italic ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                {t('leader.noPointHistory')}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Detalhamento por Módulo */}
                        <div>
                          <h5 className={`text-xs font-black uppercase tracking-widest mb-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{t('leader.moduleDetail')}</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {memberProgress.map(p => {
                            const module = modules.find(m => m.id === p.moduleId);
                            const trail = trails.find(t => t.id === p.trailId);
                            return (
                              <div key={p.moduleId} className={`p-4 rounded-xl border shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider truncate">{trail?.title || t('leader.trail')}</p>
                                    <h6 className={`font-bold text-sm truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{module?.title || t('leader.module')}</h6>
                                  </div>
                                  <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    p.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {p.status === 'completed' ? t('common.completed') : t('common.inProgress')}
                                  </div>
                                </div>
                                <div className={`flex items-center justify-between mt-4 pt-4 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-slate-50'}`}>
                                  <div className={`flex items-center gap-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                    <Clock className="w-3.5 h-3.5" />
                                    <span className="text-xs font-bold">{formatTime(p.timeSpentSeconds)}</span>
                                  </div>
                                  {p.highestQuizScore > 0 && (
                                    <div className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                      {t('leader.score')}: {p.highestQuizScore}%
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {memberProgress.length === 0 && (
                            <div className={`col-span-full py-8 text-center text-sm italic ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                              {t('leader.noProgress')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Modal */}
      <AnimatePresence>
        {showActionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
                theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'
              }`}
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('leader.registerAction')}</h3>
                  <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t('leader.collaborator')}: {showActionModal.userName}</p>
                </div>
                <button onClick={() => setShowActionModal(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  {(['congratulate', 'wait', 'attention', 'other'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewAction(prev => ({ ...prev, type }))}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        newAction.type === type
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                      }`}
                    >
                      {getActionIcon(type)}
                      <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        {getActionLabel(type)}
                      </span>
                    </button>
                  ))}
                </div>

                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                    {t('leader.observation')} ({t('common.optional').toLowerCase()})
                  </label>
                  <textarea
                    value={newAction.note}
                    onChange={(e) => setNewAction(prev => ({ ...prev, note: e.target.value }))}
                    placeholder={t('leader.observationPlaceholder')}
                    className={`w-full p-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/20 text-sm min-h-[100px] resize-none ${
                      theme === 'dark' 
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
                        : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
                <button
                  onClick={() => setShowActionModal(null)}
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleCreateAction}
                  disabled={isSubmittingAction}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  {isSubmittingAction ? t('common.saving') : t('leader.register')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Penalty Modal */}
      <AnimatePresence>
        {showPenaltyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ${
                theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'
              }`}
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-rose-500/10">
                    <TrendingDown className="w-5 h-5 text-rose-500" />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('leader.penaltyHistory')}</h3>
                    <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t('leader.penaltySub')}</p>
                  </div>
                </div>
                <button onClick={() => setShowPenaltyModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                {leaderPointHistory.filter(h => h.change < 0).length > 0 ? (
                  leaderPointHistory.filter(h => h.change < 0).map(history => {
                    // Extract collaborator name from reason if it follows the pattern: Penalidade: Prazo perdido pelo liderado (Nome)
                    const nameMatch = history.reason.match(/\(([^)]+)\)/);
                    const collaboratorName = nameMatch ? nameMatch[1] : null;
                    const cleanReason = history.reason.replace(/\s*\([^)]+\)/, '');

                    return (
                      <div 
                        key={history.id} 
                        className={`p-4 rounded-xl border transition-all ${
                          theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="p-1.5 rounded-lg bg-rose-500/10 shrink-0 mt-1">
                              <TrendingDown className="w-4 h-4 text-rose-500" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <p className={`text-sm font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                  {history.change} {t('leader.points')}
                                </p>
                                {collaboratorName && (
                                  <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-black uppercase">
                                    {collaboratorName}
                                  </span>
                                )}
                              </div>
                              <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                {cleanReason}
                              </p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold whitespace-nowrap ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                            {new Date(history.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center">
                    <CheckCircle className="w-12 h-12 text-emerald-500/20 mx-auto mb-4" />
                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t('leader.noPenalties')}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-900">
                <p className="text-xs font-bold leading-relaxed text-center text-white">
                  {t('leader.penaltyReminder')}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
