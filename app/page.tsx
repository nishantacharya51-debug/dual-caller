'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Header } from '@/components/Header';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const createCall = async () => {
    setIsCreating(true);
    try {
      const res = await fetch('/api/session', { method: 'POST' });
      const data = await res.json();
      if (data.sessionId) {
        router.push(`/call/${data.sessionId}?host=true&token=${data.hostToken}`);
      }
    } catch (e) {
      console.error(e);
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0B1020] overflow-hidden">
      <Header />
      
      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 mesh-bg" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#F8FAFC]" />
        
        {/* Floating orbs */}
        <div className="absolute top-20 left-[10%] w-72 h-72 bg-[#2563EB]/10 rounded-full blur-[80px] animate-float" />
        <div className="absolute top-40 right-[15%] w-96 h-96 bg-[#7C3AED]/10 rounded-full blur-[100px] animate-float" style={{ animationDelay: '2s' }} />
        
        <div className="relative mx-auto max-w-[1200px] px-6 pt-16 pb-24 md:pt-28 md:pb-32">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-8 items-center">
            {/* Left content */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#2563EB]/20 bg-white px-3 py-1 text-xs font-medium text-[#2563EB] shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]"></span>
                </span>
                Privacy-first • No tracking • Just two people
              </div>
              
              <div className="space-y-5">
                <h1 className="font-display text-[42px] md:text-[64px] font-bold leading-[0.95] tracking-tight">
                  Private calls.<br />
                  <span className="bg-gradient-to-r from-[#2563EB] to-[#7C3AED] bg-clip-text text-transparent">
                    Just two people.
                  </span>
                </h1>
                <p className="text-[18px] md:text-[20px] leading-relaxed text-[#475569] max-w-[520px]">
                  Instant, secure video and voice calls with no group clutter. HD video, crystal-clear audio, screen sharing — built for intimate conversations.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2" id="start">
                <button
                  onClick={createCall}
                  disabled={isCreating}
                  className="group inline-flex h-[52px] items-center justify-center gap-2 rounded-full bg-[#0B1020] px-8 text-[16px] font-semibold text-white shadow-premium transition-all hover:bg-black hover:shadow-lg hover:translate-y-[-1px] active:translate-y-[0px] active:scale-[0.98] disabled:opacity-60"
                >
                  {isCreating ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Start a Call
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="transition-transform group-hover:translate-x-0.5">
                        <path d="M7 4L13 10L7 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </>
                  )}
                </button>
                
                <a
                  href="#how-it-works"
                  className="inline-flex h-[52px] items-center justify-center rounded-full border border-[#E2E8F0] bg-white px-8 text-[16px] font-semibold text-[#0B1020] shadow-sm transition-all hover:border-[#CBD5E1] hover:bg-[#F8FAFC] active:scale-[0.98]"
                >
                  How It Works
                </a>
              </div>

              <div className="flex items-center gap-6 pt-4 text-sm text-[#64748B]">
                <span className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L10.5 5.5L14.5 6L11.5 9L12 13L8 11L4 13L4.5 9L1.5 6L5.5 5.5L8 1.5Z" fill="#F59E0B"/></svg>
                  No signup required
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-[#CBD5E1] rounded-full" />
                  End-to-end encrypted
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-[#CBD5E1] rounded-full" />
                  Works in browser
                </span>
              </div>
            </div>

            {/* Right - Call preview mockup */}
            <div className="relative lg:ml-8">
              <div className="relative mx-auto w-full max-w-[520px]">
                {/* Browser chrome */}
                <div className="overflow-hidden rounded-[24px] border border-black/10 bg-white shadow-[0_20px_80px_-20px_rgba(0,0,0,0.3)]">
                  <div className="flex h-12 items-center gap-2 border-b border-black/5 bg-[#F8FAFC] px-4">
                    <div className="flex gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-[#EF4444]" />
                      <div className="h-3 w-3 rounded-full bg-[#F59E0B]" />
                      <div className="h-3 w-3 rounded-full bg-[#22C55E]" />
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="flex h-7 items-center gap-2 rounded-full bg-white px-3 text-xs text-[#64748B] border border-black/5">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1C4.2 1 2 3.2 2 6C2 8.8 4.2 11 7 11C9.8 11 12 8.8 12 6C12 3.2 9.8 1 7 1ZM7 10C4.8 10 3 8.2 3 6C3 3.8 4.8 2 7 2C9.2 2 11 3.8 11 6C11 8.2 9.2 10 7 10Z" fill="#22C55E"/><path d="M7 4C6.4 4 6 4.4 6 5C6 5.6 6.4 6 7 6C7.6 6 8 5.6 8 5C8 4.4 7.6 4 7 4Z" fill="#22C55E"/></svg>
                        inkocaller.app/call/••••••••
                      </div>
                    </div>
                  </div>
                  
                  {/* Call UI preview */}
                  <div className="relative aspect-[4/3] bg-[#0B1020] overflow-hidden">
                    <div className="absolute inset-0 grid grid-cols-2 gap-1 p-1">
                      <div className="relative rounded-[16px] overflow-hidden bg-[#172554] flex items-center justify-center">
                        <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop" alt="" className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">You</div>
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#22C55E]/20 flex items-center justify-center"><div className="w-2 h-2 bg-[#22C55E] rounded-full animate-pulse-subtle" /></div>
                      </div>
                      <div className="relative rounded-[16px] overflow-hidden bg-[#172554] flex items-center justify-center">
                        <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop" alt="" className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">Alex</div>
                        <div className="absolute bottom-2 right-2 flex gap-1">
                          <div className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center"><span className="text-[10px]">🎙️</span></div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Controls */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 backdrop-blur-xl border border-white/10">
                      <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white">🎤</div>
                      <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white">📹</div>
                      <div className="w-8 h-8 rounded-full bg-[#EF4444] flex items-center justify-center text-white">✕</div>
                    </div>

                    {/* Quality badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-md border border-white/10">
                      <div className="w-2 h-2 bg-[#22C55E] rounded-full" />
                      <span className="text-[11px] font-medium text-white">HD • Excellent</span>
                    </div>
                  </div>
                </div>

                {/* Floating cards */}
                <div className="absolute -right-6 top-[20%] hidden md:flex items-center gap-2 rounded-2xl bg-white p-3 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-black/5 animate-float">
                  <div className="w-10 h-10 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]">🔒</div>
                  <div>
                    <div className="text-xs font-semibold">End-to-end encrypted</div>
                    <div className="text-[11px] text-[#64748B]">DTLS-SRTP • Secure</div>
                  </div>
                </div>

                <div className="absolute -left-8 bottom-[15%] hidden md:flex items-center gap-2 rounded-2xl bg-white p-3 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-black/5 animate-float" style={{ animationDelay: '1s' }}>
                  <div className="w-10 h-10 rounded-full bg-[#F3E8FF] flex items-center justify-center">⚡</div>
                  <div>
                    <div className="text-xs font-semibold">2 participants only</div>
                    <div className="text-[11px] text-[#64748B]">No groups, just you two</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-black/5 bg-white py-20 md:py-28">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mx-auto max-w-[640px] text-center space-y-4 mb-16">
            <div className="inline-flex rounded-full bg-[#EFF6FF] px-3 py-1 text-xs font-semibold text-[#2563EB]">FEATURES</div>
            <h2 className="font-display text-[32px] md:text-[44px] font-bold leading-[1.1] tracking-tight">Everything for private conversations</h2>
            <p className="text-[17px] leading-relaxed text-[#475569]">Built for clarity, privacy, and connection. No bloat, no groups, no distractions.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: '🎥', title: 'HD Video', desc: 'Adaptive 360p to 1080p with automatic quality adjustment. Prioritizes smoothness over pixels.', color: 'bg-[#EFF6FF]' },
              { icon: '🎙️', title: 'Crystal Voice', desc: 'Noise cancellation, echo suppression, auto gain. Sounds like you are in the same room.', color: 'bg-[#F0FDF4]' },
              { icon: '🖥️', title: 'Screen Sharing', desc: 'Share your screen, window, or tab. Perfect for quick collaboration without group chaos.', color: 'bg-[#FEF3C7]' },
              { icon: '💬', title: 'Private Chat', desc: 'Ephemeral two-person chat with emoji reactions. Messages disappear when session ends.', color: 'bg-[#F3E8FF]' },
              { icon: '📝', title: 'Live Captions', desc: 'Real-time captions using Web Speech API. Local processing where possible, privacy first.', color: 'bg-[#FFF1F2]' },
              { icon: '🔒', title: 'Privacy First', desc: 'No permanent storage of video/audio. Temporary sessions with TTL cleanup. Minimal metadata.', color: 'bg-[#F0F9FF]' },
            ].map((f, i) => (
              <div key={i} className="group relative rounded-[20px] border border-black/5 bg-[#F8FAFC] p-6 transition-all hover:bg-white hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.15)] hover:border-black/10 hover:-translate-y-1">
                <div className={`w-12 h-12 rounded-[12px] ${f.color} flex items-center justify-center text-xl mb-4`}>{f.icon}</div>
                <h3 className="font-semibold text-[17px] mb-2">{f.title}</h3>
                <p className="text-[14px] leading-relaxed text-[#64748B]">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-4 gap-4 mt-6">
            {[
              { label: 'No downloads', sub: 'Works in browser' },
              { label: 'Mobile ready', sub: 'iOS Safari, Android' },
              { label: 'PWA support', sub: 'Install like an app' },
              { label: '2 people max', sub: 'Enforced server-side' },
            ].map((item, i) => (
              <div key={i} className="rounded-2xl border border-black/5 bg-white p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#0B1020] text-white flex items-center justify-center text-sm">✓</div>
                <div>
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="text-xs text-[#64748B]">{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 md:py-28 bg-[#0B1020] text-white relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#2563EB]/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#7C3AED]/20 rounded-full blur-[120px]" />
        </div>
        
        <div className="relative mx-auto max-w-[1200px] px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <div className="space-y-4">
              <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wider">HOW IT WORKS</div>
              <h2 className="font-display text-[36px] md:text-[48px] font-bold leading-[1.05] tracking-tight max-w-[520px]">Three steps to private connection</h2>
            </div>
            <p className="text-[#94A3B8] text-[17px] max-w-[360px] leading-relaxed">No accounts, no complexity. Just a secure link between two people.</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '01', title: 'Start a call', desc: 'Click start. A cryptographically secure private link is created instantly.' },
              { step: '02', title: 'Share link', desc: 'Copy, native share, WhatsApp, Messenger, SMS, or email. Your choice.' },
              { step: '03', title: 'Friend joins', desc: 'They open the link. Pre-call preview, device check, then join.' },
              { step: '04', title: 'Talk privately', desc: 'Secure P2P WebRTC. Only two people, ever. Session auto-expires after.' },
            ].map((s, i) => (
              <div key={i} className="group relative rounded-[20px] bg-white/[0.06] border border-white/10 p-6 backdrop-blur-md hover:bg-white/[0.08] transition-colors">
                <div className="text-[13px] font-mono text-[#60A5FA] mb-6">{s.step}</div>
                <h3 className="font-semibold text-[18px] mb-3">{s.title}</h3>
                <p className="text-[14px] leading-relaxed text-[#94A3B8]">{s.desc}</p>
                {i < 3 && <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-[1px] bg-white/20" />}
              </div>
            ))}
          </div>

          <div className="mt-16 rounded-[24px] bg-white/[0.06] border border-white/10 p-8 md:p-10 backdrop-blur-md">
            <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-10 items-center">
              <div className="space-y-6">
                <h3 className="font-display text-[24px] font-bold leading-tight">Why exactly two people?</h3>
                <div className="space-y-4 text-[#CBD5E1] text-[15px] leading-relaxed">
                  <p>Group calls are noisy, performative, and exhausting. InkoCaller is designed for the conversations that actually matter — one-to-one, private, present.</p>
                  <p>We enforce this server-side with atomic participant reservation, cryptographic session tokens, and strict rejection of third join attempts. No third tile, ever.</p>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {['Atomic reservation', 'Race-condition safe', 'Server-enforced', 'No group mode'].map(tag => (
                    <span key={tag} className="rounded-full bg-white/10 border border-white/10 px-3 py-1 text-xs font-medium">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="rounded-[16px] bg-[#020617] border border-white/10 p-4 font-mono text-xs leading-relaxed overflow-hidden">
                  <div className="text-[#64748B]">// server enforcement</div>
                  <div className="text-[#E2E8F0]">participantLimit = <span className="text-[#22C55E]">2</span></div>
                  <div className="text-[#E2E8F0]">if (count &gt;= <span className="text-[#22C55E]">2</span>) &#123;</div>
                  <div className="pl-4 text-[#F59E0B]">REJECT third user</div>
                  <div className="pl-4 text-[#94A3B8]">// "Call already full"</div>
                  <div className="text-[#E2E8F0]">&#125;</div>
                  <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#22C55E] rounded-full animate-pulse-subtle" />
                    <span className="text-[#22C55E] text-[11px]">Enforced in sessionStore.ts</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white border-t border-black/5">
        <div className="mx-auto max-w-[800px] px-6 text-center space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#F8FAFC] border border-black/5 px-4 py-1.5 text-xs font-medium">
            <span className="w-2 h-2 bg-[#22C55E] rounded-full animate-pulse-subtle" />
            20,000 participants supported • 10,000 concurrent calls architecture
          </div>
          <h2 className="font-display text-[32px] md:text-[44px] font-bold leading-[1.1] tracking-tight">Ready for a private call?</h2>
          <p className="text-[#475569] text-[17px] leading-relaxed max-w-[520px] mx-auto">No signup, no downloads, no group clutter. Just you and one other person, securely connected.</p>
          <button
            onClick={createCall}
            disabled={isCreating}
            className="inline-flex h-[52px] items-center justify-center rounded-full bg-[#0B1020] px-8 text-[16px] font-semibold text-white shadow-premium transition-all hover:bg-black hover:shadow-lg active:scale-[0.98] disabled:opacity-60"
          >
            {isCreating ? 'Creating...' : 'Start a Private Call →'}
          </button>
          <div className="flex justify-center gap-8 pt-4 text-xs text-[#94A3B8]">
            <span>Free & open-source</span>
            <span>•</span>
            <span>Self-hostable</span>
            <span>•</span>
            <span>WebRTC P2P</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/5 bg-[#F8FAFC] py-12">
        <div className="mx-auto max-w-[1200px] px-6 flex flex-col md:flex-row justify-between gap-8">
          <div className="space-y-4">
            <Logo size={32} />
            <p className="text-sm text-[#64748B] max-w-[320px] leading-relaxed">Private calls, just two people. Built with WebRTC, privacy-first design, and premium UX. No group clutter.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-10 text-sm">
            <div className="space-y-3">
              <div className="font-semibold">Product</div>
              <div className="space-y-2 text-[#64748B]">
                <div><a href="#features" className="hover:text-[#0B1020]">Features</a></div>
                <div><a href="#how-it-works" className="hover:text-[#0B1020]">How it works</a></div>
                <div><a href="#" className="hover:text-[#0B1020]">Privacy</a></div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="font-semibold">Resources</div>
              <div className="space-y-2 text-[#64748B]">
                <div><a href="/api/health" className="hover:text-[#0B1020]">Health</a></div>
                <div><a href="#" className="hover:text-[#0B1020]">Docs</a></div>
                <div><a href="#" className="hover:text-[#0B1020]">GitHub</a></div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="font-semibold">Legal</div>
              <div className="space-y-2 text-[#64748B]">
                <div>© {new Date().getFullYear()} InkoCaller</div>
                <div>Privacy-first</div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
