import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Recognition } from '../types';
import { notificationService } from './notificationService';
import { gamificationService } from './gamificationService';

export const recognitionService = {
  async createRecognition(recognition: Omit<Recognition, 'id' | 'createdAt'>, testMode: boolean = false) {
    try {
      const recognitionData = {
        ...recognition,
        createdAt: Date.now()
      };
      const docRef = await addDoc(collection(db, 'recognitions'), recognitionData);
      
      // Award points (only if not in testMode)
      if (!testMode) {
        // Receiver gets 15 points
        await gamificationService.addPoints(
          recognition.toUserId, 
          15, 
          `Recebeu um reconhecimento de ${recognition.fromUserName}`
        );
        
        // Sender gets 5 points
        await gamificationService.addPoints(
          recognition.fromUserId, 
          5, 
          `Reconheceu o colega ${recognition.toUserName}`
        );
      }

      // Trigger email notifications
      // If testMode is true, only send to the recognizer (the current user)
      if (testMode) {
        notificationService.notifyRecognition(recognitionData, recognition.fromUserId);
      } else {
        notificationService.notifyRecognition(recognitionData);
      }
      
      return docRef.id;
    } catch (error) {
      console.error("Error creating recognition:", error);
      throw error;
    }
  },

  subscribeToRecognitions(callback: (recognitions: Recognition[]) => void) {
    const q = query(collection(db, 'recognitions'), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const recognitions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Recognition));
      callback(recognitions);
    }, (error) => {
      console.error("Error subscribing to recognitions:", error);
    });
  },

  async deleteRecognition(id: string) {
    try {
      await deleteDoc(doc(db, 'recognitions', id));
    } catch (error) {
      console.error("Error deleting recognition:", error);
      throw error;
    }
  }
};
