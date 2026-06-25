import Link from "next/link";
import { Shield, Lock, Eye, Zap } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0a0a1a] py-12 mt-20">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-[#ff6600]" />
              <span className="text-lg font-bold text-white">
                PRIVA<span className="text-[#ff6600]">SIM</span>
              </span>
            </Link>
            <p className="text-sm text-gray-400">
              Privacy-first eSIM marketplace. No tracking. No emails. Crypto only.
            </p>
            <div className="flex gap-3 mt-4">
              <div className="flex items-center gap-1 text-xs text-green-400">
                <Lock className="h-3 w-3" />
                Zero tracking
              </div>
              <div className="flex items-center gap-1 text-xs text-blue-400">
                <Eye className="h-3 w-3" />
                No cookies
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Products</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/shop?type=data" className="hover:text-white transition-colors">Data eSIMs</Link></li>
              <li><Link href="/shop?type=phone" className="hover:text-white transition-colors">Phone Plans</Link></li>
              <li><Link href="/shop" className="hover:text-white transition-colors">All Countries</Link></li>
              <li><Link href="/orders" className="hover:text-white transition-colors">My Orders</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Privacy</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/privacy#monero" className="hover:text-white transition-colors">Monero Payments</Link></li>
              <li><Link href="/privacy#no-tracking" className="hover:text-white transition-colors">No Tracking</Link></li>
              <li><Link href="/privacy#encryption" className="hover:text-white transition-colors">Data Encryption</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Resources</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              <li><Link href="/blog/how-to-install-esim" className="hover:text-white transition-colors">How to Install eSIM</Link></li>
              <li><Link href="/blog/monero-guide" className="hover:text-white transition-colors">Monero Payment Guide</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} PRIVASIM. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Zap className="h-3 w-3 text-[#ff6600]" />
            Accepts Monero (XMR) and Ethereum (ETH/USDT)
          </div>
          <p className="text-xs text-gray-500">
            190+ countries &bull; Instant delivery &bull; No KYC
          </p>
        </div>
      </div>
    </footer>
  );
}
