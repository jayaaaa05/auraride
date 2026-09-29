const { cityGraph } = require('../dsa/Graph');
const { findShortestPath } = require('../dsa/Dijkstra');
const { findAStarPath } = require('../dsa/AStar');
const { QuadTree } = require('../dsa/QuadTree');
const { surgePricingEngine } = require('../dsa/SurgePricing');
const { runAlgorithmBenchmark } = require('../dsa/Benchmark');
const {
  matchDrivers,
  DEFAULT_SIMULATED_DRIVERS,
} = require('../dsa/DriverMatcher');
const {
  incrementDsaQueryCount,
  liveState,
} = require('../socket/socketHandler');
const Driver = require('../models/Driver');

/**
 * Dynamic pricing formulas across the 4 AuraRide vehicle tiers.
 */
const FARE_TIERS = {
  Moto: {
    vehicleType: 'Moto',
    label: 'Aura Moto',
    tagline: 'Beat city traffic • 1 Rider',
    capacity: 1,
    baseFare: 25,
    perKmRate: 9.5,
    perMinRate: 1.0,
    minFare: 35,
    speedMultiplier: 0.82,
  },
  Auto: {
    vehicleType: 'Auto',
    label: 'Aura Auto',
    tagline: 'Doorstep 3-wheeler • 3 Seats',
    capacity: 3,
    baseFare: 35,
    perKmRate: 13.5,
    perMinRate: 1.25,
    minFare: 50,
    speedMultiplier: 1.0,
  },
  Economy: {
    vehicleType: 'Economy',
    label: 'Aura Economy',
    tagline: 'AC Hatchback • 4 Seats',
    capacity: 4,
    baseFare: 55,
    perKmRate: 17.0,
    perMinRate: 1.5,
    minFare: 80,
    speedMultiplier: 0.95,
  },
  Premium: {
    vehicleType: 'Premium',
    label: 'Aura Premium',
    tagline: 'Executive EV & Sedan • 4 Seats',
    capacity: 4,
    baseFare: 95,
    perKmRate: 24.5,
    perMinRate: 2.2,
    minFare: 140,
    speedMultiplier: 0.9,
  },
};

/**
 * Computes dynamic fare breakdown for all vehicle tiers incorporating SurgePricing multiplier.
 */
const computeFaresForRoute = (distanceKm, durationMin, surgeMultiplier = 1.0) => {
  const fares = {};

  Object.values(FARE_TIERS).forEach((tier) => {
    const adjustedDurationMin = Math.max(
      1,
      Math.round(durationMin * tier.speedMultiplier)
    );
    const distanceCharge = distanceKm * tier.perKmRate;
    const timeCharge = adjustedDurationMin * tier.perMinRate;
    const baseSubtotal = tier.baseFare + distanceCharge + timeCharge;
    const rawTotal = baseSubtotal * surgeMultiplier;
    const totalFare = Math.max(tier.minFare, Math.round(rawTotal));

    fares[tier.vehicleType] = {
      vehicleType: tier.vehicleType,
      label: tier.label,
      tagline: tier.tagline,
      capacity: tier.capacity,
      baseFare: tier.baseFare,
      perKmRate: tier.perKmRate,
      perMinRate: tier.perMinRate,
      distanceCharge: Number(distanceCharge.toFixed(2)),
      timeCharge: Number(timeCharge.toFixed(2)),
      baseSubtotal: Math.round(baseSubtotal),
      surgeMultiplier,
      estimatedDurationMin: adjustedDurationMin,
      totalFare,
      currency: 'INR',
    };
  });

  return fares;
};

// @desc    Get full 15-node city network graph, edges, congestion levels, and active simulated drivers
// @route   GET /api/dsa/network
// @access  Public
const getNetworkGraph = async (req, res) => {
  try {
    const nodes = cityGraph.getAllNodes();
    const edges = cityGraph.getAllEdges();
    const nodeCongestion = surgePricingEngine.getAllNodesCongestion();

    return res.status(200).json({
      success: true,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes,
      edges,
      nodeCongestion,
      drivers: Array.from(liveState.drivers.values()),
    });
  } catch (error) {
    console.error('Error fetching DSA network graph:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load city network graph',
    });
  }
};

