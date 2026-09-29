import React, { useState, useEffect, useRef, useCallback } from 'react';
import MapView from '../../components/MapView';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import AlgorithmBenchmarkModal from '../../components/AlgorithmBenchmarkModal';
import {
  searchAddress,
  fetchOsrmDrivingRoute,
  POPULAR_CHIPS,
  debounce,
} from '../../services/geocoding';

const VEHICLE_TIERS = [
  {
    key: 'Moto',
    name: 'Aura Moto',
    tagline: 'Fast bike ride',
    fare: 65,
    eta: '2 mins away',
    icon: '⚡',
    vehicleEmoji: '🏍️',
  },
  {
    key: 'Auto',
    name: 'Aura Auto',
    tagline: 'Doorstep 3-wheeler',
    fare: 95,
    eta: '3 mins away',
    icon: '🛺',
    vehicleEmoji: '🛺',
  },
  {
    key: 'Economy',
    name: 'AuraGo',
    tagline: 'Affordable compact sedan',
    fare: 185,
    eta: '4 mins away',
    icon: '🚗',
    vehicleEmoji: '🚗',
  },
  {
    key: 'Premium',
    name: 'Premier',
    tagline: 'Top-rated luxury sedans',
    fare: 295,
    eta: '5 mins away',
    icon: '⭐',
    vehicleEmoji: '🚘',
  },
];

