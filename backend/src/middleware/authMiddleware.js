const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { memoryUsersById } = require('../controllers/authController');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No bearer token provided',
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Malformed authorization token',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let user = null;
    if (
      mongoose.connection.readyState === 1 &&
      mongoose.Types.ObjectId.isValid(decoded.id)
    ) {
      user = await User.findById(decoded.id).select('-password');
    }

    if (!user && memoryUsersById && memoryUsersById.has(decoded.id)) {
      user = memoryUsersById.get(decoded.id);
    }

    if (!user) {
      // Fallback decoded JWT claims
      user = {
        _id: decoded.id,
        id: decoded.id,
        email: decoded.email || 'user@auraride.in',
        name: decoded.name || 'AuraRide User',
        role: decoded.role || 'rider',
        isBlocked: false,
      };
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Your account has been suspended',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or expired token',
    });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient permissions for this resource',
      });
    }
    next();
  };
};

authMiddleware.protect = authMiddleware;
authMiddleware.authorizeRoles = authorizeRoles;

module.exports = authMiddleware;
