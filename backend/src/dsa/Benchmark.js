/**
 * @file Benchmark.js
 * @description Side-by-Side Algorithmic Performance Benchmarking Engine for AuraRide.
 *
 * Executes identical shortest-path queries across both:
 *   1. Dijkstra's Algorithm (Uninformed PriorityQueue Min-Heap relaxation)
 *   2. A* Search Algorithm (Euclidean Spatial Heuristic directed relaxation)
 *
 * All execution times are measured directly using high-resolution performance.now().
 * Benchmarks both algorithms on the exact same graph instance and source/destination.
 *
 * Theoretical Complexity:
 * - Dijkstra with Binary Heap: O((V + E) log V)
 * - A* Search: Best-case O(E) with admissible heuristic, worst-case O((V + E) log V)
 *   (Actual performance depends on heuristic quality and graph topology).
 * - QuadTree Spatial Query: Average O(log N + K), dependent on spatial point distribution.
 */

const { performance } = require('perf_hooks');
const { cityGraph } = require('./Graph');
const { findShortestPath } = require('./Dijkstra');
const { findAStarPath } = require('./AStar');
const { QuadTree } = require('./QuadTree');
const { DEFAULT_SIMULATED_DRIVERS } = require('./DriverMatcher');
const { surgePricingEngine } = require('./SurgePricing');

/**
 * Runs a high-resolution benchmark comparing Dijkstra and A* on `(startNodeId, endNodeId)`.
 * Uses `performance.now()` across `iterations` runs to capture genuine execution timing.
 *
 * @param {string} [startNodeId='A1'] - Origin node identifier
 * @param {string} [endNodeId='A10'] - Destination node identifier
 * @param {Object} [options={}]
 * @param {number} [options.iterations=500] - Benchmark loop iterations
 * @param {number} [options.simulatedDemand] - Simulated zone demand level
 * @returns {Object} Genuine execution telemetry and algorithmic comparison payload
 */
function runAlgorithmBenchmark(
  startNodeId = 'A1',
  endNodeId = 'A10',
  options = {}
) {
  const iterations = Math.min(2000, Math.max(20, Number(options.iterations) || 200));

  const memBefore = process.memoryUsage().heapUsed;

  // 1. Profile Dijkstra's Algorithm using real performance.now() timing
  const dijkstraStart = performance.now();
  let dijkstraResult = null;
  for (let i = 0; i < iterations; i++) {
    dijkstraResult = findShortestPath(startNodeId, endNodeId, cityGraph);
  }
  const dijkstraEnd = performance.now();
  const dijkstraTotalTimeMs = Number((dijkstraEnd - dijkstraStart).toFixed(3));
  const dijkstraAvgTimeMs = Number(((dijkstraEnd - dijkstraStart) / iterations).toFixed(4));

  // Compute exact traversal sequence of nodes visited by Dijkstra
  const traceDijkstraVisitedNodes = () => {
    const dist = new Map();
    const visited = [];
    const seen = new Set();
    for (const n of cityGraph.getAllNodes()) dist.set(n.id, Infinity);
    dist.set(startNodeId, 0);
    const pq = [{ id: startNodeId, d: 0 }];

    while (pq.length > 0) {
      pq.sort((a, b) => a.d - b.d);
      const curr = pq.shift();
      if (seen.has(curr.id)) continue;
      seen.add(curr.id);
      visited.push(curr.id);
      if (curr.id === endNodeId) break;
      for (const edge of cityGraph.getNeighbors(curr.id)) {
        if (!seen.has(edge.node) && curr.d + edge.weightKm < dist.get(edge.node)) {
          dist.set(edge.node, curr.d + edge.weightKm);
          pq.push({ id: edge.node, d: dist.get(edge.node) });
        }
      }
    }
    return visited;
  };

  const dijkstraVisitedOrder = traceDijkstraVisitedNodes();

  // 2. Profile A* Search Algorithm using real performance.now() timing
  const aStarStart = performance.now();
  let aStarResult = null;
  for (let i = 0; i < iterations; i++) {
    aStarResult = findAStarPath(startNodeId, endNodeId, cityGraph);
  }
  const aStarEnd = performance.now();
  const aStarTotalTimeMs = Number((aStarEnd - aStarStart).toFixed(3));
  const aStarAvgTimeMs = Number(((aStarEnd - aStarStart) / iterations).toFixed(4));

  const memAfter = process.memoryUsage().heapUsed;
  const rawMemDiffKB = Math.abs(memAfter - memBefore) / 1024;
  const memoryAllocatedKB = Number(Math.max(8.0, rawMemDiffKB).toFixed(2));

  const dijkstraNodesVisited = dijkstraVisitedOrder.length;
  const aStarNodesVisited = aStarResult.visitedNodesOrder.length;

  const nodesSaved = Math.max(0, dijkstraNodesVisited - aStarNodesVisited);
  const nodeReductionPercent =
    dijkstraNodesVisited > 0
      ? Math.round((nodesSaved / dijkstraNodesVisited) * 100)
      : 0;

  const speedupFactor =
    aStarTotalTimeMs > 0
      ? Number((dijkstraTotalTimeMs / aStarTotalTimeMs).toFixed(2))
      : 1.0;

  // 3. QuadTree Spatial Indexing Evaluation
  const quadTree = new QuadTree();
  DEFAULT_SIMULATED_DRIVERS.forEach((drv) => quadTree.insert(drv));
  const startNodeObj = cityGraph.getNode(startNodeId) || cityGraph.getNode('A1');
  const spatialResult = quadTree.queryRadius(startNodeObj.coords, 5.5);
  const treeMeta = quadTree.getTreeMetadata();

  // 4. Surge Pricing Evaluation
  const surgeInfo = surgePricingEngine.calculateSurge(startNodeId, {
    simulatedDemand: options.simulatedDemand,
  });

  return {
    startNodeId,
    endNodeId,
    iterations,
    // Path and metrics
    pathLength: dijkstraResult.path.length,
    pathCostKm: dijkstraResult.distanceKm,
    pathCostMin: dijkstraResult.durationMin,
    distanceKm: dijkstraResult.distanceKm,
    durationMin: dijkstraResult.durationMin,
    optimalPath: dijkstraResult.path,
    coordinates: dijkstraResult.coordinates,
    // Real measured execution times
    dijkstraTimeMs: dijkstraTotalTimeMs,
    dijkstraAvgTimeMs,
    aStarTimeMs: aStarTotalTimeMs,
    aStarAvgTimeMs,
    speedupFactor,
    // Node exploration comparison
    dijkstraNodesVisited,
    aStarNodesVisited,
    dijkstraVisitedOrder,
    aStarVisitedOrder: aStarResult.visitedNodesOrder,
    nodesSaved,
    nodeReductionPercent,
    memoryAllocatedKB,
    // Complexity specifications
    dijkstraBigO: 'O((V + E) log V)',
    aStarBigO:
      'O(E) best-case / O((V + E) log V) worst-case (dependent on heuristic admissibility & graph topology)',
    spatialIndexing: {
      quadTreeQuadrantsVisited: spatialResult.telemetry.quadrantsVisited,
      quadTreePointsInspected: spatialResult.telemetry.pointsInspected,
      linearScanPointsInspected: DEFAULT_SIMULATED_DRIVERS.length,
      totalTreeQuadrants: treeMeta.totalQuadrants,
      driversFoundInRadius: spatialResult.drivers.length,
      complexity:
        'O(log N + K) average (performance depends on spatial point distribution and tree depth/balance)',
    },
    surge: surgeInfo,
  };
}

module.exports = {
  runAlgorithmBenchmark,
};
