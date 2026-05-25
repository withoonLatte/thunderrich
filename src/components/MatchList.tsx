import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, setDoc, doc, Timestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Match, Prediction, PredictionChoice, MatchStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Info, CheckCircle2 } from 'lucide-react';

interface TeamLogoProps {
  src?: string;
  teamName: string;
  isActive?: boolean;
}

const TeamLogo: React.FC<TeamLogoProps> = ({ src, teamName, isActive }) => {
  const [error, setError] = React.useState(false);

  // If no logo or image failed to load, show beautiful initial badge
  const showFallback = !src || error;

  return (
    <div className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-slate-950/60 p-2 border-2 shadow-inner flex items-center justify-center transition-all ${
      isActive ? 'border-emerald-500 bg-emerald-950/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'border-slate-800'
    }`}>
      {showFallback ? (
        <div className="w-full h-full rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 flex items-center justify-center text-sm font-black text-slate-400 select-none">
          {teamName.substring(0, 2).toUpperCase()}
        </div>
      ) : (
        <img 
          src={src} 
          alt={teamName} 
          onError={() => setError(true)}
          className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-transform duration-300 hover:scale-105" 
        />
      )}
    </div>
  );
};

const MatchList: React.FC = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [allPredictions, setAllPredictions] = useState<Prediction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'finished'>('active');
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
      setMatches(sorted.filter(m => m.isPublished === true));
    });

    const unsubAllPreds = onSnapshot(collection(db, 'predictions'), (snap) => {
      const preds = snap.docs.map(d => ({ id: d.id, ...d.data() } as Prediction));
      setAllPredictions(preds);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const allUsers = snap.docs.map(d => d.data() as User);
      setUsers(allUsers);
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
        unsubAllPreds();
        unsubUsers();
        unsubPreds();
      };
    }

    return () => {
      unsubMatches();
      unsubAllPreds();
      unsubUsers();
    };
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
      {/* Glossy Tab Switcher */}
      <div className="bg-slate-900/60 p-1.5 rounded-[1.5rem] flex gap-1 border border-slate-800/80 mx-1 shadow-inner">
        <button 
          type="button"
          onClick={() => setActiveTab('active')}
          className={`flex-1 text-center py-3 rounded-[1.1rem] text-xs sm:text-sm font-black transition-all duration-200 cursor-pointer ${
            activeTab === 'active' 
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 scale-[1.02]' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          แมตช์เปิดทายผล ({matches.filter(m => m.status !== MatchStatus.FINISHED).length})
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab('finished')}
          className={`flex-1 text-center py-3 rounded-[1.1rem] text-xs sm:text-sm font-black transition-all duration-200 cursor-pointer ${
            activeTab === 'finished' 
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 scale-[1.02]' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ผลการแข่งขันย้อนหลัง ({matches.filter(m => m.status === MatchStatus.FINISHED).length})
        </button>
      </div>

      {matches
        .filter(m => activeTab === 'active' ? m.status !== MatchStatus.FINISHED : m.status === MatchStatus.FINISHED)
        .map((match, index) => {
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

        // Calculate community votes
        const matchPreds = allPredictions.filter(p => p.matchId === match.id);
        const homeVotes = matchPreds.filter(p => p.choice === PredictionChoice.HOME);
        const awayVotes = matchPreds.filter(p => p.choice === PredictionChoice.AWAY);
        
        const homeCount = homeVotes.length;
        const awayCount = awayVotes.length;
        const totalVotes = homeCount + awayCount;
        
        const homePercent = totalVotes > 0 ? Math.round((homeCount / totalVotes) * 100) : 0;
        const awayPercent = totalVotes > 0 ? Math.round((awayCount / totalVotes) * 100) : 0;

        // Find majority favorite
        let majorityLabel = '';
        if (totalVotes > 0) {
          if (homeCount > awayCount) majorityLabel = `ฝั่งยอดนิยม: ${match.homeTeam} 🔥 (${homeCount} คน • ${homePercent}%)`;
          else if (awayCount > homeCount) majorityLabel = `ฝั่งยอดนิยม: ${match.awayTeam} 🔥 (${awayCount} คน • ${awayPercent}%)`;
          else majorityLabel = `เลือกสูสีเท่ากัน ⚖️ (ฝั่งละ ${homeCount} คน)`;
        }
        
        const showVotes = isPastDeadline || match.status === MatchStatus.FINISHED;

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
                  <div className="flex flex-col gap-0.5 mt-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                      {match.round === 'group' ? 'ทายถูก +1 / ทายผิด 0' : 
                       match.round === 'top32' ? 'ทายถูก +2 / ทายผิด -1' : 
                       match.round === 'top16' ? 'ทายถูก +3 / ทายผิด -2' :  
                       match.round === 'top8' ? 'ทายถูก +4 / ทายผิด -2' : 
                       match.round === 'top4' || match.round === 'third_place' ? 'ทายถูก +5 / ทายผิด -3' : 
                       match.round === 'final' ? 'ทายถูก +7 / ทายผิด -3' : ''} PTS
                    </span>
                    <span className="text-[9px] font-black text-red-400/80 uppercase tracking-wider leading-none">
                      {match.round === 'group' || match.round === 'top32' ? '✕ ไม่ทายหัก -1' : 
                       match.round === 'top16' || match.round === 'top8' ? '✕ ไม่ทายหัก -2' : 
                       '✕ ไม่ทายหัก -3'} PTS
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs font-black text-slate-350 bg-slate-950/40 px-3.5 py-2 rounded-xl border border-slate-800">
                <Clock className="w-4 h-4 text-yellow-400" />
                {isStarted ? 'เริ่มการแข่งขันแล้ว' : format(startTime, 'dd/MM/yyyy HH:mm')}
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between gap-2.5 sm:gap-4">
                {/* Home Team */}
                <button 
                  disabled={!canPredict || isSaving}
                  onClick={() => setStaged(match.id, PredictionChoice.HOME)}
                  className={`flex flex-col items-center gap-3.5 text-center flex-1 p-3 rounded-3xl transition-all border-2 whitespace-normal ${
                    activeChoice === PredictionChoice.HOME 
                      ? 'bg-emerald-500/15 border-emerald-500 scale-[1.04] shadow-[0_0_20px_rgba(34,197,94,0.25)]' 
                      : canPredict 
                        ? 'border-slate-800/80 bg-slate-900/40 hover:bg-slate-850 hover:border-slate-700' 
                        : 'border-transparent opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="relative">
                    <TeamLogo 
                      src={match.homeFlag} 
                      teamName={match.homeTeam} 
                      isActive={activeChoice === PredictionChoice.HOME} 
                    />
                    {activeChoice === PredictionChoice.HOME && (
                      <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-slate-950 rounded-full p-0.5 shadow-lg ring-3 ring-[#0f172a] animate-pulse">
                        <CheckCircle2 className="w-4 h-4 fill-current text-white" />
                      </div>
                    )}
                  </div>
                  <span className={`text-xs sm:text-sm md:text-base font-black uppercase tracking-tight whitespace-normal line-clamp-2 w-full transition-colors leading-tight min-h-[2.5rem] flex items-center justify-center ${
                    activeChoice === PredictionChoice.HOME ? 'text-emerald-400' : 'text-slate-200 hover:text-slate-100'
                  }`}>
                    {match.homeTeam}
                  </span>
                </button>

                {/* Score / VS */}
                <div className="flex flex-col items-center gap-1.5 min-w-[90px] sm:min-w-[120px] shrink-0">
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
                      <div className="flex flex-col items-center relative -mt-0.5 w-full">
                        <div className="bg-emerald-500 text-slate-950 text-[9px] sm:text-[10px] font-black px-3 py-1 rounded-t-xl uppercase tracking-widest shadow-lg z-10 text-center w-full max-w-[70px]">
                          ราคาบอล
                        </div>
                        <div className="bg-slate-900 border-2 border-emerald-400 text-emerald-400 text-[10px] sm:text-xs md:text-sm font-black px-2 py-1.5 rounded-b-xl rounded-tr-xl shadow-[0_8px_25px_rgba(0,0,0,0.3)] min-w-[80px] sm:min-w-[100px] max-w-[100px] sm:max-w-[120px] text-center -mt-0.5 leading-snug whitespace-normal break-words flex items-center justify-center">
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
                  className={`flex flex-col items-center gap-3.5 text-center flex-1 p-3 rounded-3xl transition-all border-2 whitespace-normal ${
                    activeChoice === PredictionChoice.AWAY 
                      ? 'bg-emerald-500/15 border-emerald-500 scale-[1.04] shadow-[0_0_20px_rgba(34,197,94,0.25)]' 
                      : canPredict 
                        ? 'border-slate-800/80 bg-slate-900/40 hover:bg-slate-850 hover:border-slate-700' 
                        : 'border-transparent opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="relative">
                    <TeamLogo 
                      src={match.awayFlag} 
                      teamName={match.awayTeam} 
                      isActive={activeChoice === PredictionChoice.AWAY} 
                    />
                    {activeChoice === PredictionChoice.AWAY && (
                      <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-slate-950 rounded-full p-0.5 shadow-lg ring-3 ring-[#0f172a] animate-pulse">
                        <CheckCircle2 className="w-4 h-4 fill-current text-white" />
                      </div>
                    )}
                  </div>
                  <span className={`text-xs sm:text-sm md:text-base font-black uppercase tracking-tight whitespace-normal line-clamp-2 w-full transition-colors leading-tight min-h-[2.5rem] flex items-center justify-center ${
                    activeChoice === PredictionChoice.AWAY ? 'text-emerald-400' : 'text-slate-200 hover:text-slate-100'
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

                {match.status === MatchStatus.FINISHED && (
                  <div className="space-y-3.5 mt-2 bg-slate-950/40 p-4.5 rounded-[1.8rem] border border-slate-800/80">
                    <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800/40 pb-2.5">
                      <span>สรุปข้อมูลการทายผล</span>
                      <span className="text-slate-500">MATCH REPORT</span>
                    </div>

                    {prediction && prediction.choice ? (
                      <div className="space-y-3">
                        {/* Choice Summary */}
                        <div className="flex items-center justify-between text-sm font-bold px-1">
                          <span className="text-slate-350 font-black">คุณเลือกทีมชนะ:</span>
                          <span className={`font-black uppercase tracking-tight ${
                            prediction.choice === PredictionChoice.HOME ? 'text-emerald-400' : 'text-fuchsia-400'
                          }`}>
                            {prediction.choice === PredictionChoice.HOME ? match.homeTeam : match.awayTeam}
                          </span>
                        </div>

                        {/* Result Badge */}
                        <motion.div 
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className={`text-xs sm:text-sm text-center py-3 rounded-2xl border font-black tracking-wide flex items-center justify-center gap-2.5 ${
                            prediction.isResultCorrect 
                              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.05)]' 
                              : 'bg-red-500/10 border-red-500/25 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.05)]'
                          }`}
                        >
                          {prediction.isResultCorrect ? (
                            <>
                              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                              <span>ประตู! ได้รับ +{prediction.pointsEarned} คะแนน</span>
                            </>
                          ) : (
                            <>
                              <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 font-black text-xs flex-shrink-0">✕</div>
                              <span>ล้ำหน้า! {prediction.pointsEarned} คะแนน</span>
                            </>
                          )}
                        </motion.div>
                      </div>
                    ) : (() => {
                      const penaltyByRound: Record<string, number> = {
                        'group': -1,
                        'top32': -1,
                        'top16': -2,
                        'top8': -2,
                        'top4': -3,
                        'third_place': -3,
                        'final': -3
                      };
                      const penaltyVal = prediction?.pointsEarned !== undefined ? prediction.pointsEarned : (penaltyByRound[match.round] || 0);

                      return (
                        <div className="text-xs font-black text-center text-red-400 py-3.5 bg-red-950/15 rounded-2xl border border-dashed border-red-500/25 flex flex-col items-center gap-1">
                          <span className="text-red-500">✕ ไม่ได้ส่งคำทำนายผลสำหรับแมตช์นี้</span>
                          <span className="text-[10px] text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 mt-1">
                            (ถูกหัก {penaltyVal} คะแนน)
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Admin-only Community Vote Breakdown */}
                {user?.role === 'admin' && showVotes && (
                  <div className="space-y-4 mt-3.5 bg-slate-950/60 p-4.5 rounded-[1.8rem] border border-slate-800/80 shadow-inner">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800/40 pb-2.5">
                      <span className="flex items-center gap-1.5 text-emerald-400">📊 มติเพื่อนซี้ (COMMUNITY VOTE - ADMIN ONLY)</span>
                      <span>โหวตทั้งหมด {totalVotes} คน</span>
                    </div>

                    {totalVotes > 0 ? (
                      <div className="space-y-3">
                        {/* Vote Percentages Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-black px-1">
                            <span className="text-emerald-400">{match.homeTeam} ({homeCount} คน)</span>
                            <span className="text-fuchsia-400">{match.awayTeam} ({awayCount} คน)</span>
                          </div>
                          <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
                            <div 
                              style={{ width: `${homePercent}%` }} 
                              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                            />
                            <div 
                              style={{ width: `${awayPercent}%` }} 
                              className="h-full bg-gradient-to-l from-fuchsia-600 to-fuchsia-400 transition-all duration-500"
                            />
                          </div>
                          <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">
                            <span>{homePercent}% VOTE</span>
                            <span>{awayPercent}% VOTE</span>
                          </div>
                        </div>

                        {/* Majority Favorite Box */}
                        <div className="bg-slate-900/60 py-2.5 px-3.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-bold shadow-inner">
                          <span className="text-slate-400 font-black">ทีมยอดนิยม:</span>
                          <span className="text-yellow-400 font-black tracking-tight">{majorityLabel}</span>
                        </div>

                        {/* Voter Names Breakdown */}
                        <div className="space-y-2 pt-1.5 text-[10px] sm:text-xs">
                          <div className="bg-emerald-950/10 p-2 rounded-xl border border-emerald-950/20 text-left">
                            <span className="font-black text-emerald-400">🟢 ทาย {match.homeTeam} ({homeCount} คน): </span>
                            <span className="text-slate-300 font-bold leading-relaxed">
                              {homeCount > 0 
                                ? homeVotes.map(v => users.find(u => u.uid === v.userId)?.displayName || 'ผู้เล่น').join(', ')
                                : 'ไม่มี'
                              }
                            </span>
                          </div>
                          <div className="bg-fuchsia-950/10 p-2 rounded-xl border border-fuchsia-950/20 text-left">
                            <span className="font-black text-fuchsia-400">🔴 ทาย {match.awayTeam} ({awayCount} คน): </span>
                            <span className="text-slate-300 font-bold leading-relaxed">
                              {awayCount > 0 
                                ? awayVotes.map(v => users.find(u => u.uid === v.userId)?.displayName || 'ผู้เล่น').join(', ')
                                : 'ไม่มี'
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-center text-slate-450 py-3 bg-slate-900/20 rounded-xl border border-dashed border-slate-800/60">
                        ไม่มีผู้เล่นส่งคำทำนายในคู่นี้
                      </div>
                    )}
                  </div>
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
