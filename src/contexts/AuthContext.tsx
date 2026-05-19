import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged,
  signInAnonymously,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  getDoc,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (nickname: string, pin: string, personalPin?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for persistent session
    const savedUserId = localStorage.getItem('wc_player_id');
    
    // Listen for Firebase Auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (fUser) => {
      if (savedUserId) {
        const userDocRef = doc(db, 'users', savedUserId);
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setUser(docSnap.data() as User);
          } else {
            setUser(null);
            localStorage.removeItem('wc_player_id');
          }
          setLoading(false);
        }, (err) => {
          console.error("Firestore Listener Error:", err);
          setLoading(false);
        });

        return () => unsubscribeUser();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const login = async (nickname: string, pin: string, personalPin?: string) => {
    const NORMAL_PIN = '123456';
    const ADMIN_PIN = '999999';

    if (pin !== NORMAL_PIN && pin !== ADMIN_PIN) {
      throw new Error('รหัสกลุ่มไม่ถูกต้อง');
    }

    // Ensure we are signed in anonymously to satisfy Firestore rules
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }

    const sanitizedNickname = nickname.trim().toLowerCase();
    const userId = `user_${sanitizedNickname}`;

    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data() as User;
      
      // If user has a personal pin set, verify it
      if (userData.personalPin && userData.personalPin !== personalPin) {
        if (!personalPin) {
          throw new Error('REQUIRED_PERSONAL_PIN');
        }
        throw new Error('รหัสผ่านส่วนตัวไม่ถูกต้อง');
      }

      setUser(userData);
      localStorage.setItem('wc_player_id', userId);
    } else {
      const role = pin === ADMIN_PIN ? UserRole.ADMIN : UserRole.USER;
      
      const newUser: User = {
        uid: userId,
        displayName: nickname.trim(),
        email: `${sanitizedNickname}@wc.local`,
        role,
        points: 0,
        round1_wrong_count: 0,
        yellow_cards: 0,
        red_cards: 0,
        bannedMatchIds: [],
        mustChangePassword: true,
      };

      await setDoc(userDocRef, newUser);
      setUser(newUser);
      localStorage.setItem('wc_player_id', userId);
    }
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('wc_player_id');
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
