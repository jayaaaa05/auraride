const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Driver = require('../models/Driver');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email },
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
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

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

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone.trim(),
      role: normalizedRole,
    });

    let driverProfile = null;
    if (normalizedRole === 'driver') {
      try {
        const defaultCapacities = {
          Moto: 1,
          Auto: 3,
          Economy: 4,
          Premium: 4,
        };
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
      } catch (driverError) {
        await User.findByIdAndDelete(user._id);
        return res.status(400).json({
          success: false,
          message: `Failed to create driver profile: ${driverError.message}`,
        });
      }
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
    let driverProfile = null;
    if (req.user.role === 'driver') {
      driverProfile = await Driver.findOne({ user: req.user._id });
    }

    return res.status(200).json({
      success: true,
      user: {
        _id: req.user._id,
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        role: req.user.role,
        savedLocations: req.user.savedLocations,
        isBlocked: req.user.isBlocked,
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
};
