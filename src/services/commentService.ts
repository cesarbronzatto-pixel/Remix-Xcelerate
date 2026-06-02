import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  doc, 
  deleteDoc,
  arrayUnion,
  arrayRemove,
  getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Comment } from '../types';
import { gamificationService } from './gamificationService';

export const commentService = {
  addComment: async (comment: Omit<Comment, 'id'>) => {
    try {
      const docRef = await addDoc(collection(db, 'comments'), comment);
      return docRef.id;
    } catch (error) {
      console.error("Error adding comment:", error);
      throw error;
    }
  },

  getComments: (moduleId: string, callback: (comments: Comment[]) => void) => {
    const q = query(
      collection(db, 'comments'),
      where('moduleId', '==', moduleId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const comments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Comment));
      callback(comments);
    });
  },

  toggleLike: async (commentId: string, userId: string) => {
    try {
      const commentRef = doc(db, 'comments', commentId);
      const commentSnap = await getDoc(commentRef);
      
      if (commentSnap.exists()) {
        const likes = commentSnap.data().likes || [];
        if (likes.includes(userId)) {
          await updateDoc(commentRef, {
            likes: arrayRemove(userId)
          });
        } else {
          const newLikesCount = likes.length + 1;
          await updateDoc(commentRef, {
            likes: arrayUnion(userId)
          });

          // Award points for community validation (secretly)
          if (newLikesCount === 5) {
            const authorId = commentSnap.data().userId;
            await gamificationService.addPoints(authorId, 20, 'Reconhecimento da comunidade');
          }
        }
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      throw error;
    }
  },

  deleteComment: async (commentId: string) => {
    try {
      await deleteDoc(doc(db, 'comments', commentId));
    } catch (error) {
      console.error("Error deleting comment:", error);
      throw error;
    }
  }
};
