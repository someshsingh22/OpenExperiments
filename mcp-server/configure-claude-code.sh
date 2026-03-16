#!/bin/bash

# Quick setup script for Claude Code
# Run with: bash configure-claude-code.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_PATH="$SCRIPT_DIR/dist/index.js"

if [ ! -f "$DIST_PATH" ]; then
  echo "❌ Error: dist/index.js not found"
  echo "Run 'npm run build' first"
  exit 1
fi

echo "📦 Adding OpenExperiments MCP server to Claude Code..."
echo "   Path: $DIST_PATH"
echo ""

# Check if claude CLI is available
if ! command -v claude &> /dev/null; then
  echo "❌ Error: 'claude' command not found"
  echo "Make sure Claude Code is installed and in your PATH"
  exit 1
fi

# Add the MCP server
claude mcp add openexperiments node "$DIST_PATH"

echo ""
echo "✅ Done! The MCP server is now configured."
echo ""
echo "To verify:"
echo "  claude mcp list"
echo ""
echo "To test in a conversation:"
echo "  Ask Claude to 'use platform_overview to show stats'"
