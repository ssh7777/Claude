// Pure pricing math.
//
// IMPORTANT: this module is imported by client components
// (`app/checkout/[packageCode]`, `app/topup`, `components/EsimCard`). It must
// stay free of any Node/database import — even a dynamic `import()` of a
// server module is traced into the browser bundle by webpack and breaks the
// build. Live rate fetching lives in `lib/priceFeed.ts`.

export const RETAIL_MARGIN = 1.7;

export function retailPrice(wholesaleUsd: number, margin: number = RETAIL_MARGIN): number {
  if (!Number.isFinite(wholesaleUsd) || wholesaleUsd <= 0 || !Number.isFinite(margin) || margin <= 0) {
    throw new Error("Invalid retail pricing inputs");
  }
  return Math.ceil(wholesaleUsd * margin * 100) / 100;
}

export function formatXmr(amount: number): string {
  return amount.toFixed(8) + " XMR";
}

export function formatEth(amount: number): string {
  return amount.toFixed(8) + " ETH";
}
