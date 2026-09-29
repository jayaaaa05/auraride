const express = require('express');
const router = express.Router();
const {
  getNetworkGraph,
  calculateRoute,
  executeBenchmark,
  getSpatialDrivers,
  dispatchRide,
} = require('../controllers/dsaController');

router.get('/network', getNetworkGraph);
router.post('/route', calculateRoute);
router.get('/benchmark', executeBenchmark);
router.post('/benchmark', executeBenchmark);
router.get('/spatial-drivers', getSpatialDrivers);
router.post('/dispatch', dispatchRide);

module.exports = router;
