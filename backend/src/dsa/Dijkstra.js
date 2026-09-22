/**
 * @file Dijkstra.js
 * @description Single-Source Shortest Path algorithm using a Binary Min-Heap PriorityQueue
 * over the AuraRide Adjacency List City Graph.
 *
 * Algorithmic Complexity Analysis:
 * - Time Complexity: O((V + E) log V)
 *   where V is the number of intersection vertices (|V| = 15) and E is the number of street edges.
 *   Each vertex is extracted from the Binary Min-Heap at most once in O(log V) time,
 *   and each edge relaxation performs at most one heap enqueue in O(log V) time.
 *
 * - Space Complexity: O(V + E)
 *   To store the adjacency list representation O(V + E), along with auxiliary maps for
 *   distances O(V), travel durations O(V), predecessor pointers O(V), visited set O(V),
 *   and the binary heap priority queue O(V).
 */

const PriorityQueue = require('./PriorityQueue');
const { cityGraph } = require('./Graph');

/**
 * Computes the shortest path between `startNodeId` and `endNodeId` using Dijkstra's Algorithm.
 *
 * @param {string} startNodeId - Origin intersection ID (e.g., 'A1')
 * @param {string} endNodeId - Destination intersection ID (e.g., 'A10')
 * @param {import('./Graph').Graph} [graph=cityGraph] - Graph instance to traverse
 * @returns {{
 *   found: boolean,
 *   startNodeId: string,
 *   endNodeId: string,
 *   path: string[],
 *   nodes: Array<{id: string, name: string, coords: [number, number], lat: number, lng: number}>,
 *   coordinates: Array<[number, number]>,
 *   distanceKm: number,
 *   durationMin: number,
 *   segments: Array<{from: string, to: string, fromName: string, toName: string, distanceKm: number, durationMin: number}>,
 *   complexity: {time: string, space: string, visitedNodesCount: number}
 * }}
 */
function findShortestPath(startNodeId, endNodeId, graph = cityGraph) {
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
      startNodeId,
      endNodeId,
      path: [startNodeId],
      nodes: [startNode],
      coordinates: [startNode.coords],
      distanceKm: 0,
      durationMin: 0,
      segments: [],
      complexity: {
        time: 'O((V + E) log V)',
        space: 'O(V + E)',
        visitedNodesCount: 1,
      },
    };
  }

  /** @type {Map<string, number>} */
  const distances = new Map();
  /** @type {Map<string, number>} */
  const durations = new Map();
  /** @type {Map<string, {prev: string | null, edgeWeightKm: number, edgeDurationMin: number}>} */
  const previous = new Map();
  /** @type {Set<string>} */
  const visited = new Set();

  const pq = new PriorityQueue();

  for (const node of graph.getAllNodes()) {
    distances.set(node.id, Infinity);
    durations.set(node.id, Infinity);
    previous.set(node.id, { prev: null, edgeWeightKm: 0, edgeDurationMin: 0 });
  }

  distances.set(startNodeId, 0);
  durations.set(startNodeId, 0);
  pq.enqueue(startNodeId, 0);

  while (!pq.isEmpty()) {
    const dequeued = pq.dequeue();
    if (!dequeued) break;

    const currentId = dequeued.item;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // Early termination once target intersection is settled
    if (currentId === endNodeId) {
      break;
    }

    const currentDist = distances.get(currentId);
    const currentDur = durations.get(currentId);

    for (const neighbor of graph.getNeighbors(currentId)) {
      if (visited.has(neighbor.node)) continue;

      const candidateDist = Number((currentDist + neighbor.weightKm).toFixed(3));
      if (candidateDist < distances.get(neighbor.node)) {
        distances.set(neighbor.node, candidateDist);
        durations.set(neighbor.node, currentDur + neighbor.durationMin);
        previous.set(neighbor.node, {
          prev: currentId,
          edgeWeightKm: neighbor.weightKm,
          edgeDurationMin: neighbor.durationMin,
        });
        pq.enqueue(neighbor.node, candidateDist);
      }
    }
  }

  if (distances.get(endNodeId) === Infinity) {
    return {
      found: false,
      startNodeId,
      endNodeId,
      path: [],
      nodes: [],
      coordinates: [],
      distanceKm: 0,
      durationMin: 0,
      segments: [],
      complexity: {
        time: 'O((V + E) log V)',
        space: 'O(V + E)',
        visitedNodesCount: visited.size,
      },
    };
  }

  // Reconstruct optimal path from endNodeId -> startNodeId
  const path = [];
  const segments = [];
  let curr = endNodeId;

  while (curr !== null) {
    path.unshift(curr);
    const stepInfo = previous.get(curr);
    if (stepInfo && stepInfo.prev) {
      const fromNodeObj = graph.getNode(stepInfo.prev);
      const toNodeObj = graph.getNode(curr);
      segments.unshift({
        from: stepInfo.prev,
        to: curr,
        fromName: fromNodeObj ? fromNodeObj.name : stepInfo.prev,
        toName: toNodeObj ? toNodeObj.name : curr,
        distanceKm: stepInfo.edgeWeightKm,
        durationMin: stepInfo.edgeDurationMin,
      });
      curr = stepInfo.prev;
    } else {
      break;
    }
  }

  const nodes = path.map((id) => graph.getNode(id)).filter(Boolean);
  const coordinates = nodes.map((n) => n.coords);
  const totalDistanceKm = Number(distances.get(endNodeId).toFixed(2));
  const totalDurationMin = Math.round(durations.get(endNodeId));

  return {
    found: true,
    startNodeId,
    endNodeId,
    path,
    nodes,
    coordinates,
    distanceKm: totalDistanceKm,
    durationMin: totalDurationMin,
    segments,
    complexity: {
      time: 'O((V + E) log V)',
      space: 'O(V + E)',
      visitedNodesCount: visited.size,
    },
  };
}

module.exports = {
  findShortestPath,
};
