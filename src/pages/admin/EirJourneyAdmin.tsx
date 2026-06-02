import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { Plus, X, Video, Image as ImageIcon, Link as LinkIcon, MoveUp, MoveDown, HelpCircle, Save, MousePointerClick, UploadCloud, Trash2, PlayCircle, FileText, ChevronUp, ChevronDown } from 'lucide-react';
import { db, storage } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { EirDay, EirItem } from '../../types';
import { toast } from 'sonner';
import EirJourneyPlayer from '../../components/eir/EirJourneyPlayer';
import { VideoPlayer } from '../../components/VideoPlayer';

export default function EirJourneyAdmin() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  
  const [days, setDays] = useState<EirDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal state
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<EirDay | null>(null);
  const [dayFormData, setDayFormData] = useState<Partial<EirDay>>({ dayNumber: 1, title: '' });

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{ dayId: string; item: EirItem | null }>({ dayId: '', item: null });
  const [itemFormData, setItemFormData] = useState<Partial<EirItem>>({
    type: 'image',
    title: '',
    url: ''
  });

  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [hotspotUploadings, setHotspotUploadings] = useState<{ [key: number]: number }>({});
  const [minimizedHotspots, setMinimizedHotspots] = useState<string[]>([]);

  const handleHotspotImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máximo 50MB).');
      return;
    }

    setHotspotUploadings(prev => ({ ...prev, [index]: 0 }));
    
    try {
      const storageRef = ref(storage, `eir_hotspots/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setHotspotUploadings(prev => ({ ...prev, [index]: progress }));
        },
        (error) => {
          console.error('Upload error:', error);
          setHotspotUploadings(prev => { const n = {...prev}; delete n[index]; return n; });
          toast.error(`Erro no upload: ${error.message}`);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const newHp = [...(itemFormData.hotspots || [])];
          newHp[index].imageUrl = downloadURL;
          setItemFormData(prev => ({ ...prev, hotspots: newHp }));
          setHotspotUploadings(prev => { const n = {...prev}; delete n[index]; return n; });
          toast.success('Upload concluído!');
        }
      );
    } catch (error: any) {
      console.error('Upload error:', error);
      setHotspotUploadings(prev => { const n = {...prev}; delete n[index]; return n; });
      toast.error(`Erro no upload: ${error.message}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 500 * 1024 * 1024; // 500MB
    if (file.size > MAX_SIZE) {
      alert('Arquivo muito grande (máximo 500MB).');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const storageRef = ref(storage, `eir/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          setIsUploading(false);
          toast.error(`Erro no upload: ${error.message}`);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setItemFormData(prev => ({ ...prev, url: downloadURL }));
          setIsUploading(false);
          setUploadProgress(100);
          toast.success('Upload concluído!');
        }
      );
    } catch (error: any) {
      console.error('Upload error:', error);
      setIsUploading(false);
      toast.error(`Erro no upload: ${error.message}`);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'eirDays'), (snapshot) => {
      let fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EirDay[];
      fetched.sort((a, b) => a.dayNumber - b.dayNumber);
      
      // Cleanup logic to remove duplicated items within a group
      fetched = fetched.map(day => {
        if (day.items && day.items.length > 0) {
          const uniqueItems: EirItem[] = [];
          const seenIds = new Set();
          for (const item of day.items) {
            if (!seenIds.has(item.id)) {
              seenIds.add(item.id);
              uniqueItems.push(item);
            }
          }
          if (uniqueItems.length !== day.items.length) {
            console.log(`Found duplicates in group ${day.id}. Cleaning up...`);
            setDoc(doc(db, 'eirDays', day.id!), { items: uniqueItems }, { merge: true }).catch(console.error);
            return { ...day, items: uniqueItems };
          }
        }
        return day;
      });

      setDays(fetched);
      setIsLoading(false);
    }, (error) => {
      console.error("Error loading eirDays:", error);
      setIsLoading(false);
      toast.error(t('admin.eirLoadError', 'Erro ao carregar jornada.'));
    });
    return () => unsub();
  }, []);

  const getPreviewUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('drive.google.com/file/d/')) {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
         return `https://drive.google.com/uc?export=view&id=${match[1]}`;
      }
    }
    if (url.includes('imgur.com/') && !url.includes('i.imgur.com/') && !url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      const id = url.split('/').pop()?.split('?')[0];
      if (id) return `https://i.imgur.com/${id}.png`;
    }
    return url;
  };

  const handleError = (e: any, fallbackMessage: string) => {
    console.error(e);
    if (e?.code === 'resource-exhausted' || e?.message?.includes('Quota') || e?.message?.includes('quota')) {
      toast.error('Limite diário gratuito do Firebase atingido. Não é possível alterar até amanhã.');
    } else {
      toast.error(fallbackMessage);
    }
  };

  const handleSaveDay = async () => {
    if (!dayFormData.title || !dayFormData.dayNumber) {
      toast.error(t('common.fillRequiredFields'));
      return;
    }
    
    try {
      const dayRef = editingDay?.id ? doc(db, 'eirDays', editingDay.id) : doc(collection(db, 'eirDays'));
      await setDoc(dayRef, {
        dayNumber: Number(dayFormData.dayNumber),
        title: dayFormData.title,
        title_en: dayFormData.title_en || '',
        title_es: dayFormData.title_es || '',
        items: editingDay?.items || []
      }, { merge: true });
      
      toast.success(t('common.savedSuccessfully', 'Salvo com sucesso'));
      setIsDayModalOpen(false);
    } catch (e: any) {
      handleError(e, t('common.saveError', 'Erro ao salvar.'));
    }
  };

  const handleImageClickForHotspot = (e: React.MouseEvent<HTMLDivElement>) => {
    if (itemFormData.type !== 'hotspot_image' && itemFormData.type !== 'hotspot_link_image') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newHotspot = { 
      id: Date.now().toString(), 
      x: Number((x - 10).toFixed(2)), 
      y: Number((y - 10).toFixed(2)), 
      width: 20,
      height: 20,
      title: 'Novo Ponto', 
      content: ''
    };
    setItemFormData({...itemFormData, hotspots: [...(itemFormData.hotspots || []), newHotspot]});
  };

  const handleSaveItem = async () => {
    if (!itemFormData.title || !itemFormData.type) {
      toast.error(t('common.fillRequiredFields'));
      return;
    }
    
    try {
      const day = days.find(d => d.id === editingItem.dayId);
      if (!day || !day.id) return;
      
      let newItems = [...(day.items || [])];
      
      const cleanItemData = JSON.parse(JSON.stringify(itemFormData));
      
      if (editingItem.item) {
        newItems = newItems.map(i => i.id === editingItem.item?.id ? { ...i, ...cleanItemData } as EirItem : i);
      } else {
        const newItem: any = {
          id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
          type: cleanItemData.type,
          title: cleanItemData.title,
        };
        if (cleanItemData.title_en !== undefined) newItem.title_en = cleanItemData.title_en;
        if (cleanItemData.title_es !== undefined) newItem.title_es = cleanItemData.title_es;
        if (cleanItemData.url !== undefined) newItem.url = cleanItemData.url;
        if (cleanItemData.linkUrl !== undefined) newItem.linkUrl = cleanItemData.linkUrl;
        if (cleanItemData.type === 'hotspot_image' || cleanItemData.type === 'hotspot_link_image') newItem.hotspots = cleanItemData.hotspots || [];
        if (cleanItemData.type === 'quiz') newItem.quizConfig = cleanItemData.quizConfig || { passingScore: 70, questions: [] };
        
        newItems.push(newItem as EirItem);
      }
      
      await setDoc(doc(db, 'eirDays', day.id), { items: newItems }, { merge: true });
      toast.success(t('common.savedSuccessfully', 'Salvo com sucesso'));
      setIsItemModalOpen(false);
    } catch (e: any) {
      handleError(e, t('common.saveError', 'Erro ao salvar.'));
    }
  };

  const [deleteConfirmation, setDeleteConfirmation] = useState<{isOpen: boolean, action: () => void, title: string, text: string}>({isOpen: false, action: () => {}, title: '', text: ''});

  const handleDeleteItem = (dayId: string, itemId: string) => {
    setDeleteConfirmation({
      isOpen: true,
      title: 'Excluir Atividade',
      text: t('common.confirmDelete', 'Tem certeza que deseja excluir?'),
      action: async () => {
        try {
          const day = days.find(d => d.id === dayId);
          if (!day || !day.id) return;
          
          const newItems = (day.items || []).filter(i => i.id !== itemId);
          await setDoc(doc(db, 'eirDays', day.id), { items: newItems }, { merge: true });
          toast.success(t('common.deletedSuccessfully', 'Excluído com sucesso'));
        } catch (e: any) {
          handleError(e, t('common.deleteError', 'Erro ao excluir.'));
        }
      }
    });
  };

  const handleDeleteDay = (dayId: string) => {
    setDeleteConfirmation({
      isOpen: true,
      title: 'Excluir Grupo',
      text: t('common.confirmDelete', 'Tem certeza que deseja excluir este grupo inteiro?'),
      action: async () => {
        try {
          await deleteDoc(doc(db, 'eirDays', dayId));
          toast.success(t('common.deletedSuccessfully', 'Excluído com sucesso'));
        } catch (e: any) {
          handleError(e, t('common.deleteError', 'Erro ao excluir.'));
        }
      }
    });
  };

  const moveItem = async (dayId: string, index: number, direction: 'up' | 'down') => {
    const day = days.find(d => d.id === dayId);
    if (!day || !day.id || !day.items) return;
    
    const newItems = [...day.items];
    if (direction === 'up' && index > 0) {
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    } else if (direction === 'down' && index < newItems.length - 1) {
      [newItems[index + 1], newItems[index]] = [newItems[index], newItems[index + 1]];
    } else {
      return;
    }
    
    try {
      await setDoc(doc(db, 'eirDays', day.id), { items: newItems }, { merge: true });
    } catch (e: any) {
      handleError(e, 'Erro ao reordenar');
    }
  };

  if (isLoading) {
    return <div className="animate-pulse flex space-x-4">
      <div className="flex-1 space-y-4 py-1">
        <div className="h-4 bg-slate-400 rounded w-3/4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-slate-400 rounded"></div>
          <div className="h-4 bg-slate-400 rounded w-5/6"></div>
        </div>
      </div>
    </div>;
  }

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'image': return <ImageIcon className="w-5 h-5 text-purple-500" />;
      case 'hotspot_image': return <MousePointerClick className="w-5 h-5 text-indigo-500" />;
      case 'hotspot_link_image': return <LinkIcon className="w-5 h-5 text-indigo-500" />;
      case 'video': return <Video className="w-5 h-5 text-blue-500" />;
      case 'drive_document': return <FileText className="w-5 h-5 text-blue-500" />;
      case 'external_link': return <LinkIcon className="w-5 h-5 text-green-500" />;
      case 'quiz': return <HelpCircle className="w-5 h-5 text-amber-500" />;
      default: return <ImageIcon className="w-5 h-5" />;
    }
  };

  return (
    <div className={`space-y-6 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
      <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
        <div>
          <h2 className="text-lg font-bold text-blue-800 dark:text-blue-300">
            {t('admin.eirJourneyBuilder', 'Construtor da Jornada EIR')}
          </h2>
          <p className="text-sm text-blue-600 dark:text-blue-400">
            {t('admin.eirJourneyDesc', 'Crie e organize a experiência de onboarding dia a dia para os Líderes do Futuro.')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPreviewMode(true)}
            className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-all font-bold shadow-lg"
          >
            <PlayCircle className="w-4 h-4" /> {t('admin.previewJourney', 'Visualizar Jornada')}
          </button>
          <button
            onClick={() => {
              setEditingDay(null);
              setDayFormData({ dayNumber: days.length > 0 ? Math.max(...days.map(d => d.dayNumber)) + 1 : 1, title: '' });
              setIsDayModalOpen(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all font-bold shadow-lg"
          >
            <Plus className="w-4 h-4" /> Adicionar Grupo
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {days.map(day => (
          <div key={day.id} className={`border rounded-xl overflow-hidden ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-slate-200 bg-white'}`}>
            <div className={`flex items-center justify-between p-4 border-b ${theme === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50'}`}>
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-black text-sm">
                  {day.dayNumber}
                </span>
                <h3 className="font-bold text-lg">{day.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingDay(day);
                    setDayFormData({ 
                      dayNumber: day.dayNumber, 
                      title: day.title,
                      title_en: day.title_en,
                      title_es: day.title_es
                    });
                    setIsDayModalOpen(true);
                  }}
                  className="text-sm px-3 py-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                >
                  {t('common.edit', 'Editar')}
                </button>
                <button
                  onClick={() => day.id && handleDeleteDay(day.id)}
                  className="text-sm px-3 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                >
                  {t('common.delete', 'Excluir')}
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {(!day.items || day.items.length === 0) ? (
                <p className="text-sm text-center text-slate-500 py-4">Nenhum conteúdo adicionado a este grupo ainda.</p>
              ) : (
                <div className="space-y-3">
                  {day.items.map((item, idx) => (
                    <div key={`${day.id}-${item.id}-${idx}`} className={`flex items-center justify-between p-3 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                          {getItemIcon(item.type)}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{item.title}</p>
                          <p className="text-xs text-slate-500" style={{ textTransform: 'uppercase' }}>
                            {item.type.replace('_', ' ')}
                            {item.url && ` • ${item.url.substring(0, 30)}...`}
                            {(item.type === 'hotspot_image' || item.type === 'hotspot_link_image') && ` • ${(item.hotspots || []).length} hotspots`}
                            {item.type === 'quiz' && ` • Nota min: ${item.quizConfig?.passingScore || 70}%`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => day.id && moveItem(day.id, idx, 'up')}
                          disabled={idx === 0}
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30"
                        >
                          <MoveUp className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => day.id && moveItem(day.id, idx, 'down')}
                          disabled={idx === day.items.length - 1}
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30"
                        >
                          <MoveDown className="w-4 h-4" />
                        </button>
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                        <button 
                          onClick={() => {
                            setEditingItem({ dayId: day.id!, item });
                            setItemFormData({ 
                              type: item.type, 
                              title: item.title, 
                              title_en: item.title_en,
                              title_es: item.title_es,
                              url: item.url || '', 
                              linkUrl: item.linkUrl || '', 
                              hotspots: item.hotspots || [], 
                              quizConfig: item.quizConfig 
                            });
                            setIsItemModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                        >
                          {t('common.edit')}
                        </button>
                        <button 
                          onClick={() => day.id && handleDeleteItem(day.id, item.id)}
                          className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  setEditingItem({ dayId: day.id!, item: null });
                  setItemFormData({ type: 'video', title: '', url: '', linkUrl: '' });
                  setIsItemModalOpen(true);
                }}
                className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-lg text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> {t('admin.addContent', 'Adicionar Conteúdo')}
              </button>
            </div>
          </div>
        ))}
        {days.length === 0 && (
          <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            <p className="text-slate-500 mb-2">Nenhum grupo configurado na Jornada EIR.</p>
            <p className="text-sm font-bold text-blue-600">Adicione o Grupo 1 para começar!</p>
          </div>
        )}
      </div>

      {/* Day Modal */}
      {isDayModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-md rounded-xl shadow-2xl overflow-hidden ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
            <div className={`px-6 py-4 border-b flex justify-between items-center ${theme === 'dark' ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
              <h3 className="font-bold text-lg">{editingDay ? 'Editar Grupo' : 'Novo Grupo'}</h3>
              <button onClick={() => setIsDayModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Ordem do Grupo</label>
                <input 
                  type="number" 
                  value={dayFormData.dayNumber || ''} 
                  onChange={(e) => setDayFormData({...dayFormData, dayNumber: Number(e.target.value)})}
                  className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Nome do Grupo (PT)</label>
                <input 
                  type="text" 
                  placeholder="Ex: Primeiros Passos"
                  value={dayFormData.title || ''} 
                  onChange={(e) => setDayFormData({...dayFormData, title: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Nome do Grupo (EN)</label>
                  <input 
                    type="text" 
                    placeholder="Ex: First Steps"
                    value={dayFormData.title_en || ''} 
                    onChange={(e) => setDayFormData({...dayFormData, title_en: e.target.value})}
                    className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Nome do Grupo (ES)</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Primeros Pasos"
                    value={dayFormData.title_es || ''} 
                    onChange={(e) => setDayFormData({...dayFormData, title_es: e.target.value})}
                    className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                  />
                </div>
              </div>
            </div>
            <div className={`px-6 py-4 border-t flex justify-end gap-3 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
              <button 
                onClick={() => setIsDayModalOpen(false)}
                className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                {t('common.cancel', 'Cancelar')}
              </button>
              <button 
                onClick={handleSaveDay}
                className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> {t('common.save', 'Salvar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {isItemModalOpen && (() => {
        const isHotspotType = itemFormData.type === 'hotspot_image' || itemFormData.type === 'hotspot_link_image';
        return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className={`w-full flex flex-col ${isHotspotType ? 'max-w-6xl' : 'max-w-xl'} max-h-[95vh] rounded-xl shadow-2xl transition-all duration-300 ${theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
            <div className={`shrink-0 px-6 py-4 border-b flex justify-between items-center ${theme === 'dark' ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
              <h3 className="font-bold text-lg">{editingItem.item ? t('admin.editContent', 'Editar Conteúdo') : t('admin.newContent', 'Novo Conteúdo')}</h3>
              <button onClick={() => setIsItemModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className={`flex-1 overflow-hidden p-6 ${isHotspotType ? 'grid grid-cols-[1.2fr_1fr] gap-6' : 'overflow-y-auto space-y-5'}`}>
              
              <div className={`space-y-5 ${isHotspotType ? 'overflow-y-auto pr-2 h-full' : ''}`}>
                <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Tipo de Conteúdo</label>
                <select 
                  value={itemFormData.type} 
                  onChange={(e) => setItemFormData({...itemFormData, type: e.target.value as any})}
                  className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                >
                  <option value="video">Vídeo</option>
                  <option value="image">Imagem Simples</option>
                  <option value="hotspot_image">Imagem com Pop-ups (Hotspots)</option>
                  <option value="hotspot_link_image">Imagem com Links (Hotspots de Redirecionamento)</option>
                  <option value="external_link">Link Externo</option>
                  <option value="drive_document">Documento do Drive (Imagem + Link)</option>
                  <option value="quiz">Quiz</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Título de Exibição / Nome (PT)</label>
                <input 
                  type="text" 
                  placeholder="Ex: Mensagem do CEO"
                  value={itemFormData.title || ''} 
                  onChange={(e) => setItemFormData({...itemFormData, title: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Título (EN)</label>
                  <input 
                    type="text" 
                    placeholder="Ex: CEO Message"
                    value={itemFormData.title_en || ''} 
                    onChange={(e) => setItemFormData({...itemFormData, title_en: e.target.value})}
                    className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Título (ES)</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Mensaje del CEO"
                    value={itemFormData.title_es || ''} 
                    onChange={(e) => setItemFormData({...itemFormData, title_es: e.target.value})}
                    className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                  />
                </div>
              </div>

              {['video', 'image', 'hotspot_image', 'hotspot_link_image', 'external_link', 'drive_document'].includes(itemFormData.type || '') && (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    {itemFormData.type === 'external_link' ? 'URL do Link (Google Drive, Docs, etc)' : (itemFormData.type === 'drive_document' ? 'URL da Imagem de Capa' : 'URL do Arquivo (Imagem ou Vídeo)')}
                  </label>
                  <div className="flex flex-col gap-2">
                    <input 
                      type="text" 
                      placeholder="https://..."
                      value={itemFormData.url || ''} 
                      onChange={(e) => setItemFormData({...itemFormData, url: e.target.value})}
                      onBlur={(e) => {
                        const fixed = getPreviewUrl(e.target.value);
                        if (fixed !== e.target.value) {
                          setItemFormData(prev => ({ ...prev, url: fixed }));
                        }
                      }}
                      className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                    />
                    
                    {itemFormData.type !== 'external_link' && (
                      <div className="flex flex-col gap-2 border-t border-dashed pt-2 mt-1 dark:border-slate-700">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600 cursor-pointer">
                          <UploadCloud className="w-4 h-4" />
                          {isUploading ? (
                            `Enviando... ${uploadProgress}%`
                          ) : (
                            'Ou faça upload direto do seu computador'
                          )}
                          <input 
                            type="file" 
                            className="hidden" 
                            accept={itemFormData.type === 'video' ? 'video/*' : 'image/*'} 
                            onChange={handleFileUpload} 
                            disabled={isUploading}
                          />
                        </label>
                        {isUploading && (
                          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                          </div>
                        )}
                        <p className="text-[10px] text-slate-400">
                          {itemFormData.type === 'drive_document' ? 'Insira a URL direta da imagem ou faça o upload de uma miniatura.' : 'Insira a URL direta do vídeo/imagem ou um link de Google Drive. Se for link do Drive, lembre-se de alterar as permissões para "Qualquer pessoa com o link".'}
                        </p>
                      </div>
                    )}
                    {itemFormData.type === 'external_link' && (
                      <p className="text-[10px] text-slate-400">Cole aqui o link do Google Drive, formulário ou qualquer outra página externa.</p>
                    )}
                  </div>
                  
                  {itemFormData.type === 'drive_document' && (
                    <div className="mt-4">
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">URL do Documento no Drive</label>
                      <input 
                        type="text" 
                        placeholder="https://docs.google.com/..."
                        value={itemFormData.linkUrl || ''} 
                        onChange={(e) => setItemFormData({...itemFormData, linkUrl: e.target.value})}
                        className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                      />
                    </div>
                  )}

                  {itemFormData.url && (itemFormData.type !== 'external_link') && (
                    <div className="mt-4 border rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 relative">
                      {itemFormData.type === 'video' ? (
                        <VideoPlayer src={itemFormData.url} />
                      ) : (
                        <div 
                          className="relative w-full inline-block cursor-crosshair"
                          onClick={handleImageClickForHotspot}
                        >
                          <img src={getPreviewUrl(itemFormData.url)} alt="Preview" className="w-full max-h-[400px] object-contain block" referrerPolicy="no-referrer" />
                          
                          {(itemFormData.type === 'hotspot_image' || itemFormData.type === 'hotspot_link_image') && (itemFormData.hotspots || []).map((hs, hidx) => (
                            <div 
                              key={hs.id} 
                              className="absolute border-2 border-blue-500 bg-blue-500/30 flex items-center justify-center text-[10px] font-bold text-white shadow-lg pointer-events-none"
                              style={{ left: `${hs.x}%`, top: `${hs.y}%`, width: `${hs.width || 20}%`, height: `${hs.height || 20}%` }}
                            >
                              <span className="bg-blue-600 rounded-full w-5 h-5 flex items-center justify-center shadow">{hidx + 1}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {(itemFormData.type === 'hotspot_image' || itemFormData.type === 'hotspot_link_image') && (
                        <div className="absolute bottom-2 left-2 right-2 p-2 bg-black/60 backdrop-blur text-white text-[10px] rounded-lg text-center pointer-events-none">
                          Clique na imagem para adicionar um novo ponto interativo
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {itemFormData.type === 'quiz' && (
                <div className="pt-4 border-t dark:border-slate-800 text-sm space-y-4">
                   <div className="flex items-center justify-between">
                     <p className="font-bold text-slate-700 dark:text-slate-300">Configuração do Quiz</p>
                   </div>
                   
                   <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Nota para Aprovação (%)</label>
                      <input 
                        type="number" 
                        value={itemFormData.quizConfig?.passingScore || 70} 
                        onChange={(e) => setItemFormData({...itemFormData, quizConfig: { ...itemFormData.quizConfig!, passingScore: Number(e.target.value), questions: itemFormData.quizConfig?.questions || [] }})}
                        className={`w-32 px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                        min="0" max="100"
                      />
                    </div>

                    <div className="border-t dark:border-slate-800 pt-4 mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-slate-500 uppercase">Perguntas</p>
                        <button
                          type="button"
                          onClick={() => {
                            const currentConfig = itemFormData.quizConfig || { passingScore: 70, questions: [] };
                            const newQuestions = [...currentConfig.questions, { questionText: '', options: ['', ''], correctOptionIndex: 0 }];
                            setItemFormData({...itemFormData, quizConfig: { ...currentConfig, questions: newQuestions }});
                          }}
                          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-2 py-1 rounded"
                        >
                          <Plus className="w-3 h-3" />
                          Adicionar Pergunta
                        </button>
                      </div>

                      {(!itemFormData.quizConfig?.questions || itemFormData.quizConfig.questions.length === 0) && (
                        <div className="text-center p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-slate-500 text-xs">
                          Nenhuma pergunta adicionada ao quiz ainda.
                        </div>
                      )}

                      <div className="space-y-4">
                        {(itemFormData.quizConfig?.questions || []).map((q, qIndex) => (
                          <div key={qIndex} className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex justify-between gap-4 mb-3">
                              <div className="text-xs font-bold text-slate-500">Pergunta {qIndex + 1}</div>
                              <button
                                type="button"
                                onClick={() => {
                                  const config = itemFormData.quizConfig!;
                                  const questions = config.questions.filter((_, idx) => idx !== qIndex);
                                  setItemFormData({...itemFormData, quizConfig: { ...config, questions }});
                                }}
                                className="text-red-500 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            
                            <input
                              type="text"
                              value={q.questionText}
                              onChange={(e) => {
                                const config = itemFormData.quizConfig!;
                                const questions = [...config.questions];
                                questions[qIndex].questionText = e.target.value;
                                setItemFormData({...itemFormData, quizConfig: { ...config, questions }});
                              }}
                              placeholder="Digite a pergunta aqui (PT)..."
                              className={`w-full px-3 py-2 text-sm rounded-lg border outline-none mb-2 focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
                            />
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <input
                                type="text"
                                value={q.questionText_en || ''}
                                onChange={(e) => {
                                  const config = itemFormData.quizConfig!;
                                  const questions = [...config.questions];
                                  questions[qIndex].questionText_en = e.target.value;
                                  setItemFormData({...itemFormData, quizConfig: { ...config, questions }});
                                }}
                                placeholder="Pergunta (EN)..."
                                className={`w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
                              />
                              <input
                                type="text"
                                value={q.questionText_es || ''}
                                onChange={(e) => {
                                  const config = itemFormData.quizConfig!;
                                  const questions = [...config.questions];
                                  questions[qIndex].questionText_es = e.target.value;
                                  setItemFormData({...itemFormData, quizConfig: { ...config, questions }});
                                }}
                                placeholder="Pergunta (ES)..."
                                className={`w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
                              />
                            </div>

                            <div className="space-y-2">
                              {q.options.map((opt, oIndex) => (
                                <div key={oIndex} className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`correct-option-${qIndex}`}
                                    checked={q.correctOptionIndex === oIndex}
                                    onChange={() => {
                                      const config = itemFormData.quizConfig!;
                                      const questions = [...config.questions];
                                      questions[qIndex].correctOptionIndex = oIndex;
                                      setItemFormData({...itemFormData, quizConfig: { ...config, questions }});
                                    }}
                                    className="w-4 h-4 text-blue-600 cursor-pointer"
                                    title="Marcar como alternativa correta"
                                  />
                                  <div className="flex-1 flex flex-col gap-1">
                                    <input
                                      type="text"
                                      value={opt}
                                      onChange={(e) => {
                                        const config = itemFormData.quizConfig!;
                                        const questions = [...config.questions];
                                        questions[qIndex].options[oIndex] = e.target.value;
                                        setItemFormData({...itemFormData, quizConfig: { ...config, questions }});
                                      }}
                                      placeholder={`Opção ${oIndex + 1} (PT)`}
                                      className={`px-3 py-1.5 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${q.correctOptionIndex === oIndex ? 'border-green-500 dark:border-green-500' : (theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300')}`}
                                    />
                                    <div className="grid grid-cols-2 gap-1">
                                      <input
                                        type="text"
                                        value={q.options_en?.[oIndex] || ''}
                                        onChange={(e) => {
                                          const config = itemFormData.quizConfig!;
                                          const questions = [...config.questions];
                                          if (!questions[qIndex].options_en) questions[qIndex].options_en = [...questions[qIndex].options];
                                          questions[qIndex].options_en![oIndex] = e.target.value;
                                          setItemFormData({...itemFormData, quizConfig: { ...config, questions }});
                                        }}
                                        placeholder={`Opção ${oIndex + 1} (EN)`}
                                        className={`px-3 py-1.5 text-xs rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
                                      />
                                      <input
                                        type="text"
                                        value={q.options_es?.[oIndex] || ''}
                                        onChange={(e) => {
                                          const config = itemFormData.quizConfig!;
                                          const questions = [...config.questions];
                                          if (!questions[qIndex].options_es) questions[qIndex].options_es = [...questions[qIndex].options];
                                          questions[qIndex].options_es![oIndex] = e.target.value;
                                          setItemFormData({...itemFormData, quizConfig: { ...config, questions }});
                                        }}
                                        placeholder={`Opção ${oIndex + 1} (ES)`}
                                        className={`px-3 py-1.5 text-xs rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
                                      />
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const config = itemFormData.quizConfig!;
                                      const questions = [...config.questions];
                                      questions[qIndex].options = questions[qIndex].options.filter((_, idx) => idx !== oIndex);
                                      if (questions[qIndex].correctOptionIndex >= questions[qIndex].options.length) {
                                        questions[qIndex].correctOptionIndex = Math.max(0, questions[qIndex].options.length - 1);
                                      }
                                      setItemFormData({...itemFormData, quizConfig: { ...config, questions }});
                                    }}
                                    disabled={q.options.length <= 2}
                                    className="text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const config = itemFormData.quizConfig!;
                                const questions = [...config.questions];
                                questions[qIndex].options.push('');
                                setItemFormData({...itemFormData, quizConfig: { ...config, questions }});
                              }}
                              className="mt-3 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> {t('admin.addOption', 'Adicionar Opção')}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                </div>
              )}

            
              </div>

              {isHotspotType && (
                <div className="overflow-y-auto h-[75vh] space-y-5 pl-6 border-l border-slate-200 dark:border-slate-800 pb-10 custom-scrollbar">
                  <div className="flex items-center justify-between mb-3 sticky top-0 bg-white dark:bg-slate-900 z-10 py-2 border-b dark:border-slate-800">
                    <p className="font-bold text-slate-700 dark:text-slate-300">Pontos Interativos</p>
                    <button 
                      type="button"
                      onClick={() => {
                        const newHotspot = { id: Date.now().toString(), x: 50, y: 50, title: 'Novo Pop-up', content: '' };
                        setItemFormData({...itemFormData, hotspots: [...(itemFormData.hotspots || []), newHotspot]});
                      }}
                      className="text-xs px-3 py-1.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg font-bold flex items-center gap-1 shadow-sm hover:bg-indigo-200 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Adicionar Ponto
                    </button>
                  </div>

                  {(!itemFormData.hotspots || itemFormData.hotspots.length === 0) && (
                    <p className="text-slate-500 text-xs text-center py-4 border border-dashed rounded-lg dark:border-slate-700">
                      Nenhum ponto interativo. Clique na imagem acima para adicionar um.
                    </p>
                  )}

                  <div className="space-y-3">
                    {(itemFormData.hotspots || []).map((hs, hidx) => {
                      const isMinimized = minimizedHotspots.includes(hs.id);
                      return (
                      <div key={hs.id} className={`p-3 rounded border relative transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-700 dark:bg-blue-900 rounded-full text-[10px] font-bold">
                              {hidx + 1}
                            </span>
                            <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                              {hs.title || 'Novo Ponto'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => {
                                setMinimizedHotspots(prev => 
                                  prev.includes(hs.id) 
                                    ? prev.filter(id => id !== hs.id)
                                    : [...prev, hs.id]
                                );
                              }}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded transition-colors"
                            >
                              {isMinimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => {
                                const newHp = [...(itemFormData.hotspots || [])];
                                newHp.splice(hidx, 1);
                                setItemFormData({...itemFormData, hotspots: newHp});
                              }}
                              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {!isMinimized && (
                          <>
                            <div className="grid grid-cols-4 gap-2 mb-2">
                               <div>
                                 <label className="text-[10px] font-bold text-slate-500">X (%)</label>
                                 <input type="number" value={hs.x} onChange={e => {
                                   const arr = [...(itemFormData.hotspots || [])];
                                   arr[hidx].x = Number(e.target.value);
                                   setItemFormData({...itemFormData, hotspots: arr});
                                 }} className="w-full p-1 text-xs border rounded bg-transparent dark:border-slate-600" />
                               </div>
                               <div>
                                 <label className="text-[10px] font-bold text-slate-500">Y (%)</label>
                                 <input type="number" value={hs.y} onChange={e => {
                                   const arr = [...(itemFormData.hotspots || [])];
                                   arr[hidx].y = Number(e.target.value);
                                   setItemFormData({...itemFormData, hotspots: arr});
                                 }} className="w-full p-1 text-xs border rounded bg-transparent dark:border-slate-600" />
                               </div>
                               <div>
                                 <label className="text-[10px] font-bold text-slate-500">Larg. (%)</label>
                                 <input type="number" value={hs.width || 20} onChange={e => {
                                   const arr = [...(itemFormData.hotspots || [])];
                                   arr[hidx].width = Number(e.target.value);
                                   setItemFormData({...itemFormData, hotspots: arr});
                                 }} className="w-full p-1 text-xs border rounded bg-transparent dark:border-slate-600" />
                               </div>
                               <div>
                                 <label className="text-[10px] font-bold text-slate-500">Alt. (%)</label>
                                 <input type="number" value={hs.height || 20} onChange={e => {
                                   const arr = [...(itemFormData.hotspots || [])];
                                   arr[hidx].height = Number(e.target.value);
                                   setItemFormData({...itemFormData, hotspots: arr});
                                 }} className="w-full p-1 text-xs border rounded bg-transparent dark:border-slate-600" />
                               </div>
                            </div>

                            <div className="space-y-2 mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                          <input 
                            type="text" 
                            placeholder="Título do Pop-up (PT)" 
                            value={hs.title}
                            onChange={e => {
                              const arr = [...(itemFormData.hotspots || [])];
                              arr[hidx].title = e.target.value;
                              setItemFormData({...itemFormData, hotspots: arr});
                            }}
                            className={`w-full p-1.5 text-xs border rounded outline-none ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input 
                              type="text" 
                              placeholder="Título (EN)" 
                              value={hs.title_en || ''}
                              onChange={e => {
                                const arr = [...(itemFormData.hotspots || [])];
                                arr[hidx].title_en = e.target.value;
                                setItemFormData({...itemFormData, hotspots: arr});
                              }}
                              className={`w-full p-1.5 text-xs border rounded outline-none ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                            />
                            <input 
                              type="text" 
                              placeholder="Título (ES)" 
                              value={hs.title_es || ''}
                              onChange={e => {
                                const arr = [...(itemFormData.hotspots || [])];
                                arr[hidx].title_es = e.target.value;
                                setItemFormData({...itemFormData, hotspots: arr});
                              }}
                              className={`w-full p-1.5 text-xs border rounded outline-none ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                            />
                          </div>

                          {itemFormData.type === 'hotspot_image' ? (
                            <>
                              <textarea 
                                placeholder="Texto descritivo do Pop-up (PT)..." 
                                value={hs.content}
                                onChange={e => {
                                  const arr = [...(itemFormData.hotspots || [])];
                                  arr[hidx].content = e.target.value;
                                  setItemFormData({...itemFormData, hotspots: arr});
                                }}
                                className={`w-full p-1.5 text-xs border rounded outline-none min-h-[60px] ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <textarea 
                                  placeholder="Texto (EN)..." 
                                  value={hs.content_en || ''}
                                  onChange={e => {
                                    const arr = [...(itemFormData.hotspots || [])];
                                    arr[hidx].content_en = e.target.value;
                                    setItemFormData({...itemFormData, hotspots: arr});
                                  }}
                                  className={`w-full p-1.5 text-xs border rounded outline-none min-h-[60px] ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                                />
                                <textarea 
                                  placeholder="Texto (ES)..." 
                                  value={hs.content_es || ''}
                                  onChange={e => {
                                    const arr = [...(itemFormData.hotspots || [])];
                                    arr[hidx].content_es = e.target.value;
                                    setItemFormData({...itemFormData, hotspots: arr});
                                  }}
                                  className={`w-full p-1.5 text-xs border rounded outline-none min-h-[60px] ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                                />
                              </div>
                            </>
                          ) : (
                            <input 
                              type="text" 
                              placeholder="URL de Redirecionamento (https://...)" 
                              value={hs.linkUrl || ''}
                              onChange={e => {
                                const arr = [...(itemFormData.hotspots || [])];
                                arr[hidx].linkUrl = e.target.value;
                                setItemFormData({...itemFormData, hotspots: arr});
                              }}
                              className={`w-full p-1.5 text-xs border rounded focus:ring-2 focus:ring-blue-500 outline-none ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                            />
                          )}
                          
                          {itemFormData.type === 'hotspot_image' && (
                            <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Imagem do Pop-up (Opcional)</label>
                            
                            <div className="flex items-start gap-2">
                              {hs.imageUrl && (
                                <div className="w-12 h-12 rounded border dark:border-slate-600 overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-900">
                                  <img src={getPreviewUrl(hs.imageUrl)} className="w-full h-full object-contain" alt="hotspot content preview" referrerPolicy="no-referrer" />
                                </div>
                              )}
                              <div className="flex-1 space-y-1">
                                <input 
                                  type="text" 
                                  placeholder="URL da Imagem..." 
                                  value={hs.imageUrl || ''}
                                  onChange={e => {
                                    const arr = [...(itemFormData.hotspots || [])];
                                    arr[hidx].imageUrl = e.target.value;
                                    setItemFormData({...itemFormData, hotspots: arr});
                                  }}
                                  onBlur={e => {
                                    const fixed = getPreviewUrl(e.target.value);
                                    if (fixed !== e.target.value) {
                                      const arr = [...(itemFormData.hotspots || [])];
                                      arr[hidx].imageUrl = fixed;
                                      setItemFormData({...itemFormData, hotspots: arr});
                                    }
                                  }}
                                  className="w-full p-1.5 pl-2 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600" 
                                />
                                <div className="flex items-center gap-2">
                                  <label className="text-[10px] text-blue-600 dark:text-blue-400 font-bold cursor-pointer hover:underline flex items-center gap-1">
                                    <UploadCloud className="w-3 h-3" />
                                    {hotspotUploadings[hidx] !== undefined ? `Enviando... ${hotspotUploadings[hidx]}%` : 'Ou fazer upload'}
                                    <input 
                                      type="file" 
                                      className="hidden" 
                                      accept="image/*" 
                                      onChange={(e) => handleHotspotImageUpload(e, hidx)} 
                                      disabled={hotspotUploadings[hidx] !== undefined}
                                    />
                                  </label>
                                  {hs.imageUrl && (
                                    <button
                                      onClick={() => {
                                        const arr = [...(itemFormData.hotspots || [])];
                                        arr[hidx].imageUrl = '';
                                        setItemFormData({...itemFormData, hotspots: arr});
                                      }}
                                      className="text-[10px] text-red-500 hover:underline"
                                    >Remover Imagem</button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          )}
                        </div>
                          </>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className={`shrink-0 px-6 py-4 border-t flex justify-end gap-3 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
               <button 
                onClick={() => setIsItemModalOpen(false)}
                className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                {t('common.cancel', 'Cancelar')}
              </button>
              <button 
                onClick={handleSaveItem}
                className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> {t('admin.saveContent', 'Salvar Conteúdo')}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {isPreviewMode && (
        <EirJourneyPlayer days={days} onClose={() => setIsPreviewMode(false)} isPreview={true} />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className={`w-full max-w-sm rounded-xl shadow-2xl p-6 ${theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
            <h3 className="font-bold text-lg mb-2 text-red-600">{deleteConfirmation.title}</h3>
            <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{deleteConfirmation.text}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteConfirmation({...deleteConfirmation, isOpen: false})}
                className={`px-4 py-2 rounded-lg font-bold text-sm ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {t('common.cancel', 'Cancelar')}
              </button>
              <button 
                onClick={() => {
                  deleteConfirmation.action();
                  setDeleteConfirmation({...deleteConfirmation, isOpen: false});
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-700 shadow-md"
              >
                {t('common.delete', 'Excluir')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
