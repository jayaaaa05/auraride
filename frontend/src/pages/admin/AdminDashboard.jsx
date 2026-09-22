import React, { useEffect, useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import api from '../../services/api';

const STATUS_PILL_STYLES = {
  REQUESTED: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  SEARCHING: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  ASSIGNED: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  ARRIVING: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  ARRIVED: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  IN_PROGRESS: 'bg-blue-500/20 text-blue-300 border-blue-500/40 animate-pulse',
  COMPLETED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  CANCELLED: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
};

const AdminDashboard = () => {
  const {
    liveDrivers,
    setLiveDrivers,
    liveRides,
    setLiveRides,
    adminMetrics,
    setAdminMetrics,
    toggleAdminDriverVerify,
    toggleAdminUserBlock,
  } = useSocket();

  const [refreshing, setRefreshing] = useState(false);

  const fetchAdminData = async () => {
    setRefreshing(true);
    try {
      const [metricsRes, driversRes, ridesRes] = await Promise.allSettled([
        api.get('/admin/metrics'),
        api.get('/admin/drivers'),
        api.get('/admin/rides'),
      ]);

      if (
        metricsRes.status === 'fulfilled' &&
        metricsRes.value.data?.metrics
      ) {
        setAdminMetrics(metricsRes.value.data.metrics);
      }
      if (
        driversRes.status === 'fulfilled' &&
        driversRes.value.data?.drivers?.length
      ) {
        setLiveDrivers(driversRes.value.data.drivers);
      }
      if (
        ridesRes.status === 'fulfilled' &&
        ridesRes.value.data?.rides?.length
      ) {
        setLiveRides(ridesRes.value.data.rides);
      }
    } catch {
      // Uses live SocketContext state
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalRevenue = liveRides
    .filter((r) => r.status === 'COMPLETED')
    .reduce((acc, r) => acc + Number(r.fare || 0), 0);

  const activeTripsCount = liveRides.filter((r) =>
    ['REQUESTED', 'SEARCHING', 'ASSIGNED', 'ARRIVING', 'ARRIVED', 'IN_PROGRESS'].includes(
      r.status
    )
  ).length;

  const availableDriversCount = liveDrivers.filter(
    (d) => d.isOnline && !d.isBlocked
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            AuraRide Central Command & Telemetry
          </h1>
          <p className="text-xs text-slate-400">
            Real-Time Fleet Governance, Driver Verification, and Live Socket.IO Trip Monitor
          </p>
        </div>

        <button
          type="button"
          onClick={fetchAdminData}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-cyan-300 transition self-start sm:self-auto cursor-pointer"
        >
          {refreshing ? 'Syncing Telemetry...' : '↻ Sync Live Telemetry'}
        </button>
      </div>

      {/* 1. Metrics Strip: Total Revenue, Active Trips, Available Drivers, Network Nodes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
            Total Platform Revenue
          </span>
          <span className="text-2xl sm:text-3xl font-extrabold text-white mt-1 block">
            ₹{Math.max(totalRevenue, adminMetrics.grossPlatformRevenue || 0).toLocaleString()}
          </span>
          <span className="text-xs text-slate-400 mt-1 block">
            Across {liveRides.filter((r) => r.status === 'COMPLETED').length} completed rides
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 block">
            Active Trips
          </span>
          <span className="text-2xl sm:text-3xl font-extrabold text-white mt-1 block">
            {activeTripsCount}
          </span>
          <span className="text-xs text-slate-400 mt-1 block">
            Real-time Socket.IO sessions
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 block">
            Available Drivers
          </span>
          <span className="text-2xl sm:text-3xl font-extrabold text-white mt-1 block">
            {availableDriversCount} / {liveDrivers.length}
          </span>
          <span className="text-xs text-slate-400 mt-1 block">
            {liveDrivers.filter((d) => d.isVerified).length} Verified Partners
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
            Network Nodes & DSA Queries
          </span>
          <span className="text-2xl sm:text-3xl font-extrabold text-white mt-1 block">
            15 Nodes • {adminMetrics.dsaPathQueryCount || 18} Runs
          </span>
          <span className="text-xs text-slate-400 mt-1 block">
            27 Street Edges • O((V+E) log V)
          </span>
        </div>
      </div>

      {/* 2. Driver Verification & Account Governance Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold text-white">
              Driver Verification & Account Governance
            </h2>
            <p className="text-xs text-slate-400">
              Approve unverified partners (`PATCH /api/admin/drivers/:id/verify`) or suspend accounts (`PATCH /api/admin/users/:id/block`)
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
            {liveDrivers.length} Registered Drivers
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">Driver Partner</th>
                <th className="py-3 px-3">Vehicle & Plate</th>
                <th className="py-3 px-3">Telemetry & Rating</th>
                <th className="py-3 px-3">Verification Status</th>
                <th className="py-3 px-3">Account Status</th>
                <th className="py-3 px-3 text-right">Governance Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {liveDrivers.map((drv) => (
                <tr key={drv.id} className="hover:bg-slate-950/60 transition">
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-white text-sm">{drv.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {drv.email || drv.phone}
                    </div>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="font-semibold text-slate-200">
                      {drv.vehicle?.model} ({drv.vehicle?.type})
                    </div>
                    <div className="font-mono text-[11px] text-cyan-300">
                      {drv.vehicle?.plateNumber}
                    </div>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="text-amber-400 font-bold">
                      ★ {Number(drv.rating || 5.0).toFixed(2)} ({drv.completedTrips || 0} trips)
                    </div>
                    <div className="text-[11px] text-emerald-400 font-mono">
                      Earned: ₹{Number(drv.totalEarnings || 0).toLocaleString()}
                    </div>
                  </td>
                  <td className="py-3.5 px-3">
                    {drv.isVerified ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[11px]">
                        ✓ Verified
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[11px]">
                        ⏳ Pending Approval
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3">
                    {drv.isBlocked ? (
                      <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold text-[11px]">
                        Blocked
                      </span>
                    ) : drv.isOnline ? (
                      <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold text-[11px]">
                        ● Online ({drv.nearNode || 'A5'})
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 font-bold text-[11px]">
                        Offline
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleAdminDriverVerify(drv.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                        drv.isVerified
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                      }`}
                    >
                      {drv.isVerified ? 'Revoke Verify' : '✓ Approve Driver'}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleAdminUserBlock(drv.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                        drv.isBlocked
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {drv.isBlocked ? 'Unblock' : 'Block'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Live Network Monitor (Real-Time Socket.IO Rides Table) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold text-white">
              Live Network Monitor (Socket.IO Ride Streams)
            </h2>
            <p className="text-xs text-slate-400">
              Real-time trip lifecycle transitions: REQUESTED → ASSIGNED → ARRIVED → IN_PROGRESS → COMPLETED
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
            {liveRides.length} Total Logged Sessions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">Ride ID & OTP</th>
                <th className="py-3 px-3">Rider & Driver</th>
                <th className="py-3 px-3">Pickup → Dropoff</th>
                <th className="py-3 px-3">Dijkstra Path</th>
                <th className="py-3 px-3">Fare & Dist</th>
                <th className="py-3 px-3 text-right">Live Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {liveRides.map((ride) => (
                <tr key={ride.rideId} className="hover:bg-slate-950/60 transition">
                  <td className="py-3.5 px-3 font-mono">
                    <div className="font-bold text-white">{ride.rideId}</div>
                    {ride.otp && (
                      <div className="text-[11px] text-amber-400">
                        PIN: {ride.otp}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="font-semibold text-white">
                      Rider: {ride.riderName || 'Alex Morgan'}
                    </div>
                    <div className="text-[11px] text-cyan-300">
                      Driver: {ride.driverName || ride.driver?.name || 'Matching...'} (
                      {ride.vehicleType})
                    </div>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="text-emerald-300 font-medium">
                      [{ride.pickup?.nodeId}] {ride.pickup?.address}
                    </div>
                    <div className="text-rose-300 font-medium">
                      → [{ride.destination?.nodeId}] {ride.destination?.address}
                    </div>
                  </td>
                  <td className="py-3.5 px-3 font-mono text-[11px] text-indigo-300">
                    {Array.isArray(ride.path) ? ride.path.join(' → ') : '—'}
                  </td>
                  <td className="py-3.5 px-3 font-mono">
                    <div className="font-bold text-emerald-400 text-sm">
                      ₹{ride.fare}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {ride.distanceKm} km • {ride.durationMin}m
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full font-extrabold text-[11px] uppercase border ${
                        STATUS_PILL_STYLES[ride.status] ||
                        'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {ride.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
