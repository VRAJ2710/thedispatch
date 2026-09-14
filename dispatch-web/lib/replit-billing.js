"use strict";

const {
  PUBLIC_ORIGIN,
  canonicalRedirectLocation,
  publicUrl,
  writeCanonicalRedirect,
} = require("./billing-origin");
const {
  accountCreatedCookieHeader,
  appendSetCookie,
  clearSessionCookieHeader,
  sessionCookieHeader,
} = require("./session-cookie");
const { isServableStaticPath, resolveStaticFile } = require("./static-allowlist");

function isStripeWebhookPath(pathname) {
  return pathname === "/api/stripe/webhook" || pathname === "/api/stripe-webhook";
}

const BILLING_POST_ONLY = new Set(["/api/create-checkout", "/api/billing-portal"]);
const AUTH_PAGE_PATHS = new Set([
  "/__auth/login",
  "/__auth/register",
  "/__auth/subscribe",
  "/__auth/logout",
  "/__auth/recover",
  "/__auth/reset",
]);

function isSafeReadMethod(method) {
  return method === "GET" || method === "HEAD";
}

function writeAuthPage(res, title, content, { method } = {}) {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
  <style>body{margin:0;background:#0b1018;color:#e8edf3;font:16px system-ui;display:grid;place-items:center;min-height:100vh}
  main{width:min(420px,calc(100% - 40px));background:#111a26;border:1px solid #293849;border-radius:14px;padding:28px;box-sizing:border-box}
  h1{font-size:22px;margin:0 0 8px;color:#f5a623}p{color:#9baabb;line-height:1.5}label{display:block;color:#b8c4d2;font-size:13px;margin:16px 0 6px}
  input{width:100%;box-sizing:border-box;padding:11px;background:#0b1018;color:#fff;border:1px solid #3a4a5d;border-radius:7px}
  button,a{display:inline-block;margin-top:20px;padding:11px 16px;border:0;border-radius:7px;background:#f5a623;color:#111;font-weight:700;text-decoration:none;cursor:pointer}
  .muted{font-size:12px;color:#718096}</style></head><body><main>${content}</main></body></html>`;
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(method === "HEAD" ? undefined : html);
}

function handleBillingMethodProbe(req, res, pathname, json) {
  if (!BILLING_POST_ONLY.has(pathname) || req.method === "POST") return false;
  res.setHeader("Allow", "POST");
  json(res, 405, { error: "Method not allowed." });
  return true;
}

module.exports = {
  AUTH_PAGE_PATHS,
  BILLING_POST_ONLY,
  PUBLIC_ORIGIN,
  accountCreatedCookieHeader,
  appendSetCookie,
  canonicalRedirectLocation,
  clearSessionCookieHeader,
  handleBillingMethodProbe,
  isSafeReadMethod,
  isServableStaticPath,
  isStripeWebhookPath,
  publicUrl,
  resolveStaticFile,
  sessionCookieHeader,
  writeAuthPage,
  writeCanonicalRedirect,
};
