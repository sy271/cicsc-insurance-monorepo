import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MainNav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Toaster } from 'sonner';
import { ChatDrawer } from "@/components/chat-drawer";
import { AuthGuard } from "@/components/auth-guard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PolicySense - Simplify Your Insurance Management",
  description: "All your insurance policies in one place. Analyze coverage, detect gaps, and manage claims with our AI-powered platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen flex flex-col">
          <MainNav />
          <main className="flex-1">
            <AuthGuard>{children}</AuthGuard>
          </main>
          <Footer />
          <Toaster position="bottom-right" />
          <ChatDrawer />
        </div>
      </body>
    </html>
  );
}
