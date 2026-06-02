import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, browserPopupRedirectResolver } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, deleteDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, Role } from '../types';
import { analyticsService } from '../services/analyticsService';
import { gamificationService } from '../services/gamificationService';

interface AuthContextType {
  user: any;
  userProfile: UserProfile | null;
  permissions: string[];
  roleName: string | null;
  isAdminMode: boolean;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  toggleAdminMode: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  permissions: [],
  roleName: null,
  isAdminMode: true,
  loading: true,
  login: async () => {},
  logout: async () => {},
  toggleAdminMode: () => {},
});

export const useAuth = () => useContext(AuthContext);

const ADMIN_EMAILS = [
  'cesar.bronzatto@xertica.com',
  'gustavo.paula@xertica.com',
  'kefreen.batista@xertica.com'
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(() => {
    const saved = localStorage.getItem('isAdminMode');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [loading, setLoading] = useState(true);
  const hasLoggedAccess = React.useRef(false);

  const toggleAdminMode = () => {
    const newMode = !isAdminMode;
    setIsAdminMode(newMode);
    localStorage.setItem('isAdminMode', JSON.stringify(newMode));
  };

  const login = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      hd: 'xertica.com'
    });
    // Use browserPopupRedirectResolver to improve reliability in iframes
    await signInWithPopup(auth, provider, browserPopupRedirectResolver);
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        hasLoggedAccess.current = false;
        const userRef = doc(db, 'users', currentUser.uid);
        
        // Check if profile exists with UID
        const userSnap = await getDoc(userRef);
        const emailRef = doc(db, 'users', currentUser.email!);
        const emailSnap = await getDoc(emailRef);

        if (!userSnap.exists()) {
          if (emailSnap.exists()) {
            // Migrate pre-registered profile to UID
            const preRegisteredData = emailSnap.data() as UserProfile;
            const newProfile: UserProfile = {
              ...preRegisteredData,
              uid: currentUser.uid,
              photoURL: currentUser.photoURL || undefined,
              createdAt: preRegisteredData.createdAt || Date.now()
            };
            
            // Sanitize to avoid undefined values
            const sanitizedProfile = JSON.parse(JSON.stringify(newProfile));
            await setDoc(userRef, sanitizedProfile);
            try {
              await deleteDoc(emailRef);
            } catch (error) {
              console.warn("Could not delete legacy email doc:", error);
            }
          } else {
            // First login: create new profile
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuário',
              email: currentUser.email || '',
              photoURL: currentUser.photoURL || undefined,
              isActive: true,
              createdAt: Date.now(),
              points: 0,
              weeklyPoints: 0,
              level: 1,
              badges: [],
              isOnboarding: true,
              onboardingTasks: {
                welcomeVideo: false,
                exploreWall: false,
                firstRecognition: false,
                checkLeaderboard: false,
                firstModule: false
              }
            };
            await setDoc(userRef, newProfile);
          }
        } else {
          // Profile exists: update photoURL if it changed
          const existingData = userSnap.data() as UserProfile;
          if (currentUser.photoURL && existingData.photoURL !== currentUser.photoURL) {
            await updateDoc(userRef, { photoURL: currentUser.photoURL });
          }
          
          if (emailSnap.exists()) {
            // Both exist: Merge pre-registered data into UID profile
            const preRegisteredData = emailSnap.data() as UserProfile;
            const existingData = userSnap.data() as UserProfile;
            
            // Prefer fields from the official import (pre-registered)
            const updateData: any = {};
            if (preRegisteredData.jobTitle) updateData.jobTitle = preRegisteredData.jobTitle;
            if (preRegisteredData.leaderName) updateData.leaderName = preRegisteredData.leaderName;
            if (preRegisteredData.leaderEmail) updateData.leaderEmail = preRegisteredData.leaderEmail;
            if (preRegisteredData.roleId) updateData.roleId = preRegisteredData.roleId;
            if (preRegisteredData.areaId) updateData.areaId = preRegisteredData.areaId;
            if (preRegisteredData.projectIds) updateData.projectIds = preRegisteredData.projectIds;
            if (preRegisteredData.countryId) updateData.countryId = preRegisteredData.countryId;
            if (preRegisteredData.country) updateData.country = preRegisteredData.country;
            
            // Merge points/level if pre-registered has more
            if ((preRegisteredData.points || 0) > (existingData.points || 0)) updateData.points = preRegisteredData.points;
            if ((preRegisteredData.level || 1) > (existingData.level || 1)) updateData.level = preRegisteredData.level;

            if (Object.keys(updateData).length > 0) {
              await updateDoc(userRef, updateData);
            }
            
            // Delete the duplicate email-based document
            try {
              await deleteDoc(emailRef);
            } catch (error) {
              console.warn("Could not delete legacy email doc:", error);
            }
          }
        }

        // Check streak on login (secretly)
        gamificationService.checkStreak(currentUser.uid);

        // Setup real-time listener for profile
        unsubscribeProfile = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const profile = docSnap.data() as UserProfile;
            
            // Ensure photoURL is synced from auth if missing in firestore
            if (!profile.photoURL && currentUser.photoURL) {
              profile.photoURL = currentUser.photoURL;
            }
            
            setUserProfile(profile);
            
            // Unblock user if blocked for missed deadline (new policy)
            if (profile.isBlocked && profile.blockReason === 'prazo_perdido') {
              await updateDoc(userRef, { isBlocked: false, blockReason: null });
            }
            
            // Admin check - Only grant admin permissions if in Admin Mode
            const isAdmin = currentUser.email && ADMIN_EMAILS.includes(currentUser.email);
            if (isAdmin) {
              setRoleName('Management Team');
              if (isAdminMode) {
                setPermissions(['view_admin', 'view_analytics', 'manage_users', 'manage_roles', 'manage_learning', 'view_team']);
              } else {
                // In Leader Mode, admins get leader permissions + basic student access
                setPermissions(['view_team']);
              }
            } else if (profile.roleId) {
              // Non-admin users should not be in Admin Mode
              if (isAdminMode) setIsAdminMode(false);
              
              // Load permissions from role
              const roleSnap = await getDoc(doc(db, 'roles', profile.roleId));
              if (roleSnap.exists()) {
                const roleData = roleSnap.data() as Role;
                setPermissions(roleData.permissions || []);
                setRoleName(roleData.name);
              }
            } else {
              setPermissions([]);
              setRoleName(null);
            }
            
            // Log access once
            if (!hasLoggedAccess.current) {
              analyticsService.logAccess(currentUser.uid, profile.areaId);
              hasLoggedAccess.current = true;
            }
          }
          setLoading(false);
        });
      } else {
        setUserProfile(null);
        setPermissions([]);
        setLoading(false);
        if (unsubscribeProfile) unsubscribeProfile();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [isAdminMode]);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
    setPermissions([]);
    setRoleName(null);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, permissions, roleName, isAdminMode, loading, login, logout, toggleAdminMode }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
