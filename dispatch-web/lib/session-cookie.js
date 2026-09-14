"use strict";

const { isPublicDispatchHost, requestHost, requestProtocol } = require("./billing-origin");

function useSecureCookie(req) {
  return requestProtocol(req) === "https" || isPublicDispatchHost(requestHost(req));
}

function cookieFlags(req, { maxAge, clear = false } = {}) {
  const parts = ["Path=/", "HttpOnly", "SameSite=Lax"];
  parts.push(clear ? "Max-Age=0" : `Max-Age=${maxAge ?? 2592000}`);
  if (useSecureCookie(req)) parts.push("Secure");
  // Share the session across apex and www. Preview/Replit hosts stay host-only.
  if (isPublicDispatchHost(requestHost(req))) parts.push("Domain=thedispatch.uk");
  return parts;
}

function sessionCookieHeader(token, req) {
  return [`dispatch_session=${token}`, ...cookieFlags(req)].join("; ");
}

function clearSessionCookieHeader(req) {
  return ["dispatch_session=", ...cookieFlags(req, { clear: true })].join("; ");
}

function accountCreatedCookieHeader(req) {
  const parts = ["dispatch_account_created=1", "Path=/", "SameSite=Lax", "Max-Age=120"];
  if (useSecureCookie(req)) parts.push("Secure");
  if (isPublicDispatchHost(requestHost(req))) parts.push("Domain=thedispatch.uk");
  return parts.join("; ");
}

function appendSetCookie(res, value) {
  const current = res.getHeader("Set-Cookie");
  if (!current) {
    res.setHeader("Set-Cookie", value);
    return;
  }
  const list = Array.isArray(current) ? current : [current];
  res.setHeader("Set-Cookie", [...list, value]);
}

module.exports = {
  accountCreatedCookieHeader,
  appendSetCookie,
  clearSessionCookieHeader,
  cookieFlags,
  sessionCookieHeader,
  useSecureCookie,
};
