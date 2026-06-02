import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Area, Country } from '../../types';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { Plus, Edit2, Trash2, Layout, Search, Filter, AlertCircle, Globe } from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';

export default function Areas() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [areas, setAreas] = useState<Area[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [areaToDelete, setAreaToDelete] = useState<string | null>(null);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [formData, setFormData] = useState<{name: string, description: string, isActive: boolean, countryIds: string[]}>({ name: '', description: '', isActive: true, countryIds: [] });

  useEffect(() => { 
    fetchAreas(); 
    fetchCountries();
  }, []);

  const fetchCountries = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'countries'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Country[];
      setCountries(data.filter(c => c.isActive));
    } catch (error) {
      console.error(error);
    }
  };

  const fetchAreas = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'areas'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Area[];
      setAreas(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'areas');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (area?: Area) => {
    if (area) {
      setEditingArea(area);
      setFormData({ name: area.name, description: area.description, isActive: area.isActive, countryIds: area.countryIds || [] });
    } else {
      setEditingArea(null);
      setFormData({ name: '', description: '', isActive: true, countryIds: [] });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingArea && editingArea.id) {
        try {
          await updateDoc(doc(db, 'areas', editingArea.id), formData);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `areas/${editingArea.id}`);
        }
      } else {
        try {
          await addDoc(collection(db, 'areas'), formData);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'areas');
        }
      }
      setIsModalOpen(false);
      fetchAreas();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'areas', id));
      fetchAreas();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `areas/${id}`);
    }
  };

  if (loading) return <div className={`p-8 text-center ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('common.loading')}</div>;

  const filteredAreas = areas.filter(area => {
    const matchesSearch = area.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         area.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' ? area.isActive : !area.isActive);
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className={`space-y-6 transition-colors duration-300 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.areas')}</h1>
          <p className="text-sm text-slate-500">{t('admin.manageDepartments')}</p>
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
            placeholder={t('admin.searchNameDesc')}
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
            <option value="all">{t('admin.allStatuses')}</option>
            <option value="active">{t('admin.active')}</option>
            <option value="inactive">{t('admin.inactive')}</option>
          </select>
        </div>
      </div>

      <div className={`rounded-xl border overflow-hidden transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className={theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('admin.areaName')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('admin.description')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('admin.status')}</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-200'}`}>
            {filteredAreas.map((area) => (
              <tr key={area.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Layout className={`w-4 h-4 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                    <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{area.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">{area.description}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${area.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {area.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleOpenModal(area)} className="text-blue-500 hover:text-blue-400 mr-4 transition-colors"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => area.id && setAreaToDelete(area.id)} className="text-red-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className={`rounded-xl shadow-xl max-w-md w-full p-6 my-auto ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <h2 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{editingArea ? t('common.edit') : t('common.create')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('common.name')}</label>
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
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('admin.description')}</label>
                <textarea 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  rows={3} 
                />
              </div>

              <div>
                <label className={`block text-sm font-bold mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('admin.activeCountriesOpt')}</label>
                <div className={`grid grid-cols-2 gap-2 p-3 rounded-md border max-h-40 overflow-y-auto ${
                  theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}>
                  {countries.map(country => (
                    <label key={country.id} className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox"
                        checked={formData.countryIds.includes(country.id!)}
                        onChange={(e) => {
                          const newCountryIds = e.target.checked 
                            ? [...formData.countryIds, country.id!]
                            : formData.countryIds.filter(id => id !== country.id);
                          setFormData({ ...formData, countryIds: newCountryIds });
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className={`text-xs transition-colors flex items-center gap-1 ${theme === 'dark' ? 'text-slate-400 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-900'}`}>
                        <Globe className="w-3 h-3" />
                        {country.name}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{t('admin.countryAreaSelectDesc')}</p>
              </div>

              <div className="flex items-center">
                <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <label className={`ml-2 block text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('admin.activeArea')}</label>
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
        isOpen={!!areaToDelete}
        title={t('admin.deleteArea')}
        message={t('admin.deleteAreaMsg')}
        onConfirm={() => areaToDelete && handleDelete(areaToDelete)}
        onCancel={() => setAreaToDelete(null)}
        confirmText="Excluir"
        type="danger"
      />
    </div>
  );
}
