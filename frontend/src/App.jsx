import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

const DashboardView = () => {
  const { user, role, logout } = useAuth();
  const [driverOnline, setDriverOnline] = useState(
    Boolean(user?.driverProfile?.isOnline)
  );

  const driverProfile = user?.driverProfile;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
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

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/50 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest font-semibold text-cyan-400 mb-1">
                AuraRide Mobility Platform
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                Welcome, {user?.name}!
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {role === 'driver'
                  ? 'Manage your vehicle availability, inspect incoming ride requests, and track real-time earnings.'
                  : 'Book instant Moto, Auto, Economy, or Premium rides with real-time driver telemetry.'}
              </p>
            </div>

            {role === 'driver' && (
              <button
                type="button"
                onClick={() => setDriverOnline((prev) => !prev)}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition flex items-center gap-2.5 self-start sm:self-auto ${
                  driverOnline
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    driverOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                  }`}
                />
                {driverOnline ? 'Online & Receiving Rides' : 'Go Online'}
              </button>
            )}
          </div>
        </div>

        {/* Account & Role Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
              Account Profile
            </h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Name</dt>
                <dd className="font-medium text-slate-100">{user?.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Email</dt>
                <dd className="font-medium text-slate-100">{user?.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Phone</dt>
                <dd className="font-medium text-slate-100">
                  {user?.phone || 'Not specified'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Active Role</dt>
                <dd className="font-semibold uppercase text-indigo-400">
                  {role}
                </dd>
              </div>
            </dl>
          </div>

          {role === 'driver' ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 md:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-4">
                Registered Vehicle & Telemetry
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-xs text-slate-400 block">Model</span>
                  <span className="text-base font-semibold text-white mt-1 block">
                    {driverProfile?.vehicle?.model || 'Configured Vehicle'}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-xs text-slate-400 block">Plate Number</span>
                  <span className="text-base font-semibold text-cyan-300 mt-1 block">
                    {driverProfile?.vehicle?.plateNumber || 'N/A'}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-xs text-slate-400 block">Category</span>
                  <span className="text-base font-semibold text-white mt-1 block">
                    {driverProfile?.vehicle?.type || 'Economy'} (
                    {driverProfile?.vehicle?.capacity || 4} seats)
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-xs text-slate-400 block">Driver Rating</span>
                  <span className="text-base font-semibold text-amber-400 mt-1 block">
                    ★ {Number(driverProfile?.rating ?? 5.0).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 md:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-4">
                Available AuraRide Fleet
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { name: 'Moto', desc: '1 Passenger • Fast' },
                  { name: 'Auto', desc: '3 Passengers • City' },
                  { name: 'Economy', desc: '4 Passengers • Value' },
                  { name: 'Premium', desc: '4 Passengers • Luxury' },
                ].map((tier) => (
                  <div
                    key={tier.name}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-indigo-500/40 transition"
                  >
                    <span className="text-sm font-bold text-white block">
                      {tier.name}
                    </span>
                    <span className="text-xs text-slate-400 mt-1 block">
                      {tier.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const AuthShell = () => {
  const { isAuthenticated } = useAuth();
  const [authView, setAuthView] = useState('login');

  if (isAuthenticated) {
    return <DashboardView />;
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
        AuraRide Real-Time Ride Hailing System • Full-Stack Auth & Telemetry
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
