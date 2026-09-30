/**
 * @file geocoding.js
 * @description Free-form real-world address search via Nominatim OpenStreetMap API
 * and realistic driving route geometry via OSRM with local fallback cache.
 */

export const POPULAR_CHIPS = [
  {
    name: 'Mumbai Airport (T2)',
    shortName: 'Airport T2',
    address: 'Chhatrapati Shivaji Maharaj International Airport, Sahar, Andheri East, Mumbai',
    lat: 19.0896,
    lon: 72.8656,
  },
  {
    name: 'Bandra Kurla Complex',
    shortName: 'BKC Financial Hub',
    address: 'G Block, Bandra Kurla Complex, Bandra East, Mumbai, Maharashtra 400051',
    lat: 19.0657,
    lon: 72.8687,
  },
  {
    name: 'Narsee Monjee College',
    shortName: 'NMIMS / NM College',
    address: 'Swami Bhaktivedanta Swami Marg, JVPD Scheme, Vile Parle West, Mumbai',
    lat: 19.1032,
    lon: 72.8368,
  },
  {
    name: 'Dadar TT Circle',
    shortName: 'Dadar TT Circle',
    address: 'Dr Baba Saheb Ambedkar Road, Dadar East, Mumbai, Maharashtra 400014',
    lat: 19.0178,
    lon: 72.8478,
  },
  {
    name: 'Churchgate Station',
    shortName: 'Churchgate Terminal',
    address: 'Maharshi Karve Road, Churchgate, Mumbai, Maharashtra 400020',
    lat: 18.9322,
    lon: 72.8264,
  },
  {
    name: 'Juhu Beach',
    shortName: 'Juhu Beach Promenade',
    address: 'Juhu Tara Road, Juhu, Mumbai, Maharashtra 400049',
    lat: 19.0988,
    lon: 72.8267,
  },
  {
    name: 'Powai Lake',
    shortName: 'Hiranandani Gardens Powai',
    address: 'Central Avenue, Hiranandani Gardens, Powai, Mumbai, Maharashtra 400076',
    lat: 19.1232,
    lon: 72.9051,
  },
  {
    name: 'Lower Parel',
    shortName: 'Phoenix Palladium',
    address: 'Senapati Bapat Marg, Lower Parel, Mumbai, Maharashtra 400013',
    lat: 18.9953,
    lon: 72.8242,
  },
];

// Debounce helper
export function debounce(func, wait = 350) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Searches real-world addresses using OpenStreetMap Nominatim Free Geocoding API
 * with instant local search fallback.
 * @param {string} query
 * @returns {Promise<Array<{label: string, shortName: string, lat: number, lon: number}>>}
 */
