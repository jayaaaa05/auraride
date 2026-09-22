import React, { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import MapView from '../../components/MapView';

const CITY_NODES = [
  { id: 'A1', coords: [12.9756, 77.6066], lat: 12.9756, lng: 77.6066, name: 'MG Road Metro Hub' },
  { id: 'A2', coords: [12.9719, 77.5937], lat: 12.9719, lng: 77.5937, name: 'Cubbon Park Central' },
  { id: 'A3', coords: [12.9784, 77.6408], lat: 12.9784, lng: 77.6408, name: 'Indiranagar 100ft Junction' },
  { id: 'A4', coords: [12.9611, 77.6387], lat: 12.9611, lng: 77.6387, name: 'Domlur Flyover Terminal' },
  { id: 'A5', coords: [12.9698, 77.6205], lat: 12.9698, lng: 77.6205, name: 'Trinity Circle Plaza' },
  { id: 'A6', coords: [12.9592, 77.6074], lat: 12.9592, lng: 77.6074, name: 'Richmond Circle Crossing' },
  { id: 'A7', coords: [12.9507, 77.5848], lat: 12.9507, lng: 77.5848, name: 'Lalbagh West Gate' },
  { id: 'A8', coords: [12.9352, 77.6245], lat: 12.9352, lng: 77.6245, name: 'Koramangala Sony World' },
  { id: 'A9', coords: [12.9279, 77.6271], lat: 12.9279, lng: 77.6271, name: 'Koramangala Water Tank' },
  { id: 'A10', coords: [12.9121, 77.6446], lat: 12.9121, lng: 77.6446, name: 'HSR Layout BDA Complex' },
  { id: 'A11', coords: [12.9166, 77.6101], lat: 12.9166, lng: 77.6101, name: 'BTM Layout Udupi Garden' },
  { id: 'A12', coords: [12.9254, 77.5838], lat: 12.9254, lng: 77.5838, name: 'Jayanagar 4th Block Bus Stand' },
  { id: 'A13', coords: [12.9176, 77.6228], lat: 12.9176, lng: 77.6228, name: 'Silk Board Tech Flyover' },
  { id: 'A14', coords: [12.9299, 77.6768], lat: 12.9299, lng: 77.6768, name: 'Bellandur EcoSpace Gate' },
  { id: 'A15', coords: [12.9569, 77.7011], lat: 12.9569, lng: 77.7011, name: 'Marathahalli Bridge Hub' },
];

const CITY_EDGES_RAW = [
  ['A1', 'A2', 1.6, 4], ['A1', 'A5', 1.8, 5], ['A1', 'A6', 2.0, 6],
  ['A2', 'A6', 1.9, 5], ['A2', 'A7', 2.6, 7], ['A5', 'A3', 2.4, 6],
  ['A5', 'A4', 2.2, 6], ['A5', 'A6', 1.7, 5], ['A3', 'A4', 2.0, 5],
  ['A3', 'A15', 7.1, 16], ['A4', 'A8', 3.3, 9], ['A4', 'A14', 5.4, 13],
  ['A6', 'A7', 2.7, 7], ['A6', 'A8', 3.4, 9], ['A8', 'A9', 1.1, 3],
  ['A9', 'A10', 2.6, 7], ['A9', 'A11', 2.2, 6], ['A9', 'A13', 1.5, 4],
  ['A10', 'A13', 2.5, 6], ['A10', 'A14', 4.1, 10], ['A11', 'A12', 3.0, 8],
];

const CITY_EDGES = CITY_EDGES_RAW.map(([u, v, weightKm, durationMin]) => {
  const fromNode = CITY_NODES.find((n) => n.id === u);
  const toNode = CITY_NODES.find((n) => n.id === v);
  return {
    from: u,
    to: v,
    fromCoords: fromNode.coords,
    toCoords: toNode.coords,
    weightKm,
    durationMin,
  };
});

const NODE_COORDS_LOOKUP = Object.fromEntries(
  CITY_NODES.map((n) => [n.id, { lat: n.lat, lng: n.lng }])
);

const DriverDashboard = () => {
  const {
    demoPersona,
    liveDrivers,
    activeRide,
    incomingOffer,
    setIncomingOffer,
    otpError,
    setOtpError,
    requestRideRealtime,
    acceptRideOffer,
    markDriverArrived,
    verifyOtpAndStart,
    stepRideAlongPath,
    completeActiveRide,
    cancelActiveRide,
    updateDriverLocationAndStatus,
  } = useSocket();

  const currentDriverRecord =
    liveDrivers.find((d) => d.id === demoPersona.id) ||
    liveDrivers[2] || {
      id: 'DRV-103',
      name: 'Vikramaditya Rao',
      rating: 4.92,
      completedTrips: 2150,
      totalEarnings: 24680,
      isOnline: true,
      nearNode: 'A5',
      currentLocation: { lat: 12.9698, lng: 77.6205 },
      vehicle: {
        model: 'Maruti Suzuki Dzire',
        plateNumber: 'KA 03 MN 9012',
        type: 'Economy',
        capacity: 4,
      },
    };

  const [isOnline, setIsOnline] = useState(currentDriverRecord.isOnline !== false);
  const [driverNodeId, setDriverNodeId] = useState(
    currentDriverRecord.nearNode || 'A5'
  );
  const [otpInput, setOtpInput] = useState('');
  const [offerCountdown, setOfferCountdown] = useState(15);

  // 15-second animated countdown timer when an incoming Ride Offer arrives
  useEffect(() => {
    if (!incomingOffer) {
      setOfferCountdown(15);
      return;
    }

    setOfferCountdown(incomingOffer.expiresInSec || 15);
    const interval = setInterval(() => {
      setOfferCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [incomingOffer]);

  const handleToggleOnline = () => {
    const nextOnline = !isOnline;
    setIsOnline(nextOnline);
    const nodeObj = CITY_NODES.find((n) => n.id === driverNodeId) || CITY_NODES[4];
    updateDriverLocationAndStatus({
      driverId: currentDriverRecord.id,
      isOnline: nextOnline,
      nearNode: driverNodeId,
      coords: { lat: nodeObj.lat, lng: nodeObj.lng },
    });
  };

  const handleTeleportDriverNode = (newNodeId) => {
    setDriverNodeId(newNodeId);
    const nodeObj = CITY_NODES.find((n) => n.id === newNodeId);
    if (nodeObj) {
      updateDriverLocationAndStatus({
        driverId: currentDriverRecord.id,
        isOnline,
        nearNode: newNodeId,
        coords: { lat: nodeObj.lat, lng: nodeObj.lng },
      });
    }
  };

  // Presentation Helper: Simulate an incoming ride request right from the Driver view
  const handleSimulateIncomingOffer = () => {
    const samplePath = ['A1', 'A5', 'A4', 'A8', 'A9', 'A10'];
    const sampleCoords = samplePath.map(
      (id) => CITY_NODES.find((n) => n.id === id)?.coords
    );

    requestRideRealtime({
      pickup: {
        nodeId: 'A1',
        address: 'MG Road Metro Hub',
        lat: 12.9756,
        lng: 77.6066,
      },
      destination: {
        nodeId: 'A10',
        address: 'HSR Layout BDA Complex',
        lat: 12.9121,
        lng: 77.6446,
      },
      distanceKm: 9.1,
      durationMin: 24,
      fare: 235,
      vehicleType: currentDriverRecord.vehicle?.type || 'Economy',
      path: samplePath,
      coordinates: sampleCoords,
      optimalDriver: currentDriverRecord,
    });
  };

  const handleStartRideWithOtp = (e) => {
    e.preventDefault();
    if (!activeRide) return;
    const ok = verifyOtpAndStart(activeRide.rideId, otpInput);
    if (ok) {
      setOtpInput('');
    }
  };

  const activeRoutePath = activeRide?.path || incomingOffer?.path || [];
  const activeRouteCoords = activeRoutePath
    .map((id) => CITY_NODES.find((n) => n.id === id)?.coords)
    .filter(Boolean);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Driver Summary Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
              Total Earnings
            </span>
            <span className="text-2xl font-extrabold text-white mt-0.5 block">
              ₹{Number(currentDriverRecord.totalEarnings || 0).toLocaleString()}
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
            +$ Instant Payout
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 block">
              Completed Trips
            </span>
            <span className="text-2xl font-extrabold text-white mt-0.5 block">
              {currentDriverRecord.completedTrips || 145}
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
            {currentDriverRecord.vehicle?.type || 'Economy'}
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
              Driver Rating
            </span>
            <span className="text-2xl font-extrabold text-amber-400 mt-0.5 block">
              ★ {Number(currentDriverRecord.rating || 4.92).toFixed(2)}
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono">
            Top 1% Fleet
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 block">
              Availability Status
            </span>
            <span className="text-sm font-bold text-white mt-1 block">
              {isOnline ? 'Online & Receiving Offers' : 'Offline'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleOnline}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              isOnline
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25'
                : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-slate-950 animate-ping' : 'bg-slate-500'
              }`}
            />
            {isOnline ? 'GO OFFLINE' : 'GO ONLINE'}
          </button>
        </div>
      </div>

      {/* Main Two-Column Driver Console & Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Offer Modal, Active Ride HUD, GPS Node Teleporter */}
        <div className="lg:col-span-5 space-y-6">
          {/* Driver Vehicle & Live GPS Positioning Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-bold text-white">
                  {currentDriverRecord.name}
                </h2>
                <p className="text-xs text-slate-400">
                  {currentDriverRecord.vehicle?.model} •{' '}
                  <span className="font-mono text-cyan-300">
                    {currentDriverRecord.vehicle?.plateNumber}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleSimulateIncomingOffer}
                className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold transition cursor-pointer"
              >
                ⚡ Simulate Incoming Offer
              </button>
            </div>

            <div className="pt-3 border-t border-slate-800/80">
              <label
                htmlFor="driver-gps-node"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
              >
                Current Driver GPS Intersection (Broadcasts driver:locationUpdate)
              </label>
              <select
                id="driver-gps-node"
                value={driverNodeId}
                onChange={(e) => handleTeleportDriverNode(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {CITY_NODES.map((n) => (
                  <option key={n.id} value={n.id}>
                    [{n.id}] {n.name} ({n.lat.toFixed(4)}, {n.lng.toFixed(4)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 1. INCOMING RIDE OFFER MODAL CARD (with 15s countdown) */}
          {incomingOffer && incomingOffer.status === 'REQUESTED' && (
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950/70 to-slate-900 border-2 border-amber-400/80 rounded-2xl p-5 shadow-2xl shadow-amber-500/10 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider">
                    New Dispatch Offer
                  </span>
                  <span className="text-xs font-mono text-cyan-300">
                    {incomingOffer.rideId}
                  </span>
                </div>
                <span className="px-3 py-1 rounded-xl bg-slate-950 border border-amber-400/50 text-amber-300 font-mono text-sm font-extrabold">
                  ⏱ {offerCountdown}s
                </span>
              </div>

              {/* Animated Countdown Progress Bar */}
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-rose-500 transition-all duration-1000"
                  style={{ width: `${(offerCountdown / 15) * 100}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-400 block">
                    Pickup Node
                  </span>
                  <span className="text-sm font-bold text-white block">
                    [{incomingOffer.pickup?.nodeId}] {incomingOffer.pickup?.address}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-rose-400 block">
                    Dropoff Node
                  </span>
                  <span className="text-sm font-bold text-white block">
                    [{incomingOffer.destination?.nodeId}]{' '}
                    {incomingOffer.destination?.address}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between px-1 text-sm">
                <div>
                  <span className="text-slate-400 text-xs block">
                    Trip Distance & Duration
                  </span>
                  <span className="font-bold text-white">
                    {incomingOffer.distanceKm} km • ~{incomingOffer.durationMin} min
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-xs block">
                    Estimated Earnings
                  </span>
                  <span className="text-xl font-extrabold text-emerald-400">
                    ₹{incomingOffer.fare}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => acceptRideOffer(incomingOffer, currentDriverRecord)}
                  className="py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-500/25 transition cursor-pointer"
                >
                  ✓ Accept Ride
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIncomingOffer(null);
                    cancelActiveRide('driver', 'Driver declined offer');
                  }}
                  className="py-3 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-bold text-sm transition cursor-pointer"
                >
                  ✕ Reject
                </button>
              </div>
            </div>
          )}

          {/* 2. ACTIVE RIDE HUD (ASSIGNED / ARRIVED / IN_PROGRESS / COMPLETED) */}
          {activeRide && activeRide.status !== 'REQUESTED' && (
            <div className="bg-slate-900/95 border border-indigo-500/40 rounded-2xl p-5 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 block">
                    Active Trip HUD • {activeRide.rideId}
                  </span>
                  <h3 className="text-lg font-bold text-white">
                    Passenger: {activeRide.riderName || 'Alex Morgan'}
                  </h3>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  {activeRide.status}
                </span>
              </div>

              {/* Turn-by-Turn Next Node Indicator */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold">
                    Turn-by-Turn Dijkstra Route:
                  </span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {activeRide.currentDriverNode || activeRide.pickup?.nodeId} →{' '}
                    {activeRide.nextNodeId || activeRide.destination?.nodeId}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(activeRide.path || []).map((nId, idx) => {
                    const isVisited =
                      activeRide.stepIndex !== undefined && idx <= activeRide.stepIndex;
                    return (
                      <React.Fragment key={`hud-${nId}-${idx}`}>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                            isVisited
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {nId}
                        </span>
                        {idx < activeRide.path.length - 1 && (
                          <span className="text-slate-600 text-xs">→</span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Step A: Mark Arrived at Pickup */}
              {activeRide.status === 'ASSIGNED' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-300">
                    Navigate to Pickup{' '}
                    <strong className="text-emerald-400">
                      [{activeRide.pickup?.nodeId}] {activeRide.pickup?.address}
                    </strong>{' '}
                    and notify the passenger when you arrive.
                  </p>
                  <button
                    type="button"
                    onClick={() => markDriverArrived(activeRide.rideId)}
                    className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-sm transition cursor-pointer"
                  >
                    📍 Mark Arrived at Pickup ({activeRide.pickup?.nodeId})
                  </button>
                </div>
              )}

              {/* Step B: 4-Digit OTP Verification Input to Start Trip */}
              {(activeRide.status === 'ASSIGNED' ||
                activeRide.status === 'ARRIVED') && (
                <form
                  onSubmit={handleStartRideWithOtp}
                  className="p-4 rounded-xl bg-slate-950 border border-amber-500/40 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="driver-otp-input"
                      className="text-xs font-bold uppercase tracking-wider text-amber-300"
                    >
                      Enter Passenger 4-Digit OTP to Start
                    </label>
                    <button
                      type="button"
                      onClick={() => setOtpInput(String(activeRide.otp || '1234'))}
                      className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                    >
                      Auto-fill Demo PIN ({activeRide.otp})
                    </button>
                  </div>

                  {otpError && (
                    <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs">
                      {otpError}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      id="driver-otp-input"
                      type="text"
                      maxLength={4}
                      value={otpInput}
                      onChange={(e) => {
                        setOtpInput(e.target.value);
                        setOtpError('');
                      }}
                      placeholder="Enter 4-digit PIN"
                      className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-base tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider transition cursor-pointer"
                    >
                      Verify & Start
                    </button>
                  </div>
                </form>
              )}

              {/* Step C: In-Progress Route Traversal & Complete Ride Button */}
              {activeRide.status === 'IN_PROGRESS' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>
                      Traverse Progress: {activeRide.progressPercent || 25}%
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">
                      Fare: ₹{activeRide.fare}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500"
                      style={{ width: `${activeRide.progressPercent || 25}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => stepRideAlongPath(NODE_COORDS_LOOKUP)}
                      className="py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 font-bold text-xs transition cursor-pointer"
                    >
                      ➔ Step Next Node
                    </button>
                    <button
                      type="button"
                      onClick={completeActiveRide}
                      className="py-3 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/25 transition cursor-pointer"
                    >
                      ✓ Complete Ride (₹{activeRide.fare})
                    </button>
                  </div>
                </div>
              )}

              {/* Step D: Completed Trip Banner */}
              {activeRide.status === 'COMPLETED' && (
                <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm">
                      ✓ Trip Completed!
                    </span>
                    <span className="font-mono font-extrabold text-base text-emerald-300">
                      +₹{activeRide.fare} Credited
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Earnings and trip counts have been updated in real time across Driver and Admin portals.
                  </p>
                </div>
              )}
            </div>
          )}

          {!incomingOffer && !activeRide && (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto text-xl">
                📡
              </div>
              <h3 className="text-base font-bold text-white">
                Scanning for Nearby Ride Requests
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                You are positioned at{' '}
                <strong className="text-cyan-300">[{driverNodeId}]</strong>. Request a ride from the{' '}
                <strong className="text-white">Rider Portal</strong> tab or click{' '}
                <strong className="text-indigo-300">⚡ Simulate Incoming Offer</strong> above.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Live Driver Map View */}
        <div className="lg:col-span-7">
          <div className="h-[560px]">
            <MapView
              nodes={CITY_NODES}
              edges={CITY_EDGES}
              startNodeId={
                activeRide?.pickup?.nodeId ||
                incomingOffer?.pickup?.nodeId ||
                driverNodeId
              }
              endNodeId={
                activeRide?.destination?.nodeId ||
                incomingOffer?.destination?.nodeId ||
                'A10'
              }
              routePath={activeRoutePath}
              routeCoordinates={activeRouteCoords}
              drivers={[
                {
                  ...currentDriverRecord,
                  currentLocation:
                    activeRide?.currentDriverCoords ||
                    NODE_COORDS_LOOKUP[driverNodeId] ||
                    currentDriverRecord.currentLocation,
                },
              ]}
              optimalDriver={currentDriverRecord}
              onSelectPickup={(id) => handleTeleportDriverNode(id)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverDashboard;
