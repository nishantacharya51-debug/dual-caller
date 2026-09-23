'use client';

import { useState, useEffect, useRef } from 'react';
import { Logo } from './Logo';

interface PreCallScreenProps {
  sessionId: string;
  onJoin: (options: { video: boolean; audio: boolean }) => void;
  participantCount: number;
  isFull: boolean;
  error?: string;
}

export function PreCallScreen({ sessionId, onJoin, participantCount, isFull, error }: PreCallScreenProps) {
  const [hasVideo, setHasVideo] = useState(true);
  const [hasAudio, setHasAudio] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const initPreview = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: hasVideo, 
          audio: hasAudio 
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        const devs = await navigator.mediaDevices.enumerateDevices();
        setDevices(devs);
        setPermissionError(null);
      } catch (err: any) {
        console.error('Preview error', err);
        if (err.name === 'NotAllowedError') {
          setPermissionError('Camera/microphone access denied. Please allow access in browser settings.');
        } else if (err.name === 'NotFoundError') {
          setPermissionError('No camera or microphone found. You can still join with audio or video disabled.');
        } else {
          setPermissionError('Unable to access media devices. Check permissions.');
        }
      }
    };

    if (!isFull) {
      initPreview();
    }

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [hasVideo, hasAudio, isFull]);

  if (isFull) {
    return (
      <div className="min-h-screen bg-[#0B1020] flex items-center justify-center p-6">
        <div className="w-full max-w-[440px] rounded-[24px] bg-white p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#FEF2F2] mx-auto flex items-center justify-center text-2xl">🔒</div>
          <div className="space-y-2">
            <h1 className="font-display text-[24px] font-bold">This private call is already full</h1>
            <p className="text-[15px] text-[#64748B] leading-relaxed">
              InkoCaller allows exactly two people per call. This session already has two participants and cannot accept more.
            </p>
          </div>
          <div className="rounded-xl bg-[#F8FAFC] p-4 text-left space-y-2 border">
            <div className="text-xs font-semibold text-[#475569] uppercase tracking-wider">Session ID</div>
            <div className="font-mono text-sm bg-white border rounded-lg p-2.5 break-all">{sessionId}</div>
          </div>
          <a href="/" className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#0B1020] px-6 text-sm font-semibold text-white hover:bg-black transition-colors">
            Start New Call
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0B1020] flex items-center justify-center p-6">
        <div className="w-full max-w-[440px] rounded-[24px] bg-white p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#FEF2F2] mx-auto flex items-center justify-center text-2xl">⚠️</div>
          <div className="space-y-2">
            <h1 className="font-display text-[22px] font-bold">Unable to join call</h1>
            <p className="text-[14px] text-[#64748B]">{error}</p>
          </div>
          <a href="/" className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#0B1020] px-6 text-sm font-semibold text-white">
            Go Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1020] flex flex-col">
      {/* Header */}
      <header className="flex h-[64px] items-center justify-between px-6 border-b border-white/10">
        <Logo variant="light" size={32} />
        <div className="flex items-center gap-2 text-xs text-white/60">
          <div className="w-2 h-2 bg-[#22C55E] rounded-full animate-pulse-subtle" />
          Secure • Encrypted • {participantCount}/2
        </div>
      </header>

      <div className="flex-1 grid lg:grid-cols-[1.1fr_0.9fr] max-w-[1200px] mx-auto w-full">
        {/* Video preview */}
        <div className="relative bg-black flex items-center justify-center p-6 lg:p-10 min-h-[50vh] lg:min-h-0">
          <div className="relative w-full max-w-[640px] aspect-[4/3] rounded-[20px] overflow-hidden bg-[#172554] shadow-2xl">
            {hasVideo ? (
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-[#0B1020]">
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-2xl">👤</div>
                <div className="text-white/60 text-sm">Camera off</div>
              </div>
            )}
            
            {/* Bottom bar */}
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHasAudio(!hasAudio)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border transition-colors ${hasAudio ? 'bg-white/20 border-white/20 text-white' : 'bg-[#EF4444] border-[#EF4444] text-white'}`}
                  >
                    {hasAudio ? '🎤' : '🔇'}
                  </button>
                  <button
                    onClick={() => setHasVideo(!hasVideo)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border transition-colors ${hasVideo ? 'bg-white/20 border-white/20 text-white' : 'bg-[#EF4444] border-[#EF4444] text-white'}`}
                  >
                    {hasVideo ? '📹' : '🚫'}
                  </button>
                </div>
                <div className="rounded-full bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1 text-xs text-white">
                  {participantCount === 1 ? 'Waiting for other person...' : 'Ready to join'}
                </div>
              </div>
            </div>
          </div>

          {permissionError && (
            <div className="absolute bottom-6 left-6 right-6 lg:left-10 lg:right-10 rounded-xl bg-[#FEF2F2] border border-[#FECACA] p-3 text-sm text-[#991B1B]">
              {permissionError}
            </div>
          )}
        </div>

        {/* Join panel */}
        <div className="bg-white p-6 lg:p-10 flex flex-col justify-center">
          <div className="max-w-[400px] mx-auto w-full space-y-8">
            <div className="space-y-3">
              <h1 className="font-display text-[28px] font-bold leading-tight">Ready to join?</h1>
              <p className="text-[15px] text-[#64748B] leading-relaxed">
                {participantCount === 0 
                  ? 'You are the first person here. Your private call link is ready to share after you join.'
                  : 'One person is already waiting. Join now to start your private call.'
                }
              </p>
            </div>

            {/* Session info */}
            <div className="rounded-2xl bg-[#F8FAFC] border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Private Session</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${participantCount === 1 ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-[#DCFCE7] text-[#166534]'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-subtle" />
                  {participantCount}/2 participants
                </span>
              </div>
              <div className="font-mono text-sm bg-white border rounded-xl p-3 break-all">{sessionId}</div>
              <div className="text-xs text-[#94A3B8]">Exactly two people per call • Server-enforced • Encrypted</div>
            </div>

            {/* Device status */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border p-3 space-y-1">
                <div className="text-lg">{hasVideo ? '📹' : '🚫'}</div>
                <div className="text-xs font-medium">{hasVideo ? 'Camera on' : 'Camera off'}</div>
              </div>
              <div className="rounded-xl border p-3 space-y-1">
                <div className="text-lg">{hasAudio ? '🎤' : '🔇'}</div>
                <div className="text-xs font-medium">{hasAudio ? 'Mic on' : 'Mic off'}</div>
              </div>
              <div className="rounded-xl border p-3 space-y-1">
                <div className="text-lg">🔊</div>
                <div className="text-xs font-medium">Speaker</div>
              </div>
            </div>

            {/* Join buttons */}
            <div className="space-y-3">
              <button
                onClick={() => onJoin({ video: true, audio: true })}
                className="w-full h-[48px] rounded-full bg-[#0B1020] text-white font-semibold flex items-center justify-center gap-2 hover:bg-black transition-colors active:scale-[0.98]"
              >
                <span>📹</span> Join with Video
              </button>
              <button
                onClick={() => onJoin({ video: false, audio: true })}
                className="w-full h-[48px] rounded-full bg-white border border-[#E2E8F0] text-[#0B1020] font-semibold flex items-center justify-center gap-2 hover:bg-[#F8FAFC] transition-colors active:scale-[0.98]"
              >
                <span>🎙️</span> Join with Voice
              </button>
              <div className="text-center text-xs text-[#94A3B8] pt-2">
                By joining, you agree to our privacy-first principles. No recording without consent.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
