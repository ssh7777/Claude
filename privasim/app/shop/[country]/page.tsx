import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wifi, Phone, Globe } from "lucide-react";
import { searchEsimPackages } from "@/lib/pikasim";
import EsimCard from "@/components/EsimCard";
import { Button } from "@/components/ui/button";

export const revalidate = 300;

interface PageProps {
  params: { country: string };
  searchParams: { type?: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const countryCode = params.country.toUpperCase();
  return {
    title: `eSIMs for ${countryCode}`,
    description: `Buy anonymous eSIM data and phone plans for ${countryCode} with Monero or Ethereum.`,
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
  const countryName = packages[0]?.country ?? countryCode;

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://flagcdn.com/w80/${countryCode.toLowerCase()}.png`}
            alt={countryName}
            width={56}
            height={40}
            className="rounded object-cover"
          />
          <div>
            <h1 className="text-3xl font-black text-white">{countryName}</h1>
            <p className="text-gray-400">
              {dataPackages.length} data plans &bull; {phonePackages.length} phone plans
            </p>
          </div>
        </div>
      </div>

      {/* Type filter */}
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

