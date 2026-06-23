import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where, getDocs, doc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Prediction } from '../types';
import { Trophy, Award, Medal, ChevronUp, ChevronDown, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const NO_PRED_PENALTY: Record<string, number> = {
  'group': -1,
  'top32': -1,
  'top16': -2,
  'top8': -2,
  'top4': -3,
  'third_place': -3,
  'final': -3,
};

const OrnateCorner: React.FC<{ position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }> = ({ position }) => {
  const posClasses = {
    'top-left': 'top-3 left-3',
    'top-right': 'top-3 right-3 rotate-90',
    'bottom-left': 'bottom-3 left-3 -rotate-90',
    'bottom-right': 'bottom-3 right-3 rotate-180',
  }[position];
  
  return (
    <svg 
      className={`absolute w-12 h-12 text-yellow-500/70 fill-none stroke-current ${posClasses} pointer-events-none`} 
      viewBox="0 0 100 100"
    >
      <path d="M 10 10 L 90 10" strokeWidth="3" />
      <path d="M 10 10 L 10 90" strokeWidth="3" />
      <path d="M 18 18 L 65 18" strokeWidth="1.5" strokeDasharray="3,3" />
      <path d="M 18 18 L 18 65" strokeWidth="1.5" strokeDasharray="3,3" />
      <path d="M 10 30 C 20 30, 30 20, 30 10" strokeWidth="3" />
      <circle cx="30" cy="30" r="4" fill="currentColor" />
    </svg>
  );
};

const GoldConfetti: React.FC = () => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animationFrameId: number;
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const handleResize = () => {
      if (canvas) {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    class Particle {
      x = Math.random() * width;
      y = Math.random() * -height - 20;
      rotation = Math.random() * 360;
      rotationSpeed = Math.random() * 2 - 1;
      diameter = Math.random() * 8 + 5;
      color = '';
      speedX = Math.random() * 3 - 1.5;
      speedY = Math.random() * 4 + 2;
      opacity = Math.random() * 0.6 + 0.4;
      type: 'circle' | 'square' | 'star' = 'square';

      constructor() {
        const colors = [
          '#facc15', // yellow-400
          '#eab308', // yellow-500
          '#fef08a', // yellow-200
          '#fbbf24', // amber-400
          '#f59e0b', // amber-500
          '#ffffff', // white sparkle
        ];
        this.color = colors[Math.floor(Math.random() * colors.length)];
        const types: ('circle' | 'square' | 'star')[] = ['circle', 'square', 'star'];
        this.type = types[Math.floor(Math.random() * types.length)];
      }

      update() {
        this.y += this.speedY;
        this.x += this.speedX;
        this.rotation += this.rotationSpeed;
        if (this.y > height) {
          this.y = Math.random() * -50 - 20;
          this.x = Math.random() * width;
        }
      }

      draw() {
        if (!ctx) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.globalAlpha = this.opacity;
        
        if (this.type === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, this.diameter / 2, 0, Math.PI * 2);
          ctx.fillStyle = this.color;
          ctx.fill();
        } else if (this.type === 'star') {
          let rot = (Math.PI / 2) * 3;
          let x = 0;
          let y = 0;
          const step = Math.PI / 5;
          const outer = this.diameter;
          const inner = this.diameter / 2;

          ctx.beginPath();
          ctx.moveTo(0, -outer);
          for (let i = 0; i < 5; i++) {
            x = Math.cos(rot) * outer;
            y = Math.sin(rot) * outer;
            ctx.lineTo(x, y);
            rot += step;

            x = Math.cos(rot) * inner;
            y = Math.sin(rot) * inner;
            ctx.lineTo(x, y);
            rot += step;
          }
          ctx.lineTo(0, -outer);
          ctx.closePath();
          ctx.fillStyle = this.color;
          ctx.fill();
        } else {
          ctx.fillStyle = this.color;
          ctx.beginPath();
          ctx.fillRect(-this.diameter / 2, -this.diameter / 2, this.diameter, this.diameter);
        }
        ctx.restore();
      }
    }

    const particles: Particle[] = [];
    for (let i = 0; i < 100; i++) {
      particles.push(new Particle());
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      animationFrameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-10" />;
};

const RankChange: React.FC<{ currentRank: number; previousRank: number }> = ({ currentRank, previousRank }) => {
  if (!previousRank || currentRank === previousRank) {
    return (
      <div className="flex items-center gap-2 text-slate-300 bg-black/60 px-4 py-1.5 rounded-full border border-slate-700/60 text-xs font-black tracking-wider select-none shadow-md">
        <span className="text-sm font-black text-slate-400 select-none">-</span>
        <span>คงที่</span>
      </div>
    );
  }

  const isUp = currentRank < previousRank; // Lower rank number means higher rank
  
  if (isUp) {
    return (
      <motion.div 
        initial={{ y: 2, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center gap-2 text-emerald-400 bg-black/60 px-4 py-1.5 rounded-full border border-emerald-500/30 text-xs font-black tracking-wider shadow-[0_0_12px_rgba(52,211,153,0.25)] select-none"
      >
        <motion.span
          animate={{ y: [-1, 1, -1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-sm font-black"
        >
          ▲
        </motion.span>
        <span>ขึ้นจากอันดับ {previousRank}</span>
      </motion.div>
    );
  } else {
    return (
      <motion.div 
        initial={{ y: -2, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center gap-2 text-rose-400 bg-black/60 px-4 py-1.5 rounded-full border border-rose-500/30 text-xs font-black tracking-wider shadow-[0_0_12px_rgba(251,113,133,0.25)] select-none"
      >
        <motion.span
          animate={{ y: [1, -1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-sm font-black"
        >
          ▼
        </motion.span>
        <span>ลงจากอันดับ {previousRank}</span>
      </motion.div>
    );
  }
};

const Leaderboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [userHistories, setUserHistories] = useState<Record<string, { points: number; cardType: 'yellow' | 'red' | null; isResultCorrect?: boolean; isBanned?: boolean; isMissed?: boolean }[]>>({});
  const [rowOffsets, setRowOffsets] = useState<Record<string, number>>({});
  const [manOfTheNight, setManOfTheNight] = useState<{ userId: string; updatedAt: any } | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [previousRanks, setPreviousRanks] = useState<Record<string, number>>({});

  const handleScrollUp = (uid: string, numRows: number) => {
    setRowOffsets(prev => {
      const current = prev[uid] !== undefined ? prev[uid] : Math.max(0, numRows - 3);
      return {
        ...prev,
        [uid]: Math.max(0, current - 1)
      };
    });
  };

  const handleScrollDown = (uid: string, numRows: number) => {
    setRowOffsets(prev => {
      const current = prev[uid] !== undefined ? prev[uid] : Math.max(0, numRows - 3);
      return {
        ...prev,
        [uid]: Math.min(numRows - 3, current + 1)
      };
    });
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'manOfTheNight'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as { userId: string; updatedAt: any };
        setManOfTheNight(data);
        
        // Trigger popup only if the update happened recently (within last 12 hours)
        // and the user has seen this specific announcement less than 5 times
        const nowServer = Timestamp.now().seconds;
        const updateTime = data.updatedAt?.seconds || 0;
        if (nowServer - updateTime < 43200) {
          const announcementId = `${data.userId}_${updateTime}`;
          const localKey = `motn_seen_${announcementId}`;
          const seenCount = Number(localStorage.getItem(localKey) || 0);
          if (seenCount < 5) {
            setShowPopup(true);
            localStorage.setItem(localKey, String(seenCount + 1));
          } else {
            setShowPopup(false);
          }
        } else {
          setShowPopup(false);
        }
      } else {
        setManOfTheNight(null);
        setShowPopup(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('points', 'desc'));
    const unsubscribe = onSnapshot(q, async (snap) => {
      const topUsers = snap.docs
        .map(d => d.data() as User)
        .filter(u => u.role !== 'admin');

      topUsers.sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        const wrongA = a.round1_wrong_count || 0;
        const wrongB = b.round1_wrong_count || 0;
        if (wrongA !== wrongB) {
          return wrongA - wrongB; // Fewer wrongs first
        }
        return a.displayName.localeCompare(b.displayName, 'th');
      });

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

        // Persistent Rank tracking based on finished matches count
        const finishedMatchIdsStr = finishedMatches.map(m => m.id).sort().join(',');
        
        const localRanksKey = 'thunderrich_leaderboard_ranks';
        const localPrevRanksKey = 'thunderrich_leaderboard_prev_ranks';
        const localMatchesKey = 'thunderrich_leaderboard_finished_matches';

        let lastFinishedMatches = localStorage.getItem(localMatchesKey) || '';
        let savedRanks: Record<string, number> = {};
        let prevRanks: Record<string, number> = {};

        try {
          const rawSaved = localStorage.getItem(localRanksKey);
          if (rawSaved) savedRanks = JSON.parse(rawSaved);
        } catch(e) {}

        try {
          const rawPrev = localStorage.getItem(localPrevRanksKey);
          if (rawPrev) prevRanks = JSON.parse(rawPrev);
        } catch(e) {}

        const currentRanksMap: Record<string, number> = {};
        topUsers.forEach((u, idx) => {
          currentRanksMap[u.uid] = idx + 1;
        });

        if (finishedMatchIdsStr !== lastFinishedMatches) {
          // A new match has finished!
          // We shift the old savedRanks to be the new prevRanks
          prevRanks = { ...savedRanks };
          
          // For any user who didn't have a saved rank, default to their current rank
          topUsers.forEach((u, idx) => {
            if (prevRanks[u.uid] === undefined) {
              prevRanks[u.uid] = idx + 1;
            }
          });

          // Save new states
          localStorage.setItem(localPrevRanksKey, JSON.stringify(prevRanks));
          localStorage.setItem(localRanksKey, JSON.stringify(currentRanksMap));
          localStorage.setItem(localMatchesKey, finishedMatchIdsStr);
        } else {
          // No new matches finished (refreshing or just database listener triggered for other reasons)
          // If prevRanks or savedRanks is empty (e.g. first time user), initialize them
          let needsSave = false;
          if (Object.keys(savedRanks).length === 0) {
            savedRanks = { ...currentRanksMap };
            localStorage.setItem(localRanksKey, JSON.stringify(savedRanks));
            needsSave = true;
          }
          if (Object.keys(prevRanks).length === 0) {
            prevRanks = { ...currentRanksMap };
            localStorage.setItem(localPrevRanksKey, JSON.stringify(prevRanks));
            needsSave = true;
          }
          if (!lastFinishedMatches) {
            localStorage.setItem(localMatchesKey, finishedMatchIdsStr);
            needsSave = true;
          }
        }

        // Set previous ranks state for rendering
        const newPrevRanks: Record<string, number> = {};
        topUsers.forEach((u, idx) => {
          newPrevRanks[u.uid] = prevRanks[u.uid] !== undefined ? prevRanks[u.uid] : idx + 1;
        });
        setPreviousRanks(newPrevRanks);

        const newHistories: Record<string, { points: number; isResultCorrect?: boolean; isBanned?: boolean; isMissed?: boolean }[]> = {};
        
        userIds.forEach(uid => {
          const userPreds = allPreds.filter(p => p.userId === uid);
          const u = topUsers.find(user => user.uid === uid);
          
          const processed = [];

          // Include finished matches AND any scheduled matches that are currently banned for this user
          const userMatches = [
            ...finishedMatches,
            ...Object.keys(matchesMap)
              .map(id => ({ id, ...matchesMap[id] }))
              .filter(m => m.status === 'scheduled' && u?.bannedMatchIds?.includes(m.id))
          ];
          
          // Sort chronologically
          userMatches.sort((a, b) => (a.startTime?.seconds || 0) - (b.startTime?.seconds || 0));

          userMatches.forEach(match => {
            const p = userPreds.find(pred => pred.matchId === match.id);
            const isBanned = u?.bannedMatchIds?.includes(match.id);
            const isMissed = !isBanned && (!p || p.choice === null || p.choice === undefined);
            
            let earns = 0;
            let isCorrect = false;

            if (isBanned) {
              earns = 0;
              isCorrect = false;
            } else if (p) {
              earns = p.pointsEarned ?? 0;
              isCorrect = p.isResultCorrect ?? false;
            } else {
              const roundPenalty = NO_PRED_PENALTY[match.round] ?? -1;
              earns = roundPenalty;
              isCorrect = false;
            }

            processed.push({
              points: earns,
              isResultCorrect: isCorrect,
              isBanned: !!isBanned,
              isMissed
            });
          });

          newHistories[uid] = processed;
        });

        setUserHistories(newHistories);
      }
    });

    return () => unsubscribe();
  }, []);

  const winnerUser = users.find(u => u.uid === manOfTheNight?.userId);

  return (
    <>
      <div className="space-y-4">
        {users.map((u, index) => {
          const isManOfTheNight = manOfTheNight?.userId === u.uid;
          const isGold = index === 0;
          const isSilver = index === 1;
          const isBronze = index === 2;
          const Icon = isGold ? Trophy : isSilver ? Award : isBronze ? Medal : null;
          const history = userHistories[u.uid] || [];

          // Build inline items list with predictions
          const historyItems: { points: number; isBanned?: boolean; isMissed?: boolean }[] = [];
          history.forEach(item => {
            historyItems.push({ 
              points: item.points, 
              isBanned: item.isBanned, 
              isMissed: item.isMissed
            });
          });

          let borderGradient = '';
          let bgGradient = '';
          let topBarColor = '';
          let rankLabel = '';
          let avatarBorder = '';

          if (isManOfTheNight) {
            borderGradient = 'linear-gradient(135deg, #facc15, #fef08a, #ca8a04, #facc15)'; // Super bright gold gradient
            bgGradient = 'linear-gradient(135deg, rgba(10, 8, 2, 0.95) 0%, rgba(35, 25, 5, 0.95) 100%)'; // Glowing dark gold obsidian
            topBarColor = 'from-yellow-400 via-amber-500 to-yellow-600 animate-pulse';
            rankLabel = 'MOTN';
            avatarBorder = 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.85)]';
          } else if (index === 0) {
            borderGradient = 'linear-gradient(135deg, #22c55e, #a855f7, #3b82f6, #ef4444)'; // Rainbow border
            bgGradient = 'linear-gradient(135deg, rgba(5, 5, 5, 0.95) 0%, rgba(15, 15, 15, 0.95) 100%)'; // Deep black background
            topBarColor = 'from-green-400 via-purple-500 via-blue-500 to-red-500';
            rankLabel = 'อันดับ 1';
            avatarBorder = 'border-white/40 shadow-[0_0_12px_rgba(255,255,255,0.2)]';
          } else if (index >= users.length - 3) {
            borderGradient = 'linear-gradient(135deg, #ef4444, #b91c1c)'; // Red (Last 3 ranks)
            bgGradient = 'linear-gradient(135deg, rgba(15, 23, 42, 0.70) 0%, rgba(15, 23, 42, 0.70) 100%)'; // Dark background
            topBarColor = 'from-red-500 via-rose-600 to-red-700';
            rankLabel = 'อ่อน';
            avatarBorder = 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]';
          } else {
            borderGradient = 'linear-gradient(135deg, #475569, #334155)'; // Sleek slate border
            bgGradient = 'linear-gradient(135deg, rgba(15, 23, 42, 0.70) 0%, rgba(15, 23, 42, 0.70) 100%)'; // Solid dark grey/slate
            topBarColor = 'from-slate-500 to-slate-600';
            rankLabel = 'player';
            avatarBorder = 'border-slate-500/50 shadow-none';
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
              className={`flex flex-col gap-4 p-4 sm:p-5 pt-6 sm:pt-7 rounded-[1.75rem] transition-all relative overflow-hidden backdrop-blur-md shadow-2xl ${
                isManOfTheNight 
                  ? 'shadow-[0_0_25px_rgba(250,204,21,0.25)] ring-1 ring-yellow-400/10' 
                  : index === 0 
                    ? 'shadow-[0_0_30px_rgba(168,85,247,0.2)] ring-1 ring-purple-500/10' 
                    : ''
              }`}
            >
              {/* Top Color Bar */}
              <div className={`absolute top-0 left-0 right-0 h-3.5 bg-gradient-to-r ${topBarColor}`} />

              {isManOfTheNight && (
                <div className="absolute top-4 right-6 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-500 text-black text-[10px] font-extrabold px-3 py-1 rounded-full shadow-[0_0_12px_rgba(250,204,21,0.5)] tracking-widest flex items-center gap-1 select-none animate-pulse">
                  🌌 MAN OF THE NIGHT
                </div>
              )}

              {/* Info Section */}
              <div className="flex items-center justify-between gap-4 w-full select-none">
                {/* Left side: Rank + Avatar Capsule + Arrow + Name details */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  {/* Rank number (with '=' prefix if tied) */}
                  {(() => {
                    const firstTieIndex = users.findIndex(other => other.points === u.points);
                    const rankNumber = firstTieIndex + 1;
                    const isTied = users.some(other => other.uid !== u.uid && other.points === u.points);
                    const rankText = isTied ? `=${rankNumber}` : `${rankNumber}`;
                    
                    return (
                      <span 
                        className={`italic text-center select-none ${
                          index === 0 
                            ? 'text-3xl sm:text-4xl text-white min-w-[32px]' 
                            : 'text-xl sm:text-2xl text-slate-300 min-w-[32px]'
                        }`}
                        style={{ fontWeight: 955 }}
                      >
                        {rankText}
                      </span>
                    );
                  })()}

                  {/* Avatar Capsule Flag Shape */}
                  <div className={`relative flex-shrink-0 w-16 h-10 sm:w-20 sm:h-12 rounded-tl-[1.1rem] rounded-br-[1.1rem] rounded-tr-[4px] rounded-bl-[4px] border-2 overflow-hidden bg-slate-955 ${
                    isManOfTheNight 
                      ? 'border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.5)]' 
                      : index === 0 
                        ? 'border-white/50 shadow-[0_0_10px_rgba(255,255,255,0.15)]' 
                        : 'border-white/10'
                  }`}>
                    <img 
                      src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}&background=0F172A&color=E2E8F0&bold=true`} 
                      alt={u.displayName} 
                      className="w-full h-full object-cover"
                    />
                    {isManOfTheNight && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-slate-950 flex items-center justify-center border border-yellow-400/50">
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-current animate-spin-slow" />
                      </div>
                    )}
                  </div>

                  {/* Name + Subtitle (change text & wrongs) */}
                  <div className="flex flex-col min-w-0 gap-1.5">
                    <div className="flex items-center gap-2">
                      {/* Up/Down Arrow Indicator (Inline before Name) */}
                      {(() => {
                        const currentRank = index + 1;
                        const previousRank = previousRanks[u.uid];
                        const isUp = previousRank && currentRank < previousRank;
                        const isDown = previousRank && currentRank > previousRank;
                        
                        if (isUp) {
                          return (
                            <motion.span 
                              animate={{ y: [-1, 1, -1] }}
                              transition={{ repeat: Infinity, duration: 1.5 }}
                              className="text-emerald-400 text-sm font-black flex-shrink-0 select-none"
                              style={{ fontWeight: 955 }}
                            >
                              ▲
                            </motion.span>
                          );
                        } else if (isDown) {
                          return (
                            <motion.span 
                              animate={{ y: [1, -1, 1] }}
                              transition={{ repeat: Infinity, duration: 1.5 }}
                              className="text-rose-500 text-sm font-black flex-shrink-0 select-none"
                              style={{ fontWeight: 955 }}
                            >
                              ▼
                            </motion.span>
                          );
                        } else {
                          return (
                            <span 
                              className="text-slate-500 text-sm font-black flex-shrink-0 select-none"
                              style={{ fontWeight: 955 }}
                            >
                              -
                            </span>
                          );
                        }
                      })()}

                      <h3 
                        className={`text-base sm:text-lg tracking-wider truncate leading-tight uppercase ${
                          isManOfTheNight 
                            ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-amber-400' 
                            : 'text-white'
                        }`}
                        style={{ fontWeight: 950 }}
                      >
                        {u.displayName ? u.displayName.toUpperCase() : ''}
                      </h3>
                      {u.yellow_cards > 0 && (
                        <div 
                          title="ได้รับใบเหลือง" 
                          className="w-2.5 h-3.5 bg-yellow-450 border border-yellow-300 rounded-[1.5px] shadow-sm transform rotate-[6deg] flex-shrink-0" 
                        />
                      )}
                      {u.red_cards > 0 && (
                        <div 
                          title="ได้รับใบแดง" 
                          className="w-2.5 h-3.5 bg-red-600 border border-red-500 rounded-[1.5px] shadow-sm transform -rotate-[6deg] flex-shrink-0" 
                        />
                      )}
                    </div>
                    {/* Subtitle details */}
                    <div 
                      className="flex items-center gap-2 text-[20px] text-slate-400 select-none"
                      style={{ fontWeight: 700 }}
                    >
                      <span>
                        {(() => {
                          const currentRank = index + 1;
                          const previousRank = previousRanks[u.uid];
                          const isUp = previousRank && currentRank < previousRank;
                          const isDown = previousRank && currentRank > previousRank;
                          return isUp ? `ขึ้นจากอันดับ ${previousRank}` : isDown ? `ลงจากอันดับ ${previousRank}` : 'คงที่';
                        })()}
                      </span>
                      <span>•</span>
                      <span className="text-yellow-450">เฟอะฟะ {u.round1_wrong_count}</span>
                    </div>
                  </div>
                </div>

                {/* Right side: Points Box */}
                <div 
                  className={`w-14 h-11 sm:w-16 sm:h-12 flex-shrink-0 rounded-xl flex items-center justify-center text-lg sm:text-xl shadow-md border ${
                    isManOfTheNight 
                      ? 'bg-gradient-to-b from-yellow-300 to-amber-500 text-black border-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.45)]' 
                      : index === 0 
                        ? 'bg-[#2dd4bf] text-black border-cyan-300 shadow-[0_0_12px_rgba(45,212,191,0.45)]' 
                        : 'bg-white text-black border-gray-200'
                  }`}
                  style={{ fontWeight: 950 }}
                >
                  <style>{`
                    .jackpot-row-points {
                      font-weight: 900 !important;
                    }
                  `}</style>
                  <span className="jackpot-row-points">{u.points}</span>
                </div>
              </div>

              {/* Full prediction history with row-by-row pagination */}
              {history && history.length > 0 && (() => {
                const rows = [];
                const ITEMS_PER_ROW = 8;
                for (let i = 0; i < historyItems.length; i += ITEMS_PER_ROW) {
                  rows.push(historyItems.slice(i, i + ITEMS_PER_ROW));
                }
                const numRows = rows.length;
                const currentOffset = rowOffsets[u.uid] !== undefined ? rowOffsets[u.uid] : Math.max(0, numRows - 3);
                const visibleRows = rows.slice(currentOffset, currentOffset + 3);

                return (
                  <div className="space-y-2.5 pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                        ประวัติการทายผลทั้งหมด :
                      </span>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {visibleRows.map((row, rowIdx) => (
                        <div key={rowIdx} className="grid grid-cols-8 gap-1.5 sm:gap-2 justify-items-center items-center">
                          {row.map((item, itemIdx) => {
                            const earns = item.points;
                            const isPositive = earns > 0;
                            const isMissed = item.isMissed;

                            if (item.isBanned) {
                              return (
                                <div 
                                  key={itemIdx}
                                  title="ถูกแบนจากการทายผลนัดนี้" 
                                  className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center flex-shrink-0"
                                >
                                  <div className="w-3.5 h-5 bg-yellow-400 border border-yellow-250 rounded-[2px] shadow-sm transform rotate-[6deg]" />
                                </div>
                              );
                            }

                            let bgClass = '';
                            if (isPositive) {
                              bgClass = 'bg-emerald-500 text-slate-950 font-black shadow-[0_0_6px_rgba(16,185,129,0.3)] border border-emerald-400/20';
                            } else if (isMissed) {
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
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        แถวที่ {currentOffset + 1} - {Math.min(numRows, currentOffset + 3)} จาก {numRows}
                      </span>
                      {numRows > 3 && (
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => handleScrollUp(u.uid, numRows)}
                            disabled={currentOffset === 0}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
                              currentOffset === 0
                                ? 'bg-pink-950/20 border-pink-900/10 text-pink-900/40 cursor-not-allowed'
                                : 'bg-pink-500 border-pink-400 text-white hover:bg-pink-400 shadow-md shadow-pink-500/20 cursor-pointer active:scale-95'
                            }`}
                          >
                            <ChevronUp className="w-4.5 h-4.5" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleScrollDown(u.uid, numRows)}
                            disabled={currentOffset >= numRows - 3}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
                              currentOffset >= numRows - 3
                                ? 'bg-pink-950/20 border-pink-900/10 text-pink-900/40 cursor-not-allowed'
                                : 'bg-pink-500 border-pink-400 text-white hover:bg-pink-400 shadow-md shadow-pink-500/20 cursor-pointer active:scale-95'
                            }`}
                          >
                            <ChevronDown className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {showPopup && winnerUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
            onClick={() => setShowPopup(false)}
          >
            <GoldConfetti />

            <motion.div
              initial={{ scale: 0.8, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 50, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg bg-gradient-to-b from-[#4a0305] to-[#1a0002] rounded-[2.5rem] border-[6px] border-[#d97706] shadow-[0_0_60px_rgba(234,179,8,0.5)] flex flex-col items-center justify-center p-8 text-center select-none overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Ornate Inner borders */}
              <div className="absolute inset-3 border-2 border-yellow-500/50 rounded-[2rem] pointer-events-none" />
              <div className="absolute inset-[18px] border border-dashed border-yellow-400/30 rounded-[1.8rem] pointer-events-none" />

              {/* Ornate Corners */}
              <OrnateCorner position="top-left" />
              <OrnateCorner position="top-right" />
              <OrnateCorner position="bottom-left" />
              <OrnateCorner position="bottom-right" />

              {/* Rays backdrop */}
              <div className="absolute top-[25%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(250,204,21,0.08)_0%,transparent_70%)] animate-spin-slow pointer-events-none" />
              <div className="absolute top-[25%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-radial from-yellow-500/20 to-transparent blur-2xl pointer-events-none" />

              {/* Close Button */}
              <button 
                onClick={() => setShowPopup(false)}
                className="absolute top-6 right-6 z-25 w-8 h-8 rounded-full bg-black/40 hover:bg-black/80 border border-yellow-500/50 text-yellow-400 hover:text-yellow-300 flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95"
              >
                <span className="text-xl font-bold font-sans">×</span>
              </button>

              <div className="z-10 w-full flex flex-col items-center gap-5 my-2">
                {/* Gold Avatar Ring */}
                <div className="relative w-44 h-44 sm:w-48 sm:h-48 rounded-full flex items-center justify-center p-2 bg-gradient-to-b from-yellow-300 via-amber-500 to-yellow-600 shadow-[0_0_30px_rgba(234,179,8,0.7)]">
                  <div className="absolute inset-0 rounded-full border-4 border-dashed border-white/60 animate-spin-slow" />
                  <div className="w-full h-full rounded-full overflow-hidden border-[5px] border-slate-950 bg-slate-900">
                    <img 
                      src={winnerUser.photoURL || `https://ui-avatars.com/api/?name=${winnerUser.displayName}&background=0F172A&color=E2E8F0&bold=true`} 
                      alt={winnerUser.displayName} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Banner / Ribbon */}
                <div className="relative -mt-9 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 text-black px-6 py-2 rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.5)] border-y-2 border-yellow-200">
                  <div className="text-[10px] sm:text-xs tracking-[0.25em] font-black uppercase text-center" style={{ fontWeight: 900 }}>
                    MAN OF THE NIGHT
                  </div>
                </div>

                {/* User Name */}
                <h2 
                  className="text-[36px] font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-red-600 via-orange-500 to-yellow-400 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] uppercase jackpot-name-text text-center px-4" 
                  style={{ fontWeight: 900 }}
                >
                  {winnerUser.displayName}
                </h2>

                {/* Points Circle */}
                <div className="relative w-40 h-40 rounded-full bg-gradient-to-b from-slate-950 to-black border-[5px] border-yellow-500 flex flex-col items-center justify-center shadow-[0_0_25px_rgba(234,179,8,0.4)]">
                  <style>{`
                    .jackpot-points-text, .jackpot-name-text {
                      font-weight: 900 !important;
                    }
                  `}</style>
                  <div className="absolute inset-1.5 rounded-full border border-yellow-400/30" />
                  <span 
                    className="text-[36px] font-black text-transparent bg-clip-text bg-gradient-to-b from-red-600 via-orange-500 to-yellow-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] jackpot-points-text" 
                    style={{ fontWeight: 900 }}
                  >
                    {winnerUser.points.toLocaleString('th-TH')}
                  </span>
                  <span className="text-[10px] font-black text-yellow-400 tracking-[0.2em] uppercase mt-1">
                    POINTS
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Leaderboard;
