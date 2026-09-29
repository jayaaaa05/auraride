const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { cityGraph } = require('../src/dsa/Graph');
const { findShortestPath } = require('../src/dsa/Dijkstra');
const { findAStarPath } = require('../src/dsa/AStar');
const { QuadTree, Boundary } = require('../src/dsa/QuadTree');
const { matchDrivers, DEFAULT_SIMULATED_DRIVERS } = require('../src/dsa/DriverMatcher');
const { runAlgorithmBenchmark } = require('../src/dsa/Benchmark');

describe('AuraRide DSA Core Engine Suite', () => {
  test('Graph - initializes with 15 nodes and valid street connections', () => {
    const allNodes = cityGraph.getAllNodes();
    assert.equal(allNodes.length, 15, 'Must contain 15 city transit nodes');

    const nodeA1 = cityGraph.getNode('A1');
    assert.ok(nodeA1);
    assert.equal(nodeA1.name, 'MG Road Metro Hub');

    const neighbors = cityGraph.getNeighbors('A1');
    assert.ok(neighbors.length > 0, 'A1 must have connected neighbors');
  });

  test('Dijkstra - computes optimal shortest path from A1 to A10', () => {
    const result = findShortestPath('A1', 'A10', cityGraph);

    assert.equal(result.found, true);
    assert.equal(result.startNodeId, 'A1');
    assert.equal(result.endNodeId, 'A10');
    assert.ok(Array.isArray(result.path));
    assert.equal(result.path[0], 'A1');
    assert.equal(result.path[result.path.length - 1], 'A10');
    assert.ok(result.distanceKm > 0, 'Distance must be positive');
    assert.ok(result.durationMin > 0, 'Duration must be positive');
    assert.equal(result.complexity.time, 'O((V + E) log V)');
  });

  test('A* Search - finds globally optimal path equivalent in cost to Dijkstra', () => {
    const dijkstraResult = findShortestPath('A1', 'A10', cityGraph);
    const aStarResult = findAStarPath('A1', 'A10', cityGraph);

    assert.equal(aStarResult.found, true);
    assert.equal(aStarResult.startNodeId, 'A1');
    assert.equal(aStarResult.endNodeId, 'A10');

    // Both algorithms must find equivalent optimal path cost
    assert.equal(
      Math.abs(aStarResult.distanceKm - dijkstraResult.distanceKm) < 0.05,
      true,
      'A* must find optimal shortest distance matching Dijkstra'
    );

    // A* guided by Euclidean distance should explore fewer or equal nodes
    assert.ok(
      aStarResult.nodesEvaluated <= dijkstraResult.complexity.visitedNodesCount,
      'A* directed search evaluates fewer or equal nodes than uninformed Dijkstra'
    );
  });

  test('2D QuadTree - partitions spatial coordinates and queries radius correctly', () => {
    const qt = new QuadTree(new Boundary(12.945, 77.635, 0.085, 0.095), 2);

    // Insert simulated drivers
    DEFAULT_SIMULATED_DRIVERS.forEach((d) => qt.insert(d));

    // Query radius around A1 (12.9756, 77.6066)
    const pickupCoords = [12.9756, 77.6066];
    const spatialResult = qt.queryRadius(pickupCoords, 4.0);

    assert.ok(Array.isArray(spatialResult.drivers));
    assert.ok(spatialResult.drivers.length > 0, 'Should find nearby drivers in radius');
    assert.ok(spatialResult.telemetry.quadrantsVisited > 0);
    assert.ok(spatialResult.telemetry.pointsInspected > 0);
  });

  test('DriverMatcher - greedy Min-Heap ranks by proximity and rating', () => {
    const pickupCoords = [12.9756, 77.6066]; // MG Road
    const match = matchDrivers(pickupCoords, DEFAULT_SIMULATED_DRIVERS);

    assert.ok(match.optimalDriver, 'Must return an optimal driver match');
    assert.ok(Array.isArray(match.rankedDrivers));
    assert.ok(match.rankedDrivers.length > 1);

    // Min-heap ordering: rank 1 must have score <= rank 2
    assert.ok(match.rankedDrivers[0].score <= match.rankedDrivers[1].score);
  });

  test('DriverMatcher - strictly respects vehicle compatibility (no silent cross-tier fallback)', () => {
    const pickupCoords = [12.9756, 77.6066];

    // Request Moto
    const motoMatch = matchDrivers(pickupCoords, DEFAULT_SIMULATED_DRIVERS, 'Moto');
    assert.ok(motoMatch.optimalDriver);
    assert.equal(motoMatch.optimalDriver.vehicle.type, 'Moto');

    // Request Auto
    const autoMatch = matchDrivers(pickupCoords, DEFAULT_SIMULATED_DRIVERS, 'Auto');
    assert.ok(autoMatch.optimalDriver);
    assert.equal(autoMatch.optimalDriver.vehicle.type, 'Auto');

    // Request non-existent vehicle type -> returns null rather than wrong vehicle
    const nonExistent = matchDrivers(pickupCoords, DEFAULT_SIMULATED_DRIVERS, 'Helicopter');
    assert.equal(nonExistent.optimalDriver, null);
    assert.equal(nonExistent.rankedDrivers.length, 0);
  });

  test('Benchmark Engine - measures actual performance.now() timings and records path metrics', () => {
    const bench = runAlgorithmBenchmark('A1', 'A10', { iterations: 100 });

    assert.equal(bench.startNodeId, 'A1');
    assert.equal(bench.endNodeId, 'A10');
    assert.ok(bench.dijkstraTimeMs > 0, 'Dijkstra execution time must be measured');
    assert.ok(bench.aStarTimeMs > 0, 'A* execution time must be measured');
    assert.ok(bench.pathLength > 0, 'Must record path length');
    assert.ok(bench.pathCostKm > 0, 'Must record path cost');
    assert.ok(bench.dijkstraNodesVisited > 0);
    assert.ok(bench.aStarNodesVisited > 0);
    assert.equal(bench.dijkstraBigO, 'O((V + E) log V)');
    assert.match(bench.aStarBigO, /heuristic/i);
    assert.match(bench.spatialIndexing.complexity, /spatial point distribution/i);
  });
});
