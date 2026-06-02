import { doc, updateDoc, getDoc, increment, query, where, collection, getDocs, addDoc, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { UserProfile, PointHistory } from '../types';
import { LEVEL_CONFIGS, DEFAULT_LEVEL_CONFIG } from '../constants/gamification';
import { notificationService } from './notificationService';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  const errorString = JSON.stringify(errInfo, null, 2);
  console.error('Firestore Error: ', errorString);
}

export const gamificationService = {
  /**
   * Adds points to a user and handles level progression
   */
  async addPoints(userId: string, pointsToAdd: number, reason: string = 'Atividade concluída') {
    if (userId.startsWith('mock_')) {
      console.log(`[Mock] Added ${pointsToAdd} points to user ${userId}`);
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        console.error('User profile not found for gamification update');
        return;
      }

      const currentData = userSnap.data() as UserProfile;
      const isUserOnboarding = currentData.isOnboarding || false;
      const newPoints = (currentData.points || 0) + pointsToAdd;
      
      // Calculate new level (e.g., 1000 points per level)
      const newLevel = Math.floor(newPoints / 1000) + 1;
      
      const updates: any = {
        points: increment(pointsToAdd),
        weeklyPoints: increment(pointsToAdd),
      };

      if (isUserOnboarding) {
        updates.onboardingPoints = increment(pointsToAdd);
      }

      // If leveled up, update level and potentially award a badge
      if (newLevel > (currentData.level || 1)) {
        updates.level = newLevel;
        
        // Dynamic badge logic based on level
        const currentBadges = currentData.badges || [];
        const hasLevelBadge = currentBadges.some(b => b.id === `level_${newLevel}`);
        
        if (!hasLevelBadge) {
          const config = LEVEL_CONFIGS[newLevel] || { 
            ...DEFAULT_LEVEL_CONFIG,
            name: `${DEFAULT_LEVEL_CONFIG.name} Nível ${newLevel}`, 
            desc: `${DEFAULT_LEVEL_CONFIG.desc} Você alcançou o nível ${newLevel}.` 
          };

          const newBadge = {
            id: `level_${newLevel}`,
            name: config.name,
            description: config.desc,
            icon: config.icon,
            color: config.color,
            earnedAt: Date.now()
          };
          updates.badges = [...currentBadges, newBadge];
        }
      }

      await updateDoc(userRef, updates);

      // Record history
      await addDoc(collection(db, 'point_history'), {
        userId,
        areaId: currentData.areaId,
        points: newPoints,
        change: pointsToAdd,
        reason,
        createdAt: Date.now()
      });

      console.log(`Successfully added ${pointsToAdd} points to user ${userId}. New level: ${newLevel}`);
    } catch (error) {
      console.error('Error updating gamification data:', error);
    }
  },

  /**
   * Awards points for engagement (comments, likes, replies)
   */
  async awardEngagementPoints(userId: string, type: 'comment' | 'reply' | 'like') {
    const pointsMap = {
      comment: 5,
      reply: 10,
      like: 2
    };
    
    const points = pointsMap[type];
    await this.addPoints(userId, points, 'Engajamento na comunidade');
  },

  /**
   * Awards points for time milestones (every 15 minutes)
   */
  async awardTimeMilestonePoints(userId: string, totalSeconds: number, currentAwarded: number): Promise<number> {
    const milestoneSeconds = 900; // 15 minutes
    const pointsPerMilestone = 10;
    
    const totalMilestones = Math.floor(totalSeconds / milestoneSeconds);
    const awardedMilestones = currentAwarded / pointsPerMilestone;
    
    const newMilestones = totalMilestones - awardedMilestones;
    
    if (newMilestones > 0) {
      const pointsToAdd = newMilestones * pointsPerMilestone;
      await this.addPoints(userId, pointsToAdd, 'Dedicação ao aprendizado');
      return currentAwarded + pointsToAdd;
    }
    
    return currentAwarded;
  },

  /**
   * Checks and updates user login streak (secretly)
   */
  async checkStreak(userId: string) {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const userData = userSnap.data() as UserProfile;
      const now = new Date();
      const lastLogin = userData.lastLoginAt ? new Date(userData.lastLoginAt) : null;
      
      // Reset time to compare only dates
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const yesterday = today - (24 * 60 * 60 * 1000);
      
      if (!lastLogin) {
        // First login ever tracked
        await updateDoc(userRef, { 
          lastLoginAt: Date.now(),
          streakDays: 1 
        });
        return;
      }

      const lastLoginDay = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate()).getTime();

      if (lastLoginDay === today) {
        // Already logged in today
        return;
      }

      if (lastLoginDay === yesterday) {
        // Consecutive day!
        const newStreak = (userData.streakDays || 0) + 1;
        const updates: any = { 
          lastLoginAt: Date.now(),
          streakDays: newStreak 
        };

        // Award points for 3-day streak (secretly)
        if (newStreak % 3 === 0) {
          await this.addPoints(userId, 50, 'Consistência na plataforma');
        }

        await updateDoc(userRef, updates);
      } else {
        // Streak broken
        await updateDoc(userRef, { 
          lastLoginAt: Date.now(),
          streakDays: 1 
        });
      }
    } catch (error) {
      console.error('Error checking streak:', error);
    }
  },

  /**
   * Removes points from a user (for corrections)
   */
  async removePoints(userId: string, pointsToRemove: number, reason: string = 'Correção de pontos') {
    if (userId.startsWith('mock_')) {
      console.log(`[Mock] Removed ${pointsToRemove} points from user ${userId}`);
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) return;

      const currentData = userSnap.data() as UserProfile;
      const currentPoints = currentData.points || 0;
      const newPoints = Math.max(0, currentPoints - pointsToRemove);
      
      // Calculate new level
      const newLevel = Math.floor(newPoints / 1000) + 1;
      
      const updates: any = {
        points: newPoints,
        weeklyPoints: Math.max(0, (currentData.weeklyPoints || 0) - pointsToRemove),
        level: newLevel
      };

      await updateDoc(userRef, updates);

      // Record history
      await addDoc(collection(db, 'point_history'), {
        userId,
        areaId: currentData.areaId,
        points: newPoints,
        change: -pointsToRemove,
        reason,
        createdAt: Date.now()
      });

      console.log(`Successfully removed ${pointsToRemove} points from user ${userId}. New level: ${newLevel}`);
    } catch (error) {
      console.error('Error removing points:', error);
    }
  },

  /**
   * Fetches point history for a user
   */
  async getPointHistory(userId: string, areaId?: string): Promise<PointHistory[]> {
    const path = 'point_history';
    try {
      let q = query(
        collection(db, path),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      if (areaId) {
        q = query(
          collection(db, path),
          where('userId', '==', userId),
          where('areaId', '==', areaId),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
      }

      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as PointHistory));
    } catch (error) {
      if (error instanceof Error && error.message.includes('permission')) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
      console.error('Error fetching point history:', error);
      return [];
    }
  },

  /**
   * Penalizes a user and their leader for a missed deadline
   */
  async penalizeForMissedDeadline(userId: string, leaderEmail: string | undefined, trailId: string, penaltyAmount: number = 300) {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const userData = userSnap.data() as UserProfile;
      const penalizedTrails = userData.penalizedTrails || [];

      if (penalizedTrails.includes(trailId)) return;

      // 1. Penalize User
      await this.removePoints(userId, penaltyAmount, `Penalidade: Prazo perdido na trilha ${trailId}`);
      
      // 2. Update Overdue Status (Instead of Blocking)
      const currentOverdueCount = userData.overdueTrailsCount || 0;
      await updateDoc(userRef, {
        hasOverdueTrails: true,
        overdueTrailsCount: currentOverdueCount + 1,
        penalizedTrails: [...penalizedTrails, trailId]
      });

      // 3. Create Notification for User
      await notificationService.createNotification({
        userId,
        title: '⚠️ Prazo Expirado',
        message: `Você perdeu o prazo da trilha "${trailId}". Sua conta não foi bloqueada, mas você perdeu ${penaltyAmount} pontos. Por favor, conclua a trilha o quanto antes.`,
        type: 'general',
        link: `/trail/${trailId}`
      });

      // 4. Penalize Leader if exists and Notify
      if (leaderEmail) {
        const leaderQuery = query(collection(db, 'users'), where('email', '==', leaderEmail.toLowerCase()));
        const leaderSnap = await getDocs(leaderQuery);
        if (!leaderSnap.empty) {
          const leaderId = leaderSnap.docs[0].id;
          await this.removePoints(leaderId, penaltyAmount, `Penalidade: Prazo perdido pelo liderado (${userData.name})`);
          
          // Notify Leader specifically about the missed deadline
          await notificationService.notifyLeader(
            userData.name,
            leaderEmail,
            `perdeu o prazo da trilha "${trailId}". Uma penalidade de pontos foi aplicada a ambos`
          );
        }
      }

      console.log(`User ${userId} penalized for missing deadline on trail ${trailId}`);
    } catch (error) {
      console.error('Error in penalizeForMissedDeadline:', error);
    }
  },

  /**
   * Awards a specific badge to a user
   */
  async awardBadge(userId: string, badgeId: string, badgeName: string, badgeDescription: string, icon: string = 'Award') {
    if (userId.startsWith('mock_')) {
      console.log(`[Mock] Awarded badge ${badgeName} to user ${userId}`);
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) return;

      const currentData = userSnap.data() as UserProfile;
      const currentBadges = currentData.badges || [];
      
      if (currentBadges.some(b => b.id === badgeId)) return;

      const newBadge = {
        id: badgeId,
        name: badgeName,
        description: badgeDescription,
        icon,
        earnedAt: Date.now()
      };

      await updateDoc(userRef, {
        badges: [...currentBadges, newBadge]
      });
    } catch (error) {
      console.error('Error awarding badge:', error);
    }
  }
};
