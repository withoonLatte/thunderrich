import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';
import { motion } from 'motion/react';

const ScoreGraph: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    let isFufahDisabled = false;
    let unsubscribe: () => void = () => {};

    const setupListener = async () => {
      try {
        const matchesSnap = await getDocs(collection(db, 'matches'));
        matchesSnap.forEach(d => {
          const r = d.data().round;
          if (['top16', 'top8', 'top4', 'third_place', 'final'].includes(r)) {
            isFufahDisabled = true;
          }
        });
      } catch (e) {
        console.error(e);
      }

      const q = query(collection(db, 'users'), orderBy('points', 'desc'));
      unsubscribe = onSnapshot(q, (snap) => {
        const data = snap.docs
          .map(d => d.data() as User)
          .filter(u => u.role !== 'admin');

        data.sort((a, b) => {
          if (b.points !== a.points) {
            return b.points - a.points;
          }
          if (!isFufahDisabled) {
            const wrongA = a.round1_wrong_count || 0;
            const wrongB = b.round1_wrong_count || 0;
            if (wrongA !== wrongB) {
              return wrongA - wrongB; // Fewer wrongs first
            }
          }
          return a.displayName.localeCompare(b.displayName, 'th');
        });

        setUsers(data);
      });
    };

    setupListener();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Calculate dynamic axis range for bilateral alignment
  const pointsList = users.map(u => u.points);
  const minVal = Math.min(...pointsList, 0);
  const maxVal = Math.max(...pointsList, 10);
  const range = Math.max(maxVal - minVal, 10);

  // Position of 0 points axis (percentage from the left of the bar area)
  const zeroPosition = (Math.abs(minVal) / range) * 100;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0f172a]/90 backdrop-blur-2xl rounded-[2.2rem] p-6 shadow-[0_15px_40px_rgba(0,0,0,0.4)] border border-slate-800/80 overflow-hidden"
    >
      {/* Header Info */}
      <div className="flex items-center gap-3.5 mb-5">
        <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 via-fuchsia-500 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg">
          <span className="text-sm font-black">📈</span>
        </div>
        <div>
          <h3 className="text-base font-black text-white uppercase tracking-wider">คะแนนภาพรวม</h3>
          <p className="text-[11px] text-fuchsia-400 font-black uppercase tracking-widest">Real-time Stats Standings</p>
        </div>
      </div>

      {/* Modern Colorful Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mb-6 text-[10px] font-black text-slate-400 px-1 border-b border-slate-800/50 pb-3">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" />
          คะแนนบวก (Positive)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-rose-600 to-orange-500 animate-pulse" />
          คะแนนติดลบ (Negative)
        </span>
        <span className="flex items-center gap-1.5 border-l border-slate-850 pl-4">
          <span className="w-[1.5px] h-3 bg-fuchsia-500/50 border-dashed" />
          เส้นแกนกลาง (0 แต้ม)
        </span>
      </div>

      {/* Custom Proportional Bilateral Bar Chart - Height grows naturally to see everyone */}
      <div className="space-y-3.5">
        {users.map((u, idx) => {
          const isPositive = u.points >= 0;
          const pct = (Math.abs(u.points) / range) * 100;

          // Establish harmonious premium gradients
          let barGradient = 'from-emerald-500 via-emerald-400 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.12)]'; // Default Green
          let rankColor = 'bg-slate-800 text-slate-400';
          let rankText = `#${idx + 1}`;

          if (idx === 0) {
            barGradient = 'from-yellow-500 via-amber-400 to-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.25)]';
            rankColor = 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
            rankText = '🥇';
          } else if (idx === 1) {
            barGradient = 'from-slate-400 via-slate-350 to-slate-200 shadow-[0_0_12px_rgba(203,213,225,0.18)]';
            rankColor = 'bg-slate-400/20 text-slate-300 border border-slate-400/30';
            rankText = '🥈';
          } else if (idx === 2) {
            barGradient = 'from-amber-700 via-amber-600 to-orange-500 shadow-[0_0_12px_rgba(180,83,9,0.18)]';
            rankColor = 'bg-amber-700/20 text-amber-500 border border-amber-700/30';
            rankText = '🥉';
          } else if (idx < 5) {
            barGradient = 'from-fuchsia-600 via-pink-500 to-rose-450 shadow-[0_0_12px_rgba(217,70,239,0.15)]';
            rankColor = 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20';
          }

          return (
            <div 
              key={u.uid} 
              className="flex items-center gap-3.5 w-full py-1 hover:bg-slate-800/10 px-2 rounded-xl transition-all"
            >
              {/* Left Column: Rank, Name & Score next to name */}
              <div className="flex items-center gap-2 w-[140px] sm:w-[160px] shrink-0">
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${rankColor}`}>
                  {rankText}
                </span>
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="text-xs sm:text-sm font-black text-slate-200 truncate" title={u.displayName}>
                    {u.displayName}
                  </span>
                  <span className={`text-[10px] sm:text-xs font-black ${isPositive ? 'text-emerald-400' : 'text-rose-400'} shrink-0`}>
                    ({isPositive ? `+${u.points}` : u.points})
                  </span>
                </div>
              </div>

              {/* Right Column: Custom Bar Track (Clean, borderless and flat) */}
              <div className="relative flex-1 h-7 bg-slate-950/45 rounded-lg overflow-visible shadow-inner">
                {/* Dashed Zero-Axis Indicator */}
                <div 
                  className="w-[1.5px] h-full bg-fuchsia-500/20 border-dashed absolute top-0 z-0" 
                  style={{ left: `${zeroPosition}%` }}
                />

                {/* The Bar */}
                {isPositive ? (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className={`h-4.5 bg-gradient-to-r ${barGradient} rounded-r-full rounded-l-sm absolute top-1.25 z-10`}
                    style={{ left: `${zeroPosition}%` }}
                  />
                ) : (
                  <motion.div
                    initial={{ width: 0, left: `${zeroPosition}%` }}
                    animate={{ width: `${pct}%`, left: `calc(${zeroPosition}% - ${pct}%)` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="h-4.5 bg-gradient-to-l from-rose-600 to-orange-500 rounded-l-full rounded-r-sm absolute top-1.25 z-10 shadow-[0_0_12px_rgba(244,63,94,0.22)]"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default ScoreGraph;
