"use strict";

const path = require("path");

const PUBLIC_STATIC_PATHS = new Set([
  "/app.js",
  "/styles.css",
  "/logo-mark.svg",
  "/og-card.png",
  "/og-card.svg",
  "/manifest.json",
  "/robots.txt",
]);

const PUBLIC_STATIC_PREFIXES = ["/fonts/", "/images/", "/icons/"];

const BLOCKED_BASENAMES = new Set([
  "server.js",
  "stripeclient.js",
  "marketproxy.js",
  "rssfeeds.js",
  "recoverysendercheck.js",
  "openbbadapter.js",
  "openbbruntime.js",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  ".replit",
  "replit.md",
]);

function normalizedPathname(pathname) {
  const raw = String(pathname || "/");
  const noQuery = raw.split("?")[0];
  try {
    return decodeURIComponent(noQuery);
  } catch {
    return noQuery;
  }
}

function isBlockedSourcePath(pathname) {
  const base = path.posix.basename(normalizedPathname(pathname)).toLowerCase();
  if (BLOCKED_BASENAMES.has(base)) return true;
  if (base.endsWith(".map")) return true;
  const rel = normalizedPathname(pathname);
  if (rel.startsWith("/test/") || rel.startsWith("/scripts/") || rel.startsWith("/story/")) return true;
  if (rel.startsWith("/.") && rel !== "/") return true;
  return false;
}

function isServableStaticPath(pathname) {
  const rel = normalizedPathname(pathname);
  if (isBlockedSourcePath(rel)) return false;
  if (PUBLIC_STATIC_PATHS.has(rel)) return true;
  return PUBLIC_STATIC_PREFIXES.some(prefix => rel.startsWith(prefix));
}

function resolveStaticFile(root, pathname) {
  const requested = normalizedPathname(pathname) === "/" ? "/index.html" : normalizedPathname(pathname);
  if (!isServableStaticPath(requested)) return null;
  const file = path.normalize(path.join(root, requested));
  const rootDir = path.normalize(root);
  if (!file.startsWith(rootDir)) return null;
  return file;
}

module.exports = {
  BLOCKED_BASENAMES,
  PUBLIC_STATIC_PATHS,
  isBlockedSourcePath,
  isServableStaticPath,
  resolveStaticFile,
};
