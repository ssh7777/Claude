"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getCountryFlag } from "@/lib/utils";

const POPULAR_COUNTRIES = [
  { code: "JP", name: "Japan" },
  { code: "US", name: "USA" },
  { code: "GB", name: "UK" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "TH", name: "Thailand" },
  { code: "SG", name: "Singapore" },
  { code: "AU", name: "Australia" },
  { code: "KR", name: "South Korea" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "TR", name: "Turkey" },
];

export default function CountrySearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const filteredCountries = POPULAR_COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.code.toLowerCase().includes(query.toLowerCase())
  );

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        router.push(`/shop/${query.trim().toUpperCase()}`);
      } else {
        router.push("/shop");
      }
    },
    [query, router]
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
              Popular destinations
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 p-2 max-h-72 overflow-y-auto">
            {(query ? filteredCountries : POPULAR_COUNTRIES).map((country) => (
              <button
                key={country.code}
                onClick={() => handleCountryClick(country.code)}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-white/10 transition-colors text-left"
              >
                <span className="text-xl">{getCountryFlag(country.code)}</span>
                <div>
                  <div className="text-sm text-white">{country.name}</div>
                  <div className="text-xs text-gray-400">{country.code}</div>
                </div>
              </button>
            ))}
            {query && filteredCountries.length === 0 && (
              <div className="col-span-3 p-4 text-sm text-gray-400 text-center">
                Press Enter to search for &ldquo;{query}&rdquo;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
