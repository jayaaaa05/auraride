/**
 * @file Graph.js
 * @description Weighted undirected/bidirectional City Transit Graph using an Adjacency List:
 * Map<NodeId, Array<{node: string, weightKm: number, durationMin: number}>>
 *
 * Pre-seeded with 15 realistic city intersection nodes ('A1' through 'A15')
 * across Central & South Bengaluru (MG Road, Indiranagar, Koramangala, HSR, Cubbon Park, etc.)
 * with real-world [lat, lng] coordinates and street-connection weights.
 */

class Graph {
  constructor() {
    /** @type {Map<string, {id: string, name: string, coords: [number, number], lat: number, lng: number}>} */
    this.nodes = new Map();

    /** @type {Map<string, Array<{node: string, weightKm: number, durationMin: number}>>} */
    this.adjacencyList = new Map();
  }

  /**
   * Adds a city intersection node to the graph.
   * @param {string} id - Unique node identifier (e.g. 'A1')
   * @param {[number, number] | {lat: number, lng: number}} coords - [lat, lng] pair
   * @param {string} name - Human-readable intersection name
   */
  addNode(id, coords, name) {
    const lat = Array.isArray(coords) ? Number(coords[0]) : Number(coords.lat);
    const lng = Array.isArray(coords) ? Number(coords[1]) : Number(coords.lng);

    const nodeData = {
      id,
      name: name || id,
      coords: [lat, lng],
      lat,
      lng,
    };

    this.nodes.set(id, nodeData);
    if (!this.adjacencyList.has(id)) {
      this.adjacencyList.set(id, []);
    }
    return nodeData;
  }

  /**
   * Adds a bidirectional weighted street edge between intersection `u` and `v`.
   * @param {string} u - Source node ID
   * @param {string} v - Target node ID
   * @param {number} weightKm - Street distance in kilometers
   * @param {number} durationMin - Estimated travel duration in minutes
   */
  addEdge(u, v, weightKm, durationMin) {
    if (!this.adjacencyList.has(u)) {
      this.adjacencyList.set(u, []);
    }
    if (!this.adjacencyList.has(v)) {
      this.adjacencyList.set(v, []);
    }

    const distance = Number(weightKm);
    const duration =
      durationMin !== undefined
        ? Number(durationMin)
        : Math.max(2, Math.round(distance * 2.4));

    const uNeighbors = this.adjacencyList.get(u);
    if (!uNeighbors.some((edge) => edge.node === v)) {
      uNeighbors.push({ node: v, weightKm: distance, durationMin: duration });
    }

    const vNeighbors = this.adjacencyList.get(v);
    if (!vNeighbors.some((edge) => edge.node === u)) {
      vNeighbors.push({ node: u, weightKm: distance, durationMin: duration });
    }
  }

  /**
   * Returns all adjacent street connections for node `u`.
   * @param {string} u - Node ID
   * @returns {Array<{node: string, weightKm: number, durationMin: number}>}
   */
  getNeighbors(u) {
    return this.adjacencyList.get(u) || [];
  }

  /**
   * Retrieves metadata and coordinates for a specific node ID.
   * @param {string} id - Node ID
   * @returns {{id: string, name: string, coords: [number, number], lat: number, lng: number} | null}
   */
  getNode(id) {
    return this.nodes.get(id) || null;
  }

  /**
   * Returns an array of all nodes in the graph.
   * @returns {Array<{id: string, name: string, coords: [number, number], lat: number, lng: number}>}
   */
  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  /**
   * Returns all unique undirected edges for map visualization.
   * @returns {Array<{from: string, to: string, fromCoords: [number, number], toCoords: [number, number], weightKm: number, durationMin: number}>}
   */
  getAllEdges() {
    const edges = [];
    const seen = new Set();

    for (const [u, neighbors] of this.adjacencyList.entries()) {
      const fromNode = this.getNode(u);
      for (const edge of neighbors) {
        const key = [u, edge.node].sort().join('--');
        if (!seen.has(key)) {
          seen.add(key);
          const toNode = this.getNode(edge.node);
          if (fromNode && toNode) {
            edges.push({
              from: u,
              to: edge.node,
              fromName: fromNode.name,
              toName: toNode.name,
              fromCoords: fromNode.coords,
              toCoords: toNode.coords,
              weightKm: edge.weightKm,
              durationMin: edge.durationMin,
            });
          }
        }
      }
    }

    return edges;
  }
}

