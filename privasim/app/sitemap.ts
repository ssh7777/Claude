import type { MetadataRoute } from "next";
import { getBlogPosts, getAllBlogSlugs } from "@/lib/blog";
import { COUNTRY_NAMES } from "@/lib/countries";

const APP_URL = "https://privasim.app";

// All 99 countries from lib/countries — includes CN, ensures sitemap has 99 /shop/XX URLs
const COUNTRY_CODES = Object.keys(COUNTRY_NAMES).sort();

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: APP_URL, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${APP_URL}/anonymous-esim`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${APP_URL}/shop`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${APP_URL}/shop/global`, lastModified: now, changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${APP_URL}/blog`, lastModified: now, changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${APP_URL}/blog/feed.xml`, lastModified: now, changeFrequency: "daily" as const, priority: 0.5 },
    { url: `${APP_URL}/guide`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${APP_URL}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${APP_URL}/topup`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${APP_URL}/orders`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  const countryRoutes: MetadataRoute.Sitemap = COUNTRY_CODES.map((code) => ({
    url: `${APP_URL}/shop/${code}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  // Archive pagination pages 2-4 (page 1 is /blog itself)
  const archiveRoutes: MetadataRoute.Sitemap = [2, 3, 4].map((page) => ({
    url: `${APP_URL}/blog/page/${page}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  const blogRoutes: MetadataRoute.Sitemap = getBlogPosts(200).map((post) => ({
    url: `${APP_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updated_at ?? post.published_at),
    changeFrequency: (post.slug === "best-esim-deals-today" ? "daily" : "weekly") as "daily" | "weekly",
    priority: post.slug === "best-esim-deals-today" ? 0.9 : post.featured ? 0.7 : 0.6,
  }));

  return [...staticRoutes, ...countryRoutes, ...archiveRoutes, ...blogRoutes];
}
