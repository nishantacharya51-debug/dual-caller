const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Rate limiter specifically for auth endpoints
const authRateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 900, // 15 minutes
  blockDuration: 900,
});

// In-memory user store (use a real database in production)
const users = new Map();
const familyGroups = new Map();

// Input validation middleware
const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 alphanumeric characters'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be at least 8 characters'),
  body('role')
    .isIn(['parent', 'child'])
    .withMessage('Role must be parent or child'),
  body('familyCode')
    .optional()
    .isLength({ min: 6, max: 20 })
    .withMessage('Family code must be 6-20 characters'),
];

const loginValidation = [
  body('username').isLength({ min: 3, max: 30 }).trim().escape(),
  body('password').isLength({ min: 1, max: 128 }),
];

// Register endpoint
router.post('/register', registerValidation, async (req, res) => {
  try {
    await authRateLimiter.consume(req.ip);
  } catch (rlRejected) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password, role, familyCode } = req.body;

  if (users.has(username)) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
  const userId = uuidv4();

  let userFamilyCode;

  if (role === 'parent') {
    // Parent creates a new family group or uses existing code
    userFamilyCode = familyCode || uuidv4().substring(0, 8).toUpperCase();
    if (!familyGroups.has(userFamilyCode)) {
      familyGroups.set(userFamilyCode, {
        parentId: userId,
        children: [],
        createdAt: new Date().toISOString(),
      });
    }
  } else {
    // Child must provide a family code to join
    if (!familyCode) {
      return res.status(400).json({ error: 'Children must provide a family code' });
    }
    if (!familyGroups.has(familyCode)) {
      return res.status(404).json({ error: 'Family code not found' });
    }
    userFamilyCode = familyCode;
    familyGroups.get(familyCode).children.push(userId);
  }

  users.set(username, {
    id: userId,
    username,
    password: hashedPassword,
    role,
    familyCode: userFamilyCode,
    createdAt: new Date().toISOString(),
  });

  const token = jwt.sign(
    { userId, username, role, familyCode: userFamilyCode },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '1h' }
  );

  res.status(201).json({
    message: 'Registration successful',
    token,
    user: { id: userId, username, role, familyCode: userFamilyCode },
  });
});

// Login endpoint
router.post('/login', loginValidation, async (req, res) => {
  try {
    await authRateLimiter.consume(req.ip);
  } catch (rlRejected) {
    return res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;
  const user = users.get(username);

  if (!user) {
    // Constant-time response to prevent user enumeration
    await bcrypt.hash(password, 12);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role, familyCode: user.familyCode },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '1h' }
  );

  res.json({
    message: 'Login successful',
    token,
    user: { id: user.id, username: user.username, role: user.role, familyCode: user.familyCode },
  });
});

// Verify token endpoint
router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

module.exports = router;