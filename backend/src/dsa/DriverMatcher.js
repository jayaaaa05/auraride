/**
 * @file DriverMatcher.js
 * @description Greedy Priority-Queue Dispatch Engine for matching available online drivers
 * to a passenger's pickup coordinate.
 *
 * Scoring Heuristic:
 *   Score = (0.6 * distanceKm) - (0.4 * driverRating)
 *
 * Because a smaller distance and a higher driver rating both reduce `Score`,
 * we insert all candidate drivers into our Binary Min-Heap PriorityQueue keyed by `Score`.
 * Extracting from the Min-Heap produces the globally optimal greedy match at index 0.
 *
 * Time Complexity: O(D log D) where D is the number of online candidate drivers.
 */

const PriorityQueue = require('./PriorityQueue');

/**
 * Computes great-circle Haversine distance in kilometers between two [lat, lng] points.
 * @param {{lat: number, lng: number} | [number, number]} coordA
 * @param {{lat: number, lng: number} | [number, number]} coordB
 * @returns {number} Distance in kilometers
 */
function calculateHaversineKm(coordA, coordB) {
  const lat1 = Array.isArray(coordA) ? coordA[0] : coordA.lat;
  const lng1 = Array.isArray(coordA) ? coordA[1] : coordA.lng;
  const lat2 = Array.isArray(coordB) ? coordB[0] : coordB.lat;
  const lng2 = Array.isArray(coordB) ? coordB[1] : coordB.lng;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  // Multiply by 1.22 urban road tortuosity factor for realistic street proximity
  return Number((R * c * 1.22).toFixed(2));
}

/**
 * Simulated fleet of online drivers positioned around the 15 Bengaluru transit nodes
 * so dispatch matching always has rich multi-driver telemetry.
 */
const DEFAULT_SIMULATED_DRIVERS = [
  {
    id: 'DRV-101',
    name: 'Arjun Nair',
    phone: '+91 98450 11201',
    rating: 4.95,
    totalTrips: 1420,
    nearNode: 'A1',
    currentLocation: { lat: 12.9762, lng: 77.6081 },
    vehicle: { model: 'Ather 450X Electric', plateNumber: 'KA 01 EM 4501', type: 'Moto', capacity: 1 },
  },
  {
    id: 'DRV-102',
    name: 'Rakesh Gowda',
    phone: '+91 98450 22314',
    rating: 4.82,
    totalTrips: 980,
    nearNode: 'A8',
    currentLocation: { lat: 12.9365, lng: 77.6231 },
    vehicle: { model: 'Bajaj RE Compact CNG', plateNumber: 'KA 05 AA 7823', type: 'Auto', capacity: 3 },
  },
  {
    id: 'DRV-103',
    name: 'Vikramaditya Rao',
    phone: '+91 98450 33981',
    rating: 4.92,
    totalTrips: 2150,
    nearNode: 'A5',
    currentLocation: { lat: 12.9689, lng: 77.6194 },
    vehicle: { model: 'Maruti Suzuki Dzire', plateNumber: 'KA 03 MN 9012', type: 'Economy', capacity: 4 },
  },
  {
    id: 'DRV-104',
    name: 'Siddharth Menon',
    phone: '+91 98450 44812',
    rating: 4.98,
    totalTrips: 845,
    nearNode: 'A3',
    currentLocation: { lat: 12.9772, lng: 77.6395 },
    vehicle: { model: 'Hyundai Ioniq 5 EV', plateNumber: 'KA 01 ZP 0007', type: 'Premium', capacity: 4 },
  },
  {
    id: 'DRV-105',
    name: 'Karthik Shetty',
    phone: '+91 98450 55190',
    rating: 4.76,
    totalTrips: 640,
    nearNode: 'A10',
    currentLocation: { lat: 12.9135, lng: 77.6428 },
    vehicle: { model: 'Toyota Glanza Hatch', plateNumber: 'KA 51 HB 3341', type: 'Economy', capacity: 4 },
  },
  {
    id: 'DRV-106',
    name: 'Mohammed Irfan',
    phone: '+91 98450 66402',
    rating: 4.89,
    totalTrips: 1790,
    nearNode: 'A6',
    currentLocation: { lat: 12.9581, lng: 77.6059 },
    vehicle: { model: 'TVS iQube Electric', plateNumber: 'KA 02 EV 2198', type: 'Moto', capacity: 1 },
  },
  {
    id: 'DRV-107',
    name: 'Prashanth Kumar',
    phone: '+91 98450 77819',
    rating: 4.88,
    totalTrips: 1105,
    nearNode: 'A12',
    currentLocation: { lat: 12.9261, lng: 77.5852 },
    vehicle: { model: 'Piaggio Ape City+', plateNumber: 'KA 05 AU 6104', type: 'Auto', capacity: 3 },
  },
  {
    id: 'DRV-108',
    name: 'Deepak Verma',
    phone: '+91 98450 88923',
    rating: 4.96,
    totalTrips: 1610,
    nearNode: 'A14',
    currentLocation: { lat: 12.9312, lng: 77.6754 },
    vehicle: { model: 'Toyota Camry Hybrid', plateNumber: 'KA 03 PR 8800', type: 'Premium', capacity: 4 },
  },
];

