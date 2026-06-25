import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDataAmount(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  if (num >= 1000) return `${(num / 1024).toFixed(0)} TB`;
  if (num >= 1) return `${num} GB`;
  return `${(num * 1024).toFixed(0)} MB`;
}

export function formatDuration(days: number): string {
  if (days === 1) return "1 day";
  if (days < 7) return `${days} days`;
  if (days === 7) return "1 week";
  if (days < 30) return `${Math.floor(days / 7)} weeks`;
  if (days === 30) return "30 days";
  return `${days} days`;
}

export function getCountryFlag(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 0x1f1e0 + char.charCodeAt(0) - 0x41);
  return String.fromCodePoint(...codePoints);
}

export function shortenAddress(address: string, chars = 6): string {
  if (!address || address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function timeUntil(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m remaining`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h remaining`;
  return `${Math.floor(hrs / 24)}d remaining`;
}

export function parseDataAmountToGb(amount: string): number {
  const num = parseFloat(amount);
  if (isNaN(num)) return 0;
  if (amount.toLowerCase().includes("mb")) return num / 1024;
  if (amount.toLowerCase().includes("tb")) return num * 1024;
  return num; // assume GB
}
