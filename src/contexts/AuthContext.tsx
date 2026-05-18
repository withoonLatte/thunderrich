import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  joinGroup: (displayName: string, groupPin: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      if (fUser) {
        const userDocRef = doc(db, 'users', fUser.uid);
        
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setUser(docSnap.data() as User);
          } else {
            setUser(null);
          }
          setLoading(false);
        });

        return () => unsubscribeUser();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const joinGroup = async (displayName: string, groupPin: string) => {
    if (!firebaseUser) throw new Error('ไม่พบข้อมูลผู้เข้าใช้จาก Google');

    const NORMAL_PIN = '123456';
    const ADMIN_PIN = '999999';

    if (groupPin !== NORMAL_PIN && groupPin !== ADMIN_PIN) {
      throw new Error('รหัสกลุ่มไม่ถูกต้อง');
    }

    const role = groupPin === ADMIN_PIN ? UserRole.ADMIN : UserRole.USER;
    
    const newUser: User = {
      uid: firebaseUser.uid,
      displayName: displayName,
      email: firebaseUser.email || '',
      photoURL: firebaseUser.photoURL || undefined,
      role,
      points: 0,
      round1_wrong_count: 0,
      yellow_cards: 0,
      red_cards: 0,
      bannedMatchIds: [],
    };

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    await setDoc(userDocRef, newUser);
    setUser(newUser);
  };

  const logout = () => {
    return signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signInWithGoogle, joinGroup, logout }}>
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
