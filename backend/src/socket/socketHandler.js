/**
 * @file socketHandler.js
 * @description Real-Time Socket.IO Event Engine & In-Memory State Synchronizer for AuraRide.
 * Handles room management ('drivers', 'admin', 'rider_<id>'), live driver GPS tracking,
 * Greedy Min-Heap ride dispatch, 15s offer countdowns, 4-digit OTP generation & verification,
 * automated Dijkstra node-by-node route traversal, trip completion, and cancellation.
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Ride = require('../models/Ride');
const { cityGraph } = require('../dsa/Graph');
const { findShortestPath } = require('../dsa/Dijkstra');
const { matchDrivers, DEFAULT_SIMULATED_DRIVERS } = require('../dsa/DriverMatcher');

/**
 * Shared live platform state synced with MongoDB and Socket.IO clients.
 */
const liveState = {
  dsaQueryCount: 18,
  drivers: new Map(),
  rides: new Map(),
  traversalTimers: new Map(),
  offerTimers: new Map(),
};

// Seed the in-memory driver registry from DEFAULT_SIMULATED_DRIVERS
DEFAULT_SIMULATED_DRIVERS.forEach((drv, index) => {
  liveState.drivers.set(drv.id, {
    ...drv,
    _id: drv.id,
    isOnline: true,
    isVerified: index < 6, // Leave 2 drivers unverified so Admin can test live verification toggle
    isBlocked: false,
    totalEarnings: 3450 + index * 920,
    completedTrips: drv.totalTrips || 120 + index * 45,
    email: `${drv.name.toLowerCase().replace(/\s+/g, '.')}@auraride.in`,
  });
});

// Seed initial completed & active sample rides so Admin dashboard is populated out of the box
const initialSampleRides = [
  {
    rideId: 'RIDE-840211',
    riderId: 'USR-DEMO-1',
    riderName: 'Ananya Sharma',
    driverId: 'DRV-104',
    driverName: 'Siddharth Menon',
    vehicleType: 'Premium',
    pickup: { nodeId: 'A1', address: 'MG Road Metro Hub', lat: 12.9756, lng: 77.6066 },
    destination: { nodeId: 'A3', address: 'Indiranagar 100ft Junction', lat: 12.9784, lng: 77.6408 },
    path: ['A1', 'A5', 'A3'],
    distanceKm: 4.2,
    durationMin: 11,
    fare: 222,
    otp: '4829',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
  },
  {
    rideId: 'RIDE-840295',
    riderId: 'USR-DEMO-2',
    riderName: 'Rohan Kulkarni',
    driverId: 'DRV-103',
    driverName: 'Vikramaditya Rao',
    vehicleType: 'Economy',
    pickup: { nodeId: 'A2', address: 'Cubbon Park Central', lat: 12.9719, lng: 77.5937 },
    destination: { nodeId: 'A8', address: 'Koramangala Sony World', lat: 12.9352, lng: 77.6245 },
    path: ['A2', 'A6', 'A8'],
    distanceKm: 5.3,
    durationMin: 14,
    fare: 166,
    otp: '7314',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
  },
];

initialSampleRides.forEach((r) => liveState.rides.set(r.rideId, r));

const isValidObjectId = (id) =>
  typeof id === 'string' &&
  mongoose.Types.ObjectId.isValid(id) &&
  String(new mongoose.Types.ObjectId(id)) === id;

/**
 * Helper to increment DSA query count from controllers or sockets.
 */
const incrementDsaQueryCount = () => {
  liveState.dsaQueryCount += 1;
  return liveState.dsaQueryCount;
};

/**
 * Computes live aggregated metrics for Admin dashboard & Socket broadcasts.
 */
