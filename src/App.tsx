/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UserRole, AppConfig } from './types';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import Navigation from './components/Navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin'>('dashboard');
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'app_config'), (doc) => {
      if (doc.exists()) {
        setConfig(doc.data() as AppConfig);
      }
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-world-cup-blue">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-world-cup-green"></div>
      </div>
    );
  }

  // Case: Not logged in
  if (!user) {
    return <Login />;
  }

  return (
    <div 
      className="min-h-screen pb-28 font-sans antialiased text-slate-100"
      style={config?.backgroundUrl ? { 
        backgroundImage: `url(${config.backgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      } : {}}
    >
      <header className="p-4 sm:p-5 flex justify-between items-center bg-[#0f172a]/75 backdrop-blur-2xl sticky top-0 z-50 border-b border-slate-800/70 shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 flex items-center justify-center bg-emerald-500/10 rounded-2xl overflow-hidden border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
            <img 
              src={config?.logoUrl || "/logo.png"} 
              alt="Logo" 
              className="w-full h-full object-contain drop-shadow-sm"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                if (target.parentElement) {
                  target.parentElement.innerHTML = '<div class="text-emerald-400"><svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trophy"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg></div>';
                }
              }}
            />
          </div>
          <div className="flex flex-col justify-center min-w-0">
            <div className="h-9 sm:h-11 flex items-center">
              <svg className="h-9 sm:h-11 w-[190px] xs:w-[230px] sm:w-[300px] overflow-visible" viewBox="0 0 300 36" style={{ filter: 'drop-shadow(0px 2px 8px rgba(217, 70, 239, 0.4))' }}>
                <defs>
                  <linearGradient id="stroke-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" /> {/* Vibrant Blue */}
                    <stop offset="50%" stopColor="#d946ef" /> {/* Fuchsia */}
                    <stop offset="100%" stopColor="#facc15" /> {/* Gold */}
                  </linearGradient>
                </defs>
                <text
                  x="0"
                  y="28"
                  fill="#ffffff"
                  stroke="url(#stroke-grad)"
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                  paintOrder="stroke fill"
                  style={{
                    fontFamily: '"Kanit", sans-serif',
                    fontWeight: 900,
                    fontStyle: 'italic',
                    fontSize: '23pt',
                    letterSpacing: '-0.01em'
                  }}
                >
                  รวยฟ้าผ่า #11 บอลโลก 2026
                </text>
              </svg>
            </div>
            <p 
              style={{
                fontFamily: '"Kanit", sans-serif',
                fontWeight: 900,
                fontStyle: 'italic',
                fontSize: '11pt'
              }}
              className="tracking-widest text-fuchsia-400 mt-1 whitespace-nowrap uppercase drop-shadow-[0_0_8px_rgba(217,70,239,0.3)]"
            >
              รวยไม่ไหวแล้วโว้ย 🔥⚽
            </p>
          </div>
        </div>
        {user.role === UserRole.ADMIN && (
          <div className="flex bg-[#1e293b] rounded-2xl p-1 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] shrink-0 ml-1.5 border border-slate-700/50">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`px-4.5 py-2.5 rounded-xl text-sm font-black transition-all tracking-wide ${activeTab === 'dashboard' ? 'bg-gradient-to-r from-emerald-500 to-green-400 text-white shadow-md scale-102' : 'text-slate-400 hover:text-slate-200'}`}
            >
              ผู้เล่น
            </button>
            <button 
              onClick={() => setActiveTab('admin')}
              className={`px-4.5 py-2.5 rounded-xl text-sm font-black transition-all tracking-wide ${activeTab === 'admin' ? 'bg-gradient-to-r from-emerald-500 to-green-400 text-white shadow-md scale-102' : 'text-slate-400 hover:text-slate-200'}`}
            >
              แอดมิน
            </button>
          </div>
        )}
      </header>

      <main className="max-w-md mx-auto p-5 space-y-8 mt-2">
        {activeTab === 'dashboard' ? <Dashboard /> : <AdminDashboard />}
      </main>

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
