import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import './globals.css';
import { StoreProvider } from '@/lib/store';
import { ToastProvider } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Atelier — your AI wardrobe',
  description: 'See yourself in clothes from any shop before you buy, and build outfits with an AI stylist.',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { capable: true, title: 'Atelier', statusBarStyle: 'default' },
};
export const viewport: Viewport = { themeColor: '#ffffff', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <StoreProvider>{children}</StoreProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
