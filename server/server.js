require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-min-32-chars-abcdef1234567890';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// CORS
app.use(cors({ origin: '*' }));
app.use(express.json());

// Serve static files (WITHOUT helmet blocking scripts)
app.use(express.static(path.join(__dirname, '../public')));

// Storage
const users = new Map();
const families = new Map();
const connectedUsers = new Map();

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    users: users.size, 
    families: families.size,
    time: new Date().toISOString()
  });
});

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.get('/child', (req, res) => res.sendFile(path.join(__dirname, '../public/child.html')));
app.get('/parent', (req, res) => res.sendFile(path.join(__dirname, '../public/parent.html')));

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('📝 Register attempt:', req.body.username);
    const { username, password, role, familyCode } = req.body;
    
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Please fill all fields' });
    }
    
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username too short (min 3 chars)' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password too short (min 8 chars)' });
    }
    
    if (users.has(username.toLowerCase())) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const hash = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    let famCode;

    if (role === 'parent') {
      famCode = familyCode ? familyCode.toUpperCase() : uuidv4().substring(0, 6).toUpperCase();
      if (!families.has(famCode)) {
        families.set(famCode, { parentId: userId, children: [] });
      }
    } else if (role === 'child') {
      if (!familyCode) {
        return res.status(400).json({ error: 'Family code required' });
      }
      famCode = familyCode.toUpperCase();
      if (!families.has(famCode)) {
        return res.status(404).json({ error: 'Family code not found' });
      }
      families.get(famCode).children.push(userId);
    } else {
      return res.status(400).json({ error: 'Invalid role' });
    }

    users.set(username.toLowerCase(), { 
      id: userId, username, password: hash, role, familyCode: famCode 
    });
    
    const token = jwt.sign(
      { userId, username, role, familyCode: famCode }, 
      JWT_SECRET, 
      { expiresIn: '2h' }
    );
    
    console.log(`✅ Registered: ${username} (${role}) - Code: ${famCode}`);
    
    res.json({ 
      token, 
      user: { id: userId, username, role, familyCode: famCode }
    });
  } catch (e) {
    console.error('❌ Register error:', e.message);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔑 Login attempt:', req.body.username);
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Please fill all fields' });
    }
    
    const user = users.get(username.toLowerCase());
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role, familyCode: user.familyCode }, 
      JWT_SECRET, 
      { expiresIn: '2h' }
    );
    
    console.log(`✅ Login success: ${username}`);
    
    res.json({ 
      token, 
      user: { id: user.id, username: user.username, role: user.role, familyCode: user.familyCode }
    });
  } catch (e) {
    console.error('❌ Login error:', e.message);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

// Verify token
app.get('/api/auth/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// Socket authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Auth required'));
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

// Socket events
io.on('connection', (socket) => {
  const { userId, username, role, familyCode } = socket.user;
  const room = `fam_${familyCode}`;
  
  socket.join(room);
  connectedUsers.set(socket.id, { userId, username, role, familyCode });
  console.log(`🔌 ${username} (${role}) connected`);

  socket.to(room).emit('family-member-connected', { username, role, userId });

  // Send family status
  const members = [];
  connectedUsers.forEach((u, sid) => {
    if (u.familyCode === familyCode) members.push({ ...u, socketId: sid });
  });
  
  socket.emit('family-status', {
    parents: members.filter(u => u.role === 'parent'),
    children: members.filter(u => u.role === 'child')
  });

  // Camera events
  socket.on('camera-permission-granted', () => {
    console.log(`📷 ${username} camera available`);
    socket.to(room).emit('child-camera-available', {
      childId: userId, 
      childUsername: username, 
      childSocketId: socket.id
    });
  });

  socket.on('camera-permission-revoked', () => {
    socket.to(room).emit('child-camera-unavailable', { 
      childId: userId, childUsername: username 
    });
  });

  socket.on('request-view-camera', (data) => {
    console.log(`👁️ ${username} requesting view from ${data.childSocketId}`);
    io.to(data.childSocketId).emit('parent-requests-camera', {
      parentUsername: username, 
      parentSocketId: socket.id, 
      parentUserId: userId
    });
  });

  socket.on('approve-camera-request', (data) => {
    io.to(data.parentSocketId).emit('camera-request-response', {
      approved: data.approved, 
      childSocketId: socket.id,
      childUsername: username, 
      childUserId: userId
    });
  });

  // WebRTC signaling
  socket.on('webrtc-offer', (data) => {
    io.to(data.targetSocketId).emit('webrtc-offer', {
      offer: data.offer, 
      senderSocketId: socket.id, 
      senderUsername: username
    });
  });

  socket.on('webrtc-answer', (data) => {
    io.to(data.targetSocketId).emit('webrtc-answer', {
      answer: data.answer, 
      senderSocketId: socket.id
    });
  });

  socket.on('webrtc-ice-candidate', (data) => {
    io.to(data.targetSocketId).emit('webrtc-ice-candidate', {
      candidate: data.candidate, 
      senderSocketId: socket.id
    });
  });
  // CAMERA SWITCH REQUEST (Parent → Child)
socket.on('switch-camera-request', (data) => {
  console.log(`🔄 ${username} switching camera to ${data.facingMode}`);
  io.to(data.targetSocketId).emit('switch-camera-request', {
    facingMode: data.facingMode,
    senderSocketId: socket.id
  });
});

  socket.on('ping', () => socket.emit('pong'));

  socket.on('disconnect', () => {
    connectedUsers.delete(socket.id);
    socket.to(room).emit('family-member-disconnected', { username, role, userId });
    console.log(`🔌 ${username} disconnected`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Static: ${path.join(__dirname, '../public')}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
});
