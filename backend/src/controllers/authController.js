const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Driver = require('../models/Driver');
const { liveState } = require('../socket/socketHandler');

// In-memory fallback registry when MongoDB Atlas is unreachable during offline/local demos
const memoryUsersByEmail = new Map();
const memoryUsersById = new Map();

const isMongoConnected = () => mongoose.connection.readyState === 1;

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id || user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// @desc    Register a new Rider or Driver
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      role = 'rider',
      vehicle,
      licenseNumber,
    } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, password, and phone number.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedRole = ['rider', 'driver', 'admin'].includes(role)
      ? role
      : 'rider';

    if (normalizedRole === 'driver') {
      if (
        !licenseNumber ||
        !vehicle ||
        !vehicle.model ||
        !vehicle.plateNumber ||
        !vehicle.type
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Driver registration requires license number and complete vehicle details (model, plateNumber, type).',
        });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (isMongoConnected()) {
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists.',
        });
      }

      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        phone: phone.trim(),
        role: normalizedRole,
      });

      let driverProfile = null;
      if (normalizedRole === 'driver') {
        const defaultCapacities = { Moto: 1, Auto: 3, Economy: 4, Premium: 4 };
        const vehicleCapacity =
          Number(vehicle.capacity) || defaultCapacities[vehicle.type] || 4;

        driverProfile = await Driver.create({
          user: user._id,
          vehicle: {
            model: vehicle.model.trim(),
            plateNumber: vehicle.plateNumber.trim().toUpperCase(),
            type: vehicle.type,
            capacity: vehicleCapacity,
          },
          licenseNumber: licenseNumber.trim(),
        });

        liveState.drivers.set(String(driverProfile._id), {
          id: String(driverProfile._id),
          _id: String(driverProfile._id),
          userId: String(user._id),
          name: user.name,
          email: user.email,
          phone: user.phone,
          vehicle: driverProfile.vehicle,
          licenseNumber: driverProfile.licenseNumber,
          isVerified: false,
          isOnline: true,
          isBlocked: false,
          rating: 5.0,
          completedTrips: 0,
          totalEarnings: 0,
          currentLocation: { lat: 12.9716, lng: 77.5946 },
        });
      }

      const token = generateToken(user);

      return res.status(201).json({
        success: true,
        message: 'Registration successful',
        token,
        user: {
          _id: user._id,
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          savedLocations: user.savedLocations,
          isBlocked: user.isBlocked,
          driverProfile,
        },
      });
    }

    // Hybrid fallback when MongoDB is unreachable
    if (memoryUsersByEmail.has(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const memId = `USR-${Date.now().toString().slice(-6)}`;
    let driverProfile = null;

    if (normalizedRole === 'driver') {
      const drvId = `DRV-${Date.now().toString().slice(-4)}`;
      driverProfile = {
        _id: drvId,
        id: drvId,
        user: memId,
        vehicle: {
          model: vehicle.model.trim(),
          plateNumber: vehicle.plateNumber.trim().toUpperCase(),
          type: vehicle.type,
          capacity: Number(vehicle.capacity) || 4,
        },
        licenseNumber: licenseNumber.trim(),
        isVerified: false,
        isOnline: true,
        rating: 5.0,
        totalRatings: 0,
        totalEarnings: 0,
      };

      liveState.drivers.set(drvId, {
        ...driverProfile,
        name: name.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        isBlocked: false,
        completedTrips: 0,
        currentLocation: { lat: 12.9716, lng: 77.5946 },
      });
    }

    const memUser = {
      _id: memId,
      id: memId,
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone.trim(),
      role: normalizedRole,
      savedLocations: [],
      isBlocked: false,
      driverProfile,
    };

    memoryUsersByEmail.set(normalizedEmail, memUser);
    memoryUsersById.set(memId, memUser);

    const token = generateToken(memUser);
    const { password: _, ...safeUser } = memUser;

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration',
    });
  }
};

// @desc    Authenticate user & return token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (isMongoConnected()) {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
      }

      if (user.isBlocked) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been blocked. Please contact support.',
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
      }

      let driverProfile = null;
      if (user.role === 'driver') {
        driverProfile = await Driver.findOne({ user: user._id });
      }

      const token = generateToken(user);

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          _id: user._id,
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          savedLocations: user.savedLocations,
          isBlocked: user.isBlocked,
          driverProfile,
        },
      });
    }

    // Check in-memory registered users
    const memUser = memoryUsersByEmail.get(normalizedEmail);
    if (memUser) {
      const isMatch = await bcrypt.compare(password, memUser.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
      }
      const token = generateToken(memUser);
      const { password: _, ...safeUser } = memUser;
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: safeUser,
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid email or password.',
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during login',
    });
  }
};

// @desc    Get current authenticated user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    let driverProfile = req.user.driverProfile || null;
    if (isMongoConnected() && req.user.role === 'driver' && !driverProfile) {
      driverProfile = await Driver.findOne({ user: req.user._id });
    }

    return res.status(200).json({
      success: true,
      user: {
        _id: req.user._id || req.user.id,
        id: req.user._id || req.user.id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        role: req.user.role,
        savedLocations: req.user.savedLocations || [],
        isBlocked: Boolean(req.user.isBlocked),
        driverProfile,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user profile',
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  memoryUsersById,
};
