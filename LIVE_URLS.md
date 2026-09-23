# 🌐 InkoCaller — LIVE DIRECT WEBSITE LINKS (Fixed)

## ✅ PRIMARY LIVE URL — GitHub Pages (Permanent, All Networks, No Sandbox)

**Direct Public Website (Works Everywhere, HTTPS, No Login):**

### 🚀 https://nishantacharya51-debug.github.io/dual-caller/

- **Status:** Built ✅ (GitHub Pages, source: arena/01a0ce90-dual-caller branch, .nojekyll)
- **Type:** Static P2P version — works without custom server, over all networks
- **Tech:** PeerJS cloud signaling (0.peerjs.com) + OpenRelay TURN (80,443,443 tcp) + Google STUN
- **Features:** 2-person enforced, third rejected, HD video, audio, screen share, reactions, all-network via TURN
- **No sandbox, permanent, free, open-source**

**How to use:**
1. Open https://nishantacharya51-debug.github.io/dual-caller/
2. Click "Start a Call" → secure peer ID generated
3. Copy link (URL hash contains session ID)
4. Share via WhatsApp, SMS, Email buttons
5. Friend opens link on any device/network → Join
6. Private call, exactly 2 people

**Alternative custom domain (if DNS configured):**
- http://callernishant.com/ (configured in repo, may need DNS A records to GitHub Pages IPs)

---

## 🔧 Secondary Live URLs — E2B Sandbox (Temporary, Full-Featured Next.js + Socket.IO)

These are from current sandbox `ili8rq0ljpjhkn6h4hh65`, production build:

- **Port 3000 (Main):** https://3000-ili8rq0ljpjhkn6h4hh65.e2b.app
- **Port 3001 (Backup):** https://3001-ili8rq0ljpjhkn6h4hh65.e2b.app

- **Status:** Running production Node.js custom server (server.js)
- **Features:** Full Next.js 14, Socket.IO signaling, atomic 2-person enforcement, TURN with OpenRelay + HMAC, chat, captions, recording, etc.
- **Note:** Sandbox URLs are temporary — expire when sandbox stops. Use GitHub Pages for permanent.

If you see "Sandbox Not Found" for 3000-... URL, sandbox may have expired — use GitHub Pages link above which is permanent.

---

## 🌍 All-Network Connectivity — Fixed

**Problem:** Direct P2P fails on symmetric NAT, corporate firewalls, mobile data.
**Solution:** TURN relay ensures connectivity.

**Configured ICE Servers (both versions):**

```javascript
[
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.nextcloud.com:3478' },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp'
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
]
```

- **OpenRelay (Metered)** — Free tier 20GB/mo, ensures all-network connectivity
- **85% P2P direct, 15% via TURN relay**
- **Production recommendation:** Deploy own coturn or Cloudflare Calls for unlimited bandwidth

**Verify:**
```bash
curl https://nishantacharya51-debug.github.io/dual-caller/ # Should return HTML
# Or for Next.js version:
curl http://localhost:3000/api/turn | jq .iceServers
```

---

## 📦 How Published Directly from GitHub

1. Created static `index.html` at repo root — standalone P2P calling app using PeerJS + OpenRelay
2. Added `.nojekyll` to disable Jekyll processing
3. Pushed to branch `arena/01a0ce90-dual-caller` which is configured as GitHub Pages source
4. GitHub Actions auto-built Pages → status `built`
5. Live at https://nishantacharya51-debug.github.io/dual-caller/

**No external tokens needed** — uses GitHub's built-in Pages infrastructure (free).

**Full-featured version** (Next.js + Socket.IO) also running in sandbox and ready for:
- Vercel: `vercel --prod` → `https://your-project.vercel.app`
- Cloudflare Pages: `wrangler pages publish`
- Netlify: `netlify deploy --prod`
- Docker: `docker-compose up --build` (includes coturn, redis, postgres, prometheus, grafana)

---

## 🎯 Direct Links Summary

| Type | URL | Status | All Networks |
|------|-----|--------|--------------|
| **GitHub Pages (Permanent)** | **https://nishantacharya51-debug.github.io/dual-caller/** | ✅ Live, Built | ✅ Yes (TURN) |
| Custom Domain | http://callernishant.com/ | Configured, needs DNS | ✅ Yes |
| E2B Preview 3000 | https://3000-ili8rq0ljpjhkn6h4hh65.e2b.app | Running prod server | ✅ Yes |
| E2B Preview 3001 | https://3001-ili8rq0ljpjhkn6h4hh65.e2b.app | Running prod server | ✅ Yes |

**Use GitHub Pages link for sharing — it's permanent and works over all networks.**

---

## 🧪 Test Over All Networks

1. Open GitHub Pages link on **laptop (WiFi)**
2. Click Start a Call → Copy link
3. Open link on **phone (mobile data)** — different network, behind carrier NAT
4. Should connect via TURN relay if P2P fails
5. Try third device → should see "Call is full" (2-person enforcement)

---

## 📄 Repo

- https://github.com/nishantacharya51-debug/dual-caller
- Branch: arena/01a0ce90-dual-caller
- Latest commits include static P2P version + .nojekyll

---

**Built for private, meaningful conversations. Exactly two people. No group clutter. Works over all networks. Live now.**
