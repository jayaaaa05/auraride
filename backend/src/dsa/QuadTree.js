/**
 * @file QuadTree.js
 * @description Custom 2D Spatial Partitioning QuadTree for O(log N) driver location indexing.
 *
 * Divides 2D geographic space (Latitude / Longitude bounding box) recursively into
 * four sub-quadrants: NorthWest (NW), NorthEast (NE), SouthWest (SW), and SouthEast (SE)
 * whenever a quadrant's capacity threshold is exceeded.
 *
 * Complexity Analysis:
 * - Insertion: O(log N) average depth
 * - Spatial Range / Radius Query: O(log N + K) where K is the number of matched drivers,
 *   improving over naive O(N) linear array scanning.
 */

const { calculateHaversineKm } = require('./DriverMatcher');

/**
 * Axis-Aligned 2D Geographic Bounding Box (centerLat, centerLng, halfLat, halfLng).
 */
class Boundary {
  /**
   * @param {number} centerLat
   * @param {number} centerLng
   * @param {number} halfLat
   * @param {number} halfLng
   */
  constructor(centerLat, centerLng, halfLat, halfLng) {
    this.centerLat = Number(centerLat);
    this.centerLng = Number(centerLng);
    this.halfLat = Number(halfLat);
    this.halfLng = Number(halfLng);
  }

  /**
   * Returns true if a driver point `{ lat, lng }` falls inside this boundary.
   * @param {{lat: number, lng: number}} point
   * @returns {boolean}
   */
  contains(point) {
    if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') {
      return false;
    }
    return (
      point.lat >= this.centerLat - this.halfLat &&
      point.lat <= this.centerLat + this.halfLat &&
      point.lng >= this.centerLng - this.halfLng &&
      point.lng <= this.centerLng + this.halfLng
    );
  }

  /**
   * Returns true if another Boundary box overlaps with this boundary.
   * @param {Boundary} range
   * @returns {boolean}
   */
  intersects(range) {
    return !(
      range.centerLat - range.halfLat > this.centerLat + this.halfLat ||
      range.centerLat + range.halfLat < this.centerLat - this.halfLat ||
      range.centerLng - range.halfLng > this.centerLng + this.halfLng ||
      range.centerLng + range.halfLng < this.centerLng - this.halfLng
    );
  }
}

class QuadTree {
  /**
   * @param {Boundary} [boundary] - Geographic bounding box (defaults to Greater Bengaluru region)
   * @param {number} [capacity=2] - Max points per quadrant node before subdividing
   * @param {number} [depth=0] - Current recursion depth
   */
  constructor(
    boundary = new Boundary(12.945, 77.635, 0.085, 0.095),
    capacity = 2,
    depth = 0
  ) {
    this.boundary = boundary;
    this.capacity = capacity;
    this.depth = depth;
    this.maxDepth = 8;

    /** @type {Array<{lat: number, lng: number, driver: any}>} */
    this.points = [];
    this.divided = false;

    /** @type {QuadTree | null} */
    this.northWest = null;
    /** @type {QuadTree | null} */
    this.northEast = null;
    /** @type {QuadTree | null} */
    this.southWest = null;
    /** @type {QuadTree | null} */
    this.southEast = null;
  }

  /**
   * Splits the current quadrant into 4 equal child quadrants (NW, NE, SW, SE).
   */
  subdivide() {
    const { centerLat, centerLng, halfLat, halfLng } = this.boundary;
    const qLat = halfLat / 2;
    const qLng = halfLng / 2;
    const nextDepth = this.depth + 1;

    this.northWest = new QuadTree(
      new Boundary(centerLat + qLat, centerLng - qLng, qLat, qLng),
      this.capacity,
      nextDepth
    );
    this.northEast = new QuadTree(
      new Boundary(centerLat + qLat, centerLng + qLng, qLat, qLng),
      this.capacity,
      nextDepth
    );
    this.southWest = new QuadTree(
      new Boundary(centerLat - qLat, centerLng - qLng, qLat, qLng),
      this.capacity,
      nextDepth
    );
    this.southEast = new QuadTree(
      new Boundary(centerLat - qLat, centerLng + qLng, qLat, qLng),
      this.capacity,
      nextDepth
    );

    this.divided = true;
  }

