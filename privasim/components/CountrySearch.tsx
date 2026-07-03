"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Flag from "@/components/Flag";
import { COUNTRY_NAMES, detectCountry } from "@/lib/countries";

const POPULAR_CODES = ["JP", "US", "GB", "DE", "FR", "TH", "SG", "AU", "KR", "IT", "ES", "TR"];

const ALL_COUNTRIES = Object.entries(COUNTRY_NAMES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const POPULAR_COUNTRIES = POPULAR_CODES.map((code) => ({
  code,
  name: COUNTRY_NAMES[code] ?? code,
}));

export default function CountrySearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  // Search the FULL country list — by name or ISO code
  const filteredCountries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return POPULAR_COUNTRIES;
    return ALL_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q
    ).slice(0, 12);
  }, [query]);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = query.trim();
      if (!q) {
        router.push("/shop");
        return;
      }
      // Resolve free text ("sweden", "SE", "japan") to an ISO code
      const code =
        filteredCountries[0]?.code ??
        detectCountry(q) ??
        (q.length === 2 && COUNTRY_NAMES[q.toUpperCase()] ? q.toUpperCase() : null);
      router.push(code ? `/shop/${code}` : "/shop");
      setFocused(false);
    },
    [query, router, filteredCountries]
  );

  const handleCountryClick = (code: string) => {
    router.push(`/shop/${code}`);
    setFocused(false);
    setQuery("");
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          type="text"
          placeholder="Search country (e.g. Japan, US, DE...)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          className="h-14 pl-12 pr-32 text-base bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-[#ff6600]"
        />
        <Button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#ff6600] hover:bg-[#e55c00] text-white"
        >
          Search
        </Button>
      </form>

      {focused && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#12122a] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden">
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Globe className="h-3 w-3" />
              {query ? `Matches for "${query.trim()}"` : "Popular destinations"}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 p-2 max-h-72 overflow-y-auto">
            {filteredCountries.map((country) => (
              <button
                key={country.code}
                onClick={() => handleCountryClick(country.code)}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-white/10 transition-colors text-left"
              >
                <Flag code={country.code} className="text-xl shrink-0" />
                <div>
                  <div className="text-sm text-white">{country.name}</div>
                  <div className="text-xs text-gray-400">{country.code}</div>
                </div>
              </button>
            ))}
            {query && filteredCountries.length === 0 && (
              <div className="col-span-3 p-4 text-sm text-gray-400 text-center">
                No country matches &ldquo;{query}&rdquo; — try another spelling.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
