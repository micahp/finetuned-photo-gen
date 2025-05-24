import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { auth } from "@/lib/next-auth";
import AutoReloadErrorBoundary from "@/components/AutoReloadErrorBoundary";
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
  title: "AI Photo Generator - Create Personalized Images",
  description: "Generate stunning personalized photos using AI. Train custom models with your images and create unique content.",
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
          </AuthSessionProvider>
        </AutoReloadErrorBoundary>
      </body>
    </html>
  );
}
