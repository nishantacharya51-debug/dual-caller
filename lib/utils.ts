import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateSecureId(): string {
  if (typeof window !== 'undefined' && window.crypto) {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('').substring(0, 12) + 
           '-' + 
           Array.from(array.slice(0, 4), b => b.toString(36)).join('').substring(0, 4);
  }
  // Server fallback
  const crypto = require('crypto');
  return crypto.randomBytes(12).toString('hex').substring(0, 12) + '-' + crypto.randomBytes(2).toString('hex');
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function getConnectionQuality(rtt: number, packetLoss: number): 'Excellent' | 'Good' | 'Fair' | 'Poor' {
  if (rtt < 100 && packetLoss < 1) return 'Excellent';
  if (rtt < 200 && packetLoss < 3) return 'Good';
  if (rtt < 400 && packetLoss < 5) return 'Fair';
  return 'Poor';
}
