"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Globe, FileText, ShoppingBag, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/shop", label: "Browse eSIMs", icon: Globe },
  { href: "/orders", label: "My Orders", icon: ShoppingBag },
  { href: "/blog", label: "Blog", icon: FileText },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#0a0a1a]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0a0a1a]/80">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="PRIVASIM home">
            <Shield className="h-6 w-6 text-[#ff6600]" />
            <span className="text-xl font-bold tracking-tight text-white">
              PRIVA<span className="text-[#ff6600]">SIM</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 text-sm transition-colors ${
                  pathname === href || pathname.startsWith(href + "/")
                    ? "text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" asChild>
              <Link href="/orders">Orders</Link>
            </Button>
            <Button size="sm" className="bg-[#ff6600] hover:bg-[#e55c00] text-white font-semibold" asChild>
              <Link href="/shop">
                <Globe className="h-4 w-4" />
                Get eSIM
              </Link>
            </Button>
          </div>

          {/* Mobile: compact CTA + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <Button size="sm" className="bg-[#ff6600] hover:bg-[#e55c00] text-white font-semibold text-xs px-3 h-8" asChild>
              <Link href="/shop">Get eSIM</Link>
            </Button>
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <nav
            className="fixed top-16 left-0 right-0 z-40 bg-[#0d0d20] border-b border-white/10 md:hidden animate-fade-in"
            aria-label="Mobile navigation"
          >
            <div className="container py-4 flex flex-col gap-1">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                    pathname === href || pathname.startsWith(href + "/")
                      ? "bg-[#ff6600]/10 text-white border border-[#ff6600]/20"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {label}
                </Link>
              ))}
              <div className="mt-2 pt-3 border-t border-white/10">
                <Button size="lg" className="w-full bg-[#ff6600] hover:bg-[#e55c00] text-white font-bold" asChild>
                  <Link href="/shop">
                    <Globe className="h-5 w-5" />
                    Browse All eSIM Plans
                  </Link>
                </Button>
              </div>
            </div>
          </nav>
        </>
      )}
    </>
  );
}
