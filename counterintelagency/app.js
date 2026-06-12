/* =====================================================================
   Counterintel Agency — client runtime
   Dependency-free vanilla JS.
   - Feature 1: lifecycle / funnel telemetry -> structured JSON payload
   - Feature 2: high-intent lead modal (15s dwell OR exit-intent)
   - Contact form: math captcha + async POST to anonymized gateway
   ===================================================================== */
(function () {
  "use strict";

  /* ----------------------------------------------------------------
     CONFIGURATION
     LEAD_ENDPOINT: anonymized middle-tier serverless gateway.
     The destination inbox is resolved server-side from an environment
     variable and is NEVER present in client source. See api/lead.js
     (Vercel) or worker.js (Cloudflare alternative).
     TELEMETRY_ENDPOINT: privacy-compliant analytics sink (optional).
  ---------------------------------------------------------------- */
  var LEAD_ENDPOINT = "/api/lead";
  var TELEMETRY_ENDPOINT = "/api/telemetry";

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  document.addEventListener("DOMContentLoaded", function () {
    var yearEl = $("#year");
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    initReveal();
    var telemetry = initTelemetry();
    initCaptcha();
    initContactForm(telemetry);
    initLeadModal(telemetry);
  });

  /* ================================================================
     Scroll-reveal (progressive enhancement)
  ================================================================ */
  function initReveal() {
    var els = $$(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ================================================================
     FEATURE 1 — Asynchronous funnel & telemetry analytics
     Tracks: scroll-depth velocity, session duration, document focus/
     exit parameters, and component click events. Compiles to a clean
     structured JSON payload for an external analytics endpoint.
  ================================================================ */
  function initTelemetry() {
    var sessionStart = Date.now();
    var state = {
      sessionId: makeId(),
      startedAt: new Date(sessionStart).toISOString(),
      page: location.pathname,
      referrer: document.referrer || null,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      scroll: { maxDepthPct: 0, peakVelocityPxPerSec: 0 },
      focus: { activeMs: 0, blurEvents: 0, exitIntentEvents: 0 },
      events: []
    };

    // --- active focus time accounting ---
    var lastTick = Date.now();
    var isVisible = !document.hidden;
    function accrue() {
      var now = Date.now();
      if (isVisible) state.focus.activeMs += now - lastTick;
      lastTick = now;
    }
    document.addEventListener("visibilitychange", function () {
      accrue();
      isVisible = !document.hidden;
      if (document.hidden) {
        state.focus.blurEvents++;
        logEvent("document_exit", { activeMs: state.focus.activeMs });
        flush(true);
      } else {
        logEvent("document_focus", {});
      }
    });
    window.addEventListener("blur", function () { state.focus.blurEvents++; });

    // --- scroll depth + velocity ---
    var lastScrollY = window.scrollY;
    var lastScrollT = Date.now();
    var scrollScheduled = false;
    window.addEventListener("scroll", function () {
      if (scrollScheduled) return;
      scrollScheduled = true;
      window.requestAnimationFrame(function () {
        scrollScheduled = false;
        var now = Date.now();
        var y = window.scrollY;
        var docH = Math.max(document.body.scrollHeight - window.innerHeight, 1);
        var depthPct = Math.min(100, Math.round((y / docH) * 100));
        if (depthPct > state.scroll.maxDepthPct) state.scroll.maxDepthPct = depthPct;

        var dt = (now - lastScrollT) / 1000;
        if (dt > 0) {
          var velocity = Math.abs(y - lastScrollY) / dt; // px/sec
          if (velocity > state.scroll.peakVelocityPxPerSec) {
            state.scroll.peakVelocityPxPerSec = Math.round(velocity);
          }
        }
        lastScrollY = y;
        lastScrollT = now;
      });
    }, { passive: true });

    // --- component click events ---
    $$("[data-track]").forEach(function (el) {
      el.addEventListener("click", function () {
        logEvent("click", { target: el.getAttribute("data-track"), text: (el.textContent || "").trim().slice(0, 48) });
      });
    });

    // --- periodic + unload flush ---
    var flushTimer = window.setInterval(function () { accrue(); flush(false); }, 30000);
    window.addEventListener("pagehide", function () { accrue(); flush(true); });
    window.addEventListener("beforeunload", function () { accrue(); flush(true); });

    function logEvent(type, data) {
      state.events.push({ t: type, atMs: Date.now() - sessionStart, data: data || {} });
    }

    function snapshot() {
      accrue();
      return {
        sessionId: state.sessionId,
        startedAt: state.startedAt,
        elapsedMs: Date.now() - sessionStart,
        page: state.page,
        referrer: state.referrer,
        viewport: state.viewport,
        scroll: state.scroll,
        focus: state.focus,
        events: state.events
      };
    }

    function flush(isFinal) {
      var payload = snapshot();
      // Prefer sendBeacon for unload reliability; fall back to fetch.
      try {
        var body = JSON.stringify(payload);
        if (isFinal && navigator.sendBeacon) {
          navigator.sendBeacon(TELEMETRY_ENDPOINT, new Blob([body], { type: "application/json" }));
          return;
        }
        if ("fetch" in window) {
          fetch(TELEMETRY_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: body,
            keepalive: true,
            mode: "cors"
          }).catch(function () { /* analytics is best-effort */ });
        }
      } catch (e) { /* never block UX on telemetry */ }
    }

    // expose for other modules
    return {
      logEvent: logEvent,
      snapshot: snapshot,
      dispose: function () { window.clearInterval(flushTimer); }
    };
  }

  /* ================================================================
     Contact form — math captcha + async gateway POST
  ================================================================ */
  var captcha = { a: 0, b: 0, answer: 0 };

  function initCaptcha() {
    regenCaptcha();
    var btn = $("#captcha-refresh");
    if (btn) btn.addEventListener("click", function (e) { e.preventDefault(); regenCaptcha(); });
  }

  function regenCaptcha() {
    captcha.a = 1 + Math.floor(Math.random() * 9);
    captcha.b = 1 + Math.floor(Math.random() * 9);
    captcha.answer = captcha.a + captcha.b;
    var q = $("#captcha-q");
    if (q) q.textContent = captcha.a + " + " + captcha.b + " =";
    var input = $("#f-captcha");
    if (input) input.value = "";
  }

  function initContactForm(telemetry) {
    var form = $("#lead-form");
    if (!form) return;
    var errEl = $("#form-error");
    var submitBtn = $("#lead-submit");
    var submitLabel = $("#submit-label");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      hideError();

      // Honeypot: silently accept-and-drop bot submissions.
      if (form.company_website && form.company_website.value) { showSuccess(); return; }

      if (!form.checkValidity()) {
        showError("All operational fields are required.");
        form.reportValidity();
        return;
      }
      var emailVal = $("#f-email").value.trim();
      if (!isValidEmail(emailVal)) { showError("Provide a valid institutional email address."); return; }

      if (parseInt($("#f-captcha").value, 10) !== captcha.answer) {
        showError("Verification incorrect. Solve the challenge to continue.");
        regenCaptcha();
        return;
      }

      var payload = {
        type: "secure_audit_inquiry",
        name: $("#f-name").value.trim(),
        email: emailVal,
        focus: $("#f-focus").value,
        message: $("#f-message").value.trim(),
        meta: {
          submittedAt: new Date().toISOString(),
          source: "contact",
          session: telemetry ? telemetry.snapshot().sessionId : null
        }
      };

      setSubmitting(true);
      postLead(payload).then(function (ok) {
        if (ok) {
          if (telemetry) telemetry.logEvent("lead_submitted", { source: "contact" });
          showSuccess();
        } else {
          setSubmitting(false);
          showError("Transmission could not be established. Retry shortly.");
        }
      });
    });

    function setSubmitting(on) {
      if (submitBtn) submitBtn.disabled = on;
      if (submitLabel) submitLabel.textContent = on ? "Transmitting…" : "Transmit Secure Inquiry";
    }
    function showError(msg) { if (errEl) { errEl.textContent = msg; errEl.classList.remove("hidden"); } }
    function hideError() { if (errEl) errEl.classList.add("hidden"); }
    function showSuccess() {
      form.classList.add("hidden");
      var ok = $("#lead-success");
      if (ok) { ok.classList.remove("hidden"); ok.scrollIntoView({ behavior: "smooth", block: "center" }); }
    }
  }

  /* ================================================================
     FEATURE 2 — High-intent behavioral lead modal
     Trigger: 15s of active engagement OR exit-intent. Shows once.
  ================================================================ */
  function initLeadModal(telemetry) {
    var modal = $("#lead-modal");
    if (!modal) return;
    var card = $("#modal-card");
    var closeBtn = $("#modal-close");
    var backdrop = $("#modal-backdrop");
    var form = $("#modal-form");
    var success = $("#modal-success");

    var shown = false;
    var dismissedKey = "cia_modal_seen";
    var alreadySeen = false;
    try { alreadySeen = sessionStorage.getItem(dismissedKey) === "1"; } catch (e) {}

    // Count only active (visible) engagement toward the 15s threshold.
    var activeMs = 0;
    var tick = Date.now();
    var THRESHOLD = 15000;
    var poll = window.setInterval(function () {
      var now = Date.now();
      if (!document.hidden) activeMs += now - tick;
      tick = now;
      if (activeMs >= THRESHOLD) { open("dwell_15s"); }
    }, 500);
    document.addEventListener("visibilitychange", function () { tick = Date.now(); });

    // Exit-intent: cursor accelerating toward top viewport boundary.
    document.addEventListener("mouseout", function (e) {
      if (e.relatedTarget || e.toElement) return;
      if (e.clientY <= 4) open("exit_intent");
    });

    function open(trigger) {
      if (shown || alreadySeen) return;
      shown = true;
      window.clearInterval(poll);
      try { sessionStorage.setItem(dismissedKey, "1"); } catch (e) {}
      if (telemetry) telemetry.logEvent("modal_shown", { trigger: trigger });

      modal.classList.remove("hidden");
      modal.classList.add("flex");
      // force reflow then animate
      void card.offsetWidth;
      card.classList.remove("modal-enter");
      card.classList.add("modal-shown");
      document.addEventListener("keydown", onKey);
      var firstInput = $("#m-email");
      if (firstInput) firstInput.focus();
    }

    function close() {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      document.removeEventListener("keydown", onKey);
      if (telemetry) telemetry.logEvent("modal_closed", {});
    }
    function onKey(e) { if (e.key === "Escape") close(); }

    if (closeBtn) closeBtn.addEventListener("click", close);
    if (backdrop) backdrop.addEventListener("click", close);

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var email = $("#m-email").value.trim();
        if (!isValidEmail(email)) { $("#m-email").focus(); return; }
        var payload = {
          type: "free_consultation",
          email: email,
          meta: {
            submittedAt: new Date().toISOString(),
            source: "modal",
            session: telemetry ? telemetry.snapshot().sessionId : null
          }
        };
        postLead(payload).then(function () {
          if (telemetry) telemetry.logEvent("lead_submitted", { source: "modal" });
          form.classList.add("hidden");
          if (success) success.classList.remove("hidden");
        });
      });
    }
  }

  /* ================================================================
     Shared helpers
  ================================================================ */
  function postLead(payload) {
    if (!("fetch" in window)) return Promise.resolve(false);
    return fetch(LEAD_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      mode: "cors"
    }).then(function (res) { return res.ok; })
      .catch(function () { return false; });
  }

  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function makeId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "s-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
})();
