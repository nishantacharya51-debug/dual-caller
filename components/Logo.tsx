import React from 'react';

export function Logo({ size = 32, showText = true, variant = 'default' }: { 
  size?: number; 
  showText?: boolean;
  variant?: 'default' | 'light' | 'dark';
}) {
  const textColor = variant === 'light' ? 'text-white' : variant === 'dark' ? 'text-[#0B1020]' : 'text-[#0B1020]';
  
  return (
    <div className="flex items-center gap-2.5">
      <div 
        className="relative flex items-center justify-center rounded-xl shadow-premium"
        style={{ 
          width: size, 
          height: size,
          background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
        }}
      >
        {/* Abstract ink drop + connection */}
        <svg 
          width={size * 0.6} 
          height={size * 0.6} 
          viewBox="0 0 24 24" 
          fill="none"
          className="text-white"
        >
          <path 
            d="M12 2C12 2 8 8 8 12C8 16 10 20 12 22C14 20 16 16 16 12C16 8 12 2 12 2Z" 
            fill="white" 
            fillOpacity="0.95"
          />
          <circle cx="12" cy="12" r="2.5" fill="#0B1020" fillOpacity="0.2" />
          <path 
            d="M7 8C5 10 4 14 6 17M17 8C19 10 20 14 18 17" 
            stroke="white" 
            strokeWidth="1.5" 
            strokeLinecap="round"
            opacity="0.6"
          />
        </svg>
        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#22C55E] rounded-full border-2 border-white animate-pulse-subtle" />
      </div>
      {showText && (
        <span className={`font-display font-bold tracking-tight ${textColor}`} style={{ fontSize: size * 0.55 }}>
          Inko<span className="font-extrabold bg-gradient-to-r from-[#2563EB] to-[#7C3AED] bg-clip-text text-transparent">Caller</span>
        </span>
      )}
    </div>
  );
}

export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <div 
      className="relative flex items-center justify-center rounded-[20%] shadow-premium"
      style={{ 
        width: size, 
        height: size,
        background: 'linear-gradient(135deg, #0B1020 0%, #172554 100%)',
      }}
    >
      <div 
        className="absolute inset-[12%] rounded-[30%] opacity-90"
        style={{
          background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
        }}
      />
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" className="relative z-10 text-white">
        <path d="M12 3C12 3 8.5 8 8.5 12C8.5 15.5 10 19 12 21C14 19 15.5 15.5 15.5 12C15.5 8 12 3 12 3Z" fill="white" />
        <circle cx="12" cy="12" r="2" fill="#0B1020" fillOpacity="0.15" />
      </svg>
    </div>
  );
}
