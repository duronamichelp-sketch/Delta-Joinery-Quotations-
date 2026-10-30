import './globals.css';
import CloudSync from './CloudSync';
import MobileNavigation from './MobileNavigation';
import RouteReset from './RouteReset';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Delta Joinery Quotations',
  description: 'Delta Joinery quotation management',
  openGraph: {
    images: [
      {
        url: 'https://bolt.new/static/og_default.png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [
      {
        url: 'https://bolt.new/static/og_default.png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}><CloudSync><RouteReset/><MobileNavigation/>{children}</CloudSync></body>
    </html>
  );
}
