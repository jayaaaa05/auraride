const { cityGraph } = require('../dsa/Graph');
const { findShortestPath } = require('../dsa/Dijkstra');
const { matchDrivers, DEFAULT_SIMULATED_DRIVERS } = require('../dsa/DriverMatcher');
const { incrementDsaQueryCount } = require('../socket/socketHandler');
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
    speedMultiplier: 0.82, // Faster in urban traffic
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
 * Computes dynamic fare breakdown for all vehicle tiers given distanceKm and durationMin.
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
    const rawTotal = (tier.baseFare + distanceCharge + timeCharge) * surgeMultiplier;
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
      surgeMultiplier,
      estimatedDurationMin: adjustedDurationMin,
      totalFare,
      currency: 'INR',
    };
  });

  return fares;
};

// @desc    Get full 15-node city network graph, edges, and active simulated drivers
// @route   GET /api/dsa/network
// @access  Public
const getNetworkGraph = async (req, res) => {
  try {
    const nodes = cityGraph.getAllNodes();
    const edges = cityGraph.getAllEdges();

    return res.status(200).json({
      success: true,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes,
      edges,
      drivers: DEFAULT_SIMULATED_DRIVERS,
    });
  } catch (error) {
    console.error('Error fetching DSA network graph:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load city network graph',
    });
  }
};

// @desc    Calculate shortest path using Dijkstra, dynamic fares, and greedy driver match
// @route   POST /api/dsa/route
// @access  Public
const calculateRoute = async (req, res) => {
  try {
    const {
      startNodeId,
      endNodeId,
      vehicleType = 'Economy',
    } = req.body;

    if (!startNodeId || !endNodeId) {
      return res.status(400).json({
        success: false,
        message: 'Both startNodeId and endNodeId are required (e.g. "A1" and "A10").',
      });
    }

    incrementDsaQueryCount();
    const dijkstraResult = findShortestPath(startNodeId, endNodeId, cityGraph);

    if (!dijkstraResult.found) {
      return res.status(404).json({
        success: false,
        message: `No valid route found between ${startNodeId} and ${endNodeId}.`,
      });
    }

    const faresByVehicle = computeFaresForRoute(
      dijkstraResult.distanceKm,
      dijkstraResult.durationMin
    );

    const selectedTier = faresByVehicle[vehicleType] || faresByVehicle.Economy;

    // Fetch online DB drivers if available and combine with simulated drivers for greedy matching
    let dbDrivers = [];
    try {
      dbDrivers = await Driver.find({ isOnline: true }).populate(
        'user',
        'name phone email'
      );
    } catch {
      dbDrivers = [];
    }

    const combinedDrivers = [...dbDrivers, ...DEFAULT_SIMULATED_DRIVERS];
    const startNode = cityGraph.getNode(startNodeId);
    const dispatchMatch = matchDrivers(
      startNode.coords,
      combinedDrivers,
      vehicleType
    );

    return res.status(200).json({
      success: true,
      route: {
        startNode: cityGraph.getNode(startNodeId),
        endNode: cityGraph.getNode(endNodeId),
        path: dijkstraResult.path,
        nodes: dijkstraResult.nodes,
        coordinates: dijkstraResult.coordinates,
        distanceKm: dijkstraResult.distanceKm,
        durationMin: dijkstraResult.durationMin,
        segments: dijkstraResult.segments,
        complexity: dijkstraResult.complexity,
      },
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
    console.error('Error calculating Dijkstra route:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Route calculation failed',
    });
  }
};

// @desc    Execute PriorityQueue DriverMatcher and simulate/create ride dispatch
// @route   POST /api/dsa/dispatch
// @access  Public
const dispatchRide = async (req, res) => {
  try {
    const { startNodeId, endNodeId, vehicleType = 'Economy' } = req.body;

    if (!startNodeId || !endNodeId) {
      return res.status(400).json({
        success: false,
        message: 'startNodeId and endNodeId are required to dispatch a ride.',
      });
    }

    const dijkstraResult = findShortestPath(startNodeId, endNodeId, cityGraph);
    const fares = computeFaresForRoute(
      dijkstraResult.distanceKm,
      dijkstraResult.durationMin
    );
    const selectedFare = fares[vehicleType] || fares.Economy;

    const startNode = cityGraph.getNode(startNodeId);
    const endNode = cityGraph.getNode(endNodeId);

    const dispatchMatch = matchDrivers(
      startNode.coords,
      DEFAULT_SIMULATED_DRIVERS,
      vehicleType
    );

    const otp = String(Math.floor(1000 + Math.random() * 9000));

    return res.status(200).json({
      success: true,
      message: 'Driver matched via Greedy PriorityQueue Dispatch',
      ride: {
        rideId: `RIDE-${Date.now().toString().slice(-6)}`,
        status: 'ASSIGNED',
        otp,
        vehicleType,
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
        distanceKm: dijkstraResult.distanceKm,
        durationMin: selectedFare.estimatedDurationMin,
        fare: selectedFare.totalFare,
        path: dijkstraResult.path,
        coordinates: dijkstraResult.coordinates,
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
  dispatchRide,
};
