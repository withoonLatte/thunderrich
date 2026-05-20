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
      className="wc-glass rounded-[2rem] p-8 relative overflow-hidden border-t-8 border-world-cup-green shadow-2xl"
    >
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-world-cup-green/10 rounded-full blur-3xl"></div>
      
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-6">
          <label className="relative group cursor-pointer block" htmlFor="avatar-file-upload">
            <div className="w-20 h-20 rounded-3xl border-4 border-world-cup-green p-1 overflow-hidden bg-gray-50 transform group-hover:scale-105 transition-transform duration-300">
              {isUploading ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <Loader2 className="w-8 h-8 text-world-cup-green animate-spin" />
                </div>
              ) : (
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=22C55E&color=fff&bold=true`} 
                  alt={user.displayName} 
                  className="w-full h-full rounded-2xl object-cover"
                />
              )}
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-slate-900 text-white text-[10px] font-black tracking-widest px-2.5 py-1.5 rounded-xl shadow-xl z-10 border border-white/20">
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
          <div className="flex-1 space-y-1">
            <h2 className="text-2xl text-slate-800 italic font-black uppercase tracking-tighter leading-none">{user.displayName}</h2>
            {user.role === 'admin' ? (
              <div className="flex items-center gap-1.5 text-world-cup-gold">
                <span className="text-sm font-black uppercase tracking-wider bg-slate-100 text-world-cup-gold px-2.5 py-1 rounded-xl border border-slate-200">System Admin 👑</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-world-cup-gold" />
                <span className="text-giant text-world-cup-gold italic font-black leading-none">{user.points} <small className="text-xs uppercase opacity-80 not-italic font-bold tracking-widest ml-1">POINTS</small></span>
              </div>
            )}
          </div>
        </div>

        {user.role !== 'admin' && (
          <div className="flex flex-col items-end">
            <div className="flex gap-2">
              {hasYellow && (
                <motion.div initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} className="w-8 h-11 bg-yellow-400 rounded-sm shadow-[0_4px_12px_rgba(250,204,21,0.4)] flex items-center justify-center border-b-2 border-yellow-600">
                  <span className="text-sm font-black text-yellow-900">🟨</span>
                </motion.div>
              )}
              {hasRed && (
                <motion.div initial={{ scale: 0, rotate: 15 }} animate={{ scale: 1, rotate: 0 }} className="w-8 h-11 bg-red-600 rounded-sm shadow-[0_4px_12px_rgba(220,38,38,0.4)] flex items-center justify-center border-b-2 border-red-800">
                  <span className="text-sm font-black text-white">🟥</span>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>

      {user.role === 'admin' ? (
        <div className="mt-2 p-5 bg-gradient-to-r from-slate-50 to-indigo-50/10 rounded-3xl border border-slate-150 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-world-cup-green/10 flex items-center justify-center text-world-cup-green text-lg font-black">
            ⚽
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-1">ยินดีต้อนรับผู้จัดการระบบ</h4>
            <p className="text-xs text-gray-500 font-semibold leading-relaxed">
              ส่องและจัดการระบบผลการแข่งขัน, กำหนดแต้มต่อ Handicap และติดตามความมันส์แบบเรียลไทม์!
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-end px-1">
            <span className="text-xs font-black text-gray-400 uppercase tracking-[0.15em] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-world-cup-green" /> คะแนนความผิด
            </span>
            <span className="text-base font-black text-slate-700 tracking-widest">{wrongCount}<span className="text-gray-300 mx-1">/</span>24</span>
          </div>
          
          <div className="h-6 bg-gray-100 rounded-full p-1.5 overflow-hidden shadow-inner border border-gray-200">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              className={`h-full rounded-full transition-colors duration-700 ${
                wrongCount >= 24 ? 'bg-red-600' : 
                wrongCount >= 12 ? 'bg-yellow-400' : 
                'bg-world-cup-green'
              } shadow-[0_0_12px_rgba(0,0,0,0.1)]`}
            />
          </div>

          {isBanned && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 bg-red-50 border-2 border-red-100 rounded-3xl p-5 flex items-center gap-5 shadow-sm"
            >
              <div className="p-3 bg-red-600 rounded-2xl shadow-lg shadow-red-600/30">
                <Info className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-black text-red-600 uppercase tracking-widest leading-none mb-1.5">PENALIZED / ถูกแบน</p>
                <p className="text-base font-bold text-slate-800">งดทำนายผลจำนวน {user.bannedMatchIds.length} แมตช์</p>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>

  );
};

export default ProfileCard;
