import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import './feedback.css';

export const metadata: Metadata = {
  title: 'Algo License Console',
  description: 'Private owner console for MetaTrader EA licenses.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
