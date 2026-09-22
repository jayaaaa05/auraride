const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 6000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.warn(
      `[MongoDB Warning] Could not reach Atlas (${error.message}). Running with hybrid in-memory + DSA store active.`
    );
    return null;
  }
};

module.exports = connectDB;
