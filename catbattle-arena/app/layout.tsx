import type { Metadata } from "next";
import localFont from "next/font/local";
import { Cinzel, Rajdhani } from "next/font/google";
import "./globals.css";
import GlobalToastHost from "./components/GlobalToastHost";
import BuildStamp from "./components/BuildStamp";
import { canonicalSiteOrigin } from "./lib/site-origin";
import HeaderSystem from "./components/HeaderSystem";

const inter = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-space",
  display: "swap",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cinzel",
  display: "swap",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rajdhani",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(canonicalSiteOrigin()),
  title: "CatClash Arena | Rate the Ultimate Cat",
  description: "Vote on the cutest, funniest, and most chaotic cats. The ultimate feline showdown.",
  icons: {
    icon: "/favicon.ico",
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
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${cinzel.variable} ${rajdhani.variable} antialiased min-h-screen relative bg-black`}
      >
        <div className="noise-overlay" />
        <HeaderSystem>
          <div className="safe-bottom-pad sm:pb-0">{children}</div>
        </HeaderSystem>
        <GlobalToastHost />
        <BuildStamp />
        <div className="vuxsolia-watermark" aria-hidden="true">Property of Vuxsolia.</div>
      </body>
    </html>
  );
}
