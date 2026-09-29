import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import MapView from '../../components/MapView';
import { useSocket } from '../../context/SocketContext';

const POPULAR_LOCATIONS = [
  { id: 'A1', name: 'Churchgate Station', subtitle: 'South Mumbai Terminal', coords: [12.9756, 77.6066] },
  { id: 'A5', name: 'Bandra Kurla Complex', subtitle: 'BKC Financial District', coords: [12.9698, 77.6205] },
  { id: 'A4', name: 'Airport Terminal 2', subtitle: 'Chhatrapati Shivaji Intl', coords: [12.9611, 77.6387] },
  { id: 'A3', name: 'Juhu Beach', subtitle: 'Juhu Tara Road', coords: [12.9784, 77.6408] },
  { id: 'A2', name: 'Andheri West', subtitle: 'Link Road Junction', coords: [12.9719, 77.5937] },
  { id: 'A8', name: 'Powai Lake', subtitle: 'Hiranandani Gardens', coords: [12.9352, 77.6245] },
  { id: 'A6', name: 'Lower Parel', subtitle: 'Phoenix Palladium', coords: [12.9592, 77.6074] },
  { id: 'A7', name: 'Colaba Causeway', subtitle: 'Gateway of India', coords: [12.9507, 77.5848] },
  { id: 'A9', name: 'Worli Sea Face', subtitle: 'Bandra-Worli Sea Link', coords: [12.9279, 77.6271] },
  { id: 'A10', name: 'Goregaon Hub', subtitle: 'Western Express Highway', coords: [12.9121, 77.6446] },
];

const RIDE_OPTIONS = [
  {
    key: 'Moto',
    name: 'Moto',
    type: 'Moto',
    baseFare: 65,
    eta: '2 mins away',
    icon: '🏍️',
    description: 'Affordable, fast motorcycle rides',
  },
  {
    key: 'Auto',
    name: 'Auto',
    type: 'Auto',
    baseFare: 95,
    eta: '3 mins away',
    icon: '🛺',
    description: 'No bargaining, doorstep pickup',
  },
  {
    key: 'Economy',
    name: 'Go',
    type: 'Economy',
    baseFare: 180,
    eta: '4 mins away',
    icon: '🚗',
    description: 'Affordable, compact rides',
  },
  {
    key: 'Premium',
    name: 'Premier',
    type: 'Premium',
    baseFare: 280,
    eta: '5 mins away',
    icon: '🚘',
    description: 'Top-rated drivers, premium sedans',
  },
];

