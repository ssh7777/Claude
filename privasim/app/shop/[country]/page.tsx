import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wifi, Phone, Globe } from "lucide-react";
import { searchEsimPackages } from "@/lib/pikasim";
import { countryName } from "@/lib/countries";
import { retailPrice } from "@/lib/prices";
import EsimCard from "@/components/EsimCard";
import { Button } from "@/components/ui/button";
import Flag from "@/components/Flag";

export const revalidate = 300;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://privasim-two.vercel.app";

interface PageProps {
  params: { country: string };
  searchParams: { type?: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const countryCode = params.country.toUpperCase();
  const name = countryName(countryCode);
  return {
    title: `${name} eSIM — Anonymous Data Plans, No KYC`,
    description: `Buy a prepaid ${name} eSIM with Monero or Ethereum. Instant QR delivery, no account, no ID, no KYC. Data plans from $3 for ${name} travel.`,
    keywords: [
      `${name} esim`, `esim for ${name}`, `${name} travel data`,
      `anonymous esim ${name}`, `buy ${name} esim crypto`, `${name} prepaid data`,
    ],
    alternates: { canonical: `${APP_URL}/shop/${countryCode}` },
    openGraph: {
      title: `${name} eSIM — Anonymous Data Plans`,
      description: `Prepaid ${name} eSIM. Pay with Monero or Ethereum, no KYC, instant delivery.`,
      url: `${APP_URL}/shop/${countryCode}`,
      siteName: "PRIVASIM",
    },
  };
}

export default async function CountryShopPage({ params, searchParams }: PageProps) {
  const countryCode = params.country.toUpperCase();
  if (!countryCode || countryCode.length !== 2) notFound();

  const typeFilter = (searchParams.type ?? "all") as "data" | "phone" | "all";

  let packages: Awaited<ReturnType<typeof searchEsimPackages>> = [];
  let fetchError = false;
  try {
    packages = await searchEsimPackages(countryCode, typeFilter);
  } catch {
    fetchError = true;
    packages = [];
  }

  const dataPackages = packages.filter((p) => p.type === "data");
  const phonePackages = packages.filter((p) => p.type === "phone");
  const displayName = packages[0]?.country || countryName(countryCode);

  const jsonLd = packages.length > 0 && {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${displayName} eSIM plans`,
    numberOfItems: packages.length,
    itemListElement: packages.slice(0, 20).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: p.name,
        description: `${p.dataAmount} eSIM data plan for ${displayName}, valid ${p.durationDays} days. Anonymous purchase with Monero or Ethereum.`,
        offers: {
          "@type": "Offer",
          price: retailPrice(p.priceUsd).toFixed(2),
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          url: `${APP_URL}/checkout/${p.code}`,
        },
      },
    })),
  };

  return (
    <div className="container py-12">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <div className="mb-8">
        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white mb-4" asChild>
          <Link href="/shop">
            <ArrowLeft className="h-4 w-4 mr-1" />
            All countries
          </Link>
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <Flag code={countryCode} className="text-5xl" />
          <div>
            <h1 className="text-3xl font-black text-white">{displayName}</h1>
            <p className="text-gray-400">
              {dataPackages.length} data plans &bull; {phonePackages.length} phone plans
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-8">
        {(["all", "data", "phone"] as const).map((t) => (
          <Link
            key={t}
            href={t === "all" ? `/shop/${countryCode}` : `/shop/${countryCode}?type=${t}`}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              typeFilter === t
                ? "bg-[#ff6600] text-white"
                : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/10"
            }`}
          >
            {t === "data" && <Wifi className="h-3.5 w-3.5" />}
            {t === "phone" && <Phone className="h-3.5 w-3.5" />}
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === "all" && ` (${packages.length})`}
            {t === "data" && ` (${dataPackages.length})`}
            {t === "phone" && ` (${phonePackages.length})`}
          </Link>
        ))}
      </div>

      {packages.length === 0 ? (
        <div className="text-center py-16">
          <Globe className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          {fetchError ? (
            <>
              <h2 className="text-xl font-semibold text-white mb-2">Unable to load plans</h2>
              <p className="text-gray-400 max-w-sm mx-auto">
                Could not connect to the eSIM provider. Please ensure the service is configured and try again.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-white mb-2">No plans available</h2>
              <p className="text-gray-400">
                We don&apos;t currently have eSIM plans for {countryCode}.
              </p>
            </>
          )}
          <Button variant="outline" className="mt-6 border-white/20 text-white" asChild>
            <Link href="/shop">Browse other countries</Link>
          </Button>
        </div>
      ) : (
        <>
          {(typeFilter === "all" || typeFilter === "data") && dataPackages.length > 0 && (
            <section className="mb-12">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Wifi className="h-5 w-5 text-[#ff6600]" />
                Data eSIMs ({dataPackages.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {dataPackages.map((pkg) => (
                  <EsimCard key={pkg.code} pkg={pkg} />
                ))}
              </div>
            </section>
          )}

          {(typeFilter === "all" || typeFilter === "phone") && phonePackages.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Phone className="h-5 w-5 text-blue-400" />
                Phone Plans ({phonePackages.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {phonePackages.map((pkg) => (
                  <EsimCard key={pkg.code} pkg={pkg} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
