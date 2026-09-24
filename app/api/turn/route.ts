import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Mint short-lived coturn REST credentials. Configure TURN_SERVER and
 * TURN_SECRET on the server only. Never ship the secret or static demo
 * credentials to a browser. GitHub Pages cannot run this endpoint; static
 * deployments should configure their own relay in the call's network details.
 */
export async function GET() {
  const server = process.env.TURN_SERVER?.trim();
  const secret = process.env.TURN_SECRET;
  if (!server || !secret || secret.length < 32) {
    return NextResponse.json(
      { error: 'TURN is not configured. Set TURN_SERVER and a strong TURN_SECRET on the server.', iceServers: [] },
      { status: 503, headers: { 'Cache-Control': 'no-store, private' } },
    );
  }

  const ttl = 60 * 60 * 6;
  const username = `${Math.floor(Date.now() / 1000) + ttl}:inkocaller`;
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
  const turnUrls = server.split(',').map((value) => value.trim()).filter(Boolean);
  if (!turnUrls.length || turnUrls.some((url) => !/^turns?:/i.test(url))) {
    return NextResponse.json(
      { error: 'TURN_SERVER must contain one or more turn: or turns: URIs.', iceServers: [] },
      { status: 500, headers: { 'Cache-Control': 'no-store, private' } },
    );
  }

  return NextResponse.json(
    {
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302'] },
        { urls: turnUrls, username, credential },
      ],
      expiresAt: Date.now() + ttl * 1000,
    },
    { headers: { 'Cache-Control': 'no-store, private' } },
  );
}
