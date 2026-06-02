import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { initWorkspaceAuth, googleSignInForWorkspace, getWorkspaceToken } from '../../lib/workspaceAuth';
import { Video, Calendar as CalendarIcon, Users, Plus, Loader2, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function LiveSessionsAdmin() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  
  const [needsAuth, setNeedsAuth] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    title: 'Sessão de Onboarding Xcelerate',
    date: new Date().toISOString().split('T')[0],
    time: '14:00',
    durationMinutes: 60,
    description: 'Sessão de boas-vindas e introdução à cultura.',
    attendees: ''
  });

  useEffect(() => {
    const unsubscribe = initWorkspaceAuth(
      (user, cachedToken) => {
        setToken(cachedToken);
        setNeedsAuth(false);
      },
      () => setNeedsAuth(true)
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignInForWorkspace();
      if (result) {
        setToken(result.accessToken);
        setNeedsAuth(false);
        toast.success('Conectado ao Google Workspace');
      }
    } catch (err) {
      console.error('Login failed:', err);
      toast.error('Erro ao conectar com Google. Verifique popups.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const loadEvents = async () => {
    if (!token) return;
    try {
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=' + new Date().toISOString() + '&maxResults=10&orderBy=startTime&singleEvents=true', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.items || []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (token && !needsAuth) {
      loadEvents();
    }
  }, [token, needsAuth]);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const confirmed = window.confirm('Criar este evento no Google Agenda e enviar invites para os participantes listados?');
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const startDateTime = new Date(`${formData.date}T${formData.time}:00`).toISOString();
      const endDateTime = new Date(new Date(startDateTime).getTime() + formData.durationMinutes * 60000).toISOString();
      
      const attendeeList = formData.attendees.split(',').map(e => e.trim()).filter(e => e).map(email => ({ email }));

      const eventBody = {
        summary: formData.title,
        description: formData.description,
        start: { dateTime: startDateTime },
        end: { dateTime: endDateTime },
        attendees: attendeeList.length > 0 ? attendeeList : undefined,
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
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventBody)
      });

      if (!res.ok) {
        throw new Error('Falha ao criar evento');
      }

      const createdEvent = await res.json();
      toast.success('Evento criado e invites enviados (Google Meet)!');
      toast.info(`Link do Meet: ${createdEvent.hangoutLink}`);
      
      setFormData({ ...formData, attendees: '' });
      loadEvents();
      
    } catch (error) {
      console.error(error);
      toast.error('Ocorreu um erro ao agendar a sessão.');
    } finally {
      setIsLoading(false);
    }
  };

  if (needsAuth) {
    return (
      <div className={`p-8 flex flex-col items-center justify-center min-h-[400px] border rounded-lg ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <Video className="w-16 h-16 text-blue-500 mb-6" />
        <h2 className="text-xl font-bold mb-2">Integração Google Meet & Agenda</h2>
        <p className="text-slate-500 text-center mb-8 max-w-md">
          Para criar sessões ao vivo e enviar convites automaticamente, você precisa conectar sua conta do Google Workspace.
        </p>
        <button onClick={handleLogin} disabled={isLoggingIn} className="gsi-material-button w-64 bg-white text-slate-800 border border-slate-300 rounded shadow-sm hover:bg-slate-50 flex items-center justify-center py-2 px-4 gap-3 transition">
          {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin text-slate-500" /> : (
            <>
               <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                 <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                 <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                 <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                 <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                 <path fill="none" d="M0 0h48v48H0z"></path>
               </svg>
               <span className="font-medium text-sm">Entrar com o Google</span>
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Schedule Form */}
      <div className={`p-6 rounded-lg border shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-2 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}">
          <CalendarIcon className="w-5 h-5 text-indigo-500" />
          Agendar Nova Sessão Meet
        </h3>
        <form onSubmit={handleSchedule} className="space-y-4 pt-2">
          
          <div>
            <label className="block text-sm font-medium mb-1">Título da Sessão</label>
            <input 
              required 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})}
              className={`w-full px-3 py-2 rounded border focus:ring-2 focus:ring-indigo-500 focus:outline-none ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'}`} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Data</label>
              <input 
                required 
                type="date"
                value={formData.date} 
                onChange={e => setFormData({...formData, date: e.target.value})}
                className={`w-full px-3 py-2 rounded border focus:ring-2 focus:ring-indigo-500 focus:outline-none ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'}`} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Horário</label>
              <input 
                required 
                type="time"
                value={formData.time} 
                onChange={e => setFormData({...formData, time: e.target.value})}
                className={`w-full px-3 py-2 rounded border focus:ring-2 focus:ring-indigo-500 focus:outline-none ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'}`} 
              />
            </div>
          </div>

          <div>
             <label className="block text-sm font-medium mb-1">Duração (Minutos)</label>
             <input 
                required 
                type="number"
                min="15"
                step="15"
                value={formData.durationMinutes} 
                onChange={e => setFormData({...formData, durationMinutes: parseInt(e.target.value)})}
                className={`w-full px-3 py-2 rounded border focus:ring-2 focus:ring-indigo-500 focus:outline-none ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'}`} 
              />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Convidados (E-mails separados por vírgula)</label>
            <textarea 
              rows={3}
              placeholder="aluno1@empresa.com, aluno2@empresa.com"
              value={formData.attendees} 
              onChange={e => setFormData({...formData, attendees: e.target.value})}
              className={`w-full px-3 py-2 rounded border focus:ring-2 focus:ring-indigo-500 focus:outline-none ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'}`} 
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Descrição / Pauta</label>
            <textarea 
              rows={3}
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})}
              className={`w-full px-3 py-2 rounded border focus:ring-2 focus:ring-indigo-500 focus:outline-none ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'}`} 
            />
          </div>

          <div className="pt-4">
             <button
               type="submit"
               disabled={isLoading}
               className="w-full flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-medium transition"
             >
               {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Video className="w-5 h-5" /> Agendar Google Meet</>}
             </button>
          </div>
        </form>
      </div>

      {/* Upcoming Events List */}
       <div className={`p-6 rounded-lg border shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-2 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}">
          <CalendarIcon className="w-5 h-5 text-indigo-500" />
          Próximas Sessões na sua Agenda
        </h3>

        <div className="space-y-4">
          {events.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">Nenhum evento futuro encontrado.</p>
          ) : (
            events.map((evt, idx) => (
              <div key={idx} className={`p-4 rounded border flex flex-col gap-2 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex justify-between items-start">
                   <h4 className="font-bold">{evt.summary || 'Evento sem título'}</h4>
                   {evt.hangoutLink && (
                      <a href={evt.hangoutLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-500 hover:underline bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                         <LinkIcon className="w-3 h-3" /> Meet
                      </a>
                   )}
                </div>
                <p className="text-xs text-slate-500">
                  {new Date(evt.start.dateTime || evt.start.date).toLocaleString()}
                </p>
                {evt.attendees && (
                   <p className="text-xs flex items-center gap-1">
                     <Users className="w-3 h-3" /> {evt.attendees.length} convidados
                   </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
