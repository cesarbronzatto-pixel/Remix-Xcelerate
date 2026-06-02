import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Video, HelpCircle, FileText, ExternalLink, Calendar, Clock, Loader2, Monitor, LayoutGrid, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'sonner';

interface SessionData {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  durationMinutes: number;
  meetLink: string;
  attendees: string[];
}

export default function LiveSession() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { userProfile } = useAuth();
  
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSidebar, setActiveSidebar] = useState<'quiz' | 'activities'>('quiz');
  
  // Quiz Simulation States
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      setLoading(true);
      try {
        // If we have a specific session ID, fetch it
        if (id && id !== 'default') {
          const docSnap = await getDoc(doc(db, 'live_sessions', id));
          if (docSnap.exists()) {
            const data = docSnap.data();
            setSession({
              id: docSnap.id,
              title: data.title || '',
              description: data.description || '',
              date: data.date || '',
              time: data.time || '',
              durationMinutes: data.durationMinutes || 60,
              meetLink: data.meetLink || '',
              attendees: data.attendees || []
            });
          } else {
            toast.error("Sessão ao vivo não encontrada.");
          }
        } else {
          // Fallback: search for the latest active session where user is invited
          // Or just fetch the latest session overall
          const q = query(
            collection(db, 'live_sessions'),
            orderBy('createdAt', 'desc'),
            limit(1)
          );
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            const firstDoc = querySnap.docs[0];
            const data = firstDoc.data();
            setSession({
              id: firstDoc.id,
              title: data.title || '',
              description: data.description || '',
              date: data.date || '',
              time: data.time || '',
              durationMinutes: data.durationMinutes || 60,
              meetLink: data.meetLink || '',
              attendees: data.attendees || []
            });
          }
        }
      } catch (err) {
        console.error("Error loading live session:", err);
        toast.error("Erro ao carregar detalhes da sessão.");
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [id, userProfile]);

  if (loading) {
    return (
      <div className={`h-[calc(100vh-4rem)] flex flex-col items-center justify-center ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-sm font-bold text-slate-500">Carregando detalhes da sessão ao vivo...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={`h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <Video className="w-16 h-16 text-slate-500/30 mb-4" />
        <h2 className="text-xl font-black">Nenhuma Sessão Ativa Encontrada</h2>
        <p className="text-slate-500 text-sm text-center max-w-sm mt-1">Nenhuma chamada de onboarding está agendada para o seu perfil no momento.</p>
        <button onClick={() => navigate(-1)} className="mt-6 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all text-xs">
          Voltar para o Início
        </button>
      </div>
    );
  }

  const formattedDate = new Date(`${session.date}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className={`h-[calc(100vh-4rem)] flex flex-col ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Header */}
      <header className={`flex items-center justify-between px-6 py-3 border-b transition-all ${theme === 'dark' ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white shadow-sm'}`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-black uppercase tracking-wider rounded-md">Ao Vivo</span>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{session.time}h • {session.durationMinutes} Minutos</p>
            </div>
            <h1 className="font-black text-base sm:text-lg line-clamp-1">{session.title}</h1>
          </div>
        </div>
      </header>

      {/* Main Content Areas */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Side: Video Preview and Split-Screen Visual Guide */}
        <div className={`flex-1 flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto custom-scrollbar ${theme === 'dark' ? 'bg-slate-950' : 'bg-white'}`}>
            <div className="max-w-2xl w-full space-y-8 text-center">
              
              {/* Meeting Details card */}
              <div className={`p-6 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-slate-900/30 border-slate-800/80' : 'bg-slate-50/80 border-slate-200/80 shadow-sm'}`}>
                <div className="w-14 h-14 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <Video className="w-7 h-7" />
                </div>
                
                <h2 className="text-xl font-black mb-2">Participe da Chamada do Google Meet</h2>
                <p className={`text-xs max-w-md mx-auto mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Para garantir a melhor qualidade e segurança, o Google Meet será aberto em uma nova aba segura.
                </p>
                
                <div className="flex items-center justify-center gap-4 text-xs font-bold text-slate-500 mt-2">
                  <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-blue-500" /> {formattedDate}</span>
                  <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-blue-500" /> {session.time}h</span>
                </div>
              </div>

              {/* STUNNING VISUAL SPLIT-SCREEN LAYOUT GUIDE */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">💡 Dica de Produtividade: Divida a sua tela!</h3>
                
                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto relative p-1.5 rounded-2xl border border-dashed border-blue-500/30 bg-blue-500/5">
                  
                  {/* Left Mock Window (Google Meet) */}
                  <div className={`p-3 rounded-xl border flex flex-col justify-between aspect-video relative overflow-hidden shadow-md ${
                    theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    </div>
                    <div className="flex flex-col items-center justify-center my-2 text-[10px] text-slate-500 font-bold gap-1">
                      <Video className="w-4 h-4 text-emerald-500" />
                      <span>Google Meet</span>
                    </div>
                    <div className="text-[7px] text-slate-400 text-center uppercase tracking-widest font-black">Vídeo Chamada</div>
                  </div>

                  {/* Right Mock Window (Xcelerate Interactive Panel) */}
                  <div className={`p-3 rounded-xl border flex flex-col justify-between aspect-video relative overflow-hidden border-blue-500/80 shadow-md ${
                    theme === 'dark' ? 'bg-slate-900' : 'bg-blue-50/50'
                  }`}>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    </div>
                    <div className="flex flex-col items-center justify-center my-2 text-[10px] text-blue-500 font-bold gap-1">
                      <HelpCircle className="w-4 h-4 text-blue-500 animate-bounce" />
                      <span>Quizzes / Atividades</span>
                    </div>
                    <div className="text-[7px] text-blue-500 text-center uppercase tracking-widest font-black">Xcelerate Panel</div>
                  </div>

                </div>
                
                <p className={`text-[11px] max-w-sm mx-auto leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Arraste a nova aba do Google Meet para o lado esquerdo e mantenha esta janela aberta do lado direito. Assim você participa do vídeo e responde às dinâmicas juntos!
                </p>
              </div>

              {/* Glowing, Pulsing Meet button */}
              <div className="pt-4">
                <a 
                  href={session.meetLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3.5 rounded-2xl font-black text-sm items-center gap-3 transition-all transform hover:scale-105 shadow-xl shadow-blue-600/20 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                  <ExternalLink className="w-5 h-5 text-blue-100" />
                  ABRIR GOOGLE MEET
                </a>
              </div>

            </div>
        </div>

        {/* Right Side: Sidebar Interactions (w-96) */}
        <div className={`w-96 border-l flex flex-col ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          
          {/* Sidebar Navigation */}
          <div className="flex border-b border-inherit">
            <button
              onClick={() => setActiveSidebar('quiz')}
              className={`flex-1 py-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-2 ${
                activeSidebar === 'quiz' 
                  ? 'border-blue-500 text-blue-500' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              Interações
            </button>
            <button
              onClick={() => setActiveSidebar('activities')}
              className={`flex-1 py-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-2 ${
                activeSidebar === 'activities' 
                  ? 'border-blue-500 text-blue-500' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              Atividades
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
            <AnimatePresence mode="wait">
              {activeSidebar === 'quiz' && (
                <motion.div 
                  key="quiz-tab"
                  initial={{ opacity: 0, x: 10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-4"
                >
                  <div className={`p-5 rounded-2xl border transition-all ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800/80' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2 text-blue-500 mb-2">
                      <HelpCircle className="w-5 h-5"/>
                      <span className="text-[10px] font-black uppercase tracking-widest">Quiz Relâmpago</span>
                    </div>
                    
                    <h3 className="font-bold text-sm mb-4 leading-snug">Qual é o principal foco da nossa estratégia de Onboarding Xcelerate?</h3>
                    
                    <div className="space-y-2.5">
                      {[
                        { id: 'A', text: 'Conectar pessoas e transmitir nossa cultura única' },
                        { id: 'B', text: 'Apenas preencher formulários de contratação' },
                        { id: 'C', text: 'Memorizar regras e manuais técnicos' }
                      ].map(opt => {
                        const isSelected = selectedAnswer === opt.id;
                        return (
                          <button 
                            key={opt.id} 
                            disabled={quizSubmitted}
                            onClick={() => setSelectedAnswer(opt.id)}
                            className={`w-full text-left px-4 py-3 text-xs rounded-xl border transition-all flex items-start gap-3 disabled:opacity-75 ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-500/5 text-blue-500 font-bold' 
                                : theme === 'dark' 
                                  ? 'border-slate-800 hover:bg-slate-900 text-slate-300' 
                                  : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center border font-bold text-[10px] flex-shrink-0 ${
                              isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-600'
                            }`}>{opt.id}</span>
                            <span className="pt-0.5">{opt.text}</span>
                          </button>
                        );
                      })}
                    </div>

                    {!quizSubmitted ? (
                      <button
                        onClick={() => {
                          if (!selectedAnswer) {
                            toast.error("Por favor, selecione uma resposta!");
                            return;
                          }
                          setQuizSubmitted(true);
                          toast.success("Resposta enviada com sucesso! +10 pontos 🎉");
                        }}
                        className="w-full mt-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/10"
                      >
                        Enviar Resposta
                      </button>
                    ) : (
                      <div className="mt-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex gap-2 items-center justify-center font-bold">
                        <CheckCircle className="w-4 h-4" />
                        Resposta Enviada! (+10 XP)
                      </div>
                    )}
                  </div>

                  <div className={`p-4 rounded-xl border border-dashed text-center ${
                    theme === 'dark' ? 'border-slate-800' : 'border-slate-300'
                  }`}>
                    <p className="text-[10px] text-slate-400">O apresentador pode lançar novos quizzes a qualquer momento. Mantenha os olhos abertos!</p>
                  </div>
                </motion.div>
              )}

              {activeSidebar === 'activities' && (
                <motion.div 
                  key="activities-tab"
                  initial={{ opacity: 0, x: 10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-4"
                >
                  <div className={`p-5 rounded-2xl border transition-all ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800/80' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2 text-blue-500 mb-4">
                      <FileText className="w-5 h-5"/>
                      <span className="text-[10px] font-black uppercase tracking-widest">Material de Apoio</span>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-bold text-xs">Guia Prático de Onboarding.pdf</h4>
                          <p className="text-[10px] text-slate-400">PDF • 4.2 MB</p>
                        </div>
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); toast.success('Download do arquivo iniciado!'); }}
                          className="text-xs font-black text-blue-500 hover:underline hover:scale-105 transition-transform"
                        >
                          Baixar
                        </a>
                      </div>
                      
                      <div className="border-t border-inherit pt-4 flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-bold text-xs">Slides de Cultura & DNA Xcelerate</h4>
                          <p className="text-[10px] text-slate-400">Google Slides</p>
                        </div>
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); toast.success('Acessando apresentação...'); }}
                          className="text-xs font-black text-blue-500 hover:underline hover:scale-105 transition-transform"
                        >
                          Visualizar
                        </a>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </div>
  );
}
