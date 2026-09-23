import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Generate temporary TURN credentials using shared secret (coturn static-auth-secret)
export async function GET(request: NextRequest) {
  try {
    const secret = process.env.TURN_SECRET || process.env.NEXT_PUBLIC_TURN_SECRET || 'inkocaller-dev-secret-change-in-prod';
    const ttl = 86400; // 24h
    const username = `${Math.floor(Date.now() / 1000) + ttl}:inkocaller`;
    
    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(username);
    const credential = hmac.digest('base64');

    const turnUrls = [
      process.env.TURN_SERVER || 'turn:global.turn.twilio.com:3478?transport=udp',
    ];

    // If custom TURN server configured
    if (process.env.NEXT_PUBLIC_TURN_URL) {
      turnUrls.unshift(process.env.NEXT_PUBLIC_TURN_URL);
    }

    // Always include STUN
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      {
        urls: turnUrls,
        username,
        credential,
      }
    ];

    // If env has explicit TURN creds, use them as fallback
    if (process.env.NEXT_PUBLIC_TURN_URL && process.env.NEXT_PUBLIC_TURN_USERNAME && process.env.NEXT_PUBLIC_TURN_CREDENTIAL) {
      iceServers.push({
        urls: [process.env.NEXT_PUBLIC_TURN_URL],
        username: process.env.NEXT_PUBLIC_TURN_USERNAME,
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
      } as any);
    }

    return NextResponse.json({
      iceServers,
      ttl,
      username,
      credential,
      expiresAt: Date.now() + ttl * 1000,
    }, {
      headers: {
        'Cache-Control': 'no-store, private',
      }
    });
  } catch (e) {
    console.error('TURN credential error', e);
    return NextResponse.json({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    });
  }
}
