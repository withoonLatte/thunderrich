import React, { useState } from 'react';
import ProfileCard from './ProfileCard';
import MatchList from './MatchList';
import Webboard from './Webboard';
import Leaderboard from './Leaderboard';

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-8 pb-10">
      {/* Top Section: Profile */}
      <section>
        <ProfileCard />
      </section>
      
      {/* Middle Section: Predictions */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-sm font-black text-world-cup-green uppercase tracking-widest">รายการทายผล</h3>
          <span className="text-[10px] font-bold text-gray-500">เลื่อนเพื่อดูทั้งหมด</span>
        </div>
        <MatchList />
      </section>

      {/* Bottom Section: Webboard */}
      <section className="space-y-4">
        <h3 className="text-sm font-black text-world-cup-gold uppercase tracking-widest px-2">ห้องแต่งตัวเพื่อนซี้</h3>
        <Webboard />
      </section>

      {/* Optional: Leaderboard Link or Mini-view */}
      <section className="pt-4 border-t border-white/5">
        <p className="text-center text-[10px] text-gray-600 font-bold uppercase tracking-widest">
          ทายผลฟุตบอลโลก 2026 Prediction Pro
        </p>
      </section>
    </div>
  );
};

export default Dashboard;
