/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UserRole } from './types';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import Navigation from './components/Navigation';

import JoinGroup from './components/JoinGroup';

function AppContent() {
  const { user, firebaseUser, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin'>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-world-cup-blue">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-world-cup-green"></div>
      </div>
    );
  }

  // Case 1: No auth at all
  if (!firebaseUser) {
    return <Login />;
  }

  // Case 2: Authed with Google, but hasn't joined the group yet
  if (!user) {
    return <JoinGroup />;
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="p-4 flex justify-between items-center bg-world-cup-purple/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<div class="text-world-cup-gold"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trophy"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg></div>';
              }}
            />
          </div>
          <h1 className="text-lg font-black text-world-cup-gold italic tracking-tighter hidden xs:block">รวยฟ้าผ่า #20</h1>
        </div>
        {user.role === UserRole.ADMIN && (
          <div className="flex bg-white/10 rounded-lg p-1">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${activeTab === 'dashboard' ? 'bg-world-cup-green text-white' : 'text-gray-400'}`}
            >
              ผู้เล่น
            </button>
            <button 
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${activeTab === 'admin' ? 'bg-world-cup-green text-white' : 'text-gray-400'}`}
            >
              ผู้ดูแล
            </button>
          </div>
        )}
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
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
