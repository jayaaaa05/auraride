import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import RiderDashboard from './pages/rider/RiderDashboard';

const AuthenticatedLayout = () => {
  const { user, role, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20">
              A
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white">
                AuraRide
              </span>
              <span className="ml-2.5 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {role || 'rider'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium text-slate-200">
                {user?.name}
              </span>
              <span className="text-xs text-slate-400">{user?.email}</span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main RiderDashboard View */}
      <main className="flex-1">
        <RiderDashboard />
      </main>
    </div>
  );
};

const AuthShell = () => {
  const { isAuthenticated } = useAuth();
  const [authView, setAuthView] = useState('login');

  if (isAuthenticated) {
    return <AuthenticatedLayout />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient Background Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute bottom-0 right-10 w-[28rem] h-[28rem] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      {/* Header with Login/Register Toggle */}
      <div className="relative z-10 max-w-md w-full mx-auto mb-6 flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-2xl p-2">
        <div className="flex items-center gap-2.5 pl-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center font-bold text-xs text-white">
            A
          </div>
          <span className="font-bold text-sm text-white">AuraRide</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAuthView('login')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              authView === 'login'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setAuthView('register')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              authView === 'register'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Register
          </button>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="relative z-10 flex-1 flex items-center justify-center">
        {authView === 'login' ? (
          <Login onSwitchToRegister={() => setAuthView('register')} />
        ) : (
          <Register onSwitchToLogin={() => setAuthView('login')} />
        )}
      </div>

      <footer className="relative z-10 text-center text-xs text-slate-500 mt-8">
        AuraRide Real-Time Ride Hailing System • DSA Shortest Path & PriorityQueue Dispatch
      </footer>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AuthShell />
    </AuthProvider>
  );
}

export default App;
