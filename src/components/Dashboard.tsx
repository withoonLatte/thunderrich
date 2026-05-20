import React from 'react';
import ProfileCard from './ProfileCard';
import MatchList from './MatchList';
import Webboard from './Webboard';
import Leaderboard from './Leaderboard';
import ScoreGraph from './ScoreGraph';
import { useAuth } from '../contexts/AuthContext';

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
        <div className="mx-3 bg-gradient-to-r from-slate-900/95 to-slate-850/90 bg-slate-900 border-l-4 border-world-cup-green text-white px-5 py-4 rounded-2xl flex items-center justify-between shadow-xl backdrop-blur-md relative overflow-hidden border border-white/5">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-12 h-12 bg-world-cup-green/10 rounded-full blur-xl"></div>
          <h3 className="text-sm font-black uppercase tracking-[0.15em] flex items-center gap-2.5">
            <span className="w-2 h-2 bg-world-cup-green rounded-full animate-pulse"></span>
            รายการแข่งขัน
          </h3>
          <span className="text-[10px] font-black text-world-cup-green uppercase tracking-widest border border-world-cup-green/30 px-2 py-0.5 rounded-md bg-world-cup-green/5">MATCHES</span>
        </div>
        <MatchList />
      </section>

      {/* Leaderboard Section */}
      <section className="space-y-6">
        <div className="mx-3 bg-gradient-to-r from-slate-900/95 to-slate-850/90 bg-slate-900 border-l-4 border-world-cup-gold text-white px-5 py-4 rounded-2xl flex items-center justify-between shadow-xl backdrop-blur-md relative overflow-hidden border border-white/5">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-12 h-12 bg-world-cup-gold/10 rounded-full blur-xl"></div>
          <h3 className="text-sm font-black uppercase tracking-[0.15em] flex items-center gap-2.5">
            <span className="w-2 h-2 bg-world-cup-gold rounded-full"></span>
            อันดับรวยฟ้าผ่า
          </h3>
          <span className="text-[10px] font-black text-world-cup-gold uppercase tracking-widest border border-world-cup-gold/30 px-2 py-0.5 rounded-md bg-world-cup-gold/5">LEADERBOARD</span>
        </div>
        <Leaderboard />
      </section>

      {/* Bottom Section: Webboard */}
      <section id="webboard-section" className="space-y-6 pt-4">
        <div className="mx-3 bg-gradient-to-r from-slate-900/95 to-slate-850/90 bg-slate-900 border-l-4 border-pink-500 text-white px-5 py-4 rounded-2xl flex items-center justify-between shadow-xl backdrop-blur-md relative overflow-hidden border border-white/5">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-12 h-12 bg-pink-500/10 rounded-full blur-xl"></div>
          <h3 className="text-sm font-black uppercase tracking-[0.15em] flex items-center gap-2.5">
            <span className="w-2 h-2 bg-pink-500 rounded-full animate-pulse"></span>
            ห้องแต่งตัวเพื่อนซี้
          </h3>
          <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest border border-pink-500/30 px-2 py-0.5 rounded-md bg-pink-500/5">BANTER BOARD</span>
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
