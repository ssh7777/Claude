import Link from "next/link";
import { Wifi, Phone, Clock, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatUsd, formatDataAmount, formatDuration, getCountryFlag } from "@/lib/utils";
import type { EsimPackage } from "@/types";

interface EsimCardProps {
  pkg: EsimPackage;
}

export default function EsimCard({ pkg }: EsimCardProps) {
  const flag = getCountryFlag(pkg.countryCode);

  return (
    <Card className="bg-white/5 border-white/10 hover:border-[#ff6600]/50 transition-all duration-200 hover:bg-white/8">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{flag}</span>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide">{pkg.countryCode}</div>
              <div className="text-sm font-medium text-white truncate max-w-[160px]">
                {pkg.name}
              </div>
            </div>
          </div>
          <Badge variant={pkg.type === "phone" ? "ethereum" : "monero"}>
            {pkg.type === "phone" ? <Phone className="h-3 w-3 mr-1" /> : <Wifi className="h-3 w-3 mr-1" />}
            {pkg.type === "phone" ? "Phone" : "Data"}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-white/5 rounded-md p-2">
            <div className="text-xs text-gray-400 flex items-center gap-1 mb-0.5">
              <Wifi className="h-3 w-3" />
              Data
            </div>
            <div className="text-sm font-semibold text-white">
              {formatDataAmount(pkg.dataAmount)}
            </div>
          </div>
          <div className="bg-white/5 rounded-md p-2">
            <div className="text-xs text-gray-400 flex items-center gap-1 mb-0.5">
              <Clock className="h-3 w-3" />
              Duration
            </div>
            <div className="text-sm font-semibold text-white">
              {formatDuration(pkg.durationDays)}
            </div>
          </div>
        </div>

        {pkg.networks && pkg.networks.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1">Networks</div>
            <div className="flex flex-wrap gap-1">
              {pkg.networks.slice(0, 3).map((n) => (
                <span key={n} className="text-xs bg-white/5 text-gray-300 px-1.5 py-0.5 rounded">
                  {n}
                </span>
              ))}
              {pkg.networks.length > 3 && (
                <span className="text-xs text-gray-500">+{pkg.networks.length - 3}</span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400">Price</div>
            <div className="text-lg font-bold text-white">{formatUsd(pkg.priceUsd * 1.5)}</div>
          </div>
          <Button size="sm" className="bg-[#ff6600] hover:bg-[#e55c00] text-white" asChild>
            <Link href={`/checkout/${pkg.code}`}>
              Buy Now
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