/**
 * Creates and seeds the default 15-node metropolitan transit graph ('A1' through 'A15').
 */
const createSeededCityGraph = () => {
  const graph = new Graph();

  // 15 Realistic City Intersection Nodes (A1 - A15)
  const seedNodes = [
    { id: 'A1', coords: [12.9756, 77.6066], name: 'MG Road Metro Hub' },
    { id: 'A2', coords: [12.9719, 77.5937], name: 'Cubbon Park Central' },
    { id: 'A3', coords: [12.9784, 77.6408], name: 'Indiranagar 100ft Junction' },
    { id: 'A4', coords: [12.9611, 77.6387], name: 'Domlur Flyover Terminal' },
    { id: 'A5', coords: [12.9698, 77.6205], name: 'Trinity Circle Plaza' },
    { id: 'A6', coords: [12.9592, 77.6074], name: 'Richmond Circle Crossing' },
    { id: 'A7', coords: [12.9507, 77.5848], name: 'Lalbagh West Gate' },
    { id: 'A8', coords: [12.9352, 77.6245], name: 'Koramangala Sony World' },
    { id: 'A9', coords: [12.9279, 77.6271], name: 'Koramangala Water Tank' },
    { id: 'A10', coords: [12.9121, 77.6446], name: 'HSR Layout BDA Complex' },
    { id: 'A11', coords: [12.9166, 77.6101], name: 'BTM Layout Udupi Garden' },
    { id: 'A12', coords: [12.9254, 77.5838], name: 'Jayanagar 4th Block Bus Stand' },
    { id: 'A13', coords: [12.9176, 77.6228], name: 'Silk Board Tech Flyover' },
    { id: 'A14', coords: [12.9299, 77.6768], name: 'Bellandur EcoSpace Gate' },
    { id: 'A15', coords: [12.9569, 77.7011], name: 'Marathahalli Bridge Hub' },
  ];

  seedNodes.forEach(({ id, coords, name }) => {
    graph.addNode(id, coords, name);
  });

  // Realistic street edges connecting the 15 intersections (u, v, weightKm, durationMin)
  const seedEdges = [
    ['A1', 'A2', 1.6, 4],
    ['A1', 'A5', 1.8, 5],
    ['A1', 'A6', 2.0, 6],
    ['A2', 'A6', 1.9, 5],
    ['A2', 'A7', 2.6, 7],
    ['A5', 'A3', 2.4, 6],
    ['A5', 'A4', 2.2, 6],
    ['A5', 'A6', 1.7, 5],
    ['A3', 'A4', 2.0, 5],
    ['A3', 'A15', 7.1, 16],
    ['A4', 'A8', 3.3, 9],
    ['A4', 'A14', 5.4, 13],
    ['A4', 'A15', 6.8, 15],
    ['A6', 'A7', 2.7, 7],
    ['A6', 'A8', 3.4, 9],
    ['A7', 'A12', 2.9, 8],
    ['A8', 'A9', 1.1, 3],
    ['A8', 'A14', 5.8, 14],
    ['A9', 'A10', 2.6, 7],
    ['A9', 'A11', 2.2, 6],
    ['A9', 'A13', 1.5, 4],
    ['A10', 'A13', 2.5, 6],
    ['A10', 'A14', 4.1, 10],
    ['A11', 'A12', 3.0, 8],
    ['A11', 'A13', 1.4, 4],
    ['A12', 'A7', 2.9, 8],
    ['A13', 'A14', 6.0, 14],
    ['A14', 'A15', 4.0, 10],
  ];

  seedEdges.forEach(([u, v, weightKm, durationMin]) => {
    graph.addEdge(u, v, weightKm, durationMin);
  });

  return graph;
};

const cityGraph = createSeededCityGraph();

module.exports = {
  Graph,
  cityGraph,
  createSeededCityGraph,
};
