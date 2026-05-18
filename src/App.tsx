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
import ChangePassword from './components/ChangePassword';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin'>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-world-cup-blue">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-world-cup-green"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (user.mustChangePassword) {
    return <ChangePassword />;
  }

  return (
    <div className="min-h-screen bg-world-cup-blue pb-20">
      <header className="p-4 flex justify-between items-center bg-world-cup-purple/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]" />
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
