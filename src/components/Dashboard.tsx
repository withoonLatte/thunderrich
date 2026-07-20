import React, { useEffect, useState } from 'react';
import ProfileCard from './ProfileCard';
import MatchList from './MatchList';
import Webboard from './Webboard';
import Leaderboard from './Leaderboard';
import ScoreGraph from './ScoreGraph';
import FinalSummaryModal from './FinalSummaryModal';
import { useAuth } from '../contexts/AuthContext';
import { Dice5, Coins, Spade, Info, X, Trophy } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';

interface DashboardProps {
  activeSubTab: 'predictions' | 'standings' | 'chat';
}

const Dashboard: React.FC<DashboardProps> = ({ activeSubTab }) => {
  const { user } = useAuth();
  const [showRules, setShowRules] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showFinalSummary, setShowFinalSummary] = useState(true);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const uList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
      setUsers(uList);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeSubTab === 'predictions') {
        const el = document.getElementById('matches-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (activeSubTab === 'standings') {
        const el = document.getElementById('leaderboard-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [activeSubTab]);

  return (
    <div className="space-y-12 pb-12">
      {/* Top Banner Button for Final Summary */}
      <div className="mx-3 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 p-[2px] rounded-2xl shadow-[0_10px_30px_rgba(245,158,11,0.25)]">
        <button
          onClick={() => setShowFinalSummary(true)}
          className="w-full bg-[#0b1329] hover:bg-slate-900 px-5 py-4 rounded-[14px] flex items-center justify-between transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-amber-400 fill-current animate-bounce shrink-0" />
            <div className="text-left">
              <h4 className="text-sm font-black text-white uppercase tracking-wider">
                🏆 สรุปผลคะแนนรวมบอลโลก 2026 (FINAL SUMMARY CHART)
              </h4>
              <p className="text-[10px] font-bold text-amber-400/90 uppercase tracking-widest">
                คลิกเพื่อเปิดดูแท่นแชมป์และกราฟพล็อตสรุปอันดับล่าสุด
              </p>
            </div>
          </div>
          <span className="bg-amber-500 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-xl uppercase tracking-wider shadow shrink-0">
            เปิดดูกราฟ 📊
          </span>
        </button>
      </div>

      <FinalSummaryModal
        isOpen={showFinalSummary}
        onClose={() => setShowFinalSummary(false)}
        users={users}
      />

      {activeSubTab === 'predictions' && (
        <>
          {/* Top Section: Profile */}
          <section>
            <ProfileCard />
          </section>
          
          {/* Middle Section: Predictions */}
          <section id="matches-section" className="space-y-6 scroll-mt-20">
            <div className="mx-3 bg-gradient-to-r from-blue-500 via-fuchsia-500 to-yellow-500 p-[1.5px] rounded-2xl shadow-xl">
              <div className="bg-[#0f172a]/95 px-5 py-4.5 rounded-[14px] flex items-center justify-between">
                <h3 className="text-base font-black text-white uppercase tracking-[0.15em] flex items-center gap-2.5">
                  <Dice5 className="w-5 h-5 text-emerald-400 animate-spin-slow rotate-12" />
                  รายการแข่งขัน
                </h3>
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest border border-emerald-500/30 px-3 py-1 rounded-lg bg-emerald-500/10">MATCHES</span>
              </div>
            </div>
            <MatchList />
          </section>
        </>
      )}

      {activeSubTab === 'standings' && (
        <>
          {/* Stats Section */}
          <section className="px-3">
            <ScoreGraph />
          </section>
          
          {/* Leaderboard Section */}
          <section id="leaderboard-section" className="space-y-6 scroll-mt-20">
            <div className="mx-3 bg-gradient-to-r from-blue-500 via-fuchsia-500 to-yellow-500 p-[1.5px] rounded-2xl shadow-xl">
              <div className="bg-[#0f172a]/95 px-5 py-4.5 rounded-[14px] flex items-center justify-between">
                <h3 className="text-base font-black text-white uppercase tracking-[0.15em] flex items-center gap-2.5">
                  <Coins className="w-5 h-5 text-yellow-400 animate-pulse" />
                  อันดับรวยฟ้าผ่า
                </h3>
                <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest border border-yellow-500/30 px-3 py-1 rounded-lg bg-yellow-500/10">LEADERBOARD</span>
              </div>
            </div>
            <Leaderboard />
          </section>
        </>
      )}

      {activeSubTab === 'chat' && (
        <>
          {/* Bottom Section: Webboard */}
          <section id="webboard-section" className="space-y-6 pt-4 scroll-mt-20">
            <div className="mx-3 bg-gradient-to-r from-blue-500 via-fuchsia-500 to-yellow-500 p-[1.5px] rounded-2xl shadow-xl">
              <div className="bg-[#0f172a]/95 px-5 py-4.5 rounded-[14px] flex items-center justify-between">
                <h3 className="text-base font-black text-white uppercase tracking-[0.15em] flex items-center gap-2.5">
                  <Spade className="w-5 h-5 text-fuchsia-400 transform hover:scale-110 transition-transform" />
                  ห้องแต่งตัวเพื่อนซี้
                </h3>
                <span className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest border border-fuchsia-500/30 px-3 py-1 rounded-lg bg-fuchsia-500/10">BANTER BOARD</span>
              </div>
            </div>
            <Webboard />
          </section>
        </>
      )}

      {activeSubTab === 'predictions' && (
        <button
          onClick={() => { setShowRules(true); setIsZoomed(false); }}
          className="fixed bottom-28 right-5 z-40 flex items-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-blue-500 to-fuchsia-500 hover:from-blue-600 hover:to-fuchsia-600 text-white rounded-full shadow-lg shadow-fuchsia-500/20 hover:scale-105 transition-all cursor-pointer font-black text-xs border border-white/20"
        >
          <Info className="w-4 h-4 text-white animate-pulse" />
          <span>ราคาบอล</span>
        </button>
      )}

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg z-[100] flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl flex justify-between items-center mb-3">
            <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Info className="w-4 h-4 text-fuchsia-400" />
              ตารางราคาบอลแฮนดิแคป (0.0 - 1.75)
            </h4>
            <button 
              onClick={() => setShowRules(false)}
              className="p-2 bg-slate-800/80 hover:bg-red-500 hover:text-white text-slate-400 rounded-full transition-all cursor-pointer shadow-lg border border-slate-700/50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className={`w-full max-w-2xl bg-slate-900 rounded-2xl border border-slate-800 overflow-auto shadow-2xl max-h-[75vh] p-1 select-none ${isZoomed ? 'block' : 'flex items-center justify-center'}`}>
            <img 
              src="/handicap_rules.jpg" 
              alt="ตารางราคาบอลแฮนดิแคป" 
              onClick={() => setIsZoomed(!isZoomed)}
              className={`h-auto rounded-lg object-contain transition-all duration-300 cursor-zoom-in ${isZoomed ? 'max-w-none w-[200%] cursor-zoom-out' : 'w-full'}`}
            />
          </div>
          
          <p className="text-[10px] text-slate-400 mt-3 font-medium text-center">
            💡 กดที่รูปภาพเพื่อซูมเข้า/ออก หรือใช้สองนิ้วเพื่อเลื่อนขยายอ่านรายละเอียด
          </p>
        </div>
      )}

      {/* Footer */}
      <section className="pt-8 border-t border-gray-100 opacity-30">
        <p className="text-center text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] leading-relaxed">
          ⚽️ PREDICTION PRO #20 <br />
          WORLD CUP 2026 EDITION
        </p>
      </section>
    </div>
  );
};

export default Dashboard;
