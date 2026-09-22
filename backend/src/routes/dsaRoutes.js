const express = require('express');
const router = express.Router();
const {
  getNetworkGraph,
  calculateRoute,
  dispatchRide,
} = require('../controllers/dsaController');

router.get('/network', getNetworkGraph);
router.post('/route', calculateRoute);
router.post('/dispatch', dispatchRide);

module.exports = router;
