import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Prediction } from '../types';
import { Trophy, Award, Medal } from 'lucide-react';
import { motion } from 'motion/react';

const Leaderboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [userHistories, setUserHistories] = useState<Record<string, { points: number; cardType: 'yellow' | 'red' | null; isResultCorrect?: boolean }[]>>({});

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
        // Fetch matches map for sorting and round identification
        const matchesSnap = await getDocs(collection(db, 'matches'));
        const matchesMap: Record<string, any> = {};
        matchesSnap.forEach(d => {
          matchesMap[d.id] = d.data();
        });

        // Since Firestore has a limit of 10 in 'in' queries, and we have up to 15 users, 
        // we might want to fetch all predictions and filter or chunk it.
        const chunks: string[][] = [];
        for (let i = 0; i < userIds.length; i += 10) {
          chunks.push(userIds.slice(i, i + 10));
        }

        const promises = chunks.map(chunk => {
          const predQ = query(
            collection(db, 'predictions'), 
            where('userId', 'in', chunk)
          );
          return getDocs(predQ);
        });

        const snaps = await Promise.all(promises);
        const allPreds: Prediction[] = [];
        snaps.forEach(snap => {
          snap.forEach(d => {
            allPreds.push({ id: d.id, ...d.data() } as Prediction);
          });
        });

        const newHistories: Record<string, { points: number; cardType: 'yellow' | 'red' | null; isResultCorrect?: boolean }[]> = {};
        
        userIds.forEach(uid => {
          const userPreds = allPreds.filter(p => p.userId === uid && p.pointsEarned !== undefined);
          
          // Sort chronologically by match startTime
          userPreds.sort((a, b) => {
            const matchA = matchesMap[a.matchId];
            const matchB = matchesMap[b.matchId];
            const timeA = matchA?.startTime?.seconds || 0;
            const timeB = matchB?.startTime?.seconds || 0;
            return timeA - timeB;
          });

          let wrongCount = 0;
          const processed = userPreds.map(p => {
            const match = matchesMap[p.matchId];
            const earns = p.pointsEarned ?? 0;
            const isGroup = match?.round === 'group';
            const isWrong = !p.isResultCorrect && earns < 0;
            
            let cardType: 'yellow' | 'red' | null = null;
            if (isGroup && isWrong) {
              wrongCount++;
              if (wrongCount === 12) {
                cardType = 'yellow';
              } else if (wrongCount === 24) {
                cardType = 'red';
              }
            }

            return {
              points: earns,
              cardType,
              isResultCorrect: p.isResultCorrect
            };
          });

          newHistories[uid] = processed;
        });

        setUserHistories(newHistories);
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
        const history = userHistories[u.uid] || [];

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
              {history && history.length > 0 && (
                <div className="flex flex-col gap-1.5 my-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${index === 0 ? 'text-white/80' : 'text-slate-500'}`}>
                      ประวัติ 20 นัดล่าสุด:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 max-w-[280px]">
                    {history.slice(-20).map((item, itemIdx) => {
                      const earns = item.points;
                      const isPositive = earns > 0;
                      const isNegative = earns < 0;
                      
                      let bgClass = '';
                      if (isPositive) {
                        bgClass = index === 0 ? 'bg-emerald-500/90 text-slate-950 font-black shadow-sm ring-1 ring-white/10' : 'bg-emerald-500 text-white shadow-sm';
                      } else if (isNegative) {
                        bgClass = index === 0 ? 'bg-rose-500 text-white shadow-sm ring-1 ring-white/10' : 'bg-rose-500 text-white shadow-sm';
                      } else {
                        bgClass = index === 0 ? 'bg-white/20 text-white ring-1 ring-white/10' : 'bg-slate-200 text-slate-750';
                      }

                      const valText = earns > 0 ? `+${earns}` : `${earns}`;

                      return (
                        <div 
                          key={itemIdx} 
                          className={`relative w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black leading-none ${bgClass}`}
                        >
                          {valText}
                          
                          {/* Cards Indicator overlay */}
                          {item.cardType === 'yellow' && (
                            <span 
                              title="ได้รับใบเหลืองจากการผิด 12 นัด" 
                              className="absolute -top-1 -right-1 w-2.5 h-3.5 bg-yellow-400 border border-yellow-200 rounded-[2px] shadow-md z-10 animate-pulse"
                            />
                          )}
                          {item.cardType === 'red' && (
                            <span 
                              title="ได้รับใบแดงจากการผิด 24 นัด" 
                              className="absolute -top-1 -right-1 w-2.5 h-3.5 bg-red-500 border border-red-300 rounded-[2px] shadow-md z-10 animate-pulse"
                            />
                          )}
                        </div>
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
