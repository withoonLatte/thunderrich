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
  const [stagedChoices, setStagedChoices] = useState<Record<string, PredictionChoice | null>>({});
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubMatches = onSnapshot(query(collection(db, 'matches'), orderBy('startTime', 'asc')), (snap) => {
      const allMatches = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      const sorted = [...allMatches].sort((a, b) => (a.startTime?.seconds || 0) - (b.startTime?.seconds || 0));
      setMatches(sorted.filter(m => m.isPublished === true && m.status !== MatchStatus.FINISHED));
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

  const handlePredict = async (matchId: string) => {
    const choice = stagedChoices[matchId];
    if (!user || !choice) return;
    
    setSavingMap(prev => ({ ...prev, [matchId]: true }));
    
    // Check if match already started or reached deadline
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const deadline = match.predictionDeadline ? match.predictionDeadline.seconds : match.startTime.seconds;
    if (deadline < Timestamp.now().seconds) {
      alert('หมดเวลาทายผลสำหรับแมตช์นี้แล้ว');
      setSavingMap(prev => ({ ...prev, [matchId]: false }));
      return;
    }

    // Check if user is banned for this match
    if (user.bannedMatchIds?.includes(matchId)) {
      setSavingMap(prev => ({ ...prev, [matchId]: false }));
      return;
    }

    try {
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
      
      // Clear staged choice after successful save
      setStagedChoices(prev => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
    } catch (error) {
      console.error('Error saving prediction:', error);
    } finally {
      setSavingMap(prev => ({ ...prev, [matchId]: false }));
    }
  };

  const setStaged = (matchId: string, choice: PredictionChoice) => {
    setStagedChoices(prev => ({ ...prev, [matchId]: choice }));
  };

  return (
    <div className="space-y-6">
      {matches.map((match, index) => {
        const prediction = predictions[match.id];
        const stagedChoice = stagedChoices[match.id];
        const activeChoice = stagedChoice || prediction?.choice;
        const isSaving = savingMap[match.id];
        const hasChanges = stagedChoice !== undefined && stagedChoice !== prediction?.choice;

        const startTime = new Date(match.startTime.seconds * 1000);
        const deadline = match.predictionDeadline ? new Date(match.predictionDeadline.seconds * 1000) : startTime;
        
        const isStarted = match.startTime.seconds < Timestamp.now().seconds;
        const isPastDeadline = deadline.getTime() < now.getTime();
        const isBanned = user?.bannedMatchIds?.includes(match.id);
        const canPredict = user?.role !== 'admin' && !isPastDeadline && !isBanned;

        // Countdown logic
        const diff = deadline.getTime() - now.getTime();
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        const countdownStr = diff > 0 ? `${h} ชม. ${m} น. ${s} วิ.` : null;

        return (
          <motion.div 
            key={match.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`bg-[#0f172a]/90 backdrop-blur-3xl rounded-[2.2rem] overflow-hidden border border-slate-800/80 shadow-[0_15px_35px_rgba(0,0,0,0.3)] transition-all ${
              isPastDeadline ? 'opacity-80 grayscale-[0.3]' : 'hover:border-fuchsia-500/40 hover:shadow-[0_15px_40px_rgba(217,70,239,0.1)]'
            }`}
          >
            {/* Round & Date Header */}
            <div className="bg-slate-900/60 px-5 py-4 flex justify-between items-center border-b border-slate-800/80">
              <div className="flex flex-col">
                <span className="text-[12px] font-black text-emerald-400 uppercase tracking-widest">{match.round.replace('_', ' ')}</span>
                {match.customWinScore !== undefined && match.customWinScore !== null ? (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 mt-2 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-600 border border-fuchsia-400 shadow-lg shadow-fuchsia-500/20 animate-pulse">
                    <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                    <span className="text-[13px] font-black text-white uppercase tracking-tighter">
                      คู่เอก: +{match.customWinScore} / {match.customLossScore} PTS
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                    {match.round === 'group' ? '+2 / -1' : 
                     match.round === 'top16' ? '+3 / -2' : 
                     match.round === 'top8' ? '+4 / -2' : 
                     match.round === 'top4' || match.round === 'third_place' ? '+5 / -3' : 
                     match.round === 'final' ? '+7 / -3' : ''} PTS
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs font-black text-slate-350 bg-slate-950/40 px-3.5 py-2 rounded-xl border border-slate-800">
                <Clock className="w-4 h-4 text-yellow-400" />
                {isStarted ? 'เริ่มการแข่งขันแล้ว' : format(startTime, 'dd/MM/yyyy HH:mm')}
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between gap-3 sm:gap-4">
                {/* Home Team */}
                <button 
                  disabled={!canPredict || isSaving}
                  onClick={() => setStaged(match.id, PredictionChoice.HOME)}
                  className={`flex flex-col items-center gap-3 text-center flex-1 p-3.5 rounded-3xl transition-all border-2 ${
                    activeChoice === PredictionChoice.HOME 
                      ? 'bg-emerald-500/15 border-emerald-500 scale-[1.04] shadow-[0_0_20px_rgba(34,197,94,0.2)]' 
                      : canPredict 
                        ? 'border-slate-800/80 bg-slate-900/40 hover:bg-slate-850 hover:border-slate-700' 
                        : 'border-transparent opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="relative">
                    <div className={`w-20 h-14 rounded-2xl bg-slate-950 overflow-hidden border-2 shadow-inner p-1 transition-all ${
                      activeChoice === PredictionChoice.HOME ? 'border-emerald-500' : 'border-slate-800'
                    }`}>
                      {match.homeFlag ? (
                        <img src={match.homeFlag} alt={match.homeTeam} className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <div className="text-xl text-slate-500 h-full flex items-center justify-center">🏴</div>
                      )}
                    </div>
                    {activeChoice === PredictionChoice.HOME && (
                      <div className="absolute -top-2 -right-2 bg-emerald-500 text-slate-950 rounded-full p-0.5 shadow-lg ring-3 ring-[#0f172a] animate-pulse">
                        <CheckCircle2 className="w-4 h-4 fill-current text-white" />
                      </div>
                    )}
                  </div>
                  <span className={`text-base sm:text-lg font-black uppercase tracking-tight truncate w-full transition-colors ${
                    activeChoice === PredictionChoice.HOME ? 'text-emerald-400' : 'text-slate-100'
                  }`}>
                    {match.homeTeam}
                  </span>
                </button>

                {/* Score / VS */}
                <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
                  {match.status === MatchStatus.FINISHED ? (
                    <div className="flex flex-col items-center">
                      <span className="text-4xl sm:text-5xl italic font-black tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                        {match.homeScore} <span className="text-emerald-400 mx-0.5 animate-pulse">:</span> {match.awayScore}
                      </span>
                      <span className="text-[10px] font-black text-slate-450 uppercase tracking-[0.2em] mt-1 bg-slate-950/60 px-2 py-0.5 rounded-md border border-slate-800">FINAL</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xl text-slate-500 italic font-black tracking-[0.25em]">VS</span>
                      <div className="flex flex-col items-center relative -mt-0.5">
                        <div className="bg-emerald-500 text-slate-950 text-[10px] font-black px-4 py-1.5 rounded-t-xl uppercase tracking-widest shadow-lg z-10">
                          ราคาบอล
                        </div>
                        <div className="bg-slate-900 border-2 border-emerald-400 text-emerald-400 text-2xl font-black px-6 py-2 rounded-b-2xl rounded-tr-2xl shadow-[0_8px_25px_rgba(0,0,0,0.3)] min-w-[100px] text-center -mt-0.5">
                          {match.handicap || '0.0'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Away Team */}
                <button 
                  disabled={!canPredict || isSaving}
                  onClick={() => setStaged(match.id, PredictionChoice.AWAY)}
                  className={`flex flex-col items-center gap-3 text-center flex-1 p-3.5 rounded-3xl transition-all border-2 ${
                    activeChoice === PredictionChoice.AWAY 
                      ? 'bg-emerald-500/15 border-emerald-500 scale-[1.04] shadow-[0_0_20px_rgba(34,197,94,0.2)]' 
                      : canPredict 
                        ? 'border-slate-800/80 bg-slate-900/40 hover:bg-slate-850 hover:border-slate-700' 
                        : 'border-transparent opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="relative">
                    <div className={`w-20 h-14 rounded-2xl bg-slate-950 overflow-hidden border-2 shadow-inner p-1 transition-all ${
                      activeChoice === PredictionChoice.AWAY ? 'border-emerald-500' : 'border-slate-800'
                    }`}>
                      {match.awayFlag ? (
                        <img src={match.awayFlag} alt={match.awayTeam} className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <div className="text-xl text-slate-500 h-full flex items-center justify-center">🏴</div>
                      )}
                    </div>
                    {activeChoice === PredictionChoice.AWAY && (
                      <div className="absolute -top-2 -right-2 bg-emerald-500 text-slate-950 rounded-full p-0.5 shadow-lg ring-3 ring-[#0f172a] animate-pulse">
                        <CheckCircle2 className="w-4 h-4 fill-current text-white" />
                      </div>
                    )}
                  </div>
                  <span className={`text-base sm:text-lg font-black uppercase tracking-tight truncate w-full transition-colors ${
                    activeChoice === PredictionChoice.AWAY ? 'text-emerald-400' : 'text-slate-100'
                  }`}>
                    {match.awayTeam}
                  </span>
                </button>
              </div>

              <AnimatePresence>
                {hasChanges && canPredict && (
                  <motion.button
                    initial={{ height: 0, opacity: 0, y: 10 }}
                    animate={{ height: 'auto', opacity: 1, y: 0 }}
                    exit={{ height: 0, opacity: 0, y: 10 }}
                    disabled={isSaving}
                    onClick={() => handlePredict(match.id)}
                    className="wc-btn-neon w-full bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 py-4.5 rounded-2xl font-black uppercase tracking-widest shadow-[0_8px_25px_rgba(234,179,8,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 mb-2 cursor-pointer text-base"
                  >
                    {isSaving ? (
                      <Clock className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        ยืนยันส่งคำทายผล
                      </>
                    )}
                  </motion.button>
                )}
              </AnimatePresence>

              {!isPastDeadline && !isBanned && (
                <div className="flex flex-col items-center gap-2 bg-slate-950/60 py-4 rounded-[1.5rem] border border-slate-800/80">
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    <Clock className="w-4 h-4 text-fuchsia-400" />
                    ปิดทายผลในอีก
                  </div>
                  <div className="text-2xl font-black text-yellow-450 tabular-nums drop-shadow-[0_0_8px_rgba(250,204,21,0.25)]">
                    {countdownStr}
                  </div>
                </div>
              )}

              {isPastDeadline && !isStarted && match.status !== MatchStatus.FINISHED && (
                <div className="flex items-center justify-center gap-2 text-[11px] font-black text-slate-450 uppercase tracking-widest bg-slate-950/40 py-3.5 rounded-2xl border border-slate-850">
                  <Info className="w-4 h-4 text-fuchsia-400" />
                  หมดเวลาการทำนายผลแล้ว
                </div>
              )}

              <AnimatePresence>
                {isBanned && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="flex items-center gap-2.5 text-xs text-red-400 bg-red-950/20 p-4 rounded-2xl border border-red-500/20 font-black uppercase tracking-wide">
                    <Info className="w-4 h-4 text-red-500" />
                    ถูกแบน: อยู่ระหว่างรับโทษทางวินัย
                  </motion.div>
                )}

                {prediction && match.status === MatchStatus.FINISHED && (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`text-sm text-center py-3.5 rounded-2xl border font-black tracking-wide ${
                      prediction.isResultCorrect 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}
                  >
                    {prediction.isResultCorrect ? (
                      <span className="flex items-center justify-center gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" /> ประตู! +{prediction.pointsEarned} คะแนน
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
