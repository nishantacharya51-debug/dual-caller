# Deployment Guide — InkoCaller

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
# http://localhost:3000
```

## Production Build

```bash
npm run build
npm start
```

## Docker

```bash
docker-compose up --build
```

Services:
- app:3000
- redis:6379
- postgres:5432
- coturn:3478/5349
- prometheus:9090
- grafana:3001

## Free Tier Deployment (Recommended Order)

### 1. Cloudflare Pages + Workers (Free)

- Static frontend to Pages
- Signaling Worker with Durable Objects for session store
- TURN: Cloudflare Calls (pay-as-you-go, free tier 1000 mins)
- SSL auto

```bash
npx wrangler pages publish .next/static
```

### 2. Vercel Free Tier

- `vercel --prod`
- Env: NEXT_PUBLIC_APP_URL, TURN_SECRET
- Vercel provides SSL auto
- Limitation: WebSocket via Vercel functions may need external signaling server

### 3. Netlify Free

- `netlify deploy --prod`
- Similar to Vercel

### 4. Supabase Free (DB)

- Create project at supabase.com
- Set DATABASE_URL
- Enable RLS

### 5. Self-hosted coturn

On any free VM (Oracle Cloud free tier 4 vCPU, 24GB):

```bash
sudo apt install coturn
# /etc/turnserver.conf
# static-auth-secret=your-secret
# realm=inkocaller.app
sudo systemctl restart coturn
```

## SSL

- Cloudflare, Vercel, Netlify provide auto SSL
- Self-hosted: Let's Encrypt

```bash
sudo certbot --nginx -d inkocaller.app
```

## Environment Variables

See `.env.example`. Never commit real secrets.

## Health Checks

- `/api/health` — returns status, session stats, limits
- Docker HEALTHCHECK included

## Monitoring

Prometheus scrapes `/api/health`, Grafana dashboards in `monitoring/`.

## CI/CD

GitHub Actions workflow in `.github/workflows/ci.yml`:

- Lint + type-check
- Security scan (gitleaks, CodeQL, npm audit) daily 3AM UTC
- Build + Docker
- WebRTC enforcement test (A joins, B joins, C rejected)
- Deploy on main push

## Domain

Do NOT auto-purchase domain. User provides domain, then configure DNS to deployment.

If free URL provided by platform (e.g., inkocaller.vercel.app), use that.

## Limitations Honestly Documented

- Free TURN bandwidth limited (20GB/mo OpenRelay)
- Background WebRTC varies by OS
- Cannot prevent OS-level screen recording
- 10k concurrent calls NOT free — see cost-model.md
