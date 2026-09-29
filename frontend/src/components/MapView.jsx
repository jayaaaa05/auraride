import React, { useEffect, useState } from 'react';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Smoothly adjusts map bounds when route coordinates or pickup location updates.
 */
const SmoothMapController = ({ centerCoords, routeCoordinates, cleanMode }) => {
  const map = useMap();

  useEffect(() => {
    if (Array.isArray(routeCoordinates) && routeCoordinates.length >= 2) {
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, {
        padding: cleanMode ? [90, 90] : [60, 60],
        maxZoom: 15,
        animate: true,
      });
    } else if (centerCoords && Array.isArray(centerCoords)) {
      map.flyTo(centerCoords, 14, { duration: 1.2 });
    }
  }, [routeCoordinates, centerCoords, cleanMode, map]);

  return null;
};

/**
 * Uber-Style Pickup Pin (Green Pulsing Dot)
 */
const createCleanPickupIcon = () => {
  return L.divIcon({
    className: 'clean-pickup-icon',
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:28px;">
        <span style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(34,197,94,0.35);animation:ping 1.6s cubic-bezier(0,0,0.2,1) infinite;"></span>
        <span style="position:relative;width:15px;height:15px;border-radius:50%;background:#16a34a;border:2.5px solid #ffffff;box-shadow:0 3px 8px rgba(0,0,0,0.5);"></span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

/**
 * Uber-Style Dropoff Pin (Black/Dark Square Pin)
 */
const createCleanDropoffIcon = () => {
  return L.divIcon({
    className: 'clean-dropoff-icon',
    html: `
      <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;">
        <span style="width:14px;height:14px;background:#09090b;border:2.5px solid #ffffff;border-radius:3px;box-shadow:0 3px 8px rgba(0,0,0,0.5);"></span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

/**
 * Uber-Style Car Marker with subtle rotation & shadow
 */
const createLiveCarIcon = (vehicleType = 'Economy', rotation = 0) => {
  const emoji =
    vehicleType === 'Moto'
      ? '🏍️'
      : vehicleType === 'Auto'
      ? '🛺'
      : vehicleType === 'Premium'
      ? '🚘'
      : '🚗';

  return L.divIcon({
    className: 'clean-car-icon',
    html: `
      <div style="transform: rotate(${rotation}deg); transition: transform 0.5s ease-out; display:flex;align-items:center;justify-content:center;width:34px;height:34px;background:#18181b;border:2px solid #ffffff;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,0.4);font-size:16px;">
        ${emoji}
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
};

const MapView = ({
  nodes = [],
  edges = [],
  startNodeId,
  endNodeId,
  routeCoordinates = [],
  drivers = [],
  cleanMode = false,
  className = '',
  pickupCoords = null,
  dropoffCoords = null,
}) => {
  // Default to Mumbai Central coordinates
  const defaultCenter = [19.076, 72.8777];

  const resolvedPickup =
    pickupCoords ||
    (routeCoordinates?.length > 0 ? routeCoordinates[0] : defaultCenter);

  const resolvedDropoff =
    dropoffCoords ||
    (routeCoordinates?.length > 1
      ? routeCoordinates[routeCoordinates.length - 1]
      : null);

  // Scattered live fleet simulation around pickup location with subtle drift
  const [fleetPositions, setFleetPositions] = useState([]);

  useEffect(() => {
    if (!resolvedPickup) return;
    const baseLat = resolvedPickup[0];
    const baseLng = resolvedPickup[1];

    // Seed 5 surrounding drivers with distinct offsets & headings
    const initialFleet = [
      { id: 'f-1', lat: baseLat + 0.0062, lng: baseLng - 0.0051, type: 'Economy', heading: 45 },
      { id: 'f-2', lat: baseLat - 0.0048, lng: baseLng + 0.0064, type: 'Moto', heading: 120 },
      { id: 'f-3', lat: baseLat + 0.0075, lng: baseLng + 0.0038, type: 'Auto', heading: 210 },
      { id: 'f-4', lat: baseLat - 0.0081, lng: baseLng - 0.0042, type: 'Premium', heading: 330 },
      { id: 'f-5', lat: baseLat + 0.0028, lng: baseLng - 0.0086, type: 'Economy', heading: 85 },
    ];
    setFleetPositions(initialFleet);

    // Subtle drift simulation
    const interval = setInterval(() => {
      setFleetPositions((prev) =>
        prev.map((car) => ({
          ...car,
          lat: car.lat + (Math.random() - 0.5) * 0.0004,
          lng: car.lng + (Math.random() - 0.5) * 0.0004,
          heading: (car.heading + Math.floor((Math.random() - 0.5) * 20)) % 360,
        }))
      );
    }, 3000);

    return () => clearInterval(interval);
  }, [resolvedPickup?.[0], resolvedPickup?.[1]]);

  const containerClasses = className
    ? className
    : 'relative w-full h-full min-h-[460px] overflow-hidden bg-zinc-950';

  return (
    <div className={containerClasses}>
      <MapContainer
        center={resolvedPickup || defaultCenter}
        zoom={13}
        scrollWheelZoom={true}
        zoomControl={false}
        className="w-full h-full z-0 map-tiles-dark"
      >
        {/* OpenStreetMap Standard with Dark CSS Inversion (100% Free, Keyless, Zero Watermarks) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles-dark"
          maxZoom={19}
        />

        <SmoothMapController
          centerCoords={resolvedPickup}
          routeCoordinates={routeCoordinates}
          cleanMode={cleanMode}
        />

        {/* 1. Realistic Road Polyline: Curved Neon Blue & Dark Uber Navigation Path */}
        {routeCoordinates && routeCoordinates.length >= 2 && (
          <>
            {/* Outer Glow / Road Shadow */}
            <Polyline
              positions={routeCoordinates}
              pathOptions={{
                color: '#3b82f6',
                weight: 8,
                opacity: 0.35,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Inner Core Road Stroke */}
            <Polyline
              positions={routeCoordinates}
              pathOptions={{
                color: '#60a5fa',
                weight: 4.5,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </>
        )}

        {/* 2. Pickup & Dropoff Markers */}
        {resolvedPickup && (
          <Marker position={resolvedPickup} icon={createCleanPickupIcon()} />
        )}
        {resolvedDropoff && (
          <Marker position={resolvedDropoff} icon={createCleanDropoffIcon()} />
        )}

        {/* 3. Live Surrounding Driver Fleet Markers */}
        {fleetPositions.map((car) => (
          <Marker
            key={car.id}
            position={[car.lat, car.lng]}
            icon={createLiveCarIcon(car.type, car.heading)}
          />
        ))}
      </MapContainer>
    </div>
  );
};

export default MapView;
