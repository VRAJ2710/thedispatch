"use strict";

/**
 * Canonical public site for The Dispatch Markets.
 * Live currently serves both https://thedispatch.uk and https://www.thedispatch.uk
 * without a redirect. Session cookies are host-only, so a signup on apex loses
 * its session if Stripe returns the browser to www (or the reverse).
 */
const PUBLIC_ORIGIN = "https://thedispatch.uk";
const PUBLIC_HOSTS = new Set(["thedispatch.uk", "www.thedispatch.uk"]);

function headerFirst(value) {
  return String(value || "").split(",")[0].trim();
}

function requestHost(req) {
  const headers = req?.headers || {};
  return headerFirst(headers["x-forwarded-host"]) || headerFirst(headers.host);
}

function requestProtocol(req) {
  const forwarded = headerFirst(req?.headers?.["x-forwarded-proto"]);
  if (forwarded === "https" || forwarded === "http") return forwarded;
  return "http";
}

function hostnameOf(host) {
  return String(host || "").split(":")[0].toLowerCase();
}

function isPublicDispatchHost(host) {
  return PUBLIC_HOSTS.has(hostnameOf(host));
}

/**
 * Stripe success/cancel/portal return URLs must land on the same registrable
 * site that holds the session cookie. Never prefer REPLIT_DOMAINS over an
 * already-canonical Dispatch host — production sets DISPATCH_PUBLIC_ORIGIN to
 * www while users browse the apex.
 */
function publicUrl(req, options = {}) {
  const publicOrigin = options.publicOrigin || PUBLIC_ORIGIN;
  const port = options.port || process.env.PORT || 5000;
  const env = options.env || process.env;
  const host = requestHost(req);
  if (isPublicDispatchHost(host)) return publicOrigin.replace(/\/$/, "");

  const protocol = requestProtocol(req) === "https" ? "https" : "http";
  if (host) return `${protocol}://${host}`;

  const previewDomain = String(env.REPLIT_DOMAINS || "").split(",")[0].trim();
  if (previewDomain) return `https://${previewDomain}`;
  return `${protocol}://localhost:${port}`;
}

function canonicalRedirectLocation(req, publicOrigin = PUBLIC_ORIGIN) {
  if (hostnameOf(requestHost(req)) !== "www.thedispatch.uk") return null;
  const origin = publicOrigin.replace(/\/$/, "");
  try {
    const url = new URL(req.url || "/", origin);
    return `${origin}${url.pathname}${url.search}`;
  } catch {
    return origin + "/";
  }
}

function writeCanonicalRedirect(req, res, publicOrigin = PUBLIC_ORIGIN) {
  const location = canonicalRedirectLocation(req, publicOrigin);
  if (!location) return false;
  res.writeHead(308, { Location: location, "Cache-Control": "no-store" });
  res.end();
  return true;
}

module.exports = {
  PUBLIC_ORIGIN,
  PUBLIC_HOSTS,
  canonicalRedirectLocation,
  isPublicDispatchHost,
  publicUrl,
  requestHost,
  requestProtocol,
  writeCanonicalRedirect,
};
