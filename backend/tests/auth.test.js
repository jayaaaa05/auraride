const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const { app } = require('../src/server');

describe('AuraRide Authentication & Registration Security Suite', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api/auth`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  test('POST /register - successfully registers a rider', async () => {
    const uniqueEmail = `rider_${Date.now()}@example.com`;
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Priya Sharma',
        email: uniqueEmail,
        password: 'Password123!',
        phone: '+91 98450 11001',
        role: 'rider',
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 201);
    assert.equal(data.success, true);
    assert.ok(data.token, 'Should return JWT token');
    assert.equal(data.user.email, uniqueEmail);
    assert.equal(data.user.role, 'rider');
    assert.equal(data.user.password, undefined, 'Password must not be returned');
  });

  test('POST /register - successfully registers a driver with vehicle details', async () => {
    const uniqueEmail = `driver_${Date.now()}@example.com`;
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ramesh Babu',
        email: uniqueEmail,
        password: 'Password123!',
        phone: '+91 98450 22002',
        role: 'driver',
        licenseNumber: 'KA-01-202300189',
        vehicle: {
          model: 'Tata Tigor EV',
          plateNumber: 'KA 03 EV 9901',
          type: 'Economy',
          capacity: 4,
        },
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 201);
    assert.equal(data.success, true);
    assert.ok(data.token);
    assert.equal(data.user.role, 'driver');
  });

  test('POST /register - REJECTS public admin registration (Security Item 2)', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Malicious Attacker',
        email: `hacker_${Date.now()}@example.com`,
        password: 'HackedPassword123!',
        phone: '+91 98450 66666',
        role: 'admin',
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.match(
      data.message,
      /admin registration is not permitted/i,
      'Must reject public admin registration attempts'
    );
  });

  test('POST /register - rejects duplicate email registration', async () => {
    const dupEmail = `duplicate_${Date.now()}@example.com`;
    // Register first
    await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'First User',
        email: dupEmail,
        password: 'Password123!',
        phone: '+91 98450 33003',
        role: 'rider',
      }),
    });

    // Attempt second registration with same email
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Second User',
        email: dupEmail,
        password: 'Password456!',
        phone: '+91 98450 44004',
        role: 'rider',
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.match(data.message, /already exists/i);
  });

  test('POST /login - authenticates valid credentials successfully', async () => {
    const loginEmail = `login_${Date.now()}@example.com`;
    await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Valid Login User',
        email: loginEmail,
        password: 'CorrectPassword123!',
        phone: '+91 98450 55005',
        role: 'rider',
      }),
    });

    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: loginEmail,
        password: 'CorrectPassword123!',
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.ok(data.token, 'Should return JWT on successful login');
    assert.equal(data.user.email, loginEmail);
  });

  test('POST /login - rejects invalid password', async () => {
    const testEmail = `pwtest_${Date.now()}@example.com`;
    await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Password Test User',
        email: testEmail,
        password: 'RealPassword123!',
        phone: '+91 98450 77007',
        role: 'rider',
      }),
    });

    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword999!',
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 401);
    assert.equal(data.success, false);
    assert.match(data.message, /invalid email or password/i);
  });

  test('POST /login - rejects non-existent email', async () => {
    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ghost_user_does_not_exist@auraride.in',
        password: 'AnyPassword123!',
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 401);
    assert.equal(data.success, false);
  });
});
