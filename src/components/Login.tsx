import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Trophy, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

const Login: React.FC = () => {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError('ไม่สามารถเข้าสู่ระบบด้วย Google ได้ กรุณาลองใหม่อีกครั้ง');
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

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="w-full max-w-xs space-y-4 z-10"
      >
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-4 rounded-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-left">{error}</p>
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white text-black py-4 rounded-full flex items-center justify-center gap-3 hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50 font-bold shadow-xl group"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
          ) : (
            <>
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115z"
                />
                <path
                  fill="#34A853"
                  d="M16.04 18.013c-1.09.593-2.325.896-3.791.896-2.58 0-4.854-1.572-5.79-3.784l-4.026 3.116C4.41 21.05 8.01 24 12 24c3.08 0 5.864-1.058 7.91-2.846l-3.87-3.141z"
                />
                <path
                  fill="#4285F4"
                  d="M19.91 21.154c1.694-1.127 2.871-2.825 3.141-4.757h-11.05v4.264h6.05c-.324 1.487-1.18 2.748-2.43 3.633l3.87 3.141c2.148-1.92 3.42-4.757 3.42-8.281z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.266 9.765 1.24 6.65C.448 8.243 0 10.065 0 12c0 1.935.448 3.757 1.24 5.35l4.026-3.116A7.096 7.096 0 0 1 4.909 12c0-1.258.336-2.433.914-3.468l-.557-1.233z"
                />
              </svg>
              เข้าสู่สนามด้วย Google
            </>
          )}
        </button>
      </motion.div>

      <div className="mt-12 text-[10px] uppercase tracking-widest text-world-cup-green opacity-50 z-10">
        MOBILE FIRST • REAL-TIME • 15 PLAYERS
      </div>
    </div>
  );
};

export default Login;
