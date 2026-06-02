import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Country } from '../../types';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { Plus, Edit2, Trash2, Globe, Search, Filter, AlertCircle } from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { toast } from 'sonner';

export default function Countries() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [countryToDelete, setCountryToDelete] = useState<string | null>(null);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [formData, setFormData] = useState({ name: '', code: '', welcomeVideoUrl: '', isActive: true });

  useEffect(() => { fetchCountries(); }, []);

  const fetchCountries = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'countries'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Country[];
      setCountries(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'countries');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (country?: Country) => {
    if (country) {
      setEditingCountry(country);
      setFormData({ name: country.name, code: country.code || '', welcomeVideoUrl: country.welcomeVideoUrl || '', isActive: country.isActive });
    } else {
      setEditingCountry(null);
      setFormData({ name: '', code: '', welcomeVideoUrl: '', isActive: true });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCountry && editingCountry.id) {
        try {
          await updateDoc(doc(db, 'countries', editingCountry.id), {
            ...formData,
            updatedAt: Date.now()
          });
          toast.success('País atualizado com sucesso!');
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `countries/${editingCountry.id}`);
        }
      } else {
        try {
          await addDoc(collection(db, 'countries'), {
            ...formData,
            createdAt: Date.now()
          });
          toast.success('País criado com sucesso!');
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'countries');
        }
      }
      setIsModalOpen(false);
      fetchCountries();
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      try {
        const parsedError = JSON.parse(errorMessage);
        toast.error(`Erro: ${parsedError.error}`);
      } catch {
        toast.error('Erro ao salvar país. Verifique suas permissões.');
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'countries', id));
      toast.success('País excluído com sucesso!');
      fetchCountries();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `countries/${id}`);
      toast.error('Erro ao excluir país.');
    }
  };

  if (loading) return <div className={`p-8 text-center ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('common.loading')}</div>;

  const filteredCountries = countries.filter(country => {
    const matchesSearch = country.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (country.code && country.code.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' ? country.isActive : !country.isActive);
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className={`space-y-6 transition-colors duration-300 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Países</h1>
          <p className="text-sm text-slate-500">Gerencie os países disponíveis na plataforma.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
          <Plus className="w-4 h-4" /> {t('common.create')}
        </button>
      </div>

      {/* Filtros */}
      <div className={`p-4 rounded-xl border flex flex-wrap items-center gap-4 transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou código..."
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-3 py-2 rounded-lg text-sm outline-none border transition-all ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-white' 
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <option value="all">Todos os Status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>
      </div>

      <div className={`rounded-xl border overflow-hidden transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className={theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nome do País</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Código</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-200'}`}>
            {filteredCountries.map((country) => (
              <tr key={country.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Globe className={`w-4 h-4 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                    <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{country.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">{country.code}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${country.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {country.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleOpenModal(country)} className="text-blue-500 hover:text-blue-400 mr-4 transition-colors"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => country.id && setCountryToDelete(country.id)} className="text-red-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className={`rounded-xl shadow-xl max-w-md w-full p-6 my-auto ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <h2 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{editingCountry ? t('common.edit') : t('common.create')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Nome</label>
                <input 
                  type="text" 
                  required 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Código (ex: BR, CO)</label>
                <input 
                  type="text" 
                  value={formData.code} 
                  onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} 
                  className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  maxLength={5}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Link do Vídeo de Boas Vindas (YouTube/Vimeo)</label>
                <input 
                  type="url" 
                  value={formData.welcomeVideoUrl} 
                  onChange={e => setFormData({...formData, welcomeVideoUrl: e.target.value})} 
                  placeholder="https://www.youtube.com/watch?v=..."
                  className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Nota: Este vídeo só será exibido para colaboradores cujo "Modo Onboarding" estiver ativado.
                </p>
              </div>
              <div className="flex items-center">
                <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <label className={`ml-2 block text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>País Ativo</label>
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

      <ConfirmModal
        isOpen={!!countryToDelete}
        title="Excluir País"
        message="Tem certeza que deseja excluir este país? Isso pode afetar usuários e trilhas vinculados a ele."
        onConfirm={() => countryToDelete && handleDelete(countryToDelete)}
        onCancel={() => setCountryToDelete(null)}
        confirmText="Excluir"
        type="danger"
      />
    </div>
  );
}
