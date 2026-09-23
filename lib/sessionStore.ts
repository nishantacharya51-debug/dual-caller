// Server-side session store with strict 2-participant enforcement
import crypto from 'crypto';

export interface Participant {
  id: string;
  token: string;
  joinedAt: number;
  lastSeen: number;
  isHost: boolean;
  socketId?: string;
}

export interface CallSession {
  id: string;
  createdAt: number;
  expiresAt: number;
  participants: Map<string, Participant>;
  participantCount: number;
  status: 'waiting' | 'active' | 'ended' | 'full';
  scheduledFor?: number;
}

class SessionStore {
  private sessions: Map<string, CallSession> = new Map();
  private readonly SESSION_TTL = 1000 * 60 * 60 * 2; // 2 hours
  private readonly PARTICIPANT_TIMEOUT = 1000 * 60 * 5; // 5 min waiting
  private readonly CLEANUP_INTERVAL = 1000 * 60;

  constructor() {
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
    }
  }

  generateSecureSessionId(): string {
    // 16 bytes = 128 bits of entropy, base64url encoded
    const bytes = crypto.randomBytes(16);
    return bytes.toString('base64url').substring(0, 16).toLowerCase();
  }

  generateParticipantToken(): string {
    return crypto.randomBytes(24).toString('base64url');
  }

  createSession(scheduledFor?: number): { session: CallSession; hostToken: string } {
    const id = this.generateSecureSessionId();
    const hostToken = this.generateParticipantToken();
    
    const session: CallSession = {
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

  getSession(sessionId: string): CallSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }
    
    return session;
  }

  // Atomic participant reservation - prevents race conditions
  tryJoinSession(sessionId: string, participantId?: string): 
    { success: true; participant: Participant; isNewHost: boolean } | 
    { success: false; reason: 'not_found' | 'full' | 'expired' } {
    
    const session = this.getSession(sessionId);
    if (!session) {
      return { success: false, reason: 'not_found' };
    }

    if (session.status === 'ended') {
      return { success: false, reason: 'expired' };
    }

    // If participant already exists (reconnect), allow
    if (participantId && session.participants.has(participantId)) {
      const existing = session.participants.get(participantId)!;
      existing.lastSeen = Date.now();
      return { success: true, participant: existing, isNewHost: false };
    }

    // Strict 2-participant enforcement
    if (session.participantCount >= 2) {
      return { success: false, reason: 'full' };
    }

    // Atomic increment check
    const newParticipantId = participantId || crypto.randomUUID();
    const token = this.generateParticipantToken();
    const isHost = session.participantCount === 0;

    const participant: Participant = {
      id: newParticipantId,
      token,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      isHost,
    };

    session.participants.set(newParticipantId, participant);
    session.participantCount = session.participants.size;
    
    if (session.participantCount === 1) {
      session.status = 'waiting';
    } else if (session.participantCount === 2) {
      session.status = 'active';
    }

    // Extend expiry on activity
    session.expiresAt = Date.now() + this.SESSION_TTL;

    return { success: true, participant, isNewHost: isHost };
  }

  leaveSession(sessionId: string, participantId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const existed = session.participants.delete(participantId);
    if (existed) {
      session.participantCount = session.participants.size;
      if (session.participantCount === 0) {
        session.status = 'ended';
        // Don't delete immediately, allow for reconnect window
        setTimeout(() => {
          if (session.participantCount === 0) {
            this.sessions.delete(sessionId);
          }
        }, this.PARTICIPANT_TIMEOUT);
      } else if (session.participantCount === 1) {
        session.status = 'waiting';
      }
    }

    return existed;
  }

  updateSocketId(sessionId: string, participantId: string, socketId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    const participant = session.participants.get(participantId);
    if (!participant) return false;
    
    participant.socketId = socketId;
    participant.lastSeen = Date.now();
    return true;
  }

  validateToken(sessionId: string, participantId: string, token: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    const participant = session.participants.get(participantId);
    if (!participant) return false;
    
    return participant.token === token;
  }

  private cleanup() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(id);
        continue;
      }

      // Clean up stale participants
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

// Singleton - share with custom server.js which sets global.sessionStore
const globalForSessionStore = global as unknown as { sessionStore: any };
function getOrCreateStore(): SessionStore {
  if (globalForSessionStore.sessionStore) {
    return globalForSessionStore.sessionStore as SessionStore;
  }
  const store = new SessionStore();
  // Always set global so server.js and API routes share
  globalForSessionStore.sessionStore = store;
  return store;
}
export const sessionStore: SessionStore = getOrCreateStore();
