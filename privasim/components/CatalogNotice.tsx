import { AlertTriangle, Database } from "lucide-react";
import type { CatalogSource } from "@/lib/pikasim";

interface Props {
  /** `cache` = last catalog saved in PostgreSQL, `fallback` = committed snapshot. */
  source: CatalogSource;
  className?: string;
}

/**
 * Shown whenever a catalog is served from something other than a live supplier
 * read. Prices may be older than the supplier's current list; the invoice is
 * always re-quoted live at checkout.
 */
export default function CatalogNotice({ source, className = "" }: Props) {
  const Icon = source === "cache" ? Database : AlertTriangle;
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ${className}`}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
      <p>
        Showing a recently saved catalog because the eSIM supplier is unreachable right now. Plans and
        prices here may be out of date — the exact amount is confirmed when your invoice is created at
        checkout, and checkout is unavailable if the supplier cannot confirm the plan.
      </p>
    </div>
  );
}
