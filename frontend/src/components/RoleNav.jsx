import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const RoleNav = ({ onOpenBenchmarkLab }) => {
  const { user, logout } = useAuth();
  const { activePortal, setActivePortal, setDemoPersona } = useSocket();
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const handlePortalSwitch = (portal) => {
    setActivePortal(portal);
    if (portal === 'driver') {
      setDemoPersona({
        id: 'DRV-103',
        name: 'Vikramaditya Rao',
        role: 'driver',
        vehicle: {
          model: 'White Swift Dzire',
          plateNumber: 'KA 03 MN 9012',
          type: 'Economy',
          capacity: 4,
        },
        rating: 4.9,
      });
    } else if (portal === 'admin') {
      setDemoPersona({
        id: 'ADM-001',
        name: 'AuraRide Ops Admin',
        role: 'admin',
      });
    } else {
      setDemoPersona({
        id: 'USR-RIDER-1',
        name: user?.name || 'Alex Morgan',
        role: 'rider',
      });
    }
  };

  return (
    <>
      {/* Minimal Floating Pill Header at Top Right */}
      <header className="fixed top-4 right-4 z-40 flex items-center gap-2">
        <nav className="bg-zinc-950/90 text-zinc-100 backdrop-blur-xl border border-zinc-800/80 shadow-2xl rounded-full p-1.5 flex items-center gap-1 text-xs">
          {[
            { id: 'rider', label: 'Rider' },
            { id: 'driver', label: 'Driver' },
            { id: 'admin', label: 'Admin' },
          ].map((tab) => {
            const isActive = activePortal === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handlePortalSwitch(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition cursor-pointer ${
                  isActive
                    ? 'bg-white text-zinc-950 shadow font-bold'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/70'
                }`}
              >
                {tab.label}
              </button>
            );
          })}

          {/* Subtle DSA Engine Pill for Capstone Viva */}
          {onOpenBenchmarkLab && (
            <>
              <div className="h-4 w-px bg-zinc-800/90 mx-0.5" />
              <button
                type="button"
                onClick={onOpenBenchmarkLab}
                title="View Algorithm & Spatial Telemetry Benchmark"
                className="px-2.5 py-1.5 rounded-full text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80 transition flex items-center gap-1.5 cursor-pointer"
              >
                <span className="text-zinc-500 text-xs">⚡</span>
                <span className="text-[11px] tracking-tight">DSA Engine</span>
              </button>
            </>
          )}

          <div className="h-4 w-px bg-zinc-800/90 mx-0.5" />

          {/* Small Subtle Info Icon for Project Details */}
          <button
            type="button"
            onClick={() => setDetailsModalOpen(true)}
            title="Project Architecture Details"
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80 transition cursor-pointer text-xs font-semibold"
          >
            ⓘ
          </button>

          {/* Quick Logout */}
          <button
            type="button"
            onClick={logout}
            title="Sign Out"
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:text-rose-400 hover:bg-zinc-900/80 transition cursor-pointer text-xs font-semibold"
          >
            ⏻
          </button>
        </nav>
      </header>

      {/* Subtle Project Details Modal (Only shown when ⓘ is clicked) */}
      {detailsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-zinc-100 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white text-zinc-950 font-black flex items-center justify-center text-sm shadow">
                  A
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    AuraRide Platform
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Production Full-Stack Architecture
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 text-xs font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-1.5">
                <span className="font-bold text-white block">
                  Core Technologies
                </span>
                <p className="text-zinc-400">
                  React 19, Tailwind CSS, Express, MongoDB Atlas, Leaflet, and real-time Socket.IO bidirectional telemetry.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-1.5">
                <span className="font-bold text-white block">
                  Autonomous Engine Features
                </span>
                <p className="text-zinc-400">
                  Shortest-path routing, 2D QuadTree spatial driver indexing, dynamic surge multipliers, and a 4-digit PIN verification handshake.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {onOpenBenchmarkLab ? (
                <button
                  type="button"
                  onClick={() => {
                    setDetailsModalOpen(false);
                    onOpenBenchmarkLab();
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition cursor-pointer"
                >
                  Open Algorithmic Lab →
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setDetailsModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-white text-zinc-950 text-xs font-bold hover:bg-zinc-200 transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RoleNav;
