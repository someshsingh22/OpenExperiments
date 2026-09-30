#!/bin/bash

# Quick setup script for Claude Code
# Optional env before running:
#   OPENEXPERIMENTS_API_URL=http://localhost:3000 OPENEXPERIMENTS_SITE_URL=http://localhost:3000 OPENEXPERIMENTS_TOKEN=oe_pat_... bash configure-claude-code.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_PATH="$SCRIPT_DIR/dist/index.js"

if [ ! -f "$DIST_PATH" ]; then
  echo "❌ Error: dist/index.js not found"
  echo "Run 'npm run build' first"
  exit 1
fi

if ! command -v claude &> /dev/null; then
  echo "❌ Error: 'claude' command not found"
  echo "Make sure Claude Code is installed and in your PATH"
  exit 1
fi

API_URL="${OPENEXPERIMENTS_API_URL:-https://openexperiments.pages.dev}"
SITE_URL="${OPENEXPERIMENTS_SITE_URL:-$API_URL}"

if [ -n "${OPENEXPERIMENTS_TOKEN:-}" ]; then
  echo "📦 Adding OpenExperiments MCP server to Claude Code with OPENEXPERIMENTS_TOKEN..."
  claude mcp add openexperiments env \
    "OPENEXPERIMENTS_API_URL=$API_URL" \
    "OPENEXPERIMENTS_SITE_URL=$SITE_URL" \
    "OPENEXPERIMENTS_TOKEN=$OPENEXPERIMENTS_TOKEN" \
    node "$DIST_PATH"
else
  echo "📦 Adding OpenExperiments MCP server to Claude Code (read-only unless token is added later)..."
  claude mcp add openexperiments env \
    "OPENEXPERIMENTS_API_URL=$API_URL" \
    "OPENEXPERIMENTS_SITE_URL=$SITE_URL" \
    node "$DIST_PATH"
fi

echo ""
echo "✅ Done! Verify with: claude mcp list"
echo "Token setup: create one at $SITE_URL/settings/mcp and rerun with OPENEXPERIMENTS_TOKEN=..."
