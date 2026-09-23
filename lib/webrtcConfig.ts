export interface TurnCredentials {
  username: string;
  credential: string;
  ttl: number;
  urls: string[];
}

export function getIceServers(turnCredentials?: TurnCredentials): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];

  if (turnCredentials) {
    servers.push({
      urls: turnCredentials.urls,
      username: turnCredentials.username,
      credential: turnCredentials.credential,
    });
  } else {
    // Fallback to free openrelay for development (limited)
    // In production, use your own coturn
    const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
    const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME;
    const turnPass = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
    
    if (turnUrl && turnUser && turnPass) {
      servers.push({
        urls: turnUrl,
        username: turnUser,
        credential: turnPass,
      });
    }
  }

  return servers;
}

export function getPeerConnectionConfig(turnCredentials?: TurnCredentials): RTCConfiguration {
  return {
    iceServers: getIceServers(turnCredentials),
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 10,
  };
}

export const mediaConstraints = {
  video: {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 60 },
    facingMode: 'user',
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 1,
  },
};

export const screenShareConstraints = {
  video: {
    cursor: 'always' as const,
    displaySurface: 'monitor' as const,
  },
  audio: true,
};
