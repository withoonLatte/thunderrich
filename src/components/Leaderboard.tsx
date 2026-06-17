import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Prediction } from '../types';
import { Trophy, Award, Medal } from 'lucide-react';
import { motion } from 'motion/react';

const NO_PRED_PENALTY: Record<string, number> = {
  'group': -1,
  'top32': -1,
  'top16': -2,
  'top8': -2,
  'top4': -3,
  'third_place': -3,
  'final': -3,
};

const Leaderboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [userHistories, setUserHistories] = useState<Record<string, { points: number; cardType: 'yellow' | 'red' | null; isResultCorrect?: boolean; isBanned?: boolean }[]>>({});

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('points', 'desc'));
    const unsubscribe = onSnapshot(q, async (snap) => {
      const topUsers = snap.docs
        .map(d => d.data() as User)
        .filter(u => u.role !== 'admin');
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

        // Get all finished matches sorted chronologically
        const finishedMatches = Object.keys(matchesMap)
          .map(id => ({ id, ...matchesMap[id] }))
          .filter(m => m.status === 'finished');
        
        finishedMatches.sort((a, b) => (a.startTime?.seconds || 0) - (b.startTime?.seconds || 0));

        const newHistories: Record<string, { points: number; cardType: 'yellow' | 'red' | null; isResultCorrect?: boolean; isBanned?: boolean }[]> = {};
        
        userIds.forEach(uid => {
          const userPreds = allPreds.filter(p => p.userId === uid);
          const u = topUsers.find(user => user.uid === uid);
          
          let wrongCount = 0;
          const processed = [];

          finishedMatches.forEach(match => {
            const p = userPreds.find(pred => pred.matchId === match.id);
            const isBanned = u?.bannedMatchIds?.includes(match.id);
            
            let earns = 0;
            let isCorrect = false;
            let isWrong = false;

            if (isBanned) {
              earns = 0;
              isCorrect = false;
            } else if (p) {
              earns = p.pointsEarned ?? 0;
              isCorrect = p.isResultCorrect ?? false;
              isWrong = !isCorrect && earns < 0;
            } else {
              const roundPenalty = NO_PRED_PENALTY[match.round] ?? -1;
              earns = roundPenalty;
              isCorrect = false;
            }

            let cardType: 'yellow' | 'red' | null = null;
            if (match.round === 'group' && isWrong && !isBanned) {
              wrongCount++;
              if (wrongCount === 12) {
                cardType = 'yellow';
              } else if (wrongCount === 24) {
                cardType = 'red';
              }
            }

            processed.push({
              points: earns,
              cardType,
              isResultCorrect: isCorrect,
              isBanned: !!isBanned
            });
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
        const Icon = isGold ? Trophy : isSilver ? Award : isBronze ? Medal : null;
        const history = userHistories[u.uid] || [];

        // Build inline items list with predictions and cards
        const historyItems: ({ type: 'prediction'; points: number; isBanned?: boolean } | { type: 'yellow' } | { type: 'red' })[] = [];
        history.forEach(item => {
          historyItems.push({ type: 'prediction', points: item.points, isBanned: item.isBanned });
          if (item.cardType === 'yellow') {
            historyItems.push({ type: 'yellow' });
          } else if (item.cardType === 'red') {
            historyItems.push({ type: 'red' });
          }
        });

        let borderGradient = '';
        let bgGradient = '';
        let topBarColor = '';
        let rankLabel = '';
        let avatarBorder = '';

        if (index >= 0 && index <= 2) {
          borderGradient = 'linear-gradient(135deg, #facc15, #d97706)'; // Gold
          bgGradient = 'linear-gradient(135deg, rgba(250, 204, 21, 0.50) 0%, rgba(234, 179, 8, 0.50) 100%)';
          topBarColor = 'from-yellow-400 via-amber-400 to-yellow-600';
          rankLabel = 'หัวแถว';
          avatarBorder = 'border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.45)]';
        } else if (index >= 3 && index <= 11) {
          borderGradient = 'linear-gradient(135deg, #94a3b8, #475569)'; // Grey
          bgGradient = 'linear-gradient(135deg, rgba(15, 23, 42, 0.50) 0%, rgba(15, 23, 42, 0.50) 100%)';
          topBarColor = 'from-slate-400 via-slate-500 to-slate-600';
          rankLabel = 'player';
          avatarBorder = 'border-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.3)]';
        } else {
          borderGradient = 'linear-gradient(135deg, #ef4444, #b91c1c)'; // Red
          bgGradient = 'linear-gradient(135deg, rgba(239, 68, 68, 0.50) 0%, rgba(153, 27, 27, 0.50) 100%)';
          topBarColor = 'from-red-500 via-rose-600 to-red-700';
          rankLabel = 'อ่อน';
          avatarBorder = 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]';
        }

        return (
          <motion.div 
            key={u.uid}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            style={{
              background: `${bgGradient} padding-box, ${borderGradient} border-box`,
              border: '3px solid transparent'
            }}
            className="flex flex-col gap-6 p-6 pt-10 rounded-[2.5rem] transition-all relative overflow-hidden backdrop-blur-md shadow-2xl"
          >
            {/* Top Color Bar */}
            <div className={`absolute top-0 left-0 right-0 h-3.5 bg-gradient-to-r ${topBarColor}`} />

            {/* Info Section */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-6">
              {/* Circular Rank Badge */}
              <div className="flex-shrink-0 w-24 h-24 rounded-full border-4 border-white flex flex-col items-center justify-center bg-black/35 shadow-inner">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80 leading-none mb-1">
                  {rankLabel}
                </span>
                <span className="text-4xl font-black italic text-white leading-none">
                  {index + 1}
                </span>
              </div>

              {/* Avatar Box */}
              <div className="relative flex-shrink-0">
                <div className={`w-20 h-20 rounded-[1.8rem] overflow-hidden p-0.5 border-4 ${avatarBorder} bg-slate-900`}>
                  <img 
                    src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}&background=0F172A&color=E2E8F0&bold=true`} 
                    alt={u.displayName} 
                    className="w-full h-full rounded-[1.5rem] object-cover"
                  />
                </div>
                {Icon && (
                  <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center shadow-lg border border-white/10">
                    <Icon className="w-5 h-5 text-yellow-450 fill-current" />
                  </div>
                )}
              </div>

              {/* Name and point details */}
              <div className="flex-1 min-w-0 space-y-3">
                <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight truncate leading-none drop-shadow-sm">
                  {u.displayName}
                </h3>
                
                <div className="flex items-center flex-wrap gap-4">
                  {/* Point Red Circle */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-red-600/35 border-[5px] border-red-500/45">
                      {u.points}
                    </div>
                    <span className="text-sm font-black uppercase tracking-wider text-slate-350">
                      point
                    </span>
                  </div>

                  {/* Yellow pill badge: เฟอะฟะ */}
                  <div className="rounded-full bg-yellow-400 text-black px-5 py-2 text-base font-black shadow-md border border-yellow-350 tracking-wider">
                    เฟอะฟะ {u.round1_wrong_count}
                  </div>
                </div>
              </div>
            </div>

            {/* 20-Match inline history */}
            {history && history.length > 0 && (
              <div className="space-y-2.5 pt-3 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                    20 นัดล่าสุด :
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-2 items-center">
                  {historyItems.slice(-20).map((item, itemIdx) => {
                    if (item.type === 'yellow') {
                      return (
                        <div 
                          key={itemIdx}
                          title="ได้รับใบเหลืองจากการผิด 12 นัด" 
                          className="w-5 h-7 bg-yellow-400 border border-yellow-250 rounded-[4px] shadow-md transform rotate-[6deg] flex-shrink-0 animate-pulse"
                        />
                      );
                    }
                    if (item.type === 'red') {
                      return (
                        <div 
                          key={itemIdx}
                          title="ได้รับใบแดงจากการผิด 24 นัด" 
                          className="w-5 h-7 bg-red-500 border border-red-300 rounded-[4px] shadow-md transform -rotate-[6deg] flex-shrink-0 animate-pulse"
                        />
                      );
                    }

                    if (item.type === 'prediction' && item.isBanned) {
                      return (
                        <div 
                          key={itemIdx}
                          title="ถูกแบนจากการทายผลนัดนี้" 
                          className="w-8 h-8 rounded-lg bg-yellow-450 border border-yellow-350 shadow-[0_0_8px_rgba(250,204,21,0.4)] flex items-center justify-center flex-shrink-0"
                        >
                          <div className="w-3.5 h-5 bg-yellow-400 border border-yellow-250 rounded-[2px] shadow-sm transform rotate-[6deg]" />
                        </div>
                      );
                    }

                    const earns = item.points;
                    const isPositive = earns > 0;
                    const isNegative = earns < 0;
                    
                    let bgClass = '';
                    if (isPositive) {
                      bgClass = 'bg-emerald-500 text-slate-950 font-black shadow-[0_0_6px_rgba(16,185,129,0.3)] border border-emerald-400/20';
                    } else if (isNegative) {
                      bgClass = 'bg-blue-600 text-white font-black shadow-[0_0_6px_rgba(37,99,235,0.3)] border border-blue-500/20';
                    } else {
                      bgClass = 'bg-slate-800 text-slate-450 border border-slate-700/50';
                    }

                    const valText = earns > 0 ? `+${earns}` : `${earns}`;

                    return (
                      <div 
                        key={itemIdx} 
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black leading-none flex-shrink-0 ${bgClass}`}
                      >
                        {valText}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

export default Leaderboard;
