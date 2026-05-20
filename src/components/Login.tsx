import React, { useState, useEffect } from 'react';
import { useAuth, PLAYER_PINS } from '../contexts/AuthContext';
import { 
  Zap, 
  AlertCircle, 
  User, 
  Lock, 
  KeyRound, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User as UserType } from '../types';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [nickname, setNickname] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Real-time track which PINs are already occupied
  const [occupiedPins, setOccupiedPins] = useState<Record<string, string>>({});
  const [showPinHelper, setShowPinHelper] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const pinToName: Record<string, string> = {};
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data() as UserType;
        if (data.personalPin) {
          pinToName[data.personalPin] = data.displayName;
        }
      });
      setOccupiedPins(pinToName);
    }, (err) => {
      console.error("Error monitoring occupied pins:", err);
    });

    return () => unsubscribe();
  }, []);

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

  const handleSelectPin = (selectedPin: string) => {
    setPin(selectedPin);
    // Smooth scroll back up to the form if helpful
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-50 via-indigo-50/20 to-slate-100 text-center overflow-y-auto scrollbar-none relative">
      {/* Dynamic ambient lighting bubbles */}
      <div className="absolute top-[-20%] right-[-20%] w-[500px] h-[500px] bg-world-cup-green/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-20%] w-[450px] h-[450px] bg-sky-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm z-10 my-8 space-y-8">
        <motion.div
          initial={{ y: -25, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="space-y-4"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-world-cup-gold to-amber-500 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-world-cup-gold/25 transform rotate-12 hover:rotate-6 transition-all duration-300">
            <Zap className="w-12 h-12 text-white fill-current animate-pulse" />
          </div>
          
          <h1 className="text-4xl text-slate-800 italic tracking-tighter uppercase font-black">
            รวยฟ้าผ่า <br />
            <span className="text-world-cup-green text-5xl font-extrabold drop-shadow-[0_2px_8px_rgba(34,197,94,0.15)]">#11</span>
          </h1>
          <p className="text-slate-600 max-w-xs text-sm font-bold mx-auto leading-relaxed">
            ฟุตบอลโลก 2026 แก๊งค์ถั่วงอก รวยไม่ไหวแล้วโว้ย 🏆
          </p>
        </motion.div>

        {/* Login Form Container with Glassmorphism */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="bg-white/80 border border-slate-205/80 backdrop-blur-2xl px-6 py-8 rounded-[2.5rem] shadow-xl text-left space-y-6"
        >
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <KeyRound className="w-5 h-5 text-world-cup-gold" />
            <h2 className="text-lg font-bold text-slate-800">เข้าสู่ระบบ / สมัครใหม่</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/5 border border-red-500/10 text-red-500 text-xs p-4 rounded-2xl flex items-center gap-3 font-semibold"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
                <p className="flex-1">{error}</p>
              </motion.div>
            )}

            {/* Nickname Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block ml-3">
                ชื่อเล่นของคุณ (TH / EN)
              </label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-world-cup-green transition-colors" />
                <input
                  type="text"
                  placeholder="ใส่ชื่อเล่นเพื่อล็อกอิน หรือสมัครใหม่"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200/80 rounded-2xl py-4 pl-12 pr-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-world-cup-green focus:ring-4 focus:ring-world-cup-green/5 transition-all font-bold text-base"
                  required
                />
              </div>
            </div>

            {/* Password / PIN Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block ml-3">
                รหัสผ่านส่วนตัว (PIN 4-6 หลัก)
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-world-cup-green transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="กรอก PIN ประจำตัวของคุณ"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                  autoComplete="current-password"
                  className="w-full bg-slate-50 border-2 border-slate-200/80 rounded-2xl py-4 pl-12 pr-12 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-world-cup-green focus:ring-4 focus:ring-world-cup-green/5 transition-all font-bold text-base tracking-widest"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-world-cup-green to-emerald-500 text-white py-4.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-900 transition-all font-black text-base uppercase tracking-wider shadow-lg shadow-world-cup-green/20 active:scale-[0.98] disabled:opacity-50 mt-2 hover:brightness-105"
            >
              {loading ? (
                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                'เข้าสู่ระบบ / ลงสนามแข่ง'
              )}
            </button>
          </form>

          {/* Subtitle instructions */}
          <p className="text-[11px] text-slate-400 font-semibold text-center leading-relaxed">
            * สมาชิกใหม่กรุณาใช้ชื่อเล่นที่ไม่ซ้ำ และรหัสผ่านที่ไม่มีคนใช้งานจากลิสต์ด้านล่าง
          </p>
        </motion.div>

        {/* PIN Helper Accordion */}
        <div className="z-10 w-full">
          <button
            onClick={() => setShowPinHelper(!showPinHelper)}
            className="w-full flex items-center justify-between bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl px-5 py-4 text-slate-700 font-bold text-sm transition-all shadow-sm"
          >
            <div className="flex items-center gap-2 text-world-cup-gold">
              <KeyRound className="w-4 h-4" />
              <span>ดูสถานะรหัสผ่าน (PIN) ทั้งหมด</span>
            </div>
            {showPinHelper ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          <AnimatePresence>
            {showPinHelper && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white border-x border-b border-slate-200/80 rounded-b-2xl p-4 text-left space-y-3 shadow-md">
                  <div className="flex justify-between items-center text-[10px] font-black tracking-wider text-slate-400 uppercase">
                    <span>รหัสผ่านสำหรับ 20 สมาชิก</span>
                    <span className="text-world-cup-green">🟢 คลิกเพื่อนำรหัสไปใช้</span>
                  </div>

                  <div className="grid grid-cols-2 xs:grid-cols-3 gap-2">
                    {PLAYER_PINS.map((playerPin) => {
                      const occupier = occupiedPins[playerPin];
                      const isOccupied = !!occupier;

                      return (
                        <button
                          key={playerPin}
                          type="button"
                          disabled={isOccupied}
                          onClick={() => handleSelectPin(playerPin)}
                          className={`p-3 rounded-xl border flex flex-col justify-center items-center gap-1 transition-all ${
                            isOccupied 
                              ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed text-center' 
                              : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-world-cup-green/50 text-slate-700 hover:-translate-y-0.5 shadow-sm'
                          }`}
                        >
                          <span className={`text-sm font-black tracking-widest ${isOccupied ? 'line-through text-slate-450' : 'text-world-cup-gold'}`}>
                            {playerPin}
                          </span>
                          <span className="text-[9px] font-bold block max-w-full truncate">
                            {isOccupied ? (
                              <span className="text-slate-400">🔒 {occupier}</span>
                            ) : (
                              <span className="text-world-cup-green font-black select-none">🟢 ว่าง</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  
                  <div className="text-[10px] text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100 font-medium leading-relaxed mt-2 text-center">
                    เมื่อเลือก PIN ที่ว่างเพื่อสมัครใหม่สำเร็จ ระบบจะล็อกรหัสผ่านนั้นให้กับชื่อเล่นของคุณทันที!
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="text-xs uppercase tracking-[0.2em] font-black text-slate-400 opacity-20 z-10 select-none pb-8">
        MOBILE FIRST • REAL-TIME • 15 PLAYERS
      </div>
    </div>
  );
};

export default Login;
