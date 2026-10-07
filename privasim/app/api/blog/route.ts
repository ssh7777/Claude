import { NextRequest, NextResponse } from "next/server";
import { getBlogPosts, getBlogPostsCount, getAllBlogPosts } from "@/lib/blog";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));
  const offset = (page - 1) * limit;

  const posts = getBlogPosts(limit, offset);
  const total = getBlogPostsCount();
  const all = getAllBlogPosts();

  return NextResponse.json(
    { posts, total, page, totalPages: Math.ceil(total / limit), allCount: all.length },
    { headers: { "Cache-Control": "public, s-maxage=3600" } }
  );
}
