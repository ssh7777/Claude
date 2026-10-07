import { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Globe, Phone, MapPin } from "lucide-react";
import CountrySearch from "@/components/CountrySearch";
import EsimCard from "@/components/EsimCard";
import { searchEsimPackages } from "@/lib/pikasim";
import { getRetailMargin } from "@/lib/settings";
import Flag from "@/components/Flag";
import { COUNTRY_NAMES } from "@/lib/countries";

export const metadata: Metadata = {
  title: "Browse eSIMs — 190+ Countries, Anonymous, No KYC",
  description: "Browse eSIM data plans for 190+ countries including China, Japan, USA, UK. Pay with Monero or Ethereum. No account, no KYC, instant delivery.",
  alternates: { canonical: "https://privasim.app/shop" },
  openGraph: {
    title: "Browse eSIMs — 190+ Countries",
    description: "Anonymous eSIMs for 190+ countries. Pay with crypto, no KYC.",
    url: "https://privasim.app/shop",
  },
};

export const revalidate = 3600;

async function FeaturedPackages() {
  try {
    // Show a mix of popular country packages as featured
    const [jpPackages, usPackages, thPackages, cnPackages, margin] = await Promise.all([
      searchEsimPackages("JP", "data"),
      searchEsimPackages("US", "data"),
      searchEsimPackages("TH", "data"),
      searchEsimPackages("CN", "data"),
      getRetailMargin(),
    ]);

    const featured = [
      ...(jpPackages.slice(0, 2)),
      ...(usPackages.slice(0, 2)),
      ...(thPackages.slice(0, 1)),
      ...(cnPackages.slice(0, 1)),
    ].slice(0, 6);

    if (!featured.length) return null;

    return (
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Popular Plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featured.map((pkg) => (
            <EsimCard key={pkg.code} pkg={pkg} margin={margin} />
          ))}
        </div>
      </div>
    );
  } catch {
    return null;
  }
}

const REGIONS: { name: string; codes: string[] }[] = [
  { name: "Asia Pacific", codes: ["JP", "KR", "TH", "SG", "AU", "ID", "VN", "MY", "PH", "HK", "TW", "CN", "IN", "KH", "LA", "MM", "MN", "NP", "LK", "BD", "PK"] },
  { name: "Europe", codes: ["GB", "DE", "FR", "IT", "ES", "NL", "CH", "AT", "SE", "NO", "DK", "FI", "BE", "IE", "PT", "GR", "PL", "CZ", "HU", "RO", "BG", "HR", "SI", "SK", "RS", "ME", "MK", "AL", "BA", "IS", "CY", "MT", "LU", "EE", "LV", "LT", "MD", "UA", "GE", "AM", "AZ"] },
  { name: "Americas", codes: ["US", "CA", "MX", "BR", "AR", "CO", "CL", "PE", "EC", "CR", "PA", "DO", "GT", "UY"] },
  { name: "Middle East & Africa", codes: ["AE", "TR", "SA", "IL", "ZA", "EG", "MA", "KE", "NG", "TN", "DZ", "BH", "JO", "QA", "OM", "KW", "TZ"] },
  { name: "Global & Special", codes: ["AD", "MC", "MO"] },
];

export default async function ShopPage() {
  const allCountryCodes = Object.keys(COUNTRY_NAMES).sort();

  return (
    <div className="container py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 text-sm text-gray-400 mb-4">
          <Globe className="h-4 w-4 text-[#ff6600]" />
          190+ countries available · 99 featured in sitemap including CN
        </div>
        <h1 className="text-4xl font-black text-white mb-3">
          Browse <span className="gradient-text">eSIM Plans</span>
        </h1>
        <p className="text-gray-400 max-w-lg mx-auto">
          Search by country to find data and phone plans. Prices include all fees. No account, no KYC.
        </p>
      </div>

      <div className="mb-8">
        <CountrySearch />
      </div>

      {/* Global + phone plan entry points */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12 max-w-3xl mx-auto">
        <Link
          href="/shop/global"
          className="flex items-center gap-4 p-5 rounded-xl bg-gradient-to-br from-[#ff6600]/20 to-[#ff9944]/5 border border-[#ff6600]/30 hover:border-[#ff6600]/60 transition-all group"
        >
          <div className="h-12 w-12 rounded-lg bg-[#ff6600] flex items-center justify-center shrink-0">
            <Globe className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="font-bold text-white group-hover:text-[#ff9944] transition-colors">
              Global eSIMs
            </div>
            <div className="text-sm text-gray-400">One eSIM for 120+ countries</div>
          </div>
        </Link>
        <Link
          href="/shop/global#phone"
          className="flex items-center gap-4 p-5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-400/5 border border-blue-400/30 hover:border-blue-400/60 transition-all group"
        >
          <div className="h-12 w-12 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
            <Phone className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="font-bold text-white group-hover:text-blue-300 transition-colors">
              Data + Calls + SMS
            </div>
            <div className="text-sm text-gray-400">Real phone number included</div>
          </div>
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        }
      >
        <FeaturedPackages />
      </Suspense>

      {/* Country grid by region — now includes CN and all 99 */}
      <div className="mt-16 space-y-12">
        {REGIONS.map((region) => (
          <div key={region.name}>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-0.5 bg-[#ff6600] rounded" />
              {region.name} · {region.codes.length} countries
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {region.codes.map((code) => (
                <Link
                  key={code}
                  href={`/shop/${code}`}
                  className="flex flex-col items-center p-3 bg-white/4 border border-white/8 rounded-lg hover:border-[#ff6600]/40 hover:bg-white/8 transition-all text-center group"
                >
                  <Flag code={code} className="text-3xl mb-1.5" />
                  <span className="text-xs text-gray-300 group-hover:text-white transition-colors">
                    {COUNTRY_NAMES[code] || code}
                  </span>
                  <span className="text-[10px] text-gray-500">{code}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div className="p-6 bg-white/3 border border-white/8 rounded-xl">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white mb-3">
            <MapPin className="h-4 w-4 text-[#ff6600]" />
            All 99 Countries in Sitemap
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Sitemap includes 99 country shop pages including China (CN) for full GEO coverage. Full list:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {allCountryCodes.map((code) => (
              <Link
                key={code}
                href={`/shop/${code}`}
                className="text-[11px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-[#ff6600]/30"
              >
                {code}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
