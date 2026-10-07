import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { getBlogPosts, getBlogPostsCount } from "@/lib/blog";

const POSTS_PER_PAGE = 20;

interface PageProps {
  params: Promise<{ pageNumber: string }>;
}

export function generateStaticParams() {
  const total = getBlogPostsCount();
  const totalPages = Math.ceil(total / POSTS_PER_PAGE);
  // Pre-render pages 2-4 at build time as required by sitemap, plus a few more
  return Array.from({ length: Math.min(totalPages - 1, 10) }, (_, i) => ({
    pageNumber: String(i + 2),
  }));
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const page = parseInt(params.pageNumber, 10);
  return {
    title: `Blog — Page ${page}`,
    description: `Privacy guides and eSIM tutorials — page ${page}`,
    alternates: {
      canonical: `https://privasim.app/blog/page/${page}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function BlogPaginatedPage(props: PageProps) {
  const params = await props.params;
  const pageNum = parseInt(params.pageNumber, 10);

  if (isNaN(pageNum) || pageNum < 2) {
    notFound();
  }

  const total = getBlogPostsCount();
  const totalPages = Math.ceil(total / POSTS_PER_PAGE);

  if (pageNum > totalPages) {
    notFound();
  }

  const offset = (pageNum - 1) * POSTS_PER_PAGE;
  const posts = getBlogPosts(POSTS_PER_PAGE, offset);

  return (
    <div className="container py-12 max-w-3xl">
      <div className="flex items-center gap-3 mb-10">
        <FileText className="h-7 w-7 text-[#ff6600]" />
        <h1 className="text-3xl font-black text-white">Blog — Page {pageNum}</h1>
        <span className="text-sm text-gray-500 ml-2">
          {total} articles · page {pageNum} of {totalPages}
        </span>
      </div>

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
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              {new Date(post.published_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Link
          href={pageNum === 2 ? "/blog" : `/blog/page/${pageNum - 1}`}
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white border border-white/10 rounded-lg px-3 py-1.5 hover:border-white/20 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Link>

        <div className="flex items-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(0, 5)
            .map((p) => (
              <Link
                key={p}
                href={p === 1 ? "/blog" : `/blog/page/${p}`}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  p === pageNum
                    ? "bg-[#ff6600] text-white border-[#ff6600]"
                    : "bg-white/5 text-gray-400 border-white/10 hover:border-[#ff6600]/30 hover:text-white"
                }`}
              >
                {p}
              </Link>
            ))}
          {totalPages > 5 && <span className="text-gray-600">…</span>}
        </div>

        {pageNum < totalPages ? (
          <Link
            href={`/blog/page/${pageNum + 1}`}
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white border border-white/10 rounded-lg px-3 py-1.5 hover:border-white/20 transition-colors"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="text-sm text-gray-600 px-3 py-1.5">Last page</span>
        )}
      </div>
    </div>
  );
}
