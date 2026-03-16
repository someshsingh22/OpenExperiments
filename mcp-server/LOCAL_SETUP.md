# Local Development Setup

This guide shows how to configure the MCP server to work with your local Next.js dev server.

## 1. Start Your Local API

```bash
# In the main project directory
npm run dev
```

Your API will be at `http://localhost:3000`.

## 2. MCP Server is Already Configured

The `.env` file in this directory points to `localhost:3000` by default:

```bash
OPENEXPERIMENTS_API_URL=http://localhost:3000
OPENEXPERIMENTS_SITE_URL=http://localhost:3000
```

You can change these URLs anytime by editing `mcp-server/.env`.

## 3. Configure Claude

### Option A: Claude Desktop

**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "openexperiments": {
      "command": "node",
      "args": ["/Users/someshsingh/Github/OpenExperiments/mcp-server/dist/index.js"]
    }
  }
}
```

**Important:** Replace the path with your actual absolute path to `dist/index.js`.

Then **restart Claude Desktop** completely (quit and reopen).

### Option B: Claude Code (this CLI)

Run this command from anywhere:

```bash
claude mcp add openexperiments node /Users/someshsingh/Github/OpenExperiments/mcp-server/dist/index.js
```

Or manually add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "openexperiments": {
      "command": "node",
      "args": ["/Users/someshsingh/Github/OpenExperiments/mcp-server/dist/index.js"]
    }
  }
}
```

## 4. Verify It Works

### In Claude Desktop

Look for the 🔌 icon in the bottom toolbar. Click it to see available MCP servers. You should see `openexperiments` with 10 tools.

### In Claude Code

```bash
claude mcp list
```

Should show `openexperiments` as enabled.

### Test a Tool

Ask Claude:

```
Use the platform_overview tool to show me OpenExperiments stats
```

If it works, you'll see hypothesis counts, problem statements, datasets, etc. from your local database.

## 5. Switch to Production Later

When you want to test against production instead of localhost:

**Option 1:** Edit `mcp-server/.env`:

```bash
OPENEXPERIMENTS_API_URL=https://openexperiments.pages.dev
OPENEXPERIMENTS_SITE_URL=https://openexperiments.pages.dev
```

**Option 2:** Override in Claude config with `env`:

```json
{
  "mcpServers": {
    "openexperiments": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "OPENEXPERIMENTS_API_URL": "https://openexperiments.pages.dev"
      }
    }
  }
}
```

The `env` in the config takes precedence over the `.env` file.

## Troubleshooting

### "Cannot reach OpenExperiments API"

1. Make sure `npm run dev` is running in the main project
2. Verify `http://localhost:3000/api/hypotheses` returns JSON in your browser
3. Check the URL in `mcp-server/.env` is correct

### "Command not found: node"

The `node` binary needs to be in your PATH. Find the full path:

```bash
which node
```

Then use that path in the MCP config instead of just `node`.

### Changes not reflecting

1. Rebuild after code changes: `npm run build`
2. Restart Claude Desktop (for Desktop users)
3. Restart the CLI session (for Claude Code users)

### MCP server not showing in Claude Desktop

1. Make sure the path to `dist/index.js` is **absolute** (not relative)
2. Check the JSON syntax in `claude_desktop_config.json` is valid
3. View logs: `tail -f ~/Library/Logs/Claude/mcp*.log`
