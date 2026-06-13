import React from 'react';
import { Home, Trophy, MessageSquare, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavigationProps {
  activeTab: 'predictions' | 'standings' | 'chat' | 'admin';
  setActiveTab: (tab: 'predictions' | 'standings' | 'chat' | 'admin') => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const { logout, user } = useAuth();
  
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 p-3 xs:p-4 sm:p-5 z-50">
      <div className="max-w-md mx-auto bg-[#0f172a]/85 backdrop-blur-2xl rounded-[2.3rem] p-2 xs:p-3 flex justify-around items-center shadow-[0_15px_50px_rgba(0,0,0,0.5)] border border-slate-800/80">
        <button 
          onClick={() => { setActiveTab('predictions'); scrollToTop(); }}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'predictions' 
              ? 'bg-emerald-500/10 text-emerald-400 scale-105 font-black drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Home className="w-5 h-5 xs:w-6 xs:h-6" />
          <span className="text-[10px] xs:text-xs font-black uppercase tracking-[0.08em] xs:tracking-[0.12em]">ทายผล</span>
        </button>

        <button 
          onClick={() => { setActiveTab('standings'); scrollToTop(); }}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'standings' 
              ? 'bg-emerald-500/10 text-emerald-400 scale-105 font-black drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Trophy className="w-5 h-5 xs:w-6 xs:h-6" />
          <span className="text-[10px] xs:text-xs font-black uppercase tracking-[0.08em] xs:tracking-[0.12em]">ตารางคะแนน</span>
        </button>

        <button 
          onClick={() => { setActiveTab('chat'); scrollToTop(); }}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'chat' 
              ? 'bg-emerald-500/10 text-emerald-400 scale-105 font-black drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <MessageSquare className="w-5 h-5 xs:w-6 xs:h-6" />
          <span className="text-[10px] xs:text-xs font-black uppercase tracking-[0.08em] xs:tracking-[0.12em]">แชท</span>
        </button>

        {user?.role === 'admin' && (
           <button 
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'admin' 
                ? 'bg-amber-500/10 text-amber-400 scale-105 font-black drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Settings className="w-5 h-5 xs:w-6 xs:h-6" />
            <span className="text-[10px] xs:text-xs font-black uppercase tracking-[0.08em] xs:tracking-[0.12em]">แอดมิน</span>
          </button>
        )}

        <div className="w-px h-8 bg-slate-800/80"></div>

        <button 
          onClick={logout}
          className="flex flex-col items-center gap-1 p-2 text-red-500 hover:text-red-400 hover:scale-105 transition-all cursor-pointer font-black"
        >
          <LogOut className="w-5 h-5 xs:w-6 xs:h-6" />
          <span className="text-[10px] xs:text-xs font-black uppercase tracking-[0.08em] xs:tracking-[0.12em]">ออก</span>
        </button>
      </div>
    </nav>
  );
};

export default Navigation;
