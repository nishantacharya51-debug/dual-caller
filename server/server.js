require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const authRouter = require('./auth');
const setupSignaling = require('./signaling');

const app = express();
const server = http.createServer(app);

// Rate limiter for general requests
const rateLimiter = new RateLimiterMemory({
  points: 100,
  duration: 60, // per 60 seconds
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws://localhost:3000", "wss://localhost:3000"],
      mediaSrc: ["'self'", "blob:"],
      workerSrc: ["'self'", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: '*',
  credentials: true,
}));

app.use(express.json({ limit: '1kb' }));

// Rate limiting middleware
app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Auth routes
app.use('/api/auth', authRouter);

// Page routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/child', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'child.html'));
});

app.get('/parent', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'parent.html'));
});

// Socket.IO setup with authentication
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 30000,
  pingInterval: 10000,
});

// Setup WebRTC signaling
setupSignaling(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Secure Parental Monitor running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});