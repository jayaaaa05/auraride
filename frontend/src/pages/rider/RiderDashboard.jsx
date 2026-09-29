import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import MapView from '../../components/MapView';
import { useSocket } from '../../context/SocketContext';
import { runLocalBenchmarkFallback } from '../../components/AlgorithmBenchmarkModal';

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

function computeClientSideFallback(
  startId,
  endId,
  candidateDrivers = [],
  algorithm = 'dijkstra',
  simulatedDemand = 6
) {
  const bench = runLocalBenchmarkFallback(startId, endId, simulatedDemand);
  const nodeMap = new Map(FALLBACK_NODES.map((n) => [n.id, n]));
  const coordinates = bench.optimalPath
    .map((id) => nodeMap.get(id)?.coords)
    .filter(Boolean);

  const surgeMult = bench.surge.multiplier;

  const tierSpecs = [
    { vehicleType: 'Moto', label: 'Aura Moto', tagline: 'Beat city traffic • 1 Rider', capacity: 1, baseFare: 25, perKmRate: 9.5, perMinRate: 1.0, minFare: 35, mult: 0.82 },
    { vehicleType: 'Auto', label: 'Aura Auto', tagline: 'Doorstep 3-wheeler • 3 Seats', capacity: 3, baseFare: 35, perKmRate: 13.5, perMinRate: 1.25, minFare: 50, mult: 1.0 },
    { vehicleType: 'Economy', label: 'Aura Economy', tagline: 'AC Hatchback • 4 Seats', capacity: 4, baseFare: 55, perKmRate: 17.0, perMinRate: 1.5, minFare: 80, mult: 0.95 },
    { vehicleType: 'Premium', label: 'Aura Premium', tagline: 'Executive EV & Sedan • 4 Seats', capacity: 4, baseFare: 95, perKmRate: 24.5, perMinRate: 2.2, minFare: 140, mult: 0.9 },
  ];

  const fares = {};
  tierSpecs.forEach((t) => {
    const estMin = Math.max(1, Math.round(bench.durationMin * t.mult));
    const baseSubtotal = Math.round(
      t.baseFare + bench.distanceKm * t.perKmRate + estMin * t.perMinRate
    );
    const totalFare = Math.max(t.minFare, Math.round(baseSubtotal * surgeMult));
    fares[t.vehicleType] = {
      ...t,
      baseSubtotal,
      surgeMultiplier: surgeMult,
      estimatedDurationMin: estMin,
      totalFare,
    };
  });

  const startNode = nodeMap.get(startId);
  const rankedDrivers = candidateDrivers
    .filter((d) => !d.isBlocked)
    .map((d) => {
      const loc = d.currentLocation || { lat: 12.9689, lng: 77.6194 };
      const dLat = ((loc.lat - startNode.lat) * Math.PI) / 180;
      const dLng = ((loc.lng - startNode.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((startNode.lat * Math.PI) / 180) *
          Math.cos((loc.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      const distToPickup = Number(
        (6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.22).toFixed(2)
      );
      const score = Number((0.6 * distToPickup - 0.4 * (d.rating || 4.9)).toFixed(4));
      return {
        ...d,
        distanceToPickupKm: distToPickup,
        etaToPickupMin: Math.max(2, Math.round(distToPickup * 2.5)),
        score,
        scoreBreakdown: `(0.6 × ${distToPickup}km) - (0.4 × ${d.rating}★) = ${score}`,
      };
    })
    .sort((a, b) => a.score - b.score);

  const isAStar = String(algorithm).toLowerCase() === 'astar';

  return {
    route: {
      startNode,
      endNode: nodeMap.get(endId),
      path: bench.optimalPath,
      coordinates,
      distanceKm: bench.distanceKm,
      durationMin: bench.durationMin,
      complexity: {
        time: isAStar
          ? 'O(E) best-case with Euclidean heuristic'
          : 'O((V + E) log V)',
        space: 'O(V + E)',
        visitedNodesCount: isAStar
          ? bench.aStarNodesVisited
          : bench.dijkstraNodesVisited,
      },
    },
    surge: bench.surge,
    benchmark: bench,
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

const RiderDashboard = ({ onOpenBenchmarkLab }) => {
  const {
    liveDrivers,
    activeRide,
    setActiveRide,
    lastReceipt,
    setLastReceipt,
    setActivePortal,
    requestRideRealtime,
    acceptRideOffer,
    cancelActiveRide,
  } = useSocket();

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

  // Capstone Controls: Route Algorithm ('dijkstra' vs 'astar') & High-Demand Surge Toggle
  const [routeAlgorithm, setRouteAlgorithm] = useState('astar');
  const [highDemandMode, setHighDemandMode] = useState(true);

  const [routeData, setRouteData] = useState(null);
  const [surgeData, setSurgeData] = useState(null);
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [fares, setFares] = useState({});
  const [dispatchInfo, setDispatchInfo] = useState(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    const fetchNetwork = async () => {
      try {
        const res = await api.get('/dsa/network');
        if (res.data?.nodes?.length) setNodes(res.data.nodes);
        if (res.data?.edges?.length) setEdges(res.data.edges);
      } catch {
        // Fallback already populated
      }
    };
    fetchNetwork();
  }, []);

  const computeRouteAndFares = useCallback(async () => {
    if (!startNodeId || !endNodeId) return;
    setCalculating(true);

    const simulatedDemand = highDemandMode ? 6 : 0;

    try {
      const res = await api.post('/dsa/route', {
        startNodeId,
        endNodeId,
        vehicleType: selectedVehicle,
        algorithm: routeAlgorithm,
        simulatedDemand,
      });

      if (res.data?.success) {
        setRouteData(res.data.route);
        setSurgeData(res.data.surge);
        setBenchmarkData(res.data.benchmark);
        setFares(res.data.fares);
        setDispatchInfo(res.data.dispatch);
        setCalculating(false);
        return;
      }
    } catch {
      // Fallback to identical client-side engine
    }

    const fallback = computeClientSideFallback(
      startNodeId,
      endNodeId,
      liveDrivers,
      routeAlgorithm,
      simulatedDemand
    );
    setRouteData(fallback.route);
    setSurgeData(fallback.surge);
    setBenchmarkData(fallback.benchmark);
    setFares(fallback.fares);
    setDispatchInfo(fallback.dispatch);
    setCalculating(false);
  }, [startNodeId, endNodeId, selectedVehicle, routeAlgorithm, highDemandMode, liveDrivers]);

  useEffect(() => {
    computeRouteAndFares();
  }, [computeRouteAndFares]);

  const handleSwapLocations = () => {
    setStartNodeId(endNodeId);
    setEndNodeId(startNodeId);
  };

  const handleRequestRide = () => {
    if (startNodeId === endNodeId) return;
    const selectedTierFare = fares[selectedVehicle] || {
      totalFare: 165,
      estimatedDurationMin: routeData?.durationMin || 16,
    };

    const startNodeObj = nodes.find((n) => n.id === startNodeId);
    const endNodeObj = nodes.find((n) => n.id === endNodeId);

    requestRideRealtime({
      pickupNodeId: startNodeId,
      destinationNodeId: endNodeId,
      pickup: {
        nodeId: startNodeId,
        address: startNodeObj?.name || startNodeId,
        lat: startNodeObj?.lat || 12.9756,
        lng: startNodeObj?.lng || 77.6066,
      },
      destination: {
        nodeId: endNodeId,
        address: endNodeObj?.name || endNodeId,
        lat: endNodeObj?.lat || 12.9121,
        lng: endNodeObj?.lng || 77.6446,
      },
      distanceKm: routeData?.distanceKm || 6.4,
      durationMin: selectedTierFare.estimatedDurationMin,
      fare: selectedTierFare.totalFare,
      vehicleType: selectedVehicle,
      algorithmUsed: routeAlgorithm === 'astar' ? 'A*' : 'Dijkstra',
      surgeMultiplier: surgeData?.multiplier || 1.0,
      path: routeData?.path || ['A1', 'A6', 'A8', 'A9', 'A10'],
      coordinates: routeData?.coordinates || [],
      optimalDriver: dispatchInfo?.optimalDriver,
      rankedCandidates: dispatchInfo?.rankedDrivers,
    });
  };

  const currentTierFare = fares[selectedVehicle];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top DSA Telemetry Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 block">
              Active Route Engine
            </span>
            <span className="text-lg font-bold text-white mt-0.5 block">
              {routeAlgorithm === 'astar' ? 'A* Euclidean Search' : 'Dijkstra Min-Heap'}
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-bold">
            {routeAlgorithm === 'astar'
              ? `${benchmarkData?.aStarNodesVisited ?? 5} Nodes`
              : `${benchmarkData?.dijkstraNodesVisited ?? 11} Nodes`}
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 block">
              Dijkstra vs A* Savings
            </span>
            <span className="text-lg font-bold text-white mt-0.5 block">
              {benchmarkData?.nodeReductionPercent ?? 45}% Fewer Nodes
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenBenchmarkLab}
            className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-bold transition cursor-pointer"
          >
            🔬 Open Lab
          </button>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
              Spatial Indexing
            </span>
            <span className="text-lg font-bold text-white mt-0.5 block">
              2D QuadTree O(log N)
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
            NW•NE•SW•SE
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
              Dynamic Surge Multiplier
            </span>
            <span className="text-sm font-bold text-white mt-0.5 block">
              {surgeData?.badgeText || '⚡ 1.42x Peak Surge Applied'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setHighDemandMode((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
              highDemandMode
                ? 'bg-amber-400 text-slate-950'
                : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}
          >
            {highDemandMode ? 'Peak ON' : 'Normal'}
          </button>
        </div>
      </div>

      {/* Main Two-Column Booking & Map Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Control Column */}
        <div className="lg:col-span-5 space-y-6">
          {/* Pickup, Destination & Route Algorithm Toggle Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">
                  Route Planner & Algorithm Selector
                </h2>
                <p className="text-xs text-slate-400">
                  Compare Dijkstra vs A* Search in real time
                </p>
              </div>
              <button
                type="button"
                onClick={handleSwapLocations}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
              >
                ⇅ Swap
              </button>
            </div>

            {/* Route Algorithm Toggle: Dijkstra vs A* */}
            <div className="p-1.5 bg-slate-950 rounded-xl border border-slate-800 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setRouteAlgorithm('dijkstra')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-between ${
                  routeAlgorithm === 'dijkstra'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Dijkstra O((V+E) log V)</span>
                <span className="font-mono text-[11px] opacity-90">
                  {benchmarkData?.dijkstraNodesVisited ?? 11}v
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRouteAlgorithm('astar')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-between ${
                  routeAlgorithm === 'astar'
                    ? 'bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>A* Heuristic O(E)</span>
                <span className="font-mono text-[11px] opacity-90">
                  {benchmarkData?.aStarNodesVisited ?? 5}v
                </span>
              </button>
            </div>

            {/* Real-Time Algorithm Telemetry Pill */}
            <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/90 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400">Nodes Evaluated: </span>
                <strong className="text-white font-mono">
                  {routeAlgorithm === 'astar'
                    ? `${benchmarkData?.aStarNodesVisited ?? 5} (A*)`
                    : `${benchmarkData?.dijkstraNodesVisited ?? 11} (Dijkstra)`}
                </strong>
              </div>
              <div>
                <span className="text-slate-400">Exec: </span>
                <strong className="text-emerald-400 font-mono">
                  {routeAlgorithm === 'astar'
                    ? `${benchmarkData?.aStarTimeMs ?? 0.24} ms`
                    : `${benchmarkData?.dijkstraTimeMs ?? 0.62} ms`}
                </strong>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="pickup-node-select"
                  className="block text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1"
                >
                  Pickup Intersection Node
                </label>
                <select
                  id="pickup-node-select"
                  value={startNodeId}
                  onChange={(e) => setStartNodeId(e.target.value)}
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
                  className="block text-xs font-semibold uppercase tracking-wider text-rose-400 mb-1"
                >
                  Destination Intersection Node
                </label>
                <select
                  id="dest-node-select"
                  value={endNodeId}
                  onChange={(e) => setEndNodeId(e.target.value)}
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

            {/* Optimal Path Breadcrumb */}
            {routeData?.path && routeData.path.length > 0 && (
              <div className="pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-semibold text-slate-300">
                    Optimal {routeAlgorithm === 'astar' ? 'A*' : 'Dijkstra'} Path:
                  </span>
                  <span className="font-mono text-cyan-400">
                    {routeData.distanceKm} km • ~{routeData.durationMin} min
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

          {/* Dynamic Fare Cards with Surge Pricing Banner */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Select Vehicle & Dynamic Fare
              </h3>

              {/* Surge Pricing Tag */}
              {surgeData?.isPeak ? (
                <span className="px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-300 text-xs font-extrabold flex items-center gap-1">
                  <span>{surgeData.badgeText}</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                  1.0x Standard Rate
                </span>
              )}
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
                      <div className="text-right">
                        <span className="text-base font-extrabold text-cyan-300 block">
                          ₹{tier?.totalFare ?? '—'}
                        </span>
                        {surgeData?.isPeak && tier?.baseSubtotal && (
                          <span className="text-[10px] text-slate-500 line-through font-mono block">
                            ₹{tier.baseSubtotal}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/70 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Base ₹{tier?.baseFare ?? 0}</span>
                      <span>
                        {surgeData?.multiplier > 1
                          ? `${surgeData.multiplier}x Surge`
                          : `₹${tier?.perKmRate ?? 0}/km`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={startNodeId === endNodeId}
              onClick={handleRequestRide}
              className="w-full mt-3 py-3.5 px-5 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/30 transition cursor-pointer flex items-center justify-center gap-2"
            >
              {startNodeId === endNodeId ? (
                <span>Select Different Pickup & Destination Nodes</span>
              ) : (
                <span>
                  Request {selectedVehicle} Ride • ₹
                  {currentTierFare?.totalFare ?? '—'}
                </span>
              )}
            </button>
          </div>

          {/* Live Active Ride & Real-Time OTP / Driver Telemetry Card */}
          {activeRide && (
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/50 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 block">
                    Live Socket.IO Ride Session • {activeRide.rideId}
                  </span>
                  <h4 className="text-lg font-bold text-white">
                    Status: {activeRide.status}
                  </h4>
                </div>

                {activeRide.otp && (
                  <div className="px-3.5 py-1.5 rounded-xl bg-amber-400/20 border border-amber-400/50 text-amber-300 font-mono text-sm font-extrabold">
                    Rider PIN: {activeRide.otp}
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
                        QuadTree + Heap [0]
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeRide.driver.vehicle?.model} •{' '}
                      <span className="text-cyan-300 font-mono">
                        {activeRide.driver.vehicle?.plateNumber}
                      </span>
                    </p>
                    {activeRide.currentDriverNode && (
                      <p className="text-xs text-indigo-300 font-semibold mt-1">
                        Live Position: Node [{activeRide.currentDriverNode}]{' '}
                        {activeRide.nextNodeId
                          ? `→ Next: [${activeRide.nextNodeId}]`
                          : ''}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-amber-400 font-bold text-sm block">
                      ★ {activeRide.driver.rating}
                    </span>
                    <span className="text-xs text-emerald-400 font-bold block">
                      ₹{activeRide.fare}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {activeRide.status === 'REQUESTED' && (
                  <button
                    type="button"
                    onClick={() => acceptRideOffer(activeRide)}
                    className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition cursor-pointer"
                  >
                    ⚡ Instant Driver Accept
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActivePortal('driver')}
                  className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer"
                >
                  Open Driver Console (Verify OTP) →
                </button>

                {activeRide.status !== 'COMPLETED' && (
                  <button
                    type="button"
                    onClick={() =>
                      cancelActiveRide('rider', 'Cancelled by passenger')
                    }
                    className="py-2.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-xs transition cursor-pointer"
                  >
                    Cancel Ride
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Completed Trip Receipt Modal/Card */}
          {lastReceipt && (
            <div className="bg-emerald-950/30 border border-emerald-500/50 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-extrabold text-xs uppercase">
                  Trip Receipt
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setLastReceipt(null);
                    setActiveRide(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Dismiss ✕
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-base">
                    Paid ₹{lastReceipt.fare} to {lastReceipt.driverName}
                  </h4>
                  <p className="text-xs text-slate-300">
                    [{lastReceipt.pickup?.nodeId}] {lastReceipt.pickup?.address} → [
                    {lastReceipt.destination?.nodeId}]{' '}
                    {lastReceipt.destination?.address}
                  </p>
                </div>
                <span className="font-mono text-emerald-300 font-extrabold text-lg">
                  ✓ PAID
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Map & Greedy DriverMatcher Table */}
        <div className="lg:col-span-7 space-y-6">
          <div className="h-[500px]">
            <MapView
              nodes={nodes}
              edges={edges}
              startNodeId={startNodeId}
              endNodeId={endNodeId}
              routePath={routeData?.path || []}
              routeCoordinates={routeData?.coordinates || []}
              drivers={dispatchInfo?.rankedDrivers || liveDrivers}
              optimalDriver={dispatchInfo?.optimalDriver}
              onSelectPickup={(id) => setStartNodeId(id)}
              onSelectDestination={(id) => setEndNodeId(id)}
            />
          </div>

          {/* PriorityQueue DriverMatcher + QuadTree Leaderboard Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>QuadTree + PriorityQueue DriverMatcher Ranking</span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-[11px]">
                    O(log N) Spatial + Min-Heap
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
                Optimal driver extracted at{' '}
                <strong className="text-white">index [0]</strong>
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
