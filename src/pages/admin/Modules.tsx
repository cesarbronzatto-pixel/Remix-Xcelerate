import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { Module, Trail, Area, Project } from '../../types';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { Plus, Edit2, Trash2, Video, FileText, Search, Filter, X, Link as LinkIcon, Loader2, UploadCloud, CheckCircle, HelpCircle } from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { notificationService } from '../../services/notificationService';
import { getEmbedUrl } from '../../utils/videoUtils';
import { toast } from 'sonner';

interface ModulesProps {
  isOnboardingMode?: boolean;
  hideHeader?: boolean;
}

export default function Modules({ isOnboardingMode = false, hideHeader = false }: ModulesProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [modules, setModules] = useState<Module[]>([]);
  const [trails, setTrails] = useState<Trail[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal Area Filter
  const [selectedAreaId, setSelectedAreaId] = useState<string>('all');
  
  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [trailFilter, setTrailFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [moduleToDelete, setModuleToDelete] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Module>({
    trailId: '', 
    projectId: '', 
    title: '', 
    description: '', 
    type: 'video',
    videoEmbedUrl: '', 
    videoUrl: '',
    documentUrl: '',
    documentType: 'pdf',
    activityConfig: {
      instructions: '',
      requiredFileType: '',
      maxFileSizeMB: 10
    },
    materials: [], 
    order: 0, 
    quizConfig: { passingScore: 70, isRequired: true }, 
    questions: [],
    imageUrl: '',
    duration: 0
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      let areasSnap;
      try {
        areasSnap = await getDocs(collection(db, 'areas'));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'areas');
        return;
      }
      setAreas(areasSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Area[]);

      let trailsSnap;
      try {
        trailsSnap = await getDocs(collection(db, 'trails'));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'trails');
        return;
      }
      setTrails(trailsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Trail[]);
      
      let projectsSnap;
      try {
        projectsSnap = await getDocs(collection(db, 'projects'));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'projects');
        return;
      }
      setProjects(projectsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Project[]);

      let modulesSnap;
      try {
        modulesSnap = await getDocs(collection(db, 'modules'));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'modules');
        return;
      }
      setModules(modulesSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.order - b.order) as Module[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (module?: Module) => {
    if (module) {
      setEditingModule(module);
      setFormData({
        ...module,
        type: module.type || 'video',
        trailId: module.trailId || '',
        projectId: module.projectId || '',
        imageUrl: module.imageUrl || '',
        videoUrl: module.videoUrl || '',
        documentUrl: module.documentUrl || '',
        documentType: module.documentType || 'pdf',
        activityConfig: module.activityConfig || {
          instructions: '',
          requiredFileType: '',
          maxFileSizeMB: 10
        }
      });
      
      // Find area for this trail
      const trail = trails.find(t => t.id === module.trailId);
      if (trail && trail.areaIds && trail.areaIds.length > 0) {
        setSelectedAreaId(trail.areaIds[0]);
      } else {
        setSelectedAreaId('all');
      }
    } else {
      setEditingModule(null);
      setSelectedAreaId('all');
      setFormData({
        trailId: '', 
        projectId: '', 
        title: '', 
        description: '', 
        type: 'video',
        videoEmbedUrl: '', 
        videoUrl: '', 
        documentUrl: '',
        documentType: 'pdf',
        activityConfig: {
          instructions: '',
          requiredFileType: '',
          maxFileSizeMB: 10
        },
        materials: [], 
        order: modules.length,
        quizConfig: { passingScore: 70, isRequired: true }, 
        questions: [],
        imageUrl: ''
      });
    }
    setIsModalOpen(true);
  };

  const fixImageUrl = (url: string) => {
    if (!url) return url;
    if (url.includes('imgur.com/') && !url.includes('i.imgur.com/') && !url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      const id = url.split('/').pop()?.split('?')[0];
      if (id) return `https://i.imgur.com/${id}.png`;
    }
    return url;
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit to 500MB for better support of high-quality videos
    const MAX_SIZE = 500 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert('O vídeo é muito grande (máximo 500MB). Recomendamos comprimir o vídeo antes do upload para garantir uma melhor experiência para os alunos.');
      return;
    }

    setIsVideoUploading(true);
    setVideoUploadProgress(0);
    
    try {
      const storageRef = ref(storage, `videos/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setVideoUploadProgress(progress);
        }, 
        (error) => {
          console.error('Video upload error:', error);
          setIsVideoUploading(false);
          alert(`Erro no upload do vídeo: ${error.message}`);
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setFormData(prev => ({ ...prev, videoUrl: downloadURL, videoEmbedUrl: '' }));
          setIsVideoUploading(false);
          setVideoUploadProgress(100);
          toast.success('Vídeo carregado e processado com sucesso!');
        }
      );
    } catch (error: any) {
      console.error('Video upload error:', error);
      setIsVideoUploading(false);
      alert(`Erro no upload do vídeo: ${error.message}`);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_SIZE) {
      alert('O arquivo é muito grande (máximo 50MB).');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    console.log('Starting document upload:', file.name);
    
    try {
      const storageRef = ref(storage, `documents/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(progress);
        }, 
        (error) => {
          console.error('Document upload error:', error);
          setIsUploading(false);
          toast.error(`Erro no upload do documento: ${error.message}`);
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setFormData(prev => ({ ...prev, documentUrl: downloadURL }));
          setIsUploading(false);
          setUploadProgress(100);
          toast.success('Documento carregado com sucesso!');
        }
      );
    } catch (error: any) {
      console.error('Document upload error:', error);
      setIsUploading(false);
      toast.error(`Erro no upload do documento: ${error.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const normalizedData = {
        ...formData,
        videoEmbedUrl: getEmbedUrl(formData.videoEmbedUrl)
      };

      if (editingModule && editingModule.id) {
        try {
          await updateDoc(doc(db, 'modules', editingModule.id), normalizedData as any);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `modules/${editingModule.id}`);
        }
      } else {
        try {
          await addDoc(collection(db, 'modules'), normalizedData);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'modules');
        }
        if (formData.trailId) {
          const trail = trails.find(t => t.id === formData.trailId);
          await notificationService.notifyAllUsers(
            'Novo Módulo Adicionado',
            `O módulo "${formData.title}" foi adicionado à trilha ${trail?.title || ''}.`,
            'new_module',
            `/trail/${formData.trailId}`
          );
        } else if (formData.projectId) {
          const project = projects.find(p => p.id === formData.projectId);
          await notificationService.notifyAllUsers(
            'Novo Módulo Adicionado',
            `O módulo "${formData.title}" foi adicionado ao projeto ${project?.name || ''}.`,
            'new_module',
            `/dashboard`
          );
        }
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'modules', id));
      fetchData();
      setModuleToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `modules/${id}`);
    }
  };

  if (loading) return <div className={`p-8 text-center ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('common.loading')}</div>;

  const filteredModules = modules.filter(mod => {
    const matchesSearch = mod.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         mod.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTrail = trailFilter === 'all' || mod.trailId === trailFilter;
    const matchesProject = projectFilter === 'all' || mod.projectId === projectFilter;
    
    // Check if trail belongs to filtered area
    const trail = trails.find(t => t.id === mod.trailId);
    if (isOnboardingMode && (!trail || !trail.isOnboardingTrail)) return false;
    if (!isOnboardingMode && trail && trail.isOnboardingTrail) return false;
    
    const matchesArea = areaFilter === 'all' || (trail && trail.areaIds && trail.areaIds.includes(areaFilter));
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'required' ? mod.quizConfig.isRequired : !mod.quizConfig.isRequired);
    
    return matchesSearch && matchesTrail && matchesProject && matchesArea && matchesStatus;
  });

  return (
    <div className={`space-y-6 transition-colors duration-300 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
      {!hideHeader && (
        <div className="flex justify-between items-center">
          <div>
            <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {isOnboardingMode ? t('admin.onboardingModules') : t('admin.modules')}
            </h1>
            <p className="text-sm text-slate-500">
              {isOnboardingMode ? t('admin.onboardingManagementSub') : t('admin.modulesSub', 'Gerencie os conteúdos das trilhas e configure as travas de progresso.')}
            </p>
          </div>
        </div>
      )}

      {hideHeader && (
        <div className="flex justify-start">
           <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
             <Plus className="w-4 h-4" /> {t('common.create')}
           </button>
        </div>
      )}

      {(!hideHeader) && (
        <div className="flex justify-end -mt-16">
          <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
            <Plus className="w-4 h-4" /> {t('common.create')}
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className={`p-4 rounded-xl border flex flex-wrap items-center gap-4 transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder={t('admin.searchTitleDesc')}
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
            value={areaFilter}
            onChange={(e) => {
              setAreaFilter(e.target.value);
              setTrailFilter('all');
            }}
            className={`px-3 py-2 rounded-lg text-sm outline-none border transition-all ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-white' 
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <option value="all">{t('admin.allAreas')}</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          <select 
            value={trailFilter}
            onChange={(e) => setTrailFilter(e.target.value)}
            className={`px-3 py-2 rounded-lg text-sm outline-none border transition-all ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-white' 
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <option value="all">{t('admin.allTrails')}</option>
            {trails
              .filter(t => areaFilter === 'all' || (t.areaIds && t.areaIds.includes(areaFilter)))
              .filter(t => isOnboardingMode ? t.isOnboardingTrail : !t.isOnboardingTrail)
              .map(t => <option key={t.id} value={t.id}>{t.title}</option>)
            }
          </select>

          {!isOnboardingMode && (
            <select 
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className={`px-3 py-2 rounded-lg text-sm outline-none border transition-all ${
                theme === 'dark' 
                  ? 'bg-slate-800 border-slate-700 text-white' 
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              <option value="all">{t('admin.allProjects')}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}

          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-3 py-2 rounded-lg text-sm outline-none border transition-all ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-white' 
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <option value="all">{t('admin.allTypes')}</option>
            <option value="required">{t('admin.withRequiredQuiz')}</option>
            <option value="optional">{t('admin.withoutRequiredQuiz')}</option>
          </select>
        </div>
      </div>

      <div className={`rounded-xl border overflow-hidden transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className={theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('admin.displayOrder')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('admin.module')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('admin.trailProject')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('admin.quizCutoff')}</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-200'}`}>
            {filteredModules.map((mod) => (
              <tr key={mod.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-500">{mod.order}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {mod.type === 'video' || !mod.type ? (
                      <Video className={`w-4 h-4 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                    ) : mod.type === 'document' ? (
                      <FileText className={`w-4 h-4 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} />
                    ) : mod.type === 'activity' ? (
                      <UploadCloud className={`w-4 h-4 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
                    ) : (
                      <HelpCircle className={`w-4 h-4 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`} />
                    )}
                    <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{mod.title}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  <div className="flex flex-col">
                    {mod.trailId && (
                      <span className="font-medium text-blue-500">
                        Trilha: {trails.find(t => t.id === mod.trailId)?.title || t('admin.trailNotFound')}
                      </span>
                    )}
                    {mod.projectId && (
                      <span className="font-medium text-emerald-500">
                        Projeto: {projects.find(p => p.id === mod.projectId)?.name || t('admin.projectNotFound')}
                      </span>
                    )}
                    {!mod.trailId && !mod.projectId && t('admin.notLinked')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${mod.quizConfig.isRequired ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                    {mod.quizConfig.isRequired ? `${t('admin.required')} (${mod.quizConfig.passingScore}%)` : t('admin.optional')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleOpenModal(mod)} className="text-blue-500 hover:text-blue-400 mr-4 transition-colors"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => mod.id && setModuleToDelete(mod.id)} className="text-red-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{editingModule ? t('admin.editModule') : t('admin.createNewModule')}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {/* Seletor de Tipo de Módulo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { id: 'video', label: 'Vídeo', icon: Video, color: 'blue' },
                  { id: 'document', label: 'Documento', icon: FileText, color: 'emerald' },
                  { id: 'activity', label: 'Atividade', icon: UploadCloud, color: 'purple' },
                  { id: 'quiz', label: 'Apenas Quiz', icon: HelpCircle, color: 'amber' }
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: type.id as any })}
                    className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      formData.type === type.id
                        ? `border-${type.color}-500 bg-${type.color}-500/10`
                        : theme === 'dark' ? 'border-slate-800 bg-slate-800/50 hover:border-slate-700' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                    }`}
                  >
                    <type.icon className={`w-6 h-6 ${formData.type === type.id ? `text-${type.color}-500` : 'text-slate-500'}`} />
                    <span className={`text-xs font-bold uppercase ${formData.type === type.id ? `text-${type.color}-500` : 'text-slate-500'}`}>
                      {type.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Grid de Informações Principais */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-blue-500 uppercase tracking-wider">{t('admin.basicInfo')}</h3>
                  
                  <div>
                    <label className={`block text-xs font-bold mb-1 uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{t('admin.areas')}</label>
                    <select 
                      value={selectedAreaId} 
                      onChange={e => {
                        setSelectedAreaId(e.target.value);
                        setFormData({...formData, trailId: ''});
                      }} 
                      className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="all">{t('admin.allAreas')}</option>
                      {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className={`block text-xs font-bold mb-1 uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Trilha</label>
                    <select 
                      value={formData.trailId} 
                      onChange={e => setFormData({...formData, trailId: e.target.value})} 
                      className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">Nenhuma trilha</option>
                      {trails
                        .filter(t => selectedAreaId === 'all' || (t.areaIds && t.areaIds.includes(selectedAreaId)))
                        .filter(t => isOnboardingMode ? t.isOnboardingTrail : !t.isOnboardingTrail)
                        .map(t => <option key={t.id} value={t.id}>{t.title}</option>)
                      }
                    </select>
                  </div>

                  {!isOnboardingMode && (
                    <div>
                      <label className={`block text-xs font-bold mb-1 uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Projeto</label>
                      <select 
                        value={formData.projectId} 
                        onChange={e => setFormData({...formData, projectId: e.target.value})} 
                        className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                          theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      >
                        <option value="">Nenhum projeto</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className={`block text-xs font-bold mb-1 uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{t('admin.moduleTitle')}</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.title} 
                      onChange={e => setFormData({...formData, title: e.target.value})} 
                      className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-bold mb-1 uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Ordem</label>
                      <input 
                        type="number" 
                        required 
                        value={formData.order} 
                        onChange={e => setFormData({...formData, order: Number(e.target.value)})} 
                        className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                          theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-bold mb-1 uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{t('admin.description')}</label>
                    <textarea 
                      value={formData.description} 
                      onChange={e => setFormData({...formData, description: e.target.value})} 
                      className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                      rows={4} 
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-blue-500 uppercase tracking-wider">
                    {formData.type === 'video' ? t('admin.videoMedia') : 
                     formData.type === 'document' ? t('admin.documentFile') : 
                     formData.type === 'activity' ? t('admin.activityConfig') : t('admin.moduleCover')}
                  </h3>
                  
                  {formData.type === 'video' && (
                    <>
                      <div>
                        <label className={`block text-xs font-bold mb-1 uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{t('admin.platformVideo')}</label>
                        <div className="space-y-3">
                          <label className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                            theme === 'dark' ? 'border-slate-700 hover:border-blue-500 bg-slate-800/50' : 'border-slate-200 hover:border-blue-500 bg-slate-50'
                          }`}>
                            {isVideoUploading ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                                <span className="text-xs font-bold text-blue-500">{videoUploadProgress}%</span>
                              </div>
                            ) : (
                              <>
                                <Video className="w-4 h-4 text-slate-400" />
                                <span className="text-xs font-bold text-slate-500 uppercase">
                                  {formData.videoUrl ? t('admin.changeVideo') : t('admin.uploadVideo')}
                                </span>
                              </>
                            )}
                            <input type="file" className="hidden" accept="video/*" onChange={handleVideoUpload} disabled={isVideoUploading} />
                          </label>

                          {formData.videoUrl && (
                            <div className="flex items-center justify-between p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <Video className="w-4 h-4 text-blue-500 shrink-0" />
                                <span className="text-[10px] font-medium text-blue-500 truncate">{t('admin.videoSuccess')}</span>
                              </div>
                              <button 
                                type="button"
                                onClick={() => setFormData({ ...formData, videoUrl: '' })}
                                className="text-red-500 hover:text-red-400 p-1"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-center text-[10px] text-slate-500 uppercase font-bold">ou</div>

                      <div>
                        <label className={`block text-xs font-bold mb-1 uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{t('admin.externalVideo')}</label>
                        <input 
                          type="url" 
                          placeholder="Ex: https://www.youtube.com/watch?v=..." 
                          value={formData.videoEmbedUrl} 
                          onChange={e => setFormData({...formData, videoEmbedUrl: e.target.value, videoUrl: ''})} 
                          className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                            theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                        <p className="text-[10px] text-slate-500 mt-1">YouTube, Vimeo ou Google Drive.</p>
                      </div>

                      <div>
                        <label className={`block text-xs font-bold mb-1 uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{t('admin.videoDuration')}</label>
                        <input 
                          type="text" 
                          placeholder="Ex: 06:42" 
                          value={formData.duration ? `${Math.floor(formData.duration / 60).toString().padStart(2, '0')}:${(formData.duration % 60).toString().padStart(2, '0')}` : ''} 
                          onChange={e => {
                            const val = e.target.value;
                            if (val === '') {
                              setFormData({...formData, duration: 0});
                              return;
                            }
                            
                            // Handle MM:SS or MM.SS
                            if (val.includes(':') || val.includes('.')) {
                              const parts = val.split(/[:.]/);
                              const mins = parseInt(parts[0]) || 0;
                              const secs = parseInt(parts[1]) || 0;
                              setFormData({...formData, duration: (mins * 60) + secs});
                            } else {
                              // If it's just a number, treat as seconds if > 60, otherwise maybe minutes?
                              // Let's stick to: if no separator, it's seconds.
                              const secs = parseInt(val) || 0;
                              setFormData({...formData, duration: secs});
                            }
                          }} 
                          className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                            theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                        <p className="text-[10px] text-slate-500 mt-1 italic">Digite no formato Minutos:Segundos (ex: 06:42) ou apenas segundos.</p>
                      </div>
                    </>
                  )}

                  {formData.type === 'document' && (
                    <>
                      <div>
                        <label className={`block text-xs font-bold mb-1 uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Tipo de Documento</label>
                        <select 
                          value={formData.documentType} 
                          onChange={e => setFormData({...formData, documentType: e.target.value as any})} 
                          className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                            theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        >
                          <option value="pdf">PDF</option>
                          <option value="doc">Word (DOC/DOCX)</option>
                          <option value="xls">Excel (XLS/XLSX)</option>
                          <option value="ppt">PowerPoint (PPT/PPTX)</option>
                          <option value="slides">Slides (Google/Outros)</option>
                          <option value="sheets">Sheets (Google/Outros)</option>
                          <option value="image">Imagem</option>
                          <option value="link">Link Externo</option>
                        </select>
                      </div>

                      {formData.documentType === 'link' ? (
                        <div>
                          <label className={`block text-xs font-bold mb-1 uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Link do Documento</label>
                          <input 
                            type="url" 
                            placeholder="https://..." 
                            value={formData.documentUrl} 
                            onChange={e => setFormData({...formData, documentUrl: e.target.value})} 
                            className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
                        </div>
                      ) : (
                        <div>
                          <label className={`block text-xs font-bold mb-1 uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Upload do Arquivo</label>
                          <div className="space-y-3">
                            <label className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                              theme === 'dark' ? 'border-slate-700 hover:border-emerald-500 bg-slate-800/50' : 'border-slate-200 hover:border-emerald-500 bg-slate-50'
                            }`}>
                              {isUploading ? (
                                <div className="flex items-center gap-2">
                                  <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                                  <span className="text-xs font-bold text-emerald-500">{uploadProgress}%</span>
                                </div>
                              ) : (
                                <>
                                  <UploadCloud className="w-4 h-4 text-slate-400" />
                                  <span className="text-xs font-bold text-slate-500 uppercase">
                                    {formData.documentUrl ? 'Trocar Arquivo' : 'Upload de Arquivo'}
                                  </span>
                                </>
                              )}
                              <input 
                                type="file" 
                                className="hidden" 
                                onChange={handleDocumentUpload} 
                                disabled={isUploading}
                                accept={
                                  formData.documentType === 'pdf' ? '.pdf' :
                                  formData.documentType === 'doc' ? '.doc,.docx' :
                                  formData.documentType === 'xls' ? '.xls,.xlsx' :
                                  formData.documentType === 'ppt' ? '.ppt,.pptx' :
                                  formData.documentType === 'image' ? 'image/*' :
                                  '*'
                                }
                              />
                            </label>

                            {formData.documentUrl && (
                              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                                  <span className="text-[10px] font-medium text-emerald-500 truncate">Arquivo carregado com sucesso</span>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => setFormData({ ...formData, documentUrl: '' })}
                                  className="text-red-500 hover:text-red-400 p-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {formData.type === 'activity' && (
                    <div className="space-y-4">
                      <div>
                        <label className={`block text-xs font-bold mb-1 uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{t('admin.activityInstructions')}</label>
                        <textarea 
                          value={formData.activityConfig?.instructions} 
                          onChange={e => setFormData({
                            ...formData, 
                            activityConfig: { ...formData.activityConfig!, instructions: e.target.value }
                          })} 
                          className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                            theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                          rows={4}
                          placeholder="Descreva o que o colaborador deve enviar..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={`block text-xs font-bold mb-1 uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Tipo de Arquivo Aceito</label>
                          <input 
                            type="text" 
                            placeholder="Ex: .pdf, .docx, .png"
                            value={formData.activityConfig?.requiredFileType} 
                            onChange={e => setFormData({
                              ...formData, 
                              activityConfig: { ...formData.activityConfig!, requiredFileType: e.target.value }
                            })} 
                            className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
                        </div>
                        <div>
                          <label className={`block text-xs font-bold mb-1 uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{t('admin.maxSize')}</label>
                          <input 
                            type="number" 
                            value={formData.activityConfig?.maxFileSizeMB} 
                            onChange={e => setFormData({
                              ...formData, 
                              activityConfig: { ...formData.activityConfig!, maxFileSizeMB: Number(e.target.value) }
                            })} 
                            className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className={`block text-xs font-bold mb-1 uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Imagem de Capa</label>
                    <div className="space-y-3">
                      <div className="relative">
                        <input 
                          type="url" 
                          value={formData.imageUrl} 
                          onChange={e => setFormData({...formData, imageUrl: e.target.value})} 
                          onBlur={e => {
                            const fixed = fixImageUrl(e.target.value);
                            if (fixed !== e.target.value) {
                              setFormData(prev => ({ ...prev, imageUrl: fixed }));
                            }
                          }}
                          className={`w-full pl-3 pr-10 py-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                            theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                          placeholder="Cole o link da imagem aqui..."
                        />
                        <LinkIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                      </div>
                      
                      {formData.imageUrl && (
                        <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center group">
                          <img 
                            src={formData.imageUrl} 
                            alt="Preview" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button 
                              type="button"
                              onClick={() => setFormData({ ...formData, imageUrl: '' })}
                              className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-transform hover:scale-110 shadow-lg"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Materiais Complementares */}
              <div className={`pt-8 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-bold text-blue-500 uppercase tracking-wider">Materiais Complementares</h3>
                  <button 
                    type="button" 
                    onClick={() => setFormData({...formData, materials: [...formData.materials, { title: '', url: '' }]})}
                    className="flex items-center gap-2 bg-blue-600/10 text-blue-500 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition-all"
                  >
                    <Plus className="w-3 h-3" /> Adicionar Material
                  </button>
                </div>
                
                <div className="space-y-3">
                  {formData.materials.map((mat, mIndex) => (
                    <div key={mIndex} className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      <input 
                        type="text" 
                        placeholder={t('admin.materialTitle')}
                        value={mat.title} 
                        onChange={(e) => {
                          const newM = [...formData.materials];
                          newM[mIndex].title = e.target.value;
                          setFormData({...formData, materials: newM});
                        }} 
                        className={`flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                          theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      />
                      <input 
                        type="url" 
                        placeholder="URL do Material"
                        value={mat.url} 
                        onChange={(e) => {
                          const newM = [...formData.materials];
                          newM[mIndex].url = e.target.value;
                          setFormData({...formData, materials: newM});
                        }} 
                        className={`flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                          theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          const newM = formData.materials.filter((_, i) => i !== mIndex);
                          setFormData({...formData, materials: newM});
                        }}
                        className="text-red-500 hover:text-red-400 transition-colors p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {formData.materials.length === 0 && (
                    <p className={`text-sm italic text-center py-6 border-2 border-dashed rounded-xl ${
                      theme === 'dark' ? 'border-slate-800 text-slate-500' : 'border-slate-100 text-slate-400'
                    }`}>
                      Nenhum material complementar adicionado.
                    </p>
                  )}
                </div>
              </div>

              {/* Configuração do Quiz */}
              <div className={`pt-8 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-bold text-blue-500 uppercase tracking-wider">{t('admin.quizConfigTitle')}</h3>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center cursor-pointer group">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={formData.quizConfig.isRequired} 
                          onChange={e => setFormData({...formData, quizConfig: {...formData.quizConfig, isRequired: e.target.checked}})} 
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </div>
                      <span className={`ml-3 text-xs font-bold uppercase transition-colors ${formData.quizConfig.isRequired ? 'text-blue-500' : 'text-slate-500'}`}>
                        {t('admin.required')}
                      </span>
                    </label>

                    {formData.quizConfig.isRequired && (
                      <div className="flex items-center gap-3">
                        <label className={`text-xs font-bold uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Nota de Corte:</label>
                        <div className="relative">
                          <input 
                            type="number" 
                            min="0" 
                            max="100" 
                            value={formData.quizConfig.passingScore} 
                            onChange={e => setFormData({...formData, quizConfig: {...formData.quizConfig, passingScore: Number(e.target.value)}})} 
                            className={`w-20 pl-3 pr-6 py-1 border rounded-lg text-sm font-bold outline-none ${
                              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">%</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lista de Perguntas */}
                <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-6">
                    <p className={`text-xs font-bold uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                      Perguntas cadastradas: <span className="text-blue-500">{formData.questions.length}</span>
                    </p>
                    <button 
                      type="button" 
                      onClick={() => setFormData({...formData, questions: [...formData.questions, { questionText: '', options: ['', ''], correctOptionIndex: 0 }]})}
                      className="flex items-center gap-2 bg-blue-600/10 text-blue-500 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition-all"
                    >
                      <Plus className="w-3 h-3" /> Adicionar Pergunta
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    {formData.questions.map((q, qIndex) => (
                      <div key={qIndex} className={`p-5 rounded-xl border relative group animate-in fade-in slide-in-from-top-2 duration-300 ${
                        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}>
                        <button 
                          type="button"
                          onClick={() => {
                            const newQ = formData.questions.filter((_, i) => i !== qIndex);
                            setFormData({...formData, questions: newQ});
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>

                        <div className="flex items-center gap-3 mb-4">
                          <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-black">
                            {qIndex + 1}
                          </span>
                          <input 
                            type="text" 
                            placeholder="Escreva sua pergunta aqui..."
                            value={q.questionText} 
                            onChange={(e) => {
                              const newQ = [...formData.questions];
                              newQ[qIndex].questionText = e.target.value;
                              setFormData({...formData, questions: newQ});
                            }} 
                            className={`flex-1 text-sm font-bold bg-transparent border-b outline-none transition-colors ${
                              theme === 'dark' ? 'border-slate-800 text-white focus:border-blue-500' : 'border-slate-200 text-slate-900 focus:border-blue-500'
                            }`} 
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {q.options.map((opt, oIndex) => (
                            <div key={oIndex} className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${
                              q.correctOptionIndex === oIndex 
                                ? 'bg-emerald-500/10 border-emerald-500/50' 
                                : (theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100')
                            }`}>
                              <input 
                                type="radio" 
                                name={`correct-${qIndex}`} 
                                checked={q.correctOptionIndex === oIndex} 
                                onChange={() => {
                                  const newQ = [...formData.questions];
                                  newQ[qIndex].correctOptionIndex = oIndex;
                                  setFormData({...formData, questions: newQ});
                                }} 
                                className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 bg-transparent border-slate-600" 
                              />
                              <input 
                                type="text" 
                                value={opt} 
                                placeholder={`Opção ${oIndex + 1}`}
                                onChange={(e) => {
                                  const newQ = [...formData.questions];
                                  newQ[qIndex].options[oIndex] = e.target.value;
                                  setFormData({...formData, questions: newQ});
                                }} 
                                className={`flex-1 text-xs bg-transparent outline-none ${
                                  q.correctOptionIndex === oIndex ? 'text-emerald-500 font-bold' : (theme === 'dark' ? 'text-slate-300' : 'text-slate-600')
                                }`} 
                              />
                              {q.options.length > 2 && (
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const newQ = [...formData.questions];
                                    newQ[qIndex].options = newQ[qIndex].options.filter((_, i) => i !== oIndex);
                                    if (q.correctOptionIndex >= newQ[qIndex].options.length) {
                                      newQ[qIndex].correctOptionIndex = 0;
                                    }
                                    setFormData({...formData, questions: newQ});
                                  }}
                                  className="text-slate-500 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button 
                            type="button" 
                            onClick={() => {
                              const newQ = [...formData.questions];
                              newQ[qIndex].options.push('');
                              setFormData({...formData, questions: newQ});
                            }} 
                            className="flex items-center justify-center gap-2 p-2 rounded-lg border border-dashed border-slate-700 text-[10px] font-bold text-slate-500 hover:border-blue-500 hover:text-blue-500 transition-all"
                          >
                            <Plus className="w-3 h-3" /> Adicionar Alternativa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </form>

            <div className={`p-6 border-t flex justify-end gap-3 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                  theme === 'dark' ? 'text-slate-400 bg-slate-800 hover:bg-slate-700' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                }`}
              >
                {t('common.cancel')}
              </button>
              <button 
                onClick={handleSubmit}
                className="px-8 py-2.5 text-xs font-black uppercase tracking-widest text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={moduleToDelete !== null}
        title={t('admin.deleteModule')}
        message={t('admin.deleteModuleMsg')}
        onConfirm={() => moduleToDelete && handleDelete(moduleToDelete)}
        onCancel={() => setModuleToDelete(null)}
        type="danger"
      />
    </div>
  );
}
