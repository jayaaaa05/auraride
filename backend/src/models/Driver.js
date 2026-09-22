const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    vehicle: {
      model: {
        type: String,
        required: [true, 'Vehicle model is required'],
        trim: true,
      },
      plateNumber: {
        type: String,
        required: [true, 'Vehicle plate number is required'],
        uppercase: true,
        trim: true,
      },
      type: {
        type: String,
        enum: ['Moto', 'Auto', 'Economy', 'Premium'],
        required: [true, 'Vehicle type is required'],
      },
      capacity: {
        type: Number,
        required: [true, 'Vehicle capacity is required'],
        min: 1,
        default: 4,
      },
    },
    licenseNumber: {
      type: String,
      required: [true, 'Driver license number is required'],
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    currentLocation: {
      lat: {
        type: Number,
        default: 0,
      },
      lng: {
        type: Number,
        default: 0,
      },
    },
    rating: {
      type: Number,
      default: 5.0,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Driver', driverSchema);
