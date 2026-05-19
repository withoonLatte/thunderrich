import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, setDoc, doc, Timestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Match, Prediction, PredictionChoice, MatchStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Info, CheckCircle2 } from 'lucide-react';

const MatchList: React.FC = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubMatches = onSnapshot(query(collection(db, 'matches'), orderBy('startTime', 'asc')), (snap) => {
      setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Match)));
    });

    if (user) {
      const unsubPreds = onSnapshot(query(collection(db, 'predictions'), where('userId', '==', user.uid)), (snap) => {
        const predMap: Record<string, Prediction> = {};
        snap.docs.forEach(d => {
          const p = d.data() as Prediction;
          predMap[p.matchId] = p;
        });
        setPredictions(predMap);
      });
      return () => {
        unsubMatches();
        unsubPreds();
      };
    }

    return () => unsubMatches();
  }, [user]);

  const handlePredict = async (matchId: string, choice: PredictionChoice) => {
    if (!user) return;
    
    // Check if match already started or reached deadline
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const deadline = match.predictionDeadline ? match.predictionDeadline.seconds : match.startTime.seconds;
    if (deadline < Timestamp.now().seconds) {
      alert('หมดเวลาทายผลสำหรับแมตช์นี้แล้ว');
      return;
    }

    // Check if user is banned for this match
    if (user.bannedMatchIds?.includes(matchId)) return;

    const predId = `${user.uid}_${matchId}`;
    const predRef = doc(db, 'predictions', predId);
    
    await setDoc(predRef, {
      id: predId,
      userId: user.uid,
      matchId,
      choice,
      createdAt: Timestamp.now(),
      isVoided: false
    });
  };

  return (
    <div className="space-y-4">
      {matches.map((match, index) => {
        const prediction = predictions[match.id];
        const startTime = new Date(match.startTime.seconds * 1000);
        const deadline = match.predictionDeadline ? new Date(match.predictionDeadline.seconds * 1000) : startTime;
        
        const isStarted = match.startTime.seconds < Timestamp.now().seconds;
        const isPastDeadline = deadline.getTime() < now.getTime();
        const isBanned = user?.bannedMatchIds?.includes(match.id);
        const canPredict = !isPastDeadline && !isBanned;

        // Countdown logic
        const diff = deadline.getTime() - now.getTime();
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        const countdownStr = diff > 0 ? `${h} ชม. ${m} น. ${s} วิ.` : null;

        return (
          <motion.div 
            key={match.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`wc-glass rounded-[2rem] overflow-hidden border border-gray-100 transition-all ${isPastDeadline ? 'opacity-70 grayscale-[0.5]' : 'hover:border-world-cup-green/30 hover:shadow-2xl hover:shadow-world-cup-green/5'}`}
          >
            {/* Round & Date Header */}
            <div className="bg-gray-50/80 px-5 py-3.5 flex justify-between items-center border-b border-gray-100">
              <span className="text-[11px] font-black text-world-cup-green uppercase tracking-[0.2em]">{match.round.replace('_', ' ')}</span>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                <Clock className="w-4 h-4 text-world-cup-gold" />
                {isStarted ? 'เริ่มการแข่งขันแล้ว' : format(startTime, 'dd/MM/yyyy HH:mm')}
              </div>
            </div>

            <div className="p-6 space-y-8">
              <div className="flex items-center justify-between gap-4">
                {/* Home Team */}
                <div className="flex flex-col items-center gap-3 text-center flex-1">
                  <div className="relative">
                    <div className="w-20 h-14 rounded-2xl bg-white overflow-hidden border-2 border-gray-100 shadow-sm p-1">
                      {match.homeFlag ? <img src={match.homeFlag} alt={match.homeTeam} className="w-full h-full object-cover rounded-xl" /> : <div className="text-xl text-gray-300 h-full flex items-center justify-center">🏴</div>}
                    </div>
                  </div>
                  <span className="text-sm font-black text-slate-800 uppercase tracking-tight truncate w-full">{match.homeTeam}</span>
                  <div className="bg-world-cup-green text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg shadow-world-cup-green/20">
                    {match.handicap}
                  </div>
                </div>

                {/* Score / VS */}
                <div className="flex flex-col items-center gap-1 min-w-[70px]">
                  {match.status === MatchStatus.FINISHED ? (
                    <div className="flex flex-col items-center">
                      <span className="text-4xl italic font-black tracking-tighter text-slate-900">
                        {match.homeScore} <span className="text-world-cup-green mx-0.5">:</span> {match.awayScore}
                      </span>
                      <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest mt-1">FINAL</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="text-2xl text-gray-200 italic font-black tracking-[0.2em]">VS</span>
                      {!isStarted && (
                        <div className="animate-pulse bg-world-cup-gold/20 px-3 py-1 rounded-full mt-2">
                           <span className="text-[10px] text-world-cup-gold font-black uppercase tracking-widest">LIVE</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Away Team */}
                <div className="flex flex-col items-center gap-3 text-center flex-1">
                  <div className="relative">
                    <div className="w-20 h-14 rounded-2xl bg-white overflow-hidden border-2 border-gray-100 shadow-sm p-1">
                      {match.awayFlag ? <img src={match.awayFlag} alt={match.awayTeam} className="w-full h-full object-cover rounded-xl" /> : <div className="text-xl text-gray-300 h-full flex items-center justify-center">🏴</div>}
                    </div>
                  </div>
                  <span className="text-sm font-black text-slate-800 uppercase tracking-tight truncate w-full">{match.awayTeam}</span>
                  <div className="bg-gray-100 text-gray-400 text-[10px] font-black px-3 py-1 rounded-full">
                    0.00
                  </div>
                </div>
              </div>

              {/* Prediction Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  disabled={!canPredict}
                  onClick={() => handlePredict(match.id, PredictionChoice.HOME)}
                  className={`group relative overflow-hidden py-5 rounded-3xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 border-2 ${
                    prediction?.choice === PredictionChoice.HOME 
                      ? 'bg-world-cup-green border-world-cup-green text-white shadow-xl shadow-world-cup-green/20 scale-[1.02]' 
                      : canPredict 
                        ? 'bg-white border-gray-100 text-gray-400 hover:border-world-cup-green/30 hover:text-world-cup-green hover:bg-world-cup-green/5' 
                        : 'bg-gray-50 border-transparent text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {prediction?.choice === PredictionChoice.HOME && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                  <span>เจ้าบ้าน</span>
                </button>
                <button
                  disabled={!canPredict}
                  onClick={() => handlePredict(match.id, PredictionChoice.AWAY)}
                  className={`group relative overflow-hidden py-5 rounded-3xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 border-2 ${
                    prediction?.choice === PredictionChoice.AWAY 
                      ? 'bg-world-cup-green border-world-cup-green text-white shadow-xl shadow-world-cup-green/20 scale-[1.02]' 
                      : canPredict 
                        ? 'bg-white border-gray-100 text-gray-400 hover:border-world-cup-green/30 hover:text-world-cup-green hover:bg-world-cup-green/5' 
                        : 'bg-gray-50 border-transparent text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {prediction?.choice === PredictionChoice.AWAY && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                  <span>ทีมเยือน</span>
                </button>
              </div>

              {!isPastDeadline && !isBanned && (
                <div className="flex flex-col items-center gap-2 bg-world-cup-gold/5 py-4 rounded-[1.5rem] border border-world-cup-gold/10">
                  <div className="flex items-center gap-2 text-[10px] font-black text-world-cup-gold uppercase tracking-[0.2em]">
                    <Clock className="w-4 h-4" />
                    ปิดทายผลในอีก
                  </div>
                  <div className="text-xl font-black text-slate-800 tabular-nums">
                    {countdownStr}
                  </div>
                </div>
              )}

              {isPastDeadline && !isStarted && match.status !== MatchStatus.FINISHED && (
                <div className="flex items-center justify-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] bg-gray-50 py-3 rounded-2xl">
                  <Info className="w-4 h-4" />
                  หมดเวลาการทำนายผลแล้ว
                </div>
              )}

              <AnimatePresence>
                {isBanned && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="flex items-center gap-2 text-[10px] text-red-500 bg-red-500/10 p-3 rounded-2xl border border-red-500/20">
                    <Info className="w-3.5 h-3.5" />
                    ถูกแบน: อยู่ระหว่างรับโทษทางวินัย
                  </motion.div>
                )}

                {prediction && match.status === MatchStatus.FINISHED && (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`text-xs text-center py-3 rounded-2xl border ${
                      prediction.isResultCorrect 
                        ? 'bg-world-cup-green/20 border-world-cup-green/30 text-world-cup-green' 
                        : 'bg-red-500/20 border-red-500/30 text-red-400'
                    }`}
                  >
                    {prediction.isResultCorrect ? (
                      <span className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> ประตู! +{prediction.pointsEarned} คะแนน
                      </span>
                    ) : (
                      <span>ล้ำหน้า! {prediction.pointsEarned} คะแนน</span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default MatchList;
