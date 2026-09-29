const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { app } = require('../src/server');

describe('AuraRide Admin Security & RBAC Suite', () => {
  let server;
  let baseUrl;
  let riderToken;
  let driverToken;
  let adminToken;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api`;

    const jwtSecret = process.env.JWT_SECRET || 'auraride_super_secret_jwt_key_2026';

    // Generate tokens for each role
    riderToken = jwt.sign(
      { id: 'USR-RIDER-TEST', role: 'rider', email: 'test_rider@auraride.in' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    driverToken = jwt.sign(
      { id: 'DRV-TEST', role: 'driver', email: 'test_driver@auraride.in' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    adminToken = jwt.sign(
      { id: 'USR-ADM-TEST', role: 'admin', email: 'admin@auraride.in' },
      jwtSecret,
      { expiresIn: '1h' }
    );
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  test('GET /admin/metrics - REJECTS unauthenticated requests (HTTP 401)', async () => {
    const res = await fetch(`${baseUrl}/admin/metrics`);
    const data = await res.json();

    assert.equal(res.status, 401, 'Unauthenticated request must receive 401');
    assert.equal(data.success, false);
    assert.match(data.message, /unauthorized/i);
  });

  test('GET /admin/metrics - REJECTS riders with HTTP 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/admin/metrics`, {
      headers: {
        Authorization: `Bearer ${riderToken}`,
      },
    });
    const data = await res.json();

    assert.equal(res.status, 403, 'Riders must receive 403 when accessing admin functionality');
    assert.equal(data.success, false);
    assert.match(data.message, /forbidden|insufficient permissions/i);
  });

  test('GET /admin/metrics - REJECTS drivers with HTTP 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/admin/metrics`, {
      headers: {
        Authorization: `Bearer ${driverToken}`,
      },
    });
    const data = await res.json();

    assert.equal(res.status, 403, 'Drivers must receive 403 when accessing admin functionality');
    assert.equal(data.success, false);
    assert.match(data.message, /forbidden|insufficient permissions/i);
  });

  test('GET /admin/metrics - ALLOWS authenticated admin with HTTP 200 OK', async () => {
    const res = await fetch(`${baseUrl}/admin/metrics`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const data = await res.json();

    assert.equal(res.status, 200, 'Admins must be allowed access');
    assert.equal(data.success, true);
    assert.ok(data.metrics, 'Must return metrics object');
    assert.equal(typeof data.metrics.onlineDriversCount, 'number');
    assert.equal(typeof data.metrics.dsaQueryCount, 'number');
  });

  test('GET /admin/drivers - ALLOWS authenticated admin to inspect fleet', async () => {
    const res = await fetch(`${baseUrl}/admin/drivers`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.drivers), 'Must return drivers array');
    assert.ok(data.drivers.length > 0, 'Fleet pool must contain drivers');
  });

  test('GET /admin/rides - ALLOWS authenticated admin to inspect rides', async () => {
    const res = await fetch(`${baseUrl}/admin/rides`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.rides), 'Must return rides array');
  });
});
