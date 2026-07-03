import { Metadata } from "next";
import Link from "next/link";
import {
  Smartphone,
  QrCode,
  Wifi,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Plane,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://privasim-two.vercel.app";

export const metadata: Metadata = {
  title: "eSIM Installation Guide — iPhone & Android Setup in 2 Minutes",
  description:
    "Step-by-step guide to install and activate your PRIVASIM eSIM on iPhone or Android: scan the QR code, enable data roaming, get online. Includes troubleshooting.",
  alternates: { canonical: `${APP_URL}/guide` },
  openGraph: {
    title: "eSIM Installation Guide — Setup in 2 Minutes",
    description: "Install your anonymous eSIM on iPhone or Android, step by step.",
    url: `${APP_URL}/guide`,
    siteName: "PRIVASIM",
  },
};

const IPHONE_STEPS = [
  { icon: Settings, title: "Open Settings → Cellular", text: "Tap “Add eSIM” (iOS 16+) or “Add Cellular Plan”." },
  { icon: QrCode, title: "Scan your QR code", text: "Show the QR from your order page on another screen and scan it. Or choose “Enter Details Manually” and paste the SM-DP+ address and activation code." },
  { icon: Smartphone, title: "Label the line", text: "Name it “Travel”. Keep your primary line active for calls and iMessage." },
  { icon: Wifi, title: "Enable the eSIM on arrival", text: "Set Cellular Data to the new eSIM and turn ON Data Roaming for that line — this switch is required." },
];

const ANDROID_STEPS = [
  { icon: Settings, title: "Open Settings → Network & Internet → SIMs", text: "Samsung: Settings → Connections → SIM Manager. Tap “Add eSIM”." },
  { icon: QrCode, title: "Scan your QR code", text: "Point the camera at the QR from your order page (shown on another screen)." },
  { icon: Smartphone, title: "Enable the new eSIM", text: "Toggle it on and select it for mobile data." },
  { icon: Wifi, title: "Turn on data roaming", text: "For the eSIM line only — travel eSIMs are roaming profiles and need this ON." },
];

export default function GuidePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to install a PRIVASIM eSIM",
    description: "Install and activate your anonymous eSIM on iPhone or Android in about 2 minutes.",
    step: IPHONE_STEPS.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title,
      text: s.text,
    })),
  };

  return (
    <div className="container py-12 max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 text-sm text-gray-400 mb-4">
          <QrCode className="h-4 w-4 text-[#ff6600]" />
          2-minute setup
        </div>
        <h1 className="text-4xl font-black text-white mb-3">
          eSIM <span className="gradient-text">Installation Guide</span>
        </h1>
        <p className="text-gray-400 max-w-lg mx-auto">
          You need Wi-Fi to install. Do this at home or on hotel Wi-Fi — before you fly is best.
        </p>
      </div>

      <div className="p-4 mb-10 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
        <p className="text-sm text-yellow-200">
          <strong>Activation codes are single-use.</strong> Install once and never delete the
          profile — deleting consumes the code permanently. Check compatibility first: dial{" "}
          <code className="bg-white/10 px-1.5 py-0.5 rounded">*#06#</code> — if you see an EID,
          your phone supports eSIM.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <span className="text-3xl"></span> iPhone (iOS 16+)
        </h2>
        <ol className="space-y-4">
          {IPHONE_STEPS.map((step, i) => (
            <li key={i} className="flex gap-4 p-4 bg-white/4 border border-white/8 rounded-xl">
              <div className="h-10 w-10 rounded-lg bg-[#ff6600]/20 border border-[#ff6600]/40 flex items-center justify-center shrink-0 text-[#ff6600] font-bold">
                {i + 1}
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
                  <step.icon className="h-4 w-4 text-[#ff6600]" />
                  {step.title}
                </h3>
                <p className="text-sm text-gray-400">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <span className="text-3xl">🤖</span> Android (Pixel, Samsung, more)
        </h2>
        <ol className="space-y-4">
          {ANDROID_STEPS.map((step, i) => (
            <li key={i} className="flex gap-4 p-4 bg-white/4 border border-white/8 rounded-xl">
              <div className="h-10 w-10 rounded-lg bg-blue-500/20 border border-blue-400/40 flex items-center justify-center shrink-0 text-blue-400 font-bold">
                {i + 1}
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
                  <step.icon className="h-4 w-4 text-blue-400" />
                  {step.title}
                </h3>
                <p className="text-sm text-gray-400">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Plane className="h-6 w-6 text-[#ff6600]" />
          When you land
        </h2>
        <div className="space-y-3">
          {[
            "Turn off airplane mode and wait ~30 seconds for network registration.",
            "Confirm mobile data is set to your travel eSIM (not your home SIM).",
            "Confirm data roaming is ON for the eSIM line.",
            "No signal? Restart the phone, then try selecting a network manually.",
          ].map((tip, i) => (
            <div key={i} className="flex gap-3 items-start">
              <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-300">{tip}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="p-6 bg-white/4 border border-[#ff6600]/20 rounded-xl text-center">
        <HelpCircle className="h-8 w-8 text-[#ff6600] mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white mb-2">Something not working?</h2>
        <p className="text-gray-400 text-sm mb-4">
          Check the full troubleshooting guide, or ask ARIA in the chat bubble — it knows
          every common eSIM problem.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Button className="bg-[#ff6600] hover:bg-[#e55c00] text-white" asChild>
            <Link href="/blog/esim-troubleshooting-guide">Troubleshooting guide</Link>
          </Button>
          <Button variant="outline" className="border-white/20 text-white" asChild>
            <Link href="/orders">My orders</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
