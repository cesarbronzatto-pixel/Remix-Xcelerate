import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { PlaybookContent, PlaybookAccessLog, PlaybookSession } from '../../types';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, BookOpen, Search, Filter, ExternalLink, FileText, Presentation, Video as VideoIcon, Link as LinkIcon, Upload, Loader2, BarChart3, XCircle, Clock, User, ImageOff, Settings, Layout } from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';

const CONTENT_TYPES = [
  { id: 'pdf', label: 'PDF', icon: FileText },
  { id: 'presentation', label: 'Apresentação', icon: Presentation },
  { id: 'link', label: 'Link Externo', icon: LinkIcon },
  { id: 'video', label: 'Vídeo', icon: VideoIcon }
];

export default function PlaybookAdmin() {
  console.log('PLAYBOOK ADMIN LOADED - VERSION 4');
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [contents, setContents] = useState<PlaybookContent[]>([]);
  const [sessions, setSessions] = useState<PlaybookSession[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sessionFilter, setSessionFilter] = useState('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingContent, setEditingContent] = useState<PlaybookContent | null>(null);
  const [editingSession, setEditingSession] = useState<PlaybookSession | null>(null);
  const [contentToDelete, setContentToDelete] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [isGeneralReportModalOpen, setIsGeneralReportModalOpen] = useState(false);
  const [trackingLogs, setTrackingLogs] = useState<PlaybookAccessLog[]>([]);
  const [allLogs, setAllLogs] = useState<PlaybookAccessLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedContentForTracking, setSelectedContentForTracking] = useState<PlaybookContent | null>(null);

  const [formData, setFormData] = useState<Omit<PlaybookContent, 'id' | 'createdAt'>>({
    sessionId: '',
    title: '',
    type: 'pdf',
    url: '',
    imageUrl: '',
    description: ''
  });

  const [sessionFormData, setSessionFormData] = useState<Omit<PlaybookSession, 'id' | 'createdAt'>>({
    title: '',
    description: '',
    icon: '',
    imageUrl: '',
    order: 0,
    isActive: true
  });

  useEffect(() => { 
    fetchContents(); 
    fetchSessions();
    toast.info('Playbook Admin v4 carregado!', {
      description: 'Novas funções de upload e correção de URL ativas.',
      duration: 5000
    });
  }, []);

  const fetchContents = async () => {
    try {
      const q = query(collection(db, 'playbook_content'), orderBy('createdAt', 'desc'));
      let querySnapshot;
      try {
        querySnapshot = await getDocs(q);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'playbook_content');
        return;
      }
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PlaybookContent[];
      setContents(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrackingLogs = async (content: PlaybookContent) => {
    if (!content.id) return;
    setLoadingLogs(true);
    setSelectedContentForTracking(content);
    setIsTrackingModalOpen(true);
    try {
      const q = query(
        collection(db, 'playbook_access_logs'),
        where('contentId', '==', content.id),
        orderBy('timestamp', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PlaybookAccessLog[];
      setTrackingLogs(logs);
    } catch (error) {
      console.error("Error fetching tracking logs:", error);
      handleFirestoreError(error, OperationType.GET, 'playbook_access_logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchGeneralReports = async () => {
    setLoadingLogs(true);
    setIsGeneralReportModalOpen(true);
    try {
      const q = query(
        collection(db, 'playbook_access_logs'),
        orderBy('timestamp', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PlaybookAccessLog[];
      setAllLogs(logs);
    } catch (error) {
      console.error("Error fetching general reports:", error);
      handleFirestoreError(error, OperationType.GET, 'playbook_access_logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const q = query(collection(db, 'playbook_sessions'), orderBy('order', 'asc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PlaybookSession[];
      
      // Deduplicar por título para evitar exibição duplicada na UI se houver lixo no banco
      const uniqueSessions = data.reduce((acc: PlaybookSession[], current) => {
        const x = acc.find(item => item.title.trim().toLowerCase() === current.title.trim().toLowerCase());
        if (!x) {
          return acc.concat([current]);
        } else {
          return acc;
        }
      }, []);
      
      setSessions(uniqueSessions);
      
      // Se não houver sessões, criar as iniciais de forma robusta
      if (data.length === 0) {
        const initialSessions = [
          { id: 'session-fdm', title: 'FDM', description: 'Fair Decision Making', icon: '⚖️', order: 0, isActive: true },
          { id: 'session-culture', title: 'Cultura e Valores', description: 'Nossa cultura', icon: '🌟', order: 1, isActive: true },
          { id: 'session-gemini', title: 'Gemini Enterprise', description: 'Inteligência Artificial', icon: '✨', order: 2, isActive: true },
          { id: 'session-cloud', title: 'Google Cloud', description: 'Infraestrutura em nuvem', icon: '☁️', order: 3, isActive: true },
          { id: 'session-workspace', title: 'Google Workspace', description: 'Produtividade', icon: '💼', order: 4, isActive: true }
        ];
        
        const { setDoc, doc: firestoreDoc } = await import('firebase/firestore');
        for (const s of initialSessions) {
          const { id, ...sessionData } = s;
          await setDoc(firestoreDoc(db, 'playbook_sessions', id), {
            ...sessionData,
            createdAt: Date.now()
          });
        }
        fetchSessions();
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
    }
  };

  const handleOpenModal = (content?: PlaybookContent) => {
    if (content) {
      setEditingContent(content);
      setFormData({
        sessionId: content.sessionId,
        title: content.title,
        type: content.type,
        url: content.url,
        imageUrl: content.imageUrl || '',
        description: content.description || ''
      });
    } else {
      setEditingContent(null);
      setFormData({
        sessionId: sessions.length > 0 ? sessions[0].id || '' : '',
        title: '',
        type: 'pdf',
        url: '',
        imageUrl: '',
        description: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenSessionModal = (session?: PlaybookSession) => {
    if (session) {
      setEditingSession(session);
      setSessionFormData({
        title: session.title,
        description: session.description || '',
        icon: session.icon || '',
        imageUrl: session.imageUrl || '',
        order: session.order,
        isActive: session.isActive
      });
    } else {
      setEditingSession(null);
      setSessionFormData({
        title: '',
        description: '',
        icon: '',
        imageUrl: '',
        order: sessions.length,
        isActive: true
      });
    }
    setIsSessionModalOpen(true);
  };

  const handleOpenTrackingModal = (content: PlaybookContent) => {
    setSelectedContentForTracking(content);
    setIsTrackingModalOpen(true);
    fetchTrackingLogs(content);
  };

  const handleSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSave = {
        ...sessionFormData,
        updatedAt: Date.now()
      };

      if (editingSession && editingSession.id) {
        await updateDoc(doc(db, 'playbook_sessions', editingSession.id), dataToSave);
        toast.success('Tema atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'playbook_sessions'), {
          ...dataToSave,
          createdAt: Date.now()
        });
        toast.success('Novo tema criado com sucesso!');
      }
      setIsSessionModalOpen(false);
      fetchSessions();
    } catch (error) {
      console.error("Error saving session:", error);
      toast.error('Erro ao salvar tema');
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'playbook_sessions', id));
      fetchSessions();
      setSessionToDelete(null);
      toast.success('Tema excluído com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `playbook_sessions/${id}`);
    }
  };

  const fixImageUrl = (url: string) => {
    if (!url) return '';
    let fixedUrl = url.trim();
    
    // Corrigir links do Imgur que não são diretos
    if (fixedUrl.includes('imgur.com/') && !fixedUrl.includes('i.imgur.com') && !fixedUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)) {
      const parts = fixedUrl.split('/');
      const id = parts[parts.length - 1];
      if (id) {
        fixedUrl = `https://i.imgur.com/${id}.png`;
        toast.info('Link do Imgur corrigido para link direto!');
      }
    }
    
    return fixedUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSave = {
        sessionId: formData.sessionId,
        title: formData.title,
        type: formData.type,
        url: formData.url,
        imageUrl: formData.imageUrl || '',
        description: formData.description || ''
      };

      if (editingContent && editingContent.id) {
        try {
          await updateDoc(doc(db, 'playbook_content', editingContent.id), {
            ...dataToSave,
            updatedAt: Date.now()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `playbook_content/${editingContent.id}`);
        }
      } else {
        try {
          await addDoc(collection(db, 'playbook_content'), {
            ...dataToSave,
            createdAt: Date.now()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'playbook_content');
        }
      }
      setIsModalOpen(false);
      fetchContents();
    } catch (error) {
      console.error("Error saving playbook content:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'playbook_content', id));
      fetchContents();
      setContentToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `playbook_content/${id}`);
    }
  };

  const getIcon = (type: string) => {
    const found = CONTENT_TYPES.find(t => t.id === type);
    const Icon = found ? found.icon : LinkIcon;
    return <Icon className="w-4 h-4" />;
  };

  const getSessionLabel = (id: string) => {
    return sessions.find(s => s.id === id)?.title || id;
  };

  const filteredContents = contents.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (item.description?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesSession = sessionFilter === 'all' || item.sessionId === sessionFilter;
    
    return matchesSearch && matchesSession;
  });

  // Group content by session for the grouped view
  const groupedContents = sessions.map(session => ({
    session,
    contents: filteredContents.filter(c => c.sessionId === session.id)
  })).sort((a, b) => (a.session.order || 0) - (b.session.order || 0));

  // Also handle contents without a session
  const uncategorizedContents = filteredContents.filter(c => !c.sessionId || !sessions.find(s => s.id === c.sessionId));

  if (loading) return <div className={`p-8 text-center ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('common.loading')}</div>;

  return (
    <div className={`space-y-6 transition-colors duration-300 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Gerenciar Playbook <span className="text-[10px] bg-blue-500 text-white px-1 rounded">v4</span></h1>
          <p className="text-sm text-slate-500">Adicione apresentações, PDFs e links às sessões do Playbook.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSessionModalOpen(true)} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all border ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <Layout className="w-4 h-4 text-purple-500" /> Gerenciar Temas
          </button>
          <button 
            onClick={fetchGeneralReports} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all border ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-blue-500" /> Relatórios Gerais
          </button>
          <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
            <Plus className="w-4 h-4" /> {t('common.create')}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className={`p-4 rounded-xl border flex flex-wrap items-center gap-4 transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por título ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm outline-none transition-all border ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' 
                : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-300'
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select 
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
            className={`px-3 py-2 rounded-lg text-sm outline-none border transition-all ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-white' 
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <option value="all">Todas as Sessões</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area - Grouped by Session */}
      <div className="space-y-8">
        {groupedContents.map(({ session, contents }) => (
          <div 
            key={session.id || `session-${session.title}`} 
            className={`rounded-2xl border overflow-hidden transition-all ${
              theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className={`px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              theme === 'dark' ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{session.icon || '📁'}</span>
                <div>
                  <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{session.title}</h2>
                  <p className="text-xs text-slate-500">{session.description}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setEditingContent(null);
                  setFormData({
                    sessionId: session.id || '',
                    title: '',
                    type: 'pdf',
                    url: '',
                    imageUrl: '',
                    description: ''
                  });
                  setIsModalOpen(true);
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" /> Novo Conteúdo em {session.title}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`text-[10px] uppercase font-black tracking-wider border-b ${theme === 'dark' ? 'text-slate-500 border-slate-800' : 'text-slate-400 border-slate-100'}`}>
                    <th className="px-6 py-4">Material</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">URL / Link</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {contents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center opacity-30">
                          <BookOpen className="w-10 h-10 mb-2" />
                          <p className="text-sm font-medium">Nenhum conteúdo neste tema.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    contents.map((item) => (
                      <tr 
                        key={item.id} 
                        className={`group transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
                              {item.imageUrl ? (
                                <img 
                                  src={item.imageUrl} 
                                  alt="" 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                  <ImageOff className="w-5 h-5" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className={`font-bold text-sm truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{item.title}</p>
                              <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{item.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold ${
                            item.type === 'video' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                            item.type === 'pdf' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                            item.type === 'presentation' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline flex items-center gap-1 truncate max-w-[150px]"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" /> {item.url}
                          </a>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleOpenTrackingModal(item)}
                              className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                              title="Ver Acessos"
                            >
                              <BarChart3 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleOpenModal(item)}
                              className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => item.id && setContentToDelete(item.id)}
                              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {uncategorizedContents.length > 0 && (
          <div 
            className={`rounded-2xl border overflow-hidden transition-all ${
              theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className={`px-6 py-4 border-b flex items-center gap-3 ${
              theme === 'dark' ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className="text-2xl">📁</span>
              <div>
                <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Sem Categoria</h2>
                <p className="text-xs text-slate-500">Materiais que não pertencem a nenhum tema ativo.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`text-[10px] uppercase font-black tracking-wider border-b ${theme === 'dark' ? 'text-slate-500 border-slate-800' : 'text-slate-400 border-slate-100'}`}>
                    <th className="px-6 py-4">Material</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">URL / Link</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {uncategorizedContents.map((item) => (
                    <tr 
                      key={item.id} 
                      className={`group transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
                            {item.imageUrl ? (
                              <img 
                                src={item.imageUrl} 
                                alt="" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <ImageOff className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className={`font-bold text-sm truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{item.title}</p>
                            <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{item.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold ${
                          item.type === 'video' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                          item.type === 'pdf' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                          item.type === 'presentation' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                          'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                        }`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline flex items-center gap-1 truncate max-w-[150px]"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" /> {item.url}
                        </a>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenTrackingModal(item)}
                            className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                            title="Ver Acessos"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleOpenModal(item)}
                            className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => item.id && setContentToDelete(item.id)}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className={`rounded-xl shadow-xl max-w-md w-full p-6 my-auto ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <h2 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{editingContent ? 'Editar Conteúdo' : 'Adicionar Conteúdo'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Título</label>
                <input 
                  type="text" 
                  required 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  placeholder="Ex: Apresentação de Cultura"
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Sessão do Playbook</label>
                <select 
                  value={formData.sessionId}
                  onChange={e => setFormData({...formData, sessionId: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Tipo de Conteúdo</label>
                <select 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value as any})}
                  className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  {CONTENT_TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>URL do Arquivo/Link</label>
                <input 
                  type="url" 
                  required 
                  value={formData.url} 
                  onChange={e => setFormData({...formData, url: e.target.value})} 
                  className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Imagem de Capa (Opcional)</label>
                <div className="space-y-3">
                  <div className="relative">
                    <input 
                      type="url" 
                      value={formData.imageUrl} 
                      onChange={e => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))} 
                      onBlur={e => {
                        const fixed = fixImageUrl(e.target.value);
                        if (fixed !== e.target.value) {
                          setFormData(prev => ({ ...prev, imageUrl: fixed }));
                        }
                      }}
                      className={`w-full pl-3 pr-10 py-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                      placeholder="Cole o link da imagem aqui..."
                    />
                    <LinkIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-[10px] text-slate-500 px-1">
                    Dica: Links do Imgur são corrigidos automaticamente ao sair do campo.
                  </p>
                  
                  {formData.imageUrl && (
                    <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center group">
                      <img 
                        key={formData.imageUrl}
                        src={formData.imageUrl} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const existingError = parent.querySelector('.preview-error');
                            if (existingError) existingError.remove();

                            const errorMsg = document.createElement('div');
                            errorMsg.className = 'preview-error flex flex-col items-center gap-2 text-slate-400 p-4 text-center';
                            errorMsg.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8 opacity-50"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="m10 10 4 4"/><path d="m14 10-4 4"/><path d="M2 8h20"/><path d="M6 4v4"/><path d="M10 4v4"/><path d="M14 4v4"/><path d="M18 4v4"/></svg><span class="text-xs font-medium">Não foi possível carregar esta imagem.</span><span class="text-[10px]">Certifique-se de que é um link direto (ex: .jpg, .png)</span>';
                            parent.appendChild(errorMsg);
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button 
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                          className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-transform hover:scale-110 shadow-lg"
                        >
                          <Trash2 className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Descrição (Opcional)</label>
                <textarea 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  rows={2} 
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${
                    theme === 'dark' ? 'text-slate-400 bg-slate-800 hover:bg-slate-700' : 'text-slate-600 bg-white border border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isTrackingModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`rounded-xl shadow-xl max-w-2xl w-full p-6 flex flex-col max-h-[90vh] ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Tracking de Acesso</h2>
                <p className="text-sm text-slate-500">{selectedContentForTracking?.title}</p>
              </div>
              <button 
                onClick={() => {
                  setIsTrackingModalOpen(false);
                  setTrackingLogs([]);
                }}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {loadingLogs ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                  <p className="text-sm text-slate-500">Carregando registros...</p>
                </div>
              ) : trackingLogs.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4 opacity-20" />
                  <p className="text-slate-500">Nenhum acesso registrado para este material ainda.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {trackingLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className={`p-4 rounded-lg border flex items-center justify-between transition-colors ${
                        theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          theme === 'dark' ? 'bg-slate-700' : 'bg-white shadow-sm'
                        }`}>
                          <User className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className={`font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{log.userName}</p>
                          <p className="text-xs text-slate-500">{log.userEmail}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                          <Clock className="w-3 h-3" />
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <p className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                          {new Date(log.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500">
              <div className="flex gap-4">
                <span>Total de acessos: <span className="font-bold text-blue-500">{trackingLogs.length}</span></span>
                <span>Pessoas únicas: <span className="font-bold text-purple-500">{new Set(trackingLogs.map(l => l.userId)).size}</span></span>
              </div>
              <button 
                onClick={() => setIsTrackingModalOpen(false)}
                className={`px-4 py-2 font-bold rounded-md transition-colors ${
                  theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {isGeneralReportModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`rounded-xl shadow-xl max-w-4xl w-full p-6 flex flex-col max-h-[90vh] ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Relatórios Gerais do Playbook</h2>
                <p className="text-sm text-slate-500">Visão consolidada de acessos e engajamento.</p>
              </div>
              <button 
                onClick={() => {
                  setIsGeneralReportModalOpen(false);
                  setAllLogs([]);
                }}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {loadingLogs ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                  <p className="text-sm text-slate-500">Processando dados...</p>
                </div>
              ) : allLogs.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4 opacity-20" />
                  <p className="text-slate-500">Nenhum dado de acesso disponível ainda.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <p className="text-xs text-slate-500 uppercase font-bold mb-1">Total de Acessos</p>
                      <p className="text-3xl font-black text-blue-500">{allLogs.length}</p>
                    </div>
                    <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <p className="text-xs text-slate-500 uppercase font-bold mb-1">Usuários Únicos</p>
                      <p className="text-3xl font-black text-purple-500">
                        {new Set(allLogs.map(l => l.userId)).size}
                      </p>
                    </div>
                    <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <p className="text-xs text-slate-500 uppercase font-bold mb-1">Materiais Acessados</p>
                      <p className="text-3xl font-black text-emerald-500">
                        {new Set(allLogs.map(l => l.contentId)).size}
                      </p>
                    </div>
                  </div>

                  {/* Ranking Section */}
                  <div>
                    <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      <BarChart3 className="w-5 h-5 text-blue-500" /> Ranking de Materiais Mais Acessados
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(
                        allLogs.reduce((acc, log) => {
                          acc[log.contentId] = acc[log.contentId] || { title: log.contentTitle, count: 0, uniqueUsers: new Set() };
                          acc[log.contentId].count++;
                          acc[log.contentId].uniqueUsers.add(log.userId);
                          return acc;
                        }, {} as Record<string, { title: string, count: number, uniqueUsers: Set<string> }>)
                      )
                      .sort((a, b) => b[1].count - a[1].count)
                      .slice(0, 10)
                      .map(([id, data], index) => (
                        <div 
                          key={id}
                          className={`p-4 rounded-lg border flex items-center justify-between ${
                            theme === 'dark' ? 'bg-slate-800/30 border-slate-800' : 'bg-white border-slate-100 shadow-sm'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                              index === 0 ? 'bg-amber-500 text-white' :
                              index === 1 ? 'bg-slate-400 text-white' :
                              index === 2 ? 'bg-amber-700 text-white' :
                              theme === 'dark' ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <p className={`font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{data.title}</p>
                              <p className="text-xs text-slate-500">{data.uniqueUsers.size} pessoas acessaram</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black text-blue-500">{data.count}</p>
                            <p className="text-[10px] uppercase font-bold text-slate-400">Acessos</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Accesses by Session */}
                  <div>
                    <h3 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Acessos por Sessão</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {sessions.map(session => {
                        const sessionLogs = allLogs.filter(l => l.sessionId === session.id);
                        if (sessionLogs.length === 0) return null;
                        return (
                          <div 
                            key={session.id}
                            className={`p-4 rounded-lg border flex items-center justify-between ${
                              theme === 'dark' ? 'bg-slate-800/30 border-slate-800' : 'bg-white border-slate-100 shadow-sm'
                            }`}
                          >
                            <span className="text-sm font-medium">{session.title}</span>
                            <span className="font-bold text-blue-500">{sessionLogs.length}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button 
                onClick={() => setIsGeneralReportModalOpen(false)}
                className={`px-6 py-2 font-bold rounded-md transition-colors ${
                  theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {isSessionModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className={`rounded-xl shadow-xl max-w-2xl w-full p-6 my-auto ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Gerenciar Temas do Playbook</h2>
              <button 
                onClick={() => setIsSessionModalOpen(false)}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Form de Sessão */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase text-slate-500">{editingSession ? 'Editar Tema' : 'Novo Tema'}</h3>
                <form onSubmit={handleSessionSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-70">Título</label>
                    <input 
                      type="text" 
                      required 
                      value={sessionFormData.title} 
                      onChange={e => setSessionFormData({...sessionFormData, title: e.target.value})} 
                      className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                      placeholder="Ex: Google Cloud"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold mb-1 opacity-70">Ícone (Emoji)</label>
                      <input 
                        type="text" 
                        value={sessionFormData.icon} 
                        onChange={e => setSessionFormData({...sessionFormData, icon: e.target.value})} 
                        className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                          theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                        placeholder="Ex: ☁️"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1 opacity-70">Ordem</label>
                      <input 
                        type="number" 
                        value={sessionFormData.order} 
                        onChange={e => setSessionFormData({...sessionFormData, order: parseInt(e.target.value)})} 
                        className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                          theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-70">Descrição</label>
                    <textarea 
                      value={sessionFormData.description} 
                      onChange={e => setSessionFormData({...sessionFormData, description: e.target.value})} 
                      className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-70">Imagem de Capa</label>
                    <div className="space-y-3">
                      <div className="relative">
                        <input 
                          type="url" 
                          value={sessionFormData.imageUrl} 
                          onChange={e => setSessionFormData(prev => ({ ...prev, imageUrl: e.target.value }))} 
                          onBlur={e => {
                            const fixed = fixImageUrl(e.target.value);
                            if (fixed !== e.target.value) {
                              setSessionFormData(prev => ({ ...prev, imageUrl: fixed }));
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                            theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                          placeholder="Cole o link da imagem aqui..."
                        />
                        <LinkIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      </div>
                      
                      {sessionFormData.imageUrl && (
                        <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center group">
                          <img 
                            src={sessionFormData.imageUrl} 
                            alt="Preview" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button 
                              type="button"
                              onClick={() => setSessionFormData({ ...sessionFormData, imageUrl: '' })}
                              className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-transform hover:scale-110 shadow-lg"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    {editingSession && (
                      <button 
                        type="button"
                        onClick={() => {
                          setEditingSession(null);
                          setSessionFormData({ title: '', description: '', icon: '', order: sessions.length, isActive: true });
                        }}
                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                      >
                        Cancelar Edição
                      </button>
                    )}
                    <button 
                      type="submit" 
                      className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-md hover:bg-blue-700 transition-all"
                    >
                      {editingSession ? 'Atualizar' : 'Criar Tema'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Lista de Sessões */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase text-slate-500">Temas Atuais</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {sessions.map(s => (
                    <div 
                      key={s.id} 
                      className={`p-3 rounded-lg border flex items-center justify-between group ${
                        theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0 border border-slate-300 dark:border-slate-600">
                          {s.imageUrl ? (
                            <img src={s.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl">
                              {s.icon || '📁'}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{s.title}</p>
                          <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{s.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenSessionModal(s)}
                          className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => s.id && setSessionToDelete(s.id)}
                          className="p-1.5 text-red-500 hover:bg-red-500/10 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={contentToDelete !== null}
        title="Excluir Conteúdo"
        message="Tem certeza que deseja excluir este conteúdo do Playbook? Esta ação não pode ser desfeita."
        onConfirm={() => contentToDelete && handleDelete(contentToDelete)}
        onCancel={() => setContentToDelete(null)}
        type="danger"
      />

      <ConfirmModal
        isOpen={sessionToDelete !== null}
        title="Excluir Tema"
        message="Tem certeza que deseja excluir este tema? Os conteúdos vinculados a ele não serão excluídos, mas ficarão sem categoria."
        onConfirm={() => sessionToDelete && handleDeleteSession(sessionToDelete)}
        onCancel={() => setSessionToDelete(null)}
        type="danger"
      />
    </div>
  );
}
