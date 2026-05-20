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
        <div className="mx-3 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 p-[1.5px] rounded-2xl shadow-xl">
          <div className="bg-white/95 px-5 py-4 rounded-[14px] flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-950 uppercase tracking-[0.15em] flex items-center gap-2.5">
              <Dice5 className="w-5 h-5 text-purple-600 animate-spin-slow rotate-12" />
              รายการแข่งขัน
            </h3>
            <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest border border-purple-200 px-2 py-0.5 rounded-md bg-purple-50">MATCHES</span>
          </div>
        </div>
        <MatchList />
      </section>

      {/* Leaderboard Section */}
      <section className="space-y-6">
        <div className="mx-3 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 p-[1.5px] rounded-2xl shadow-xl">
          <div className="bg-white/95 px-5 py-4 rounded-[14px] flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-950 uppercase tracking-[0.15em] flex items-center gap-2.5">
              <Coins className="w-5 h-5 text-pink-500 animate-pulse" />
              อันดับรวยฟ้าผ่า
            </h3>
            <span className="text-[10px] font-black text-pink-500 uppercase tracking-widest border border-pink-200 px-2 py-0.5 rounded-md bg-pink-50">LEADERBOARD</span>
          </div>
        </div>
        <Leaderboard />
      </section>

      {/* Bottom Section: Webboard */}
      <section id="webboard-section" className="space-y-6 pt-4">
        <div className="mx-3 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 p-[1.5px] rounded-2xl shadow-xl">
          <div className="bg-white/95 px-5 py-4 rounded-[14px] flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-950 uppercase tracking-[0.15em] flex items-center gap-2.5">
              <Spade className="w-5 h-5 text-fuchsia-600 transform hover:scale-110 transition-transform" />
              ห้องแต่งตัวเพื่อนซี้
            </h3>
            <span className="text-[10px] font-black text-fuchsia-600 uppercase tracking-widest border border-fuchsia-200 px-2 py-0.5 rounded-md bg-fuchsia-50">BANTER BOARD</span>
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
