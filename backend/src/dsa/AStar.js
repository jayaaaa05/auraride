/**
 * @file AStar.js
 * @description A* (A-Star) Informed Search Algorithm over the AuraRide Adjacency List Graph.
 *
 * Uses an admissible Euclidean spatial heuristic:
 *   h(n) = sqrt((lat1 - lat2)^2 + (lng1 - lng2)^2) * scaleFactor
 *
 * Because f(n) = g(n) + h(n) prioritizes vertices geographically aligned toward the
 * destination intersection, A* prunes backward/divergent branches and evaluates
 * significantly fewer vertices than uninformed Dijkstra search while guaranteeing the
 * optimal shortest path.
 *
 * Complexity Analysis:
 * - Best-Case Time Complexity: O(E) with an informative admissible heuristic
 * - Worst-Case Time Complexity: O((V + E) log V)
 * - Space Complexity: O(V + E)
 */

const PriorityQueue = require('./PriorityQueue');
const { cityGraph } = require('./Graph');
const { findShortestPath } = require('./Dijkstra');

// 1 degree of latitude/longitude near Bengaluru (~12.97°N) corresponds to ~108.5 km.
// Using scaleFactor = 98.0 guarantees admissibility (h(n) <= true road distance g*(n))
// so A* always finds the exact global shortest path while pruning off-direction nodes.
const DEFAULT_EUCLIDEAN_SCALE_FACTOR = 98.0;

/**
 * Computes the Euclidean distance heuristic h(n) between node `n` and target `goalNode`.
 * Formula: h(n) = sqrt((lat1 - lat2)^2 + (lng1 - lng2)^2) * scaleFactor
 *
 * @param {{lat: number, lng: number}} nodeA
 * @param {{lat: number, lng: number}} nodeB
 * @param {number} [scaleFactor=DEFAULT_EUCLIDEAN_SCALE_FACTOR]
 * @returns {number} Heuristic estimated distance in km
 */
function euclideanHeuristic(
  nodeA,
  nodeB,
  scaleFactor = DEFAULT_EUCLIDEAN_SCALE_FACTOR
) {
  if (!nodeA || !nodeB) return 0;
  const dLat = nodeA.lat - nodeB.lat;
  const dLng = nodeA.lng - nodeB.lng;
  const rawEuclidean = Math.sqrt(dLat * dLat + dLng * dLng);
  return Number((rawEuclidean * scaleFactor).toFixed(4));
}

/**
 * Finds the optimal shortest path between `startNodeId` and `endNodeId` using A* Search,
 * and directly compares the number of evaluated nodes against Dijkstra's algorithm.
 *
 * @param {string} startNodeId - Origin node ID (e.g. 'A1')
 * @param {string} endNodeId - Target node ID (e.g. 'A10')
 * @param {import('./Graph').Graph} [graph=cityGraph] - Graph instance
 * @returns {Object} Complete A* path, distanceKm, durationMin, visited nodes, and Dijkstra comparison
 */
