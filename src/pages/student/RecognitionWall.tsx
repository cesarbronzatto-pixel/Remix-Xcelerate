import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Recognition, UserProfile, Country } from '../../types';
import { recognitionService } from '../../services/recognitionService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTranslation } from 'react-i18next';
import { 
  Star, 
  Plus, 
  Search, 
  Calendar, 
  User, 
  MessageSquare, 
  X, 
  Send,
  Trophy,
  Heart,
  Award,
  Trash2,
  Globe,
  ChevronDown,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { usePermissions } from '../../hooks/usePermissions';
import { setDoc, doc, updateDoc } from 'firebase/firestore';
import { gamificationService } from '../../services/gamificationService';

export default function RecognitionWall() {
  const { user, userProfile } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { isManagementAdmin } = usePermissions();
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [countries, setCountries] = useState<Country[]>([]);
  const [isCountryFilterOpen, setIsCountryFilterOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recognitionToDelete, setRecognitionToDelete] = useState<string | null>(null);

  useEffect(() => {
    const markExploreWallTask = async () => {
      if (user && userProfile?.isOnboarding && !userProfile.onboardingTasks?.exploreWall) {
        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            'onboardingTasks.exploreWall': true
          });
          await gamificationService.addPoints(user.uid, 20, `Onboarding: ${t('onboarding.exploreWall')}`);
          toast.success(t('onboarding.taskCompleted', { task: t('onboarding.exploreWall'), points: 20 }));
        } catch (error) {
          console.error("Error marking exploreWall task:", error);
        }
      }
    };
    markExploreWallTask();
  }, [user, userProfile]);

  // Form state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    const unsubscribe = recognitionService.subscribeToRecognitions((data) => {
      setRecognitions(data);
      setLoading(false);
    });

    fetchUsers();
    fetchCountries();

    return () => unsubscribe();
  }, []);

  const fetchCountries = async () => {
    try {
      const snap = await getDocs(collection(db, 'countries'));
      const countriesData = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Country))
        .filter(c => c.isActive);
      setCountries(countriesData);
    } catch (error) {
      console.error("Error fetching countries:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const usersData = snap.docs
        .map(d => ({ uid: d.id, ...d.data() } as UserProfile))
        .filter(u => u.isActive !== false)
        .filter(u => !u.name.toLowerCase().includes('teste') && !u.email.toLowerCase().includes('teste'));
      
      // Filter out current user for the manual selection list
      const otherUsers = usersData.filter(u => u.uid !== userProfile?.uid);
      setUsers(otherUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !reason.trim() || !userProfile) {
      toast.error(t('recognition.reasonPlaceholder'));
      return;
    }

    setIsSubmitting(true);
    try {
      const targetUser = users.find(u => u.uid === selectedUserId);
      if (!targetUser) throw new Error('Usuário não encontrado');

      await recognitionService.createRecognition({
        fromUserId: userProfile.uid,
        fromUserName: userProfile.name,
        toUserId: targetUser.uid,
        toUserName: targetUser.name,
        toUserCountry: targetUser.country || 'Brasil',
        toUserCountryId: targetUser.countryId || null,
        reason: reason.trim()
      });

      // Complete onboarding task if applicable
      if (userProfile.isOnboarding && !userProfile.onboardingTasks?.firstRecognition) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          'onboardingTasks.firstRecognition': true
        });
        await gamificationService.addPoints(user.uid, 50, 'Onboarding: Primeiro Reconhecimento');
        toast.success(t('onboarding.taskCompleted', { task: t('onboarding.firstRecognition'), points: 50 }));
      }

      toast.success(t('recognition.success'));
      setShowModal(false);
      setSelectedUserId('');
      setReason('');
    } catch (error) {
      console.error("Error creating recognition:", error);
      toast.error(t('recognition.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!recognitionToDelete) return;
    
    try {
      await recognitionService.deleteRecognition(recognitionToDelete);
      toast.success(t('recognition.deleted'));
      setRecognitionToDelete(null);
    } catch (error) {
      toast.error(t('recognition.errorDelete'));
    }
  };

  const filteredRecognitions = recognitions.filter(r => {
    // Filter out test users from the wall
    const isFromTest = r.fromUserName.toLowerCase().includes('teste') || r.fromUserId.toLowerCase().includes('teste');
    const isToTest = r.toUserName.toLowerCase().includes('teste') || r.toUserId.toLowerCase().includes('teste');
    if (isFromTest || isToTest) return false;

    const matchesSearch = r.toUserName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.fromUserName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.reason.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCountry = countryFilter === 'all' || r.toUserCountryId === countryFilter || r.toUserCountry === countryFilter;
      
    return matchesSearch && matchesCountry;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10">
              <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
            </div>
            <h1 className={`text-3xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {t('recognition.title')}
            </h1>
          </div>
          <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('recognition.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Country Filter */}
          <div className="relative">
            <button
              onClick={() => setIsCountryFilterOpen(!isCountryFilterOpen)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border transition-all ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'
                  : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50 shadow-sm'
              }`}
            >
              <Globe className="w-4 h-4 text-slate-400" />
              {countryFilter === 'all' ? t('recognition.global') : countries.find(c => c.id === countryFilter)?.name || countryFilter}
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
                        ? 'bg-amber-500 text-white'
                        : (theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50')
                    }`}
                  >
                    {t('recognition.global')}
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
                          ? 'bg-amber-500 text-white'
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

          <div className="relative w-full md:w-64">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
            <input 
              type="text"
              placeholder={t('recognition.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-amber-500/20 text-sm transition-all ${
                theme === 'dark' 
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
                  : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            {t('recognition.send')}
          </button>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      <AnimatePresence>
        {recognitionToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-md p-6 rounded-3xl shadow-2xl ${theme === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}
            >
              <div className="flex items-center gap-3 mb-4 text-rose-500">
                <div className="p-2 rounded-xl bg-rose-500/10">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black">{t('recognition.delete')}</h3>
              </div>
              
              <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                {t('recognition.deleteConfirm')}
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setRecognitionToDelete(null)}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-bold transition-all ${
                    theme === 'dark' ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-rose-500/20"
                >
                  {t('common.delete')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recognition Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className={`h-48 rounded-3xl animate-pulse ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`} />
          ))}
        </div>
      ) : filteredRecognitions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredRecognitions.map((recognition) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={recognition.id}
                className={`group relative p-6 rounded-3xl border transition-all hover:shadow-xl hover:-translate-y-1 ${
                  theme === 'dark' 
                    ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800' 
                    : 'bg-white border-slate-100 hover:border-amber-100'
                }`}
              >
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  </div>
                  {(isManagementAdmin || recognition.fromUserId === userProfile?.uid) && (
                    <button 
                      onClick={() => setRecognitionToDelete(recognition.id!)}
                      className="p-2 rounded-xl bg-rose-500/10 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500 hover:text-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black ${
                      theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-900'
                    }`}>
                      {recognition.toUserName.charAt(0)}
                    </div>
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                        {t('recognition.to')}
                      </p>
                      <h3 className={`font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        {recognition.toUserName}
                      </h3>
                    </div>
                  </div>

                  <div className={`p-4 rounded-2xl italic text-sm leading-relaxed ${
                    theme === 'dark' ? 'bg-slate-900/50 text-slate-300' : 'bg-slate-50 text-slate-700'
                  }`}>
                    "{recognition.reason}"
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                        theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {recognition.fromUserName.charAt(0)}
                      </div>
                      <p className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                        {t('recognition.from')} <span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{recognition.fromUserName}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {new Date(recognition.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className={`py-20 text-center rounded-3xl border-2 border-dashed ${
          theme === 'dark' ? 'border-slate-800 bg-slate-800/20' : 'border-slate-100 bg-slate-50/50'
        }`}>
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Star className="w-10 h-10 text-amber-500/40" />
          </div>
          <h3 className={`text-xl font-black mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            {t('recognition.noRecognitions')}
          </h3>
          <p className={`text-sm font-medium mb-8 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('recognition.subtitle')}
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-amber-500/20"
          >
            {t('recognition.send')}
          </button>
        </div>
      )}

      {/* Recognition Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden ${
                theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'
              }`}
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-500">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <Trophy className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">{t('recognition.modalTitle')}</h3>
                    <p className="text-sm font-medium text-white/80">{t('recognition.subtitle')}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowModal(false)} 
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t('recognition.selectColleague')}
                  </label>
                  <div className="relative">
                    <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                    <select
                      required
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className={`w-full pl-12 pr-4 py-4 rounded-2xl border outline-none focus:ring-4 focus:ring-amber-500/10 text-sm font-bold appearance-none transition-all ${
                        theme === 'dark' 
                          ? 'bg-slate-800 border-slate-700 text-white' 
                          : 'bg-slate-50 border-slate-100 text-slate-900'
                      }`}
                    >
                      <option value="">{t('recognition.selectColleaguePlaceholder')}</option>
                      {users.map(u => (
                        <option key={u.uid} value={u.uid}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t('recognition.reason')}
                  </label>
                  <div className="relative">
                    <MessageSquare className={`absolute left-4 top-4 w-5 h-5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                    <textarea
                      required
                      placeholder={t('recognition.reasonPlaceholder')}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={4}
                      className={`w-full pl-12 pr-4 py-4 rounded-2xl border outline-none focus:ring-4 focus:ring-amber-500/10 text-sm font-bold transition-all resize-none ${
                        theme === 'dark' 
                          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-600' 
                          : 'bg-slate-50 border-slate-100 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                  </div>
                </div>

                <div className={`p-4 rounded-2xl flex items-start gap-3 ${
                  theme === 'dark' ? 'bg-amber-500/5' : 'bg-amber-50'
                }`}>
                  <Award className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className={`text-xs font-medium leading-relaxed ${theme === 'dark' ? 'text-amber-200/60' : 'text-amber-700'}`}>
                    {t('recognition.subtitle')}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black rounded-2xl transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 group"
                >
                  {isSubmitting ? (
                    t('recognition.submitting')
                  ) : (
                    <>
                      {t('recognition.send')}
                      <Send className="w-5 h-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
