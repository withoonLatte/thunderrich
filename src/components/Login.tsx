import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Trophy, AlertCircle, User, Hash } from 'lucide-react';
import { motion } from 'motion/react';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [nickname, setNickname] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname || !pin) return;

    setLoading(true);
    setError(null);
    try {
      await login(nickname, pin);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'รหัสกลุ่มไม่ถูกต้อง');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-world-cup-blue text-center overflow-hidden">
      {/* Decorative patterns */}
      <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-world-cup-green/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[350px] h-[350px] bg-world-cup-purple/10 rounded-full blur-[80px]" />

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="z-10"
      >
        <div className="w-28 h-28 bg-gradient-to-br from-world-cup-gold to-amber-500 rounded-3xl mb-8 mx-auto flex items-center justify-center shadow-xl shadow-world-cup-gold/20 transform rotate-12">
          <Trophy className="w-14 h-14 text-white" />
        </div>
        
        <h1 className="text-5xl text-slate-900 italic tracking-tighter uppercase font-black mb-3">
          รวยฟ้าผ่า <br />
          <span className="text-world-cup-green drop-shadow-sm">#20</span>
        </h1>
        <p className="text-slate-500 mb-12 max-w-xs text-base font-medium mx-auto">
          ทำนายผลฟุตบอลโลก 2026 <br />
          แข่งขันกันในกลุ่มเพื่อนซี้ 15 คน
        </p>
      </motion.div>

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-5 z-10">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-500 text-sm p-5 rounded-3xl flex items-center gap-4 shadow-sm">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <p className="text-left font-bold">{error}</p>
          </div>
        )}

        <div className="relative group">
          <User className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 group-focus-within:text-world-cup-green transition-colors" />
          <input
            type="text"
            placeholder="ชื่อเล่น / นามแฝง"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full bg-white border-2 border-gray-100 rounded-3xl py-5 pl-14 pr-6 text-slate-800 text-lg font-bold focus:outline-none focus:border-world-cup-green focus:ring-4 focus:ring-world-cup-green/10 transition-all placeholder:text-gray-300 shadow-sm"
            required
          />
        </div>

        <div className="relative group">
          <Hash className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-world-cup-green group-focus-within:text-world-cup-green transition-colors" />
          <input
            type="password"
            placeholder="รหัสกลุ่ม (PIN)"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full bg-white border-2 border-gray-100 rounded-3xl py-5 pl-14 pr-6 text-slate-800 text-lg font-bold focus:outline-none focus:border-world-cup-green focus:ring-4 focus:ring-world-cup-green/10 transition-all placeholder:text-gray-300 shadow-sm"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-world-cup-green text-white py-5 rounded-3xl flex items-center justify-center gap-3 hover:bg-green-600 transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-world-cup-green/20 font-black text-xl uppercase tracking-widest"
        >
          {loading ? (
            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            'เข้าสู่สนาม'
          )}
        </button>
      </form>

      <div className="mt-16 text-xs uppercase tracking-[0.2em] font-black text-world-cup-green opacity-40 z-10">
        MOBILE FIRST • REAL-TIME • 15 PLAYERS
      </div>
    </div>
  );
};

export default Login;
