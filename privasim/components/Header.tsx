"use client";

import Link from "next/link";
import { Shield, Globe, FileText, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#0a0a1a]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0a0a1a]/80">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-[#ff6600]" />
          <span className="text-xl font-bold tracking-tight text-white">
            PRIVA<span className="text-[#ff6600]">SIM</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/shop"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <Globe className="h-4 w-4" />
            Browse eSIMs
          </Link>
          <Link
            href="/orders"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ShoppingBag className="h-4 w-4" />
            My Orders
          </Link>
          <Link
            href="/blog"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <FileText className="h-4 w-4" />
            Blog
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" asChild>
            <Link href="/orders">Orders</Link>
          </Button>
          <Button
            size="sm"
            className="bg-[#ff6600] hover:bg-[#e55c00] text-white font-semibold"
            asChild
          >
            <Link href="/shop">
              <Globe className="h-4 w-4" />
              Get eSIM
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
