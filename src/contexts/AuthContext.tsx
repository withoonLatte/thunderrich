import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserPassword?: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to convert username to internal email
const formatEmail = (username: string) => `${username.toLowerCase().trim()}@wcpro.app`;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for mock session first
    const mockUserStr = localStorage.getItem('wc_mock_user');
    if (mockUserStr) {
      const mockUser = JSON.parse(mockUserStr);
      setUser(mockUser);
      // Sync mock admin to firestore if it's the hardcoded one
      if (mockUser.uid === 'hardcoded-admin-id') {
        const userDocRef = doc(db, 'users', mockUser.uid);
        setDoc(userDocRef, mockUser, { merge: true }).catch(console.error);
      }
      setLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setUser(docSnap.data() as User);
          } else {
            // This normally shouldn't happen with pre-created accounts
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

  const signIn = async (username: string, password: string) => {
    // Temporary Bypass for Admin while Firebase Auth API is activating
    if (username === 'admin' && password === 'password123') {
      const mockAdmin: User = {
        uid: 'hardcoded-admin-id',
        displayName: 'แอดมิน (ระบบสำรอง)',
        email: 'admin@wcpro.app',
        role: UserRole.ADMIN,
        points: 0,
        round1_wrong_count: 0,
        yellow_cards: 0,
        red_cards: 0,
        bannedMatchIds: []
      };
      
      // Try to save mock admin to Firestore so security rules can verify it
      try {
        const userDocRef = doc(db, 'users', mockAdmin.uid);
        await setDoc(userDocRef, mockAdmin, { merge: true });
      } catch (e) {
        console.warn('Could not save mock admin to Firestore, but continuing session locally.');
      }

      setUser(mockAdmin);
      localStorage.setItem('wc_mock_user', JSON.stringify(mockAdmin));
      return;
    }

    const email = formatEmail(username);
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    localStorage.removeItem('wc_mock_user');
    return signOut(auth);
  };

  const updateUserPassword = async (newPassword: string) => {
    if (user?.uid === 'hardcoded-admin-id') {
      // Mock admin logic
      const updatedUser = { ...user, mustChangePassword: false };
      setUser(updatedUser);
      localStorage.setItem('wc_mock_user', JSON.stringify(updatedUser));
      return;
    }

    if (!auth.currentUser) throw new Error('ไม่พบข้อมูลผู้เข้าใช้');
    
    await updatePassword(auth.currentUser, newPassword);
    
    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userDocRef, {
      mustChangePassword: false
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logout, updateUserPassword }}>
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
