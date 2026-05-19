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
      className="min-h-screen pb-24 font-sans antialiased text-slate-800"
      style={config?.backgroundUrl ? { 
        backgroundImage: `url(${config.backgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      } : {}}
    >
      <header className="p-4 flex justify-between items-center bg-white/80 backdrop-blur-xl sticky top-0 z-50 border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center bg-world-cup-green/10 rounded-2xl overflow-hidden">
            <img 
              src={config?.logoUrl || "/logo.png"} 
              alt="Logo" 
              className="w-full h-full object-contain drop-shadow-sm"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                if (target.parentElement) {
                  target.parentElement.innerHTML = '<div class="text-world-cup-green"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trophy"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg></div>';
                }
              }}
            />
          </div>
          <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter hidden xs:block">
            รวยฟ้าผ่า <span className="text-world-cup-green">#20</span>
          </h1>
        </div>
        {user.role === UserRole.ADMIN && (
          <div className="flex bg-gray-100 rounded-2xl p-1.5 shadow-inner">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`px-5 py-2 rounded-xl text-sm font-black transition-all uppercase tracking-widest ${activeTab === 'dashboard' ? 'bg-world-cup-green text-white shadow-md' : 'text-gray-400'}`}
            >
              ผู้เล่น
            </button>
            <button 
              onClick={() => setActiveTab('admin')}
              className={`px-5 py-2 rounded-xl text-sm font-black transition-all uppercase tracking-widest ${activeTab === 'admin' ? 'bg-world-cup-green text-white shadow-md' : 'text-gray-400'}`}
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
