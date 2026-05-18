import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User as UserIcon, Lock, AlertCircle, Hash, UserCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface RegisterProps {
  onBack: () => void;
}

const Register: React.FC<RegisterProps> = ({ onBack }) => {
  const { signUp } = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [groupPin, setGroupPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !displayName || !groupPin) return;
    
    setLoading(true);
    setError(null);
    try {
      await signUp(username, password, displayName, groupPin);
    } catch (err: any) {
      console.error(err);
      let msg = 'เกิดข้อผิดพลาดในการสมัครสมาชิก';
      if (err.code === 'auth/email-already-in-use') msg = 'ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว';
      if (err.message === 'รหัสกลุ่มไม่ถูกต้อง') msg = 'รหัสกลุ่มไม่ถูกต้อง';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-world-cup-blue text-center">
      <h2 className="text-3xl mb-2 text-white italic tracking-tighter uppercase font-black">
        ลงทะเบียน <span className="text-world-cup-green">นักเตะใหม่</span>
      </h2>
      
      <p className="text-gray-400 mb-8 max-w-xs text-sm">
        กรอกข้อมูลเพื่อเข้าร่วมกลุ่ม <br />
        และเริ่มทายผลฟุตบอลโลก 2026
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

        <div className="relative">
          <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="ชื่อผู้ใช้สำหรับล็อกอิน"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
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
          className="w-full bg-world-cup-green text-white py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-green-600 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-world-cup-green/20"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            'สมัครและเข้าสู่ระบบ'
          )}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="w-full text-gray-500 text-xs py-2 hover:text-white transition-all underline underline-offset-4"
        >
          กลับไปหน้าล็อกอิน
        </button>
      </form>
    </div>
  );
};

export default Register;
