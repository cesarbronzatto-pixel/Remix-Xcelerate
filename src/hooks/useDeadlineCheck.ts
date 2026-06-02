import { useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Trail, Module, UserProgress } from '../types';
import { gamificationService } from '../services/gamificationService';
import { toast } from 'sonner';

export const useDeadlineCheck = () => {
  const { user, userProfile } = useAuth();

  useEffect(() => {
    if (!user || !userProfile || userProfile.isBlocked) return;

    const checkDeadlines = async () => {
      try {
        // 1. Fetch all active trails
        const trailsSnap = await getDocs(collection(db, 'trails'));
        const allTrails = trailsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Trail));
        
        // 2. Fetch user progress for these trails
        const qProgress = query(collection(db, 'user_progress'), where('userId', '==', user.uid));
        const progressSnap = await getDocs(qProgress);
        const userProgress = progressSnap.docs.map(d => d.data() as UserProgress);

        // 3. Fetch all modules to check completion
        const modulesSnap = await getDocs(collection(db, 'modules'));
        const allModules = modulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Module));

        const now = new Date();
        now.setHours(23, 59, 59, 999); // End of current day

        for (const trail of allTrails) {
          if (!trail.isActive) continue;
          
          // Calculate dynamic deadline
          let deadlineStr: string | null = null;
          if (trail.isPublic || trail.isSlowTraining) {
            const progress = userProgress.find(p => p.trailId === trail.id);
            if (progress?.enrolledAt) {
              const date = new Date(progress.enrolledAt);
              date.setDate(date.getDate() + 90);
              deadlineStr = date.toISOString().split('T')[0];
            }
          } else if (trail.isOnboardingTrail && userProfile.onboardingActivatedAt) {
            const date = new Date(userProfile.onboardingActivatedAt);
            date.setDate(date.getDate() + 7);
            deadlineStr = date.toISOString().split('T')[0];
          } else if (trail.deadline) {
            deadlineStr = trail.deadline;
          }

          if (!deadlineStr) continue;

          const deadlineDate = new Date(deadlineStr + 'T23:59:59');
          if (deadlineDate < now) {
            // Check if trail is completed
            const trailModules = allModules.filter(m => m.trailId === trail.id);
            const completedModules = userProgress.filter(p => p.trailId === trail.id && p.status === 'completed');

            if (trailModules.length > 0 && completedModules.length < trailModules.length) {
              // Deadline missed!
              await gamificationService.penalizeForMissedDeadline(
                user.uid,
                userProfile.leaderEmail,
                trail.id!
              );
              toast.error('Prazo Expirado', {
                description: `Você e seu líder perderam 300 pontos por não concluir a trilha "${trail.title}" no prazo. Conclua-a agora para regularizar sua situação.`,
                duration: 10000
              });
              // Stop after first penalty to avoid multiple blocks at once
              break;
            }
          }
        }
      } catch (error) {
        console.error('Error checking deadlines:', error);
      }
    };

    checkDeadlines();
  }, [user, userProfile]);
};
