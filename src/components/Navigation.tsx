import React from 'react';
import { Home, Trophy, MessageSquare, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavigationProps {
  activeTab: 'dashboard' | 'admin';
  setActiveTab: (tab: 'dashboard' | 'admin') => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const { logout, user } = useAuth();
  
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 p-5 z-50">
      <div className="max-w-md mx-auto bg-[#0f172a]/85 backdrop-blur-2xl rounded-[2.3rem] p-3 flex justify-around items-center shadow-[0_15px_50px_rgba(0,0,0,0.5)] border border-slate-800/80">
        <button 
          onClick={() => { setActiveTab('dashboard'); scrollToTop(); }}
          className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'dashboard' 
              ? 'bg-emerald-500/10 text-emerald-400 scale-105 font-black drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Home className="w-6 h-6" />
          <span className="text-xs font-black uppercase tracking-[0.12em]">Stadium</span>
        </button>

        <button 
          onClick={() => {
            const webboardEl = document.getElementById('webboard-section');
            if (webboardEl) webboardEl.scrollIntoView({ behavior: 'smooth' });
          }}
          className="flex flex-col items-center gap-1.5 p-3 text-slate-500 hover:text-emerald-400 hover:scale-105 transition-all cursor-pointer font-black"
        >
          <MessageSquare className="w-6 h-6" />
          <span className="text-xs font-black uppercase tracking-[0.12em]">Chat</span>
        </button>

        <div className="w-px h-10 bg-slate-800/80"></div>

        {user?.role === 'admin' && (
           <button 
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'admin' 
                ? 'bg-amber-500/10 text-amber-400 scale-105 font-black drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Settings className="w-6 h-6" />
            <span className="text-xs font-black uppercase tracking-[0.12em]">Admin</span>
          </button>
        )}

        <button 
          onClick={logout}
          className="flex flex-col items-center gap-1.5 p-3 text-red-500 hover:text-red-400 hover:scale-105 transition-all cursor-pointer font-black"
        >
          <LogOut className="w-6 h-6" />
          <span className="text-xs font-black uppercase tracking-[0.12em]">Quit</span>
        </button>
      </div>
    </nav>
  );
};

export default Navigation;
