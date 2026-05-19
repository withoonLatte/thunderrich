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
      <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-world-cup-green/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[250px] h-[250px] bg-world-cup-purple/10 rounded-full blur-[80px]" />

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="w-24 h-24 bg-gradient-to-br from-world-cup-gold to-amber-600 rounded-full mb-6 mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(255,215,0,0.3)]">
          <Trophy className="w-12 h-12 text-white" />
        </div>
        
        <h1 className="text-4xl text-white italic tracking-tighter uppercase font-black mb-2">
          รวยฟ้าผ่า <br />
          <span className="text-world-cup-green">#20</span>
        </h1>
        <p className="text-gray-400 mb-12 max-w-xs text-sm mx-auto">
          ทำนายผลฟุตบอลโลก 2026 <br />
          แข่งขันกันในกลุ่มเพื่อนซี้ 15 คน
        </p>
      </motion.div>

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4 z-10">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-4 rounded-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-left">{error}</p>
          </div>
        )}

        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="ชื่อเล่น / นามแฝง"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-world-cup-green transition-all placeholder:text-gray-600"
            required
          />
        </div>

        <div className="relative">
          <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-world-cup-green" />
          <input
            type="password"
            placeholder="รหัสกลุ่ม (PIN)"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-world-cup-green transition-all placeholder:text-gray-600"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-world-cup-green text-white py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-green-600 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-world-cup-green/20 font-bold"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            'เข้าสู่สนาม'
          )}
        </button>
      </form>

      <div className="mt-12 text-[10px] uppercase tracking-widest text-world-cup-green opacity-50 z-10">
        MOBILE FIRST • REAL-TIME • 15 PLAYERS
      </div>
    </div>
  );
};

export default Login;
