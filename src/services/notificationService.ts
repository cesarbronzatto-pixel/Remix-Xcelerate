import { collection, addDoc, getDoc, getDocs, query, where, updateDoc, doc, orderBy, limit, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Notification, Trail, UserProgress, Module, Recognition, UserProfile, Role, Area } from '../types';

export const notificationService = {
  async createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>, recipientEmail?: string) {
    const docRef = await addDoc(collection(db, 'notifications'), {
      ...notification,
      isRead: false,
      createdAt: Date.now(),
    });

    // If an email is provided, send it
    if (recipientEmail) {
      this.sendEmail(recipientEmail, notification.title, notification.message);
    }

    return docRef;
  },

  async sendEmail(to: string, subject: string, message: string, htmlContent?: string) {
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject: `Xcelerate: ${subject}`,
          text: message,
          html: htmlContent || `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #003366;">Xcelerate</h2>
            <p>${message}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #666;">Esta é uma notificação automática do sistema Xcelerate.</p>
          </div>`
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Error sending email to ${to}:`, errorData);
      }
    } catch (error) {
      console.error("Error calling send-email API:", error);
    }
  },

  async notifyAllUsers(title: string, message: string, type: 'new_trail' | 'new_module', link?: string) {
    try {
      const usersSnap = await getDocs(query(collection(db, 'users'), where('isActive', '==', true)));
      const batch = writeBatch(db);
      
      const notifications = usersSnap.docs.map(userDoc => {
        const userData = userDoc.data() as UserProfile;
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          userId: userDoc.id,
          title,
          message,
          type,
          link,
          isRead: false,
          createdAt: Date.now(),
        });
        return { email: userData.email, title, message };
      });

      await batch.commit();

      // Send individual emails sequentially to avoid overwhelming the server
      for (const notif of notifications) {
        if (notif.email) {
          await this.sendEmail(notif.email, notif.title, notif.message);
        }
      }
    } catch (error) {
      console.error("Error sending notifications to all users:", error);
    }
  },

  async notifyRecognition(recognition: Recognition, targetUserIdOnly?: string) {
    try {
      // 1. Fetch details for recognizer and recognized (needed for email content)
      const fromUserDoc = await getDoc(doc(db, 'users', recognition.fromUserId));
      const toUserDoc = await getDoc(doc(db, 'users', recognition.toUserId));

      if (!fromUserDoc.exists() || !toUserDoc.exists()) {
        console.warn("Recognizer or recognized user not found in database");
        return;
      }

      const fromUser = { uid: fromUserDoc.id, ...fromUserDoc.data() } as UserProfile;
      const toUser = { uid: toUserDoc.id, ...toUserDoc.data() } as UserProfile;

      // 2. Fetch roles and areas to get names
      const [rolesSnap, areasSnap] = await Promise.all([
        getDocs(collection(db, 'roles')),
        getDocs(collection(db, 'areas'))
      ]);
      
      const roles = rolesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Role));
      const areas = areasSnap.docs.map(d => ({ id: d.id, ...d.data() } as Area));

      const fromRole = roles.find(r => r.id === fromUser.roleId)?.name || fromUser.jobTitle || 'Colaborador';
      const fromArea = areas.find(a => a.id === fromUser.areaId)?.name || 'Geral';
      
      const toRole = roles.find(r => r.id === toUser.roleId)?.name || toUser.jobTitle || 'Colaborador';
      const toArea = areas.find(a => a.id === toUser.areaId)?.name || 'Geral';

      // 3. Determine recipients
      let recipients: UserProfile[] = [];
      if (targetUserIdOnly) {
        const targetDoc = await getDoc(doc(db, 'users', targetUserIdOnly));
        if (targetDoc.exists()) {
          recipients = [{ uid: targetDoc.id, ...targetDoc.data() } as UserProfile];
        }
      } else {
        const usersSnap = await getDocs(query(collection(db, 'users'), where('isActive', '==', true)));
        recipients = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      }

      if (recipients.length === 0) return;

      const subject = `Novo Reconhecimento: ${recognition.toUserName} recebeu uma estrela!`;
      const message = `${recognition.fromUserName} reconheceu ${recognition.toUserName}!\n\n` +
                      `Quem reconheceu:\n` +
                      `- Nome: ${recognition.fromUserName}\n` +
                      `- Cargo: ${fromRole}\n` +
                      `- Área: ${fromArea}\n\n` +
                      `Quem foi reconhecido:\n` +
                      `- Nome: ${recognition.toUserName}\n` +
                      `- Cargo: ${toRole}\n` +
                      `- Área: ${toArea}\n\n` +
                      `Motivo:\n"${recognition.reason}"`;

      const html = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 40px;">⭐</span>
            <h2 style="color: #4f46e5; margin-top: 10px;">Novo Reconhecimento no Mural!</h2>
          </div>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151;">
            <strong>${recognition.fromUserName}</strong> acaba de dar uma estrela para <strong>${recognition.toUserName}</strong>!
          </p>
          
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="font-size: 14px; text-transform: uppercase; color: #6b7280; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Quem reconheceu</h3>
            <p style="margin: 5px 0;"><strong>Nome:</strong> ${recognition.fromUserName}</p>
            <p style="margin: 5px 0;"><strong>Cargo:</strong> ${fromRole}</p>
            <p style="margin: 5px 0;"><strong>Área:</strong> ${fromArea}</p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="font-size: 14px; text-transform: uppercase; color: #6b7280; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Quem foi reconhecido</h3>
            <p style="margin: 5px 0;"><strong>Nome:</strong> ${recognition.toUserName}</p>
            <p style="margin: 5px 0;"><strong>Cargo:</strong> ${toRole}</p>
            <p style="margin: 5px 0;"><strong>Área:</strong> ${toArea}</p>
          </div>
          
          <div style="border-left: 4px solid #4f46e5; padding-left: 15px; margin: 20px 0; font-style: italic; color: #4b5563;">
            <p style="font-size: 16px;">"${recognition.reason}"</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${window.location.origin}/recognition-wall" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ver Mural de Reconhecimento</a>
          </div>
          
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">Esta é uma notificação automática do sistema Xcelerate.</p>
        </div>
      `;

      for (const user of recipients) {
        if (user.email) {
          await this.sendEmail(user.email, subject, message, html);
        }
      }

    } catch (error) {
      console.error("Error in notifyRecognition:", error);
    }
  },

  async getNotifications(userId: string) {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return [];
    }
  },

  async markAsRead(notificationId: string) {
    try {
      return updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  },

  async markAllAsRead(userId: string) {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('isRead', '==', false)
      );
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => {
        batch.update(d.ref, { isRead: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  },

  async notifyLeader(subordinateName: string, leaderEmail: string, action: string) {
    if (!leaderEmail) return;
    try {
      // Find leader's UID by email
      const q = query(collection(db, 'users'), where('email', '==', leaderEmail.toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) return;
      
      const leaderUid = snap.docs[0].id;
      await this.createNotification({
        userId: leaderUid,
        title: 'Atualização da Equipe',
        message: `${subordinateName} ${action}.`,
        type: 'general'
      }, leaderEmail);
    } catch (error) {
      console.error("Error notifying leader:", error);
    }
  },

  async checkDeadlines(userId: string, userProfile: any) {
    if (!userId || !userProfile) return;

    try {
      // 1. Fetch all active trails
      const trailsSnap = await getDocs(query(collection(db, 'trails'), where('isActive', '==', true)));
      const trails = trailsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Trail));

      // 2. Fetch user progress
      const progressSnap = await getDocs(query(collection(db, 'user_progress'), where('userId', '==', userId)));
      const userProgress = progressSnap.docs.map(d => d.data() as UserProgress);

      // 3. Fetch modules to calculate progress percentage
      const modulesSnap = await getDocs(collection(db, 'modules'));
      const allModules = modulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Module));

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      for (const trail of trails) {
        // 1. Check if user is "enrolled" or "required" to do this trail
        const hasProgress = userProgress.some(p => p.trailId === trail.id);
        const isMandatory = trail.isMandatory;
        const isForUserArea = trail.areaIds?.includes(userProfile.areaId || '');
        const isPublic = trail.isPublic;

        // User is required to do it if it's mandatory, for their area, or they started it
        const isRequired = hasProgress || isMandatory || isForUserArea;
        
        // If it's a public trail and they haven't started it, don't notify
        if (isPublic && !hasProgress && !isMandatory && !isForUserArea) continue;
        
        // If they are not required and haven't started, skip
        if (!isRequired) continue;

        // Calculate progress
        const trailModules = allModules.filter(m => m.trailId === trail.id);
        if (trailModules.length === 0) continue;

        const completedModules = userProgress.filter(p => p.trailId === trail.id && p.status === 'completed').length;
        const progressPercent = Math.round((completedModules / trailModules.length) * 100);

        // Skip if already completed
        if (progressPercent === 100) continue;

        // Calculate deadline
        let deadlineStr: string | null = null;
        if (trail.isPublic || trail.isSlowTraining) {
          const firstProgress = userProgress.find(p => p.trailId === trail.id && p.enrolledAt);
          if (firstProgress?.enrolledAt) {
            const date = new Date(firstProgress.enrolledAt);
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

        const deadlineDate = new Date(deadlineStr + 'T12:00:00');
        deadlineDate.setHours(0, 0, 0, 0);

        const diffTime = deadlineDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const targetDays = [15, 7, 3, 0];
        
        if (targetDays.includes(diffDays)) {
          // Check if already notified for this trail and this day
          const notificationKey = `${userId}_${trail.id}_${diffDays}`;
          const sentSnap = await getDocs(query(
            collection(db, 'deadline_notifications_sent'),
            where('key', '==', notificationKey)
          ));

          if (sentSnap.empty) {
            // Send notification to user
            const message = diffDays === 0 
              ? `Hoje é o prazo final para concluir a trilha "${trail.title}".`
              : `Faltam ${diffDays} dias para o prazo final da trilha "${trail.title}".`;

            await this.createNotification({
              userId,
              title: 'Prazo de Trilha',
              message,
              type: 'general',
              link: `/trail/${trail.id}`
            }, userProfile.email);

            // Send notification to leader
            if (userProfile.leaderEmail) {
              const leaderMessage = diffDays === 0
                ? `${userProfile.name} tem o prazo final hoje para concluir a trilha "${trail.title}".`
                : `Faltam ${diffDays} dias para ${userProfile.name} concluir o prazo da trilha "${trail.title}".`;
              
              await this.notifyLeader(userProfile.name, userProfile.leaderEmail, leaderMessage);
            }

            // Mark as sent
            await addDoc(collection(db, 'deadline_notifications_sent'), {
              key: notificationKey,
              userId,
              trailId: trail.id,
              daysRemaining: diffDays,
              sentAt: Date.now()
            });
          }
        }
      }
    } catch (error) {
      console.error("Error checking deadlines:", error);
    }
  }
};
