import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { getBlogPostBySlug } from "@/lib/db";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = await getBlogPostBySlug(params.slug);
  if (!post) return { title: "Post not found" };
  return { title: post.title, description: post.content.slice(0, 155) };
}

export default async function BlogPostPage({ params }: PageProps) {
  const post = await getBlogPostBySlug(params.slug);
  if (!post) notFound();

  return (
    <div className="container py-12 max-w-3xl">
      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white mb-6" asChild>
        <Link href="/blog">
          <ArrowLeft className="h-4 w-4 mr-1" />
          All posts
        </Link>
      </Button>

      <article>
        <header className="mb-8">
          <h1 className="text-3xl font-black text-white mb-3">{post.title}</h1>
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <Clock className="h-4 w-4" />
            {new Date(post.published_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </header>

        <div
          className="prose prose-invert prose-orange max-w-none text-gray-300
            prose-headings:text-white prose-a:text-[#ff6600] prose-a:no-underline hover:prose-a:underline
            prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
            prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </article>
    </div>
  );
}
