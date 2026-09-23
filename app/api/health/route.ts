import { NextResponse } from 'next/server';
import { sessionStore } from '@/lib/sessionStore';

export async function GET() {
  const stats = sessionStore.getStats();
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'inkocaller',
    uptime: process.uptime(),
    sessions: stats,
    webrtc: {
      stun: ['stun.l.google.com:19302', 'stun.cloudflare.com:3478'],
      turn: 'configured via /api/turn',
      p2p: true,
    },
    limits: {
      participantsPerCall: 2,
      maxConcurrentCalls: '10,000 architecture ready',
      sessionTTL: '2 hours',
    }
  });
}
