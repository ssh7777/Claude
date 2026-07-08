"use client";

// Records one first-party analytics "visit" per browser session, attributing
// it to the traffic source (utm_source param, or the referrer). No cookies,
// no PII — just a source bucket. Persists a session flag so we count sessions,
// not page views.

import { useEffect } from "react";

export default function TrackVisit() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("ps_tracked")) return;
      sessionStorage.setItem("ps_tracked", "1");

      const params = new URLSearchParams(window.location.search);
      const utm = params.get("utm_source") || params.get("ref") || params.get("source");
      const source = utm || document.referrer || "direct";

      // Persist the first-touch source so checkout can attribute the sale
      if (!localStorage.getItem("ps_source")) {
        localStorage.setItem("ps_source", source);
      }

      navigator.sendBeacon?.(
        "/api/track",
        new Blob([JSON.stringify({ source, type: "visit" })], { type: "application/json" })
      );
    } catch {
      /* analytics must never break the page */
    }
  }, []);

  return null;
}
