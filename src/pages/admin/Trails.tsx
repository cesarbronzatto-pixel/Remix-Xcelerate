import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Trail, Area, Country } from '../../types';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { Plus, Edit2, Trash2, BookOpen, Search, Filter, Upload, Loader2, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { notificationService } from '../../services/notificationService';
import { ConfirmModal } from '../../components/ConfirmModal';

interface TrailsProps {
  isOnboardingMode?: boolean;
  hideHeader?: boolean;
}

export default function Trails({ isOnboardingMode = false, hideHeader = false }: TrailsProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isAreaSpecific, setIsAreaSpecific] = useState(false);
  const [editingTrail, setEditingTrail] = useState<Trail | null>(null);
  const [trailToDelete, setTrailToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    areaIds: [] as string[], 
    countryIds: [] as string[],
    title: '', 
    description: '', 
    order: 0, 
    isActive: true, 
    isMandatory: false, 
    isPublic: false, 
    imageUrl: '',
    deadline: '',
    isOnboardingTrail: false,
    onboardingJourney: 'standard'
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

      let countriesSnap;
      try {
        countriesSnap = await getDocs(collection(db, 'countries'));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'countries');
        return;
      }
      setCountries(countriesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Country[]);
      
      let trailsSnap;
      try {
        trailsSnap = await getDocs(collection(db, 'trails'));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'trails');
        return;
      }
      setTrails(trailsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.order - b.order) as Trail[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (trail?: Trail) => {
    if (trail) {
      setEditingTrail(trail);
      setIsAreaSpecific(trail.areaIds ? trail.areaIds.length > 0 : false);
      setFormData({ 
        areaIds: trail.areaIds || [], 
        countryIds: trail.countryIds || [],
        title: trail.title, 
        description: trail.description, 
        order: trail.order, 
        isActive: trail.isActive,
        isMandatory: trail.isMandatory || false,
        isPublic: true,
        imageUrl: trail.imageUrl || '',
        deadline: trail.deadline || '',
        isOnboardingTrail: isOnboardingMode ? true : (trail.isOnboardingTrail || false),
        onboardingJourney: trail.onboardingJourney || 'standard'
      });
    } else {
      setEditingTrail(null);
      setIsAreaSpecific(false);
      setFormData({ 
        areaIds: [], 
        countryIds: [],
        title: '', 
        description: '', 
        order: trails.length, 
        isActive: true,
        isMandatory: false,
        isPublic: true,
        imageUrl: '',
        deadline: '',
        isOnboardingTrail: isOnboardingMode,
        onboardingJourney: 'standard'
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTrail && editingTrail.id) {
        try {
          await updateDoc(doc(db, 'trails', editingTrail.id), formData);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `trails/${editingTrail.id}`);
        }
      } else {
        let docRef;
        try {
          docRef = await addDoc(collection(db, 'trails'), formData);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'trails');
          return;
        }
        if (formData.isActive) {
          await notificationService.notifyAllUsers(
            'Nova Trilha Disponível',
            `A trilha "${formData.title}" foi adicionada aos treinamentos.`,
            'new_trail',
            `/trail/${docRef.id}`
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
      await deleteDoc(doc(db, 'trails', id));
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `trails/${id}`);
    }
  };

  if (loading) return <div className={`p-8 text-center ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('common.loading')}</div>;

  const filteredTrails = trails.filter(trail => {
    const matchesSearch = trail.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         trail.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArea = areaFilter === 'all' || (trail.areaIds && trail.areaIds.includes(areaFilter));
    const matchesCountry = countryFilter === 'all' || 
                          (trail.countryIds && trail.countryIds.length > 0 ? trail.countryIds.includes(countryFilter) : true);
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' ? trail.isActive : !trail.isActive);
    const matchesOnboardingMode = isOnboardingMode ? trail.isOnboardingTrail : !trail.isOnboardingTrail;
    
    return matchesSearch && matchesArea && matchesCountry && matchesStatus && matchesOnboardingMode;
  });

  return (
    <div className={`space-y-6 transition-colors duration-300 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
      {!hideHeader && (
        <div className="flex justify-between items-center">
          <div>
            <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {isOnboardingMode ? t('admin.onboardingTrails') : t('admin.trails')}
            </h1>
            <p className="text-sm text-slate-500">
              {isOnboardingMode 
                ? t('admin.onboardingManagementSub') 
                : t('admin.trailsSub', "Gerencie as trilhas de aprendizagem e vincule-as às áreas.")}
            </p>
          </div>
        </div>
      )}
      
      {hideHeader && (
        <div className="flex justify-start">
           <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
             <Plus className="w-4 h-4" /> {isOnboardingMode ? t('admin.createOnboardingTrail') : t('common.create')}
           </button>
        </div>
      )}

      {(!hideHeader) && (
        <div className="flex justify-end -mt-16">
          <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
            <Plus className="w-4 h-4" /> {isOnboardingMode ? t('admin.createOnboardingTrail') : t('common.create')}
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
            onChange={(e) => setAreaFilter(e.target.value)}
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
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className={`px-3 py-2 rounded-lg text-sm outline-none border transition-all ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-white' 
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <option value="all">{t('admin.allCountries')}</option>
            {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

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
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('admin.displayOrder')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('common.title', 'Título')}</th>
              {isOnboardingMode && <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('admin.onboardingJourney', 'Jornada')}</th>}
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('admin.areas')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('admin.countries')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('admin.status')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('admin.deadline')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('admin.mandatory')}</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-200'}`}>
            {filteredTrails.map((trail) => (
              <tr key={trail.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-500">{trail.order}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <BookOpen className={`w-4 h-4 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                    <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{trail.title}</span>
                  </div>
                </td>
                {isOnboardingMode && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-[10px] font-bold uppercase">
                      {trail.onboardingJourney === 'eir' ? t('admin.journeyEir', 'EIR (Líderes do Futuro)') : t('admin.journeyStandard', 'Padrão')}
                    </span>
                  </td>
                )}
                <td className="px-6 py-4 text-sm text-slate-500">
                  <div className="flex flex-wrap gap-1">
                    {trail.areaIds && trail.areaIds.length > 0 ? (
                      trail.areaIds.map(id => {
                        const area = areas.find(a => a.id === id);
                        return area ? (
                          <span key={id} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-medium">
                            {area.name}
                          </span>
                        ) : null;
                      })
                    ) : (
                      <span className="text-red-400 italic">{t('admin.noAreaLinked')}</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  <div className="flex flex-wrap gap-1">
                    {trail.countryIds && trail.countryIds.length > 0 ? (
                      trail.countryIds.map(id => {
                        const country = countries.find(c => c.id === id);
                        return country ? (
                          <span key={id} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-[10px] font-medium">
                            {country.name}
                          </span>
                        ) : null;
                      })
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-medium">
                        Todos
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${trail.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {trail.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {trail.deadline ? new Date(trail.deadline).toLocaleDateString() : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${trail.isMandatory ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                    {trail.isMandatory ? t('admin.yes') : t('admin.no')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleOpenModal(trail)} className="text-blue-500 hover:text-blue-400 mr-4 transition-colors"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => trail.id && setTrailToDelete(trail.id)} className="text-red-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className={`rounded-xl shadow-2xl max-w-md w-full p-6 my-auto animate-in zoom-in-95 duration-200 ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <h2 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{editingTrail ? t('common.edit') : (isOnboardingMode ? t('admin.newOnboardingTrail') : t('common.create'))}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-bold mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('admin.countries')}</label>
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
                      <span className={`text-xs transition-colors ${theme === 'dark' ? 'text-slate-400 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-900'}`}>
                        {country.name}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{t('admin.countryTrailSelectDesc')}</p>
              </div>
              
              <div>
                <label className={`block text-sm font-bold mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isOnboardingMode ? t('admin.onboardingTarget') : t('admin.areas')}
                </label>
                
                {isOnboardingMode && (
                  <>
                    <h4 className={`text-xs font-bold uppercase mb-2 mt-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t('admin.onboardingJourney', 'Jornada de Onboarding')}
                    </h4>
                    <div className="flex gap-4 mb-4">
                      <label className={`flex items-center gap-2 cursor-pointer ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                        <input 
                          type="radio" 
                          name="onboardingJourney"
                          checked={formData.onboardingJourney === 'standard' || !formData.onboardingJourney}
                          onChange={() => setFormData({...formData, onboardingJourney: 'standard'})}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm">{t('admin.journeyStandard', 'Padrão')}</span>
                      </label>
                      <label className={`flex items-center gap-2 cursor-pointer ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                        <input 
                          type="radio" 
                          name="onboardingJourney"
                          checked={formData.onboardingJourney === 'eir'}
                          onChange={() => setFormData({...formData, onboardingJourney: 'eir'})}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm">{t('admin.journeyEir', 'EIR (Líderes do Futuro)')}</span>
                      </label>
                    </div>

                    <h4 className={`text-xs font-bold uppercase mb-2 mt-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t('admin.onboardingTargetArea', 'Público Alvo (Área)')}
                    </h4>
                    <div className="flex gap-4 mb-4">
                      <label className={`flex items-center gap-2 cursor-pointer ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                        <input 
                          type="radio" 
                          name="onboardingType"
                          checked={!isAreaSpecific}
                          onChange={() => {
                            setIsAreaSpecific(false);
                            setFormData({...formData, areaIds: []});
                          }}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm">{t('admin.generalAllAreas')}</span>
                      </label>
                      <label className={`flex items-center gap-2 cursor-pointer ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                        <input 
                          type="radio" 
                          name="onboardingType"
                          checked={isAreaSpecific}
                          onChange={() => {
                            setIsAreaSpecific(true);
                            if(formData.areaIds.length === 0 && areas.length > 0) {
                              setFormData({...formData, areaIds: [areas[0].id!]});
                            }
                          }}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm">{t('admin.specificByArea')}</span>
                      </label>
                    </div>
                  </>
                )}
                
                {(!isOnboardingMode || isAreaSpecific) && (
                  <div className={`grid grid-cols-2 gap-2 p-3 rounded-md border max-h-40 overflow-y-auto ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}>
                    {areas
                      .filter(area => {
                        // Se não houver países selecionados, mostra todas as áreas
                        if (!formData.countryIds || formData.countryIds.length === 0) return true;
                        // Se a área não tem restrição de país, mostra
                        if (!area.countryIds || area.countryIds.length === 0) return true;
                        // Se a área atende a pelo menos um dos países selecionados
                        return area.countryIds.some(cid => formData.countryIds.includes(cid));
                      })
                      .map(area => (
                      <label key={area.id} className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox"
                          checked={formData.areaIds.includes(area.id!)}
                          onChange={(e) => {
                            const newAreaIds = e.target.checked 
                              ? [...formData.areaIds, area.id!]
                              : formData.areaIds.filter(id => id !== area.id);
                            setFormData({ ...formData, areaIds: newAreaIds });
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className={`text-xs transition-colors ${theme === 'dark' ? 'text-slate-400 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-900'}`}>
                          {area.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                
                {(!isOnboardingMode || isAreaSpecific) && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    {isOnboardingMode 
                      ? t('admin.onboardingAreaDesc')
                      : t('admin.areaSelectDesc')}
                  </p>
                )}
              </div>
              <div>
                <label className={`block text-sm font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('common.title', 'Título')}</label>
                <input 
                  type="text" 
                  required 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-sm font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('admin.description')}</label>
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
                <label className={`block text-sm font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Imagem de Capa</label>
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
                      className={`w-full pl-3 pr-10 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                      placeholder="Cole o link da imagem aqui..."
                    />
                    <LinkIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
                          <Trash2 className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className={`block text-sm font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('admin.deadline')}</label>
                <input 
                  type="date" 
                  value={formData.deadline} 
                  onChange={e => setFormData({...formData, deadline: e.target.value})} 
                  className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-sm font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('admin.displayOrder')}</label>
                <input 
                  type="number" 
                  required 
                  value={formData.order} 
                  onChange={e => setFormData({...formData, order: Number(e.target.value)})} 
                  className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex items-center">
                  <input 
                    type="checkbox" 
                    checked={formData.isActive} 
                    onChange={e => setFormData({...formData, isActive: e.target.checked})} 
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                  />
                  <label className={`ml-2 block text-sm font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Trilha Ativa</label>
                </div>
                <div className="flex items-center">
                  <input 
                    type="checkbox" 
                    checked={formData.isMandatory} 
                    onChange={e => setFormData({...formData, isMandatory: e.target.checked})} 
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                  />
                  <label className={`ml-2 block text-sm font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('admin.mandatoryForAll')}</label>
                </div>
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
        isOpen={!!trailToDelete}
        title={t('admin.deleteTrail')}
        message={t('admin.deleteTrailMsg')}
        onConfirm={() => trailToDelete && handleDelete(trailToDelete)}
        onCancel={() => setTrailToDelete(null)}
        confirmText="Excluir"
        type="danger"
      />
    </div>
  );
}
