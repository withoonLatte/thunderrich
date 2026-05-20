import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Prediction } from '../types';
import { Trophy, Award, Medal } from 'lucide-react';
import { motion } from 'motion/react';

const Leaderboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [histories, setHistories] = useState<Record<string, string>>({});

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('points', 'desc'));
    const unsubscribe = onSnapshot(q, async (snap) => {
      const topUsers = snap.docs
        .map(d => d.data() as User)
        .filter(u => u.role !== 'admin')
        .slice(0, 15);
      setUsers(topUsers);

      // Fetch histories for top users
      const userIds = topUsers.map(u => u.uid);
      if (userIds.length > 0) {
        // Since Firestore has a limit of 10 in 'in' queries, and we have up to 15 users, 
        // we might want to fetch all predictions and filter or chunk it.
        // For simplicity and since matches are not huge, we can fetch all predictions for these users.
        const predQ = query(
          collection(db, 'predictions'), 
          where('userId', 'in', userIds.slice(0, 10)),
          orderBy('createdAt', 'asc')
        );
        const predSnap = await getDocs(predQ);
        
        // If we have more than 10 users, fetch the rest
        let allPredDocs = [...predSnap.docs];
        if (userIds.length > 10) {
          const predQ2 = query(
            collection(db, 'predictions'), 
            where('userId', 'in', userIds.slice(10, 15)),
            orderBy('createdAt', 'asc')
          );
          const predSnap2 = await getDocs(predQ2);
          allPredDocs = [...allPredDocs, ...predSnap2.docs];
        }

        const newHistories: Record<string, string> = {};
        allPredDocs.forEach(d => {
          const p = d.data() as Prediction;
          if (p.pointsEarned !== undefined) {
             let code = '';
             if (p.isResultCorrect) code = '1';
             else if (p.pointsEarned === 0) code = '2'; // Push
             else if (p.pointsEarned < 0) code = '0'; // Wrong
             
             if (code) {
               newHistories[p.userId] = (newHistories[p.userId] || '') + code;
             }
          }
        });
        setHistories(newHistories);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-3">
      {users.map((u, index) => {
        const isTop3 = index < 3;
        const Icon = index === 0 ? Trophy : index === 1 ? Award : index === 2 ? Medal : null;
        const iconColor = index === 0 ? 'text-world-cup-gold' : index === 1 ? 'text-gray-300' : 'text-amber-600';
        const history = histories[u.uid] || '';

        return (
          <motion.div 
            key={u.uid}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex items-center gap-5 p-5 rounded-3xl border transition-all ${
              index === 0 
                ? 'bg-world-cup-gold border-world-cup-gold shadow-xl shadow-world-cup-gold/20 scale-[1.02]' 
                : 'wc-glass border-gray-100 shadow-sm'
            }`}
          >
            <div className={`w-10 text-center italic text-2xl font-black ${index === 0 ? 'text-white/80' : 'text-gray-200'}`}>
              {index + 1}
            </div>
            
            <div className="relative">
              <img 
                src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}&background=22C55E&color=fff&bold=true`} 
                alt={u.displayName} 
                className={`w-12 h-12 rounded-2xl object-cover ${index === 0 ? 'border-2 border-white' : 'border border-gray-100'}`}
              />
              {Icon && (
                <div className={`absolute -top-3 -right-3 p-1.5 rounded-xl shadow-xl ${index === 0 ? 'bg-white text-world-cup-gold' : 'bg-gray-50 ' + iconColor}`}>
                  <Icon className="w-4 h-4 fill-current" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className={`truncate text-lg font-black uppercase tracking-tighter ${index === 0 ? 'text-white drop-shadow-sm' : 'text-slate-900'}`}>{u.displayName}</p>
              {history && (
                <div className="flex items-center gap-1.5 my-1 bg-black/5 px-2 py-0.5 rounded-xl w-fit">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${index === 0 ? 'text-white/90' : 'text-slate-550 text-slate-500'}`}>ฟอร์มล่าสุด:</span>
                  <div className="flex gap-1.5">
                    {history.split('').map((char, charIdx) => {
                      let bgClass = '';
                      let text = '';
                      if (char === '1') {
                        bgClass = index === 0 ? 'bg-emerald-400 text-slate-950 shadow-sm' : 'bg-emerald-500 text-white shadow-sm';
                        text = 'W';
                      } else if (char === '0') {
                        bgClass = index === 0 ? 'bg-rose-400 text-slate-950 shadow-sm' : 'bg-rose-500 text-white shadow-sm';
                        text = 'L';
                      } else {
                        bgClass = index === 0 ? 'bg-white/30 text-white' : 'bg-slate-300 text-slate-700';
                        text = 'P';
                      }
                      return (
                        <span 
                          key={charIdx} 
                          className={`w-4-fixed-square w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-extrabold leading-none ${bgClass}`}
                        >
                          {text}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              <p className={`text-xs font-bold uppercase tracking-wider mt-1.5 ${index === 0 ? 'text-white' : 'text-slate-600'}`}>
                ผิดสะสม: <span className={`font-black px-1.5 py-0.5 rounded-lg text-sm ${index === 0 ? 'bg-amber-900/60 text-white' : 'bg-rose-100/90 text-rose-600'}`}>{u.round1_wrong_count}</span> <span className="opacity-60">/ 24</span>
              </p>
            </div>

            <div className={`text-right ${index === 0 ? 'text-white' : 'text-world-cup-green'} text-huge italic font-black`}>
              {u.points} <span className="text-[10px] uppercase font-bold not-italic opacity-60">PTS</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default Leaderboard;