function findAStarPath(startNodeId, endNodeId, graph = cityGraph) {
  const startNode = graph.getNode(startNodeId);
  const endNode = graph.getNode(endNodeId);

  if (!startNode || !endNode) {
    throw new Error(
      `Invalid node ID(s): startNodeId="${startNodeId}", endNodeId="${endNodeId}"`
    );
  }

  if (startNodeId === endNodeId) {
    return {
      found: true,
      algorithm: 'A*',
      startNodeId,
      endNodeId,
      path: [startNodeId],
      nodes: [startNode],
      coordinates: [startNode.coords],
      distanceKm: 0,
      durationMin: 0,
      segments: [],
      nodesEvaluated: 1,
      visitedNodesOrder: [startNodeId],
      dijkstraComparison: {
        dijkstraNodesVisited: 1,
        aStarNodesVisited: 1,
        nodesSaved: 0,
        reductionPercent: 0,
      },
      complexity: {
        time: 'O(E) best-case / O((V + E) log V)',
        space: 'O(V + E)',
        heuristicFormula: 'h(n) = sqrt((lat1-lat2)^2 + (lng1-lng2)^2) * 98.0',
        visitedNodesCount: 1,
      },
    };
  }

  /** @type {Map<string, number>} Actual cost from startNodeId to n */
  const gScore = new Map();
  /** @type {Map<string, number>} Estimated total cost f(n) = g(n) + h(n) */
  const fScore = new Map();
  /** @type {Map<string, number>} Accumulated travel minutes */
  const durations = new Map();
  /** @type {Map<string, {prev: string | null, edgeWeightKm: number, edgeDurationMin: number}>} */
  const cameFrom = new Map();
  /** @type {Set<string>} Closed set of evaluated vertices */
  const closedSet = new Set();
  /** @type {string[]} Ordered record of every node popped & evaluated */
  const visitedNodesOrder = [];

  const openHeap = new PriorityQueue();

  for (const node of graph.getAllNodes()) {
    gScore.set(node.id, Infinity);
    fScore.set(node.id, Infinity);
    durations.set(node.id, Infinity);
    cameFrom.set(node.id, { prev: null, edgeWeightKm: 0, edgeDurationMin: 0 });
  }

  const initialH = euclideanHeuristic(startNode, endNode);
  gScore.set(startNodeId, 0);
  fScore.set(startNodeId, initialH);
  durations.set(startNodeId, 0);
  openHeap.enqueue(startNodeId, initialH);

  while (!openHeap.isEmpty()) {
    const currentEntry = openHeap.dequeue();
    if (!currentEntry) break;

    const currentId = currentEntry.item;
    if (closedSet.has(currentId)) continue;

    closedSet.add(currentId);
    visitedNodesOrder.push(currentId);

    // Goal reached: terminate immediately without expanding remaining frontier
    if (currentId === endNodeId) {
      break;
    }

    const currentG = gScore.get(currentId);
    const currentDur = durations.get(currentId);

    for (const neighbor of graph.getNeighbors(currentId)) {
      if (closedSet.has(neighbor.node)) continue;

      const tentativeG = Number((currentG + neighbor.weightKm).toFixed(4));
      if (tentativeG < gScore.get(neighbor.node)) {
        const neighborNodeObj = graph.getNode(neighbor.node);
        const hVal = euclideanHeuristic(neighborNodeObj, endNode);
        const tentativeF = Number((tentativeG + hVal).toFixed(4));

        cameFrom.set(neighbor.node, {
          prev: currentId,
          edgeWeightKm: neighbor.weightKm,
          edgeDurationMin: neighbor.durationMin,
        });
        gScore.set(neighbor.node, tentativeG);
        fScore.set(neighbor.node, tentativeF);
        durations.set(neighbor.node, currentDur + neighbor.durationMin);

        openHeap.enqueue(neighbor.node, tentativeF);
      }
    }
  }

  if (gScore.get(endNodeId) === Infinity) {
    return {
      found: false,
      algorithm: 'A*',
      startNodeId,
      endNodeId,
      path: [],
      nodes: [],
      coordinates: [],
      distanceKm: 0,
      durationMin: 0,
      segments: [],
      nodesEvaluated: visitedNodesOrder.length,
      visitedNodesOrder,
      dijkstraComparison: null,
      complexity: {
        time: 'O(E) best-case / O((V + E) log V)',
        space: 'O(V + E)',
        visitedNodesCount: visitedNodesOrder.length,
      },
    };
  }

  // Reconstruct path
  const path = [];
  const segments = [];
  let curr = endNodeId;

  while (curr !== null) {
    path.unshift(curr);
    const stepInfo = cameFrom.get(curr);
    if (stepInfo && stepInfo.prev) {
      const fromNodeObj = graph.getNode(stepInfo.prev);
      const toNodeObj = graph.getNode(curr);
      segments.unshift({
        from: stepInfo.prev,
        to: curr,
        fromName: fromNodeObj ? fromNodeObj.name : stepInfo.prev,
        toName: toNodeObj ? toNodeObj.name : curr,
        distanceKm: stepInfo.edgeWeightKm,
        edgeDurationMin: stepInfo.edgeDurationMin,
      });
      curr = stepInfo.prev;
    } else {
      break;
    }
  }

  const nodes = path.map((id) => graph.getNode(id)).filter(Boolean);
  const coordinates = nodes.map((n) => n.coords);
  const totalDistanceKm = Number(gScore.get(endNodeId).toFixed(2));
  const totalDurationMin = Math.round(durations.get(endNodeId));

  // Direct comparison against Dijkstra on the same query
  const dijkstraRef = findShortestPath(startNodeId, endNodeId, graph);
  const dijkstraVisited =
    dijkstraRef.complexity?.visitedNodesCount || visitedNodesOrder.length;
  const aStarVisited = visitedNodesOrder.length;
  const nodesSaved = Math.max(0, dijkstraVisited - aStarVisited);
  const reductionPercent =
    dijkstraVisited > 0
      ? Math.round((nodesSaved / dijkstraVisited) * 100)
      : 0;

  return {
    found: true,
    algorithm: 'A*',
    startNodeId,
    endNodeId,
    path,
    nodes,
    coordinates,
    distanceKm: totalDistanceKm,
    durationMin: totalDurationMin,
    segments,
    nodesEvaluated: aStarVisited,
    visitedNodesOrder,
    dijkstraComparison: {
      dijkstraNodesVisited: dijkstraVisited,
      aStarNodesVisited: aStarVisited,
      nodesSaved,
      reductionPercent,
    },
    complexity: {
      time: 'O(E) best-case with admissible heuristic',
      space: 'O(V + E)',
      heuristicFormula: 'h(n) = sqrt((lat1-lat2)^2 + (lng1-lng2)^2) * scaleFactor',
      visitedNodesCount: aStarVisited,
    },
  };
}

module.exports = {
  findAStarPath,
  euclideanHeuristic,
  DEFAULT_EUCLIDEAN_SCALE_FACTOR,
};
