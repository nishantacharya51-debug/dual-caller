import { NextRequest, NextResponse } from 'next/server';
import { sessionStore } from '@/lib/sessionStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const scheduledFor = body.scheduledFor ? new Date(body.scheduledFor).getTime() : undefined;

    const { session, hostToken } = sessionStore.createSession(scheduledFor);

    return NextResponse.json({
      sessionId: session.id,
      hostToken,
      expiresAt: session.expiresAt,
      url: `/call/${session.id}`,
      fullUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/call/${session.id}`,
    }, {
      headers: {
        'Cache-Control': 'no-store',
      }
    });
  } catch (e) {
    console.error('Session creation failed', e);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('id');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session id' }, { status: 400 });
  }

  const session = sessionStore.getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found or expired', exists: false }, { status: 404 });
  }

  return NextResponse.json({
    exists: true,
    id: session.id,
    participantCount: session.participantCount,
    status: session.status,
    isFull: session.participantCount >= 2,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  });
}
