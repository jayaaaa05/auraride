require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const dsaRoutes = require('./routes/dsaRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { initializeSocketHandler } = require('./socket/socketHandler');

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO on the HTTP server
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
});

app.set('io', io);

// Attach comprehensive real-time trip & telemetry Socket.IO handler
initializeSocketHandler(io);

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'AuraRide Real-Time Mobility & DSA Engine',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dsa', dsaRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`AuraRide Server & Socket.IO Engine listening on port ${PORT}`);
});
