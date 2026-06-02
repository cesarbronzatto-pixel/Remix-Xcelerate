import { collection, addDoc, doc, updateDoc, getDocs, query, where, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OnboardingFeedback, UserProfile } from '../types';
import { gamificationService } from './gamificationService';
import { recognitionService } from './recognitionService';

export const onboardingService = {
  /**
   * Saves onboarding feedback and awards 50 points
   */
  async submitFeedback(feedback: Omit<OnboardingFeedback, 'id' | 'createdAt'>) {
    try {
      const feedbackData: OnboardingFeedback = {
        ...feedback,
        createdAt: Date.now()
      };

      // 1. Save feedback
      await addDoc(collection(db, 'onboarding_feedback'), feedbackData);

      // 2. Award 50 total points (not onboarding points)
      await gamificationService.addPoints(feedback.userId, 50, 'Pesquisa de Satisfação de Onboarding');

      // 3. Update user profile
      const userRef = doc(db, 'users', feedback.userId);
      await updateDoc(userRef, {
        onboardingFeedbackCompleted: true,
        onboardingCompletedAt: Date.now(),
        'onboardingTasks.satisfactionSurvey': true
      });

      // 4. Create automatic recognition post in the wall
      await recognitionService.createRecognition({
        fromUserId: 'system',
        fromUserName: 'Xcelerate System',
        toUserId: feedback.userId,
        toUserName: feedback.userName,
        reason: `🎉 Acaba de completar sua jornada de Onboarding! Vamos dar as boas-vindas ao nosso novo talento!`
      });

      return true;
    } catch (error) {
      console.error('Error submitting onboarding feedback:', error);
      throw error;
    }
  },

  /**
   * Sends welcome email to all colleagues in the same country
   */
  async sendWelcomeEmail(userProfile: UserProfile, areaName: string) {
    try {
      // 1. Get all users in the same country
      const countryId = userProfile.countryId;
      const countryName = userProfile.country;
      
      if (!countryId && !countryName) {
        console.warn('User has no countryId or country name, skipping welcome email');
        return;
      }

      let q;
      if (countryId) {
        q = query(collection(db, 'users'), where('countryId', '==', countryId), where('isActive', '==', true));
      } else {
        q = query(collection(db, 'users'), where('country', '==', countryName), where('isActive', '==', true));
      }
      
      const snap = await getDocs(q);
      const recipientEmails = snap.docs
        .map(d => (d.data() as UserProfile).email)
        .filter(email => email && email !== userProfile.email);

      if (recipientEmails.length === 0) {
        console.log(`No colleagues found in ${countryId || countryName} to notify.`);
        return;
      }

      // 2. Prepare email content
      const subject = `🎉 Tem gente nova na área! Vamos dar as boas-vindas ao/à ${userProfile.name}!`;
      const html = `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
          <p>Olá, time! 👋</p>
          <p>É com muita alegria que anunciamos a chegada do/da <strong>${userProfile.name}</strong>, que se junta a nós hoje como nosso(a) novo(a) <strong>${userProfile.jobTitle || 'Colaborador(a)'}</strong> na equipe de <strong>${areaName}</strong>.</p>
          <p>Ele(a) chega para somar forças e nos ajudar nos nossos próximos desafios!</p>
          <p>Por favor, fiquem à vontade para mandar uma mensagem, dar um "oi" e se apresentar.</p>
          <p>Seja muito bem-vindo(a), <strong>${userProfile.name}</strong>! Desejamos muito sucesso nessa nova jornada com a gente.</p>
        </div>
      `;

      // 3. Send email via API
      // We send to all recipients. In a real scenario, we might use BCC or a mailing list.
      // For this implementation, we'll send a single request with multiple recipients if the API supports it,
      // or loop through them. The current /api/send-email takes a single 'to' string.
      
      for (const email of recipientEmails) {
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email,
            subject,
            html
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`Error sending onboarding email to ${email}:`, errorData);
        }
      }

      console.log(`Welcome emails sent to ${recipientEmails.length} colleagues in country ${countryId}`);
    } catch (error) {
      console.error('Error sending welcome emails:', error);
    }
  },

  /**
   * Sends a test welcome email to a specific address
   */
  async testWelcomeEmail(targetEmail: string, simulatedUser: Partial<UserProfile>, areaName: string) {
    try {
      const subject = `[TESTE] 🎉 Tem gente nova na área! Vamos dar as boas-vindas ao/à ${simulatedUser.name || 'Nome do Colaborador'}!`;
      const html = `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333; border: 2px dashed #3b82f6; padding: 20px; border-radius: 8px;">
          <p style="color: #3b82f6; font-weight: bold; margin-top: 0;">⚠️ ESTE É UM E-MAIL DE TESTE</p>
          <p>Olá, time! 👋</p>
          <p>É com muita alegria que anunciamos a chegada do/da <strong>${simulatedUser.name || 'Nome do Colaborador'}</strong>, que se junta a nós hoje como nosso(a) novo(a) <strong>${simulatedUser.jobTitle || 'Cargo'}</strong> na equipe de <strong>${areaName}</strong>.</p>
          <p>Ele(a) chega para somar forças e nos ajudar nos nossos próximos desafios!</p>
          <p>Por favor, fiquem à vontade para mandar uma mensagem, dar um "oi" e se apresentar.</p>
          <p>Seja muito bem-vindo(a), <strong>${simulatedUser.name || 'Nome do Colaborador'}</strong>! Desejamos muito sucesso nessa nova jornada com a gente.</p>
        </div>
      `;

      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: targetEmail,
          subject,
          html
        })
      });

      return true;
    } catch (error) {
      console.error('Error sending test welcome email:', error);
      throw error;
    }
  }
};
