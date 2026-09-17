import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOpenExperiments } from "@openexperiments/mcp-server/register";
import app from "./app-handler";

export interface Env {
  OPENEXPERIMENTS_API_URL: string;
  MCP_SERVER_SECRET: string;
  OAUTH_KV: KVNamespace;
  MCP_AGENT: DurableObjectNamespace;
}

type Props = {
  userId: string;
  appToken: string;
};

export class OpenExperimentsMCP extends McpAgent<Env, unknown, Props> {
  server = new McpServer({ name: "openexperiments", version: "1.0.0" });

  async init() {
    const apiUrl = this.env.OPENEXPERIMENTS_API_URL;
    registerOpenExperiments(this.server, {
      apiUrl,
      siteUrl: apiUrl,
      getAuthToken: () => this.props?.appToken,
    });
  }
}

export default new OAuthProvider<Env>({
  apiRoute: "/sse",
  apiHandler: OpenExperimentsMCP.mount("/sse", { binding: "MCP_AGENT" }),
  defaultHandler: app,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
