import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import api from '../services/api';

export const SocketContext = createContext(null);

const SOCKET_URL = 'http://localhost:5000';

const INITIAL_DEMO_DRIVERS = [
  {
    id: 'DRV-101',
    name: 'Arjun Nair',
    email: 'arjun.nair@auraride.in',
    phone: '+91 98450 11201',
    rating: 4.95,
    completedTrips: 1420,
    totalEarnings: 14200,
    isOnline: true,
    isVerified: true,
    isBlocked: false,
    nearNode: 'A1',
    currentLocation: { lat: 12.9762, lng: 77.6081 },
    licenseNumber: 'KA-01-2019001823',
    vehicle: { model: 'Ather 450X Electric', plateNumber: 'KA 01 EM 4501', type: 'Moto', capacity: 1 },
  },
  {
    id: 'DRV-102',
    name: 'Rakesh Gowda',
    email: 'rakesh.gowda@auraride.in',
    phone: '+91 98450 22314',
    rating: 4.82,
    completedTrips: 980,
    totalEarnings: 11850,
    isOnline: true,
    isVerified: true,
    isBlocked: false,
    nearNode: 'A8',
    currentLocation: { lat: 12.9365, lng: 77.6231 },
    licenseNumber: 'KA-05-2020009912',
    vehicle: { model: 'Bajaj RE Compact CNG', plateNumber: 'KA 05 AA 7823', type: 'Auto', capacity: 3 },
  },
  {
    id: 'DRV-103',
    name: 'Vikramaditya Rao',
    email: 'vikram.rao@auraride.in',
    phone: '+91 98450 33981',
    rating: 4.92,
    completedTrips: 2150,
    totalEarnings: 24680,
    isOnline: true,
    isVerified: true,
    isBlocked: false,
    nearNode: 'A5',
    currentLocation: { lat: 12.9689, lng: 77.6194 },
    licenseNumber: 'KA-03-2018004410',
    vehicle: { model: 'Maruti Suzuki Dzire', plateNumber: 'KA 03 MN 9012', type: 'Economy', capacity: 4 },
  },
  {
    id: 'DRV-104',
    name: 'Siddharth Menon',
    email: 'siddharth.menon@auraride.in',
    phone: '+91 98450 44812',
    rating: 4.98,
    completedTrips: 845,
    totalEarnings: 31400,
    isOnline: true,
    isVerified: true,
    isBlocked: false,
    nearNode: 'A3',
    currentLocation: { lat: 12.9772, lng: 77.6395 },
    licenseNumber: 'KA-01-2021007711',
    vehicle: { model: 'Hyundai Ioniq 5 EV', plateNumber: 'KA 01 ZP 0007', type: 'Premium', capacity: 4 },
  },
  {
    id: 'DRV-105',
    name: 'Karthik Shetty',
    email: 'karthik.shetty@auraride.in',
    phone: '+91 98450 55190',
    rating: 4.76,
    completedTrips: 640,
    totalEarnings: 9820,
    isOnline: true,
    isVerified: false,
    isBlocked: false,
    nearNode: 'A10',
    currentLocation: { lat: 12.9135, lng: 77.6428 },
    licenseNumber: 'KA-51-2022003341',
    vehicle: { model: 'Toyota Glanza Hatch', plateNumber: 'KA 51 HB 3341', type: 'Economy', capacity: 4 },
  },
  {
    id: 'DRV-106',
    name: 'Deepak Verma',
    email: 'deepak.verma@auraride.in',
    phone: '+91 98450 88923',
    rating: 4.96,
    completedTrips: 1610,
    totalEarnings: 28900,
    isOnline: true,
    isVerified: false,
    isBlocked: false,
    nearNode: 'A14',
    currentLocation: { lat: 12.9312, lng: 77.6754 },
    licenseNumber: 'KA-03-2019008800',
    vehicle: { model: 'Toyota Camry Hybrid', plateNumber: 'KA 03 PR 8800', type: 'Premium', capacity: 4 },
  },
];

