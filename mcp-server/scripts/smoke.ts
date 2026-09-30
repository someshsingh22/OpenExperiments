import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOpenExperiments } from "../src/register.js";

const apiUrl = process.env.OPENEXPERIMENTS_API_URL || "http://localhost:3000";
const siteUrl = process.env.OPENEXPERIMENTS_SITE_URL || apiUrl;
const token = process.env.OPENEXPERIMENTS_TOKEN || undefined;

const server = new McpServer({ name: "openexperiments-smoke", version: "1.2.0" });
registerOpenExperiments(server, {
  apiUrl,
  siteUrl,
  getAuthToken: () => token,
  authHelp: `Create a personal access token at ${siteUrl}/settings/mcp and set OPENEXPERIMENTS_TOKEN.`,
});

const client = new Client({ name: "openexperiments-smoke", version: "1.0.0" });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

function text(result: { content?: Array<{ type: string; text?: string }> }): string {
  return result.content?.map((c) => c.text ?? "").join("\n") ?? "";
}

async function main() {
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const calls: Array<[string, Record<string, unknown>]> = [
    ["whoami", {}],
    ["platform_overview", {}],
    ["list_problem_statements", {}],
    ["list_datasets", {}],
    ["browse_hypotheses", { limit: 5 }],
    ["get_arena_rankings", {}],
    ["get_arena_matchup", {}],
    ["list_experiments", { limit: 5 }],
  ];

  const ids: Record<string, string | undefined> = {};
  let failures = 0;
  for (const [name, args] of calls) {
    try {
      const result = await client.callTool({ name, arguments: args });
      const body = text(result);
      if (result.isError) {
        failures += 1;
        console.log(`FAIL ${name}: ${body.split("\n")[0]}`);
      } else {
        console.log(`PASS ${name}`);
        if (name === "list_datasets") ids.dataset = body.match(/\((ds-[^)]+)\)/)?.[1];
        if (name === "browse_hypotheses") ids.hypothesis = body.match(/### ([^:]+):/)?.[1];
        if (name === "list_experiments") ids.experiment = body.match(/## ([^ ]+) —/)?.[1];
      }
    } catch (err) {
      failures += 1;
      console.log(`FAIL ${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const followups: Array<[string, Record<string, unknown>]> = [];
  if (ids.dataset) followups.push(["get_dataset", { datasetId: ids.dataset }]);
  if (ids.hypothesis) {
    followups.push(["get_hypothesis", { hypothesisId: ids.hypothesis }]);
    followups.push(["list_comments", { hypothesisId: ids.hypothesis }]);
    followups.push(["get_star_status", { hypothesisId: ids.hypothesis }]);
  }
  if (ids.experiment) followups.push(["get_experiment", { experimentId: ids.experiment }]);

  for (const [name, args] of followups) {
    try {
      const result = await client.callTool({ name, arguments: args });
      if (result.isError) {
        failures += 1;
        console.log(`FAIL ${name}: ${text(result).split("\n")[0]}`);
      } else {
        console.log(`PASS ${name}`);
      }
    } catch (err) {
      failures += 1;
      console.log(`FAIL ${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (failures > 0) {
    console.log(`Smoke failed: ${failures} failure(s)`);
    process.exitCode = 1;
  } else {
    console.log("Smoke passed");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
