import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Globe, Phone, Wifi, MessageSquare, Clock } from "lucide-react";
import { getGlobalPackages, getPhonePlans } from "@/lib/pikasim";
import { retailPrice } from "@/lib/prices";
import { getRetailMargin } from "@/lib/settings";
import EsimCard from "@/components/EsimCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const revalidate = 300;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://privasim.app";

export const metadata: Metadata = {
  title: "Global eSIM Plans — 120+ Countries, One eSIM | Data + Calls + SMS",
  description:
    "One anonymous eSIM for 120+ countries. Global data plans plus phone-number plans with real number, voice calls and SMS. Pay with Monero or Ethereum, no KYC.",
  keywords: [
    "global esim", "worldwide esim", "international esim", "esim 120 countries",
    "esim with phone number", "esim voice sms", "travel esim global", "anonymous global esim",
  ],
  alternates: { canonical: `${APP_URL}/shop/global` },
  openGraph: {
    title: "Global eSIM Plans — 120+ Countries, One eSIM",
    description: "Global data + phone-number eSIMs. Crypto payment, no KYC, instant delivery.",
    url: `${APP_URL}/shop/global`,
    siteName: "PRIVASIM",
  },
};

export default async function GlobalShopPage() {
  let dataPlans: Awaited<ReturnType<typeof getGlobalPackages>> = [];
  let phonePlans: Awaited<ReturnType<typeof getPhonePlans>> = [];
  let fetchError = false;

  try {
    [dataPlans, phonePlans] = await Promise.all([
      getGlobalPackages().catch(() => []),
      getPhonePlans({ region: "Global" }).catch(() => []),
    ]);
    if (dataPlans.length === 0 && phonePlans.length === 0) fetchError = true;
  } catch {
    fetchError = true;
  }

  dataPlans.sort((a, b) => a.priceUsd - b.priceUsd);
  const margin = await getRetailMargin();

  return (
    <div className="container py-12">
      <div className="mb-8">
        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white mb-4" asChild>
          <Link href="/shop">
            <ArrowLeft className="h-4 w-4 mr-1" />
            All countries
          </Link>
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[#ff6600] to-[#ff9944] flex items-center justify-center">
            <Globe className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white">Global Plans</h1>
            <p className="text-gray-400">
              One eSIM for 120+ countries &bull; {dataPlans.length} data plans &bull; {phonePlans.length} phone plans
            </p>
          </div>
        </div>
      </div>

      {fetchError ? (
        <div className="text-center py-16">
          <Globe className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Unable to load plans</h2>
          <p className="text-gray-400">Please try again in a minute.</p>
        </div>
      ) : (
        <>
          {dataPlans.length > 0 && (
            <section className="mb-12">
              <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                <Wifi className="h-5 w-5 text-[#ff6600]" />
                Global Data eSIMs
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                Works in 120+ countries with a single installation — perfect for multi-country trips.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {dataPlans.map((pkg) => (
                  <EsimCard key={pkg.code} pkg={pkg} margin={margin} />
                ))}
              </div>
            </section>
          )}

          {phonePlans.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                <Phone className="h-5 w-5 text-blue-400" />
                Data + Calls + SMS (Real Phone Number)
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                A real carrier phone number with voice minutes, SMS, and data — not VoIP. Works worldwide.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {phonePlans.map((plan) => (
                  <Card
                    key={plan.packageCode}
                    className="bg-white/5 border-white/10 hover:border-blue-400/50 transition-all duration-200 hover:bg-white/8"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <Badge variant="ethereum">Real number</Badge>
                        <div className="text-lg font-bold text-white">
                          ${retailPrice(plan.priceUsd, margin).toFixed(2)}
                        </div>
                      </div>
                      <div className="space-y-2 text-sm text-gray-300 mb-4">
                        <div className="flex items-center gap-2">
                          <Wifi className="h-4 w-4 text-[#ff6600]" /> {plan.dataAmount} data
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-blue-400" /> {plan.minutes} voice minutes
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-green-400" /> {plan.sms} SMS
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" /> {plan.durationDays} days validity
                        </div>
                      </div>
                      <Button className="w-full bg-[#ff6600] hover:bg-[#e55c00] text-white" asChild>
                        <Link href={`/checkout/${encodeURIComponent(plan.packageCode)}`}>Buy Now</Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
