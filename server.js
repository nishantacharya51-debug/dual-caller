const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const crypto = require('crypto');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory session store for signaling server (mirrors lib/sessionStore logic for simplicity)
class SessionStore {
  constructor() {
    this.sessions = new Map();
    this.SESSION_TTL = 1000 * 60 * 60 * 2;
    this.PARTICIPANT_TIMEOUT = 1000 * 60 * 5;
    this.CLEANUP_INTERVAL = 1000 * 60;
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }

  generateSecureSessionId() {
    return crypto.randomBytes(16).toString('base64url').substring(0, 16).toLowerCase();
  }

  generateParticipantToken() {
    return crypto.randomBytes(24).toString('base64url');
  }

  createSession(scheduledFor) {
    const id = this.generateSecureSessionId();
    const hostToken = this.generateParticipantToken();
    const session = {
      id,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.SESSION_TTL,
      participants: new Map(),
      participantCount: 0,
      status: 'waiting',
      scheduledFor,
    };
    this.sessions.set(id, session);
    return { session, hostToken };
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }
    return session;
  }

  tryJoinSession(sessionId, participantId) {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, reason: 'not_found' };
    if (session.status === 'ended') return { success: false, reason: 'expired' };

    if (participantId && session.participants.has(participantId)) {
      const existing = session.participants.get(participantId);
      existing.lastSeen = Date.now();
      return { success: true, participant: existing, isNewHost: false };
    }

    if (session.participantCount >= 2) {
      return { success: false, reason: 'full' };
    }

    const newParticipantId = participantId || crypto.randomUUID();
    const token = this.generateParticipantToken();
    const isHost = session.participantCount === 0;

    const participant = {
      id: newParticipantId,
      token,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      isHost,
    };

    session.participants.set(newParticipantId, participant);
    session.participantCount = session.participants.size;

    if (session.participantCount === 1) session.status = 'waiting';
    else if (session.participantCount === 2) session.status = 'active';

    session.expiresAt = Date.now() + this.SESSION_TTL;

    return { success: true, participant, isNewHost: isHost };
  }

  leaveSession(sessionId, participantId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    const existed = session.participants.delete(participantId);
    if (existed) {
      session.participantCount = session.participants.size;
      if (session.participantCount === 0) {
        session.status = 'ended';
        setTimeout(() => {
          if (session.participantCount === 0) this.sessions.delete(sessionId);
        }, this.PARTICIPANT_TIMEOUT);
      } else if (session.participantCount === 1) {
        session.status = 'waiting';
      }
    }
    return existed;
  }

  updateSocketId(sessionId, participantId, socketId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    const participant = session.participants.get(participantId);
    if (!participant) return false;
    participant.socketId = socketId;
    participant.lastSeen = Date.now();
    return true;
  }

  validateToken(sessionId, participantId, token) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    const participant = session.participants.get(participantId);
    if (!participant) return false;
    return participant.token === token;
  }

  cleanup() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(id);
        continue;
      }
      for (const [pId, participant] of session.participants.entries()) {
        if (now - participant.lastSeen > this.PARTICIPANT_TIMEOUT * 2) {
          session.participants.delete(pId);
        }
      }
      session.participantCount = session.participants.size;
      if (session.participantCount === 0 && now - session.createdAt > this.PARTICIPANT_TIMEOUT) {
        this.sessions.delete(id);
      }
    }
  }

  getStats() {
    return {
      totalSessions: this.sessions.size,
      activeSessions: Array.from(this.sessions.values()).filter(s => s.status === 'active').length,
      waitingSessions: Array.from(this.sessions.values()).filter(s => s.status === 'waiting').length,
      totalParticipants: Array.from(this.sessions.values()).reduce((acc, s) => acc + s.participantCount, 0),
    };
  }
}

const sessionStore = new SessionStore();

