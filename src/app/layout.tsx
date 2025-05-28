import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { auth } from "@/lib/next-auth";
import AutoReloadErrorBoundary from "@/components/AutoReloadErrorBoundary";
import { Toaster } from "sonner";
import "@/utils/errorMonitor"; // Auto-setup error monitoring

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
  themeColor: '#ffffff',
  viewport: 'width=device-width, initial-scale=1',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth()

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AutoReloadErrorBoundary>
          <AuthSessionProvider session={session}>
            {children}
            <Toaster position="top-right" />
          </AuthSessionProvider>
        </AutoReloadErrorBoundary>
      </body>
    </html>
  );
}
