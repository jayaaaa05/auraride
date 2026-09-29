/**
 * @file SurgePricing.js
 * @description Dynamic Surge Pricing Engine using a Demand-Density Sliding Queue
 * and Graph Intersection Edge Load.
 *
 * Formula:
 *   Multiplier = Base * (1 + (ActiveRequestsInArea / CapacityThreshold) * SurgeFactor)
 *
 * Returns a dynamic surge multiplier clamped in [1.0x, 2.8x], peak badge metadata,
 * and node congestion telemetry.
 */

const { cityGraph } = require('./Graph');

// Pre-seeded realistic baseline demand across the 15 Bengaluru transit hubs
const NODE_BASELINE_DEMAND = {
  A1: 5, // MG Road Metro Hub (High commercial demand)
  A2: 2, // Cubbon Park Central
  A3: 6, // Indiranagar 100ft Junction (High dining/nightlife demand)
  A4: 3, // Domlur Flyover Terminal
  A5: 4, // Trinity Circle Plaza
  A6: 3, // Richmond Circle Crossing
  A7: 2, // Lalbagh West Gate
  A8: 6, // Koramangala Sony World (Tech & startup hub)
  A9: 4, // Koramangala Water Tank
  A10: 5, // HSR Layout BDA Complex
  A11: 3, // BTM Layout Udupi Garden
  A12: 2, // Jayanagar 4th Block
  A13: 7, // Silk Board Tech Flyover (Peak commuter bottleneck)
  A14: 6, // Bellandur EcoSpace Gate (IT Corridor peak)
  A15: 5, // Marathahalli Bridge Hub
};

class SurgePricingEngine {
  constructor() {
    this.baseMultiplier = 1.0;
    this.capacityThreshold = 5; // Available driver capacity threshold per zone
    this.surgeFactor = 0.35; // Sensitivity coefficient
    this.windowMs = 1000 * 60 * 10; // 10-minute sliding demand queue window

    /** @type {Map<string, number[]>} Sliding timestamp queue of recent ride requests per node */
    this.demandQueues = new Map();
  }

  /**
   * Records a new ride demand event in the sliding queue for `nodeId`.
   * @param {string} nodeId
   */
  recordDemand(nodeId = 'A1') {
    const now = Date.now();
    if (!this.demandQueues.has(nodeId)) {
      this.demandQueues.set(nodeId, []);
    }
    const queue = this.demandQueues.get(nodeId);
    queue.push(now);
    this._pruneQueue(nodeId, now);
  }

  /**
   * Evicts demand timestamps older than the sliding time window (FIFO dequeue).
   */
  _pruneQueue(nodeId, now = Date.now()) {
    const queue = this.demandQueues.get(nodeId);
    if (!queue) return 0;
    while (queue.length > 0 && now - queue[0] > this.windowMs) {
      queue.shift();
    }
    return queue.length;
  }

  /**
   * Calculates the dynamic surge multiplier for a pickup intersection node.
   *
   * Formula:
   *   Multiplier = Base * (1 + (ActiveRequestsInArea / CapacityThreshold) * SurgeFactor)
   *
   * @param {string} [startNodeId='A1']
   * @param {Object} [options={}]
   * @param {number} [options.simulatedDemand] - Optional override for interactive UI testing
   * @param {boolean} [options.forcePeak] - If true, simulates peak rush-hour load
   * @returns {{
   *   nodeId: string,
   *   nodeName: string,
   *   multiplier: number,
   *   isPeak: boolean,
   *   badgeText: string,
   *   congestionLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL',
   *   activeRequestsInArea: number,
   *   capacityThreshold: number,
   *   surgeFactor: number,
   *   edgeDegreeLoad: number,
   *   formula: string,
   *   formulaSubstituted: string
   * }}
   */
  calculateSurge(startNodeId = 'A1', options = {}) {
    const node = cityGraph.getNode(startNodeId);
    const neighbors = cityGraph.getNeighbors(startNodeId);
    const edgeDegreeLoad = neighbors.length;

    const liveQueueCount = this._pruneQueue(startNodeId);
    const baseline = NODE_BASELINE_DEMAND[startNodeId] ?? 3;

    let activeRequestsInArea = baseline + liveQueueCount;

    if (typeof options.simulatedDemand === 'number') {
      activeRequestsInArea = Math.max(0, options.simulatedDemand);
    } else if (options.forcePeak) {
      activeRequestsInArea = Math.max(activeRequestsInArea + 4, 8);
    }

    const rawMultiplier =
      this.baseMultiplier *
      (1 + (activeRequestsInArea / this.capacityThreshold) * this.surgeFactor);

    // Clamp multiplier cleanly between 1.0x and 2.8x
    const multiplier = Number(
      Math.min(2.8, Math.max(1.0, rawMultiplier)).toFixed(2)
    );

    const isPeak = multiplier >= 1.25;
    let congestionLevel = 'LOW';
    if (multiplier >= 2.0) congestionLevel = 'CRITICAL';
    else if (multiplier >= 1.45) congestionLevel = 'HIGH';
    else if (multiplier >= 1.2) congestionLevel = 'MODERATE';

    const badgeText = isPeak
      ? `⚡ ${multiplier}x Peak Surge Applied`
      : `1.0x Standard Rate`;

    return {
      nodeId: startNodeId,
      nodeName: node ? node.name : startNodeId,
      multiplier,
      isPeak,
      badgeText,
      congestionLevel,
      activeRequestsInArea,
      capacityThreshold: this.capacityThreshold,
      surgeFactor: this.surgeFactor,
      edgeDegreeLoad,
      formula:
        'Multiplier = Base * (1 + (ActiveRequestsInArea / CapacityThreshold) * SurgeFactor)',
      formulaSubstituted: `${this.baseMultiplier} * (1 + (${activeRequestsInArea} / ${this.capacityThreshold}) * ${this.surgeFactor}) = ${multiplier}x`,
    };
  }

  /**
   * Returns a congestion snapshot for all 15 city intersection nodes.
   */
  getAllNodesCongestion(simulatedDemandOffset = 0) {
    return cityGraph.getAllNodes().map((node) => {
      const base = (NODE_BASELINE_DEMAND[node.id] ?? 3) + simulatedDemandOffset;
      return this.calculateSurge(node.id, { simulatedDemand: base });
    });
  }
}

const surgePricingEngine = new SurgePricingEngine();

module.exports = {
  SurgePricingEngine,
  surgePricingEngine,
};
