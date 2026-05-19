import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';

interface Props {
  user: User;
}

const PasswordChangeModal: React.FC<Props> = ({ user }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user.mustChangePassword) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (pin.length < 4) {
      setError('รหัสผ่านต้องมีอย่างน้อย 4 หลัก');
      return;
    }

    if (pin !== confirmPin) {
      setError('รหัสผ่านไม่ตรงกัน');
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        personalPin: pin,
        mustChangePassword: false
      });
    } catch (err: any) {
      console.error(err);
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden"
        >
          {/* Background Decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-world-cup-green/5 rounded-full -mr-16 -mt-16" />
          
          <div className="relative text-center space-y-6">
            <div className="w-20 h-20 bg-world-cup-gold/10 rounded-3xl mx-auto flex items-center justify-center">
              <Lock className="w-10 h-10 text-world-cup-gold" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">ตั้งรหัสผ่านส่วนตัว</h2>
              <p className="text-sm text-gray-500 font-bold">
                เพื่อความปลอดภัยกรุณาตั้งรหัสผ่าน (PIN) <br />
                ส่วนตัวของคุณเพื่อใช้ในครั้งถัดไป
              </p>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-50 border border-red-100 text-red-500 text-xs p-4 rounded-2xl flex items-center gap-3 font-bold"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">ระบุรหัสผ่านใหม่ (เลข 4-6 หลัก)</label>
                <input 
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="เช่น 1122"
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-5 text-xl font-black text-center focus:border-world-cup-green focus:outline-none transition-all placeholder:text-gray-200"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">ยืนยันรหัสผ่านอีกครั้ง</label>
                <input 
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="ยืนยันรหัสผ่าน"
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-5 text-xl font-black text-center focus:border-world-cup-green focus:outline-none transition-all placeholder:text-gray-200"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black uppercase text-lg shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-world-cup-gold" />
                ) : (
                  <>
                    <ShieldCheck className="w-6 h-6 text-world-cup-green" />
                    ยืนยันการตั้งรหัสผ่าน
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PasswordChangeModal;
