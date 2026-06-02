import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Video, HelpCircle, FileText, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LiveSession() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useTranslation();
  
  const [activeSidebar, setActiveSidebar] = React.useState<'quiz' | 'activities'>('quiz');

  return (
    <div className={`h-[calc(100vh-4rem)] flex flex-col ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Header */}
      <header className={`flex items-center justify-between px-6 py-3 border-b ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold font-heading text-lg">Sessão ao Vivo de Onboarding - Google Meet</h1>
          </div>
        </div>
      </header>

      {/* Main Content Areas */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Video Area */}
        <div className={`flex-1 flex flex-col items-center justify-center p-8 ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
            <Video className="w-24 h-24 text-blue-500 mb-6" />
            <h2 className="text-2xl font-bold mb-4 font-heading text-center">Entre na Chamada do Google Meet</h2>
            <p className="text-slate-500 text-center mb-8 max-w-lg">
               Para garantir a melhor qualidade e segurança na sua reunião, o Google Meet abrirá em uma nova aba. Mantenha esta janela aberta para participar dos quizzes integrados e acessar o material de apoio.
            </p>
            <a 
              href="https://meet.google.com/new" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-3 transition-transform hover:scale-105 shadow-lg"
            >
              <ExternalLink className="w-5 h-5" />
              ABRIR GOOGLE MEET
            </a>
            <p className="text-sm text-slate-400 mt-6">*Se você foi convidado por e-mail, o link oficial está no seu Google Agenda.</p>
        </div>

        {/* Sidebar Interactions */}
        <div className={`w-96 border-l flex flex-col ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          {/* Sidebar Navigation */}
          <div className="flex border-b border-inherit">
            <button
              onClick={() => setActiveSidebar('quiz')}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeSidebar === 'quiz' 
                  ? 'border-brand-500 text-brand-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Interações
            </button>
            <button
              onClick={() => setActiveSidebar('activities')}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeSidebar === 'activities' 
                  ? 'border-brand-500 text-brand-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Atividades
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {activeSidebar === 'quiz' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                   <h3 className="font-bold mb-2 flex items-center gap-2"><HelpCircle className="w-4 h-4 text-brand-500"/> Quiz Relâmpago</h3>
                   <p className="text-sm mb-4">Qual é o principal valor da nossa cultura abordado até agora?</p>
                   <div className="space-y-2">
                     {['Foco no Cliente', 'Inovação Constante', 'Trabalho em Equipe'].map(opt => (
                       <button key={opt} className={`w-full text-left px-3 py-2 text-sm rounded border transition-colors ${theme === 'dark' ? 'border-slate-600 hover:bg-slate-700' : 'border-slate-300 hover:bg-slate-100'}`}>
                         {opt}
                       </button>
                     ))}
                   </div>
                </div>

                <div className={`p-4 rounded-lg border border-dashed ${theme === 'dark' ? 'border-slate-700' : 'border-slate-300'} text-center`}>
                  <p className="text-sm text-slate-500">O apresentador pode lançar novos quizzes a qualquer momento.</p>
                </div>
              </motion.div>
            )}

            {activeSidebar === 'activities' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                   <h3 className="font-bold mb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500"/> Material de Apoio</h3>
                   <a href="#" className="text-sm text-blue-500 hover:underline flex items-center gap-1"><ArrowLeft className="w-3 h-3 rotate-180"/> Download do PDF de Cultura</a>
                </div>
              </motion.div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
