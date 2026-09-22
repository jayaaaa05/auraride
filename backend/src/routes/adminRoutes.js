const express = require('express');
const router = express.Router();
const {
  getMetrics,
  getDrivers,
  toggleVerifyDriver,
  toggleBlockUser,
  getRides,
} = require('../controllers/adminController');

router.get('/metrics', getMetrics);
router.get('/drivers', getDrivers);
router.patch('/drivers/:id/verify', toggleVerifyDriver);
router.patch('/users/:id/block', toggleBlockUser);
router.get('/rides', getRides);

module.exports = router;
