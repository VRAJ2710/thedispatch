"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");

const {
  PUBLIC_ORIGIN,
  canonicalRedirectLocation,
  publicUrl,
  writeCanonicalRedirect,
} = require("../lib/billing-origin");
const {
  accountCreatedCookieHeader,
  appendSetCookie,
  clearSessionCookieHeader,
  sessionCookieHeader,
} = require("../lib/session-cookie");
const {
  isBlockedSourcePath,
  isServableStaticPath,
} = require("../lib/static-allowlist");
const { startCheckout } = require("../lib/start-checkout");
const {
  handleBillingMethodProbe,
  isSafeReadMethod,
  isStripeWebhookPath,
  writeAuthPage,
} = require("../lib/replit-billing");

function req(host, { proto, url = "/", forwardedHost } = {}) {
  return {
    url,
    headers: {
      host,
      ...(proto ? { "x-forwarded-proto": proto } : {}),
      ...(forwardedHost ? { "x-forwarded-host": forwardedHost } : {}),
    },
  };
}

test("publicUrl keeps Stripe returns on the apex even when the request is www", () => {
  assert.equal(publicUrl(req("www.thedispatch.uk", { proto: "https" })), PUBLIC_ORIGIN);
  assert.equal(publicUrl(req("thedispatch.uk", { proto: "https" })), PUBLIC_ORIGIN);
});

test("publicUrl ignores REPLIT_DOMAINS once the request is already on Dispatch", () => {
  const env = { REPLIT_DOMAINS: "www.thedispatch.uk,thedispatch.example.replit.app" };
  assert.equal(
    publicUrl(req("thedispatch.uk", { proto: "https" }), { env }),
    PUBLIC_ORIGIN,
  );
});

test("publicUrl uses the live request host for Replit preview, not a stale first domain", () => {
  const env = { REPLIT_DOMAINS: "stale.example.replit.app" };
  assert.equal(
    publicUrl(req("fresh.example.replit.app", { proto: "https" }), { env }),
    "https://fresh.example.replit.app",
  );
});

test("canonical redirect sends www POST/GET to apex without dropping the query", () => {
  assert.equal(
    canonicalRedirectLocation(req("www.thedispatch.uk", { url: "/?checkout=1" })),
    "https://thedispatch.uk/?checkout=1",
  );
  assert.equal(canonicalRedirectLocation(req("thedispatch.uk", { url: "/?checkout=1" })), null);
});

test("writeCanonicalRedirect issues 308 for www and is a no-op on apex", () => {
  const headers = {};
  let status = 0;
  const res = {
    writeHead(code, extra) {
      status = code;
      Object.assign(headers, extra);
    },
    end() {},
  };
  assert.equal(writeCanonicalRedirect(req("www.thedispatch.uk", { url: "/__auth/subscribe" }), res), true);
  assert.equal(status, 308);
  assert.equal(headers.Location, "https://thedispatch.uk/__auth/subscribe");

  assert.equal(writeCanonicalRedirect(req("thedispatch.uk"), { writeHead() {}, end() {} }), false);
});

test("session cookies are Secure and shared across apex/www on production hosts", () => {
  const apex = sessionCookieHeader("tok_apex", req("thedispatch.uk", { proto: "https" }));
  const www = sessionCookieHeader("tok_www", req("www.thedispatch.uk", { proto: "https" }));
  for (const header of [apex, www]) {
    assert.match(header, /HttpOnly/);
    assert.match(header, /SameSite=Lax/);
    assert.match(header, /Secure/);
    assert.match(header, /Domain=thedispatch\.uk/);
    assert.match(header, /Max-Age=2592000/);
  }
  assert.match(accountCreatedCookieHeader(req("thedispatch.uk", { proto: "https" })), /Secure/);
  assert.match(clearSessionCookieHeader(req("thedispatch.uk", { proto: "https" })), /Max-Age=0/);
});

test("preview hosts keep a host-only cookie so Replit sessions do not leak to production", () => {
  const header = sessionCookieHeader("tok_preview", req("workspace-user.replit.app", { proto: "https" }));
  assert.match(header, /Secure/);
  assert.doesNotMatch(header, /Domain=/);
});

test("appendSetCookie preserves the session cookie when adding the signup marker", () => {
  const headers = {};
  const res = {
    getHeader(name) { return headers[name]; },
    setHeader(name, value) { headers[name] = value; },
  };
  appendSetCookie(res, sessionCookieHeader("abc", req("thedispatch.uk", { proto: "https" })));
  appendSetCookie(res, accountCreatedCookieHeader(req("thedispatch.uk", { proto: "https" })));
  assert.equal(headers["Set-Cookie"].length, 2);
  assert.match(headers["Set-Cookie"][0], /dispatch_session=abc/);
  assert.match(headers["Set-Cookie"][1], /dispatch_account_created=1/);
});