const RiderDashboard = () => {
  const {
    liveDrivers,
    activeRide,
    setActiveRide,
    requestRideRealtime,
    acceptRideOffer,
    cancelActiveRide,
  } = useSocket();

  const [pickupId, setPickupId] = useState('A1');
  const [dropoffId, setDropoffId] = useState('A5');
  const [selectedTier, setSelectedTier] = useState('Economy');
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [calculatedFares, setCalculatedFares] = useState({});
  const [requesting, setRequesting] = useState(false);

  const pickupLocation =
    POPULAR_LOCATIONS.find((loc) => loc.id === pickupId) || POPULAR_LOCATIONS[0];
  const dropoffLocation =
    POPULAR_LOCATIONS.find((loc) => loc.id === dropoffId) || POPULAR_LOCATIONS[1];

  // Fetch optimal route geometry and fares
  const fetchRoute = useCallback(async () => {
    if (pickupId === dropoffId) return;
    try {
      const res = await api.post('/dsa/route', {
        startNodeId: pickupId,
        endNodeId: dropoffId,
        vehicleType: selectedTier,
      });

      if (res.data?.success && res.data.route) {
        setRouteCoordinates(res.data.route.coordinates || []);
        if (res.data.fares) {
          setCalculatedFares(res.data.fares);
        }
        return;
      }
    } catch {
      // Local fallback coordinates
    }

    setRouteCoordinates([pickupLocation.coords, dropoffLocation.coords]);
  }, [pickupId, dropoffId, selectedTier, pickupLocation.coords, dropoffLocation.coords]);

  useEffect(() => {
    fetchRoute();
  }, [fetchRoute]);

  const handleConfirmRide = () => {
    if (pickupId === dropoffId) return;
    setRequesting(true);

    const selectedOption =
      RIDE_OPTIONS.find((opt) => opt.key === selectedTier) || RIDE_OPTIONS[2];
    const fare =
      calculatedFares[selectedTier]?.totalFare || selectedOption.baseFare;

    const newRide = requestRideRealtime({
      pickupNodeId: pickupId,
      destinationNodeId: dropoffId,
      pickup: {
        nodeId: pickupId,
        address: pickupLocation.name,
        lat: pickupLocation.coords[0],
        lng: pickupLocation.coords[1],
      },
      destination: {
        nodeId: dropoffId,
        address: dropoffLocation.name,
        lat: dropoffLocation.coords[0],
        lng: dropoffLocation.coords[1],
      },
      distanceKm: 5.4,
      durationMin: 14,
      fare,
      vehicleType: selectedTier,
      path: [pickupId, dropoffId],
      coordinates: routeCoordinates,
    });

    // Auto-confirm with assigned driver after brief natural delay if simulating
    setTimeout(() => {
      acceptRideOffer(newRide);
      setRequesting(false);
    }, 700);
  };

  const handleCancel = () => {
    cancelActiveRide('rider', 'Rider cancelled');
  };

  const selectedOption =
    RIDE_OPTIONS.find((opt) => opt.key === selectedTier) || RIDE_OPTIONS[2];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-zinc-950 font-sans">
      {/* 1. Full-Screen Minimal Leaflet Map */}
      <div className="absolute inset-0 z-0">
        <MapView
          cleanMode={true}
          className="w-full h-full"
          startNodeId={pickupId}
          endNodeId={dropoffId}
          pickupCoords={pickupLocation.coords}
          dropoffCoords={dropoffLocation.coords}
          routeCoordinates={routeCoordinates}
          drivers={liveDrivers}
        />
      </div>

      {/* 2. Left Floating Uber-Style Card */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20 w-[calc(100vw-2rem)] sm:w-[410px] max-h-[calc(100vh-2.5rem)] overflow-y-auto bg-white dark:bg-[#121212] text-zinc-900 dark:text-zinc-100 rounded-3xl shadow-2xl border border-zinc-200/90 dark:border-zinc-800/90 backdrop-blur-xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
          <h1 className="text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
            AuraRide
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Where to today?
          </p>
        </div>

        {/* Booking Card Body */}
        <div className="p-6 space-y-5">
          {!activeRide ? (
            <>
              {/* Pickup & Dropoff Inputs with Classic Uber Connector */}
              <div className="relative flex items-center gap-3">
                {/* Visual Line Connector */}
                <div className="flex flex-col items-center justify-between h-20 py-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  <span className="w-0.5 h-7 bg-zinc-300 dark:bg-zinc-700" />
                  <span className="w-2.5 h-2.5 bg-zinc-950 dark:bg-white rounded-sm" />
                </div>

                {/* Dropdowns */}
                <div className="flex-1 space-y-2.5">
                  <div className="relative">
                    <select
                      value={pickupId}
                      onChange={(e) => setPickupId(e.target.value)}
                      className="w-full pl-3 pr-8 py-2.5 bg-zinc-100 dark:bg-zinc-900/90 text-zinc-900 dark:text-zinc-100 text-xs font-semibold rounded-xl border border-transparent focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition cursor-pointer appearance-none truncate"
                    >
                      {POPULAR_LOCATIONS.map((loc) => (
                        <option key={`p-${loc.id}`} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[10px] pointer-events-none">
                      ▼
                    </span>
                  </div>

                  <div className="relative">
                    <select
                      value={dropoffId}
                      onChange={(e) => setDropoffId(e.target.value)}
                      className="w-full pl-3 pr-8 py-2.5 bg-zinc-100 dark:bg-zinc-900/90 text-zinc-900 dark:text-zinc-100 text-xs font-semibold rounded-xl border border-transparent focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition cursor-pointer appearance-none truncate"
                    >
                      {POPULAR_LOCATIONS.map((loc) => (
                        <option key={`d-${loc.id}`} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[10px] pointer-events-none">
                      ▼
                    </span>
                  </div>
                </div>
              </div>

              {/* Ride Options */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block px-1">
                  Choose a ride
                </span>

                <div className="space-y-2">
                  {RIDE_OPTIONS.map((tier) => {
                    const isSelected = selectedTier === tier.key;
                    const fare =
                      calculatedFares[tier.key]?.totalFare || tier.baseFare;

                    return (
                      <button
                        key={tier.key}
                        type="button"
                        onClick={() => setSelectedTier(tier.key)}
                        className={`w-full p-3 rounded-2xl flex items-center justify-between transition cursor-pointer text-left ${
                          isSelected
                            ? 'bg-zinc-100 dark:bg-zinc-800/80 border-2 border-zinc-950 dark:border-white shadow-sm'
                            : 'bg-transparent border border-zinc-200/80 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{tier.icon}</span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-zinc-950 dark:text-white">
                                {tier.name}
                              </span>
                              <span className="text-[11px] text-zinc-400">
                                • {tier.eta}
                              </span>
                            </div>
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1">
                              {tier.description}
                            </span>
                          </div>
                        </div>

                        <span className="font-bold text-sm text-zinc-950 dark:text-white whitespace-nowrap pl-2">
                          ₹{fare}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Primary Action Button */}
              <button
                type="button"
                disabled={requesting || pickupId === dropoffId}
                onClick={handleConfirmRide}
                className="w-full py-4 px-6 rounded-2xl bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold text-sm tracking-wide transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {requesting
                  ? 'Requesting ride...'
                  : `Confirm ${selectedOption.name}`}
              </button>
            </>
          ) : (
            /* Ride Confirmed State */
            <div className="space-y-5 animate-fadeIn">
              {/* Status Header */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                    Ride Confirmed
                  </span>
                  <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                    Driver is arriving in 3 mins
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold text-zinc-500">
                  {activeRide.rideId}
                </span>
              </div>

              {/* Driver Details Card */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold flex items-center justify-center text-base shadow">
                    {activeRide.driver?.name?.charAt(0) || 'V'}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-zinc-950 dark:text-white">
                        {activeRide.driver?.name || 'Vikramaditya Rao'}
                      </span>
                      <span className="text-xs text-amber-500 font-bold">
                        ★ {activeRide.driver?.rating || '4.9'}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 block mt-0.5">
                      {activeRide.driver?.vehicle?.model || 'White Swift Dzire'}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400 block">
                      {activeRide.driver?.vehicle?.plateNumber || 'KA 03 MN 9012'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-zinc-400 block">Fare</span>
                  <span className="font-bold text-base text-zinc-950 dark:text-white">
                    ₹{activeRide.fare}
                  </span>
                </div>
              </div>

              {/* Big Highlighted 4-Digit PIN */}
              <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 block">
                  Start OTP (Share with driver)
                </span>
                <span className="text-3xl font-black tracking-widest text-zinc-950 dark:text-white font-mono block">
                  {activeRide.otp || '4829'}
                </span>
              </div>

              {/* Route Summary */}
              <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1 px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                  <span className="truncate">
                    Pickup: {activeRide.pickup?.address || pickupLocation.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm bg-zinc-950 dark:bg-white shrink-0" />
                  <span className="truncate">
                    Dropoff: {activeRide.destination?.address || dropoffLocation.name}
                  </span>
                </div>
              </div>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={handleCancel}
                className="w-full py-3.5 px-4 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-rose-600 dark:text-rose-400 text-xs font-bold transition cursor-pointer"
              >
                Cancel Ride
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RiderDashboard;
