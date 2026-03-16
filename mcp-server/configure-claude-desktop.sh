#!/bin/bash

# Quick setup helper for Claude Desktop
# Run with: bash configure-claude-desktop.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_PATH="$SCRIPT_DIR/dist/index.js"

if [ ! -f "$DIST_PATH" ]; then
  echo "❌ Error: dist/index.js not found"
  echo "Run 'npm run build' first"
  exit 1
fi

# Detect config path based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
  CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  CONFIG_PATH="$HOME/.config/Claude/claude_desktop_config.json"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
  CONFIG_PATH="$APPDATA/Claude/claude_desktop_config.json"
else
  echo "⚠️  Unknown OS type: $OSTYPE"
  CONFIG_PATH="<path to claude_desktop_config.json>"
fi

echo "📦 OpenExperiments MCP Server Configuration"
echo ""
echo "MCP Server Path:"
echo "  $DIST_PATH"
echo ""
echo "Claude Desktop Config:"
echo "  $CONFIG_PATH"
echo ""
echo "Add this to your claude_desktop_config.json:"
echo ""
echo "{"
echo "  \"mcpServers\": {"
echo "    \"openexperiments\": {"
echo "      \"command\": \"node\","
echo "      \"args\": ["
echo "        \"$DIST_PATH\""
echo "      ]"
echo "    }"
echo "  }"
echo "}"
echo ""
echo "📝 Steps:"
echo "  1. Open the config file in your editor"
echo "  2. Add the configuration above (merge with existing mcpServers if present)"
echo "  3. Save the file"
echo "  4. Quit and restart Claude Desktop completely"
echo ""
echo "To open the config file now:"
echo "  open \"$CONFIG_PATH\""
