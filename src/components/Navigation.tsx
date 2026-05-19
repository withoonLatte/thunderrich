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
      <div className="max-w-md mx-auto bg-white/90 backdrop-blur-2xl rounded-[2.5rem] p-3 flex justify-around items-center shadow-[0_20px_50px_rgba(0,0,0,0.1)] border-t border-gray-50">
        <button 
          onClick={() => { setActiveTab('dashboard'); scrollToTop(); }}
          className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${activeTab === 'dashboard' ? 'bg-world-cup-green/10 text-world-cup-green scale-105' : 'text-slate-400'}`}
        >
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">STADIUM</span>
        </button>

        <button 
          onClick={() => {
            const webboardEl = document.getElementById('webboard-section');
            if (webboardEl) webboardEl.scrollIntoView({ behavior: 'smooth' });
          }}
          className="flex flex-col items-center gap-1.5 p-3 text-slate-400 hover:text-world-cup-green transition-colors"
        >
          <MessageSquare className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">CHAT</span>
        </button>

        <div className="w-px h-10 bg-gray-100"></div>

        {user?.role === 'admin' && (
           <button 
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${activeTab === 'admin' ? 'bg-orange-50 text-orange-400 scale-105' : 'text-slate-400'}`}
          >
            <Settings className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-widest">ADMIN</span>
          </button>
        )}

        <button 
          onClick={logout}
          className="flex flex-col items-center gap-1.5 p-3 text-red-400 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">QUIT</span>
        </button>
      </div>
    </nav>
  );
};

export default Navigation;
