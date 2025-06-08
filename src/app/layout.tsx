import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { auth } from "@/lib/next-auth";
import AutoReloadErrorBoundary from "@/components/AutoReloadErrorBoundary";
import { Toaster } from "sonner";
import { CookieConsent } from "@/components/legal/CookieConsent";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import "@/utils/errorMonitor"; // Auto-setup error monitoring
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { SessionGate } from '@/components/auth/SessionGate';
import { NextAuthProvider } from '@/components/providers/NextAuthProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fine Photo Gen - Create Personalized Images",
  description: "Generate stunning personalized photos using AI. Train custom models with your images and create unique content.",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth()
  const gaTrackingId = process.env.NEXT_PUBLIC_GA_TRACKING_ID

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AutoReloadErrorBoundary>
          <NextAuthProvider session={session}>
            <SessionGate />
            <div className="flex flex-col min-h-screen">
              <main className="flex-grow">
                {children}
              </main>
            </div>
            <Toaster position="top-right" />
            <CookieConsent />
            {gaTrackingId && <GoogleAnalytics trackingId={gaTrackingId} />}
            <Analytics />
            <SpeedInsights />
          </NextAuthProvider>
        </AutoReloadErrorBoundary>
      </body>
    </html>
  );
}
