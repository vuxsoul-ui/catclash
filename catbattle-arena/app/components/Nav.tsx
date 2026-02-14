import Link from "next/link";
import { Swords } from "lucide-react";

export default function Nav() {
  const links = [
    { href: "/", label: "Home" },
    { href: "/tournament", label: "Tournament" },
    { href: "/submit", label: "Submit" },
    { href: "/gallery", label: "Gallery" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center">
              <Swords className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg hidden sm:block">CatBattle Arena</span>
          </Link>

          {/* Nav Links */}
          <nav className="flex items-center gap-1 sm:gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-2 sm:px-3 py-2 text-sm text-white/70 hover:text-white transition-colors rounded-lg hover:bg-white/5"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
