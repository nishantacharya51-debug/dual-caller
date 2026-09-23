# InkoCaller Architecture

## Overview

```
┌─────────────┐         P2P WebRTC (DTLS-SRTP)         ┌─────────────┐
│  Browser A  │◄──────────────────────────────────────►│  Browser B  │
│             │          Direct, lowest latency        │             │
└──────┬──────┘                                        └──────┬──────┘
       │  WSS Signaling (Socket.IO)                          │
       │         SDP Offer/Answer, ICE                       │
       ▼                                                     ▼
┌──────────────────────────────────────────────────────────────┐
│  Signaling Server (Node.js + Socket.IO)                     │
│  - Session Store (atomic 2-person enforcement)              │
│  - Rate limiting, token validation                          │
│  - Redis adapter for horizontal scaling                     │
│  - TURN credential service (HMAC)                           │
└──────────────────┬───────────────────────┬───────────────────┘
                   │                       │
         ┌─────────▼────────┐   ┌──────────▼─────────┐
         │  coturn TURN     │   │  PostgreSQL /      │
         │  STUN + TURN UDP │   │  Supabase (opt)    │
         │  TCP + TLS       │   │  TTL cleanup       │
         └──────────────────┘   └────────────────────┘
```

## Technology Stack

- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Node.js custom server, Socket.IO, in-memory store (Redis optional)
- **WebRTC**: Native browser APIs, adaptive bitrate, ICE, STUN/TURN
- **Database**: PostgreSQL optional, Supabase free tier, or in-memory for MVP
- **TURN**: coturn self-hosted, OpenRelay free tier fallback
- **Monitoring**: Prometheus, Grafana, Loki
- **Deployment**: Docker, Terraform, GitHub Actions, Vercel/Cloudflare free tiers
- **Security**: Helmet-like headers, CSP, rate limiting, HMAC TURN

## Session Lifecycle

1. `POST /api/session` → generate secure ID (128-bit entropy)
2. Store with TTL 2h, participantCount 0
3. First `join-session` → count 1, status waiting
4. Second `join-session` → count 2, status active, emit session-ready
5. Third `join-session` → REJECT with "full" reason, no info leak
6. Disconnect → 30s reconnect window, then cleanup
7. Both leave → status ended, delete after 5 min

## Race Condition Prevention

```js
// Atomic check in tryJoinSession
if (session.participantCount >= 2) return { success: false, reason: 'full' };
// No async gap between check and increment
session.participants.set(id, participant);
session.participantCount = size;
```

Plus Socket.IO single-threaded event loop ensures atomicity per server. For multi-server, use Redis lock.

## WebRTC Flow

1. Both clients get TURN creds via `/api/turn` (HMAC, 24h TTL)
2. Create RTCPeerConnection with iceServers
3. First participant waits, second triggers offer
4. Offer → signaling → answer → ICE candidates
5. Direct P2P if possible, else TURN relay
6. Monitor stats: RTT, packet loss, bitrate, resolution
7. Adaptive: reduce resolution if packetLoss > 5% or RTT > 400ms

## Scaling to 10k Concurrent Calls

- 10k calls = 20k participants
- Signaling: stateless, horizontal via Redis adapter, 10x c5.2xlarge
- Media: P2P saves 85% bandwidth, only 15% needs TURN
- TURN: 5x c5.4xlarge, 500 TB/mo bandwidth worst case
- See README cost model

## 12-Region Design

Terraform modules capable of deploying to 12 regions. Use latency-based routing.

## Security Architecture

- HTTPS, HSTS, CSP, X-Frame-Options DENY
- Secure cookies, SameSite
- Rate limiting, input validation
- No TURN creds in frontend
- Ephemeral sessions, minimal metadata
- Daily dependency + secret scanning via GitHub Actions
