import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, Cinzel, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import GlobalToastHost from "./components/GlobalToastHost";
import BuildStamp from "./components/BuildStamp";
import { canonicalSiteOrigin } from "./lib/site-origin";
import HeaderSystem from "./components/HeaderSystem";

export const viewport = {
  themeColor: "#06050e",
};

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cinzel",
  display: "swap",
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-ui-base",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-condensed-base",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-base",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(canonicalSiteOrigin()),
  title: "CatClash Arena | Rate the Ultimate Cat",
  description: "Vote on the cutest, funniest, and most chaotic cats. The ultimate feline showdown.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "CatClash",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "CatClash Arena | Rate the Ultimate Cat",
    description: "Vote on the cutest, funniest, and most chaotic cats. The ultimate feline showdown.",
    siteName: "CatClash Arena",
    url: "/",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#06050e" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="CatClash" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link
          rel="apple-touch-startup-image"
          href="/splash/splash-1179x2556.png"
          media="(device-width:393px) and (device-height:852px) and (-webkit-device-pixel-ratio:3)"
        />
      </head>
      <body
        className={`${cinzel.variable} ${barlow.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable} antialiased min-h-screen relative bg-black`}
      >
        <div className="noise-overlay" />
        <HeaderSystem>
          <div className="safe-bottom-pad sm:pb-0">{children}</div>
        </HeaderSystem>
        <GlobalToastHost />
        <BuildStamp />
      </body>
    </html>
  );
}
