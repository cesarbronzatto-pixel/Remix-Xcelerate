import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PlaybookContent, PlaybookSession } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, FileText, Presentation, Video as VideoIcon, Link as LinkIcon, ExternalLink, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';

// --- Sessions Constant (Deprecated - now dynamic) ---
// const SESSIONS = [
//   { id: 'fairDecision', label: 'Fair Decision Making', icon: '⚖️' },
//   { id: 'culture', label: 'Cultura e Valores', icon: '🌟' },
//   { id: 'gemini', label: 'Gemini Enterprise', icon: '✨' },
//   { id: 'cloud', label: 'Google Cloud', icon: '☁️' },
//   { id: 'workspace', label: 'Google Workspace', icon: '💼' }
// ];

export default function PlaybookSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [contents, setContents] = useState<PlaybookContent[]>([]);
  const [session, setSession] = useState<PlaybookSession | null>(null);
  const [loading, setLoading] = useState(true);

  const handleTrackAccess = async (content: PlaybookContent) => {
    if (!userProfile) return;
    try {
      await addDoc(collection(db, 'playbook_access_logs'), {
        userId: userProfile.uid,
        userName: userProfile.name,
        userEmail: userProfile.email,
        contentId: content.id,
        contentTitle: content.title,
        sessionId: sessionId,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("Error tracking playbook access:", error);
    }
  };

  useEffect(() => {
    const fetchSessionAndContents = async () => {
      if (!sessionId) return;
      setLoading(true);
      try {
        // Fetch Session Info
        const sessionDoc = await getDoc(doc(db, 'playbook_sessions', sessionId));
        if (sessionDoc.exists()) {
          setSession({ id: sessionDoc.id, ...sessionDoc.data() } as PlaybookSession);
        }

        // Fetch Contents
        const q = query(
          collection(db, 'playbook_content'),
          where('sessionId', '==', sessionId),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        setContents(snap.docs.map(d => ({ id: d.id, ...d.data() } as PlaybookContent)));
      } catch (error) {
        console.error("Error fetching playbook session data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSessionAndContents();
  }, [sessionId]);

  if (!session) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold">Sessão não encontrada</h1>
        <button onClick={() => navigate('/')} className="mt-4 text-blue-500 hover:underline">Voltar ao Dashboard</button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <div className="max-w-6xl mx-auto p-4 sm:p-8 lg:p-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <button 
            onClick={() => navigate(-1)}
            className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'bg-slate-900 hover:bg-slate-800 text-slate-400' : 'bg-white hover:bg-slate-100 text-slate-600 shadow-sm'}`}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-4">
            {session.imageUrl ? (
              <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800">
                <img src={session.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            ) : (
              <div className="text-4xl">{session.icon}</div>
            )}
            <div>
              <h1 className="text-3xl font-black tracking-tight">{session.title}</h1>
              <p className="text-slate-500">Playbook da Empresa</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : contents.length === 0 ? (
          <div className={`p-12 rounded-2xl border text-center ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">Nenhum material disponível para esta sessão ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {contents.map((content, i) => (
              <motion.a
                key={content.id}
                href={content.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleTrackAccess(content)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`group flex flex-col rounded-2xl overflow-hidden border transition-all hover:scale-[1.02] hover:shadow-2xl ${
                  theme === 'dark' 
                    ? 'bg-slate-900 border-slate-800 hover:border-blue-500/50' 
                    : 'bg-white border-slate-200 hover:border-blue-200 shadow-sm'
                }`}
              >
                {/* Imagem de Capa */}
                <div className="aspect-video w-full overflow-hidden relative bg-slate-800">
                  {content.imageUrl ? (
                    <img 
                      src={content.imageUrl} 
                      alt={content.title} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        // Fallback if image fails to load
                        (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${content.id}/800/450`;
                      }}
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <BookOpen className="w-12 h-12 text-slate-400 opacity-20" />
                    </div>
                  )}
                  
                  {/* Overlay Gradiente */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  {/* Badge de Tipo */}
                  <div className="absolute top-4 right-4">
                    <div className={`w-10 h-10 rounded-xl backdrop-blur-md flex items-center justify-center shadow-lg ${
                      content.type === 'pdf' ? 'bg-red-500/90 text-white' :
                      content.type === 'presentation' ? 'bg-amber-500/90 text-white' :
                      content.type === 'video' ? 'bg-blue-500/90 text-white' :
                      'bg-slate-600/90 text-white'
                    }`}>
                      {content.type === 'pdf' ? <FileText className="w-5 h-5" /> :
                       content.type === 'presentation' ? <Presentation className="w-5 h-5" /> :
                       content.type === 'video' ? <VideoIcon className="w-5 h-5" /> :
                       <LinkIcon className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className={`font-bold text-lg leading-tight group-hover:text-blue-500 transition-colors ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {content.title}
                    </h3>
                    <ExternalLink className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                  </div>
                  
                  {content.description && (
                    <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                      {content.description}
                    </p>
                  )}
                  
                  <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {content.type === 'pdf' ? 'Documento PDF' :
                       content.type === 'presentation' ? 'Apresentação' :
                       content.type === 'video' ? 'Vídeo Aula' :
                       'Link Externo'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(content.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
