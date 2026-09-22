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
 * Automatically adjusts map bounds when the active Dijkstra route coordinates change.
 */
const FitRouteBounds = ({ routeCoordinates, nodes }) => {
  const map = useMap();

  useEffect(() => {
    if (Array.isArray(routeCoordinates) && routeCoordinates.length >= 2) {
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, { padding: [55, 55], maxZoom: 15, animate: true });
    } else if (Array.isArray(nodes) && nodes.length > 0) {
      const allCoords = nodes.map((n) => n.coords || [n.lat, n.lng]);
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [routeCoordinates, nodes, map]);

  return null;
};

/**
 * Builds custom HTML DivIcons for Graph Nodes (Pickup, Destination, Path Node, Standard Node).
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
 * Builds custom HTML DivIcons for Online Drivers on the map.
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
}) => {
  const defaultCenter = [12.9516, 77.6245]; // Central Bengaluru

  const getNodeStatus = (id) => {
    if (id === startNodeId) return 'pickup';
    if (id === endNodeId) return 'destination';
    if (routePath.includes(id)) return 'in_path';
    return 'default';
  };

  return (
    <div className="relative w-full h-full min-h-[460px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900">
      <MapContainer
        center={defaultCenter}
        zoom={13}
        scrollWheelZoom={true}
        className="w-full h-full min-h-[460px] z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitRouteBounds routeCoordinates={routeCoordinates} nodes={nodes} />

        {/* Base City Street Network Graph Edges */}
        {edges.map((edge, idx) => (
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

        {/* Computed Dijkstra Shortest Path Polyline (Glow + Core) */}
        {routeCoordinates && routeCoordinates.length >= 2 && (
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

        {/* 15 City Graph Intersection Nodes (A1 - A15) */}
        {nodes.map((node) => {
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
        })}

        {/* Online Driver Fleet Markers */}
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
              icon={createDriverIcon(driver, isOptimal)}
            >
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
                  {driver.score !== undefined && (
                    <p className="text-[11px] text-indigo-700 font-semibold pt-1 border-t border-slate-200">
                      Greedy Score: {driver.score} ({driver.distanceToPickupKm} km away)
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map Legend Overlay */}
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
          <span>Dijkstra Path</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
          <span>Top Matched Driver</span>
        </div>
      </div>
    </div>
  );
};

export default MapView;
