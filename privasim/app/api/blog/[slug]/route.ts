import { NextRequest, NextResponse } from "next/server";
import { getBlogPostBySlug, getBlogPosts } from "@/lib/db";

export const revalidate = 3600;

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const post = await getBlogPostBySlug(params.slug);
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const related = await getBlogPosts(3);
  return NextResponse.json(
    { post, relatedPosts: related.filter((p) => p.slug !== params.slug).slice(0, 3) },
    { headers: { "Cache-Control": "public, s-maxage=3600" } }
  );
}
