/**
 * @file createAdmin.js
 * @description Dedicated CLI utility to provision administrative accounts for AuraRide.
 * Keeps administrator account creation strictly separate from public registration.
 *
 * Usage:
 *   node scripts/createAdmin.js [name] [email] [password] [phone]
 * Example:
 *   node scripts/createAdmin.js "Ops Lead" ops@auraride.in SecurePass123! +919876543210
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');

async function createAdmin() {
  const args = process.argv.slice(2);
  const name = args[0] || process.env.ADMIN_NAME || 'AuraRide System Admin';
  const email = (args[1] || process.env.ADMIN_EMAIL || 'admin@auraride.in').toLowerCase().trim();
  const password = args[2] || process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@AuraRide2026';
  const phone = args[3] || '+91 99999 00000';

  console.log(`[AuraRide Admin Provisioning] Target email: ${email}`);

  await connectDB();

  if (mongoose.connection.readyState !== 1) {
    console.warn('[Warning] MongoDB is not reachable. Ensure MONGO_URI is configured.');
    process.exit(1);
  }

  try {
    const existing = await User.findOne({ email });
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (existing) {
      existing.name = name;
      existing.password = hashedPassword;
      existing.role = 'admin';
      existing.phone = phone;
      existing.isBlocked = false;
      await existing.save();
      console.log(`[Success] Existing user account updated to Administrator role: ${email}`);
    } else {
      await User.create({
        name,
        email,
        password: hashedPassword,
        phone,
        role: 'admin',
      });
      console.log(`[Success] New Administrator account successfully created: ${email}`);
    }
  } catch (err) {
    console.error(`[Error] Failed to provision admin: ${err.message}`);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createAdmin();
