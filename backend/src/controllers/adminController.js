/**
 * @file adminController.js
 * @description Admin & Platform Analytics controller for AuraRide.
 * Provides live platform metrics, driver verification toggles, account blocking,
 * and real-time ride inspection synced with both MongoDB and Socket.IO liveState.
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Ride = require('../models/Ride');
const {
  liveState,
  computePlatformMetrics,
} = require('../socket/socketHandler');

const isValidObjectId = (id) =>
  typeof id === 'string' &&
  mongoose.Types.ObjectId.isValid(id) &&
  String(new mongoose.Types.ObjectId(id)) === id;

// @desc    Get platform-wide revenue, active trips, online drivers, and DSA query metrics
// @route   GET /api/admin/metrics
// @access  Public / Admin
const getMetrics = async (req, res) => {
  try {
    const baseMetrics = computePlatformMetrics();

    // Also query MongoDB counts if connected
    let dbCompletedCount = 0;
    let dbRevenue = 0;
    try {
      const dbCompletedRides = await Ride.find({ status: 'COMPLETED' }).lean();
      dbCompletedCount = dbCompletedRides.length;
      dbRevenue = dbCompletedRides.reduce((acc, r) => acc + Number(r.fare || 0), 0);
    } catch {
      // Fallback to in-memory metrics
    }

    return res.status(200).json({
      success: true,
      metrics: {
        ...baseMetrics,
        totalCompletedRides: Math.max(
          baseMetrics.totalCompletedRides,
          dbCompletedCount
        ),
        grossPlatformRevenue: Math.max(
          baseMetrics.grossPlatformRevenue,
          dbRevenue
        ),
      },
    });
  } catch (error) {
    console.error('Admin getMetrics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load platform metrics',
    });
  }
};

// @desc    List all drivers with verification status and block toggles
// @route   GET /api/admin/drivers
// @access  Public / Admin
const getDrivers = async (req, res) => {
  try {
    let dbDrivers = [];
    try {
      const docs = await Driver.find().populate('user', 'name email phone isBlocked').lean();
      dbDrivers = docs.map((d) => ({
        id: String(d._id),
        _id: String(d._id),
        userId: d.user ? String(d.user._id) : null,
        name: d.user?.name || 'Registered Driver',
        email: d.user?.email || 'driver@auraride.in',
        phone: d.user?.phone || '+91 98450 00000',
        vehicle: d.vehicle,
        licenseNumber: d.licenseNumber,
        isVerified: Boolean(d.isVerified),
        isOnline: Boolean(d.isOnline),
        isBlocked: Boolean(d.user?.isBlocked),
        rating: Number(d.rating ?? 5.0),
        completedTrips: Number(d.totalRatings || 0),
        totalEarnings: Number(d.totalEarnings || 0),
        currentLocation: d.currentLocation || { lat: 12.9716, lng: 77.5946 },
      }));
    } catch {
      dbDrivers = [];
    }

    // Merge DB drivers into liveState so all drivers are unified
    dbDrivers.forEach((drv) => {
      if (!liveState.drivers.has(drv.id)) {
        liveState.drivers.set(drv.id, drv);
      }
    });

    const unifiedDrivers = Array.from(liveState.drivers.values());

    return res.status(200).json({
      success: true,
      count: unifiedDrivers.length,
      drivers: unifiedDrivers,
    });
  } catch (error) {
    console.error('Admin getDrivers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load drivers list',
    });
  }
};

// @desc    Toggle driver verification status (isVerified)
// @route   PATCH /api/admin/drivers/:id/verify
// @access  Public / Admin
const toggleVerifyDriver = async (req, res) => {
  try {
    const { id } = req.params;
    let updatedDriver = null;

    if (liveState.drivers.has(id)) {
      const drv = liveState.drivers.get(id);
      drv.isVerified =
        typeof req.body?.isVerified === 'boolean'
          ? req.body.isVerified
          : !drv.isVerified;
      liveState.drivers.set(id, drv);
      updatedDriver = drv;
    }

    if (isValidObjectId(id)) {
      try {
        const dbDoc = await Driver.findById(id).populate('user', 'name email phone isBlocked');
        if (dbDoc) {
          dbDoc.isVerified =
            typeof req.body?.isVerified === 'boolean'
              ? req.body.isVerified
              : !dbDoc.isVerified;
          await dbDoc.save();
          updatedDriver = {
            id: String(dbDoc._id),
            _id: String(dbDoc._id),
            userId: dbDoc.user ? String(dbDoc.user._id) : null,
            name: dbDoc.user?.name || 'Driver',
            email: dbDoc.user?.email,
            phone: dbDoc.user?.phone,
            vehicle: dbDoc.vehicle,
            licenseNumber: dbDoc.licenseNumber,
            isVerified: dbDoc.isVerified,
            isOnline: dbDoc.isOnline,
            isBlocked: Boolean(dbDoc.user?.isBlocked),
            rating: dbDoc.rating,
            totalEarnings: dbDoc.totalEarnings,
          };
          liveState.drivers.set(String(dbDoc._id), updatedDriver);
        }
      } catch {
        // Handled by in-memory state
      }
    }

    if (!updatedDriver) {
      return res.status(404).json({
        success: false,
        message: `Driver ${id} not found`,
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('admin:driverUpdated', updatedDriver);
      io.to('admin').emit('admin:metricsUpdate', computePlatformMetrics());
    }

    return res.status(200).json({
      success: true,
      message: `Driver verification set to ${updatedDriver.isVerified}`,
      driver: updatedDriver,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update driver verification',
    });
  }
};

// @desc    Toggle user/driver blocked status (isBlocked)
// @route   PATCH /api/admin/users/:id/block
// @access  Public / Admin
const toggleBlockUser = async (req, res) => {
  try {
    const { id } = req.params;
    let targetState = null;

    if (liveState.drivers.has(id)) {
      const drv = liveState.drivers.get(id);
      drv.isBlocked =
        typeof req.body?.isBlocked === 'boolean'
          ? req.body.isBlocked
          : !drv.isBlocked;
      if (drv.isBlocked) {
        drv.isOnline = false;
      }
      liveState.drivers.set(id, drv);
      targetState = drv;
    }

    if (isValidObjectId(id)) {
      try {
        const userDoc = await User.findById(id);
        if (userDoc) {
          userDoc.isBlocked =
            typeof req.body?.isBlocked === 'boolean'
              ? req.body.isBlocked
              : !userDoc.isBlocked;
          await userDoc.save();
          targetState = {
            id: String(userDoc._id),
            name: userDoc.name,
            email: userDoc.email,
            isBlocked: userDoc.isBlocked,
          };
        }
      } catch {
        // Handled in memory
      }
    }

    if (!targetState) {
      return res.status(404).json({
        success: false,
        message: `Account ${id} not found`,
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('admin:driverUpdated', targetState);
      io.to('admin').emit('admin:metricsUpdate', computePlatformMetrics());
    }

    return res.status(200).json({
      success: true,
      message: `Account block status updated to ${targetState.isBlocked}`,
      account: targetState,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to toggle block status',
    });
  }
};

// @desc    Return recent & active rides with statuses and timestamps
// @route   GET /api/admin/rides
// @access  Public / Admin
const getRides = async (req, res) => {
  try {
    const memoryRides = Array.from(liveState.rides.values()).sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    return res.status(200).json({
      success: true,
      count: memoryRides.length,
      rides: memoryRides,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch rides',
    });
  }
};

module.exports = {
  getMetrics,
  getDrivers,
  toggleVerifyDriver,
  toggleBlockUser,
  getRides,
};
