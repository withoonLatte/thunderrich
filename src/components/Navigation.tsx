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
    <nav className="fixed bottom-0 left-0 right-0 p-4 z-50">
      <div className="max-w-md mx-auto wc-glass rounded-3xl p-2 flex justify-around items-center shadow-2xl shadow-black/50 border border-white/5 backdrop-blur-2xl">
        <button 
          onClick={() => { setActiveTab('dashboard'); scrollToTop(); }}
          className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'dashboard' ? 'text-world-cup-green scale-110' : 'text-gray-500'}`}
        >
          <Home className="w-6 h-6" />
          <span className="text-[8px] uppercase tracking-widest">หน้าแรก</span>
        </button>

        <button 
          onClick={() => setActiveTab('dashboard')} // In a stack, it's just the dash
          className="flex flex-col items-center gap-1 p-2 text-gray-500"
        >
          <MessageSquare className="w-6 h-6" />
          <span className="text-[8px] uppercase tracking-widest">พูดคุย</span>
        </button>

        <div className="w-px h-8 bg-white/10"></div>

        {user?.role === 'admin' && (
           <button 
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'admin' ? 'text-orange-400 scale-110' : 'text-gray-500'}`}
          >
            <Settings className="w-6 h-6" />
            <span className="text-[8px] uppercase tracking-widest">จัดการ</span>
          </button>
        )}

        <button 
          onClick={logout}
          className="flex flex-col items-center gap-1 p-2 text-red-500 hover:text-red-400"
        >
          <LogOut className="w-6 h-6" />
          <span className="text-[8px] uppercase tracking-widest">ออก</span>
        </button>
      </div>
    </nav>
  );
};

export default Navigation;
