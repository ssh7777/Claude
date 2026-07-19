import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Tag } from "lucide-react";
import { getBlogPostBySlug, getAllBlogSlugs } from "@/lib/blog";
import { Button } from "@/components/ui/button";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://privasim.app";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Pre-render every post at build time — no 404s, no cold fetches.
export function generateStaticParams() {
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const post = getBlogPostBySlug(params.slug);
  if (!post) return { title: "Post not found" };
  return {
    title: post.title,
    description: post.excerpt,
    keywords: post.tags,
    alternates: { canonical: `${APP_URL}/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      url: `${APP_URL}/blog/${post.slug}`,
      publishedTime: post.published_at,
      modifiedTime: post.updated_at ?? post.published_at,
      siteName: "PRIVASIM",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
  };
}

function readingTime(html: string): number {
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export default async function BlogPostPage(props: PageProps) {
  const params = await props.params;
  const post = getBlogPostBySlug(params.slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: post.title,
        description: post.excerpt,
        datePublished: post.published_at,
        dateModified: post.updated_at ?? post.published_at,
        author: { "@type": "Organization", name: "PRIVASIM", url: APP_URL },
        publisher: { "@type": "Organization", name: "PRIVASIM", url: APP_URL },
        mainEntityOfPage: `${APP_URL}/blog/${post.slug}`,
        keywords: post.tags.join(", "),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: APP_URL },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${APP_URL}/blog` },
          { "@type": "ListItem", position: 3, name: post.title, item: `${APP_URL}/blog/${post.slug}` },
        ],
      },
    ],
  };

  // Deterministic hue per post so every article gets its own hero colour.
  const heroHue =
    Array.from(post.slug).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7) | 0;

  return (
    <div className="container py-12 max-w-3xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white mb-6" asChild>
        <Link href="/blog">
          <ArrowLeft className="h-4 w-4 mr-1" />
          All posts
        </Link>
      </Button>

      <article>
        <header className="mb-8">
          {/* CSS-only hero art — deterministic per post, no external images
              so nothing can ever 404 or render broken. */}
          <div
            aria-hidden
            className="relative h-40 sm:h-52 rounded-2xl mb-6 overflow-hidden border border-white/10"
            style={{
              background: `linear-gradient(135deg, hsl(${heroHue} 85% 12%), hsl(${(heroHue + 40) % 360} 90% 22%) 55%, hsl(24 100% 45%))`,
            }}
          >
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.35) 0, transparent 30%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.25) 0, transparent 35%), radial-gradient(circle at 60% 20%, rgba(255,153,68,0.5) 0, transparent 25%)",
              }}
            />
            <div className="absolute inset-0 flex items-end p-5">
              <span className="text-xs font-semibold uppercase tracking-widest text-white/80 bg-black/30 rounded-full px-3 py-1">
                {post.tags[0] ?? "PRIVASIM"}
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-black text-white mb-3">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {new Date(post.published_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <span>{readingTime(post.content)} min read</span>
            {post.tags.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                {post.tags.join(" · ")}
              </span>
            )}
          </div>
        </header>

        <div
          className="prose prose-invert prose-orange max-w-none text-gray-300
            prose-headings:text-white prose-a:text-[#ff6600] prose-a:no-underline hover:prose-a:underline
            prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
            prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10
            prose-table:border prose-table:border-white/10 prose-th:p-2 prose-td:p-2
            prose-th:border prose-th:border-white/10 prose-td:border prose-td:border-white/10
            prose-li:my-1 prose-p:leading-relaxed
            [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:rounded-lg
            [&_th]:bg-white/5 [&_th]:text-white [&_a]:break-words"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </article>

      <div className="mt-12 p-6 bg-white/4 border border-[#ff6600]/20 rounded-xl text-center">
        <h2 className="text-lg font-bold text-white mb-2">Ready for anonymous connectivity?</h2>
        <p className="text-gray-400 text-sm mb-4">
          eSIMs for 190+ countries. Pay with Monero or Ethereum — no account, no KYC.
        </p>
        <Button className="bg-[#ff6600] hover:bg-[#e55c00] text-white" asChild>
          <Link href="/shop">Browse plans</Link>
        </Button>
      </div>
    </div>
  );
}
