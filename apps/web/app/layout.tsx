import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CloudPilot | AI-Powered Cloud Deployment & Observability',
  description: 'AI-Powered Cloud Deployment & Observability Platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
