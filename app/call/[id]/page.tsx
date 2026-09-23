'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { PreCallScreen } from '@/components/PreCallScreen';
import { CallScreen } from '@/components/CallScreen';
import { getPeerConnectionConfig } from '@/lib/webrtcConfig';

type CallState = 'pre-call' | 'connecting' | 'in-call' | 'ended' | 'full' | 'error';

interface ChatMessage {
  id: string;
  from: string;
  message: string;
  timestamp: number;
}

export default function CallPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const isHost = searchParams.get('host') === 'true';
  const urlToken = searchParams.get('token');

  const [callState, setCallState] = useState<CallState>('pre-call');
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(urlToken);
  const [participantCount, setParticipantCount] = useState(0);
  const [isFull, setIsFull] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [connectionState, setConnectionState] = useState('new');
  const [duration, setDuration] = useState(0);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Array<{ emoji: string; id: string }>>([]);
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(true);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);
  const [stats, setStats] = useState({ rtt: 0, packetLoss: 0, bitrate: 0, resolution: '0x0', fps: 0 });

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check session existence on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch(`/api/session?id=${sessionId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('This call link has expired or does not exist.');
            setCallState('error');
          }
          return;
        }
        const data = await res.json();
        setParticipantCount(data.participantCount);
        if (data.isFull) {
          setIsFull(true);
          setCallState('full');
        }
      } catch (e) {
        console.error('Session check failed', e);
      }
    };
    if (sessionId) checkSession();
  }, [sessionId]);

  // Initialize socket
  const initSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;

    const socket = io({
      auth: { sessionId },
      query: { sessionId },
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('Socket connected', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connect error', err);
      setError('Failed to connect to signaling server. Retrying...');
    });

    socket.on('participant-joined', (data) => {
      console.log('Participant joined', data);
      setParticipantCount(data.count);
    });

    socket.on('participant-left', (data) => {
      console.log('Participant left', data);
      setParticipantCount(prev => Math.max(0, prev - 1));
      // If remote left, clear remote stream
      setRemoteStream(null);
      remoteStreamRef.current = null;
    });

    socket.on('session-ready', () => {
      console.log('Session ready - both participants present');
    });

    socket.on('signal', async (data) => {
      const { from, type, payload } = data;
      console.log('Received signal', type, 'from', from);
      
      if (!pcRef.current) return;

      try {
        if (type === 'offer') {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload));
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          
          socket.emit('signal', {
            sessionId,
            participantId,
            token,
            type: 'answer',
            payload: answer,
          });
        } else if (type === 'answer') {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload));
        } else if (type === 'ice-candidate') {
          if (payload) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(payload));
          }
        }
      } catch (e) {
        console.error('Signal handling error', e);
      }
    });

    socket.on('chat-message', (msg: ChatMessage) => {
      setChatMessages(prev => [...prev, msg]);
    });

    socket.on('reaction', (data: { emoji: string }) => {
      const id = Math.random().toString(36).substring(2);
      setReactions(prev => [...prev, { emoji: data.emoji, id }]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== id));
      }, 1500);
    });

    socketRef.current = socket;
    return socket;
  }, [sessionId, participantId, token]);

  // Create peer connection
  const createPeerConnection = useCallback(async () => {
    try {
      // Get TURN credentials
      let iceServers;
      try {
        const turnRes = await fetch('/api/turn');
        const turnData = await turnRes.json();
        iceServers = turnData.iceServers;
      } catch {
        iceServers = undefined;
      }

      const config = getPeerConnectionConfig();
      if (iceServers) {
        (config as any).iceServers = iceServers;
      }

      const pc = new RTCPeerConnection(config);
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('signal', {
            sessionId,
            participantId,
            token,
            type: 'ice-candidate',
            payload: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('Connection state', pc.connectionState);
        setConnectionState(pc.connectionState);
        if (pc.connectionState === 'failed') {
          // Attempt ICE restart
          pc.restartIce();
        }
      };

      pc.ontrack = (event) => {
        console.log('Received remote track', event.track.kind);
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
          setRemoteStream(remoteStreamRef.current);
        }
        remoteStreamRef.current.addTrack(event.track);
        
        // Detect remote mute states via track enabled
        if (event.track.kind === 'audio') {
          setRemoteAudioEnabled(event.track.enabled);
          event.track.onmute = () => setRemoteAudioEnabled(false);
          event.track.onunmute = () => setRemoteAudioEnabled(true);
        }
        if (event.track.kind === 'video') {
          setRemoteVideoEnabled(event.track.enabled);
          event.track.onmute = () => setRemoteVideoEnabled(false);
          event.track.onunmute = () => setRemoteVideoEnabled(true);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE state', pc.iceConnectionState);
      };

      return pc;
    } catch (e) {
      console.error('Failed to create peer connection', e);
      throw e;
    }
  }, [sessionId, participantId, token]);

  const joinCall = useCallback(async (options: { video: boolean; audio: boolean }) => {
    setCallState('connecting');
    setIsVideoEnabled(options.video);
    setIsAudioEnabled(options.audio);

    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: options.video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        } : false,
        audio: options.audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } : false,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      // Save original video track for screen share toggle
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) originalVideoTrackRef.current = videoTrack;

      // Init socket and join session
      const socket = initSocket();

      const joinResult = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Join timeout')), 10000);
        socket.emit('join-session', {
          sessionId,
          participantId: participantId || undefined,
          token: token || undefined,
        }, (response: any) => {
          clearTimeout(timeout);
          resolve(response);
        });
      });

      console.log('Join result', joinResult);

      if (!joinResult.success) {
        if (joinResult.reason === 'full') {
          setIsFull(true);
          setCallState('full');
          return;
        }
        throw new Error(joinResult.message || 'Failed to join');
      }

      setParticipantId(joinResult.participantId);
      setToken(joinResult.token);
      setParticipantCount(joinResult.participantCount);

      // Create peer connection
      const pc = await createPeerConnection();

      // Add local tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // If second participant, create offer
      if (joinResult.participantCount === 2) {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        
        socket.emit('signal', {
          sessionId,
          participantId: joinResult.participantId,
          token: joinResult.token,
          type: 'offer',
          payload: offer,
        });
      }

      setCallState('in-call');

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

      // Start stats polling
      statsIntervalRef.current = setInterval(async () => {
        if (!pcRef.current) return;
        try {
          const statsReport = await pcRef.current.getStats();
          let rtt = 0, packetLoss = 0, bitrate = 0, fps = 0, width = 0, height = 0;
          
          statsReport.forEach(report => {
            if (report.type === 'candidate-pair' && (report as any).state === 'succeeded') {
              rtt = (report as any).currentRoundTripTime ? (report as any).currentRoundTripTime * 1000 : rtt;
            }
            if (report.type === 'inbound-rtp' && (report as any).kind === 'video') {
              packetLoss = (report as any).packetsLost ? ((report as any).packetsLost / ((report as any).packetsReceived + (report as any).packetsLost)) * 100 : 0;
              fps = (report as any).framesPerSecond || fps;
              bitrate = (report as any).bytesReceived ? (report as any).bytesReceived * 8 / 1000 : bitrate;
            }
            if (report.type === 'track' && (report as any).kind === 'video') {
              width = (report as any).frameWidth || width;
              height = (report as any).frameHeight || height;
            }
          });

          setStats({
            rtt: Math.round(rtt),
            packetLoss: Math.round(packetLoss * 10) / 10,
            bitrate: Math.round(bitrate),
            resolution: width && height ? `${width}x${height}` : '0x0',
            fps: Math.round(fps),
          });
        } catch {}
      }, 2000);

    } catch (err: any) {
      console.error('Join call error', err);
      setError(err.message || 'Failed to join call. Check camera/microphone permissions.');
      setCallState('error');
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    }
  }, [sessionId, participantId, token, initSocket, createPeerConnection]);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsAudioEnabled(audioTracks[0]?.enabled ?? false);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(videoTracks[0]?.enabled ?? false);
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (!pcRef.current || !localStreamRef.current) return;

    try {
      if (isScreenSharing) {
        // Stop screen share, restore camera
        const screenTrack = localStreamRef.current.getVideoTracks()[0];
        screenTrack.stop();
        
        if (originalVideoTrackRef.current) {
          const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const newVideoTrack = newStream.getVideoTracks()[0];
          originalVideoTrackRef.current = newVideoTrack;
          
          const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender) await sender.replaceTrack(newVideoTrack);
          
          localStreamRef.current.removeTrack(screenTrack);
          localStreamRef.current.addTrack(newVideoTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }
        setIsScreenSharing(false);
      } else {
        // Start screen share
        const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: { cursor: 'always' },
          audio: true,
        });
        const screenTrack = screenStream.getVideoTracks()[0];
        
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(screenTrack);
        
        // Keep original camera track stopped but saved
        const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (currentVideoTrack) {
          localStreamRef.current.removeTrack(currentVideoTrack);
          currentVideoTrack.stop();
        }
        
        localStreamRef.current.addTrack(screenTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        setIsScreenSharing(true);

        screenTrack.onended = () => {
          toggleScreenShare();
        };
      }
    } catch (e) {
      console.error('Screen share error', e);
    }
  }, [isScreenSharing]);

  const endCall = useCallback(() => {
    // Cleanup
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    remoteStreamRef.current?.getTracks().forEach(t => t.stop());
    
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    if (socketRef.current && participantId) {
      socketRef.current.emit('leave-session', { sessionId, participantId });
      socketRef.current.disconnect();
    }
    
    setCallState('ended');
    setTimeout(() => router.push('/'), 2000);
  }, [sessionId, participantId, router]);

  const sendMessage = useCallback((message: string) => {
    if (!socketRef.current || !participantId || !token) return;
    
    socketRef.current.emit('chat-message', {
      sessionId,
      participantId,
      token,
      message,
      id: Math.random().toString(36).substring(2, 9),
    });
  }, [sessionId, participantId, token]);

  const sendReaction = useCallback((emoji: string) => {
    if (!socketRef.current || !participantId || !token) return;
    
    socketRef.current.emit('reaction', {
      sessionId,
      participantId,
      token,
      emoji,
    });
    
    // Show locally too
    const id = Math.random().toString(36).substring(2);
    setReactions(prev => [...prev, { emoji, id }]);
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 1500);
  }, [sessionId, participantId, token]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      if (pcRef.current) pcRef.current.close();
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  if (callState === 'pre-call' || callState === 'connecting') {
    return (
      <PreCallScreen
        sessionId={sessionId}
        onJoin={joinCall}
        participantCount={participantCount}
        isFull={isFull}
        error={callState === 'connecting' ? undefined : error}
      />
    );
  }

  if (callState === 'full') {
    return (
      <div className="min-h-screen bg-[#0B1020] flex items-center justify-center p-6">
        <div className="w-full max-w-[440px] rounded-[24px] bg-white p-8 text-center space-y-6 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-[#FEF2F2] mx-auto flex items-center justify-center text-2xl">🔒</div>
          <div className="space-y-2">
            <h1 className="font-display text-[24px] font-bold">Call is full</h1>
            <p className="text-[15px] text-[#64748B] leading-relaxed">
              This private call already has two participants. InkoCaller enforces exactly two people per call for privacy.
            </p>
          </div>
          <div className="rounded-xl bg-[#F8FAFC] p-4 text-left border">
            <div className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2">Session</div>
            <div className="font-mono text-sm bg-white border rounded-lg p-2.5 break-all">{sessionId}</div>
            <div className="text-xs text-[#94A3B8] mt-2">Server-enforced • No third participant allowed</div>
          </div>
          <button onClick={() => router.push('/')} className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#0B1020] px-6 text-sm font-semibold text-white hover:bg-black transition-colors">
            Start New Private Call
          </button>
        </div>
      </div>
    );
  }

  if (callState === 'error') {
    return (
      <div className="min-h-screen bg-[#0B1020] flex items-center justify-center p-6">
        <div className="w-full max-w-[440px] rounded-[24px] bg-white p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#FEF2F2] mx-auto flex items-center justify-center text-2xl">⚠️</div>
          <div className="space-y-2">
            <h1 className="font-display text-[22px] font-bold">Unable to join</h1>
            <p className="text-[14px] text-[#64748B]">{error || 'Something went wrong'}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setCallState('pre-call')} className="flex-1 h-11 rounded-full bg-[#0B1020] text-white text-sm font-semibold">Try Again</button>
            <button onClick={() => router.push('/')} className="flex-1 h-11 rounded-full border text-sm font-semibold">Go Home</button>
          </div>
        </div>
      </div>
    );
  }

  if (callState === 'ended') {
    return (
      <div className="min-h-screen bg-[#0B1020] flex items-center justify-center p-6">
        <div className="w-full max-w-[400px] rounded-[24px] bg-white p-8 text-center space-y-6 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-[#F0FDF4] mx-auto flex items-center justify-center text-2xl">✓</div>
          <div className="space-y-2">
            <h1 className="font-display text-[22px] font-bold">Call ended</h1>
            <p className="text-[14px] text-[#64748B]">Duration: {Math.floor(duration / 60)}m {duration % 60}s • Session cleaned up</p>
          </div>
          <div className="text-xs text-[#94A3B8]">Redirecting to home...</div>
        </div>
      </div>
    );
  }

  return (
    <CallScreen
      sessionId={sessionId}
      participantId={participantId || ''}
      localStream={localStream}
      remoteStream={remoteStream}
      participantCount={participantCount}
      connectionState={connectionState}
      stats={stats}
      onToggleAudio={toggleAudio}
      onToggleVideo={toggleVideo}
      onToggleScreenShare={toggleScreenShare}
      onEndCall={endCall}
      onToggleChat={() => setIsChatOpen(!isChatOpen)}
      onReaction={sendReaction}
      isAudioEnabled={isAudioEnabled}
      isVideoEnabled={isVideoEnabled}
      isScreenSharing={isScreenSharing}
      chatMessages={chatMessages}
      onSendMessage={sendMessage}
      isChatOpen={isChatOpen}
      reactions={reactions}
      duration={duration}
      remoteAudioEnabled={remoteAudioEnabled}
      remoteVideoEnabled={remoteVideoEnabled}
    />
  );
}
