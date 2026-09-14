"use strict";

/**
 * Browser checkout handoff used by app.js `/?checkout=1` and the premium gate.
 * Always send cookies (`credentials: "include"`) so a same-site fetch cannot
 * drop `dispatch_session` if apex/www is ever treated as cross-origin.
 */
async function startCheckout(options = {}) {
  const fetchFn = options.fetchImpl || fetch;
  const assign = options.locationAssign || (url => {
    if (typeof globalThis.location !== "undefined") globalThis.location.href = url;
  });
  const track = options.track || (() => {});

  const response = await fetchFn("/api/create-checkout", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await response.json().catch(() => ({}));

  if (data.url) {
    track("subscribe_started", { location: "checkout", plan: "premium" });
    assign(data.url);
    return { ok: true, url: data.url };
  }

  if (response.status === 401) {
    try {
      const meResponse = await fetchFn("/api/me", { credentials: "include" });
      const account = meResponse.ok ? await meResponse.json() : null;
      if (account?.checkoutSession?.url) {
        track("subscribe_started", { location: "checkout_reuse", plan: "premium" });
        assign(account.checkoutSession.url);
        return { ok: true, url: account.checkoutSession.url, reused: true };
      }
      if (account?.id) {
        return {
          ok: false,
          signedIn: true,
          error: data.error || "Unable to start checkout",
        };
      }
    } catch {
      // Fall through to subscribe so a guest can still create an account.
    }
    track("signup_started", { location: "premium_gate" });
    assign("/__auth/subscribe");
    return { ok: false, redirect: "/__auth/subscribe" };
  }

  return { ok: false, error: data.error || "Something went wrong" };
}

module.exports = { startCheckout };
