#!/usr/bin/env bash
set -euo pipefail

REQUIRED_NODE_MAJOR=22

check_command() {
  if ! command -v "$1" &>/dev/null; then
    echo "Error: '$1' is required but not found in PATH." >&2
    exit 1
  fi
}

check_node_version() {
  local version
  version=$(node --version | sed 's/v//')
  local major
  major=$(echo "$version" | cut -d. -f1)
  if [ "$major" -lt "$REQUIRED_NODE_MAJOR" ]; then
    echo "Error: Node.js >= $REQUIRED_NODE_MAJOR is required (found $version)." >&2
    exit 1
  fi
}

echo "==> Checking prerequisites..."
check_command node
check_command npm
check_node_version

echo "==> Installing dependencies..."
npm install

echo ""
echo "Setup complete. Available commands:"
echo "  npm run dev      – start local dev server at localhost:4321"
echo "  npm run build    – build for production"
echo "  npm run preview  – preview the production build locally"
echo "  npm run deploy   – deploy to Cloudflare Workers"