  /**
   * Inserts a driver point `{ lat, lng, ...driverData }` into the QuadTree.
   * Time Complexity: O(log N)
   *
   * @param {Object} driverPoint - Object containing `{ lat, lng }` or `currentLocation: { lat, lng }`
   * @returns {boolean}
   */
  insert(driverPoint) {
    const lat = Number(
      driverPoint.lat ?? driverPoint.currentLocation?.lat ?? 12.9716
    );
    const lng = Number(
      driverPoint.lng ?? driverPoint.currentLocation?.lng ?? 77.5946
    );

    const normalizedPoint = {
      lat,
      lng,
      driver: driverPoint,
    };

    if (!this.boundary.contains(normalizedPoint)) {
      return false;
    }

    if (this.points.length < this.capacity || this.depth >= this.maxDepth) {
      this.points.push(normalizedPoint);
      return true;
    }

    if (!this.divided) {
      this.subdivide();
    }

    if (this.northWest.insert(driverPoint)) return true;
    if (this.northEast.insert(driverPoint)) return true;
    if (this.southWest.insert(driverPoint)) return true;
    if (this.southEast.insert(driverPoint)) return true;

    return false;
  }

  /**
   * Queries all drivers located within `radiusKm` of `centerCoords` using spatial pruning.
   * Only quadrants whose bounding box intersects the search radius bounding box are visited.
   *
   * @param {{lat: number, lng: number} | [number, number]} centerCoords
   * @param {number} [radiusKm=5]
   * @returns {{
   *   drivers: Array<Object>,
   *   telemetry: {
   *     quadrantsVisited: number,
   *     pointsInspected: number,
   *     radiusKm: number,
   *     complexity: string
   *   }
   * }}
   */
  queryRadius(centerCoords, radiusKm = 5) {
    const centerLat = Array.isArray(centerCoords)
      ? Number(centerCoords[0])
      : Number(centerCoords.lat);
    const centerLng = Array.isArray(centerCoords)
      ? Number(centerCoords[1])
      : Number(centerCoords.lng);

    // Convert radiusKm to approximate degree deltas (1 deg lat ≈ 111 km)
    const deltaLat = (radiusKm / 111.0) * 1.15;
    const deltaLng =
      (radiusKm / (111.0 * Math.cos((centerLat * Math.PI) / 180))) * 1.15;

    const searchBox = new Boundary(centerLat, centerLng, deltaLat, deltaLng);
    const matches = [];
    const stats = { quadrantsVisited: 0, pointsInspected: 0 };

    this._queryRangeInternal(
      searchBox,
      { lat: centerLat, lng: centerLng },
      radiusKm,
      matches,
      stats
    );

    matches.sort((a, b) => a.distanceKm - b.distanceKm);

    return {
      drivers: matches,
      telemetry: {
        quadrantsVisited: stats.quadrantsVisited,
        pointsInspected: stats.pointsInspected,
        radiusKm,
        complexity: 'O(log N + K)',
      },
    };
  }

  /**
   * Recursive helper that prunes non-intersecting quadrants.
   */
  _queryRangeInternal(searchBox, center, radiusKm, matches, stats) {
    if (!this.boundary.intersects(searchBox)) {
      return;
    }

    stats.quadrantsVisited += 1;

    for (const pt of this.points) {
      stats.pointsInspected += 1;
      if (searchBox.contains(pt)) {
        const distKm = calculateHaversineKm(center, { lat: pt.lat, lng: pt.lng });
        if (distKm <= radiusKm) {
          matches.push({
            ...pt.driver,
            distanceKm: distKm,
          });
        }
      }
    }

    if (this.divided) {
      this.northWest._queryRangeInternal(searchBox, center, radiusKm, matches, stats);
      this.northEast._queryRangeInternal(searchBox, center, radiusKm, matches, stats);
      this.southWest._queryRangeInternal(searchBox, center, radiusKm, matches, stats);
      this.southEast._queryRangeInternal(searchBox, center, radiusKm, matches, stats);
    }
  }

  /**
   * Resets the QuadTree and clears all stored points and subdivisions.
   */
  clear() {
    this.points = [];
    this.divided = false;
    this.northWest = null;
    this.northEast = null;
    this.southWest = null;
    this.southEast = null;
  }

  /**
   * Computes total quadrant count and max depth for benchmark reporting.
   */
  getTreeMetadata() {
    let totalQuadrants = 1;
    let totalPoints = this.points.length;
    let deepestLevel = this.depth;

    if (this.divided) {
      for (const child of [
        this.northWest,
        this.northEast,
        this.southWest,
        this.southEast,
      ]) {
        const childMeta = child.getTreeMetadata();
        totalQuadrants += childMeta.totalQuadrants;
        totalPoints += childMeta.totalPoints;
        if (childMeta.deepestLevel > deepestLevel) {
          deepestLevel = childMeta.deepestLevel;
        }
      }
    }

    return {
      totalQuadrants,
      totalPoints,
      deepestLevel,
      capacityPerQuadrant: this.capacity,
    };
  }
}

module.exports = {
  QuadTree,
  Boundary,
};
