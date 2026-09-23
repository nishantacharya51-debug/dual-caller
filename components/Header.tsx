'use client';

import Link from 'next/link';
import { Logo } from './Logo';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-black/[0.06] bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex h-[64px] max-w-[1200px] items-center justify-between px-6">
        <Link href="/" className="flex items-center">
          <Logo size={36} />
        </Link>
        
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-[#475569] hover:text-[#0B1020] transition-colors">Features</a>
          <a href="#how-it-works" className="text-sm font-medium text-[#475569] hover:text-[#0B1020] transition-colors">How it works</a>
          <a href="#privacy" className="text-sm font-medium text-[#475569] hover:text-[#0B1020] transition-colors">Privacy</a>
        </nav>

        <div className="flex items-center gap-3">
          <Link 
            href="/#start"
            className="inline-flex h-9 items-center justify-center rounded-full bg-[#0B1020] px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-black hover:shadow-md active:scale-[0.98]"
          >
            Start a Call
          </Link>
        </div>
      </div>
    </header>
  );
}