test("static allowlist serves the terminal assets and hides server/source files", () => {
  assert.equal(isServableStaticPath("/app.js"), true);
  assert.equal(isServableStaticPath("/styles.css"), true);
  assert.equal(isServableStaticPath("/logo-mark.svg"), true);
  assert.equal(isBlockedSourcePath("/server.js"), true);
  assert.equal(isBlockedSourcePath("/stripeClient.js"), true);
  assert.equal(isServableStaticPath("/server.js"), false);
  assert.equal(isServableStaticPath("/.replit"), false);
  assert.equal(isServableStaticPath("/package.json"), false);
  assert.equal(isServableStaticPath("/test/auth.integration.test.js"), false);
});

test("billing probes return 405 instead of a false-missing 404", () => {
  const seen = {};
  const res = {
    setHeader(name, value) { seen[name] = value; },
  };
  const json = (response, status, body) => {
    seen.status = status;
    seen.body = body;
  };
  assert.equal(handleBillingMethodProbe({ method: "GET" }, res, "/api/create-checkout", json), true);
  assert.equal(seen.status, 405);
  assert.equal(seen.Allow, "POST");
  assert.equal(handleBillingMethodProbe({ method: "POST" }, res, "/api/create-checkout", json), false);
  assert.equal(handleBillingMethodProbe({ method: "HEAD" }, res, "/api/billing-portal", json), true);
});

test("webhook path accepts the live route and the health-check alias", () => {
  assert.equal(isStripeWebhookPath("/api/stripe/webhook"), true);
  assert.equal(isStripeWebhookPath("/api/stripe-webhook"), true);
  assert.equal(isStripeWebhookPath("/api/webhooks/stripe"), false);
});

test("auth pages treat HEAD as a safe read so health checks do not 404", () => {
  assert.equal(isSafeReadMethod("HEAD"), true);
  const res = new class extends EventEmitter {
    writeHead(status, headers) { this.status = status; this.headers = headers; }
    end(body) { this.body = body; }
  };
  writeAuthPage(res, "Premium · The Dispatch", "<h1>PREMIUM ACCESS</h1>", { method: "HEAD" });
  assert.equal(res.status, 200);
  assert.equal(res.body, undefined);
});

test("startCheckout always includes cookies and reuses /api/me checkout on 401", async () => {
  const calls = [];
  const assigned = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url === "/api/create-checkout") {
      return { status: 401, json: async () => ({ error: "Sign in before starting checkout." }) };
    }
    return {
      ok: true,
      json: async () => ({
        id: "user-1",
        checkoutSession: { url: "https://checkout.stripe.test/reuse" },
      }),
    };
  };

  const result = await startCheckout({
    fetchImpl,
    locationAssign: url => assigned.push(url),
    track() {},
  });

  assert.equal(calls[0].init.credentials, "include");
  assert.equal(calls[1].url, "/api/me");
  assert.equal(calls[1].init.credentials, "include");
  assert.deepEqual(result, {
    ok: true,
    url: "https://checkout.stripe.test/reuse",
    reused: true,
  });
  assert.deepEqual(assigned, ["https://checkout.stripe.test/reuse"]);
});

test("startCheckout does not bounce a signed-in member back to subscribe", async () => {
  const assigned = [];
  const result = await startCheckout({
    fetchImpl: async url => {
      if (url === "/api/create-checkout") {
        return { status: 401, json: async () => ({ error: "Sign in before starting checkout." }) };
      }
      return { ok: true, json: async () => ({ id: "user-1", checkoutSession: null }) };
    },
    locationAssign: url => assigned.push(url),
  });
  assert.equal(result.signedIn, true);
  assert.deepEqual(assigned, []);
});

test("startCheckout sends guests to subscribe only after /api/me has no session", async () => {
  const assigned = [];
  const result = await startCheckout({
    fetchImpl: async url => {
      if (url === "/api/create-checkout") {
        return { status: 401, json: async () => ({ error: "Sign in before starting checkout." }) };
      }
      return { ok: true, json: async () => ({ tier: "free", billingPortal: false }) };
    },
    locationAssign: url => assigned.push(url),
    track() {},
  });
  assert.equal(result.redirect, "/__auth/subscribe");
  assert.deepEqual(assigned, ["/__auth/subscribe"]);
});
