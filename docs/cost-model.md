# Cost Model — Honest Estimates

## Important: Free tier does NOT support 10k concurrent calls unlimited

### FREE MVP (Development / Demo)

| Component | Service | Free Tier Limit | Cost |
|-----------|---------|----------------|------|
| Frontend | Vercel free / Cloudflare Pages | 100GB bandwidth/mo, 6000 exec hours | $0 |
| Signaling | Same as frontend (Node.js) | Included | $0 |
| STUN | Google + Cloudflare | Unlimited | $0 |
| TURN | OpenRelay free OR self-hosted on free EC2 micro | 20GB/mo OpenRelay | $0 |
| DB | In-memory OR Supabase free | 500MB, 50k MAU | $0 |
| CDN | Cloudflare free | Unlimited (fair use) | $0 |
| **Total** | | ~100 concurrent calls | **$0/mo** |

**Limitation**: TURN bandwidth limited, no SLA, single region.

### SMALL PRODUCTION (~1,000 concurrent calls = 2,000 participants)

Assumes 1 Mbps avg per call, 15% TURN usage

| Component | Spec | Monthly Cost |
|-----------|------|--------------|
| Compute (signaling) | 2x t3.medium (2 vCPU, 4GB) | $50 |
| TURN server | 1x c5.large + 500GB bandwidth (15% of 1k calls = 150 calls relayed * 1 Mbps * 30 days ≈ 50TB? Actually 150 * 1 Mbps = 150 Mbps sustained → ~50TB/mo) | $100 bandwidth + $70 compute = $170 |
| Database | RDS db.t3.micro or Supabase Pro | $15-25 |
| Redis | ElastiCache t3.micro | $15 |
| CDN | Cloudflare Pro | $20 |
| Monitoring | Self-hosted Prometheus/Grafana on t3.small | $15 |
| **Total** | | **~$285/mo** |

### 10,000 CONCURRENT CALLS (20k participants) — Production

**Assumptions**:
- 1 Mbps average per call (720p adaptive)
- 15% TURN usage (85% P2P success)
- 10k calls * 1 Mbps = 10 Gbps total media
- TURN relay: 15% = 1.5 Gbps sustained
- 1.5 Gbps * 30 days = 1.5 * 0.125 GB/s * 2.6M seconds = ~486 TB/mo TURN bandwidth

| Component | Spec | Monthly Cost |
|-----------|------|--------------|
| Signaling | 10x c5.2xlarge (8 vCPU, 16GB) for 20k WebSocket conns, Redis adapter | $1,500 |
| TURN | 5x c5.4xlarge (16 vCPU) for 1.5 Gbps relay + 486 TB bandwidth (AWS bandwidth $0.05/GB after first 10TB → ~$24k but Cloudflare / own DC cheaper ~ $5k) | $1,000 compute + $5,000-8,000 bandwidth |
| DB | RDS db.r5.large (2 vCPU, 16GB) + read replica | $200 |
| Redis | ElastiCache r5.large cluster | $200 |
| CDN | Cloudflare Enterprise (negotiated, includes TURN bandwidth discount) | $500 |
| Monitoring | Managed Prometheus + Grafana Cloud Pro | $200 |
| Load Balancer | ALB + WAF | $100 |
| **Total** | | **~$8,700 - $11,700/mo** |

**Optimizations**:
- Use Cloudflare Calls (TURN) — $0.05/GB, cheaper
- Peer-to-peer success 85% saves 85% vs SFU
- If all P2P, bandwidth ~0, cost drops to ~$2,500/mo
- Self-hosted TURN in own DC with cheap bandwidth: ~$3k/mo

**Do NOT claim free**. Document reality.

### Cost per Call

- Free MVP: $0
- Small prod: $0.285 per concurrent call per month, or ~$0.0004 per call minute (assuming 12h avg call time)
- 10k prod: ~$1 per concurrent call per month

### Scaling Strategy

- Start free, monitor TURN usage
- At 100 concurrent, move TURN to paid
- At 1k, add regions via Terraform
- At 10k, 12-region latency routing
