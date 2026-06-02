import React, { useState } from 'react';
import { Star, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { toast } from 'sonner';

interface TrailSurveyProps {
  userId: string;
  trailId: string;
  trailTitle: string;
  onComplete: () => void;
}

export const TrailSurvey: React.FC<TrailSurveyProps> = ({ userId, trailId, trailTitle, onComplete }) => {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Por favor, selecione uma nota de 1 a 5.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Save survey response
      await addDoc(collection(db, 'trail_surveys'), {
        userId,
        trailId,
        rating,
        feedback,
        createdAt: Date.now()
      });

      // 2. Mark survey as completed for the user
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        completedSurveys: arrayUnion(trailId)
      });

      toast.success('Obrigado pelo seu feedback!');
      onComplete();
    } catch (error) {
      console.error('Error submitting survey:', error);
      toast.error('Erro ao enviar pesquisa. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center"
      >
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <Star className="w-8 h-8 text-blue-600 dark:text-blue-400 fill-current" />
        </div>

        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Parabéns! 🎉
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          Você concluiu a trilha <span className="font-bold text-blue-600 dark:text-blue-400">"{trailTitle}"</span>. 
          Sua opinião é muito importante para nós!
        </p>

        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className={`p-2 transition-transform hover:scale-110 ${
                star <= rating ? 'text-yellow-400' : 'text-slate-300 dark:text-slate-600'
              }`}
            >
              <Star className={`w-10 h-10 ${star <= rating ? 'fill-current' : ''}`} />
            </button>
          ))}
        </div>

        <div className="text-left mb-8">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Algum comentário ou sugestão? (Opcional)
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="w-full rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-blue-500 focus:border-blue-500 p-3 text-sm"
            rows={3}
            placeholder="Conte-nos o que achou..."
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting || rating === 0}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Send className="w-5 h-5" />
              Enviar e Finalizar
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
};
