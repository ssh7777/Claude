import { ImageResponse } from "next/og";
import { getBlogPostBySlug } from "@/lib/blog";

export const runtime = "edge";
export const alt = "PRIVASIM Blog — Anonymous eSIM guides";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  const title = post?.title ?? "PRIVASIM Blog";
  const tag = post?.tags[0] ?? "PRIVASIM";

  const hue =
    Array.from(slug).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7) | 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: `linear-gradient(135deg, hsl(${hue} 85% 12%), hsl(${(hue + 40) % 360} 90% 22%) 55%, hsl(24 100% 15%))`,
          padding: 60,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "#ff6600",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
            }}
          >
            🛡
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "white" }}>PRIVASIM</div>
          <div
            style={{
              marginLeft: 12,
              padding: "6px 14px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.8)",
              fontSize: 16,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {tag}
          </div>
        </div>

        <div
          style={{
            fontSize: title.length > 60 ? 48 : 56,
            fontWeight: 900,
            color: "white",
            lineHeight: 1.1,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {["No KYC", "Monero · Ethereum", "190+ Countries"].map((t) => (
            <div
              key={t}
              style={{
                padding: "8px 18px",
                borderRadius: 999,
                border: "1px solid rgba(255,102,0,0.5)",
                color: "#ff9944",
                fontSize: 18,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
