#!/bin/bash

# Quick setup helper for Claude Desktop. Prints JSON to paste into config.
# Optional env before running:
#   OPENEXPERIMENTS_API_URL=http://localhost:3000 OPENEXPERIMENTS_SITE_URL=http://localhost:3000 OPENEXPERIMENTS_TOKEN=oe_pat_... bash configure-claude-desktop.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_PATH="$SCRIPT_DIR/dist/index.js"

if [ ! -f "$DIST_PATH" ]; then
  echo "❌ Error: dist/index.js not found"
  echo "Run 'npm run build' first"
  exit 1
fi

if [[ "$OSTYPE" == "darwin"* ]]; then
  CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  CONFIG_PATH="$HOME/.config/Claude/claude_desktop_config.json"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
  CONFIG_PATH="$APPDATA/Claude/claude_desktop_config.json"
else
  CONFIG_PATH="<path to claude_desktop_config.json>"
fi

API_URL="${OPENEXPERIMENTS_API_URL:-https://openexperiments.pages.dev}"
SITE_URL="${OPENEXPERIMENTS_SITE_URL:-$API_URL}"
TOKEN="${OPENEXPERIMENTS_TOKEN:-oe_pat_...}"

echo "📦 OpenExperiments MCP Server Configuration"
echo "MCP Server Path: $DIST_PATH"
echo "Claude Desktop Config: $CONFIG_PATH"
echo ""
echo "Add/merge this JSON:"
echo ""
cat <<JSON
{
  "mcpServers": {
    "openexperiments": {
      "command": "node",
      "args": ["$DIST_PATH"],
      "env": {
        "OPENEXPERIMENTS_API_URL": "$API_URL",
        "OPENEXPERIMENTS_SITE_URL": "$SITE_URL",
        "OPENEXPERIMENTS_TOKEN": "$TOKEN"
      }
    }
  }
}
JSON
echo ""
echo "Create a token at $SITE_URL/settings/mcp. Omit OPENEXPERIMENTS_TOKEN for read-only use."
