import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a1a",
          borderRadius: 7,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2 20 5v6c0 5.5-3.8 9.8-8 11-4.2-1.2-8-5.5-8-11V5l8-3Z" fill="#ff6600" />
          <path d="m8.5 12 2.2 2.2 4.8-4.8" stroke="#0a0a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
