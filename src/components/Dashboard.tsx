import React from 'react';
import ProfileCard from './ProfileCard';
import MatchList from './MatchList';
import Webboard from './Webboard';
import Leaderboard from './Leaderboard';
import ScoreGraph from './ScoreGraph';
import { useAuth } from '../contexts/AuthContext';
import { Dice5, Coins, Spade } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-12 pb-12">
      {/* Top Section: Profile */}
      <section>
        <ProfileCard />
      </section>

      {/* Stats Section */}
      <section className="px-3">
        <ScoreGraph />
      </section>
      
      {/* Middle Section: Predictions */}
      <section className="space-y-6">
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

      {/* Leaderboard Section */}
      <section className="space-y-6">
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

      {/* Bottom Section: Webboard */}
      <section id="webboard-section" className="space-y-6 pt-4">
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
