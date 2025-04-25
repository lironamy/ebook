import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Ebook Reader',
  description: 'An AI-powered ebook reader with text-to-speech capabilities',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
