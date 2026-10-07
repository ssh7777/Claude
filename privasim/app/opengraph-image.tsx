import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "PRIVASIM — Prepaid eSIMs with cryptocurrency for 190+ countries.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #0a0a1a 0%, #12122b 60%, #1a0f00 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#ff6600",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2 20 5v6c0 5.5-3.8 9.8-8 11-4.2-1.2-8-5.5-8-11V5l8-3Z" fill="#ffffff" />
              <path d="m8.5 12 2.2 2.2 4.8-4.8" stroke="#ff6600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: 72, fontWeight: 900, color: "#ffffff", letterSpacing: -2 }}>
            PRIVASIM
          </div>
        </div>
        <div style={{ fontSize: 34, color: "#d1d5db", marginTop: 28, textAlign: "center" }}>
          Prepaid eSIMs for 190+ countries
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 36 }}>
          {["No identity account", "Monero · ETH · USDT", "Delivery after fulfillment"].map((t) => (
            <div
              key={t}
              style={{
                padding: "10px 24px",
                borderRadius: 999,
                border: "1px solid rgba(255,102,0,0.5)",
                color: "#ff9944",
                fontSize: 24,
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