// @desc    Calculate shortest path using Dijkstra or A*, incorporate SurgePricing & QuadTree spatial matching
// @route   POST /api/dsa/route
// @access  Public
const calculateRoute = async (req, res) => {
  try {
    const {
      startNodeId,
      endNodeId,
      vehicleType = 'Economy',
      algorithm = 'dijkstra',
      simulatedDemand,
      forcePeak,
    } = req.body;

    if (!startNodeId || !endNodeId) {
      return res.status(400).json({
        success: false,
        message:
          'Both startNodeId and endNodeId are required (e.g. "A1" and "A10").',
      });
    }

    incrementDsaQueryCount();

    // Run both algorithms via Benchmark module so UI has instant comparison stats
    const benchmarkData = runAlgorithmBenchmark(startNodeId, endNodeId, {
      iterations: 250,
      simulatedDemand,
    });

    const useAStar = String(algorithm).toLowerCase() === 'astar' || String(algorithm).toLowerCase() === 'a*';
    const pathResult = useAStar
      ? findAStarPath(startNodeId, endNodeId, cityGraph)
      : findShortestPath(startNodeId, endNodeId, cityGraph);

    if (!pathResult.found) {
      return res.status(404).json({
        success: false,
        message: `No valid route found between ${startNodeId} and ${endNodeId}.`,
      });
    }

    // Calculate Surge Pricing Multiplier
    const surgeInfo = surgePricingEngine.calculateSurge(startNodeId, {
      simulatedDemand,
      forcePeak,
    });

    const faresByVehicle = computeFaresForRoute(
      pathResult.distanceKm,
      pathResult.durationMin,
      surgeInfo.multiplier
    );

    const selectedTier = faresByVehicle[vehicleType] || faresByVehicle.Economy;

    // Spatial QuadTree Indexing + Greedy Min-Heap DriverMatcher
    const activeDrivers = Array.from(liveState.drivers.values()).filter(
      (d) => d.isOnline !== false && !d.isBlocked
    );
    const fleetPool =
      activeDrivers.length > 0 ? activeDrivers : DEFAULT_SIMULATED_DRIVERS;

    const startNode = cityGraph.getNode(startNodeId);
    const quadTree = new QuadTree();
    fleetPool.forEach((drv) => quadTree.insert(drv));
    const spatialMatches = quadTree.queryRadius(startNode.coords, 6.5);

    const candidatePool =
      spatialMatches.drivers.length > 0 ? spatialMatches.drivers : fleetPool;

    const dispatchMatch = matchDrivers(
      startNode.coords,
      candidatePool,
      vehicleType
    );

    return res.status(200).json({
      success: true,
      algorithmUsed: useAStar ? 'A*' : 'Dijkstra',
      route: {
        startNode: cityGraph.getNode(startNodeId),
        endNode: cityGraph.getNode(endNodeId),
        path: pathResult.path,
        nodes: pathResult.nodes,
        coordinates: pathResult.coordinates,
        distanceKm: pathResult.distanceKm,
        durationMin: pathResult.durationMin,
        segments: pathResult.segments,
        complexity: pathResult.complexity,
      },
      surge: surgeInfo,
      benchmark: benchmarkData,
      spatialTelemetry: spatialMatches.telemetry,
      selectedVehicle: vehicleType,
      selectedFare: selectedTier,
      fares: faresByVehicle,
      dispatch: {
        optimalDriver: dispatchMatch.optimalDriver,
        rankedDrivers: dispatchMatch.rankedDrivers,
        formula: dispatchMatch.formula,
      },
    });
  } catch (error) {
    console.error('Error calculating route:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Route calculation failed',
    });
  }
};

// @desc    Execute side-by-side Dijkstra vs A* performance benchmark
// @route   POST /api/dsa/benchmark
// @access  Public
const executeBenchmark = async (req, res) => {
  try {
    const startId = req.body.startNode || req.body.startNodeId || 'A1';
    const endId = req.body.endNode || req.body.endNodeId || 'A10';
    const iterations = req.body.iterations || 500;
    const simulatedDemand = req.body.simulatedDemand;

    incrementDsaQueryCount();
    const results = runAlgorithmBenchmark(startId, endId, {
      iterations,
      simulatedDemand,
    });

    return res.status(200).json({
      success: true,
      benchmark: results,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Benchmark execution failed',
    });
  }
};

