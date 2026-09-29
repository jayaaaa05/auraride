const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getMetrics,
  getDrivers,
  toggleVerifyDriver,
  toggleBlockUser,
  getRides,
} = require('../controllers/adminController');

// All routes in this router require a valid JWT token and 'admin' role
router.use(authMiddleware.protect, authMiddleware.authorizeRoles('admin'));

router.get('/metrics', getMetrics);
router.get('/drivers', getDrivers);
router.patch('/drivers/:id/verify', toggleVerifyDriver);
router.patch('/users/:id/block', toggleBlockUser);
router.get('/rides', getRides);

module.exports = router;
