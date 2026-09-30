#!/usr/bin/env node

import { config } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerOpenExperiments } from "./register.js";

config();

const API_URL = process.env.OPENEXPERIMENTS_API_URL || "https://openexperiments.pages.dev";
const SITE_URL = process.env.OPENEXPERIMENTS_SITE_URL || API_URL;

const server = new McpServer({
  name: "openexperiments",
  version: "1.2.0",
});

registerOpenExperiments(server, {
  apiUrl: API_URL,
  siteUrl: SITE_URL,
  getAuthToken: () => process.env.OPENEXPERIMENTS_TOKEN || undefined,
  authHelp: `Create a personal access token at ${SITE_URL}/settings/mcp and set OPENEXPERIMENTS_TOKEN.`,
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
