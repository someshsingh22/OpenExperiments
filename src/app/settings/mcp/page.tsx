export const runtime = "edge";

import type { Metadata } from "next";
import { McpSettingsClient } from "@/components/mcp-settings-client";

export const metadata: Metadata = {
  title: "AI / MCP access",
  description: "Connect AI assistants to OpenExperiments and manage MCP access tokens.",
  robots: { index: false, follow: false },
};

export default function McpSettingsPage() {
  return <McpSettingsClient />;
}
