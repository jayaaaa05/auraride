import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import RoleNav from './components/RoleNav';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import RiderDashboard from './pages/rider/RiderDashboard';
import DriverDashboard from './pages/driver/DriverDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';

const AuthenticatedPortalRouter = () => {
  const { activePortal } = useSocket();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <RoleNav />
      <main className="flex-1">
        {activePortal === 'driver' ? (
          <DriverDashboard />
        ) : activePortal === 'admin' ? (
          <AdminDashboard />
        ) : (
          <RiderDashboard />
        )}
      </main>
    </div>
  );
};

const AuthShell = () => {
  const { isAuthenticated } = useAuth();
  const [authView, setAuthView] = useState('login');
  const [guestDemoMode, setGuestDemoMode] = useState(false);

  if (isAuthenticated || guestDemoMode) {
    return <AuthenticatedPortalRouter />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient Background Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute bottom-0 right-10 w-[28rem] h-[28rem] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      {/* Header with Login/Register Toggle & Instant Demo Launch */}
      <div className="relative z-10 max-w-lg w-full mx-auto mb-6 flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-2">
        <div className="flex items-center gap-2.5 pl-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center font-bold text-xs text-white">
            A
          </div>
          <span className="font-bold text-sm text-white">AuraRide</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAuthView('login')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
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
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              authView === 'register'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => setGuestDemoMode(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition cursor-pointer"
          >
            ⚡ Launch Live Demo
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
        AuraRide Real-Time Ride Hailing System • DSA Shortest Path, PriorityQueue Dispatch & Socket.IO Telemetry
      </footer>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AuthShell />
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