// Make sessionStore available to Next API routes via global
global.sessionStore = sessionStore;

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname } = parsedUrl;

      // Handle health check directly
      if (pathname === '/api/health-direct') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          sessions: sessionStore.getStats(),
          timestamp: new Date().toISOString(),
        }));
        return;
      }

      // Session API for custom server (fallback)
      if (pathname === '/api/session-direct' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const data = body ? JSON.parse(body) : {};
            const { session, hostToken } = sessionStore.createSession(data.scheduledFor);
            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({
              sessionId: session.id,
              hostToken,
              expiresAt: session.expiresAt,
            }));
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to create session' }));
          }
        });
        return;
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  // Rate limiting map
  const rateLimitMap = new Map();
  const RATE_LIMIT_WINDOW = 60000;
  const RATE_LIMIT_MAX = 100;

  function checkRateLimit(socketId) {
    const now = Date.now();
    const entry = rateLimitMap.get(socketId) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + RATE_LIMIT_WINDOW;
    }
    entry.count++;
    rateLimitMap.set(socketId, entry);
    return entry.count <= RATE_LIMIT_MAX;
  }

  io.use((socket, next) => {
    // Basic validation
    const sessionId = socket.handshake.auth?.sessionId || socket.handshake.query?.sessionId;
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 6) {
      // Allow connection without sessionId for lobby, but validate later on join
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join session with strict 2-participant enforcement
    socket.on('join-session', (data, callback) => {
      try {
        if (!checkRateLimit(socket.id)) {
          return callback?.({ success: false, reason: 'rate_limited', message: 'Too many requests' });
        }

        const { sessionId, participantId, token } = data || {};
        
        if (!sessionId || typeof sessionId !== 'string') {
          return callback?.({ success: false, reason: 'invalid_session', message: 'Invalid session ID' });
        }

        // Validate session exists
        const existingSession = sessionStore.getSession(sessionId);
        if (!existingSession) {
          return callback?.({ success: false, reason: 'not_found', message: 'Call session not found or expired' });
        }

        // If token provided, validate it for reconnect
        if (participantId && token) {
          if (!sessionStore.validateToken(sessionId, participantId, token)) {
            // Token invalid, but check if participantId exists - if not, treat as new join attempt
            if (existingSession.participants.has(participantId)) {
              return callback?.({ success: false, reason: 'unauthorized', message: 'Invalid token' });
            }
          }
        }

        const result = sessionStore.tryJoinSession(sessionId, participantId);

        if (!result.success) {
          if (result.reason === 'full') {
            console.log(`🚫 Session ${sessionId} full - rejecting ${socket.id}`);
            // Do NOT expose participant info to rejected user
            return callback?.({ 
              success: false, 
              reason: 'full', 
              message: 'This private call already has two participants.' 
            });
          }
          return callback?.({ 
            success: false, 
            reason: result.reason, 
            message: result.reason === 'not_found' ? 'Call session not found' : 'Session expired' 
          });
        }

        const { participant, isNewHost } = result;

        // Update socket mapping
        sessionStore.updateSocketId(sessionId, participant.id, socket.id);
        socket.data.sessionId = sessionId;
        socket.data.participantId = participant.id;
        socket.data.token = participant.token;

        // Join socket.io room
        socket.join(sessionId);

        // Notify others in session
        socket.to(sessionId).emit('participant-joined', {
          participantId: participant.id,
          isHost: participant.isHost,
          count: sessionStore.getSession(sessionId).participantCount,
        });

        console.log(`✅ Participant ${participant.id} joined session ${sessionId} (${sessionStore.getSession(sessionId).participantCount}/2)`);

        callback?.({
          success: true,
          participantId: participant.id,
          token: participant.token,
          isHost: participant.isHost,
          isNewHost,
          participantCount: sessionStore.getSession(sessionId).participantCount,
          sessionStatus: sessionStore.getSession(sessionId).status,
        });

        // If second participant joined, notify both that call can start
        const session = sessionStore.getSession(sessionId);
        if (session && session.participantCount === 2) {
          io.to(sessionId).emit('session-ready', {
            participantCount: 2,
            message: 'Both participants connected',
          });
        }

      } catch (e) {
        console.error('join-session error', e);
        callback?.({ success: false, reason: 'server_error', message: 'Server error' });
      }
    });

    // WebRTC signaling - validated
    socket.on('signal', (data) => {
      try {
        if (!checkRateLimit(socket.id)) return;
        
        const { sessionId, participantId, token, type, payload, targetId } = data || {};
        
        if (!sessionId || !participantId) return;

        // Validate token
        if (!sessionStore.validateToken(sessionId, participantId, token)) {
          socket.emit('error', { message: 'Unauthorized signaling' });
          return;
        }

        const session = sessionStore.getSession(sessionId);
        if (!session) return;
        if (!session.participants.has(participantId)) return;

        // Validate signaling type
        const allowedTypes = ['offer', 'answer', 'ice-candidate', 'renegotiate', 'leave'];
        if (!allowedTypes.includes(type)) return;

        // Broadcast to other participant only (not to self, not to third)
        socket.to(sessionId).emit('signal', {
          from: participantId,
          type,
          payload,
          timestamp: Date.now(),
        });

        console.log(`📡 Signal ${type} from ${participantId} in ${sessionId}`);

      } catch (e) {
        console.error('signal error', e);
      }
    });

    // Chat message - ephemeral, 2-person only
    socket.on('chat-message', (data) => {
      try {
        if (!checkRateLimit(socket.id)) return;
        
        const { sessionId, participantId, token, message, id } = data || {};
        if (!sessionId || !participantId || !message) return;
        if (typeof message !== 'string' || message.length > 1000) return;

        if (!sessionStore.validateToken(sessionId, participantId, token)) return;

        const session = sessionStore.getSession(sessionId);
        if (!session || !session.participants.has(participantId)) return;

        // Sanitize message (basic XSS prevention)
        const sanitized = message.replace(/[<>]/g, '').trim();
        if (!sanitized) return;

        io.to(sessionId).emit('chat-message', {
          id: id || crypto.randomUUID(),
          from: participantId,
          message: sanitized,
          timestamp: Date.now(),
        });

      } catch (e) {
        console.error('chat-message error', e);
      }
    });

    // Emoji reaction
    socket.on('reaction', (data) => {
      try {
        if (!checkRateLimit(socket.id)) return;
        const { sessionId, participantId, token, emoji } = data || {};
        if (!sessionId || !participantId || !emoji) return;
        
        const allowedEmojis = ['👍', '❤️', '😂', '👏', '🎉', '😮', '😢'];
        if (!allowedEmojis.includes(emoji)) return;

        if (!sessionStore.validateToken(sessionId, participantId, token)) return;

        io.to(sessionId).emit('reaction', {
          from: participantId,
          emoji,
          timestamp: Date.now(),
        });
      } catch (e) {
        console.error('reaction error', e);
      }
    });

    // Typing indicator
    socket.on('typing', (data) => {
      try {
        const { sessionId, participantId, token, isTyping } = data || {};
        if (!sessionId || !participantId) return;
        if (!sessionStore.validateToken(sessionId, participantId, token)) return;
        socket.to(sessionId).emit('typing', { from: participantId, isTyping });
      } catch (e) {}
    });

    // Leave session
    socket.on('leave-session', (data) => {
      try {
        const { sessionId, participantId } = data || socket.data;
        if (!sessionId || !participantId) return;
        
        sessionStore.leaveSession(sessionId, participantId);
        socket.to(sessionId).emit('participant-left', { participantId });
        socket.leave(sessionId);
        console.log(`👋 Participant ${participantId} left session ${sessionId}`);
      } catch (e) {}
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      try {
        const { sessionId, participantId } = socket.data || {};
        if (sessionId && participantId) {
          // Don't immediately remove, allow for reconnect window
          // Mark as disconnected but keep participant for 30s
          const session = sessionStore.getSession(sessionId);
          if (session) {
            socket.to(sessionId).emit('participant-disconnected', { participantId });
            console.log(`🔌 Participant ${participantId} disconnected from ${sessionId}, waiting for reconnect`);
            
            setTimeout(() => {
              const s = sessionStore.getSession(sessionId);
              if (s) {
                const p = s.participants.get(participantId);
                if (p && p.socketId === socket.id) {
                  // Still disconnected after 30s, consider left
                  s.participants.delete(participantId);
                  s.participantCount = s.participants.size;
                  io.to(sessionId).emit('participant-left', { participantId });
                  console.log(`⏰ Participant ${participantId} timed out from ${sessionId}`);
                }
              }
            }, 30000);
          }
        }
        rateLimitMap.delete(socket.id);
        console.log(`🔌 Socket disconnected: ${socket.id}`);
      } catch (e) {}
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.IO signaling server ready`);
      console.log(`> Session enforcement: MAX 2 participants per call`);
      console.log(`> Environment: ${dev ? 'development' : 'production'}`);
    });
});
