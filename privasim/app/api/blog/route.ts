import { NextRequest, NextResponse } from "next/server";
import { getBlogPosts } from "@/lib/db";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));
  const offset = (page - 1) * limit;

  const posts = await getBlogPosts(limit, offset);
  return NextResponse.json(
    { posts, total: posts.length, page },
    { headers: { "Cache-Control": "public, s-maxage=3600" } }
  );
}
