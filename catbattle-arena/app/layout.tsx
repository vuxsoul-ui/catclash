import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Nav from "./components/Nav";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CatBattle Arena | Rate the Ultimate Cat",
  description: "Vote on the cutest, funniest, and most chaotic cats. The ultimate feline showdown.",
  icons: {
    icon: "/favicon.ico",
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
        className={`${inter.variable} ${spaceGrotesk.variable} antialiased gradient-mesh min-h-screen`}
      >
        <div className="noise-overlay" />
        <Nav />
        <div className="pt-16">{children}</div>
      </body>
    </html>
  );
}