// @desc    Query nearby online drivers using 2D QuadTree spatial indexing O(log N + K)
// @route   GET /api/dsa/spatial-drivers
// @access  Public
const getSpatialDrivers = async (req, res) => {
  try {
    const { nodeId = 'A1', lat, lng, radiusKm = 5.5 } = req.query;
    const refNode = cityGraph.getNode(nodeId) || cityGraph.getNode('A1');

    const centerCoords = {
      lat: lat !== undefined ? Number(lat) : refNode.lat,
      lng: lng !== undefined ? Number(lng) : refNode.lng,
    };

    const quadTree = new QuadTree();
    const allDrivers = Array.from(liveState.drivers.values()).filter(
      (d) => d.isOnline !== false && !d.isBlocked
    );

    allDrivers.forEach((drv) => quadTree.insert(drv));

    const queryResult = quadTree.queryRadius(centerCoords, Number(radiusKm));
    const treeMetadata = quadTree.getTreeMetadata();

    return res.status(200).json({
      success: true,
      center: centerCoords,
      radiusKm: Number(radiusKm),
      count: queryResult.drivers.length,
      drivers: queryResult.drivers,
      quadTreeTelemetry: {
        ...queryResult.telemetry,
        ...treeMetadata,
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'QuadTree spatial query failed',
    });
  }
};

// @desc    Execute PriorityQueue DriverMatcher and create ride dispatch
// @route   POST /api/dsa/dispatch
// @access  Public
const dispatchRide = async (req, res) => {
  try {
    const {
      startNodeId,
      endNodeId,
      vehicleType = 'Economy',
      algorithm = 'dijkstra',
      simulatedDemand,
    } = req.body;

    if (!startNodeId || !endNodeId) {
      return res.status(400).json({
        success: false,
        message: 'startNodeId and endNodeId are required to dispatch a ride.',
      });
    }

    incrementDsaQueryCount();
    surgePricingEngine.recordDemand(startNodeId);

    const useAStar = String(algorithm).toLowerCase() === 'astar';
    const routeResult = useAStar
      ? findAStarPath(startNodeId, endNodeId, cityGraph)
      : findShortestPath(startNodeId, endNodeId, cityGraph);

    const surgeInfo = surgePricingEngine.calculateSurge(startNodeId, {
      simulatedDemand,
    });

    const fares = computeFaresForRoute(
      routeResult.distanceKm,
      routeResult.durationMin,
      surgeInfo.multiplier
    );
    const selectedFare = fares[vehicleType] || fares.Economy;

    const startNode = cityGraph.getNode(startNodeId);
    const endNode = cityGraph.getNode(endNodeId);

    const dispatchMatch = matchDrivers(
      startNode.coords,
      Array.from(liveState.drivers.values()),
      vehicleType
    );

    const otp = String(Math.floor(1000 + Math.random() * 9000));

    return res.status(200).json({
      success: true,
      message: 'Driver matched via QuadTree + Greedy PriorityQueue Dispatch',
      ride: {
        rideId: `RIDE-${Date.now().toString().slice(-6)}`,
        status: 'ASSIGNED',
        otp,
        vehicleType,
        algorithmUsed: useAStar ? 'A*' : 'Dijkstra',
        surgeMultiplier: surgeInfo.multiplier,
        pickup: {
          nodeId: startNode.id,
          address: startNode.name,
          lat: startNode.lat,
          lng: startNode.lng,
        },
        destination: {
          nodeId: endNode.id,
          address: endNode.name,
          lat: endNode.lat,
          lng: endNode.lng,
        },
        distanceKm: routeResult.distanceKm,
        durationMin: selectedFare.estimatedDurationMin,
        fare: selectedFare.totalFare,
        path: routeResult.path,
        coordinates: routeResult.coordinates,
        driver: dispatchMatch.optimalDriver,
        rankedCandidates: dispatchMatch.rankedDrivers,
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Ride dispatch failed',
    });
  }
};

module.exports = {
  getNetworkGraph,
  calculateRoute,
  executeBenchmark,
  getSpatialDrivers,
  dispatchRide,
};
