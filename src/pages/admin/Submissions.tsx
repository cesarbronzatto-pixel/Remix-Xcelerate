import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import { UserProgress, Module, UserProfile } from '../../types';
import { Search, Filter, CheckCircle, XCircle, Clock, ExternalLink, User, BookOpen, Loader2, MessageSquare, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SubmissionWithDetails extends UserProgress {
  user?: UserProfile;
  module?: Module;
}

export default function Submissions() {
  const { theme } = useTheme();
  const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithDetails | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      // Fetch all progress with submissions
      // Note: In a real app with many users, this should be paginated or filtered more strictly
      const q = query(collection(db, 'user_progress'), where('activitySubmission', '!=', null));
      const querySnapshot = await getDocs(q);
      
      const submissionsData: SubmissionWithDetails[] = [];
      
      for (const docSnapshot of querySnapshot.docs) {
        const data = docSnapshot.data() as UserProgress;
        const submission: SubmissionWithDetails = { ...data, id: docSnapshot.id };
        
        // Fetch User details
        const userSnap = await getDoc(doc(db, 'users', data.userId));
        if (userSnap.exists()) {
          submission.user = userSnap.data() as UserProfile;
        }
        
        // Fetch Module details
        const moduleSnap = await getDoc(doc(db, 'modules', data.moduleId));
        if (moduleSnap.exists()) {
          submission.module = moduleSnap.data() as Module;
        }
        
        submissionsData.push(submission);
      }
      
      // Sort by submission date (newest first)
      submissionsData.sort((a, b) => 
        (b.activitySubmission?.submittedAt || 0) - (a.activitySubmission?.submittedAt || 0)
      );
      
      setSubmissions(submissionsData);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      toast.error("Erro ao carregar submissões.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status: 'approved' | 'rejected') => {
    if (!selectedSubmission || !selectedSubmission.id) return;
    
    setIsProcessing(true);
    try {
      const progressRef = doc(db, 'user_progress', selectedSubmission.id);
      
      const updatedSubmission = {
        ...selectedSubmission.activitySubmission!,
        status,
        feedback,
        reviewedAt: Date.now()
      };

      const updateData: any = {
        'activitySubmission': updatedSubmission,
        'lastUpdatedAt': Date.now()
      };

      // If approved, mark module as completed if no quiz is required
      if (status === 'approved') {
        const hasQuiz = selectedSubmission.module?.questions && 
                        selectedSubmission.module.questions.length > 0 && 
                        selectedSubmission.module.quizConfig.isRequired;
        
        if (!hasQuiz) {
          updateData.status = 'completed';
        }
      }

      await updateDoc(progressRef, updateData);
      
      toast.success(status === 'approved' ? 'Atividade aprovada!' : 'Atividade rejeitada.');
      setSelectedSubmission(null);
      setFeedback('');
      fetchSubmissions();
    } catch (error) {
      console.error("Error updating submission status:", error);
      toast.error("Erro ao processar submissão.");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = 
      sub.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.module?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || sub.activitySubmission?.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-black uppercase tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Submissões de Atividades
          </h1>
          <p className={`text-sm font-medium mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            Revise e aprove os envios dos colaboradores
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row gap-4 ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por colaborador ou módulo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 text-sm rounded-xl outline-none border transition-all ${
              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
            }`}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className={`px-4 py-2 text-sm rounded-xl outline-none border transition-all ${
              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
            }`}
          >
            <option value="all">Todos os Status</option>
            <option value="pending">Pendentes</option>
            <option value="approved">Aprovados</option>
            <option value="rejected">Rejeitados</option>
          </select>
        </div>
      </div>

      {/* Lista de Submissões */}
      <div className={`rounded-2xl border overflow-hidden ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Colaborador</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Módulo / Trilha</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Data de Envio</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/10">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Carregando submissões...</p>
                  </td>
                </tr>
              ) : filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-sm text-slate-500 italic">Nenhuma submissão encontrada.</p>
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => (
                  <tr key={sub.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            {sub.user?.name || 'Usuário Desconhecido'}
                          </p>
                          <p className="text-[10px] text-slate-500">{sub.user?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            {sub.module?.title || 'Módulo Removido'}
                          </p>
                          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Atividade</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        {sub.activitySubmission?.submittedAt ? format(sub.activitySubmission.submittedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        sub.activitySubmission?.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                        sub.activitySubmission?.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                        'bg-amber-500/10 text-amber-500'
                      }`}>
                        {sub.activitySubmission?.status === 'approved' ? 'Aprovada' :
                         sub.activitySubmission?.status === 'rejected' ? 'Rejeitada' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => setSelectedSubmission(sub)}
                        className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                          theme === 'dark' ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Revisar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Revisão */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className={`w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden ${
            theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'
          }`}>
            <div className="p-6 border-b border-slate-800/10 flex items-center justify-between">
              <h2 className={`text-xl font-black uppercase tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Revisar Submissão
              </h2>
              <button onClick={() => setSelectedSubmission(null)} className="text-slate-500 hover:text-slate-700">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Colaborador</label>
                  <p className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{selectedSubmission.user?.name}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Módulo</label>
                  <p className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{selectedSubmission.module?.title}</p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-2">Arquivo Enviado</label>
                <a 
                  href={selectedSubmission.activitySubmission?.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:border-blue-500' : 'bg-slate-50 border-slate-200 hover:border-blue-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-blue-500" />
                    <div>
                      <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        {selectedSubmission.activitySubmission?.fileName}
                      </p>
                      <p className="text-[10px] text-slate-500">Clique para visualizar o arquivo</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </a>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-2">Feedback para o Colaborador</label>
                <textarea 
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Escreva um comentário sobre o envio..."
                  className={`w-full p-4 rounded-xl outline-none border transition-all min-h-[120px] ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                  }`}
                />
              </div>
            </div>

            <div className={`p-6 border-t flex justify-end gap-3 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
              <button 
                onClick={() => handleUpdateStatus('rejected')}
                disabled={isProcessing}
                className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-red-500 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-all flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" /> Rejeitar
              </button>
              <button 
                onClick={() => handleUpdateStatus('approved')}
                disabled={isProcessing}
                className="px-8 py-2.5 text-xs font-black uppercase tracking-widest text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Aprovar Atividade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
