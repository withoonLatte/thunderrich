import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Trophy, User as UserIcon, Lock, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

const Login: React.FC = () => {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    setLoading(true);
    setError(null);
    try {
      await signIn(username, password);
    } catch (err: any) {
      setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-world-cup-blue text-center">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mb-6"
      >
        <img src="/logo.png" alt="Logo" className="w-32 h-32 object-contain drop-shadow-[0_0_20px_rgba(29,185,84,0.5)]" />
      </motion.div>
      
      <h1 className="text-4xl font-black mb-2 text-white italic tracking-tighter uppercase">
        รวยฟ้าผ่า <br />
        <span className="text-world-cup-green">#20</span>
      </h1>
      
      <p className="text-gray-400 mb-8 max-w-xs text-sm">
        เข้าร่วมกลุ่มเพื่อนซี้ 15 คน <br />
        ทำนายผลเพื่อชิงความเป็นหนึ่ง
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold p-3 rounded-xl flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            {error}
          </motion.div>
        )}

        <div className="relative">
          <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="ชื่อผู้ใช้"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-world-cup-green transition-all placeholder:text-gray-600"
            required
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="password"
            placeholder="รหัสผ่าน"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-world-cup-green transition-all placeholder:text-gray-600"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-world-cup-green text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-green-600 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-world-cup-green/20"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            'เข้าสู่สนาม'
          )}
        </button>
      </form>

      <div className="mt-12 text-[10px] uppercase tracking-widest text-world-cup-green font-bold opacity-50">
        FIFA WORLD CUP 2026 EDITION
      </div>
    </div>
  );
};

export default Login;
