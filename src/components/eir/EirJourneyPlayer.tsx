import React, { useState } from 'react';
import { EirDay, EirItem } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { ChevronLeft, ChevronRight, Play, CheckCircle, X, ExternalLink, Activity, Lock, Unlock, Calendar, Check } from 'lucide-react';
import { getPreviewUrl } from '../../utils/videoUtils';
import { VideoPlayer } from '../VideoPlayer';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface Props {
  days: EirDay[];
  onClose?: () => void;
  onFinish?: () => void;
  isPreview?: boolean;
}

export default function EirJourneyPlayer({ days, onClose, onFinish, isPreview = false }: Props) {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const langSuffix = i18n.language === 'en' ? '_en' : i18n.language === 'es' ? '_es' : '';

  const getLocalized = (obj: any, field: string) => {
    if (!obj) return '';
    if (langSuffix && obj[`${field}${langSuffix}`]) {
      return obj[`${field}${langSuffix}`];
    }
    return obj[field] || '';
  };

  const getLocalizedArray = (obj: any, field: string) => {
    if (!obj) return [];
    if (langSuffix && obj[`${field}${langSuffix}`] && obj[`${field}${langSuffix}`].length > 0) {
      return obj[`${field}${langSuffix}`];
    }
    return obj[field] || [];
  };

  const sortedDays = [...days].sort((a, b) => a.dayNumber - b.dayNumber).map(day => {
    const uniqueItems: EirItem[] = [];
    const seen = new Set();
    (day.items || []).forEach(item => {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        uniqueItems.push(item);
      }
    });
    return { ...day, items: uniqueItems };
  });
  
  // Flatten to cross-day array
  const allItems = sortedDays.flatMap(d => d.items || []);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const selectedItem = allItems.find(i => i.id === selectedItemId);

  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<{[key: number]: number}>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Estados de simulação / progresso
  const [completedItems, setCompletedItems] = useState<string[]>([]);

  const getItemStatus = (index: number) => {
    if (isPreview) return 'unlocked';
    if (index === 0) return 'unlocked';
    const prevItem = allItems[index - 1];
    return completedItems.includes(prevItem.id!) ? 'unlocked' : 'locked';
  };

  const handleMarkAsCompleted = () => {
    if (selectedItem && !completedItems.includes(selectedItem.id!)) {
      setCompletedItems(prev => [...prev, selectedItem.id!]);
      toast.success(t('eir.activityCompleted', 'Atividade concluída!'));
      
      // Auto select next item if exists
      const currentIndex = allItems.findIndex(i => i.id === selectedItem.id);
      if (currentIndex < allItems.length - 1) {
         // optionally, setTimeout to select next.
      }
    }
  };

  const isJourneyComplete = allItems.length > 0 && completedItems.length === allItems.length;

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header */}
      <header className={`px-6 py-4 border-b flex items-center justify-between ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-4">
          {onClose && (
            <button onClick={onClose} className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              {t('eir.title', 'Jornada EIR')}
              {isPreview && <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-amber-500 text-white rounded">{t('eir.previewMode', 'Modo Visualização')}</span>}
            </h1>
          </div>
        </div>
        
        {isJourneyComplete && onFinish && (
          <button 
            onClick={onFinish}
            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-500/30 transition-all transform hover:scale-[1.02]"
          >
            <CheckCircle className="w-5 h-5" />
            Finalizar Onboarding e Acessar Home
          </button>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation / Sidebar */}
        <div className={`w-80 flex-shrink-0 border-r overflow-y-auto flex flex-col ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="p-4 space-y-6">
            {sortedDays.map((day) => (
              <div key={day.id} className="space-y-3">
                <h3 className={`font-bold text-sm uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-600'}`}>
                  {getLocalized(day, 'title')}
                </h3>
                <div className="space-y-1 relative">
                  <div className="absolute left-3 top-4 bottom-4 w-px bg-slate-200 dark:bg-slate-700"></div>
                  {(day.items || []).map((item, itemIdx) => {
                    const index = allItems.findIndex(i => i.id === item.id);
                    const status = getItemStatus(index);
                    const isCompleted = completedItems.includes(item.id!);
                    const isSelected = selectedItemId === item.id;
                    
                    return (
                      <button
                        key={`${day.id}-${item.id}-${itemIdx}`}
                        onClick={() => {
                          if (status === 'locked') {
                            toast.error(t('eir.itemLockedWarning', 'Conclua a atividade anterior para liberar esta.'));
                            return;
                          }
                          setSelectedItemId(item.id!);
                          setActiveHotspot(null);
                          setQuizScore(null);
                          setQuizAnswers({});
                          setQuizSubmitted(false);
                        }}
                        className={`w-full text-left px-3 py-3 text-sm rounded-lg flex items-center gap-3 relative transition-all ${
                          status === 'locked' 
                            ? `opacity-60 cursor-not-allowed ${theme === 'dark' ? 'text-white' : 'text-slate-500'}`
                            : isSelected 
                              ? 'bg-blue-500 text-white font-medium shadow-md z-20' 
                              : `z-20 ${theme === 'dark' ? 'text-white hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'}`
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                          isCompleted ? `bg-green-500 text-white ring-4 border border-green-600 ${theme === 'dark' ? 'ring-slate-900' : 'ring-slate-50'}` : 
                          isSelected ? `bg-white text-blue-500 ring-4 border border-blue-500 ${theme === 'dark' ? 'ring-slate-900' : 'ring-slate-50'}` : 
                          `ring-4 ${theme === 'dark' ? 'bg-slate-700 text-slate-300 ring-slate-900 border-slate-600' : 'bg-slate-200 text-slate-500 ring-slate-50 border-slate-300'} border`
                        }`}>
                          {status === 'locked' ? <Lock className="w-3 h-3" /> : (isCompleted ? <Check className="w-3.5 h-3.5" /> : <div className="w-2 h-2 rounded-full bg-current"></div>)}
                        </div>
                        
                        <span className="line-clamp-2 flex-1">{getLocalized(item, 'title')}</span>
                      </button>
                    );
                  })}
                  {(!day.items || day.items.length === 0) && (
                    <p className={`text-xs italic pl-10 py-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>
                      Nenhuma atividade neste grupo.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto bg-slate-950/5 relative flex flex-col">
          {!selectedItem ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-500 rounded-full flex items-center justify-center mb-4">
                <Play className="w-8 h-8 ml-1" />
              </div>
              <h2 className="text-xl font-bold mb-2">{t('eir.selectActivityTitle', 'Selecione uma atividade')}</h2>
              <p className="text-sm text-slate-500 max-w-md">{t('eir.selectActivityDesc', 'Navegue pelos dias à esquerda e escolha uma atividade.')}</p>
            </div>
          ) : (
            <div className={`flex-1 p-6 lg:p-8 max-w-5xl mx-auto w-full flex flex-col`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">{getLocalized(selectedItem, 'title')}</h2>
                {completedItems.includes(selectedItem.id!) ? (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 px-4 py-2 rounded-lg font-bold text-sm border border-green-200 dark:border-green-900/50">
                    <CheckCircle className="w-4 h-4" />
                    {t('eir.completedBadge', 'Concluído')}
                  </div>
                ) : (
                  selectedItem.type !== 'quiz' && (
                    <button 
                      onClick={handleMarkAsCompleted}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition"
                    >
                      <Check className="w-4 h-4" />
                      {t('eir.markCompletedBtn', 'Marcar Concluído')}
                    </button>
                  )
                )}
              </div>
              
              <div className={`flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'} overflow-hidden relative flex flex-col`}>
                
                {selectedItem.type === 'video' && selectedItem.url && (
                  <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-black">
                    <VideoPlayer src={selectedItem.url} />
                  </div>
                )}

                {selectedItem.type === 'image' && selectedItem.url && (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-100 dark:bg-slate-900">
                    <img src={getPreviewUrl(selectedItem.url)} className="max-w-full max-h-full object-contain drop-shadow" alt={getLocalized(selectedItem, 'title')} referrerPolicy="no-referrer" />
                  </div>
                )}

                {selectedItem.type === 'drive_document' && selectedItem.url && (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-100 dark:bg-slate-900">
                    <a href={selectedItem.linkUrl} target="_blank" rel="noopener noreferrer" className="cursor-pointer transition-transform hover:scale-[1.02] inline-block relative group text-center flex flex-col items-center">
                      <img src={getPreviewUrl(selectedItem.url)} className="max-w-full max-h-[70vh] object-contain drop-shadow-md rounded-xl" alt={getLocalized(selectedItem, 'title')} referrerPolicy="no-referrer" />
                      <div className="mt-4 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity translate-y-4 group-hover:translate-y-0">
                        <ExternalLink className="w-5 h-5" /> Abrir Documento no Drive
                      </div>
                    </a>
                  </div>
                )}

                {selectedItem.type === 'external_link' && selectedItem.url && (
                  <div className="w-full h-full flex items-center justify-center p-8 text-center flex-col">
                    <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                      <ExternalLink className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">{t('eir.externalLinkTitle', 'Link Externo')}</h3>
                    <p className="text-slate-500 mb-6 max-w-md">{t('eir.externalLinkDesc', 'Esta atividade é realizada em um sistema externo. Clique no botão abaixo para abrir a página.')}</p>
                    <a href={selectedItem.url} target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow">
                      {t('eir.accessLinkBtn', 'Acessar Link')}
                    </a>
                  </div>
                )}

                {(selectedItem.type === 'hotspot_image' || selectedItem.type === 'hotspot_link_image') && selectedItem.url && (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900 p-4 relative overflow-auto">
                    <div className="relative inline-block max-w-full drop-shadow-lg">
                      <img src={getPreviewUrl(selectedItem.url)} className="max-w-full max-h-[80vh] object-contain" alt={getLocalized(selectedItem, 'title')} referrerPolicy="no-referrer" />

                      {(selectedItem.hotspots || []).map((hs, index) => {
                        if (selectedItem.type === 'hotspot_link_image') {
                          return (
                            <a
                              key={hs.id}
                              href={hs.linkUrl || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`absolute rounded-xl transition-all z-10 cursor-pointer border-2 border-transparent hover:border-white/50 hover:bg-white/10 group flex items-center justify-center`}
                              style={{ left: `${hs.x}%`, top: `${hs.y}%`, width: `${hs.width || 20}%`, height: `${hs.height || 20}%` }}
                              title={hs.title}
                            >
                              <div className="bg-blue-600 text-white rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity transform scale-75 group-hover:scale-100">
                                <ExternalLink className="w-5 h-5" />
                              </div>
                            </a>
                          );
                        }

                        return (
                          <button
                            key={hs.id}
                            onClick={() => setActiveHotspot(hs.id)}
                            className={`absolute rounded-xl transition-all z-10 cursor-pointer border-2
                              ${activeHotspot === hs.id ? 'border-amber-500 bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'border-transparent hover:border-white/50 hover:bg-white/10'}
                            `}
                            style={{ left: `${hs.x}%`, top: `${hs.y}%`, width: `${hs.width || 20}%`, height: `${hs.height || 20}%` }}
                          />
                        );
                      })}

                      {activeHotspot && selectedItem.type === 'hotspot_image' && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setActiveHotspot(null)}>
                          <div 
                            className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex justify-between items-start mb-4">
                              <h3 className="font-bold text-lg dark:text-white pr-4">
                                {getLocalized((selectedItem.hotspots || []).find(h => h.id === activeHotspot), 'title')}
                              </h3>
                              <button onClick={() => setActiveHotspot(null)} className="text-slate-400 hover:text-red-500 bg-slate-100 dark:bg-slate-700 p-1.5 rounded-full transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            
                            {(() => {
                              const hs = (selectedItem.hotspots || []).find(h => h.id === activeHotspot);
                              if (!hs) return null;
                              return (
                                <div className="space-y-4">
                                  {hs.imageUrl && (
                                    <div className="w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border dark:border-slate-700">
                                      <img src={getPreviewUrl(hs.imageUrl)} alt="Imagem do popup" className="w-full max-h-80 object-contain" referrerPolicy="no-referrer" />
                                    </div>
                                  )}
                                  <p className="text-slate-600 dark:text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
                                    {getLocalized(hs, 'content')}
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedItem.type === 'quiz' && (
                  <div className="w-full h-full p-8 overflow-y-auto">
                    {(!selectedItem.quizConfig?.questions || selectedItem.quizConfig.questions.length === 0) ? (
                      <div className="text-center text-slate-500 p-8">
                        {t('eir.quizEmpty', 'Este quiz ainda não possui perguntas cadastradas.')}
                      </div>
                    ) : (
                      <div className="max-w-3xl mx-auto text-slate-900 dark:text-white">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b dark:border-slate-700">
                          <h3 className="font-bold text-xl flex items-center gap-2">
                            <CheckCircle className="w-6 h-6 text-blue-500" /> 
                            {t('eir.practicalEval', 'Avaliação Prática')}
                          </h3>
                          <div className="bg-slate-100 text-slate-900 dark:text-white dark:bg-slate-800 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-700">
                            {t('eir.passingScoreLabel', 'Aprovação:')} {selectedItem.quizConfig?.passingScore || 70}%
                          </div>
                        </div>

                        {quizSubmitted ? (
                          <div className={`p-8 rounded-2xl border flex flex-col items-center text-center ${quizScore !== null && quizScore >= (selectedItem.quizConfig?.passingScore || 70) ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}>
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${quizScore !== null && quizScore >= (selectedItem.quizConfig?.passingScore || 70) ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                              <CheckCircle className="w-10 h-10" />
                            </div>
                            <h3 className="text-2xl font-bold mb-2">
                              {quizScore !== null ? `${quizScore.toFixed(0)}%` : ''}
                            </h3>
                            <p className="text-slate-600 dark:text-slate-300 mb-6">
                              {quizScore !== null && quizScore >= (selectedItem.quizConfig?.passingScore || 70) 
                                ? t('eir.quizPassed', 'Parabéns! Você foi aprovado nesta atividade.') 
                                : t('eir.quizFailed', 'Você não atingiu a nota mínima. Tente novamente!')}
                            </p>

                            {quizScore !== null && quizScore < (selectedItem.quizConfig?.passingScore || 70) && (
                              <button 
                                onClick={() => {
                                  setQuizSubmitted(false);
                                  setQuizScore(null);
                                  setQuizAnswers({});
                                }}
                                className="px-6 py-3 bg-white border border-slate-300 rounded-xl font-bold hover:bg-slate-50 transition"
                              >
                                {t('eir.retakeQuizBtn', 'Refazer Quiz')}
                              </button>
                            )}

                          </div>
                        ) : (
                          <div className="space-y-8">
                            {selectedItem.quizConfig.questions.map((q, qIndex) => (
                              <div key={qIndex} className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-800">
                                <h4 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{qIndex + 1}. {getLocalized(q, 'questionText')}</h4>
                                <div className="space-y-3">
                                  {getLocalizedArray(q, 'options').map((opt: string, oIndex: number) => (
                                    <label 
                                      key={oIndex} 
                                      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${quizAnswers[qIndex] === oIndex ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/30 dark:border-blue-500' : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:border-blue-300'}`}
                                    >
                                      <input 
                                        type="radio" 
                                        name={`quiz-${selectedItem.id}-q-${qIndex}`}
                                        checked={quizAnswers[qIndex] === oIndex}
                                        onChange={() => setQuizAnswers(prev => ({ ...prev, [qIndex]: oIndex }))}
                                        className="mt-1 w-4 h-4 text-blue-600"
                                      />
                                      <span className="flex-1 text-sm text-slate-900 dark:text-white">{opt}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            ))}

                            <div className="flex justify-end pt-4">
                              <button
                                onClick={() => {
                                  const totalQuestions = selectedItem.quizConfig?.questions.length || 0;
                                  let correctCount = 0;
                                  selectedItem.quizConfig?.questions.forEach((q, idx) => {
                                    if (quizAnswers[idx] === q.correctOptionIndex) correctCount++;
                                  });
                                  const score = (correctCount / totalQuestions) * 100;
                                  setQuizScore(score);
                                  setQuizSubmitted(true);
                                  if (score >= (selectedItem.quizConfig?.passingScore || 70)) {
                                    handleMarkAsCompleted();
                                  }
                                }}
                                disabled={Object.keys(quizAnswers).length < selectedItem.quizConfig.questions.length}
                                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
                              >
                                {t('eir.submitAnswersBtn', 'Enviar Respostas')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

