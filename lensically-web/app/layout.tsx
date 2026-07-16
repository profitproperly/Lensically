import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "../lib/AuthProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lensically",
  description: "Lensically platform",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/lensically-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/lensically-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: [
      { url: "/lensically-icon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/lensically-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Lensically",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