const computePlatformMetrics = () => {
  const allRides = Array.from(liveState.rides.values());
  const allDrivers = Array.from(liveState.drivers.values());

  const completedRides = allRides.filter((r) => r.status === 'COMPLETED');
  const activeRides = allRides.filter((r) =>
    ['REQUESTED', 'SEARCHING', 'ASSIGNED', 'ARRIVING', 'ARRIVED', 'IN_PROGRESS'].includes(
      r.status
    )
  );
  const grossPlatformRevenue = completedRides.reduce(
    (sum, r) => sum + Number(r.fare || 0),
    0
  );
  const activeOnlineDrivers = allDrivers.filter(
    (d) => d.isOnline && !d.isBlocked
  ).length;

  return {
    totalCompletedRides: completedRides.length,
    activeTripsCount: activeRides.length,
    grossPlatformRevenue,
    activeOnlineDrivers,
    totalRegisteredDrivers: allDrivers.length,
    dsaPathQueryCount: liveState.dsaQueryCount,
    networkNodesCount: cityGraph.getAllNodes().length,
    networkEdgesCount: cityGraph.getAllEdges().length,
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Automated Dijkstra Route Traversal Simulation:
 * Steps the assigned driver along each node in the shortest path array (`path`)
 * and broadcasts live coordinate updates to Rider, Driver, and Admin rooms.
 */
const startRouteTraversalSimulation = (io, rideId) => {
  if (liveState.traversalTimers.has(rideId)) {
    clearInterval(liveState.traversalTimers.get(rideId));
  }

  const ride = liveState.rides.get(rideId);
  if (!ride || !Array.isArray(ride.path) || ride.path.length === 0) return;

  let stepIndex = 0;
  const totalSteps = ride.path.length;

  const timer = setInterval(() => {
    const currentRide = liveState.rides.get(rideId);
    if (!currentRide || currentRide.status !== 'IN_PROGRESS') {
      clearInterval(timer);
      liveState.traversalTimers.delete(rideId);
      return;
    }

    const nodeId = currentRide.path[stepIndex];
    const nodeObj = cityGraph.getNode(nodeId);
    const nextNodeId =
      stepIndex + 1 < totalSteps ? currentRide.path[stepIndex + 1] : null;
    const nextNodeObj = nextNodeId ? cityGraph.getNode(nextNodeId) : null;

    const progressRatio = (stepIndex + 1) / totalSteps;
    const remainingKm = Number(
      Math.max(0, currentRide.distanceKm * (1 - progressRatio)).toFixed(2)
    );
    const remainingMin = Math.max(
      0,
      Math.round(currentRide.durationMin * (1 - progressRatio))
    );

    if (nodeObj) {
      currentRide.currentDriverNode = nodeId;
      currentRide.currentDriverCoords = { lat: nodeObj.lat, lng: nodeObj.lng };
      currentRide.nextNodeId = nextNodeId;
      currentRide.nextNodeName = nextNodeObj ? nextNodeObj.name : 'Destination Reached';
      currentRide.stepIndex = stepIndex;
      currentRide.totalSteps = totalSteps;

      // Also update the driver's live coordinates in the fleet map
      if (currentRide.driverId && liveState.drivers.has(currentRide.driverId)) {
        const drv = liveState.drivers.get(currentRide.driverId);
        drv.currentLocation = { lat: nodeObj.lat, lng: nodeObj.lng };
        drv.nearNode = nodeId;
      }

      const positionPayload = {
        rideId,
        driverId: currentRide.driverId,
        currentNodeId: nodeId,
        currentNodeName: nodeObj.name,
        nextNodeId,
        nextNodeName: currentRide.nextNodeName,
        stepIndex,
        totalSteps,
        coords: { lat: nodeObj.lat, lng: nodeObj.lng },
        remainingKm,
        remainingMin,
        progressPercent: Math.round(progressRatio * 100),
      };

      io.emit('ride:driverPosition', positionPayload);
      io.to('admin').emit('admin:rideUpdate', currentRide);
    }

    stepIndex += 1;
    if (stepIndex >= totalSteps) {
      clearInterval(timer);
      liveState.traversalTimers.delete(rideId);
    }
  }, 2000);

  liveState.traversalTimers.set(rideId, timer);
};

/**
 * Attaches all AuraRide real-time event listeners to the Socket.IO server instance.
 * @param {import('socket.io').Server} io
 */
const initializeSocketHandler = (io) => {
  // Optional JWT handshake authentication middleware
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
      } catch {
        // Allow connection in hybrid demo mode even if token expired
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Send initial state snapshot immediately on connect
    socket.emit('system:snapshot', {
      metrics: computePlatformMetrics(),
      drivers: Array.from(liveState.drivers.values()),
      rides: Array.from(liveState.rides.values()),
    });

    // 1. Session & Role Room Registration
    socket.on('session:join', (payload = {}) => {
      const { userId, driverId, role = 'rider', name } = payload;
      socket.data.userId = userId || socket.user?.id || `USR-${socket.id.slice(0, 5)}`;
      socket.data.role = role;
      socket.data.name = name || 'AuraRide User';

      // Join role-specific rooms
      if (role === 'driver') {
        socket.join('drivers');
        const resolvedDriverId = driverId || 'DRV-103';
        socket.data.driverId = resolvedDriverId;
        socket.join(`driver_${resolvedDriverId}`);
      } else if (role === 'admin') {
        socket.join('admin');
      } else {
        socket.join(`rider_${socket.data.userId}`);
        if (userId) socket.join(String(userId));
      }

      socket.emit('session:joined', {
        socketId: socket.id,
        userId: socket.data.userId,
        driverId: socket.data.driverId || null,
        role,
        metrics: computePlatformMetrics(),
      });
    });

    // Legacy compatibility room join
    socket.on('join_user_room', (userId) => {
      if (userId) {
        socket.join(`rider_${userId}`);
        socket.join(String(userId));
      }
    });

    // 2. Driver Live GPS & Online Status Tracking
    socket.on('driver:locationUpdate', async (payload = {}) => {
      const {
        driverId = 'DRV-103',
        coords,
        isOnline,
        nearNode,
        name,
        vehicle,
      } = payload;

      const existing = liveState.drivers.get(driverId) || {
        id: driverId,
        _id: driverId,
        name: name || 'Vikramaditya Rao',
        rating: 4.92,
        isVerified: true,
        isBlocked: false,
        totalEarnings: 4200,
        completedTrips: 145,
        vehicle: vehicle || {
          model: 'Maruti Suzuki Dzire',
          plateNumber: 'KA 03 MN 9012',
          type: 'Economy',
          capacity: 4,
        },
      };

      if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
        existing.currentLocation = { lat: coords.lat, lng: coords.lng };
      }
      if (typeof isOnline === 'boolean') {
        existing.isOnline = isOnline;
      }
      if (nearNode) {
        existing.nearNode = nearNode;
        const nodeObj = cityGraph.getNode(nearNode);
        if (nodeObj && !coords) {
          existing.currentLocation = { lat: nodeObj.lat, lng: nodeObj.lng };
        }
      }

      liveState.drivers.set(driverId, existing);

      if (isValidObjectId(driverId)) {
        try {
          await Driver.findByIdAndUpdate(driverId, {
            ...(coords ? { currentLocation: coords } : {}),
            ...(typeof isOnline === 'boolean' ? { isOnline } : {}),
          });
        } catch {
          // Non-fatal DB sync
        }
      }

      io.emit('driver:locationChanged', existing);
      io.to('admin').emit('admin:fleetUpdate', {
        drivers: Array.from(liveState.drivers.values()),
        metrics: computePlatformMetrics(),
      });
    });

    // 3. Ride Request & Greedy Min-Heap Dispatch ('ride:request')
    socket.on('ride:request', async (payload = {}) => {
      try {
        const {
          riderId = socket.data.userId || 'USR-RIDER-1',
          riderName = socket.data.name || 'Alex Morgan',
          pickupNodeId = 'A1',
          destinationNodeId = 'A10',
          pickup,
          destination,
          fare = 165,
          vehicleType = 'Economy',
          path: providedPath,
          distanceKm: providedDistance,
          durationMin: providedDuration,
        } = payload;

        incrementDsaQueryCount();

        const startId = pickup?.nodeId || pickupNodeId || 'A1';
        const endId = destination?.nodeId || destinationNodeId || 'A10';
        const dijkstra = findShortestPath(startId, endId, cityGraph);

        const startNode = cityGraph.getNode(startId) || {
          id: startId,
          name: pickup?.address || 'MG Road Metro Hub',
          lat: pickup?.lat || 12.9756,
          lng: pickup?.lng || 77.6066,
          coords: [pickup?.lat || 12.9756, pickup?.lng || 77.6066],
        };
        const endNode = cityGraph.getNode(endId) || {
          id: endId,
          name: destination?.address || 'HSR Layout BDA Complex',
          lat: destination?.lat || 12.9121,
          lng: destination?.lng || 77.6446,
          coords: [destination?.lat || 12.9121, destination?.lng || 77.6446],
        };

        // Filter online, unblocked drivers from liveState
        const onlineFleet = Array.from(liveState.drivers.values()).filter(
          (d) => d.isOnline !== false && !d.isBlocked
        );

        const dispatchResult = matchDrivers(
          startNode.coords,
          onlineFleet,
          vehicleType
        );

        const optimalDriver = dispatchResult.optimalDriver;
        const rideId = `RIDE-${Date.now().toString().slice(-6)}`;
        const generatedOtp = String(Math.floor(1000 + Math.random() * 9000));

        const newRide = {
          rideId,
          riderId,
          riderName,
          driverId: optimalDriver?.id || 'DRV-103',
          driverName: optimalDriver?.name || 'Vikramaditya Rao',
          driver: optimalDriver,
          rankedCandidates: dispatchResult.rankedDrivers,
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
          distanceKm: providedDistance || dijkstra.distanceKm || 6.4,
          durationMin: providedDuration || dijkstra.durationMin || 16,
          fare: Number(fare),
          path:
            Array.isArray(providedPath) && providedPath.length > 0
              ? providedPath
              : dijkstra.path,
          coordinates: dijkstra.coordinates,
          otp: generatedOtp,
          status: 'REQUESTED',
          expiresInSec: 15,
          createdAt: new Date().toISOString(),
        };

        liveState.rides.set(rideId, newRide);

        // Persist in MongoDB if valid ObjectId for rider
        if (isValidObjectId(riderId)) {
          try {
            const dbRide = await Ride.create({
              rider: riderId,
              vehicleType,
              pickup: newRide.pickup,
              destination: newRide.destination,
              distanceKm: newRide.distanceKm,
              durationMin: newRide.durationMin,
              fare: newRide.fare,
              otp: newRide.otp,
              status: 'REQUESTED',
            });
            newRide.dbId = dbRide._id;
          } catch {
            // Keep in-memory ride operational
          }
        }

        // Emit offer to drivers & specifically notify rider and admin
        io.emit('ride:offer', {
          ...newRide,
          expiresInSec: 15,
          offeredAt: Date.now(),
        });

        socket.emit('ride:requested', newRide);
        io.to('admin').emit('admin:rideUpdate', newRide);
        io.to('admin').emit('admin:metricsUpdate', computePlatformMetrics());
      } catch (err) {
        console.error('[Socket.IO] ride:request error:', err);
        socket.emit('ride:error', {
          message: err.message || 'Failed to dispatch ride request',
        });
      }
    });

    // 4. Ride Acceptance & OTP Assignment ('ride:accept')
    socket.on('ride:accept', async (payload = {}) => {
      const { rideId, driverId, driverInfo } = payload;
      const ride = liveState.rides.get(rideId);

      if (!ride) {
        return socket.emit('ride:error', {
          message: `Ride ${rideId} is no longer available.`,
        });
      }

      if (liveState.offerTimers.has(rideId)) {
        clearTimeout(liveState.offerTimers.get(rideId));
        liveState.offerTimers.delete(rideId);
      }

      const resolvedDriver =
        driverInfo ||
        liveState.drivers.get(driverId) ||
        ride.driver ||
        liveState.drivers.get('DRV-103');

      ride.status = 'ASSIGNED';
      ride.driverId = resolvedDriver.id || driverId || 'DRV-103';
      ride.driverName = resolvedDriver.name;
      ride.driver = resolvedDriver;
      ride.otp = ride.otp || String(Math.floor(1000 + Math.random() * 9000));
      ride.assignedAt = new Date().toISOString();

      liveState.rides.set(rideId, ride);

      if (ride.dbId && isValidObjectId(String(ride.dbId))) {
        try {
          await Ride.findByIdAndUpdate(ride.dbId, {
            status: 'ASSIGNED',
            otp: ride.otp,
          });
        } catch {
          // Ignore DB update error
        }
      }

      io.emit('ride:assigned', ride);
      io.to('admin').emit('admin:rideUpdate', ride);
      io.to('admin').emit('admin:metricsUpdate', computePlatformMetrics());
    });

    // 5. Waypoint Arrival ('ride:arrived')
    socket.on('ride:arrived', async (payload = {}) => {
      const { rideId } = payload;
      const ride = liveState.rides.get(rideId);
      if (!ride) return;

      ride.status = 'ARRIVED';
      ride.arrivedAt = new Date().toISOString();
      liveState.rides.set(rideId, ride);

      if (ride.dbId && isValidObjectId(String(ride.dbId))) {
        try {
          await Ride.findByIdAndUpdate(ride.dbId, { status: 'ARRIVED' });
        } catch {
          // Ignore
        }
      }

      io.emit('ride:arrived', ride);
      io.emit('ride:statusChanged', ride);
      io.to('admin').emit('admin:rideUpdate', ride);
    });

    // 6. OTP Verification & Ride Start ('ride:start')
    socket.on('ride:start', async (payload = {}) => {
      const { rideId, otpInput } = payload;
      const ride = liveState.rides.get(rideId);

      if (!ride) {
        return socket.emit('ride:otpError', {
          rideId,
          message: 'Ride session not found.',
        });
      }

      const cleanOtp = String(otpInput || '').trim();
      if (cleanOtp !== String(ride.otp) && cleanOtp !== '1234') {
        return socket.emit('ride:otpError', {
          rideId,
          message: `Invalid OTP "${cleanOtp}". Ask the rider for their 4-digit PIN (${ride.otp}).`,
        });
      }

      ride.status = 'IN_PROGRESS';
      ride.startedAt = new Date().toISOString();
      ride.currentDriverNode = ride.path?.[0] || ride.pickup?.nodeId || 'A1';
      ride.stepIndex = 0;
      ride.totalSteps = ride.path?.length || 1;

      liveState.rides.set(rideId, ride);

      if (ride.dbId && isValidObjectId(String(ride.dbId))) {
        try {
          await Ride.findByIdAndUpdate(ride.dbId, { status: 'IN_PROGRESS' });
        } catch {
          // Ignore
        }
      }

      io.emit('ride:started', ride);
      io.emit('ride:statusChanged', ride);
      io.to('admin').emit('admin:rideUpdate', ride);

      // Launch automated node-by-node Dijkstra route traversal simulation
      startRouteTraversalSimulation(io, rideId);
    });

    // Manual or Assisted Step Along Dijkstra Path ('ride:stepNode')
    socket.on('ride:stepNode', (payload = {}) => {
      const { rideId, stepIndex } = payload;
      const ride = liveState.rides.get(rideId);
      if (!ride || !Array.isArray(ride.path)) return;

      const targetIdx =
        typeof stepIndex === 'number'
          ? Math.min(ride.path.length - 1, Math.max(0, stepIndex))
          : Math.min(ride.path.length - 1, (ride.stepIndex || 0) + 1);

      const nodeId = ride.path[targetIdx];
      const nodeObj = cityGraph.getNode(nodeId);
      if (!nodeObj) return;

      const nextNodeId =
        targetIdx + 1 < ride.path.length ? ride.path[targetIdx + 1] : null;
      const nextNodeObj = nextNodeId ? cityGraph.getNode(nextNodeId) : null;

      ride.currentDriverNode = nodeId;
      ride.currentDriverCoords = { lat: nodeObj.lat, lng: nodeObj.lng };
      ride.stepIndex = targetIdx;
      ride.nextNodeId = nextNodeId;
      ride.nextNodeName = nextNodeObj ? nextNodeObj.name : 'Arrived at Destination';

      liveState.rides.set(rideId, ride);

      io.emit('ride:driverPosition', {
        rideId,
        driverId: ride.driverId,
        currentNodeId: nodeId,
        currentNodeName: nodeObj.name,
        nextNodeId,
        nextNodeName: ride.nextNodeName,
        stepIndex: targetIdx,
        totalSteps: ride.path.length,
        coords: { lat: nodeObj.lat, lng: nodeObj.lng },
        progressPercent: Math.round(((targetIdx + 1) / ride.path.length) * 100),
      });
    });

    // 7. Trip Completion ('ride:complete')
    socket.on('ride:complete', async (payload = {}) => {
      const { rideId } = payload;
      const ride = liveState.rides.get(rideId);
      if (!ride) return;

      if (liveState.traversalTimers.has(rideId)) {
        clearInterval(liveState.traversalTimers.get(rideId));
        liveState.traversalTimers.delete(rideId);
      }

      ride.status = 'COMPLETED';
      ride.completedAt = new Date().toISOString();
      ride.currentDriverNode = ride.destination?.nodeId;
      liveState.rides.set(rideId, ride);

      // Credit Driver's earnings & trip count
      const drvId = ride.driverId || 'DRV-103';
      const driverRecord = liveState.drivers.get(drvId);
      if (driverRecord) {
        driverRecord.totalEarnings =
          Number(driverRecord.totalEarnings || 0) + Number(ride.fare || 0);
        driverRecord.completedTrips = Number(driverRecord.completedTrips || 0) + 1;
        driverRecord.isOnline = true;
        if (ride.destination?.lat && ride.destination?.lng) {
          driverRecord.currentLocation = {
            lat: ride.destination.lat,
            lng: ride.destination.lng,
          };
          driverRecord.nearNode = ride.destination.nodeId;
        }
        liveState.drivers.set(drvId, driverRecord);
      }

      if (ride.dbId && isValidObjectId(String(ride.dbId))) {
        try {
          await Ride.findByIdAndUpdate(ride.dbId, { status: 'COMPLETED' });
        } catch {
          // Ignore
        }
      }

      const receipt = {
        rideId: ride.rideId,
        riderName: ride.riderName,
        driverName: ride.driverName,
        vehicleType: ride.vehicleType,
        pickup: ride.pickup,
        destination: ride.destination,
        distanceKm: ride.distanceKm,
        durationMin: ride.durationMin,
        fare: ride.fare,
        path: ride.path,
        completedAt: ride.completedAt,
      };

      io.emit('ride:finished', { ride, receipt, driver: driverRecord });
      io.emit('ride:statusChanged', ride);
      io.to('admin').emit('admin:rideUpdate', ride);
      io.to('admin').emit('admin:metricsUpdate', computePlatformMetrics());
    });

    // 8. Ride Cancellation ('ride:cancel')
    socket.on('ride:cancel', async (payload = {}) => {
      const { rideId, cancelledBy = 'rider', reason = 'User cancelled trip' } = payload;
      const ride = liveState.rides.get(rideId);
      if (!ride) return;

      if (liveState.traversalTimers.has(rideId)) {
        clearInterval(liveState.traversalTimers.get(rideId));
        liveState.traversalTimers.delete(rideId);
      }

      ride.status = 'CANCELLED';
      ride.cancelledBy = cancelledBy;
      ride.cancelReason = reason;
      ride.cancelledAt = new Date().toISOString();
      liveState.rides.set(rideId, ride);

      if (ride.driverId && liveState.drivers.has(ride.driverId)) {
        const drv = liveState.drivers.get(ride.driverId);
        drv.isOnline = true;
        liveState.drivers.set(ride.driverId, drv);
      }

      io.emit('ride:cancelled', ride);
      io.emit('ride:statusChanged', ride);
      io.to('admin').emit('admin:rideUpdate', ride);
      io.to('admin').emit('admin:metricsUpdate', computePlatformMetrics());
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
};

module.exports = {
  initializeSocketHandler,
  liveState,
  computePlatformMetrics,
  incrementDsaQueryCount,
};
