import React, { useState } from 'react';
import ProfileCard from './ProfileCard';
import MatchList from './MatchList';
import Webboard from './Webboard';
import Leaderboard from './Leaderboard';

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-12 pb-12">
      {/* Top Section: Profile */}
      <section>
        <ProfileCard />
      </section>
      
      {/* Middle Section: Predictions */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-3">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-2 h-2 bg-world-cup-green rounded-full"></span>
            รายการแข่งขัน
          </h3>
          <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">SCROLL FOR MORE</span>
        </div>
        <MatchList />
      </section>

      {/* Leaderboard Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-3">
          <div className="w-2 h-2 bg-world-cup-gold rounded-full"></div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">อันดับนักทำนาย</h3>
        </div>
        <Leaderboard />
      </section>

      {/* Bottom Section: Webboard */}
      <section id="webboard-section" className="space-y-6 pt-4">
        <div className="flex items-center gap-3 px-3">
          <div className="w-2 h-2 bg-world-cup-purple rounded-full"></div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">ห้องแต่งตัวเพื่อนซี้</h3>
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