/**
 * Evaluates available online drivers against a passenger pickup coordinate using
 * the Greedy PriorityQueue heuristic:
 *   Score = (0.6 * distanceKm) - (0.4 * driverRating)
 *
 * @param {{lat: number, lng: number} | [number, number]} pickupCoords - Passenger pickup location
 * @param {Array<Object>} [candidateDrivers] - Optional driver list (falls back to simulated fleet)
 * @param {string} [vehicleType] - Optional vehicle tier filter ('Moto' | 'Auto' | 'Economy' | 'Premium')
 * @returns {{
 *   optimalDriver: Object | null,
 *   rankedDrivers: Array<Object>,
 *   formula: string
 * }}
 */
function matchDrivers(pickupCoords, candidateDrivers = [], vehicleType = null) {
  const sourceDrivers =
    Array.isArray(candidateDrivers) && candidateDrivers.length > 0
      ? candidateDrivers
      : DEFAULT_SIMULATED_DRIVERS;

  // Filter by vehicleType if requested; if no exact tier match exists in candidates, evaluate all
  const filteredByTier = vehicleType
    ? sourceDrivers.filter(
        (d) =>
          d.vehicle?.type?.toLowerCase() === vehicleType.toLowerCase()
      )
    : sourceDrivers;

  const pool = filteredByTier.length > 0 ? filteredByTier : sourceDrivers;
  const pq = new PriorityQueue();

  for (const driver of pool) {
    const loc = driver.currentLocation || { lat: 12.9716, lng: 77.5946 };
    const distanceKm = calculateHaversineKm(pickupCoords, loc);
    const rating = Number(driver.rating ?? 5.0);

    // Greedy Dispatch Heuristic: Score = (0.6 * distanceKm) - (0.4 * driverRating)
    const rawScore = 0.6 * distanceKm - 0.4 * rating;
    const score = Number(rawScore.toFixed(4));
    const etaMin = Math.max(2, Math.round(distanceKm * 2.5));

    const enrichedDriver = {
      id: driver._id || driver.id,
      name: driver.user?.name || driver.name || 'AuraRide Partner',
      phone: driver.user?.phone || driver.phone || '+91 98450 00000',
      rating,
      nearNode: driver.nearNode || null,
      currentLocation: loc,
      vehicle: driver.vehicle,
      distanceToPickupKm: distanceKm,
      etaToPickupMin: etaMin,
      score,
      scoreBreakdown: `(0.6 × ${distanceKm}km) - (0.4 × ${rating}★) = ${score}`,
    };

    pq.enqueue(enrichedDriver, score);
  }

  const rankedDrivers = [];
  let rank = 1;
  while (!pq.isEmpty()) {
    const { item } = pq.dequeue();
    rankedDrivers.push({
      ...item,
      rank: rank++,
    });
  }

  return {
    optimalDriver: rankedDrivers.length > 0 ? rankedDrivers[0] : null,
    rankedDrivers,
    formula: 'Score = (0.6 * distanceKm) - (0.4 * driverRating)',
  };
}

module.exports = {
  matchDrivers,
  calculateHaversineKm,
  DEFAULT_SIMULATED_DRIVERS,
};
