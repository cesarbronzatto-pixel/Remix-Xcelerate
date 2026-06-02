import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { UserProfile, Area, Country } from '../../types';
import { Trophy, Medal, Award, TrendingUp, Users, Search, RotateCcw, Filter, Check, ChevronDown, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { MiniBadge } from '../../components/gamification/MiniBadge';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { gamificationService } from '../../services/gamificationService';

export default function Ranking() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { isManagementAdmin } = usePermissions();
  const { userProfile: authUser } = useAuth();
  const isAdmin = isManagementAdmin;
  
  const [rankings, setRankings] = useState<UserProfile[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [isAreaFilterOpen, setIsAreaFilterOpen] = useState(false);
  const [isCountryFilterOpen, setIsCountryFilterOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const markCheckLeaderboardTask = async () => {
      if (authUser && authUser.isOnboarding && !authUser.onboardingTasks?.checkLeaderboard) {
        try {
          const userRef = doc(db, 'users', authUser.uid);
          await updateDoc(userRef, {
            'onboardingTasks.checkLeaderboard': true
          });
          await gamificationService.addPoints(authUser.uid, 20, 'Onboarding: Conhecer Ranking');
          toast.success(t('onboarding.taskCompleted', { task: t('onboarding.checkLeaderboard'), points: 20 }));
        } catch (error) {
          console.error("Error marking checkLeaderboard task:", error);
        }
      }
    };
    markCheckLeaderboardTask();
  }, [authUser]);

  const fetchData = async () => {
    try {
      // Fetch Areas
      const areasSnap = await getDocs(collection(db, 'areas'));
      const areasData = areasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Area));
      setAreas(areasData);

      // Fetch Countries
      const countriesSnap = await getDocs(collection(db, 'countries'));
      const countriesData = countriesSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Country))
        .filter(c => c.isActive);
      setCountries(countriesData);

      // Fetch Users sorted by points
      const usersSnap = await getDocs(query(collection(db, 'users'), orderBy('points', 'desc'), limit(1000)));
      const users = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setRankings(users);
    } catch (error) {
      console.error('Error fetching ranking data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetAllPoints = async () => {
    setIsResetting(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const batch = writeBatch(db);
      
      usersSnap.docs.forEach((userDoc) => {
        batch.update(userDoc.ref, {
          points: 0,
          weeklyPoints: 0,
          level: 1,
          badges: []
        });
      });
      
      await batch.commit();
      await fetchData();
      setIsResetConfirmOpen(false);
      toast.success(t('admin.resetAllPointsButton'), {
        description: t('admin.resetting')
      });
    } catch (error) {
      console.error('Error resetting points:', error);
      toast.error(t('admin.resetAllPointsConfirm'));
    } finally {
      setIsResetting(false);
    }
  };

  const toggleArea = (areaId: string) => {
    setSelectedAreaIds(prev => 
      prev.includes(areaId) 
        ? prev.filter(id => id !== areaId)
        : [...prev, areaId]
    );
  };

  const filteredRankings = rankings.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.areaId && areas.find(a => a.id === user.areaId)?.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesArea = selectedAreaIds.length === 0 || (user.areaId && selectedAreaIds.includes(user.areaId));
    
    const matchesCountry = countryFilter === 'all' || user.countryId === countryFilter || user.country === countryFilter;
    
    return matchesSearch && matchesArea && matchesCountry;
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedAreaIds]);

  const totalPages = Math.ceil(filteredRankings.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRankings = filteredRankings.slice(startIndex, startIndex + pageSize);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="w-6 h-6 text-amber-400" />;
      case 1: return <Medal className="w-6 h-6 text-slate-400" />;
      case 2: return <Medal className="w-6 h-6 text-amber-700" />;
      default: return <span className="text-slate-500 font-bold w-6 text-center">{index + 1}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.rankingTitle')}</h1>
          <p className="text-slate-500">{t('admin.rankingSub')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => setIsResetConfirmOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-all shadow-lg shadow-rose-600/20 text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              {t('admin.resetAllPoints')}
            </button>
          )}

          {/* Country Filter */}
          <div className="relative">
            <button
              onClick={() => {
                setIsCountryFilterOpen(!isCountryFilterOpen);
                setIsAreaFilterOpen(false);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-all ${
                theme === 'dark'
                  ? 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800'
                  : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50 shadow-sm'
              }`}
            >
              <Globe className="w-4 h-4 text-slate-400" />
              {countryFilter === 'all' ? 'Global' : countries.find(c => c.id === countryFilter)?.name || countryFilter}
              <ChevronDown className={`w-4 h-4 transition-transform ${isCountryFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isCountryFilterOpen && (
              <div className={`absolute right-0 mt-2 w-56 rounded-xl border shadow-xl z-50 p-2 ${
                theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
              }`}>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  <button
                    onClick={() => {
                      setCountryFilter('all');
                      setIsCountryFilterOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-between ${
                      countryFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : (theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50')
                    }`}
                  >
                    Global
                    {countryFilter === 'all' && <Check className="w-3 h-3" />}
                  </button>
                  {countries.map(country => (
                    <button
                      key={country.id}
                      onClick={() => {
                        setCountryFilter(country.id!);
                        setIsCountryFilterOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-between ${
                        countryFilter === country.id
                          ? 'bg-blue-600 text-white'
                          : (theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50')
                      }`}
                    >
                      {country.name}
                      {countryFilter === country.id && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder={t('admin.rankingSearch')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-10 pr-4 py-2 rounded-lg text-sm border outline-none transition-all w-full md:w-64 ${
                theme === 'dark' 
                  ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' 
                  : 'bg-white border-slate-200 text-slate-900 focus:border-blue-400 shadow-sm'
              }`}
            />
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setIsAreaFilterOpen(!isAreaFilterOpen);
                setIsCountryFilterOpen(false);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-all ${
                theme === 'dark'
                  ? 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800'
                  : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50 shadow-sm'
              }`}
            >
              <Filter className="w-4 h-4 text-slate-400" />
              {selectedAreaIds.length === 0 
                ? t('admin.allAreas') 
                : t('admin.selectedAreas', { count: selectedAreaIds.length })}
              <ChevronDown className={`w-4 h-4 transition-transform ${isAreaFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isAreaFilterOpen && (
              <div className={`absolute right-0 mt-2 w-64 rounded-xl border shadow-xl z-50 p-2 ${
                theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
              }`}>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  <button
                    onClick={() => setSelectedAreaIds([])}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-between ${
                      selectedAreaIds.length === 0
                        ? 'bg-blue-600 text-white'
                        : (theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50')
                    }`}
                  >
                    {t('admin.allAreas')}
                    {selectedAreaIds.length === 0 && <Check className="w-3 h-3" />}
                  </button>
                  {areas.map(area => (
                    <button
                      key={area.id}
                      onClick={() => toggleArea(area.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-between ${
                        selectedAreaIds.includes(area.id)
                          ? 'bg-blue-600 text-white'
                          : (theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50')
                      }`}
                    >
                      {area.name}
                      {selectedAreaIds.includes(area.id) && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top 3 Cards */}
      {!searchTerm && selectedAreaIds.length === 0 && rankings.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 0, 2].map((idx) => {
            const user = rankings[idx];
            if (!user) return null;
            const isFirst = idx === 0;
            return (
              <div 
                key={user.uid}
                className={`relative p-6 rounded-2xl border transition-all flex flex-col items-center text-center ${
                  isFirst 
                    ? (theme === 'dark' ? 'bg-blue-900/20 border-blue-500/50 scale-105 z-10' : 'bg-blue-50 border-blue-200 scale-105 z-10')
                    : (theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm')
                }`}
              >
                {isFirst && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-950 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                    <Trophy className="w-3 h-3" /> {t('admin.rankingLeader')}
                  </div>
                )}
                
                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-md mb-4 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}&backgroundColor=1e3a8a`} alt={user.name} />
                  )}
                </div>
                
                <h3 className={`font-bold truncate w-full ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{user.name}</h3>
                <div className="mb-2">
                  <MiniBadge badges={user.badges || []} level={user.level} showLevel />
                </div>
                <p className="text-xs text-slate-500 mb-4">{user.areaId ? areas.find(a => a.id === user.areaId)?.name : t('common.noArea')}</p>
                
                <div className="grid grid-cols-2 gap-4 w-full pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{t('admin.rankingWeekly')}</p>
                    <p className="text-lg font-bold text-blue-500">{user.weeklyPoints || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{t('admin.rankingTotal')}</p>
                    <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{user.points || 0}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ranking Table */}
      <div className={`rounded-2xl border overflow-hidden transition-all ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`border-b text-xs font-bold uppercase tracking-wider ${
                theme === 'dark' ? 'bg-slate-800/50 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'
              }`}>
                <th className="px-6 py-4 w-20">{t('admin.rankingPos')}</th>
                <th className="px-6 py-4">{t('admin.rankingName')}</th>
                <th className="px-6 py-4">{t('admin.rankingArea')}</th>
                <th className="px-6 py-4 text-center">{t('admin.rankingWeeklyPoints')}</th>
                <th className="px-6 py-4 text-center">{t('admin.rankingTotalPoints')}</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-50'}`}>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">{t('admin.rankingLoading')}</td>
                </tr>
              ) : paginatedRankings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">{t('admin.rankingNoResults')}</td>
                </tr>
              ) : (
                paginatedRankings.map((user, index) => (
                  <tr key={user.uid} className={`group transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50'}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex justify-center">{getRankIcon(startIndex + index)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}&backgroundColor=1e3a8a`} alt="" />
                          )}
                        </div>
                        <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{user.name}</span>
                        <MiniBadge badges={user.badges || []} level={user.level} showLevel />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                        {user.areaId ? areas.find(a => a.id === user.areaId)?.name : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm font-bold">
                        <TrendingUp className="w-3 h-3" />
                        {user.weeklyPoints || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                        {user.points || 0}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-slate-500">
            {t('common.showing', { 
              start: startIndex + 1, 
              end: Math.min(startIndex + pageSize, filteredRankings.length), 
              total: filteredRankings.length 
            })}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
                theme === 'dark'
                  ? 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800 disabled:opacity-50'
                  : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50 shadow-sm disabled:opacity-50'
              }`}
            >
              {t('common.previous')}
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((p, i, arr) => (
                  <React.Fragment key={p}>
                    {i > 0 && arr[i - 1] !== p - 1 && <span className="text-slate-400">...</span>}
                    <button
                      onClick={() => setCurrentPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                        currentPage === p
                          ? 'bg-blue-600 text-white'
                          : (theme === 'dark' ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50')
                      }`}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                ))}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
                theme === 'dark'
                  ? 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800 disabled:opacity-50'
                  : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50 shadow-sm disabled:opacity-50'
              }`}
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Reset */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className={`rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-4 text-rose-600">
              <div className="p-2 bg-rose-100 rounded-lg">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold">{t('admin.resetAllPoints')}</h2>
            </div>
            
            <p className={`mb-6 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
              {t('admin.resetAllPointsConfirm')}
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsResetConfirmOpen(false)}
                disabled={isResetting}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${
                  theme === 'dark' ? 'text-slate-400 bg-slate-800 hover:bg-slate-700' : 'text-slate-600 bg-white border border-slate-300 hover:bg-slate-50'
                }`}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleResetAllPoints}
                disabled={isResetting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-rose-600 rounded-md hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/20 disabled:opacity-50"
              >
                {isResetting ? t('admin.resetting') : t('admin.resetAllPointsButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
