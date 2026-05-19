import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (nickname: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for persistent session
    const savedUserId = localStorage.getItem('wc_player_id');
    
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
        console.error("Auth Listener Error:", err);
        setLoading(false);
      });

      return () => unsubscribeUser();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (nickname: string, pin: string) => {
    const NORMAL_PIN = '123456';
    const ADMIN_PIN = '999999';

    if (pin !== NORMAL_PIN && pin !== ADMIN_PIN) {
      throw new Error('รหัสกลุ่มไม่ถูกต้อง');
    }

    // Standardize nickname for ID
    const sanitizedNickname = nickname.trim().toLowerCase();
    const userId = `user_${sanitizedNickname}`;

    // Check if user exists
    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      // Existing user: Login
      const userData = userSnap.data() as User;
      setUser(userData);
      localStorage.setItem('wc_player_id', userId);
    } else {
      // New user: Register
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
      };

      await setDoc(userDocRef, newUser);
      setUser(newUser);
      localStorage.setItem('wc_player_id', userId);
    }
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('wc_player_id');
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
