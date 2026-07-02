import type { MetadataRoute } from "next";
import { getBlogPosts } from "@/lib/blog";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://privasim-two.vercel.app";

const COUNTRY_CODES = [
  "JP", "US", "GB", "DE", "FR", "IT", "ES", "NL", "CH", "AT",
  "TH", "SG", "AU", "KR", "PH", "ID", "VN", "MY", "IN", "HK",
  "CA", "MX", "BR", "AR", "CO",
  "AE", "SA", "IL", "ZA", "TR",
  "PL", "CZ", "HU", "PT", "GR", "SE", "NO", "DK", "FI", "BE",
  "TW", "NZ", "IE", "EG", "MA", "KE", "PE", "CL", "IS", "HR",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: APP_URL, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${APP_URL}/shop`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${APP_URL}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${APP_URL}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${APP_URL}/orders`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  const countryRoutes: MetadataRoute.Sitemap = COUNTRY_CODES.map((code) => ({
    url: `${APP_URL}/shop/${code}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const blogRoutes: MetadataRoute.Sitemap = getBlogPosts(100).map((post) => ({
    url: `${APP_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updated_at ?? post.published_at),
    changeFrequency: "monthly" as const,
    priority: post.featured ? 0.7 : 0.6,
  }));

  return [...staticRoutes, ...countryRoutes, ...blogRoutes];
}
