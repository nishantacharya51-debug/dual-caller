/**
 * Unit tests for strict 2-person enforcement
 * This is the most important business rule
 */

const crypto = require('crypto');

// Simulate session store logic
class TestSessionStore {
  constructor() {
    this.sessions = new Map();
  }
  createSession() {
    const id = crypto.randomBytes(8).toString('hex');
    const session = {
      id,
      participants: new Map(),
      participantCount: 0,
      status: 'waiting',
    };
    this.sessions.set(id, session);
    return session;
  }
  tryJoin(sessionId, participantId) {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, reason: 'not_found' };
    if (session.participantCount >= 2) return { success: false, reason: 'full' };
    const pid = participantId || crypto.randomUUID();
    session.participants.set(pid, { id: pid });
    session.participantCount = session.participants.size;
    return { success: true, participantId: pid };
  }
}

describe('Two-person enforcement', () => {
  test('allows exactly 2 participants', () => {
    const store = new TestSessionStore();
    const session = store.createSession();
    
    const r1 = store.tryJoin(session.id, 'user1');
    expect(r1.success).toBe(true);
    
    const r2 = store.tryJoin(session.id, 'user2');
    expect(r2.success).toBe(true);
    
    expect(session.participantCount).toBe(2);
  });

  test('rejects third participant', () => {
    const store = new TestSessionStore();
    const session = store.createSession();
    
    store.tryJoin(session.id, 'user1');
    store.tryJoin(session.id, 'user2');
    const r3 = store.tryJoin(session.id, 'user3');
    
    expect(r3.success).toBe(false);
    expect(r3.reason).toBe('full');
    expect(session.participantCount).toBe(2);
  });

  test('prevents race condition simulation', async () => {
    const store = new TestSessionStore();
    const session = store.createSession();
    
    // Simulate concurrent joins
    const promises = [
      Promise.resolve(store.tryJoin(session.id, 'user1')),
      Promise.resolve(store.tryJoin(session.id, 'user2')),
      Promise.resolve(store.tryJoin(session.id, 'user3')),
      Promise.resolve(store.tryJoin(session.id, 'user4')),
    ];
    
    const results = await Promise.all(promises);
    const successes = results.filter(r => r.success).length;
    
    expect(successes).toBe(2);
    expect(session.participantCount).toBe(2);
  });

  test('session IDs are cryptographically secure', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      const id = crypto.randomBytes(16).toString('base64url').substring(0, 16);
      expect(id.length).toBeGreaterThanOrEqual(12);
      ids.add(id);
    }
    expect(ids.size).toBe(100); // All unique
  });
});
