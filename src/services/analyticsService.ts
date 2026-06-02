import { collection, addDoc, getDocs, query, where, orderBy, Timestamp, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface AccessLog {
  userId: string;
  areaId?: string;
  timestamp: number;
  date: string; // YYYY-MM-DD for easier grouping
}

export const analyticsService = {
  /**
   * Logs a user access
   */
  async logAccess(userId: string, areaId?: string) {
    if (!userId || userId.startsWith('mock_')) return;

    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      
      await addDoc(collection(db, 'access_logs'), {
        userId,
        areaId: areaId || null,
        timestamp: Date.now(),
        date: dateStr
      });
    } catch (error) {
      console.error('Error logging access:', error);
    }
  },

  /**
   * Fetches access counts for the last 7 days
   */
  async getWeeklyAccessStats(areaId?: string) {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      let q;
      if (areaId) {
        q = query(
          collection(db, 'access_logs'),
          where('areaId', '==', areaId),
          where('timestamp', '>=', sevenDaysAgo.getTime()),
          orderBy('timestamp', 'asc')
        );
      } else {
        q = query(
          collection(db, 'access_logs'),
          where('timestamp', '>=', sevenDaysAgo.getTime()),
          orderBy('timestamp', 'asc')
        );
      }

      const querySnapshot = await getDocs(q);
      const logs = querySnapshot.docs.map(doc => doc.data() as AccessLog);

      // Group by day
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
      const last7Days = [];
      
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayName = days[d.getDay()];
        
        const count = logs.filter(log => log.date === dateStr).length;
        
        last7Days.push({
          name: dayName,
          users: count,
          fullDate: dateStr
        });
      }

      return last7Days;
    } catch (error) {
      console.error('Error fetching access stats:', error);
      return [];
    }
  }
};
