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
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User, UserRole } from '../types';

export const PLAYER_PINS = [
  '1234', '1111', '2222', '3333', '4444', '5555', '7777', '8888', '9999', '2026',
  '1122', '3344', '5566', '7788', '9900', '2468', '1357', '9876', '5678', '1212'
];

export const ADMIN_PINS = ['999999', 'admin99', '888888', '777777', '555555'];

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

  const login = async (nickname: string, pin: string) => {
    const enteredPin = pin.trim();

    if (!nickname.trim()) {
      throw new Error('กรุณาระบุชื่อเล่น');
    }

    if (!enteredPin) {
      throw new Error('กรุณาระบุรหัสผ่าน (PIN)');
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
      if (userData.personalPin !== enteredPin) {
        throw new Error('รหัสผ่านส่วนตัวไม่ถูกต้องสำหรับชื่อเล่นนี้');
      }

      setUser(userData);
      localStorage.setItem('wc_player_id', userId);
    } else {
      // New User Registration
      const isPlayerPin = PLAYER_PINS.includes(enteredPin);
      const isAdminPin = ADMIN_PINS.includes(enteredPin);

      if (!isPlayerPin && !isAdminPin) {
        throw new Error('รหัสผ่านไม่ถูกต้อง (กรุณาใช้รหัสผ่าน 4-6 หลักที่กำหนดสําหรับสมาชิกใหม่ หรือติดต่อแอดมิน)');
      }

      // Check if this PIN is already occupied by another user
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('personalPin', '==', enteredPin));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        const occupiedUser = querySnap.docs[0].data() as User;
        throw new Error(`รหัสผ่านนี้ถูกเลือกใช้ไปแล้วโดย "${occupiedUser.displayName}" กรุณาติดต่อแอดมินหรือใช้รหัสผ่านที่ยังว่างอยู่`);
      }

      const role = isAdminPin ? UserRole.ADMIN : UserRole.USER;
      
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
        personalPin: enteredPin,
        mustChangePassword: false, // Predefined PIN removes necessity of changing password
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