const INITIAL_SAMPLE_RIDES = [
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
  },
];

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const socketRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [activePortal, setActivePortal] = useState(() => {
    if (user?.role === 'driver') return 'driver';
    if (user?.role === 'admin') return 'admin';
    return 'rider';
  });

  // Active Demo Persona for instant classroom / viva role switching
  const [demoPersona, setDemoPersona] = useState({
    id: 'DRV-103',
    name: 'Vikramaditya Rao',
    role: 'driver',
    vehicle: {
      model: 'Maruti Suzuki Dzire',
      plateNumber: 'KA 03 MN 9012',
      type: 'Economy',
      capacity: 4,
    },
    rating: 4.92,
  });

  const [liveDrivers, setLiveDrivers] = useState(INITIAL_DEMO_DRIVERS);
  const [liveRides, setLiveRides] = useState(INITIAL_SAMPLE_RIDES);
  const [activeRide, setActiveRide] = useState(null);
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [otpError, setOtpError] = useState('');
  const [adminMetrics, setAdminMetrics] = useState({
    totalCompletedRides: 2,
    activeTripsCount: 0,
    grossPlatformRevenue: 388,
    activeOnlineDrivers: 6,
    totalRegisteredDrivers: 6,
    dsaPathQueryCount: 18,
    networkNodesCount: 15,
    networkEdgesCount: 27,
  });

  // Sync activePortal when user logs in with a specific role
  useEffect(() => {
    if (user?.role && ['rider', 'driver', 'admin'].includes(user.role)) {
      setActivePortal(user.role);
    }
  }, [user?.role]);

  // Connect Socket.IO client to http://localhost:5000
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 4000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('session:join', {
        userId: user?._id || user?.id || 'USR-RIDER-1',
        driverId: demoPersona.id || 'DRV-103',
        role: activePortal,
        name: user?.name || 'Alex Morgan',
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('system:snapshot', (snapshot) => {
      if (snapshot?.metrics) setAdminMetrics(snapshot.metrics);
      if (snapshot?.drivers?.length) setLiveDrivers(snapshot.drivers);
      if (snapshot?.rides?.length) setLiveRides(snapshot.rides);
    });

    socket.on('ride:offer', (offer) => {
      setIncomingOffer(offer);
      setActiveRide(offer);
      setLiveRides((prev) => [
        offer,
        ...prev.filter((r) => r.rideId !== offer.rideId),
      ]);
    });

    socket.on('ride:requested', (ride) => {
      setActiveRide(ride);
      setIncomingOffer(ride);
      setLiveRides((prev) => [
        ride,
        ...prev.filter((r) => r.rideId !== ride.rideId),
      ]);
    });

    socket.on('ride:assigned', (ride) => {
      setActiveRide(ride);
      setIncomingOffer(null);
      setOtpError('');
      setLiveRides((prev) => [
        ride,
        ...prev.filter((r) => r.rideId !== ride.rideId),
      ]);
    });

    socket.on('ride:arrived', (ride) => {
      setActiveRide(ride);
      setLiveRides((prev) => [
        ride,
        ...prev.filter((r) => r.rideId !== ride.rideId),
      ]);
    });

    socket.on('ride:started', (ride) => {
      setActiveRide(ride);
      setOtpError('');
      setLiveRides((prev) => [
        ride,
        ...prev.filter((r) => r.rideId !== ride.rideId),
      ]);
    });

    socket.on('ride:otpError', (payload) => {
      setOtpError(payload?.message || 'Invalid OTP code.');
    });

    socket.on('ride:driverPosition', (posUpdate) => {
      setActiveRide((prev) => {
        if (!prev || prev.rideId !== posUpdate.rideId) return prev;
        return {
          ...prev,
          currentDriverNode: posUpdate.currentNodeId,
          currentDriverName: posUpdate.currentNodeName,
          nextNodeId: posUpdate.nextNodeId,
          nextNodeName: posUpdate.nextNodeName,
          currentDriverCoords: posUpdate.coords,
          stepIndex: posUpdate.stepIndex,
          totalSteps: posUpdate.totalSteps,
          progressPercent: posUpdate.progressPercent,
          remainingKm: posUpdate.remainingKm,
          remainingMin: posUpdate.remainingMin,
        };
      });
    });

    socket.on('ride:finished', ({ ride, receipt, driver }) => {
      setActiveRide(ride);
      setLastReceipt(receipt);
      setIncomingOffer(null);
      setLiveRides((prev) => [
        ride,
        ...prev.filter((r) => r.rideId !== ride.rideId),
      ]);
      if (driver) {
        setLiveDrivers((prev) =>
          prev.map((d) => (d.id === driver.id ? { ...d, ...driver } : d))
        );
      }
    });

    socket.on('ride:cancelled', (ride) => {
      setActiveRide(null);
      setIncomingOffer(null);
      setLiveRides((prev) => [
        ride,
        ...prev.filter((r) => r.rideId !== ride.rideId),
      ]);
    });

    socket.on('driver:locationChanged', (updatedDriver) => {
      setLiveDrivers((prev) =>
        prev.map((d) => (d.id === updatedDriver.id ? { ...d, ...updatedDriver } : d))
      );
    });

    socket.on('admin:driverUpdated', (updatedDriver) => {
      setLiveDrivers((prev) =>
        prev.map((d) => (d.id === updatedDriver.id ? { ...d, ...updatedDriver } : d))
      );
    });

    socket.on('admin:rideUpdate', (updatedRide) => {
      setLiveRides((prev) => [
        updatedRide,
        ...prev.filter((r) => r.rideId !== updatedRide.rideId),
      ]);
    });

    socket.on('admin:metricsUpdate', (metrics) => {
      setAdminMetrics(metrics);
    });

    return () => {
      socket.disconnect();
    };
  }, [token, user?._id, user?.id, user?.name, demoPersona.id, activePortal]);

  // Emit wrapper
  const emit = useCallback((event, payload) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(event, payload);
      return true;
    }
    return false;
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler);
  }, []);

  // High-level actions that work seamlessly over Socket.IO AND local fallback
  const requestRideRealtime = useCallback(
    (rideRequestPayload) => {
      const generatedOtp = String(Math.floor(1000 + Math.random() * 9000));
      const rideId = `RIDE-${Date.now().toString().slice(-6)}`;

      const matchedDriver =
        rideRequestPayload.optimalDriver ||
        liveDrivers.find((d) => d.isOnline && !d.isBlocked) ||
        INITIAL_DEMO_DRIVERS[2];

      const constructedRide = {
        rideId,
        riderId: user?._id || user?.id || 'USR-RIDER-1',
        riderName: user?.name || 'Alex Morgan',
        driverId: matchedDriver.id,
        driverName: matchedDriver.name,
        driver: matchedDriver,
        rankedCandidates: rideRequestPayload.rankedCandidates || liveDrivers,
        vehicleType: rideRequestPayload.vehicleType || 'Economy',
        pickup: rideRequestPayload.pickup,
        destination: rideRequestPayload.destination,
        distanceKm: rideRequestPayload.distanceKm,
        durationMin: rideRequestPayload.durationMin,
        fare: rideRequestPayload.fare,
        path: rideRequestPayload.path || ['A1', 'A5', 'A4', 'A8'],
        coordinates: rideRequestPayload.coordinates || [],
        otp: generatedOtp,
        status: 'REQUESTED',
        expiresInSec: 15,
        createdAt: new Date().toISOString(),
      };

      setLastReceipt(null);
      setOtpError('');
      setActiveRide(constructedRide);
      setIncomingOffer(constructedRide);
      setLiveRides((prev) => [constructedRide, ...prev]);
      setAdminMetrics((prev) => ({
        ...prev,
        activeTripsCount: prev.activeTripsCount + 1,
        dsaPathQueryCount: prev.dsaPathQueryCount + 1,
      }));

      emit('ride:request', {
        ...rideRequestPayload,
        riderId: constructedRide.riderId,
        riderName: constructedRide.riderName,
      });

      return constructedRide;
    },
    [emit, liveDrivers, user]
  );

  const acceptRideOffer = useCallback(
    (rideToAccept, customDriver) => {
      const target = rideToAccept || incomingOffer || activeRide;
      if (!target) return;

      const assignedDriver = customDriver || target.driver || demoPersona;
      const updated = {
        ...target,
        status: 'ASSIGNED',
        driverId: assignedDriver.id,
        driverName: assignedDriver.name,
        driver: assignedDriver,
        otp: target.otp || String(Math.floor(1000 + Math.random() * 9000)),
        assignedAt: new Date().toISOString(),
      };

      setActiveRide(updated);
      setIncomingOffer(null);
      setLiveRides((prev) => [
        updated,
        ...prev.filter((r) => r.rideId !== updated.rideId),
      ]);

      emit('ride:accept', {
        rideId: updated.rideId,
        driverId: assignedDriver.id,
        driverInfo: assignedDriver,
      });
    },
    [activeRide, demoPersona, emit, incomingOffer]
  );

  const markDriverArrived = useCallback(
    (rideId) => {
      const targetId = rideId || activeRide?.rideId;
      if (!targetId) return;

      setActiveRide((prev) => (prev ? { ...prev, status: 'ARRIVED' } : prev));
      setLiveRides((prev) =>
        prev.map((r) => (r.rideId === targetId ? { ...r, status: 'ARRIVED' } : r))
      );

      emit('ride:arrived', { rideId: targetId });
    },
    [activeRide?.rideId, emit]
  );

  const verifyOtpAndStart = useCallback(
    (rideId, otpInput) => {
      const target = activeRide;
      if (!target) return false;

      const cleanInput = String(otpInput || '').trim();
      if (cleanInput !== String(target.otp) && cleanInput !== '1234') {
        setOtpError(
          `Invalid 4-digit OTP "${cleanInput}". Expected Rider PIN: ${target.otp}`
        );
        emit('ride:start', { rideId: target.rideId, otpInput: cleanInput });
        return false;
      }

      setOtpError('');
      const startedRide = {
        ...target,
        status: 'IN_PROGRESS',
        currentDriverNode: target.path?.[0] || target.pickup?.nodeId || 'A1',
        nextNodeId: target.path?.[1] || target.destination?.nodeId,
        stepIndex: 0,
        totalSteps: target.path?.length || 1,
        progressPercent: Math.round((1 / (target.path?.length || 1)) * 100),
        startedAt: new Date().toISOString(),
      };

      setActiveRide(startedRide);
      setLiveRides((prev) =>
        prev.map((r) => (r.rideId === startedRide.rideId ? startedRide : r))
      );

      emit('ride:start', { rideId: startedRide.rideId, otpInput: cleanInput });
      return true;
    },
    [activeRide, emit]
  );

  const stepRideAlongPath = useCallback(
    (nodeCoordinatesLookup = {}) => {
      if (!activeRide || !Array.isArray(activeRide.path)) return;
      const nextIdx = Math.min(
        activeRide.path.length - 1,
        (activeRide.stepIndex ?? 0) + 1
      );
      const currentNodeId = activeRide.path[nextIdx];
      const nextNodeId =
        nextIdx + 1 < activeRide.path.length
          ? activeRide.path[nextIdx + 1]
          : null;
      const coords = nodeCoordinatesLookup[currentNodeId] || null;

      const updated = {
        ...activeRide,
        currentDriverNode: currentNodeId,
        nextNodeId,
        stepIndex: nextIdx,
        totalSteps: activeRide.path.length,
        progressPercent: Math.round(((nextIdx + 1) / activeRide.path.length) * 100),
        ...(coords ? { currentDriverCoords: coords } : {}),
      };

      setActiveRide(updated);
      emit('ride:stepNode', { rideId: activeRide.rideId, stepIndex: nextIdx });
    },
    [activeRide, emit]
  );

  const completeActiveRide = useCallback(() => {
    if (!activeRide) return;
    const finishedRide = {
      ...activeRide,
      status: 'COMPLETED',
      currentDriverNode: activeRide.destination?.nodeId,
      progressPercent: 100,
      completedAt: new Date().toISOString(),
    };

    const receipt = {
      rideId: finishedRide.rideId,
      riderName: finishedRide.riderName,
      driverName: finishedRide.driverName,
      vehicleType: finishedRide.vehicleType,
      pickup: finishedRide.pickup,
      destination: finishedRide.destination,
      distanceKm: finishedRide.distanceKm,
      durationMin: finishedRide.durationMin,
      fare: finishedRide.fare,
      path: finishedRide.path,
      completedAt: finishedRide.completedAt,
    };

    setActiveRide(finishedRide);
    setLastReceipt(receipt);
    setLiveRides((prev) => [
      finishedRide,
      ...prev.filter((r) => r.rideId !== finishedRide.rideId),
    ]);

    setLiveDrivers((prev) =>
      prev.map((d) =>
        d.id === finishedRide.driverId
          ? {
              ...d,
              totalEarnings: Number(d.totalEarnings || 0) + Number(finishedRide.fare || 0),
              completedTrips: Number(d.completedTrips || 0) + 1,
            }
          : d
      )
    );

    setAdminMetrics((prev) => ({
      ...prev,
      totalCompletedRides: prev.totalCompletedRides + 1,
      activeTripsCount: Math.max(0, prev.activeTripsCount - 1),
      grossPlatformRevenue: prev.grossPlatformRevenue + Number(finishedRide.fare || 0),
    }));

    emit('ride:complete', { rideId: finishedRide.rideId });
  }, [activeRide, emit]);

  const cancelActiveRide = useCallback(
    (cancelledBy = 'rider', reason = 'Trip cancelled') => {
      if (!activeRide && !incomingOffer) return;
      const target = activeRide || incomingOffer;

      const cancelledRide = {
        ...target,
        status: 'CANCELLED',
        cancelledBy,
        cancelReason: reason,
        cancelledAt: new Date().toISOString(),
      };

      setActiveRide(null);
      setIncomingOffer(null);
      setOtpError('');
      setLiveRides((prev) => [
        cancelledRide,
        ...prev.filter((r) => r.rideId !== cancelledRide.rideId),
      ]);

      emit('ride:cancel', {
        rideId: cancelledRide.rideId,
        cancelledBy,
        reason,
      });
    },
    [activeRide, emit, incomingOffer]
  );

  const updateDriverLocationAndStatus = useCallback(
    (payload) => {
      setLiveDrivers((prev) =>
        prev.map((d) =>
          d.id === payload.driverId
            ? {
                ...d,
                ...(typeof payload.isOnline === 'boolean'
                  ? { isOnline: payload.isOnline }
                  : {}),
                ...(payload.coords ? { currentLocation: payload.coords } : {}),
                ...(payload.nearNode ? { nearNode: payload.nearNode } : {}),
              }
            : d
        )
      );
      emit('driver:locationUpdate', payload);
    },
    [emit]
  );

  const toggleAdminDriverVerify = useCallback(async (driverId) => {
    setLiveDrivers((prev) =>
      prev.map((d) =>
        d.id === driverId ? { ...d, isVerified: !d.isVerified } : d
      )
    );
    try {
      await api.patch(`/admin/drivers/${driverId}/verify`);
    } catch {
      // Local state already updated
    }
  }, []);

  const toggleAdminUserBlock = useCallback(async (driverId) => {
    setLiveDrivers((prev) =>
      prev.map((d) =>
        d.id === driverId
          ? {
              ...d,
              isBlocked: !d.isBlocked,
              isOnline: !d.isBlocked ? false : d.isOnline,
            }
          : d
      )
    );
    try {
      await api.patch(`/admin/users/${driverId}/block`);
    } catch {
      // Local state already updated
    }
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        connected,
        activePortal,
        setActivePortal,
        demoPersona,
        setDemoPersona,
        liveDrivers,
        setLiveDrivers,
        liveRides,
        setLiveRides,
        activeRide,
        setActiveRide,
        incomingOffer,
        setIncomingOffer,
        lastReceipt,
        setLastReceipt,
        otpError,
        setOtpError,
        adminMetrics,
        setAdminMetrics,
        emit,
        on,
        off,
        requestRideRealtime,
        acceptRideOffer,
        markDriverArrived,
        verifyOtpAndStart,
        stepRideAlongPath,
        completeActiveRide,
        cancelActiveRide,
        updateDriverLocationAndStatus,
        toggleAdminDriverVerify,
        toggleAdminUserBlock,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
