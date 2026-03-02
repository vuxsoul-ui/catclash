import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Nav from "./components/Nav";
import GlobalToastHost from "./components/GlobalToastHost";
import BuildStamp from "./components/BuildStamp";
import { canonicalSiteOrigin } from "./lib/site-origin";

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
        className={`${inter.variable} ${spaceGrotesk.variable} antialiased min-h-screen relative bg-black`}
      >
        <div className="noise-overlay" />
        <Nav />
        <div className="pt-[calc(var(--header-h)+env(safe-area-inset-top))] safe-bottom-pad sm:pb-0">{children}</div>
        <GlobalToastHost />
        <BuildStamp />
        <div className="vuxsolia-watermark" aria-hidden="true">Property of Vuxsolia.</div>
      </body>
    </html>
  );
}
