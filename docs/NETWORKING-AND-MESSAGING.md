# InkoCaller networking and private messaging

## What changed in V8

The browser app now checks TURN relays by gathering actual `typ relay` ICE candidates before advertising that relay routing is available. It tests multiple providers, caches successful results for six hours, prefers relays that answered, and automatically retries with relay-only ICE when a direct media connection fails or stalls. The in-call **Fix connection** button runs the same check again. The call status is driven by PeerJS/WebRTC connection states rather than a static “connected” label.

Private chat uses the PeerJS/WebRTC data channel, not an HTTP write to GitHub. Messages have stable IDs, send/delivered/read states, retry on reconnect, local queueing while the other person is joining, duplicate suppression, typing status, emoji reactions, unread counts, and local-only history. The peer channel uses WebRTC data-channel transport encryption. Messages are not stored on InkoCaller servers. Local device history is kept in browser storage for this device and this call link; clearing site data removes it.

The controls are bound once per click. Camera/microphone have progressive constraint fallbacks, screen sharing replaces the outgoing video track and restores the camera when stopped, and the app gives a device-specific message where screen capture is not supported (notably iPhone/iPad browsers).

## Worldwide calls: what is required

STUN can discover a network address; it cannot relay audio/video through a restrictive NAT or firewall. A TURN server must be reachable from both callers for those cases. PeerJS Cloud provides signaling, not a guaranteed media relay. The app therefore probes its configured public TURN options in each browser and shows the result under **Test / Show details**. If no relay returns a relay candidate on a device/network, that network cannot make a guaranteed cross-network call using those options. A user can still try switching Wi-Fi/mobile data or configure an organization-owned relay in the settings.

Public/free TURN services and demo credentials can be rate-limited, withdrawn, or changed without notice. V8 never labels a TURN server “working” merely because its DNS name resolves. The real-browser test (two devices on different networks, with the app showing a relay candidate) is the acceptance check for a deployment. The sandbox cannot prove that a third-party relay will accept credentials or pass packets from every ISP, country, VPN, or corporate firewall. Do not treat a static free relay as a production SLA.

### Configure a managed relay

1. Create a TURN account with a service you control or trust and create credentials for browser clients. Prefer short-lived credentials minted by a backend rather than permanent credentials embedded in a public HTML file.
2. In InkoCaller, open a call, choose **Show details**, paste a `turn:` or `turns:` URI, username, and password, then choose **Save relay**.
3. The browser performs an ICE relay-candidate check. If it succeeds, the network row reports the reachable relay; start a new call after saving it (both callers should use the new values if their earlier ICE configuration has been cached).
4. Keep credentials out of screenshots, public issues, and committed files.

### Self-host coturn (for an operator)

A TURN service must be on a public server with a public IPv4/IPv6 address, a DNS name, a strong secret, and firewall/NAT rules forwarding the TURN listener and relay-port range. It must advertise its public address (coturn `external-ip`) and be monitored for bandwidth. A Docker bridge-only `coturn` service is **not** publicly reachable just because the web app is on GitHub Pages. Expose and secure coturn on a public host, provision TLS for `turns:` on 443 where possible, and use time-limited credentials. Never expose an unauthenticated open relay.

GitHub Pages serves static files only; it cannot keep a TURN secret or mint credentials. For production, deploy a small authenticated credential endpoint (or use a managed provider's short-lived credential API) and configure the app to fetch short-lived ICE servers from that endpoint. The backend/credential provider and its account are separate from this static site.

## Messaging behavior

- A message typed before the other person is connected stays queued locally and displays a waiting icon; it is sent after the data channel opens.
- The chat displays message bubbles and delivery/read receipts. A failed message can be tapped to retry.
- While chat is open the call controls are hidden and cannot intercept the composer.
- Private history is local to each browser profile. It is not synchronized to another device or recovered after clearing browser storage.
- This app is a 1:1 private chat attached to the call, not a cloud inbox. To preserve the privacy model, there is no server-side delivery after both callers leave.

## Verification

Run the deterministic app-level peer simulation:

```sh
npm ci
npm test
npm run type-check
npm run build
```

The 44 tests cover link creation, late joins, two-person limit, real-state status changes, relay discovery/fallback, all chat states and retry flows, reconnect, mobile-specific screen-share behavior, media controls, and cleanup. These tests validate application logic; they do **not** replace real-device testing of external signaling, camera permissions, TURN authentication, or different Internet providers.

### Real-world release checklist

1. Open the same private link on two devices on different Internet connections (for example: one Wi-Fi, one mobile data).
2. Confirm both show **Connected** only once their peer/media state is actually connected.
3. Open **Details** and confirm a relay candidate is found on the restrictive network, or confirm a direct ICE route succeeds.
4. Send text in both directions; verify delivered/read ticks, reactions, typing indicator, and a message queued before the second caller joins.
5. Repeat with one caller on a VPN/restricted network, then reconnect after temporarily switching networks.
6. Confirm a third browser is told the call is already full and the call for the first two is unaffected.
7. Test real camera/microphone permissions, screen sharing, speaker volume, mobile browser behavior, and the end-call cleanup.

Do not publish a “works worldwide” claim until this checklist succeeds against the actual TURN/signaling services used by the deployed site.
