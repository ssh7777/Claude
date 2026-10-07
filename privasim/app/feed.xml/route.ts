import { NextResponse } from "next/server";

const APP_URL = "https://privasim.app";

export const revalidate = 86400;

export async function GET() {
  return NextResponse.redirect(`${APP_URL}/blog/feed.xml`, 301);
}
