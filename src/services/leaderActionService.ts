import { collection, addDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { LeaderAction } from '../types';

export const leaderActionService = {
  async createAction(action: Omit<LeaderAction, 'id'>) {
    try {
      const docRef = await addDoc(collection(db, 'leader_actions'), {
        ...action,
        createdAt: Date.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating leader action:', error);
      throw error;
    }
  },

  async getActionsByUser(userId: string) {
    try {
      const q = query(
        collection(db, 'leader_actions'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaderAction));
    } catch (error) {
      console.error('Error fetching leader actions:', error);
      return [];
    }
  },

  async getActionsByLeader(leaderId: string) {
    try {
      const q = query(
        collection(db, 'leader_actions'),
        where('leaderId', '==', leaderId),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaderAction));
    } catch (error) {
      console.error('Error fetching leader actions:', error);
      return [];
    }
  }
};
