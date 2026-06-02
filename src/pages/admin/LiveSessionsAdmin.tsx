import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { initWorkspaceAuth, googleSignInForWorkspace } from '../../lib/workspaceAuth';
import { Video, Calendar as CalendarIcon, Users, Plus, Loader2, Link as LinkIcon, Trash2, Mail, CheckCircle2, ShieldAlert } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'sonner';

interface LocalSession {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  durationMinutes: number;
  meetLink: string;
  attendees: string[];
  schedulingMode: 'automatic' | 'manual';
  createdAt: number;
}

export default function LiveSessionsAdmin() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { userProfile } = useAuth();
  
  // Google Auth State (Optional now)
  const [needsGoogleAuth, setNeedsAuth] = useState(true);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState(false);
  
  // App States
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [schedulingMode, setSchedulingMode] = useState<'automatic' | 'manual'>('manual');

  const [formData, setFormData] = useState({
    title: 'Sessão de Onboarding Xcelerate',
    date: new Date().toISOString().split('T')[0],
    time: '14:00',
    durationMinutes: 60,
    description: 'Sessão de boas-vindas e introdução à cultura.',
    meetLink: '', // Used in manual mode
    attendees: ''
  });

  // Listen for Google Auth state
  useEffect(() => {
    const unsubscribe = initWorkspaceAuth(
      (user, cachedToken) => {
        setGoogleToken(cachedToken);
        setNeedsAuth(false);
      },
      () => setNeedsAuth(true)
    );
    return () => unsubscribe();
  }, []);

  // Listen for Live Sessions in Firestore in real-time
  useEffect(() => {
    const q = query(collection(db, 'live_sessions'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedSessions: LocalSession[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        loadedSessions.push({
          id: doc.id,
          title: data.title || '',
          description: data.description || '',
          date: data.date || '',
          time: data.time || '',
          durationMinutes: data.durationMinutes || 60,
          meetLink: data.meetLink || '',
          attendees: data.attendees || [],
          schedulingMode: data.schedulingMode || 'manual',
          createdAt: data.createdAt || Date.now()
        });
      });
      setSessions(loadedSessions);
    }, (error) => {
      console.error("Error listening to live sessions:", error);
      toast.error("Erro ao carregar sessões ao vivo.");
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoggingInGoogle(true);
    try {
      const result = await googleSignInForWorkspace();
      if (result) {
        setGoogleToken(result.accessToken);
        setNeedsAuth(false);
        toast.success('Conectado ao Google Workspace com sucesso!');
      }
    } catch (err) {
      console.error('Google login failed:', err);
      toast.error('Erro ao conectar com o Google. Verifique os pop-ups.');
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  const sendEmailInvites = async (sessionData: {
    id: string;
    title: string;
    description: string;
    date: string;
    time: string;
    durationMinutes: number;
    meetLink: string;
    attendees: string[];
  }) => {
    const { id, title, description, date, time, durationMinutes, meetLink, attendees } = sessionData;
    if (attendees.length === 0) return;

    const formattedDate = new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const liveUrl = `${window.location.origin}/live/${id}`;

    const htmlEmail = `
      <div style="font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background-color: #0f172a; color: #f8fafc; padding: 40px; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #1e293b; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 1px solid #1e293b; padding-bottom: 20px;">
          <h1 style="color: #00beff; font-size: 32px; margin: 0; font-weight: 800; letter-spacing: -1px;">Xcelerate</h1>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 5px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">Onboarding Interativo de Talentos</p>
        </div>
        <div style="background-color: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 30px;">
          <h2 style="font-size: 20px; color: #ffffff; margin-top: 0; margin-bottom: 15px; border-bottom: 2px solid #00beff; padding-bottom: 10px; font-weight: 700;">Você foi convidado! 📆</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1; margin-bottom: 20px;">Olá! Você recebeu um convite oficial para participar da nossa sessão de onboarding ao vivo:</p>
          <p style="font-size: 18px; color: #ffffff; font-weight: 800; text-align: center; background-color: #0f172a; padding: 12px; border-radius: 8px; border: 1px solid #334155;">
            ${title}
          </p>
          
          <div style="margin-top: 25px; margin-bottom: 25px; background: rgba(0, 190, 255, 0.05); padding: 20px; border-radius: 8px; border-left: 4px solid #00beff;">
            <p style="font-size: 15px; margin: 8px 0; color: #cbd5e1;">📅 <strong>Data:</strong> <span style="color: #ffffff; font-weight: 600;">${formattedDate}</span></p>
            <p style="font-size: 15px; margin: 8px 0; color: #cbd5e1;">🕒 <strong>Horário:</strong> <span style="color: #ffffff; font-weight: 600;">${time}h</span></p>
            <p style="font-size: 15px; margin: 8px 0; color: #cbd5e1;">⏱️ <strong>Duração:</strong> <span style="color: #ffffff; font-weight: 600;">${durationMinutes} minutos</span></p>
          </div>
          
          <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 10px; font-weight: bold;">📝 Pauta da Reunião:</p>
          <div style="font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 20px; padding: 15px; background-color: #0f172a; border-radius: 8px; border: 1px solid #1e293b;">
            ${description.replace(/\n/g, '<br/>')}
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; margin-bottom: 30px;">
          <a href="${liveUrl}" style="display: inline-block; background-color: #00beff; color: #000000; font-weight: 800; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 15px; box-shadow: 0 4px 15px rgba(0, 190, 255, 0.3); margin-bottom: 10px; border: none; transition: all 0.2s;">ABRIR PAINEL INTERATIVO</a>
          <br/>
          <a href="${meetLink}" style="display: inline-block; background-color: transparent; color: #00beff; font-weight: 700; padding: 10px 20px; text-decoration: underline; font-size: 14px; margin-top: 5px;">Acessar Google Meet diretamente</a>
        </div>
        
        <p style="text-align: center; font-size: 12px; color: #64748b; margin-top: 40px; border-top: 1px solid #1e293b; padding-top: 20px; line-height: 1.5;">
          *<strong>Dica de ouro</strong>: Abra o Google Meet e posicione-o em metade da tela, mantendo o nosso Painel Interativo na outra metade! Assim você poderá interagir com as dinâmicas e quizzes sem perder nenhum detalhe da chamada de vídeo.
        </p>
      </div>
    `;

    // Send emails in background
    for (const email of attendees) {
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email,
            subject: `Convite Onboarding: ${title}`,
            html: htmlEmail,
            text: `Olá! Você foi convidado para a sessão de Onboarding ao vivo: ${title} no dia ${formattedDate} às ${time}. Acesse o painel interativo: ${liveUrl}`
          })
        });
      } catch (err) {
        console.error(`Failed to send email to ${email}:`, err);
      }
    }
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();

    if (schedulingMode === 'automatic' && needsGoogleAuth) {
      toast.error('Você precisa conectar sua conta do Google Workspace para agendar de forma automática!');
      return;
    }

    if (schedulingMode === 'manual' && !formData.meetLink.trim()) {
      toast.error('Por favor, insira o link da chamada do Google Meet!');
      return;
    }

    const attendeeList = formData.attendees
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email !== '');

    if (attendeeList.length === 0) {
      toast.error('Insira pelo menos um e-mail de convidado!');
      return;
    }

    const confirmed = window.confirm(`Deseja agendar esta sessão e disparar os e-mails de convite para os ${attendeeList.length} participantes?`);
    if (!confirmed) return;

    setIsLoading(true);
    let finalMeetLink = formData.meetLink.trim();

    try {
      // Pre-generate Firestore document reference and ID to get the Live URL
      const sessionDocRef = doc(collection(db, 'live_sessions'));
      const sessionId = sessionDocRef.id;
      const liveUrl = `${window.location.origin}/live/${sessionId}`;

      // MODE 1: Google Calendar API Integration
      if (schedulingMode === 'automatic' && googleToken) {
        const startDateTime = new Date(`${formData.date}T${formData.time}:00`).toISOString();
        const endDateTime = new Date(new Date(startDateTime).getTime() + formData.durationMinutes * 60000).toISOString();
        
        const googleAttendeeList = attendeeList.map(email => ({ email }));

        // Append the Live Panel Link clearly to the Google Calendar Event Description
        const googleDescription = `${formData.description}\n\n👉 ABRIR PAINEL INTERATIVO XCELERATE: ${liveUrl}\n\n💡 Dica de ouro: Abra o Google Meet em metade da tela e o Painel Interativo na outra metade para interagir em tempo real com quizzes e dinâmicas!`;

        const eventBody = {
          summary: formData.title,
          description: googleDescription,
          start: { dateTime: startDateTime },
          end: { dateTime: endDateTime },
          attendees: googleAttendeeList,
          conferenceData: {
            createRequest: {
              requestId: `meet_${Math.random().toString(36).substring(2, 11)}`,
              conferenceSolutionKey: {
                type: 'hangoutsMeet'
              }
            }
          }
        };

        const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${googleToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(eventBody)
        });

        if (!res.ok) {
          const errData = await res.json();
          console.error("Google Calendar Error:", errData);
          throw new Error('Falha ao agendar reunião no Google Calendar API.');
        }

        const createdEvent = await res.json();
        finalMeetLink = createdEvent.hangoutLink || '';
        
        if (!finalMeetLink) {
          throw new Error('Google Calendar não retornou um link do Meet.');
        }
      }

      // Add to Firestore database with the pre-generated ID
      const newSessionData = {
        title: formData.title,
        description: formData.description,
        date: formData.date,
        time: formData.time,
        durationMinutes: formData.durationMinutes,
        meetLink: finalMeetLink,
        attendees: attendeeList,
        schedulingMode,
        createdAt: Date.now()
      };

      await setDoc(sessionDocRef, newSessionData);

      // Trigger custom nodemailer email invitations in the background
      await sendEmailInvites({
        id: sessionId,
        ...newSessionData
      });

      toast.success('Sessão agendada no Firestore e convites disparados por e-mail!');
      
      // Reset form
      setFormData({
        title: 'Sessão de Onboarding Xcelerate',
        date: new Date().toISOString().split('T')[0],
        time: '14:00',
        durationMinutes: 60,
        description: 'Sessão de boas-vindas e introdução à cultura.',
        meetLink: '',
        attendees: ''
      });
      
    } catch (error: any) {
      console.error(error);
      toast.error(`Ocorreu um erro ao agendar a sessão: ${error.message || ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    const confirmed = window.confirm('Tem certeza de que deseja cancelar e excluir esta sessão? Os participantes não poderão mais acessá-la.');
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'live_sessions', sessionId));
      toast.success('Sessão cancelada e removida com sucesso.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir sessão.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header Banner info */}
      <div className={`p-6 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-gradient-to-r from-blue-950/40 to-slate-900 border-blue-900/40' : 'bg-gradient-to-r from-blue-50 to-slate-50 border-blue-100 shadow-sm'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black">Sessões de Integração Onboarding</h2>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                Agende dinâmicas com Google Meet e interações em tempo real (quizzes, slides, documentos).
              </p>
            </div>
          </div>
          
          {/* Google Workspace Auth Status */}
          <div className="flex items-center gap-2">
            {needsGoogleAuth ? (
              <button 
                onClick={handleGoogleLogin} 
                disabled={isLoggingInGoogle} 
                className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-2 ${
                  theme === 'dark' 
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' 
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {isLoggingInGoogle ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : (
                  <>
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                    Conectar Google Workspace
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-500 text-xs font-black">
                <CheckCircle2 className="w-4 h-4" />
                Google Conectado
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Schedule Form (7 cols) */}
        <div className={`lg:col-span-7 p-6 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          
          {/* Scheduling mode selector */}
          <div className="flex border-b border-inherit mb-6">
            <button
              onClick={() => setSchedulingMode('manual')}
              className={`flex-1 pb-3 text-sm font-black transition-colors border-b-2 flex items-center justify-center gap-2 ${
                schedulingMode === 'manual' 
                  ? 'border-blue-500 text-blue-500' 
                  : 'border-transparent text-slate-500 hover:text-slate-400'
              }`}
            >
              <LinkIcon className="w-4 h-4" />
              Link Direto (Mais Rápido e Seguro)
            </button>
            <button
              onClick={() => setSchedulingMode('automatic')}
              className={`flex-1 pb-3 text-sm font-black transition-colors border-b-2 flex items-center justify-center gap-2 ${
                schedulingMode === 'automatic' 
                  ? 'border-blue-500 text-blue-500' 
                  : 'border-transparent text-slate-500 hover:text-slate-400'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              Automático (Google Calendar API)
            </button>
          </div>

          <form onSubmit={handleSchedule} className="space-y-4">
            
            {schedulingMode === 'automatic' && needsGoogleAuth && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500 text-xs flex gap-3 mb-4">
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="font-bold">Google Workspace Desconectado!</p>
                  <p className="mt-0.5 opacity-90">Clique no botão "Conectar Google Workspace" no cabeçalho antes de agendar para que possamos acessar sua agenda.</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Título da Sessão</label>
              <input 
                required 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})}
                className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${
                  theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                }`} 
                placeholder="Ex: Boas-vindas novos contratados"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Data</label>
                <input 
                  required 
                  type="date"
                  value={formData.date} 
                  onChange={e => setFormData({...formData, date: e.target.value})}
                  className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                  }`} 
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Horário de Início</label>
                <input 
                  required 
                  type="time"
                  value={formData.time} 
                  onChange={e => setFormData({...formData, time: e.target.value})}
                  className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                  }`} 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Duração (Minutos)</label>
                <input 
                  required 
                  type="number"
                  min="15"
                  step="15"
                  value={formData.durationMinutes} 
                  onChange={e => setFormData({...formData, durationMinutes: parseInt(e.target.value)})}
                  className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                  }`} 
                />
              </div>

              {schedulingMode === 'manual' && (
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Link do Google Meet</label>
                  <input 
                    required={schedulingMode === 'manual'}
                    type="url"
                    value={formData.meetLink} 
                    onChange={e => setFormData({...formData, meetLink: e.target.value})}
                    placeholder="https://meet.google.com/abc-defg-hij"
                    className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                    }`} 
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Convidados (E-mails separados por vírgula)</label>
              <textarea 
                required
                rows={3}
                placeholder="cesar.bronzatto@xertica.com, aluno2@xertica.com"
                value={formData.attendees} 
                onChange={e => setFormData({...formData, attendees: e.target.value})}
                className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${
                  theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                }`} 
              />
              <p className="text-[10px] text-slate-400 mt-1">Dispararemos um convite HTML premium automatizado para todos estes e-mails no momento do agendamento.</p>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Pauta / Descrição</label>
              <textarea 
                rows={3}
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})}
                className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${
                  theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                }`} 
                placeholder="Insira detalhes sobre as dinâmicas ou material de apoio a ser discutido..."
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/15 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    <Video className="w-5 h-5" /> 
                    {schedulingMode === 'manual' ? 'Agendar e Disparar Convites' : 'Agendar via Google e Disparar'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Side: Upcoming Sessions List (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className={`p-6 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2 border-b pb-3 border-inherit">
              <CalendarIcon className="w-4 h-4 text-indigo-500" />
              Sessões Agendadas no Xcelerate ({sessions.length})
            </h3>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
              {sessions.length === 0 ? (
                <div className="text-center py-10">
                  <Video className="w-10 h-10 text-slate-500/30 mx-auto mb-2" />
                  <p className="text-slate-400 text-xs">Nenhuma sessão agendada no Firestore.</p>
                </div>
              ) : (
                sessions.map((session) => (
                  <div 
                    key={session.id} 
                    className={`p-4 rounded-xl border flex flex-col gap-3 group relative transition-all ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800/80 hover:border-slate-700' : 'bg-slate-50 border-slate-200 hover:shadow-sm'
                    }`}
                  >
                    
                    {/* Floating Delete button */}
                    <button 
                      onClick={() => handleDeleteSession(session.id)}
                      className="absolute top-4 right-4 p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      title="Cancelar Sessão"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          session.schedulingMode === 'manual' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {session.schedulingMode === 'manual' ? 'Link Direto' : 'Google API'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(`${session.date}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} • {session.time}h
                        </span>
                      </div>
                      
                      <h4 className="font-bold text-sm mt-1.5 line-clamp-1 pr-6">{session.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{session.description}</p>
                    </div>

                    <div className="flex items-center justify-between border-t border-dashed border-inherit pt-3 mt-1">
                      <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold">
                        <Users className="w-3.5 h-3.5" />
                        {session.attendees.length} Convidado(s)
                      </div>

                      <div className="flex gap-2">
                        <a 
                          href={session.meetLink} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex items-center gap-1 text-[10px] font-black text-emerald-500 hover:underline bg-emerald-500/5 px-2 py-1 rounded"
                        >
                          <LinkIcon className="w-3 h-3" /> Meet
                        </a>
                        <a 
                          href={`/live/${session.id}`} 
                          className="flex items-center gap-1 text-[10px] font-black text-blue-500 hover:underline bg-blue-500/5 px-2 py-1 rounded"
                        >
                          Painel Interativo
                        </a>
                      </div>
                    </div>

                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
