import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Project, Trail, UserProfile } from '../../types';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { Plus, Edit2, Trash2, Briefcase, Search, X, Check, Users, BookOpen } from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { toast } from 'sonner';

export default function Projects() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [trails, setTrails] = useState<Trail[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trailIds: [] as string[],
    isActive: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projectsSnap, trailsSnap] = await Promise.all([
        getDocs(collection(db, 'projects')),
        getDocs(query(collection(db, 'trails'), where('isActive', '==', true)))
      ]);

      setProjects(projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[]);
      setTrails(trailsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Trail[]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name,
        description: project.description || '',
        trailIds: project.trailIds || [],
        isActive: project.isActive
      });
    } else {
      setEditingProject(null);
      setFormData({
        name: '',
        description: '',
        trailIds: [],
        isActive: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        createdAt: editingProject?.createdAt || Date.now()
      };

      if (editingProject?.id) {
        await updateDoc(doc(db, 'projects', editingProject.id), data);
        toast.success("Projeto atualizado com sucesso");
      } else {
        await addDoc(collection(db, 'projects'), data);
        toast.success("Projeto criado com sucesso");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      handleFirestoreError(error, editingProject ? OperationType.UPDATE : OperationType.CREATE, 'projects');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'projects', id));
      toast.success("Projeto excluído com sucesso");
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${id}`);
    } finally {
      setProjectToDelete(null);
    }
  };

  const toggleTrail = (id: string) => {
    setFormData(prev => ({
      ...prev,
      trailIds: prev.trailIds.includes(id) 
        ? prev.trailIds.filter(tId => tId !== id)
        : [...prev.trailIds, id]
    }));
  };

  if (loading) return <div className="p-8 text-center">Carregando...</div>;

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Projetos</h1>
          <p className="text-sm text-slate-500">Crie projetos e vincule trilhas obrigatórias para usuários específicos.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all">
          <Plus className="w-4 h-4" /> Novo Projeto
        </button>
      </div>

      <div className={`p-4 rounded-xl border flex items-center gap-4 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar projetos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm outline-none border ${
              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
            }`}
          />
        </div>
      </div>

      <div className={`rounded-xl border overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className={theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Projeto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Trilhas</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Usuários</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredProjects.map((project) => (
              <tr key={project.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold">{project.name}</p>
                      <p className="text-xs text-slate-500 line-clamp-1">{project.description}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-medium">{project.trailIds?.length || 0} trilhas</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                    project.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {project.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleOpenModal(project)} className="text-blue-500 hover:text-blue-600 mr-3">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => project.id && setProjectToDelete(project.id)} className="text-red-500 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold">{editingProject ? 'Editar Projeto' : 'Novo Projeto'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Nome do Projeto</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                    }`}
                    placeholder="Ex: TJMG, Onboarding 2024..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Descrição</label>
                  <textarea 
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                    className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                    }`}
                    rows={3}
                    placeholder="Descreva o objetivo deste projeto..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="isActive"
                    checked={formData.isActive} 
                    onChange={e => setFormData({...formData, isActive: e.target.checked})} 
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium">Projeto Ativo</label>
                </div>

                <div className="border rounded-xl p-4 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-blue-500" /> Trilhas Vinculadas
                    </h3>
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {formData.trailIds.length} selecionadas
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                    {trails.map(trail => (
                      <button
                        key={trail.id}
                        type="button"
                        onClick={() => trail.id && toggleTrail(trail.id)}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-all border ${
                          formData.trailIds.includes(trail.id!)
                            ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
                            : 'bg-slate-50 border-slate-100 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                        }`}
                      >
                        <span className="font-medium truncate">{trail.title}</span>
                        {formData.trailIds.includes(trail.id!) && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSubmit}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
              >
                Salvar Projeto
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!projectToDelete}
        title="Excluir Projeto"
        message="Tem certeza que deseja excluir este projeto? Os usuários vinculados não terão mais as trilhas deste projeto como obrigatórias."
        onConfirm={() => projectToDelete && handleDelete(projectToDelete)}
        onCancel={() => setProjectToDelete(null)}
        confirmText="Excluir"
        type="danger"
      />
    </div>
  );
}
