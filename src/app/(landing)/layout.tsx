import type { Metadata } from 'next';
import '@/landing/landing.css';
import { AuthProvider } from '@/landing/context/AuthContext';
import { CartProvider } from '@/landing/context/CartContext';
import LandingChrome from '@/landing/components/LandingChrome';

export const metadata: Metadata = {
  title: 'Gen-Z IITian | We transform You into genz iitians',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="landing-root"
      data-landing-root=""
    >
      <AuthProvider>
        <CartProvider>
          <LandingChrome>{children}</LandingChrome>
        </CartProvider>
      </AuthProvider>
    </div>
  );
}
