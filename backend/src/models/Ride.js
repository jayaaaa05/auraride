const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema(
  {
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
    },
    vehicleType: {
      type: String,
      enum: ['Moto', 'Auto', 'Economy', 'Premium'],
      required: true,
    },
    pickup: {
      address: {
        type: String,
        required: true,
        trim: true,
      },
      lat: {
        type: Number,
        required: true,
      },
      lng: {
        type: Number,
        required: true,
      },
    },
    destination: {
      address: {
        type: String,
        required: true,
        trim: true,
      },
      lat: {
        type: Number,
        required: true,
      },
      lng: {
        type: Number,
        required: true,
      },
    },
    distanceKm: {
      type: Number,
      required: true,
      min: 0,
    },
    durationMin: {
      type: Number,
      required: true,
      min: 0,
    },
    fare: {
      type: Number,
      required: true,
      min: 0,
    },
    otp: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: [
        'REQUESTED',
        'SEARCHING',
        'ASSIGNED',
        'ARRIVING',
        'ARRIVED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
      ],
      default: 'REQUESTED',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Ride', rideSchema);
