import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Match, MatchStatus } from '../types';
import { Play, Pause, RotateCcw, Maximize2, Minimize2, Loader2 } from 'lucide-react';

interface BarChartRaceProps {
  users: User[];
  userHistories: Record<string, { points: number; isResultCorrect?: boolean; isBanned?: boolean; isMissed?: boolean }[]>;
}

const GRADIENTS = [
  'from-rose-500 to-red-600',
  'from-sky-400 to-blue-600',
  'from-emerald-400 to-teal-600',
  'from-fuchsia-400 to-purple-600',
  'from-amber-400 to-orange-600',
  'from-cyan-400 to-indigo-500',
  'from-pink-500 to-rose-600',
  'from-violet-400 to-purple-600',
  'from-lime-400 to-green-600',
  'from-orange-400 to-red-600'
];

const formatDateTH = (seconds: number) => {
  const date = new Date(seconds * 1000 + 7 * 60 * 60 * 1000); // UTC+7 Offset
  const day = String(date.getUTCDate()).padStart(2, '0');
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const month = months[date.getUTCMonth()];
  return `${day} ${month}`;
};

const BarChartRace: React.FC<BarChartRaceProps> = ({ users, userHistories }) => {
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState<string[]>([]);
  const [timelineData, setTimelineData] = useState<Record<string, Record<string, number>>>({});
  const [dateIndex, setDateIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1200); // ms per day
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Load matches once on mount and compute score timeline from preloaded histories
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const matchesSnap = await getDocs(collection(db, 'matches'));
        const matches: Match[] = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match));

        // 1. Filter and sort finished matches chronologically
        const sortedFinished = matches
          .filter(m => m.status === MatchStatus.FINISHED)
          .sort((a, b) => (a.startTime?.seconds || 0) - (b.startTime?.seconds || 0));

        if (sortedFinished.length === 0) {
          setDates([]);
          setLoading(false);
          return;
        }

        // 2. Group matches by date
        const matchesByDate: Record<string, Match[]> = {};
        const uniqueDates: string[] = [];

        sortedFinished.forEach(m => {
          const dStr = formatDateTH(m.startTime?.seconds || 0);
          if (!uniqueDates.includes(dStr)) {
            uniqueDates.push(dStr);
          }
          if (!matchesByDate[dStr]) {
            matchesByDate[dStr] = [];
          }
          matchesByDate[dStr].push(m);
        });

        const fullDates = ['เริ่มต้น', ...uniqueDates];
        setDates(fullDates);

        // 3. Compute cumulative timeline scores for each user using preloaded histories
        const computedTimeline: Record<string, Record<string, number>> = {};

        users.forEach(u => {
          computedTimeline[u.uid] = {
            'เริ่มต้น': 0
          };

          const history = userHistories[u.uid] || [];
          let runningScore = 0;

          uniqueDates.forEach(dStr => {
            const matchesOnDate = matchesByDate[dStr] || [];
            matchesOnDate.forEach(m => {
              // Find the index of this match in the chronological finished list
              const matchIdx = sortedFinished.findIndex(finished => finished.id === m.id);
              if (matchIdx !== -1) {
                const earns = history[matchIdx]?.points || 0;
                runningScore += earns;
              }
            });
            computedTimeline[u.uid][dStr] = runningScore;
          });
        });

        setTimelineData(computedTimeline);
        setDateIndex(fullDates.length - 1); // Default to present day
        setLoading(false);
      } catch (err) {
        console.error('Error computing bar chart race data:', err);
        setLoading(false);
      }
    };

    if (users.length > 0 && Object.keys(userHistories).length > 0) {
      fetchData();
    }
  }, [users, userHistories]);

  // Autoplay handler
  useEffect(() => {
    if (!isPlaying || dates.length === 0) return;

    const timer = setInterval(() => {
      setDateIndex(prev => {
        if (prev < dates.length - 1) {
          return prev + 1;
        } else {
          setIsPlaying(false);
          return prev;
        }
      });
    }, speed);

    return () => clearInterval(timer);
  }, [isPlaying, dates, speed]);

  if (loading || Object.keys(userHistories).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="text-xs font-black">กำลังคำนวณสถิติอนิเมชัน...</span>
      </div>
    );
  }

  if (dates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[250px] text-slate-400 text-center px-4 border border-dashed border-slate-800 rounded-3xl py-8">
        <span className="text-sm font-black">ยังไม่มีแมตช์ที่จบการแข่งขันสำหรับการแสดงผล Bar Chart Race</span>
        <span className="text-[10px] text-slate-500 mt-2">เมื่อมีแมตช์การแข่งขันจบลงอย่างน้อย 1 คู่ แถบการวิ่งคะแนนจะแสดงขึ้นอัตโนมัติ</span>
      </div>
    );
  }

  const activeDate = dates[dateIndex];

  // Map users to their points on this active day
  const activeScores = users.map((u, userIdx) => {
    const points = timelineData[u.uid]?.[activeDate] ?? 0;
    return {
      uid: u.uid,
      displayName: u.displayName,
      photoURL: u.photoURL,
      points,
      colorIndex: userIdx
    };
  });

  // Sort descending by points, and alphabetical TH for ties
  activeScores.sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName, 'th'));

  // Calculate dynamic dimensions
  const maxPoints = Math.max(...activeScores.map(s => s.points), 10);

  const handlePlayPause = () => {
    if (dateIndex === dates.length - 1) {
      setDateIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleReplay = () => {
    setDateIndex(0);
    setIsPlaying(true);
  };

  // Fullscreen styling conditions
  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-[150] w-screen h-screen bg-[#070b13] p-8 flex flex-col justify-between overflow-hidden select-none animate-in fade-in duration-300'
    : 'relative w-full bg-[#0d131f]/95 rounded-[2rem] border border-slate-800/80 p-5 xs:p-6 flex flex-col justify-between overflow-hidden shadow-2xl select-none';

  return (
    <div className={containerClasses}>
      {/* Background decoration (faint stars) */}
      <div className="absolute inset-0 pointer-events-none opacity-25">
        <div className="absolute top-12 left-16 w-1 h-1 bg-white rounded-full animate-pulse" />
        <div className="absolute top-32 right-24 w-1.5 h-1.5 bg-white rounded-full opacity-60" />
        <div className="absolute bottom-20 left-28 w-1 h-1 bg-white rounded-full opacity-40 animate-ping" />
        <div className="absolute bottom-40 right-12 w-2 h-2 bg-white rounded-full opacity-55" />
        <div className="absolute top-1/2 left-3/4 w-1 h-1 bg-white rounded-full opacity-30 animate-pulse" />
      </div>

      <div className="z-10 flex flex-col flex-1 justify-between h-full space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800/60 pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
              📊 BAR CHART RACE
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">อนิเมชันจำลองคะแนนสะสมย้อนหลังแบบสด</p>
          </div>
          
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer border border-slate-700/50 flex items-center justify-center"
            title={isFullscreen ? 'ย่อหน้าจอ' : 'ขยายเต็มหน้าจอ'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Chart Area */}
        <div className="relative flex-1 min-h-[550px] mt-4">
          {activeScores.map((s, idx) => {
            // Find current rank (index in sorted list)
            const rank = activeScores.findIndex(other => other.uid === s.uid);
            const score = Math.max(0, s.points);
            const widthPercent = maxPoints > 0 ? (score / maxPoints) * 78 + 14 : 14; // min width 14%, max width 92%

            return (
              <div
                key={s.uid}
                className="absolute left-0 right-0 h-10 flex items-center transition-all duration-1000"
                style={{
                  transform: `translateY(${rank * 54}px)`,
                  opacity: rank < 10 ? 1 : 0,
                  pointerEvents: rank < 10 ? 'auto' : 'none'
                }}
              >
                {/* Bar Pill */}
                <div
                  className={`h-10 rounded-full bg-gradient-to-r ${GRADIENTS[s.colorIndex % GRADIENTS.length]} flex items-center justify-between px-4.5 relative shadow-lg transition-all duration-1000`}
                  style={{ width: `${widthPercent}%` }}
                >
                  <span className="font-sans font-black text-xs sm:text-sm text-white truncate pr-9 select-none">
                    {s.displayName}
                  </span>
                  
                  {/* Circular Avatar on Right End */}
                  <div className="absolute right-1 w-8 h-8 rounded-full border-2 border-white/90 overflow-hidden bg-slate-955 shadow-md">
                    <img 
                      src={s.photoURL || `https://ui-avatars.com/api/?name=${s.displayName}&background=0F172A&color=E2E8F0&bold=true`} 
                      alt={s.displayName}
                      className="w-full h-full object-cover" 
                    />
                  </div>
                </div>
                
                {/* Score Label Outside */}
                <span
                  className="absolute text-xs sm:text-sm font-black text-emerald-400 font-mono transition-all duration-1000 pl-3.5 select-none"
                  style={{ left: `${widthPercent}%` }}
                >
                  {s.points} แต้ม
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer Area: Controls + Date */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-5 border-t border-slate-800/60 pt-4 bg-slate-950/20 px-2 rounded-xl">
          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePlayPause}
              className="px-4.5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-400 hover:from-emerald-600 hover:to-green-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-500/10 cursor-pointer active:scale-95 transition-all border border-emerald-400/20"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlaying ? 'หยุดชั่วคราว' : 'เล่นไฟล์'}</span>
            </button>

            <button
              onClick={handleReplay}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer border border-slate-700/50 flex items-center justify-center active:scale-95"
              title="เริ่มใหม่"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Speed Multipliers */}
            <div className="flex bg-slate-900 rounded-xl p-0.5 border border-slate-800 shrink-0 shadow-inner">
              {[
                { label: '1x', val: 1800 },
                { label: '2x', val: 1200 },
                { label: '3x', val: 650 },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => setSpeed(item.val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${speed === item.val ? 'bg-slate-800 text-emerald-400 shadow' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chronological Date Overlay */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">CURRENT DAY:</span>
            <div className="px-5 py-2.5 bg-slate-900 rounded-xl border border-slate-800 text-center min-w-[130px] shadow-inner">
              <span className="text-sm font-black text-fuchsia-400 tracking-wider font-mono">
                {activeDate}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarChartRace;
