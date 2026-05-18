import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { KeyRound, ShieldAlert, CheckCircle2, Loader2, LogOut } from 'lucide-react';

const ChangePassword: React.FC = () => {
  const { updateUserPassword, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 4) {
      setError('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน');
      return;
    }

    setLoading(true);
    try {
      if (updateUserPassword) {
        await updateUserPassword(newPassword);
        setSuccess(true);
        // Let user see success message before reload or redirect
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-world-cup-blue flex items-center justify-center p-6 text-center">
        <div className="wc-glass p-8 rounded-3xl space-y-4 max-w-sm w-full border-t-4 border-world-cup-green">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-world-cup-green/20 rounded-full flex items-center justify-center text-world-cup-green">
              <CheckCircle2 className="w-10 h-10" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-white">เปลี่ยนรหัสผ่านสำเร็จ!</h2>
          <p className="text-gray-400 text-sm">กำลังเข้าสู่ระบบด้วยรหัสผ่านใหม่...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-world-cup-blue flex items-center justify-center p-6">
      <div className="wc-glass p-8 rounded-3xl space-y-6 max-w-sm w-full border-t-4 border-world-cup-gold">
        <div className="space-y-2 text-center">
          <div className="flex justify-center">
            <div className="w-12 h-12 bg-world-cup-gold/20 rounded-full flex items-center justify-center text-world-cup-gold">
              <KeyRound className="w-6 h-6" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-white">เปลี่ยนรหัสผ่าน</h2>
          <p className="text-xs text-gray-400">กรุณาตั้งรหัสผ่านใหม่เพื่อความปลอดภัยในการเริ่มใช้ครั้งแรก</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">รหัสผ่านใหม่ (ขั้นต่ำ 4 ตัว)</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-world-cup-gold transition-all"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">ยืนยันรหัสผ่านใหม่</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-world-cup-gold transition-all"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-world-cup-gold text-world-cup-blue font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'บันทึกรหัสผ่านใหม่'}
          </button>
        </form>

        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 text-gray-500 text-xs hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
};

export default ChangePassword;
