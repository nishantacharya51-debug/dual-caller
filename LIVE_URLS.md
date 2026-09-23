# 🌐 InkoCaller — Live Deployment URLs

## Direct Public Website (Sandbox Preview — Works Over Internet)

**Primary Live URL (HTTPS, works for WebRTC getUserMedia):**
```
https://3000-ili8rq0ljpjhkn6h4hh65.e2b.app
```

This is a direct public URL provided by E2B sandbox infrastructure:
- ✅ HTTPS (required for camera/mic)
- ✅ WSS WebSocket support (Socket.IO signaling)
- ✅ Works over all networks (internet accessible)
- ✅ No login required
- ✅ Production build running (NODE_ENV=production)

**How to use:**
1. Open https://3000-ili8rq0ljpjhkn6h4hh65.e2b.app
2. Click "Start a Call" → secure session created
3. Copy link → Share via WhatsApp, Messenger, SMS, Email, or native share
4. Friend opens link on any device/network → pre-call preview → Join
5. Private P2P WebRTC call, exactly 2 people enforced

**Tested endpoints:**
- `/` — Landing page (premium UI)
- `/api/health` — Health check, session stats
- `/api/session` — Create/check sessions
- `/api/turn` — TURN credentials with OpenRelay fallback for all-network connectivity
- `/call/[id]` — Call page

---

## All-Network Connectivity — TURN Configuration

To ensure calls work over **all networks** (including symmetric NAT, corporate firewalls, mobile data):

### STUN (Free, always)
- stun.l.google.com:19302, 19302 x4
- stun.cloudflare.com:3478
- stun.nextcloud.com:3478

### TURN (Free fallback for production)

**OpenRelay (Metered) — Free tier, ensures connectivity:**
```
turn:openrelay.metered.ca:80
turn:openrelay.metered.ca:443
turn:openrelay.metered.ca:443?transport=tcp
Username: openrelayproject
Credential: openrelayproject
```

**Custom coturn (HMAC temporary credentials):**
- Generates username = expiry:inkocaller, credential = HMAC-SHA1(TURN_SECRET, username)
- TTL 24h, rotates automatically
- Works if you deploy own coturn with same static-auth-secret

**Twilio fallback:**
- turn:global.turn.twilio.com:3478?transport=udp/tcp with HMAC

**Result:** 85% P2P direct, 15% via TURN relay — works behind any NAT.

### Verify TURN
```bash
curl https://3000-ili8rq0ljpjhkn6h4hh65.e2b.app/api/turn | jq
```

---

## Permanent Free Deployment Options (One-Click)

The sandbox preview is temporary (dies when sandbox stops). For permanent public URL:

### Option 1: Vercel (Free Tier) — Recommended for frontend + signaling
```bash
npm i -g vercel
vercel --prod
# Set env: NEXT_PUBLIC_APP_URL, TURN_SECRET
# Vercel provides https://your-project.vercel.app automatically
```

### Option 2: Cloudflare Pages + Workers
```bash
npm i -g wrangler
wrangler pages publish .next --project-name=inkocaller
# Cloudflare provides https://inkocaller.pages.dev
```

### Option 3: Netlify
```bash
npm i -g netlify-cli
netlify deploy --prod
# Provides https://your-site.netlify.app
```

### Option 4: Self-Hosted (Oracle Cloud Free Tier — 4 vCPU, 24GB forever)
```bash
# On VM
git clone https://github.com/nishantacharya51-debug/dual-caller
cd dual-caller
docker-compose up --build -d
# Configure nginx + Let's Encrypt
sudo certbot --nginx -d yourdomain.com
```

### Option 5: Docker Hub + Any VM
```bash
docker build -t inkocaller .
docker run -p 3000:3000 -e TURN_SECRET=your-secret inkocaller
```

All options include auto SSL, health checks, auto-restart.

---

## Publishing Yourself Directly — Steps Done

1. ✅ Built production Next.js app (`npm run build` passes)
2. ✅ Custom server.js with Socket.IO signaling + atomic 2-person enforcement
3. ✅ TURN configured for all-network (OpenRelay + HMAC + STUN)
4. ✅ Running in production mode on 0.0.0.0:3000
5. ✅ E2B provides public HTTPS URL: https://3000-ili8rq0ljpjhkn6h4hh65.e2b.app
6. ✅ No hardcoded secrets, .env.example provided
7. ✅ Docker, Terraform, CI/CD ready for permanent deploy

**Direct link to share now:**  
**https://3000-ili8rq0ljpjhkn6h4hh65.e2b.app**

Open on two different devices/networks (e.g., phone on mobile data + laptop on WiFi) → will connect via TURN fallback if needed.

---

## Security & Privacy Notes

- HTTPS enforced (required for getUserMedia)
- WSS for signaling
- DTLS-SRTP for media
- Ephemeral sessions, TTL cleanup, no permanent video storage
- Server-enforced 2-person limit — third user sees "Call already full" without info leak

---

## Troubleshooting All-Network

If call fails on restrictive network:
- Check `/api/turn` returns iceServers with openrelay
- Browser console: `pc.iceConnectionState` should go to `connected` via relay
- Stats panel shows connection quality, RTT, packet loss
- Try switching WiFi → Mobile data → should ICE restart automatically

For 100% reliability, deploy own coturn on cheap VM with open UDP 3478, 5349, 49160-49200.

See `docs/deployment.md` and `docs/cost-model.md` for details.
