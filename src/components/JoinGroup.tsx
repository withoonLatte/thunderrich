import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserCircle, Hash, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

const JoinGroup: React.FC = () => {
  const { joinGroup, firebaseUser, logout } = useAuth();
  const [displayName, setDisplayName] = useState(firebaseUser?.displayName || '');
  const [groupPin, setGroupPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || !groupPin) return;
    
    setLoading(true);
    setError(null);
    try {
      await joinGroup(displayName, groupPin);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเข้าร่วมกลุ่ม');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-world-cup-blue text-center">
      <h2 className="text-3xl mb-2 text-white italic tracking-tighter uppercase font-black">
        ยินดีต้อนรับสู่ <span className="text-world-cup-green">กลุ่มของเรา</span>
      </h2>
      
      <p className="text-gray-400 mb-8 max-w-xs text-sm">
        กรุณาตั้งชื่อเล่นและใส่รหัสกลุ่ม <br />
        เพื่อเข้าสู่ระบบทายผล
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-3 rounded-xl flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            {error}
          </motion.div>
        )}

        <div className="relative">
          <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-world-cup-green" />
          <input
            type="text"
            placeholder="รหัสกลุ่ม (PIN)"
            value={groupPin}
            onChange={(e) => setGroupPin(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-world-cup-green transition-all placeholder:text-gray-600"
            required
          />
        </div>

        <div className="relative">
          <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="ชื่อที่ใช้แสดง (Display Name)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-world-cup-green transition-all placeholder:text-gray-600"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-world-cup-green text-white py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-green-600 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-world-cup-green/20"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            'เข้าร่วมกลุ่มเลย'
          )}
        </button>

        <button
          type="button"
          onClick={logout}
          className="w-full text-gray-500 text-xs py-2 hover:text-white transition-all underline underline-offset-4"
        >
          ลงชื่อออก
        </button>
      </form>
    </div>
  );
};

export default JoinGroup;
