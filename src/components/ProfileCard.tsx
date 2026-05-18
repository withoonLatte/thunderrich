import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, ShieldCheck, Trophy, Info } from 'lucide-react';
import { motion } from 'motion/react';

const ProfileCard: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  const wrongCount = user.round1_wrong_count || 0;
  const progressPercent = Math.min((wrongCount / 24) * 100, 100);
  
  // Calculate card status
  const hasYellow = user.yellow_cards > 0;
  const hasRed = user.red_cards > 0;
  const isBanned = user.bannedMatchIds && user.bannedMatchIds.length > 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="wc-glass rounded-3xl p-6 relative overflow-hidden border-t-2 border-world-cup-green/30"
    >
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-world-cup-green/20 rounded-full blur-2xl"></div>
      
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img 
              src={user.photoURL || 'https://via.placeholder.com/150'} 
              alt={user.displayName} 
              className="w-14 h-14 rounded-full border-2 border-world-cup-green p-0.5 object-cover"
            />
            <div className="absolute -bottom-1 -right-1 bg-world-cup-gold text-blue-900 text-[10px] px-1.5 py-0.5 rounded-md shadow-lg">
              #{user.role === 'admin' ? 'ADM' : 'PRO'}
            </div>
          </div>
          <div>
            <h2 className="text-lg text-white italic tracking-tight">{user.displayName}</h2>
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-world-cup-gold" />
              <span className="text-world-cup-gold text-xl italic">{user.points} <small className="text-[10px] uppercase opacity-70">คะแนน</small></span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <div className="flex gap-1.5">
            {hasYellow && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-6 h-8 bg-yellow-400 rounded-sm shadow-lg shadow-yellow-400/20 flex items-center justify-center">
                <span className="text-[8px] text-yellow-900">🟨</span>
              </motion.div>
            )}
            {hasRed && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-6 h-8 bg-red-600 rounded-sm shadow-lg shadow-red-600/20 flex items-center justify-center">
                <span className="text-[8px] text-white">🟥</span>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-end">
          <span className="text-[10px] text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-world-cup-green" /> เกจคะแนนผิด
          </span>
          <span className="text-xs text-white tracking-widest">{wrongCount}/24</span>
        </div>
        
        <div className="h-4 bg-white/5 rounded-full p-1 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            className={`h-full rounded-full transition-colors duration-500 ${
              wrongCount >= 24 ? 'bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 
              wrongCount >= 12 ? 'bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 
              'bg-world-cup-green'
            }`}
          />
        </div>

        {isBanned && (
          <div className="mt-4 bg-red-600/20 border border-red-600/30 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2 bg-red-600 rounded-lg">
              <Info className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] leading-tight text-red-200 uppercase tracking-wider mb-0.5">ถูกแบนจากการทำนาย</p>
              <p className="text-xs text-white">ถูกแบนเป็นจำนวน {user.bannedMatchIds.length} แมตช์</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProfileCard;
