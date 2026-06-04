import type { Metadata } from "next";
import { Bungee, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GlobalErrorCapture } from "@/components/providers/global-error-capture";
import { brand } from "@/lib/brand";

const uiFont = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-ui",
  fallback: ["Segoe UI", "Arial", "sans-serif"],
});

const brandFont = Bungee({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-brand",
  weight: "400",
});

export const metadata: Metadata = {
  title: brand.seo.title,
  description: brand.seo.description,
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/buffalo-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/buffalo-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: brand.shortName,
  },
  other: {
    preload: brand.logo.src,
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: brand.colors.background },
    { media: "(prefers-color-scheme: dark)", color: brand.colors.background },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${uiFont.variable} ${brandFont.variable} font-sans`}>
        <a href="#main-content" className="skip-link">
          Saltar al contenido principal
        </a>
        <ErrorBoundary>
          <GlobalErrorCapture>
            <Providers>{children}</Providers>
          </GlobalErrorCapture>
        </ErrorBoundary>
      </body>
    </html>
  );
}
