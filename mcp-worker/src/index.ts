import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOpenExperiments } from "@openexperiments/mcp-server/register";
import app, { AUTH_HELP } from "./app-handler";

export interface Env {
  OPENEXPERIMENTS_API_URL: string;
  OPENEXPERIMENTS_SITE_URL?: string;
  MCP_SERVER_SECRET: string;
  OAUTH_KV: KVNamespace;
  MCP_AGENT: DurableObjectNamespace;
}

type Props = {
  userId: string;
  appToken: string;
};

type OpenExperimentsRegisterOptions = Parameters<
  typeof registerOpenExperiments
>[1] & {
  authHelp?: string;
};

export class OpenExperimentsMCP extends McpAgent<Env, unknown, Props> {
  server = new McpServer({ name: "openexperiments", version: "1.2.0" });

  async init() {
    const apiUrl = this.env.OPENEXPERIMENTS_API_URL;
    const registerOptions: OpenExperimentsRegisterOptions = {
      apiUrl,
      siteUrl: this.env.OPENEXPERIMENTS_SITE_URL || apiUrl,
      getAuthToken: () => this.props?.appToken,
      authHelp: AUTH_HELP,
    };
    registerOpenExperiments(this.server, registerOptions);
  }
}

const mcpHandler = OpenExperimentsMCP.serve("/mcp", {
  binding: "MCP_AGENT",
});
const sseHandler = OpenExperimentsMCP.serveSSE("/sse", {
  binding: "MCP_AGENT",
});

export default new OAuthProvider<Env>({
  apiHandlers: {
    "/mcp": mcpHandler,
    "/sse": sseHandler,
  },
  defaultHandler: app,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  allowPlainPKCE: false,
  scopesSupported: ["openexperiments"],
  resourceMetadata: {
    resource_name: "OpenExperiments MCP Connector",
    scopes_supported: ["openexperiments"],
    bearer_methods_supported: ["header"],
  },
});
