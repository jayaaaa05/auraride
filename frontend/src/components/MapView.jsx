import React, { useEffect } from 'react';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Tooltip,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Automatically adjusts map bounds when the active route coordinates change.
 */
const FitRouteBounds = ({ routeCoordinates, nodes, cleanMode }) => {
  const map = useMap();

  useEffect(() => {
    if (Array.isArray(routeCoordinates) && routeCoordinates.length >= 2) {
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, {
        padding: cleanMode ? [80, 80] : [55, 55],
        maxZoom: 15,
        animate: true,
      });
    } else if (Array.isArray(nodes) && nodes.length > 0 && !cleanMode) {
      const allCoords = nodes.map((n) => n.coords || [n.lat, n.lng]);
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [routeCoordinates, nodes, cleanMode, map]);

  return null;
};

/**
 * Clean Uber-style Pickup Pin (Green Pulsing Dot)
 */
const createCleanPickupIcon = () => {
  return L.divIcon({
    className: 'clean-pickup-icon',
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;width:24px;height:24px;">
        <span style="position:absolute;width:24px;height:24px;border-radius:50%;background:rgba(34,197,94,0.35);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>
        <span style="position:relative;width:14px;height:14px;border-radius:50%;background:#16a34a;border:2.5px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

/**
 * Clean Uber-style Dropoff Pin (Black/Dark Square Pin)
 */
const createCleanDropoffIcon = () => {
  return L.divIcon({
    className: 'clean-dropoff-icon',
    html: `
      <div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;">
        <span style="width:13px;height:13px;background:#09090b;border:2.5px solid #ffffff;border-radius:2px;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

/**
 * Clean Uber-style Driver Car Icon
 */
const createCleanCarIcon = (vehicleType) => {
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
      <div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:#09090b;border:2px solid #ffffff;border-radius:50%;box-shadow:0 4px 10px rgba(0,0,0,0.35);font-size:16px;">
        ${emoji}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

/**
 * Standard Tech Node DivIcon (used when cleanMode is false)
 */
const createNodeIcon = (nodeId, status) => {
  let bgClass = 'bg-slate-900 border-slate-500 text-slate-200';
  let ringHtml = '';

  if (status === 'pickup') {
    bgClass = 'bg-emerald-600 border-emerald-300 text-white shadow-lg shadow-emerald-500/50 scale-110';
    ringHtml = `<span class="absolute -inset-1.5 rounded-full bg-emerald-400/30 animate-ping"></span>`;
  } else if (status === 'destination') {
    bgClass = 'bg-rose-600 border-rose-300 text-white shadow-lg shadow-rose-500/50 scale-110';
    ringHtml = `<span class="absolute -inset-1.5 rounded-full bg-rose-400/30 animate-ping"></span>`;
  } else if (status === 'in_path') {
    bgClass = 'bg-indigo-600 border-cyan-300 text-white shadow-md shadow-indigo-500/40';
  }

  return L.divIcon({
    className: 'custom-aura-node-icon',
    html: `
      <div class="relative flex items-center justify-center w-8 h-8 rounded-full border-2 font-bold text-[11px] tracking-tighter transition-transform ${bgClass}">
        ${ringHtml}
        <span class="relative z-10">${nodeId}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

/**
 * Standard Driver Icon (used when cleanMode is false)
 */
const createDriverIcon = (driver, isOptimal) => {
  const badgeColor = isOptimal
    ? 'bg-amber-400 text-slate-950 border-white shadow-lg shadow-amber-400/50'
    : 'bg-slate-800 text-cyan-300 border-cyan-500/50';

  const vehicleEmoji =
    driver.vehicle?.type === 'Moto'
      ? '🏍️'
      : driver.vehicle?.type === 'Auto'
      ? '🛺'
      : driver.vehicle?.type === 'Premium'
      ? '🚘'
      : '🚕';

  return L.divIcon({
    className: 'custom-aura-driver-icon',
    html: `
      <div class="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${badgeColor}">
        <span>${vehicleEmoji}</span>
        <span>${driver.rating}★</span>
      </div>
    `,
    iconSize: [58, 24],
    iconAnchor: [29, 12],
    popupAnchor: [0, -12],
  });
};

const MapView = ({
  nodes = [],
  edges = [],
  startNodeId,
  endNodeId,
  routePath = [],
  routeCoordinates = [],
  drivers = [],
  optimalDriver = null,
  onSelectPickup,
  onSelectDestination,
  cleanMode = false,
  className = '',
  pickupCoords = null,
  dropoffCoords = null,
}) => {
  const defaultCenter = [12.9516, 77.6245];

  const getNodeStatus = (id) => {
    if (id === startNodeId) return 'pickup';
    if (id === endNodeId) return 'destination';
    if (routePath.includes(id)) return 'in_path';
    return 'default';
  };

  const resolvedPickup =
    pickupCoords ||
    nodes.find((n) => n.id === startNodeId)?.coords ||
    (routeCoordinates?.length > 0 ? routeCoordinates[0] : null);

  const resolvedDropoff =
    dropoffCoords ||
    nodes.find((n) => n.id === endNodeId)?.coords ||
    (routeCoordinates?.length > 1 ? routeCoordinates[routeCoordinates.length - 1] : null);

  const containerClasses = className
    ? className
    : 'relative w-full h-full min-h-[460px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900';

  return (
    <div className={containerClasses}>
      <MapContainer
        center={resolvedPickup || defaultCenter}
        zoom={13}
        scrollWheelZoom={true}
        zoomControl={false}
        className="w-full h-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitRouteBounds
          routeCoordinates={routeCoordinates}
          nodes={nodes}
          cleanMode={cleanMode}
        />

        {/* 1. Base City Street Network Graph Edges (ONLY when cleanMode is FALSE) */}
        {!cleanMode &&
          edges.map((edge, idx) => (
            <Polyline
              key={`edge-${edge.from}-${edge.to}-${idx}`}
              positions={[edge.fromCoords, edge.toCoords]}
              pathOptions={{
                color: '#475569',
                weight: 2.5,
                opacity: 0.45,
                dashArray: '5, 6',
              }}
            />
          ))}

        {/* 2. Calculated Route Polyline */}
        {routeCoordinates && routeCoordinates.length >= 2 && (
          <>
            {cleanMode ? (
              // Clean Uber Style: Crisp solid dark line with subtle shadow
              <>
                <Polyline
                  positions={routeCoordinates}
                  pathOptions={{
                    color: '#09090b',
                    weight: 6,
                    opacity: 0.9,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
                <Polyline
                  positions={routeCoordinates}
                  pathOptions={{
                    color: '#2563eb',
                    weight: 3.5,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </>
            ) : (
              // Tech Mode: Cyan glow + indigo core
              <>
                <Polyline
                  positions={routeCoordinates}
                  pathOptions={{
                    color: '#06b6d4',
                    weight: 10,
                    opacity: 0.28,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
                <Polyline
                  positions={routeCoordinates}
                  pathOptions={{
                    color: '#4f46e5',
                    weight: 5,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </>
            )}
          </>
        )}

        {/* 3. CLEAN MODE: Render ONLY Pickup (Green Dot) & Dropoff (Black Dot) */}
        {cleanMode ? (
          <>
            {resolvedPickup && (
              <Marker position={resolvedPickup} icon={createCleanPickupIcon()} />
            )}
            {resolvedDropoff && (
              <Marker position={resolvedDropoff} icon={createCleanDropoffIcon()} />
            )}
          </>
        ) : (
          /* TECH MODE: Render 15 City Graph Intersection Nodes (A1 - A15) */
          nodes.map((node) => {
            const status = getNodeStatus(node.id);
            const position = node.coords || [node.lat, node.lng];

            return (
              <Marker
                key={node.id}
                position={position}
                icon={createNodeIcon(node.id, status)}
              >
                <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
                  <div className="text-xs font-semibold">
                    <span className="text-indigo-600 font-bold">{node.id}</span>:{' '}
                    {node.name}
                  </div>
                </Tooltip>

                <Popup>
                  <div className="p-1 min-w-[190px] text-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-xs">
                        Node {node.id}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {node.lat.toFixed(4)}, {node.lng.toFixed(4)}
                      </span>
                    </div>
                    <p className="font-bold text-sm text-slate-900 mb-2">
                      {node.name}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {onSelectPickup && (
                        <button
                          type="button"
                          onClick={() => onSelectPickup(node.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition cursor-pointer"
                        >
                          Set Pickup
                        </button>
                      )}
                      {onSelectDestination && (
                        <button
                          type="button"
                          onClick={() => onSelectDestination(node.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition cursor-pointer"
                        >
                          Set Dropoff
                        </button>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })
        )}

        {/* 4. Driver Car Markers */}
        {drivers.map((driver) => {
          const isOptimal =
            optimalDriver &&
            (optimalDriver.id === driver.id || optimalDriver.name === driver.name);
          const pos = [
            driver.currentLocation?.lat || 12.9716,
            driver.currentLocation?.lng || 77.5946,
          ];

          return (
            <Marker
              key={driver.id}
              position={pos}
              icon={
                cleanMode
                  ? createCleanCarIcon(driver.vehicle?.type)
                  : createDriverIcon(driver, isOptimal)
              }
            >
              {!cleanMode && (
                <Popup>
                  <div className="text-xs text-slate-800 space-y-1 min-w-[180px]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900">
                        {driver.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                        ★ {driver.rating}
                      </span>
                    </div>
                    <p className="text-slate-600 font-medium">
                      {driver.vehicle?.model} ({driver.vehicle?.type})
                    </p>
                    <p className="font-mono text-[11px] text-slate-500">
                      Plate: {driver.vehicle?.plateNumber}
                    </p>
                  </div>
                </Popup>
              )}
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map Legend Overlay (ONLY rendered in Tech Mode) */}
      {!cleanMode && (
        <div className="absolute bottom-3 left-3 z-[400] bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 shadow-lg flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block border border-white" />
            <span>Pickup ({startNodeId})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block border border-white" />
            <span>Destination ({endNodeId})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block border border-cyan-300" />
            <span>Route Path</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
            <span>Matched Driver</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
