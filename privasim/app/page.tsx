import Link from "next/link";
import { Shield, Zap, Globe, Lock, Eye, Coins, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import CountrySearch from "@/components/CountrySearch";

const FEATURES = [
  {
    icon: Shield,
    title: "Zero Identity Required",
    desc: "No email, no phone, no KYC. Connect your crypto wallet and buy.",
    color: "text-[#ff6600]",
  },
  {
    icon: Lock,
    title: "End-to-End Encrypted",
    desc: "Your eSIM data is encrypted at rest. Only you can decrypt your activation codes.",
    color: "text-green-400",
  },
  {
    icon: Eye,
    title: "No Tracking, No Cookies",
    desc: "Zero analytics. Zero pixels. Zero third-party scripts. Your browsing is private.",
    color: "text-blue-400",
  },
  {
    icon: Coins,
    title: "Crypto Only",
    desc: "Accept Monero (most private) and Ethereum/USDT. No credit cards, no PayPal.",
    color: "text-purple-400",
  },
  {
    icon: Globe,
    title: "190+ Countries",
    desc: "Global coverage via PikaSim network. Data and phone plans available.",
    color: "text-teal-400",
  },
  {
    icon: Zap,
    title: "Instant Delivery",
    desc: "eSIM provisioned automatically after payment confirms. Scan QR and go.",
    color: "text-yellow-400",
  },
];

const POPULAR_DESTINATIONS = [
  { code: "JP", name: "Japan", price: "$4.99", flag: "🇯🇵" },
  { code: "US", name: "USA", price: "$6.99", flag: "🇺🇸" },
  { code: "GB", name: "UK", price: "$5.99", flag: "🇬🇧" },
  { code: "DE", name: "Germany", price: "$5.49", flag: "🇩🇪" },
  { code: "TH", name: "Thailand", price: "$3.99", flag: "🇹🇭" },
  { code: "SG", name: "Singapore", price: "$4.49", flag: "🇸🇬" },
];

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden py-24 md:py-36">
        <div className="absolute inset-0 bg-gradient-to-b from-[#ff6600]/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#ff6600]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="container relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-[#ff6600]/10 border border-[#ff6600]/20 rounded-full px-4 py-1.5 text-sm text-[#ff6600] mb-8">
              <Shield className="h-3.5 w-3.5" />
              Privacy-First eSIM Marketplace
            </div>

            <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white mb-6">
              eSIMs for{" "}
              <span className="gradient-text">190+ Countries</span>
              <br />
              Pay with{" "}
              <span className="gradient-text">Crypto</span>
            </h1>

            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
              No email. No tracking. No KYC. Connect your Monero or Ethereum wallet,
              browse plans, pay crypto, get your eSIM instantly.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Button size="xl" className="bg-[#ff6600] hover:bg-[#e55c00] text-white font-bold w-full sm:w-auto" asChild>
                <Link href="/shop">
                  <Globe className="h-5 w-5" />
                  Browse eSIMs
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" className="border-white/20 text-white hover:bg-white/10 w-full sm:w-auto" asChild>
                <Link href="/orders">Check Orders</Link>
              </Button>
            </div>

            <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
              {["No email required", "Instant delivery", "XMR + ETH accepted", "30-day auto-delete"].map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-green-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Search */}
      <section className="py-12 border-y border-white/5 bg-white/2">
        <div className="container">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Find Your eSIM</h2>
            <p className="text-gray-400">Search by country or destination</p>
          </div>
          <CountrySearch />
        </div>
      </section>

      {/* Popular destinations */}
      <section className="py-20 container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">Popular Destinations</h2>
          <p className="text-gray-400">Instant eSIM delivery. Works within minutes of payment.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {POPULAR_DESTINATIONS.map((dest) => (
            <Link
              key={dest.code}
              href={`/shop/${dest.code}`}
              className="group flex flex-col items-center p-4 bg-white/5 border border-white/10 rounded-xl hover:border-[#ff6600]/40 hover:bg-white/8 transition-all duration-200"
            >
              <span className="text-4xl mb-2">{dest.flag}</span>
              <div className="text-sm font-semibold text-white">{dest.name}</div>
              <div className="text-xs text-[#ff6600] mt-1">from {dest.price}</div>
            </Link>
          ))}
        </div>
        <div className="text-center mt-8">
          <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" asChild>
            <Link href="/shop">
              View all 190+ countries
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 border-y border-white/5 bg-white/2">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">How It Works</h2>
            <p className="text-gray-400">Three steps to anonymous global connectivity</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {[
              {
                step: "01",
                title: "Connect Wallet",
                desc: "No email needed. Connect Monero or Ethereum wallet. JWT issued on-chain signature.",
              },
              {
                step: "02",
                title: "Pay Crypto",
                desc: "Send Monero or ETH to our address. Confirmed in 2–10 minutes. You keep full control.",
              },
              {
                step: "03",
                title: "Get eSIM",
                desc: "Encrypted ICCID delivered instantly. Scan QR code to install on your device.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#ff6600]/10 border border-[#ff6600]/30 text-[#ff6600] font-bold text-lg mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">Built for Privacy</h2>
          <p className="text-gray-400">
            Every decision made to protect your identity and data
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="p-6 bg-white/3 border border-white/8 rounded-xl hover:border-white/15 transition-colors"
            >
              <f.icon className={`h-6 w-6 ${f.color} mb-3`} />
              <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 container">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#ff6600]/20 to-[#ff9500]/5 border border-[#ff6600]/30 p-12 text-center glow-orange">
          <h2 className="text-4xl font-black text-white mb-4">
            Start with <span className="gradient-text">Zero Identity</span>
          </h2>
          <p className="text-gray-300 text-lg mb-8 max-w-lg mx-auto">
            No account. No email. No KYC. Just a crypto wallet and you&apos;re connected to the world.
          </p>
          <Button size="xl" className="bg-[#ff6600] hover:bg-[#e55c00] text-white font-bold" asChild>
            <Link href="/shop">
              Browse eSIMs Now
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