const RiderDashboard = ({ onOpenBenchmarkLab }) => {
  const { user } = useAuth();
  const {
    liveDrivers,
    activeRide,
    setActiveRide,
    requestRideRealtime,
    acceptRideOffer,
    cancelActiveRide,
  } = useSocket();

  // Search input state
  const [pickupText, setPickupText] = useState('Bandra Kurla Complex');
  const [dropoffText, setDropoffText] = useState('Mumbai Airport (T2)');
  const [pickupCoords, setPickupCoords] = useState([19.0657, 72.8687]);
  const [dropoffCoords, setDropoffCoords] = useState([19.0896, 72.8656]);

  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [activeDropdown, setActiveDropdown] = useState(null); // 'pickup' | 'dropoff' | null
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  // Routing & ride options state
  const [selectedVehicle, setSelectedVehicle] = useState('Economy');
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash / UPI');
  const [isSearchingDrivers, setIsSearchingDrivers] = useState(false);

  // Evaluation modal
  const [showDsaLab, setShowDsaLab] = useState(false);

  const pickupInputRef = useRef(null);
  const dropoffInputRef = useRef(null);

  // Debounced address search
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const performSearch = useCallback(
    debounce(async (query, target) => {
      if (!query || query.trim().length < 2) {
        if (target === 'pickup') setPickupSuggestions([]);
        if (target === 'dropoff') setDropoffSuggestions([]);
        setIsSearchingAddress(false);
        return;
      }
      setIsSearchingAddress(true);
      const results = await searchAddress(query);
      if (target === 'pickup') setPickupSuggestions(results);
      if (target === 'dropoff') setDropoffSuggestions(results);
      setIsSearchingAddress(false);
    }, 350),
    []
  );

  const handlePickupChange = (e) => {
    const val = e.target.value;
    setPickupText(val);
    setActiveDropdown('pickup');
    performSearch(val, 'pickup');
  };

  const handleDropoffChange = (e) => {
    const val = e.target.value;
    setDropoffText(val);
    setActiveDropdown('dropoff');
    performSearch(val, 'dropoff');
  };

  const selectAddress = (item, target) => {
    if (target === 'pickup') {
      setPickupText(item.shortName || item.label);
      setPickupCoords([item.lat, item.lon]);
      setPickupSuggestions([]);
    } else {
      setDropoffText(item.shortName || item.label);
      setDropoffCoords([item.lat, item.lon]);
      setDropoffSuggestions([]);
    }
    setActiveDropdown(null);
  };

  const selectQuickChip = (chip) => {
    setDropoffText(chip.name);
    setDropoffCoords([chip.lat, chip.lon]);
    setActiveDropdown(null);
  };

  // Fetch realistic curved road-following route from OSRM
  const calculateRoadRoute = useCallback(async () => {
    if (!pickupCoords || !dropoffCoords) return;
    const roadCoords = await fetchOsrmDrivingRoute(pickupCoords, dropoffCoords);
    if (roadCoords && roadCoords.length > 0) {
      setRouteCoordinates(roadCoords);
    }
  }, [pickupCoords, dropoffCoords]);

  useEffect(() => {
    calculateRoadRoute();
  }, [calculateRoadRoute]);

  // Handle ride request with simulated radar sonar
  const handleRequestRide = () => {
    setIsSearchingDrivers(true);

    const chosenTier =
      VEHICLE_TIERS.find((t) => t.key === selectedVehicle) || VEHICLE_TIERS[2];

    const rideData = requestRideRealtime({
      pickupNodeId: 'A5',
      destinationNodeId: 'A4',
      pickup: {
        address: pickupText,
        lat: pickupCoords[0],
        lng: pickupCoords[1],
      },
      destination: {
        address: dropoffText,
        lat: dropoffCoords[0],
        lng: dropoffCoords[1],
      },
      distanceKm: 8.4,
      durationMin: 18,
      fare: chosenTier.fare,
      vehicleType: selectedVehicle,
      coordinates: routeCoordinates,
    });

    // Radar screen animation: 2.2 seconds of sonar wave search before driver assigns
    setTimeout(() => {
      setIsSearchingDrivers(false);
      acceptRideOffer(rideData, {
        id: 'DRV-201',
        name: 'Rajesh Sharma',
        rating: 4.92,
        vehicle: {
          model: 'White Swift Dzire',
          plateNumber: 'MH 02 AB 1234',
          type: selectedVehicle,
        },
      });
    }, 2200);
  };

  const handleCancelRide = () => {
    setIsSearchingDrivers(false);
    cancelActiveRide('rider', 'Cancelled by user');
  };

  const currentTier =
    VEHICLE_TIERS.find((t) => t.key === selectedVehicle) || VEHICLE_TIERS[2];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-zinc-950 font-sans">
      {/* 1. Full-Screen Map with CartoDB Dark Matter tiles & live road-following route */}
      <div className="absolute inset-0 z-0">
        <MapView
          cleanMode={true}
          className="w-full h-full"
          pickupCoords={pickupCoords}
          dropoffCoords={dropoffCoords}
          routeCoordinates={routeCoordinates}
          drivers={liveDrivers}
        />
      </div>

      {/* Floating Left Booking Drawer (Uber Consumer Style) */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20 w-[calc(100vw-2rem)] sm:w-[420px] max-h-[calc(100vh-3rem)] overflow-y-auto no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] bg-zinc-900/95 text-zinc-100 rounded-3xl shadow-2xl border border-zinc-800/80 backdrop-blur-2xl">
        {/* Header with Aura logo and clean user avatar */}
        <div className="px-6 pt-5 pb-4 border-b border-zinc-800/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white text-zinc-950 font-black flex items-center justify-center text-sm shadow">
              A
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white">
                Aura
              </h1>
              <p className="text-[11px] text-zinc-400">Where to today?</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-200">
              {user?.name?.charAt(0) || 'A'}
            </div>
          </div>
        </div>

        {/* Dynamic Card Body: Planning vs Sonar Searching vs Confirmed Ride */}
        <div className="p-5 space-y-4">
          {!activeRide && !isSearchingDrivers ? (
            <>
              {/* Pickup & Destination Free-Form Search Inputs */}
              <div className="relative space-y-2">
                {/* Visual Line Connector */}
                <div className="absolute left-3.5 top-3.5 bottom-3.5 flex flex-col items-center justify-between z-10 pointer-events-none">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-zinc-900" />
                  <span className="w-0.5 flex-1 bg-zinc-700 my-1" />
                  <span className="w-2.5 h-2.5 bg-white rounded-sm ring-4 ring-zinc-900" />
                </div>

                {/* Pickup Input */}
                <div className="relative pl-8">
                  <input
                    ref={pickupInputRef}
                    type="text"
                    value={pickupText}
                    onChange={handlePickupChange}
                    onFocus={() => setActiveDropdown('pickup')}
                    placeholder="Pickup location"
                    className="w-full px-3.5 py-2.5 bg-zinc-950/80 text-white text-xs font-semibold rounded-xl border border-zinc-800 focus:border-zinc-500 focus:outline-none transition truncate"
                  />
                  {/* Autocomplete Dropdown Popover */}
                  {activeDropdown === 'pickup' &&
                    pickupSuggestions.length > 0 && (
                      <div className="absolute left-8 right-0 top-full mt-1.5 z-50 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {pickupSuggestions.map((item, idx) => (
                          <button
                            key={`ps-${idx}`}
                            type="button"
                            onClick={() => selectAddress(item, 'pickup')}
                            className="w-full px-3.5 py-2.5 text-left hover:bg-zinc-900 flex items-start gap-2.5 border-b border-zinc-900/80 last:border-0 transition"
                          >
                            <span className="text-zinc-400 text-xs mt-0.5">
                              📍
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-bold text-white block truncate">
                                {item.shortName}
                              </span>
                              <span className="text-[10px] text-zinc-500 block truncate">
                                {item.label}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                </div>

                {/* Dropoff Input */}
                <div className="relative pl-8">
                  <input
                    ref={dropoffInputRef}
                    type="text"
                    value={dropoffText}
                    onChange={handleDropoffChange}
                    onFocus={() => setActiveDropdown('dropoff')}
                    placeholder="Where to?"
                    className="w-full px-3.5 py-2.5 bg-zinc-950/80 text-white text-xs font-semibold rounded-xl border border-zinc-800 focus:border-zinc-500 focus:outline-none transition truncate"
                  />
                  {/* Autocomplete Dropdown Popover */}
                  {activeDropdown === 'dropoff' &&
                    dropoffSuggestions.length > 0 && (
                      <div className="absolute left-8 right-0 top-full mt-1.5 z-50 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {dropoffSuggestions.map((item, idx) => (
                          <button
                            key={`ds-${idx}`}
                            type="button"
                            onClick={() => selectAddress(item, 'dropoff')}
                            className="w-full px-3.5 py-2.5 text-left hover:bg-zinc-900 flex items-start gap-2.5 border-b border-zinc-900/80 last:border-0 transition"
                          >
                            <span className="text-zinc-400 text-xs mt-0.5">
                              📍
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-bold text-white block truncate">
                                {item.shortName}
                              </span>
                              <span className="text-[10px] text-zinc-500 block truncate">
                                {item.label}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              </div>

              {/* Quick-Tap Location Chips */}
              <div className="pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5 px-0.5">
                  Suggested destinations
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_CHIPS.slice(0, 4).map((chip) => (
                    <button
                      key={chip.name}
                      type="button"
                      onClick={() => selectQuickChip(chip)}
                      className="px-2.5 py-1 rounded-full bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                    >
                      <span>📍</span>
                      <span className="truncate max-w-[130px]">{chip.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Authentic Uber Vehicle Selection Cards */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block px-0.5">
                  Choose a ride
                </span>

                <div className="space-y-2">
                  {VEHICLE_TIERS.map((tier) => {
                    const isSelected = selectedVehicle === tier.key;

                    return (
                      <button
                        key={tier.key}
                        type="button"
                        onClick={() => setSelectedVehicle(tier.key)}
                        className={`w-full p-3 rounded-2xl flex items-center justify-between transition cursor-pointer text-left ${
                          isSelected
                            ? 'bg-zinc-800/90 border-2 border-white shadow-md'
                            : 'bg-zinc-950/50 border border-zinc-800/80 hover:bg-zinc-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{tier.vehicleEmoji}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white">
                                {tier.name}
                              </span>
                              <span className="text-[11px] text-zinc-400">
                                • {tier.eta}
                              </span>
                            </div>
                            <span className="text-[11px] text-zinc-400 line-clamp-1">
                              {tier.tagline}
                            </span>
                          </div>
                        </div>

                        <span className="font-extrabold text-base text-white pl-2">
                          ₹{tier.fare}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment Badge */}
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-sm">💵</span>
                  <span className="font-semibold text-zinc-300">
                    {paymentMethod}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPaymentMethod((prev) =>
                      prev === 'Cash / UPI' ? 'AuraPay Wallet' : 'Cash / UPI'
                    )
                  }
                  className="text-zinc-400 hover:text-white font-bold transition cursor-pointer"
                >
                  Change
                </button>
              </div>

              {/* High-Contrast "Request [Vehicle]" Action Button */}
              <button
                type="button"
                onClick={handleRequestRide}
                className="w-full py-4 px-6 rounded-2xl bg-white hover:bg-zinc-200 active:scale-[0.99] text-zinc-950 font-black text-sm tracking-wide transition shadow-xl cursor-pointer"
              >
                Request {currentTier.name} • ₹{currentTier.fare}
              </button>
            </>
          ) : isSearchingDrivers ? (
            /* Animated Sonar Radar Screen */
            <div className="py-8 text-center space-y-6 animate-fadeIn">
              <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                {/* Sonar Concentric Rings */}
                <div className="absolute inset-0 rounded-full border border-blue-500/30 animate-ping" />
                <div className="absolute inset-4 rounded-full border border-blue-400/40 animate-pulse" />
                <div className="absolute inset-8 rounded-full border border-blue-400/60" />
                <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-xl text-white shadow-lg shadow-blue-500/40">
                  {currentTier.vehicleEmoji}
                </div>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-white">
                  Looking for nearest drivers...
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Connecting to live fleet near {pickupText}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCancelRide}
                className="px-6 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 transition"
              >
                Cancel Search
              </button>
            </div>
          ) : (
            /* Driver Assigned Sheet */
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 block">
                    Driver Assigned
                  </span>
                  <h3 className="text-base font-bold text-white">
                    Arriving in 3 mins
                  </h3>
                </div>
                <span className="text-xs font-mono text-zinc-400">
                  {activeRide.rideId}
                </span>
              </div>

              {/* Driver Details Card */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-lg font-bold text-white">
                    {activeRide.driver?.name?.charAt(0) || 'R'}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-white">
                        {activeRide.driver?.name || 'Rajesh Sharma'}
                      </span>
                      <span className="text-xs text-amber-400 font-bold">
                        ★ {activeRide.driver?.rating || '4.92'}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-400 block mt-0.5">
                      {activeRide.driver?.vehicle?.model || 'White Swift Dzire'}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-300 font-bold block">
                      {activeRide.driver?.vehicle?.plateNumber ||
                        'MH 02 AB 1234'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-zinc-400 block">Fare</span>
                  <span className="font-extrabold text-base text-white">
                    ₹{activeRide.fare}
                  </span>
                </div>
              </div>

              {/* 4-Digit Ride PIN Banner */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-amber-500/30 text-center space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                  Share OTP with driver to start ride
                </span>
                <span className="text-3xl font-black tracking-widest text-white font-mono block">
                  {activeRide.otp || '5829'}
                </span>
              </div>

              {/* Destination Summary */}
              <div className="text-xs text-zinc-400 space-y-1.5 px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">Pickup: {pickupText}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm bg-white shrink-0" />
                  <span className="truncate">Dropoff: {dropoffText}</span>
                </div>
              </div>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={handleCancelRide}
                className="w-full py-3 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-rose-400 text-xs font-bold transition"
              >
                Cancel Ride
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4. Full Evaluation Examiner Modal (100/100 Criteria) */}
      <AlgorithmBenchmarkModal
        isOpen={showDsaLab}
        onClose={() => setShowDsaLab(false)}
      />
    </div>
  );
};

export default RiderDashboard;
