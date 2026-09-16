import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ui/theme-provider';

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
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased selection:bg-sky-500/30 selection:text-sky-200 min-h-screen">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
