import React, { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, Trophy, Info, Camera, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const ProfileCard: React.FC = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!user) return null;

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

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
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        if (user.uid !== 'hardcoded-admin-id') {
          const userDocRef = doc(db, 'users', user.uid);
          await updateDoc(userDocRef, { photoURL: base64String });
        } else {
          // For hardcoded admin, save to local storage to persist change in this session
          const mockUser = JSON.parse(localStorage.getItem('wc_mock_user') || '{}');
          mockUser.photoURL = base64String;
          localStorage.setItem('wc_mock_user', JSON.stringify(mockUser));
          window.location.reload(); // Refresh to show the new mock photo
        }
      } catch (error) {
        console.error('Error updating profile photo:', error);
      } finally {
        setIsUploading(false);
      }
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
      className="wc-glass rounded-3xl p-6 relative overflow-hidden border-t-2 border-world-cup-green/30"
    >
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-world-cup-green/20 rounded-full blur-2xl"></div>
      
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="relative group cursor-pointer" onClick={handlePhotoClick}>
            <div className="w-14 h-14 rounded-full border-2 border-world-cup-green p-0.5 overflow-hidden bg-white/5">
              {isUploading ? (
                <div className="w-full h-full flex items-center justify-center bg-black/50">
                  <Loader2 className="w-6 h-6 text-world-cup-green animate-spin" />
                </div>
              ) : (
                <img 
                  src={user.photoURL || 'https://via.placeholder.com/150'} 
                  alt={user.displayName} 
                  className="w-full h-full rounded-full object-cover"
                />
              )}
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Camera className="w-5 h-5 text-white/80" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-world-cup-gold text-blue-900 text-[10px] px-1.5 py-0.5 rounded-md shadow-lg z-10">
              #{user.role === 'admin' ? 'ADM' : 'PRO'}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
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
