import { Metadata } from "next";
import { Suspense } from "react";
import { Globe } from "lucide-react";
import CountrySearch from "@/components/CountrySearch";
import EsimCard from "@/components/EsimCard";
import { searchEsimPackages } from "@/lib/pikasim";
import Flag from "@/components/Flag";

export const metadata: Metadata = {
  title: "Browse eSIMs",
  description: "Browse eSIM data plans for 190+ countries. Pay with Monero or Ethereum.",
};

export const revalidate = 3600;

async function FeaturedPackages() {
  try {
    // Show a mix of popular country packages as featured
    const [jpPackages, usPackages, thPackages] = await Promise.all([
      searchEsimPackages("JP", "data"),
      searchEsimPackages("US", "data"),
      searchEsimPackages("TH", "data"),
    ]);

    const featured = [
      ...(jpPackages.slice(0, 2)),
      ...(usPackages.slice(0, 2)),
      ...(thPackages.slice(0, 2)),
    ].slice(0, 6);

    if (!featured.length) return null;

    return (
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Popular Plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featured.map((pkg) => (
            <EsimCard key={pkg.code} pkg={pkg} />
          ))}
        </div>
      </div>
    );
  } catch {
    return null;
  }
}

const REGIONS = [
  {
    name: "Asia Pacific",
    countries: [
      { code: "JP", name: "Japan", flag: "🇯🇵" },
      { code: "KR", name: "South Korea", flag: "🇰🇷" },
      { code: "TH", name: "Thailand", flag: "🇹🇭" },
      { code: "SG", name: "Singapore", flag: "🇸🇬" },
      { code: "AU", name: "Australia", flag: "🇦🇺" },
      { code: "ID", name: "Indonesia", flag: "🇮🇩" },
      { code: "VN", name: "Vietnam", flag: "🇻🇳" },
      { code: "MY", name: "Malaysia", flag: "🇲🇾" },
      { code: "PH", name: "Philippines", flag: "🇵🇭" },
      { code: "HK", name: "Hong Kong", flag: "🇭🇰" },
      { code: "TW", name: "Taiwan", flag: "🇹🇼" },
      { code: "CN", name: "China", flag: "🇨🇳" },
    ],
  },
  {
    name: "Europe",
    countries: [
      { code: "GB", name: "UK", flag: "🇬🇧" },
      { code: "DE", name: "Germany", flag: "🇩🇪" },
      { code: "FR", name: "France", flag: "🇫🇷" },
      { code: "IT", name: "Italy", flag: "🇮🇹" },
      { code: "ES", name: "Spain", flag: "🇪🇸" },
      { code: "NL", name: "Netherlands", flag: "🇳🇱" },
      { code: "CH", name: "Switzerland", flag: "🇨🇭" },
      { code: "AT", name: "Austria", flag: "🇦🇹" },
      { code: "SE", name: "Sweden", flag: "🇸🇪" },
      { code: "NO", name: "Norway", flag: "🇳🇴" },
      { code: "PT", name: "Portugal", flag: "🇵🇹" },
      { code: "GR", name: "Greece", flag: "🇬🇷" },
    ],
  },
  {
    name: "Americas",
    countries: [
      { code: "US", name: "USA", flag: "🇺🇸" },
      { code: "CA", name: "Canada", flag: "🇨🇦" },
      { code: "MX", name: "Mexico", flag: "🇲🇽" },
      { code: "BR", name: "Brazil", flag: "🇧🇷" },
      { code: "AR", name: "Argentina", flag: "🇦🇷" },
      { code: "CO", name: "Colombia", flag: "🇨🇴" },
    ],
  },
  {
    name: "Middle East & Africa",
    countries: [
      { code: "AE", name: "UAE", flag: "🇦🇪" },
      { code: "TR", name: "Turkey", flag: "🇹🇷" },
      { code: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
      { code: "EG", name: "Egypt", flag: "🇪🇬" },
      { code: "ZA", name: "South Africa", flag: "🇿🇦" },
      { code: "NG", name: "Nigeria", flag: "🇳🇬" },
    ],
  },
];

export default async function ShopPage() {
  return (
    <div className="container py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 text-sm text-gray-400 mb-4">
          <Globe className="h-4 w-4 text-[#ff6600]" />
          190+ countries available
        </div>
        <h1 className="text-4xl font-black text-white mb-3">
          Browse <span className="gradient-text">eSIM Plans</span>
        </h1>
        <p className="text-gray-400 max-w-lg mx-auto">
          Search by country to find data and phone plans. Prices include all fees.
        </p>
      </div>

      <div className="mb-12">
        <CountrySearch />
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

      {/* Country grid by region */}
      <div className="mt-16 space-y-12">
        {REGIONS.map((region) => (
          <div key={region.name}>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-0.5 bg-[#ff6600] rounded" />
              {region.name}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {region.countries.map((c) => (
                <a
                  key={c.code}
                  href={`/shop/${c.code}`}
                  className="flex flex-col items-center p-3 bg-white/4 border border-white/8 rounded-lg hover:border-[#ff6600]/40 hover:bg-white/8 transition-all text-center group"
                >
                  <Flag code={c.code} className="text-3xl mb-1.5" />
                  <span className="text-xs text-gray-300 group-hover:text-white transition-colors">
                    {c.name}
                  </span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
