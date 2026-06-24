import { Metadata } from "next";
import Link from "next/link";
import { FileText, Clock } from "lucide-react";
import { getBlogPosts } from "@/lib/db";

export const metadata: Metadata = {
  title: "Blog",
  description: "Guides and articles on eSIMs, privacy, and crypto payments.",
};

export const revalidate = 3600;

export default async function BlogPage() {
  const posts = await getBlogPosts(20);

  return (
    <div className="container py-12 max-w-3xl">
      <div className="flex items-center gap-3 mb-10">
        <FileText className="h-7 w-7 text-[#ff6600]" />
        <h1 className="text-3xl font-black text-white">Blog</h1>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-16 bg-white/3 border border-white/8 rounded-xl">
          <FileText className="h-10 w-10 text-gray-600 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-white mb-2">No posts yet</h2>
          <p className="text-gray-400 text-sm">Check back soon for guides and articles.</p>
        </div>
      ) : (
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
      )}
    </div>
  );
}
