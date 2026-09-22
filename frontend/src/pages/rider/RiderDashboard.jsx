import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import MapView from '../../components/MapView';

/**
 * Fallback local seed of the 15 city nodes & edges in case the backend server is starting up,
 * ensuring the UI and map always render instantaneously.
 */
const FALLBACK_NODES = [
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

const FALLBACK_EDGE_LIST = [
  ['A1', 'A2', 1.6, 4],
  ['A1', 'A5', 1.8, 5],
  ['A1', 'A6', 2.0, 6],
  ['A2', 'A6', 1.9, 5],
  ['A2', 'A7', 2.6, 7],
  ['A5', 'A3', 2.4, 6],
  ['A5', 'A4', 2.2, 6],
  ['A5', 'A6', 1.7, 5],
  ['A3', 'A4', 2.0, 5],
  ['A3', 'A15', 7.1, 16],
  ['A4', 'A8', 3.3, 9],
  ['A4', 'A14', 5.4, 13],
  ['A4', 'A15', 6.8, 15],
  ['A6', 'A7', 2.7, 7],
  ['A6', 'A8', 3.4, 9],
  ['A7', 'A12', 2.9, 8],
  ['A8', 'A9', 1.1, 3],
  ['A8', 'A14', 5.8, 14],
  ['A9', 'A10', 2.6, 7],
  ['A9', 'A11', 2.2, 6],
  ['A9', 'A13', 1.5, 4],
  ['A10', 'A13', 2.5, 6],
  ['A10', 'A14', 4.1, 10],
  ['A11', 'A12', 3.0, 8],
  ['A11', 'A13', 1.4, 4],
  ['A13', 'A14', 6.0, 14],
  ['A14', 'A15', 4.0, 10],
];

const FALLBACK_DRIVERS = [
  {
    id: 'DRV-101',
    name: 'Arjun Nair',
    phone: '+91 98450 11201',
    rating: 4.95,
    currentLocation: { lat: 12.9762, lng: 77.6081 },
    vehicle: { model: 'Ather 450X Electric', plateNumber: 'KA 01 EM 4501', type: 'Moto', capacity: 1 },
  },
  {
    id: 'DRV-102',
    name: 'Rakesh Gowda',
    phone: '+91 98450 22314',
    rating: 4.82,
    currentLocation: { lat: 12.9365, lng: 77.6231 },
    vehicle: { model: 'Bajaj RE Compact CNG', plateNumber: 'KA 05 AA 7823', type: 'Auto', capacity: 3 },
  },
  {
    id: 'DRV-103',
    name: 'Vikramaditya Rao',
    phone: '+91 98450 33981',
    rating: 4.92,
    currentLocation: { lat: 12.9689, lng: 77.6194 },
    vehicle: { model: 'Maruti Suzuki Dzire', plateNumber: 'KA 03 MN 9012', type: 'Economy', capacity: 4 },
  },
  {
    id: 'DRV-104',
    name: 'Siddharth Menon',
    phone: '+91 98450 44812',
    rating: 4.98,
    currentLocation: { lat: 12.9772, lng: 77.6395 },
    vehicle: { model: 'Hyundai Ioniq 5 EV', plateNumber: 'KA 01 ZP 0007', type: 'Premium', capacity: 4 },
  },
];

/**
 * Local client-side fallback computation mirroring backend Dijkstra + Fares + DriverMatcher
 * in case the backend HTTP server is unreachable.
 */
function computeClientSideFallback(startId, endId, selectedVehicleType) {
  const nodeMap = new Map(FALLBACK_NODES.map((n) => [n.id, n]));
  const adj = new Map(FALLBACK_NODES.map((n) => [n.id, []]));

  FALLBACK_EDGE_LIST.forEach(([u, v, w, d]) => {
    adj.get(u)?.push({ node: v, weightKm: w, durationMin: d });
    adj.get(v)?.push({ node: u, weightKm: w, durationMin: d });
  });

  const dist = new Map();
  const dur = new Map();
  const prev = new Map();
  const visited = new Set();

  FALLBACK_NODES.forEach((n) => {
    dist.set(n.id, Infinity);
    dur.set(n.id, Infinity);
    prev.set(n.id, null);
  });

  dist.set(startId, 0);
  dur.set(startId, 0);

  const queue = [{ id: startId, priority: 0 }];
  while (queue.length > 0) {
    queue.sort((a, b) => a.priority - b.priority);
    const { id: curr } = queue.shift();
    if (visited.has(curr)) continue;
    visited.add(curr);
    if (curr === endId) break;

    for (const edge of adj.get(curr) || []) {
      const nextDist = Number((dist.get(curr) + edge.weightKm).toFixed(3));
      if (nextDist < dist.get(edge.node)) {
        dist.set(edge.node, nextDist);
        dur.set(edge.node, dur.get(curr) + edge.durationMin);
        prev.set(edge.node, curr);
        queue.push({ id: edge.node, priority: nextDist });
      }
    }
  }

  const path = [];
  let step = endId;
  while (step) {
    path.unshift(step);
    step = prev.get(step);
  }

  const distanceKm = Number((dist.get(endId) || 0).toFixed(2));
  const durationMin = Math.round(dur.get(endId) || 0);
  const coordinates = path.map((id) => nodeMap.get(id)?.coords).filter(Boolean);

  const tierSpecs = [
    { vehicleType: 'Moto', label: 'Aura Moto', tagline: 'Beat city traffic • 1 Rider', capacity: 1, baseFare: 25, perKmRate: 9.5, perMinRate: 1.0, minFare: 35, mult: 0.82 },
    { vehicleType: 'Auto', label: 'Aura Auto', tagline: 'Doorstep 3-wheeler • 3 Seats', capacity: 3, baseFare: 35, perKmRate: 13.5, perMinRate: 1.25, minFare: 50, mult: 1.0 },
    { vehicleType: 'Economy', label: 'Aura Economy', tagline: 'AC Hatchback • 4 Seats', capacity: 4, baseFare: 55, perKmRate: 17.0, perMinRate: 1.5, minFare: 80, mult: 0.95 },
    { vehicleType: 'Premium', label: 'Aura Premium', tagline: 'Executive EV & Sedan • 4 Seats', capacity: 4, baseFare: 95, perKmRate: 24.5, perMinRate: 2.2, minFare: 140, mult: 0.9 },
  ];

  const fares = {};
  tierSpecs.forEach((t) => {
    const estMin = Math.max(1, Math.round(durationMin * t.mult));
    const totalFare = Math.max(
      t.minFare,
      Math.round(t.baseFare + distanceKm * t.perKmRate + estMin * t.perMinRate)
    );
    fares[t.vehicleType] = {
      ...t,
      estimatedDurationMin: estMin,
      totalFare,
    };
  });

  const startNode = nodeMap.get(startId);
  const rankedDrivers = FALLBACK_DRIVERS.map((d) => {
    const dLat = ((d.currentLocation.lat - startNode.lat) * Math.PI) / 180;
    const dLng = ((d.currentLocation.lng - startNode.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((startNode.lat * Math.PI) / 180) *
        Math.cos((d.currentLocation.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const distToPickup = Number((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.22).toFixed(2));
    const score = Number((0.6 * distToPickup - 0.4 * d.rating).toFixed(4));
    return {
      ...d,
      distanceToPickupKm: distToPickup,
      etaToPickupMin: Math.max(2, Math.round(distToPickup * 2.5)),
      score,
      scoreBreakdown: `(0.6 × ${distToPickup}km) - (0.4 × ${d.rating}★) = ${score}`,
    };
  }).sort((a, b) => a.score - b.score);

  return {
    route: {
      startNode,
      endNode: nodeMap.get(endId),
      path,
      coordinates,
      distanceKm,
      durationMin,
      complexity: {
        time: 'O((V + E) log V)',
        space: 'O(V + E)',
        visitedNodesCount: visited.size,
      },
    },
    fares,
    dispatch: {
      optimalDriver: rankedDrivers[0],
      rankedDrivers,
      formula: 'Score = (0.6 * distanceKm) - (0.4 * driverRating)',
    },
  };
}

const VEHICLE_ICONS = {
  Moto: '🏍️',
  Auto: '🛺',
  Economy: '🚕',
  Premium: '🚘',
};

const RiderDashboard = () => {
  const [nodes, setNodes] = useState(FALLBACK_NODES);
  const [edges, setEdges] = useState(() => {
    const nodeMap = new Map(FALLBACK_NODES.map((n) => [n.id, n]));
    return FALLBACK_EDGE_LIST.map(([u, v, weightKm, durationMin]) => ({
      from: u,
      to: v,
      fromCoords: nodeMap.get(u).coords,
      toCoords: nodeMap.get(v).coords,
      weightKm,
      durationMin,
    }));
  });

  const [startNodeId, setStartNodeId] = useState('A1');
  const [endNodeId, setEndNodeId] = useState('A10');
  const [selectedVehicle, setSelectedVehicle] = useState('Economy');

  const [routeData, setRouteData] = useState(null);
  const [fares, setFares] = useState({});
  const [dispatchInfo, setDispatchInfo] = useState(null);
  const [calculating, setCalculating] = useState(false);

  // Active Ride State Machine
  const [activeRide, setActiveRide] = useState(null);
  const [dispatching, setDispatching] = useState(false);

  // 1. Load City Network Graph from GET /api/dsa/network
  useEffect(() => {
    const fetchNetwork = async () => {
      try {
        const res = await api.get('/dsa/network');
        if (res.data?.nodes?.length) {
          setNodes(res.data.nodes);
        }
        if (res.data?.edges?.length) {
          setEdges(res.data.edges);
        }
      } catch {
        // Fallback already populated
      }
    };
    fetchNetwork();
  }, []);

  // 2. Calculate Dijkstra Shortest Path & Dynamic Fares whenever nodes or vehicle change
  const computeRouteAndFares = useCallback(async () => {
    if (!startNodeId || !endNodeId) return;
    setCalculating(true);

    try {
      const res = await api.post('/dsa/route', {
        startNodeId,
        endNodeId,
        vehicleType: selectedVehicle,
      });

      if (res.data?.success) {
        setRouteData(res.data.route);
        setFares(res.data.fares);
        setDispatchInfo(res.data.dispatch);
        setCalculating(false);
        return;
      }
    } catch {
      // Fallback to identical client-side DSA engine if backend is offline
    }

    const fallback = computeClientSideFallback(
      startNodeId,
      endNodeId,
      selectedVehicle
    );
    setRouteData(fallback.route);
    setFares(fallback.fares);
    setDispatchInfo(fallback.dispatch);
    setCalculating(false);
  }, [startNodeId, endNodeId, selectedVehicle]);

  useEffect(() => {
    computeRouteAndFares();
  }, [computeRouteAndFares]);

  // 3. Handle Swap Pickup & Destination
  const handleSwapLocations = () => {
    setStartNodeId(endNodeId);
    setEndNodeId(startNodeId);
    setActiveRide(null);
  };

  // 4. Request Ride & Execute PriorityQueue DriverMatcher Dispatch
  const handleRequestRide = async () => {
    if (startNodeId === endNodeId) return;
    setDispatching(true);

    // Immediately show SEARCHING state
    setActiveRide({
      status: 'SEARCHING',
      vehicleType: selectedVehicle,
      pickupNode: startNodeId,
      destinationNode: endNodeId,
    });

    try {
      const res = await api.post('/dsa/dispatch', {
        startNodeId,
        endNodeId,
        vehicleType: selectedVehicle,
      });

      if (res.data?.success && res.data.ride) {
        setTimeout(() => {
          setActiveRide(res.data.ride);
          setDispatching(false);
        }, 650);
        return;
      }
    } catch {
      // Fallback simulation using local DriverMatcher result
    }

    const selectedTierFare = fares[selectedVehicle] || {
      totalFare: 145,
      estimatedDurationMin: routeData?.durationMin || 15,
    };

    const startNodeObj = nodes.find((n) => n.id === startNodeId);
    const endNodeObj = nodes.find((n) => n.id === endNodeId);

    setTimeout(() => {
      setActiveRide({
        rideId: `RIDE-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'ASSIGNED',
        otp: String(Math.floor(1000 + Math.random() * 9000)),
        vehicleType: selectedVehicle,
        pickup: {
          nodeId: startNodeId,
          address: startNodeObj?.name || startNodeId,
        },
        destination: {
          nodeId: endNodeId,
          address: endNodeObj?.name || endNodeId,
        },
        distanceKm: routeData?.distanceKm || 0,
        durationMin: selectedTierFare.estimatedDurationMin,
        fare: selectedTierFare.totalFare,
        path: routeData?.path || [],
        driver: dispatchInfo?.optimalDriver,
        rankedCandidates: dispatchInfo?.rankedDrivers || [],
      });
      setDispatching(false);
    }, 650);
  };

  const advanceRideStatus = () => {
    if (!activeRide) return;
    const order = ['ASSIGNED', 'ARRIVING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'];
    const idx = order.indexOf(activeRide.status);
    if (idx !== -1 && idx < order.length - 1) {
      setActiveRide({ ...activeRide, status: order[idx + 1] });
    }
  };

  const currentTierFare = fares[selectedVehicle];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top DSA Telemetry Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 block">
              Transit Network
            </span>
            <span className="text-lg font-bold text-white mt-0.5 block">
              {nodes.length} Nodes • {edges.length} Edges
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono">
            Adjacency List
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 block">
              Dijkstra Shortest Path
            </span>
            <span className="text-lg font-bold text-white mt-0.5 block">
              {routeData?.distanceKm ?? 0} km • ~{routeData?.durationMin ?? 0} min
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
            {routeData?.complexity?.time || 'O((V+E) log V)'}
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
              PriorityQueue Heap
            </span>
            <span className="text-lg font-bold text-white mt-0.5 block">
              Min-Heap O(log N)
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
            {routeData?.path?.length || 0} Hops
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
              Greedy Driver Match
            </span>
            <span className="text-sm font-bold text-white mt-0.5 block truncate max-w-[150px]">
              {dispatchInfo?.optimalDriver?.name || 'Ready'}
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
            Score: {dispatchInfo?.optimalDriver?.score ?? '—'}
          </span>
        </div>
      </div>

      {/* Main Two-Column Booking & Map Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Control Column: Node Selectors, Dynamic Fares, Request Ride */}
        <div className="lg:col-span-5 space-y-6">
          {/* Pickup & Destination Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white">
                  Route Planner (DSA Graph Nodes)
                </h2>
                <p className="text-xs text-slate-400">
                  Select intersections A1–A15 or click markers on the map
                </p>
              </div>
              <button
                type="button"
                onClick={handleSwapLocations}
                title="Swap Pickup and Destination"
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
              >
                ⇅ Swap
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="pickup-node-select"
                  className="block text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1.5"
                >
                  Pickup Intersection Node
                </label>
                <select
                  id="pickup-node-select"
                  value={startNodeId}
                  onChange={(e) => {
                    setStartNodeId(e.target.value);
                    setActiveRide(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                >
                  {nodes.map((node) => (
                    <option key={`pickup-${node.id}`} value={node.id}>
                      [{node.id}] {node.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="dest-node-select"
                  className="block text-xs font-semibold uppercase tracking-wider text-rose-400 mb-1.5"
                >
                  Destination Intersection Node
                </label>
                <select
                  id="dest-node-select"
                  value={endNodeId}
                  onChange={(e) => {
                    setEndNodeId(e.target.value);
                    setActiveRide(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
                >
                  {nodes.map((node) => (
                    <option key={`dest-${node.id}`} value={node.id}>
                      [{node.id}] {node.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dijkstra Path Breadcrumb */}
            {routeData?.path && routeData.path.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-semibold text-slate-300">
                    Optimal Dijkstra Traversal:
                  </span>
                  <span className="font-mono text-cyan-400">
                    {routeData.distanceKm} km total
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {routeData.path.map((nodeId, index) => (
                    <React.Fragment key={`${nodeId}-${index}`}>
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-bold font-mono ${
                          index === 0
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : index === routeData.path.length - 1
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}
                      >
                        {nodeId}
                      </span>
                      {index < routeData.path.length - 1 && (
                        <span className="text-slate-600 text-xs font-bold">→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dynamic Fare Cards (Moto, Auto, Economy, Premium) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Select Vehicle & Dynamic Fare
              </h3>
              <span className="text-xs text-slate-400">
                {calculating ? 'Recalculating...' : `${routeData?.distanceKm || 0} km trip`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {['Moto', 'Auto', 'Economy', 'Premium'].map((tierKey) => {
                const tier = fares[tierKey];
                const isSelected = selectedVehicle === tierKey;

                return (
                  <button
                    key={tierKey}
                    type="button"
                    onClick={() => setSelectedVehicle(tierKey)}
                    className={`text-left p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500 shadow-lg shadow-indigo-950/50'
                        : 'bg-slate-950/80 border-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{VEHICLE_ICONS[tierKey]}</span>
                        <div>
                          <span className="font-bold text-sm text-white block">
                            {tier?.label || `Aura ${tierKey}`}
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            {tier?.capacity || 4}{' '}
                            {tier?.capacity === 1 ? 'Seat' : 'Seats'} • ~
                            {tier?.estimatedDurationMin ?? routeData?.durationMin ?? 0} min
                          </span>
                        </div>
                      </div>
                      <span className="text-base font-extrabold text-cyan-300">
                        ₹{tier?.totalFare ?? '—'}
                      </span>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/70 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Base ₹{tier?.baseFare ?? 0}</span>
                      <span>₹{tier?.perKmRate ?? 0}/km</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Request Ride CTA */}
            <button
              type="button"
              disabled={dispatching || startNodeId === endNodeId}
              onClick={handleRequestRide}
              className="w-full mt-5 py-3.5 px-5 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/30 transition cursor-pointer flex items-center justify-center gap-2"
            >
              {startNodeId === endNodeId ? (
                <span>Select Different Pickup & Destination Nodes</span>
              ) : dispatching ? (
                <span>Executing PriorityQueue DriverMatcher...</span>
              ) : (
                <span>
                  Request {selectedVehicle} Ride • ₹
                  {currentTierFare?.totalFare ?? '—'}
                </span>
              )}
            </button>
          </div>

          {/* Active Dispatched Ride Status Card */}
          {activeRide && (
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/40 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 block">
                    Live Dispatch Status
                  </span>
                  <h4 className="text-lg font-bold text-white">
                    {activeRide.status === 'SEARCHING'
                      ? 'Scanning Online Drivers in Min-Heap...'
                      : `Status: ${activeRide.status}`}
                  </h4>
                </div>

                {activeRide.otp && (
                  <div className="px-3 py-1.5 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-300 font-mono text-sm font-bold">
                    OTP: {activeRide.otp}
                  </div>
                )}
              </div>

              {activeRide.driver && (
                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        {activeRide.driver.name}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[11px] font-bold">
                        Optimal Match [0]
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeRide.driver.vehicle?.model} •{' '}
                      <span className="text-cyan-300 font-mono">
                        {activeRide.driver.vehicle?.plateNumber}
                      </span>
                    </p>
                    <p className="text-[11px] text-indigo-300 font-mono mt-1">
                      Heuristic: {activeRide.driver.scoreBreakdown}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-amber-400 font-bold text-sm block">
                      ★ {activeRide.driver.rating}
                    </span>
                    <span className="text-xs text-slate-400 block">
                      {activeRide.driver.etaToPickupMin} min away
                    </span>
                  </div>
                </div>
              )}

              {activeRide.status !== 'SEARCHING' && (
                <div className="flex items-center gap-2 pt-1">
                  {activeRide.status !== 'COMPLETED' ? (
                    <button
                      type="button"
                      onClick={advanceRideStatus}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition cursor-pointer"
                    >
                      Simulate Next Step →
                    </button>
                  ) : (
                    <span className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold text-xs text-center">
                      ✓ Trip Completed! Fare ₹{activeRide.fare} Paid
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveRide(null)}
                    className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Interactive Leaflet Map & Greedy DriverMatcher Queue Table */}
        <div className="lg:col-span-7 space-y-6">
          <div className="h-[500px]">
            <MapView
              nodes={nodes}
              edges={edges}
              startNodeId={startNodeId}
              endNodeId={endNodeId}
              routePath={routeData?.path || []}
              routeCoordinates={routeData?.coordinates || []}
              drivers={dispatchInfo?.rankedDrivers || FALLBACK_DRIVERS}
              optimalDriver={dispatchInfo?.optimalDriver}
              onSelectPickup={(id) => {
                setStartNodeId(id);
                setActiveRide(null);
              }}
              onSelectDestination={(id) => {
                setEndNodeId(id);
                setActiveRide(null);
              }}
            />
          </div>

          {/* PriorityQueue DriverMatcher Leaderboard Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>PriorityQueue DriverMatcher Ranking</span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-[11px]">
                    Min-Heap Output
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Formula:{' '}
                  <code className="text-cyan-300 font-mono">
                    Score = (0.6 * distanceKm) - (0.4 * driverRating)
                  </code>
                </p>
              </div>
              <span className="text-xs text-slate-400">
                Optimal driver extracted at <strong className="text-white">index [0]</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3">Heap Index</th>
                    <th className="py-2.5 px-3">Driver & Vehicle</th>
                    <th className="py-2.5 px-3">Dist to {startNodeId}</th>
                    <th className="py-2.5 px-3">Rating</th>
                    <th className="py-2.5 px-3 text-right">Heuristic Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(dispatchInfo?.rankedDrivers || []).slice(0, 5).map((drv, idx) => (
                    <tr
                      key={drv.id || idx}
                      className={
                        idx === 0
                          ? 'bg-emerald-500/10 text-emerald-200 font-medium'
                          : 'text-slate-300'
                      }
                    >
                      <td className="py-2.5 px-3 font-mono">
                        {idx === 0 ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold">
                            [0] OPTIMAL
                          </span>
                        ) : (
                          `[${idx}]`
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-white">{drv.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {drv.vehicle?.model} ({drv.vehicle?.type})
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {drv.distanceToPickupKm} km (~{drv.etaToPickupMin}m)
                      </td>
                      <td className="py-2.5 px-3 text-amber-400 font-bold">
                        ★ {drv.rating}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-cyan-300">
                        {drv.score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiderDashboard;
