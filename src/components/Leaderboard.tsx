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
    <div className="space-y-4">
      {users.map((u, index) => {
        const isGold = index === 0;
        const isSilver = index === 1;
        const isBronze = index === 2;
        const isLastThree = index >= users.length - 3 && index > 2;
        const Icon = isGold ? Trophy : isSilver ? Award : isBronze ? Medal : null;
        const iconColor = isGold ? 'text-yellow-400' : isSilver ? 'text-slate-300' : 'text-amber-600';
        const history = userHistories[u.uid] || [];

        // Dynamic styling depending on podium position
        let cardStyle = '';
        if (isGold) {
          cardStyle = 'wc-gold-card scale-[1.03] shadow-lg shadow-yellow-500/10';
        } else if (isSilver) {
          cardStyle = 'wc-silver-card scale-[1.01] shadow-md shadow-slate-400/5';
        } else if (isBronze) {
          cardStyle = 'wc-bronze-card shadow-sm shadow-amber-600/5';
        } else if (isLastThree) {
          cardStyle = 'wc-red-card scale-[0.99] border-red-500/40 shadow-lg shadow-red-500/10';
        } else {
          cardStyle = 'bg-[#0f172a]/50 border border-slate-800/80 shadow-[0_8px_20px_rgba(0,0,0,0.25)]';
        }

        const rankColor = isGold 
          ? 'text-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)] font-black text-6xl md:text-7xl' 
          : isSilver 
            ? 'text-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] font-black text-5xl md:text-6xl' 
            : isBronze 
              ? 'text-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] font-black text-5xl md:text-6xl' 
              : isLastThree
                ? 'text-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)] font-black text-4xl md:text-5xl'
                : 'text-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] font-black text-4xl md:text-5xl';

        return (
          <motion.div 
            key={u.uid}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex items-center gap-4 p-5 md:p-6 rounded-[1.8rem] transition-all relative overflow-hidden ${cardStyle}`}
          >
            <div className={`w-16 md:w-20 text-center italic ${rankColor}`}>
              {index + 1}
            </div>
            
            <div className="relative flex-shrink-0">
              <div className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden p-0.5 ${
                isGold ? 'border-2 border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.4)]' : 
                isSilver ? 'border-2 border-slate-400' :
                isBronze ? 'border-2 border-amber-600' :
                isLastThree ? 'border-2 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]' :
                'border border-slate-800'
              }`}>
                <img 
                  src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}&background=0F172A&color=E2E8F0&bold=true`} 
                  alt={u.displayName} 
                  className="w-full h-full rounded-[14px] object-cover"
                />
              </div>
              {Icon && (
                <div className={`absolute -top-3.5 -right-3.5 p-2 rounded-2xl shadow-lg border border-white/10 ${
                  isGold ? 'bg-slate-900 text-yellow-400' : 
                  isSilver ? 'bg-slate-900 text-slate-300' : 
                  'bg-slate-900 text-amber-600'
                }`}>
                  <Icon className="w-6 h-6 fill-current" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="truncate text-3xl md:text-4xl font-black uppercase tracking-tight text-black drop-shadow-sm">
                {u.displayName}
              </p>
              {history && history.length > 0 && (
                <div className="flex flex-col gap-1.5 my-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] md:text-[14px] font-black uppercase tracking-wider text-black/90">
                      ฟอร์ม 20 นัดล่าสุด:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 max-w-[280px]">
                    {history.slice(-20).map((item, itemIdx) => {
                      const earns = item.points;
                      const isPositive = earns > 0;
                      const isNegative = earns < 0;
                      
                      let bgClass = '';
                      if (isPositive) {
                        bgClass = 'bg-emerald-500 text-slate-950 font-black shadow-[0_0_6px_rgba(16,185,129,0.3)] border border-emerald-400/20';
                      } else if (isNegative) {
                        bgClass = 'bg-rose-500 text-white font-black shadow-[0_0_6px_rgba(244,63,94,0.3)] border border-rose-500/20';
                      } else {
                        bgClass = 'bg-slate-800 text-slate-450 border border-slate-700/50';
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
                              className="absolute -top-1 -right-1 w-2.5 h-3.5 bg-yellow-400 border border-yellow-250 rounded-[2px] shadow-md z-10 animate-pulse"
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
              <p className="text-lg md:text-xl font-black uppercase tracking-wider mt-2 text-black/95">
                เฟอะฟะ: <span className="font-black px-3.5 py-1.5 rounded-xl text-xl md:text-2xl bg-black/10 border border-black/35 text-black shadow-sm">{u.round1_wrong_count}</span> <span className="text-black/80 font-black text-sm md:text-base">/ 24 นัด</span>
              </p>
            </div>

            <div className="text-right text-black text-5xl md:text-6xl italic font-black flex-shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
              {u.points} <span className="text-base md:text-lg uppercase font-black not-italic opacity-80 ml-1.5">PTS</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default Leaderboard;
