import { Metadata } from "next";
import Link from "next/link";
import { FileText, Clock, Rss, MapPin } from "lucide-react";
import { getBlogPosts, getBlogPostsCount } from "@/lib/blog";
import { COUNTRY_NAMES } from "@/lib/countries";

export const metadata: Metadata = {
  title: "Blog — Privacy Guides, eSIM Tutorials & Travel Tips",
  description: "Guides and articles on eSIMs, privacy, Monero payments, and anonymous travel. Updated daily with deals and privacy news.",
  alternates: {
    canonical: "https://privasim.app/blog",
    types: {
      "application/rss+xml": "https://privasim.app/blog/feed.xml",
    },
  },
};

export const revalidate = 3600;

const POSTS_PER_PAGE = 20;

const POPULAR_DESTINATIONS = [
  "JP", "US", "GB", "DE", "FR", "TH", "SG", "AU", "KR", "IT", "ES", "TR", "AE", "SE", "NL", "BR", "MX", "CA", "IN", "ID"
];

export default async function BlogPage() {
  const posts = getBlogPosts(POSTS_PER_PAGE, 0);
  const total = getBlogPostsCount();
  const totalPages = Math.ceil(total / POSTS_PER_PAGE);

  return (
    <div className="container py-12 max-w-5xl">
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-[#ff6600]" />
          <h1 className="text-3xl font-black text-white">Blog</h1>
          <span className="text-sm text-gray-500 ml-2">{total} articles</span>
        </div>
        <Link
          href="/blog/feed.xml"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-[#ff6600] border border-white/10 rounded-full px-3 py-1.5 hover:border-[#ff6600]/30 transition-colors"
        >
          <Rss className="h-4 w-4" />
          RSS
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {posts.length === 0 ? (
            <div className="text-center py-16 bg-white/3 border border-white/8 rounded-xl">
              <FileText className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-white mb-2">No posts yet</h2>
              <p className="text-gray-400 text-sm">Check back soon for guides and articles.</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {posts.map((post) => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="block p-6 bg-white/4 border border-white/8 rounded-xl hover:border-[#ff6600]/30 hover:bg-white/6 transition-all"
                  >
                    {post.featured && (
                      <span className="text-xs text-[#ff6600] font-medium mb-2 block">Featured</span>
                    )}
                    <h2 className="text-lg font-bold text-white mb-2">{post.title}</h2>
                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">{post.excerpt}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(post.published_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                      <span>{post.tags.slice(0, 3).join(" · ")}</span>
                    </div>
                  </Link>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <span className="text-sm text-gray-500 mr-2">Pages:</span>
                  {Array.from({ length: Math.min(totalPages, 4) }, (_, i) => i + 1).map((page) => (
                    <Link
                      key={page}
                      href={page === 1 ? "/blog" : `/blog/page/${page}`}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        page === 1
                          ? "bg-[#ff6600] text-white border-[#ff6600]"
                          : "bg-white/5 text-gray-400 border-white/10 hover:border-[#ff6600]/30 hover:text-white"
                      }`}
                    >
                      {page}
                    </Link>
                  ))}
                  {totalPages > 4 && (
                    <>
                      <span className="text-gray-600">…</span>
                      <Link
                        href={`/blog/page/${totalPages}`}
                        className="px-3 py-1.5 rounded-lg text-sm border bg-white/5 text-gray-400 border-white/10 hover:border-[#ff6600]/30 hover:text-white transition-colors"
                      >
                        {totalPages}
                      </Link>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-6">
          <div className="p-5 bg-white/3 border border-white/8 rounded-xl">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white mb-3">
              <MapPin className="h-4 w-4 text-[#ff6600]" />
              Browse by destination
            </h3>
            <div className="flex flex-wrap gap-2">
              {POPULAR_DESTINATIONS.map((code) => (
                <Link
                  key={code}
                  href={`/shop/${code}`}
                  className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:border-[#ff6600]/30 hover:text-white transition-colors"
                >
                  {COUNTRY_NAMES[code] || code}
                </Link>
              ))}
              <Link
                href="/shop"
                className="text-xs px-2.5 py-1 rounded-full bg-[#ff6600]/10 border border-[#ff6600]/20 text-[#ff6600] hover:bg-[#ff6600]/20 transition-colors"
              >
                All 190+ →
              </Link>
            </div>
          </div>

          <div className="p-5 bg-white/3 border border-white/8 rounded-xl">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white mb-3">
              <Rss className="h-4 w-4 text-[#ff6600]" />
              Subscribe
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              Get new guides and daily deals via RSS. No email required.
            </p>
            <Link
              href="/blog/feed.xml"
              className="text-xs text-[#ff6600] hover:underline break-all"
            >
              https://privasim.app/blog/feed.xml
            </Link>
          </div>

          <div className="p-5 bg-white/3 border border-white/8 rounded-xl">
            <h3 className="text-sm font-bold text-white mb-3">Popular topics</h3>
            <div className="flex flex-wrap gap-2">
              {["privacy", "monero", "guide", "travel", "comparison", "deals"].map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