export async function searchAddress(query) {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const cleanQuery = query.trim().toLowerCase();

  // Instant local chip matching
  const localMatches = POPULAR_CHIPS.filter(
    (chip) =>
      chip.name.toLowerCase().includes(cleanQuery) ||
      chip.address.toLowerCase().includes(cleanQuery) ||
      chip.shortName.toLowerCase().includes(cleanQuery)
  ).map((chip) => ({
    label: chip.address,
    shortName: chip.name,
    lat: chip.lat,
    lon: chip.lon,
  }));

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query.trim()
    )}&countrycodes=in&limit=5&addressdetails=1`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept-Language': 'en',
      },
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const nominatimResults = data.map((item) => {
          const parts = (item.display_name || '').split(',');
          const shortName = parts.slice(0, 2).join(', ').trim();
          return {
            label: item.display_name,
            shortName: shortName || item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
          };
        });

        // Merge without duplicate coordinates
        const merged = [...nominatimResults];
        localMatches.forEach((lm) => {
          if (
            !merged.some(
              (m) =>
                Math.abs(m.lat - lm.lat) < 0.005 &&
                Math.abs(m.lon - lm.lon) < 0.005
            )
          ) {
            merged.push(lm);
          }
        });
        return merged.slice(0, 6);
      }
    }
  } catch {
    // If Nominatim network is throttled or offline, return local matches
  }

  return localMatches;
}

/**
 * Calculates Haversine spherical distance between two coordinates in kilometers with urban road factor.
 */
export function calculateHaversineDistance(startCoords, endCoords) {
  if (!startCoords || !endCoords) return 8.4;
  const [lat1, lon1] = startCoords;
  const [lat2, lon2] = endCoords;
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLine = R * c;
  return Math.max(0.8, parseFloat((straightLine * 1.32).toFixed(1)));
}

/**
 * Computes dynamic surge pricing based on pickup/dropoff demand zones and peak hours.
 */
export function computeSurgeMultiplier(pickupText = '', dropoffText = '', forceSurge = null) {
  if (forceSurge !== null && typeof forceSurge === 'number') {
    return {
      multiplier: forceSurge,
      isSurge: forceSurge > 1.0,
      reason: 'Dynamic Demand Simulator active',
      badgeText: `⚡ ${forceSurge}x Surge Active`,
    };
  }

  const text = `${pickupText} ${dropoffText}`.toLowerCase();
  
  // High-demand hubs
  const isAirport = text.includes('airport') || text.includes('t2') || text.includes('terminal');
  const isBusinessHub = text.includes('bkc') || text.includes('bandra kurla') || text.includes('ecospace') || text.includes('cyber') || text.includes('powai') || text.includes('lower parel');
  const isTransitStation = text.includes('station') || text.includes('dadar') || text.includes('churchgate') || text.includes('junction') || text.includes('circle');

  // Peak rush hour check (8:30-11:00 AM or 5:30-9:30 PM)
  const currentHour = new Date().getHours();
  const isRushHour = (currentHour >= 8 && currentHour <= 11) || (currentHour >= 17 && currentHour <= 21);

  if (isAirport) {
    return {
      multiplier: 1.45,
      isSurge: true,
      reason: 'High demand in Airport corridor',
      badgeText: '⚡ 1.45x Airport Surge',
    };
  }

  if (isBusinessHub && isRushHour) {
    return {
      multiplier: 1.35,
      isSurge: true,
      reason: 'Business district peak rush hour',
      badgeText: '⚡ 1.35x Rush Hour Surge',
    };
  }

  if (isTransitStation) {
    return {
      multiplier: 1.25,
      isSurge: true,
      reason: 'Transit hub demand spike',
      badgeText: '⚡ 1.25x Station Surge',
    };
  }

  if (isRushHour) {
    return {
      multiplier: 1.2,
      isSurge: true,
      reason: 'City-wide peak commute hours',
      badgeText: '⚡ 1.2x Peak Demand',
    };
  }

  // Default moderate demand for demonstration
  return {
    multiplier: 1.15,
    isSurge: true,
    reason: 'Active rider demand in this area',
    badgeText: '⚡ 1.15x Surge Active',
  };
}

/**
 * Fetches real curved road-following route coordinates between two [lat, lng] points via OSRM,
 * returning full geometry, distance in km, and estimated duration in minutes.
 * @param {[number, number]} startCoords - [lat, lng]
 * @param {[number, number]} endCoords - [lat, lng]
 * @returns {Promise<{coordinates: Array<[number, number]>, distanceKm: number, durationMin: number}>}
 */
export async function fetchOsrmDrivingRoute(startCoords, endCoords) {
  if (!startCoords || !endCoords) {
    return { coordinates: [], distanceKm: 8.4, durationMin: 18 };
  }

  const startLat = startCoords[0];
  const startLng = startCoords[1];
  const endLat = endCoords[0];
  const endLng = endCoords[1];

  const fallbackDist = calculateHaversineDistance(startCoords, endCoords);
  const fallbackDuration = Math.max(3, Math.round(fallbackDist * 2.3));

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (
        data.code === 'Ok' &&
        data.routes?.[0]?.geometry?.coordinates?.length
      ) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map(([lng, lat]) => [
          lat,
          lng,
        ]);
        const distanceKm = Math.max(0.5, parseFloat((route.distance / 1000).toFixed(1)));
        const durationMin = Math.max(2, Math.round(route.duration / 60));
        return {
          coordinates,
          distanceKm,
          durationMin,
        };
      }
    }
  } catch {
    // Fall back to Haversine calculation
  }

  // Smooth fallback interpolation if OSRM is unreachable
  return {
    coordinates: [
      startCoords,
      [startLat * 0.67 + endLat * 0.33, startLng * 0.67 + endLng * 0.33],
      [startLat * 0.33 + endLat * 0.67, startLng * 0.33 + endLng * 0.67],
      endCoords,
    ],
    distanceKm: fallbackDist,
    durationMin: fallbackDuration,
  };
}
