const jwt = require('jsonwebtoken');
const { RateLimiterMemory } = require('rate-limiter-flexible');

const socketRateLimiter = new RateLimiterMemory({
  points: 50,
  duration: 10,
});

function setupSignaling(io) {
  // Track connected users by family code
  const familyRooms = new Map();
  const connectedUsers = new Map();

  // Socket authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, username, role, familyCode } = socket.user;

    console.log(`User connected: ${username} (${role}) - Family: ${familyCode}`);

    // Join family room
    const roomName = `family_${familyCode}`;
    socket.join(roomName);

    // Track connected user
    connectedUsers.set(socket.id, {
      userId,
      username,
      role,
      familyCode,
      socketId: socket.id,
    });

    // Initialize family room if not exists
    if (!familyRooms.has(familyCode)) {
      familyRooms.set(familyCode, { parents: [], children: [] });
    }

    const room = familyRooms.get(familyCode);
    if (role === 'parent') {
      room.parents.push({ socketId: socket.id, username, userId });
    } else {
      room.children.push({ socketId: socket.id, username, userId });
    }

    // Notify family members of new connection
    socket.to(roomName).emit('family-member-connected', {
      username,
      role,
      userId,
    });

    // Send current family status to newly connected user
    socket.emit('family-status', {
      parents: room.parents.map(p => ({ username: p.username, userId: p.userId })),
      children: room.children.map(c => ({ username: c.username, userId: c.userId })),
    });

    // Rate-limited event handler wrapper
    const rateLimitedHandler = (handler) => {
      return async (...args) => {
        try {
          await socketRateLimiter.consume(socket.id);
          handler(...args);
        } catch (err) {
          socket.emit('error-message', { error: 'Rate limited. Slow down.' });
        }
      };
    };

    // Child grants camera permission and starts sharing
    socket.on('camera-permission-granted', rateLimitedHandler((data) => {
      if (role !== 'child') return;

      console.log(`${username} granted camera permission`);
      socket.to(roomName).emit('child-camera-available', {
        childId: userId,
        childUsername: username,
        childSocketId: socket.id,
      });
    }));

    // Child revokes camera permission
    socket.on('camera-permission-revoked', rateLimitedHandler(() => {
      if (role !== 'child') return;

      console.log(`${username} revoked camera permission`);
      socket.to(roomName).emit('child-camera-unavailable', {
        childId: userId,
        childUsername: username,
      });
    }));

    // WebRTC Signaling - Offer
    socket.on('webrtc-offer', rateLimitedHandler((data) => {
      const { targetSocketId, offer, encryptedMetadata } = data;
      const targetUser = connectedUsers.get(targetSocketId);

      // Verify both users are in the same family
      if (targetUser && targetUser.familyCode === familyCode) {
        io.to(targetSocketId).emit('webrtc-offer', {
          offer,
          senderSocketId: socket.id,
          senderUsername: username,
          senderRole: role,
          encryptedMetadata,
        });
      }
    }));

    // WebRTC Signaling - Answer
    socket.on('webrtc-answer', rateLimitedHandler((data) => {
      const { targetSocketId, answer, encryptedMetadata } = data;
      const targetUser = connectedUsers.get(targetSocketId);

      if (targetUser && targetUser.familyCode === familyCode) {
        io.to(targetSocketId).emit('webrtc-answer', {
          answer,
          senderSocketId: socket.id,
          senderUsername: username,
          encryptedMetadata,
        });
      }
    }));

    // WebRTC Signaling - ICE Candidate
    socket.on('webrtc-ice-candidate', rateLimitedHandler((data) => {
      const { targetSocketId, candidate } = data;
      const targetUser = connectedUsers.get(targetSocketId);

      if (targetUser && targetUser.familyCode === familyCode) {
        io.to(targetSocketId).emit('webrtc-ice-candidate', {
          candidate,
          senderSocketId: socket.id,
        });
      }
    }));

    // Consent verification - parent requests, child must approve
    socket.on('request-view-camera', rateLimitedHandler((data) => {
      if (role !== 'parent') return;

      const { childSocketId } = data;
      const childUser = connectedUsers.get(childSocketId);

      if (childUser && childUser.familyCode === familyCode && childUser.role === 'child') {
        io.to(childSocketId).emit('parent-requests-camera', {
          parentUsername: username,
          parentSocketId: socket.id,
          parentUserId: userId,
        });
      }
    }));

    // Child approves parent's request
    socket.on('approve-camera-request', rateLimitedHandler((data) => {
      if (role !== 'child') return;

      const { parentSocketId, approved } = data;
      const parentUser = connectedUsers.get(parentSocketId);

      if (parentUser && parentUser.familyCode === familyCode) {
        io.to(parentSocketId).emit('camera-request-response', {
          approved,
          childSocketId: socket.id,
          childUsername: username,
          childUserId: userId,
        });
      }
    }));

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${username} (${role})`);

      connectedUsers.delete(socket.id);

      if (familyRooms.has(familyCode)) {
        const room = familyRooms.get(familyCode);
        if (role === 'parent') {
          room.parents = room.parents.filter(p => p.socketId !== socket.id);
        } else {
          room.children = room.children.filter(c => c.socketId !== socket.id);
        }

        // Clean up empty rooms
        if (room.parents.length === 0 && room.children.length === 0) {
          familyRooms.delete(familyCode);
        }
      }

      socket.to(roomName).emit('family-member-disconnected', {
        username,
        role,
        userId,
      });
    });
  });
}

module.exports = setupSignaling;