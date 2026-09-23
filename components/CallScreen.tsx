'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { formatDuration, getConnectionQuality } from '@/lib/utils';
import { Logo } from './Logo';

interface CallScreenProps {
  sessionId: string;
  participantId: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  participantCount: number;
  connectionState: string;
  stats: {
    rtt: number;
    packetLoss: number;
    bitrate: number;
    resolution: string;
    fps: number;
  };
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onEndCall: () => void;
  onToggleChat: () => void;
  onReaction: (emoji: string) => void;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  chatMessages: Array<{ id: string; from: string; message: string; timestamp: number }>;
  onSendMessage: (msg: string) => void;
  isChatOpen: boolean;
  reactions: Array<{ emoji: string; id: string }>;
  duration: number;
  remoteAudioEnabled: boolean;
  remoteVideoEnabled: boolean;
}

export function CallScreen({
  sessionId,
  participantId,
  localStream,
  remoteStream,
  participantCount,
  connectionState,
  stats,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onEndCall,
  onToggleChat,
  onReaction,
  isAudioEnabled,
  isVideoEnabled,
  isScreenSharing,
  chatMessages,
  onSendMessage,
  isChatOpen,
  reactions,
  duration,
  remoteAudioEnabled,
  remoteVideoEnabled,
}: CallScreenProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [beautyFilter, setBeautyFilter] = useState(0);
  const [lowLight, setLowLight] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState<'original' | 'blur' | 'virtual'>('original');
  const [showSettings, setShowSettings] = useState(false);
  const [captions, setCaptions] = useState<string[]>([]);
  const [isCaptionEnabled, setIsCaptionEnabled] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const quality = getConnectionQuality(stats.rtt, stats.packetLoss);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    const resetTimer = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 4000);
    };
    
    resetTimer();
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    
    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // Live captions using Web Speech API
  useEffect(() => {
    if (!isCaptionEnabled) return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript.trim()) {
        setCaptions(prev => [...prev.slice(-2), transcript].slice(-3));
        setTimeout(() => setCaptions(prev => prev.filter(c => c !== transcript)), 5000);
      }
    };

    recognition.start();
    return () => recognition.stop();
  }, [isCaptionEnabled]);

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    onSendMessage(messageInput.trim());
    setMessageInput('');
  };

  const toggleRecording = async () => {
    if (isRecording && mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    } else {
      try {
        if (!localStream) return;
        const recorder = new MediaRecorder(localStream, { mimeType: 'video/webm' });
        const chunks: BlobPart[] = [];
        
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `inkocaller-${sessionId}-${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
        };
        
        recorder.start();
        setMediaRecorder(recorder);
        setIsRecording(true);
      } catch (e) {
        console.error('Recording failed', e);
      }
    }
  };

  return (
    <div className="relative h-screen w-screen bg-[#020617] overflow-hidden flex flex-col select-none">
      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-[#EF4444] px-4 py-1.5 text-white text-xs font-semibold shadow-lg animate-pulse-subtle">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          Recording • Visible to both participants
        </div>
      )}

      {/* Main video area */}
      <div className="flex-1 relative flex">
        {/* Remote video - main */}
        <div className="flex-1 relative bg-[#0B1020] overflow-hidden">
          {remoteStream && remoteVideoEnabled ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              style={{
                filter: `brightness(${lowLight ? 1.2 : 1}) contrast(${1 + beautyFilter * 0.1})`,
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-[#0B1020] to-[#172554]">
              <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-3xl border border-white/10">
                👤
              </div>
              <div className="text-center space-y-2">
                <div className="text-white font-medium">
                  {participantCount === 1 ? 'Waiting for other person...' : remoteVideoEnabled ? 'Connecting...' : 'Voice only'}
                </div>
                <div className="text-white/50 text-sm">
                  {participantCount === 1 ? 'Share your link to invite them' : `${quality} connection • ${formatDuration(duration)}`}
                </div>
                {!remoteAudioEnabled && participantCount === 2 && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#EF4444]/20 border border-[#EF4444]/30 px-3 py-1 text-xs text-[#FCA5A5]">
                    🔇 Other person muted
                  </div>
                )}
              </div>
              {/* Audio visualizer for voice mode */}
              {participantCount === 2 && !remoteVideoEnabled && (
                <div className="flex items-center gap-1 h-8">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="w-1 bg-[#2563EB] rounded-full animate-wave" style={{ height: `${12 + Math.random() * 24}px`, animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reactions overlay */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {reactions.map(r => (
              <div key={r.id} className="absolute bottom-20 left-1/2 text-4xl animate-reaction" style={{ left: `${45 + Math.random() * 10}%` }}>
                {r.emoji}
              </div>
            ))}
          </div>

          {/* Captions */}
          {isCaptionEnabled && captions.length > 0 && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 max-w-[80%] rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 px-4 py-2 text-white text-sm text-center">
              {captions[0]}
            </div>
          )}

          {/* Top bar */}
          <div className={`absolute top-0 inset-x-0 p-4 flex items-center justify-between z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 flex items-center gap-2 text-white text-xs">
                <div className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'} animate-pulse-subtle`} />
                {quality} • {stats.rtt}ms • {formatDuration(duration)}
              </div>
              <button onClick={() => setShowStats(!showStats)} className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white text-xs hover:bg-black/80">
                📊
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 text-white text-xs font-mono">
                {sessionId.slice(0, 8)} • {participantCount}/2
              </div>
              <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center">
                <Logo size={20} showText={false} />
              </div>
            </div>
          </div>

          {/* Stats panel */}
          {showStats && (
            <div className="absolute top-16 left-4 z-30 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/10 p-4 text-white w-[280px] space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Connection Quality</h3>
                <button onClick={() => setShowStats(false)} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-white/5 p-2.5">
                  <div className="text-white/50">Latency</div>
                  <div className="font-mono font-semibold">{stats.rtt} ms</div>
                </div>
                <div className="rounded-xl bg-white/5 p-2.5">
                  <div className="text-white/50">Packet Loss</div>
                  <div className="font-mono font-semibold">{stats.packetLoss.toFixed(1)}%</div>
                </div>
                <div className="rounded-xl bg-white/5 p-2.5">
                  <div className="text-white/50">Bitrate</div>
                  <div className="font-mono font-semibold">{(stats.bitrate / 1000).toFixed(0)} kbps</div>
                </div>
                <div className="rounded-xl bg-white/5 p-2.5">
                  <div className="text-white/50">Resolution</div>
                  <div className="font-mono font-semibold">{stats.resolution}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-2.5">
                  <div className="text-white/50">FPS</div>
                  <div className="font-mono font-semibold">{stats.fps}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-2.5">
                  <div className="text-white/50">Status</div>
                  <div className="font-mono font-semibold capitalize">{connectionState}</div>
                </div>
              </div>
              <div className="text-[11px] text-white/40 pt-2 border-t border-white/10">
                P2P WebRTC • DTLS-SRTP • ICE • {isScreenSharing ? 'Screen sharing' : 'Camera'}
              </div>
            </div>
          )}

          {/* Local video - PiP on mobile, side-by-side on desktop */}
          <div className="absolute bottom-24 right-4 md:bottom-28 md:right-6 w-[120px] h-[160px] md:w-[200px] md:h-[150px] rounded-[16px] overflow-hidden bg-[#0B1020] border-2 border-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-10 group cursor-move">
            {localStream && isVideoEnabled ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover scale-x-[-1]"
                style={{
                  filter: `brightness(${lowLight ? 1.3 : 1}) contrast(${1 + beautyFilter * 0.15}) blur(${backgroundMode === 'blur' ? '2px' : '0px'})`,
                }}
              />
            ) : (
              <div className="w-full h-full bg-[#172554] flex items-center justify-center">
                <span className="text-white/60 text-xs">{isVideoEnabled ? 'No camera' : 'Camera off'}</span>
              </div>
            )}
            
            <div className="absolute bottom-1 left-1 right-1 flex justify-between items-center">
              <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur-md">You</span>
              {!isAudioEnabled && <span className="w-5 h-5 rounded-full bg-[#EF4444] flex items-center justify-center text-[10px]">🔇</span>}
            </div>
          </div>
        </div>

        {/* Chat panel */}
        {isChatOpen && (
          <div className="w-[360px] border-l border-white/10 bg-[#0B1020] flex flex-col animate-slide-up md:animate-none">
            <div className="h-[64px] border-b border-white/10 flex items-center justify-between px-4">
              <h3 className="font-semibold text-white">Private Chat</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">Ephemeral • 2 people</span>
                <button onClick={onToggleChat} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20">✕</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-white/5 mx-auto flex items-center justify-center text-xl">💬</div>
                  <div className="text-white/60 text-sm">No messages yet</div>
                  <div className="text-white/30 text-xs">Messages are ephemeral and encrypted in transit</div>
                </div>
              ) : (
                chatMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.from === participantId ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-[16px] px-3 py-2 text-sm ${msg.from === participantId ? 'bg-[#2563EB] text-white rounded-br-[4px]' : 'bg-white/10 text-white rounded-bl-[4px] border border-white/10'}`}>
                      <div>{msg.message}</div>
                      <div className={`text-[10px] mt-1 ${msg.from === participantId ? 'text-white/70' : 'text-white/40'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-4 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 h-10 rounded-full bg-white/10 border border-white/10 px-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[#2563EB]/50 focus:bg-white/[0.15]"
                  maxLength={500}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="w-10 h-10 rounded-full bg-[#2563EB] text-white flex items-center justify-center hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ↑
                </button>
              </div>
              <div className="flex gap-1.5 mt-3">
                {['👍', '❤️', '😂', '👏', '🎉'].map(emoji => (
                  <button key={emoji} onClick={() => onReaction(emoji)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-sm transition-colors">
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className={`absolute bottom-0 inset-x-0 p-4 md:p-6 flex justify-center z-30 transition-all duration-300 ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-2 rounded-full bg-black/70 backdrop-blur-xl border border-white/10 px-3 py-2.5 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
          <button
            onClick={onToggleAudio}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all active:scale-95 ${isAudioEnabled ? 'bg-white/15 text-white hover:bg-white/20' : 'bg-[#EF4444] text-white hover:bg-[#DC2626]'}`}
            title={isAudioEnabled ? 'Mute' : 'Unmute'}
          >
            {isAudioEnabled ? '🎤' : '🔇'}
          </button>
          
          <button
            onClick={onToggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all active:scale-95 ${isVideoEnabled ? 'bg-white/15 text-white hover:bg-white/20' : 'bg-[#EF4444] text-white hover:bg-[#DC2626]'}`}
            title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {isVideoEnabled ? '📹' : '🚫'}
          </button>

          <div className="w-[1px] h-6 bg-white/10 mx-1" />

          <button
            onClick={onToggleScreenShare}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all active:scale-95 ${isScreenSharing ? 'bg-[#2563EB] text-white' : 'bg-white/15 text-white hover:bg-white/20'}`}
            title="Screen share"
          >
            🖥️
          </button>

          <button
            onClick={onToggleChat}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all active:scale-95 relative ${isChatOpen ? 'bg-[#2563EB] text-white' : 'bg-white/15 text-white hover:bg-white/20'}`}
            title="Chat"
          >
            💬
            {chatMessages.length > 0 && !isChatOpen && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#EF4444] rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                {chatMessages.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsCaptionEnabled(!isCaptionEnabled)}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all active:scale-95 ${isCaptionEnabled ? 'bg-[#2563EB] text-white' : 'bg-white/15 text-white hover:bg-white/20'}`}
            title="Live captions"
          >
            📝
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all active:scale-95 ${showSettings ? 'bg-white/25 text-white' : 'bg-white/15 text-white hover:bg-white/20'}`}
            title="Settings"
          >
            ⚙️
          </button>

          <div className="w-[1px] h-6 bg-white/10 mx-1" />

          <button
            onClick={onEndCall}
            className="w-12 h-12 rounded-full bg-[#EF4444] text-white flex items-center justify-center text-lg hover:bg-[#DC2626] transition-all active:scale-95 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
            title="End call"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0 z-40 w-[90%] md:w-[360px] rounded-[20px] bg-[#0B1020]/90 backdrop-blur-xl border border-white/10 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)] animate-slide-up">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-white">Call Settings</h3>
            <button onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">✕</button>
          </div>
          
          <div className="space-y-5">
            <div>
              <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Appearance</div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">Beauty filter</span>
                  <input type="range" min="0" max="100" value={beautyFilter} onChange={e => setBeautyFilter(Number(e.target.value))} className="w-24 accent-[#2563EB]" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">Low light boost</span>
                  <button onClick={() => setLowLight(!lowLight)} className={`w-12 h-6 rounded-full p-1 transition-colors ${lowLight ? 'bg-[#2563EB]' : 'bg-white/20'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${lowLight ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">Background</span>
                  <select value={backgroundMode} onChange={e => setBackgroundMode(e.target.value as any)} className="rounded-full bg-white/10 border border-white/10 px-3 py-1 text-xs text-white">
                    <option value="original" className="text-black">Original</option>
                    <option value="blur" className="text-black">Blur</option>
                    <option value="virtual" className="text-black">Virtual</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Recording</div>
              <button
                onClick={toggleRecording}
                className={`w-full h-10 rounded-full font-medium text-sm flex items-center justify-center gap-2 ${isRecording ? 'bg-[#EF4444] text-white' : 'bg-white/10 text-white hover:bg-white/15'}`}
              >
                <span>{isRecording ? '⏹️' : '⏺️'}</span>
                {isRecording ? 'Stop Recording (visible to both)' : 'Start Recording'}
              </button>
              <div className="text-[11px] text-white/40 mt-2">Recording indicator is always visible to both participants. Local download only.</div>
            </div>

            <div>
              <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Privacy</div>
              <div className="rounded-xl bg-white/5 p-3 text-xs text-white/60 leading-relaxed">
                • P2P encrypted (DTLS-SRTP)<br/>
                • No permanent storage<br/>
                • Session expires after call<br/>
                • Exactly 2 participants enforced
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick reactions bar */}
      <div className={`absolute bottom-24 left-4 z-20 flex gap-2 transition-all duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {['👍', '❤️', '😂', '👏', '🎉', '😮'].map(emoji => (
          <button
            key={emoji}
            onClick={() => onReaction(emoji)}
            className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/80 hover:scale-110 transition-all active:scale-95"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
