import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const DEMO_PERSONAS = [
  {
    key: 'rider-alex',
    portal: 'rider',
    label: 'Rider: Alex Morgan (Passenger)',
    id: 'USR-RIDER-1',
    name: 'Alex Morgan',
    role: 'rider',
  },
  {
    key: 'driver-vikram',
    portal: 'driver',
    label: 'Driver: Vikramaditya Rao (Economy • Dzire)',
    id: 'DRV-103',
    name: 'Vikramaditya Rao',
    role: 'driver',
    rating: 4.92,
    vehicle: {
      model: 'Maruti Suzuki Dzire',
      plateNumber: 'KA 03 MN 9012',
      type: 'Economy',
      capacity: 4,
    },
  },
  {
    key: 'driver-siddharth',
    portal: 'driver',
    label: 'Driver: Siddharth Menon (Premium • Ioniq 5)',
    id: 'DRV-104',
    name: 'Siddharth Menon',
    role: 'driver',
    rating: 4.98,
    vehicle: {
      model: 'Hyundai Ioniq 5 EV',
      plateNumber: 'KA 01 ZP 0007',
      type: 'Premium',
      capacity: 4,
    },
  },
  {
    key: 'admin-ops',
    portal: 'admin',
    label: 'Admin: Central Dispatch Controller',
    id: 'ADM-001',
    name: 'AuraRide Ops Admin',
    role: 'admin',
  },
];

const RoleNav = () => {
  const { user, logout } = useAuth();
  const {
    connected,
    activePortal,
    setActivePortal,
    demoPersona,
    setDemoPersona,
    activeRide,
    incomingOffer,
  } = useSocket();

  const handlePersonaChange = (e) => {
    const selected = DEMO_PERSONAS.find((p) => p.key === e.target.value);
    if (selected) {
      setDemoPersona(selected);
      setActivePortal(selected.portal);
    }
  };

  return (
    <header className="border-b border-slate-800/90 bg-slate-900/85 backdrop-blur-xl sticky top-0 z-40 shadow-lg shadow-slate-950/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Socket Status */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center font-extrabold text-white shadow-md shadow-indigo-500/30">
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">
                AuraRide
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                  connected
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                {connected ? 'Socket.IO Live' : 'Hybrid Sim Engine'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              DSA Dijkstra Routing • Min-Heap Dispatch • Real-Time Telemetry
            </p>
          </div>
        </div>

        {/* Center Portal Navigation Tabs */}
        <nav className="flex items-center gap-1.5 p-1 bg-slate-950/90 border border-slate-800 rounded-xl">
          {[
            { id: 'rider', label: 'Rider Portal', badge: activeRide?.otp ? `OTP ${activeRide.otp}` : null },
            { id: 'driver', label: 'Driver Console', badge: incomingOffer ? '1 Offer!' : null },
            { id: 'admin', label: 'Admin Monitor', badge: null },
          ].map((tab) => {
            const isActive = activePortal === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActivePortal(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-md shadow-indigo-500/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold ${
                      tab.id === 'driver'
                        ? 'bg-amber-400 text-slate-950 animate-pulse'
                        : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Quick-Demo Account Switcher & Logout */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            <label
              htmlFor="quick-demo-switcher"
              className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 whitespace-nowrap"
            >
              Demo Switch:
            </label>
            <select
              id="quick-demo-switcher"
              value={
                DEMO_PERSONAS.find((p) => p.portal === activePortal && p.id === demoPersona.id)
                  ?.key ||
                DEMO_PERSONAS.find((p) => p.portal === activePortal)?.key ||
                'rider-alex'
              }
              onChange={handlePersonaChange}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {DEMO_PERSONAS.map((persona) => (
                <option key={persona.key} value={persona.key}>
                  {persona.label}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden lg:flex flex-col items-end">
            <span className="text-xs font-semibold text-slate-200">
              {user?.name || demoPersona.name}
            </span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">
              {activePortal} view
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default RoleNav;
