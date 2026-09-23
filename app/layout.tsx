import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'InkoCaller — Private calls. Just two people.',
  description: 'Instant, secure video and voice calls with no group clutter. HD video, crystal-clear voice, screen sharing, live captions, and privacy-first design. No downloads required.',
  keywords: ['video call', 'voice call', 'private calling', 'secure calling', 'webrtc', '1:1 call', 'InkoCaller'],
  authors: [{ name: 'InkoCaller' }],
  creator: 'InkoCaller',
  publisher: 'InkoCaller',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'InkoCaller — Private calls. Just two people.',
    description: 'Instant, secure video and voice calls with no group clutter.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'InkoCaller — Private calls. Just two people.',
    description: 'Instant, secure video and voice calls with no group clutter.',
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'InkoCaller',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B1020',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="h-full antialiased bg-[#F8FAFC] text-[#0B1020] selection:bg-[#2563EB]/20 selection:text-[#0B1020]">
        {children}
      </body>
    </html>
  );
}
