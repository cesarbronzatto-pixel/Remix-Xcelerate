import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  hd: 'xertica.com',
  prompt: 'select_account'
});
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://www.googleapis.com/auth/meetings.space.created');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initWorkspaceAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignInForWorkspace = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      return { user: result.user, accessToken: cachedAccessToken };
    }
    
    // If we didn't get an explicit token (e.g. they just re-logged in without prompt),
    // we may need to force a re-auth with prompt: 'consent' but we try this first.
    if (!cachedAccessToken) {
        provider.setCustomParameters({ prompt: 'consent' });
        const retryResult = await signInWithPopup(auth, provider);
        const retryCredential = GoogleAuthProvider.credentialFromResult(retryResult);
        if (retryCredential?.accessToken) {
             cachedAccessToken = retryCredential.accessToken;
             return { user: retryResult.user, accessToken: cachedAccessToken };
        }
    }

    return null;
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getWorkspaceToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};
