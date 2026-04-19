import type { Metadata, Viewport } from 'next';
import { Inter, Geist_Mono } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { SWRProvider } from '@/lib/swr-provider';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { PwaRegister } from '@/components/pwa-register';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'HouseLog', template: '%s | HouseLog' },
  description: 'Gestão inteligente de ativos imobiliários',
  manifest: '/manifest.json?v=2',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'HouseLog',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    title: 'HouseLog',
    description: 'Gestão inteligente de ativos imobiliários',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b1326',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/next.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HouseLog" />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false} disableTransitionOnChange>
          <AuthProvider>
            <SWRProvider>
              {children}
              <Toaster />
              <PwaRegister />
            </SWRProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
