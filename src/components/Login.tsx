import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Zap, 
  AlertCircle, 
  User, 
  Lock, 
  KeyRound, 
  Eye,
  EyeOff
} from 'lucide-react';
import { motion } from 'motion/react';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [nickname, setNickname] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !pin.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await login(nickname, pin);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'ข้อมูลไม่ถูกต้อง');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#070b1e] via-[#0b133a] to-[#050714] text-center overflow-y-auto scrollbar-none relative">
      {/* Dynamic ambient lighting bubbles (FIFA 2026 Palette) */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-fuchsia-600/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[450px] h-[450px] bg-blue-500/10 rounded-full blur-[110px] pointer-events-none" />

      <div className="w-full max-w-sm z-10 my-8 space-y-8">
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="space-y-4"
        >
          {/* Logo with high-end glow */}
          <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 via-fuchsia-500 to-indigo-600 rounded-3xl mx-auto flex items-center justify-center shadow-[0_10px_40px_rgba(217,70,239,0.3)] transform rotate-12 hover:rotate-6 transition-all duration-350 select-none">
            <Zap className="w-12 h-12 text-white fill-current animate-pulse" />
          </div>
          
          <h1 className="text-4xl sm:text-5xl text-white italic tracking-tighter uppercase font-black drop-shadow-md">
            รวยฟ้าผ่า <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-yellow-400 text-6xl font-black drop-shadow-[0_2px_15px_rgba(34,197,94,0.3)]">#11</span>
          </h1>
          <p className="text-slate-300 max-w-xs text-base font-bold mx-auto leading-relaxed tracking-wide drop-shadow-sm">
            ฟุตบอลโลก 2026 แก๊งค์ถั่วงอก รวยไม่ไหวแล้วโว้ย 🏆⚽
          </p>
        </motion.div>

        {/* Login Form Container with Glassmorphism and Elegant Indigo-to-Fuchsia Gradient Border */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="bg-gradient-to-br from-blue-500 via-fuchsia-500 to-yellow-500 p-[2px] rounded-[2.6rem] shadow-[0_20px_50px_rgba(15,23,42,0.4)]"
        >
          <div className="bg-[#0f172a]/95 backdrop-blur-3xl px-7 py-9 rounded-[2.5rem] text-left space-y-6">
            <div className="flex items-center gap-3.5 border-b border-slate-800 pb-5">
              <KeyRound className="w-6 h-6 text-fuchsia-400" />
              <h2 className="text-xl font-black text-white tracking-wide">เข้าสู่ระบบ / สมัครสมาชิก</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-2xl flex items-start gap-3 font-semibold"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
                  <p className="flex-1 leading-normal">{error}</p>
                </motion.div>
              )}

              {/* Nickname Input */}
              <div className="space-y-2.5">
                <label className="text-[13px] uppercase font-black text-slate-300 tracking-wider block ml-3">
                  ชื่อเล่นของคุณ (TH / EN)
                </label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-fuchsia-400 transition-colors" />
                  <input
                    type="text"
                    placeholder="ใส่ชื่อเล่นของคุณเพื่อเข้าสนาม"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full bg-[#1e293b]/70 border-2 border-slate-700/60 rounded-2xl py-4.5 pl-12 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-500/10 transition-all font-bold text-lg"
                    required
                  />
                </div>
              </div>

              {/* Password / PIN Input */}
              <div className="space-y-2.5">
                <label className="text-[13px] uppercase font-black text-slate-300 tracking-wider block ml-3">
                  รหัสผ่านส่วนตัว (PIN 4-6 หลัก)
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-fuchsia-400 transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="กรอกรหัส PIN ประจำตัว"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                    autoComplete="current-password"
                    className="w-full bg-[#1e293b]/70 border-2 border-slate-700/60 rounded-2xl py-4.5 pl-12 pr-12 text-white placeholder:text-slate-500 focus:outline-none focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-500/10 transition-all font-bold text-lg tracking-widest"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="wc-btn-neon w-full bg-gradient-to-r from-blue-600 via-fuchsia-500 to-pink-500 text-white py-5 rounded-2xl flex items-center justify-center gap-2 hover:brightness-110 hover:shadow-[0_0_20px_rgba(217,70,239,0.3)] transition-all font-black text-lg uppercase tracking-wider active:scale-[0.98] disabled:opacity-50 mt-2 cursor-pointer shadow-lg shadow-fuchsia-500/20"
              >
                {loading ? (
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  'เข้าสู่ระบบ / ลงสนามแข่ง ⚽'
                )}
              </button>
            </form>

            {/* Subtitle instructions */}
            <p className="text-[13px] text-slate-400 font-bold text-center leading-relaxed mt-2">
              * สำหรับสมาชิกใหม่ กรุณาใช้ชื่อเล่นที่ไม่ซ้ำ และรหัสผ่านที่แอดมินมอบให้ครั้งแรกครับ
            </p>
          </div>
        </motion.div>
      </div>

      <div className="text-xs uppercase tracking-[0.25em] font-black text-slate-400 opacity-25 z-10 select-none pb-8">
        MOBILE FIRST • REAL-TIME • 15 PLAYERS • FIFA 2026 EDITION
      </div>
    </div>
  );
};

export default Login;
