import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'HouseLog', template: '%s | HouseLog' },
  description: 'Gestão inteligente de ativos imobiliários',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
