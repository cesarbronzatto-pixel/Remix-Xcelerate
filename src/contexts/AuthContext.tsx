import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, browserPopupRedirectResolver } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, deleteDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, Role } from '../types';
import { analyticsService } from '../services/analyticsService';
import { gamificationService } from '../services/gamificationService';
import { toast } from 'sonner';

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
  const unsubscribeProfileRef = React.useRef<(() => void) | null>(null);

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
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      // Clean up previous profile snapshot listener if any
      if (unsubscribeProfileRef.current) {
        try {
          unsubscribeProfileRef.current();
        } catch (e) {
          console.warn("Error cleaning up previous snapshot listener:", e);
        }
        unsubscribeProfileRef.current = null;
      }
      
      if (currentUser) {
        toast.info(`🔐 AuthStateChanged: Logged in as ${currentUser.email} (${currentUser.uid})`);
        try {
          hasLoggedAccess.current = false;
          const userRef = doc(db, 'users', currentUser.uid);
          
          // Check if profile exists with UID
          let userSnap;
          let emailSnap;
          try {
            userSnap = await getDoc(userRef);
            toast.info(`📄 userSnap: exists=${userSnap.exists()}`);
          } catch (e: any) {
            toast.error(`❌ Error reading userSnap (UID doc): ${e.message || e}`);
            console.error("userSnap read error:", e);
          }

          try {
            const emailRef = doc(db, 'users', currentUser.email!);
            emailSnap = await getDoc(emailRef);
            toast.info(`📄 emailSnap: exists=${emailSnap.exists()}`);
          } catch (e: any) {
            toast.error(`❌ Error reading emailSnap (Email doc): ${e.message || e}`);
            console.error("emailSnap read error:", e);
          }

          if (userSnap && !userSnap.exists()) {
            if (emailSnap && emailSnap.exists()) {
              toast.info(`🔄 Migrating pre-registered email doc to UID...`);
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
              toast.success(`✅ Profile migrated successfully!`);
              try {
                const emailRef = doc(db, 'users', currentUser.email!);
                await deleteDoc(emailRef);
              } catch (error) {
                console.warn("Could not delete legacy email doc:", error);
              }
            } else {
              toast.info(`➕ First login: Creating new user profile doc...`);
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
              toast.success(`✅ New user profile doc created!`);
            }
          } else if (userSnap) {
            // Profile exists: update photoURL if it changed
            const existingData = userSnap.data() as UserProfile;
            if (currentUser.photoURL && existingData.photoURL !== currentUser.photoURL) {
              await updateDoc(userRef, { photoURL: currentUser.photoURL });
            }
            
            if (emailSnap && emailSnap.exists()) {
              toast.info(`🔄 Merging duplicate email doc into UID profile...`);
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
                const emailRef = doc(db, 'users', currentUser.email!);
                await deleteDoc(emailRef);
                toast.success(`✅ Duplicate email doc deleted & merged!`);
              } catch (error) {
                console.warn("Could not delete legacy email doc:", error);
              }
            }
          }

          // Check streak on login (secretly)
          try {
            gamificationService.checkStreak(currentUser.uid);
          } catch (error) {
            console.warn("Could not check streak on login:", error);
          }

          toast.info(`📡 Subscribing to profile snapshot (UID: ${currentUser.uid})...`);
          // Setup real-time listener for profile
          const unsub = onSnapshot(userRef, async (docSnap) => {
            try {
              toast.info(`📥 Received profile snapshot: exists=${docSnap.exists()}`);
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
                const isAdmin = currentUser.email && ADMIN_EMAILS.includes(currentUser.email.toLowerCase());
                toast.info(`🔑 Admin check: isAdmin=${isAdmin}, isAdminMode=${isAdminMode}`);
                if (isAdmin) {
                  setRoleName('Management Team');
                  if (isAdminMode) {
                    const adminPermissions = ['view_admin', 'view_analytics', 'manage_users', 'manage_roles', 'manage_learning', 'view_team'];
                    setPermissions(adminPermissions);
                    toast.success(`⭐ Admin permissions assigned: ${JSON.stringify(adminPermissions)}`);
                  } else {
                    // In Leader Mode, admins get leader permissions + basic student access
                    setPermissions(['view_team']);
                    toast.info(`👥 Leader permissions assigned: ['view_team']`);
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
                    toast.info(`👤 Standard role permissions assigned: ${JSON.stringify(roleData.permissions || [])}`);
                  } else {
                    toast.warning(`⚠️ Role document not found: ${profile.roleId}`);
                  }
                } else {
                  setPermissions([]);
                  setRoleName(null);
                  toast.warning(`⚠️ User profile has no roleId!`);
                }
                
                // Log access once
                if (!hasLoggedAccess.current) {
                  analyticsService.logAccess(currentUser.uid, profile.areaId);
                  hasLoggedAccess.current = true;
                }
              } else {
                toast.warning(`⚠️ Profile document does not exist in snapshot callback!`);
              }
            } catch (error: any) {
              toast.error(`❌ Error processing profile snapshot: ${error.message || error}`);
              console.error("Error processing profile snapshot:", error);
            } finally {
              setLoading(false);
            }
          }, (error) => {
            toast.error(`❌ Profile snapshot listener error: ${error.message || error}`);
            console.error("Profile snapshot listener error:", error);
            setLoading(false);
          });

          // Save the unsubscribe function to the ref
          unsubscribeProfileRef.current = unsub;
        } catch (error: any) {
          toast.error(`❌ Error in auth state callback: ${error.message || error}`);
          console.error("Error loading user profile data:", error);
          setLoading(false);
        }
      } else {
        setUserProfile(null);
        setPermissions([]);
        setLoading(false);
        if (unsubscribeProfileRef.current) {
          try {
            unsubscribeProfileRef.current();
          } catch (e) {
            console.warn("Error unsubscribing profile snapshot on logout/null user:", e);
          }
          unsubscribeProfileRef.current = null;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfileRef.current) {
        try {
          unsubscribeProfileRef.current();
        } catch (e) {
          console.warn("Error unsubscribing profile snapshot on cleanup:", e);
        }
        unsubscribeProfileRef.current = null;
      }
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
