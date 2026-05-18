import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';
import { Trophy, Award, Medal } from 'lucide-react';
import { motion } from 'motion/react';

const Leaderboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('points', 'desc'), limit(15));
    const unsubscribe = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => d.data() as User));
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-3">
      {users.map((u, index) => {
        const isTop3 = index < 3;
        const Icon = index === 0 ? Trophy : index === 1 ? Award : index === 2 ? Medal : null;
        const iconColor = index === 0 ? 'text-world-cup-gold' : index === 1 ? 'text-gray-300' : 'text-amber-600';

        return (
          <motion.div 
            key={u.uid}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
              index === 0 
                ? 'bg-world-cup-gold/10 border-world-cup-gold/30 shadow-lg shadow-world-cup-gold/5' 
                : 'wc-glass border-white/5'
            }`}
          >
            <div className="w-8 text-center italic text-lg text-gray-500">
              {index + 1}
            </div>
            
            <div className="relative">
              <img 
                src={u.photoURL || 'https://via.placeholder.com/150'} 
                alt={u.displayName} 
                className={`w-10 h-10 rounded-full ${index === 0 ? 'ring-2 ring-world-cup-gold ring-offset-2 ring-offset-world-cup-blue' : ''}`}
              />
              {Icon && (
                <div className={`absolute -top-2 -right-2 ${iconColor}`}>
                  <Icon className="w-4 h-4 fill-current" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className={`truncate text-sm ${index === 0 ? 'text-white' : 'text-gray-300'}`}>{u.displayName}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                ทายผิด {u.round1_wrong_count}/24 ครั้ง
              </p>
            </div>

            <div className={`text-right ${index === 0 ? 'text-world-cup-gold' : 'text-world-cup-green'} text-lg italic tracking-tighter`}>
              {u.points} คะแนน
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default Leaderboard;
