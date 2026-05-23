import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, Trophy, Info, Camera, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const ProfileCard: React.FC = () => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  if (!user) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit size to 1MB for Firestore storage (storing as base64 is not ideal but works for 15 users)
    if (file.size > 1024 * 1024) {
      alert('ขนาดรูปใหญ่เกินไป (จำกัด 1MB)');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        try {
          const userDocRef = doc(db, 'users', user.uid);
          await updateDoc(userDocRef, { photoURL: dataUrl });
        } catch (error) {
          console.error('Error updating profile photo:', error);
          alert('ไม่สามารถบันทึกรูปได้ โปรดลองอีกครั้ง');
        } finally {
          setIsUploading(false);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

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
      className="bg-gradient-to-br from-blue-500 via-fuchsia-500 to-yellow-500 p-[2px] rounded-[2.6rem] shadow-[0_20px_50px_rgba(15,23,42,0.4)] relative overflow-hidden"
    >
      {/* Glow highlight effects in corners */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-fuchsia-600/25 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-44 h-44 bg-blue-500/25 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="bg-[#0f172a]/95 backdrop-blur-3xl p-8 rounded-[2.5rem] text-slate-100 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <label className="relative group cursor-pointer block flex-shrink-0" htmlFor="avatar-file-upload">
              <div className="w-24 h-24 rounded-[2rem] border-4 border-fuchsia-500 p-1 overflow-hidden bg-slate-900 transform group-hover:scale-105 transition-transform duration-300 shadow-[0_0_15px_rgba(217,70,239,0.4)]">
                {isUploading ? (
                  <div className="w-full h-full flex items-center justify-center bg-slate-800">
                    <Loader2 className="w-8 h-8 text-fuchsia-500 animate-spin" />
                  </div>
                ) : (
                  <img 
                    src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=D946EF&color=fff&bold=true`} 
                    alt={user.displayName} 
                    className="w-full h-full rounded-[1.6rem] object-cover"
                  />
                )}
              </div>
              <div className="absolute inset-0 bg-black/50 rounded-[2rem] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -bottom-2 -right-1 bg-gradient-to-r from-blue-600 to-fuchsia-600 text-white text-[11px] font-black tracking-widest px-3 py-1.5 rounded-xl shadow-xl z-10 border border-white/20">
                {user.role === 'admin' ? 'ADMIN' : 'PLAYER'}
              </div>
              <input 
                id="avatar-file-upload"
                type="file" 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </label>
            <div className="flex-1 space-y-1.5 min-w-0">
              <h2 className="text-3xl text-white italic font-black uppercase tracking-tight leading-none truncate drop-shadow-md">{user.displayName}</h2>
              {user.role === 'admin' ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black uppercase tracking-wider bg-slate-850 text-yellow-400 px-3.5 py-1.5 rounded-xl border border-slate-700 shadow-md">System Admin 👑</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-yellow-400 filter drop-shadow-[0_0_8px_rgba(250,204,21,0.5)] flex-shrink-0" />
                  <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-red-650/35 border-[5px] border-red-500/45 flex-shrink-0">
                    {user.points}
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-slate-350">
                    POINTS
                  </span>
                </div>
              )}
            </div>
          </div>

          {user.role !== 'admin' && (
            <div className="flex flex-col items-end flex-shrink-0">
              <div className="flex gap-2.5">
                {hasYellow && (
                  <motion.div initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} className="w-9 h-12 bg-yellow-400 rounded-lg shadow-[0_0_20px_rgba(250,204,21,0.6)] flex items-center justify-center border-b-4 border-yellow-600">
                    <span className="text-lg font-black text-yellow-950">🟨</span>
                  </motion.div>
                )}
                {hasRed && (
                  <motion.div initial={{ scale: 0, rotate: 15 }} animate={{ scale: 1, rotate: 0 }} className="w-9 h-12 bg-red-500 rounded-lg shadow-[0_0_20px_rgba(239,68,68,0.6)] flex items-center justify-center border-b-4 border-red-700">
                    <span className="text-lg font-black text-white">🟥</span>
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </div>

        {user.role === 'admin' ? (
          <div className="mt-2 p-5 bg-slate-800/50 rounded-3xl border border-slate-700/60 shadow-inner flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-2xl font-black shadow-lg shadow-emerald-500/10">
              ⚽
            </div>
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1.5">ยินดีต้อนรับผู้จัดการระบบ</h4>
              <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                ส่องและจัดการระบบผลการแข่งขัน, กำหนดแต้มต่อ Handicap และติดตามความมันส์แบบเรียลไทม์!
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="flex justify-between items-end px-1.5">
              <span className="text-xs font-black text-slate-350 uppercase tracking-[0.18em] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" /> เฟอะฟะ
              </span>
              <span className="text-xl font-black text-white tracking-widest">{wrongCount}<span className="text-slate-500 mx-1.5">/</span>24</span>
            </div>
            
            <div className="h-7 bg-slate-900/80 rounded-full p-1.5 overflow-hidden shadow-inner border border-slate-800">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                className={`h-full rounded-full transition-colors duration-700 ${
                  wrongCount >= 24 ? 'bg-gradient-to-r from-red-600 to-pink-500 shadow-[0_0_15px_rgba(239,68,68,0.6)]' : 
                  wrongCount >= 12 ? 'bg-gradient-to-r from-yellow-500 to-orange-400 shadow-[0_0_15px_rgba(245,158,11,0.6)]' : 
                  'bg-gradient-to-r from-emerald-500 to-green-400 shadow-[0_0_15px_rgba(34,197,94,0.6)]'
                }`}
              />
            </div>

            {isBanned && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6 bg-red-950/40 border-2 border-red-500/20 rounded-3xl p-5 flex items-center gap-5 shadow-inner"
              >
                <div className="p-3 bg-red-650 rounded-2xl shadow-lg shadow-red-600/30">
                  <Info className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-xs font-black text-red-400 uppercase tracking-widest leading-none mb-1.5">PENALIZED / ถูกแบน</p>
                  <p className="text-lg font-black text-white">งดทำนายผลจำนวน {user.bannedMatchIds.length} แมตช์</p>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProfileCard;
