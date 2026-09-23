import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Generate temporary TURN credentials using shared secret (coturn static-auth-secret)
// Includes free OpenRelay fallback for all-network connectivity
export async function GET(request: NextRequest) {
  try {
    const secret = process.env.TURN_SECRET || process.env.NEXT_PUBLIC_TURN_SECRET || 'inkocaller-dev-secret-change-in-prod';
    const ttl = 86400; // 24h
    const username = `${Math.floor(Date.now() / 1000) + ttl}:inkocaller`;
    
    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(username);
    const credential = hmac.digest('base64');

    // Always include STUN - multiple for redundancy
    const iceServers: any[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.nextcloud.com:3478' },
    ];

    // Custom TURN if configured (your own coturn)
    if (process.env.NEXT_PUBLIC_TURN_URL) {
      iceServers.push({
        urls: [
          process.env.NEXT_PUBLIC_TURN_URL,
          process.env.NEXT_PUBLIC_TURN_URL.replace(':3478', ':5349'),
        ],
        username: process.env.NEXT_PUBLIC_TURN_USERNAME || username,
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || credential,
      });
    }

    // HMAC TURN (for coturn with static-auth-secret)
    // This will work if you host your own coturn with same secret
    if (process.env.TURN_SERVER) {
      iceServers.push({
        urls: [
          process.env.TURN_SERVER,
          process.env.TURN_SERVER + '?transport=tcp',
        ],
        username,
        credential,
      });
    }

    // FREE TURN for all-network connectivity - OpenRelay (Metered)
    // Works for symmetric NAT, firewalls, etc. Free tier limited but functional
    // For production, replace with your own coturn or Cloudflare Calls
    iceServers.push({
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    });

    // Backup free TURN - Twilio global STUN/TURN test (may require account but STUN works)
    // Keeping HMAC version for custom
    iceServers.push({
      urls: [
        'turn:global.turn.twilio.com:3478?transport=udp',
        'turn:global.turn.twilio.com:3478?transport=tcp',
      ],
      username,
      credential,
    });

    return NextResponse.json({
      iceServers,
      ttl,
      username,
      credential,
      expiresAt: Date.now() + ttl * 1000,
      info: {
        stun: 'Free Google + Cloudflare STUN',
        turn: 'OpenRelay free + custom coturn HMAC + Twilio fallback',
        note: 'For production, deploy own coturn or use Cloudflare Calls. OpenRelay free tier 20GB/mo but ensures all-network connectivity',
        p2p: '85% of calls will be direct P2P, 15% via TURN',
      }
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
        { urls: 'stun:stun.cloudflare.com:3478' },
        {
          urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp',
          ],
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ]
    });
  }
}
