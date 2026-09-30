import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOpenExperiments } from "../src/register.js";

interface RecordedRequest {
  method: string;
  path: string;
  auth?: string;
  body?: unknown;
}

let httpServer: Server;
let apiUrl = "";
let requests: RecordedRequest[] = [];
let starState = false;

const hypothesis = {
  id: "h-1",
  statement: "Warm colors increase memorability.",
  rationale: "Prior visual attention work suggests saturated warm colors are salient.",
  source: "human",
  agentName: null,
  domain: ["memorability"],
  problemStatement: "What makes images memorable?",
  status: "proposed",
  phase: "live",
  submittedAt: "2026-01-01",
  arenaElo: 1400,
  evidenceScore: null,
  pValue: null,
  effectSize: null,
  isAnonymous: false,
  submittedBy: "u-1",
  winRate: 55,
  commentCount: 1,
  experimentCount: 1,
  citationDois: [],
  relatedHypothesisIds: [],
};

const dataset = {
  id: "ds-1",
  name: "Reddit CMV",
  huggingfaceUrl: "https://huggingface.co/datasets/open/cmv",
  taskDescription: "Predict persuasion",
  dataColumnNames: ["text", "delta"],
  targetColumnName: "delta",
  description: "Arguments and outcomes.",
  domain: "persuasion",
  license: "CC BY 4.0",
  foreknowledgeStatus: "data_unobserved",
  unitOfAnalysis: "Root comment",
  osfCharacterization: {
    provenance: "Collected from Reddit posts after registration.",
    collectionProcedure: "Collect threads and root comments from a fixed period.",
    variables: "text is the argument; delta is whether view changed.",
    inclusionExclusion: "Exclude deleted posts and missing labels.",
    missingData: "Rows missing required fields are excluded.",
    tags: ["persuasion"],
  },
  createdAt: "2026-01-01",
  problemStatementCount: 1,
  experimentCount: 1,
};

const experiment = {
  id: "exp-1",
  hypothesisId: "h-1",
  problemStatementId: "ps-1",
  type: "observational",
  status: "planned",
  datasetId: "ds-1",
  datasetName: "Reddit CMV",
  methodology: "Run a regression over extracted color/sentiment features.",
  analysisPlan: "Pre-specify covariates and primary outcome.",
  submitter: { id: "u-1", name: "Ada", avatarUrl: null },
  startedAt: "2026-01-01",
  osfLink: "https://osf.io/abcd1",
  version: 1,
};

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : undefined;
}

function handler(req: IncomingMessage, res: ServerResponse) {
  void (async () => {
    const url = new URL(req.url ?? "/", "http://mock.local");
    const body = req.method === "POST" || req.method === "PATCH" ? await readBody(req) : undefined;
    requests.push({ method: req.method ?? "GET", path: `${url.pathname}${url.search}`, auth: req.headers.authorization, body });

    if (url.pathname.includes("401")) return send(res, 401, { error: "bad token" });
    if (url.pathname.includes("403")) return send(res, 403, { error: "profile incomplete" });
    if (url.pathname.includes("404")) return send(res, 404, { error: "missing" });
    if (url.pathname.includes("500")) return send(res, 500, { error: "boom" });

    if (url.pathname === "/api/auth/me" && req.headers.authorization === "Bearer revoked") return send(res, 200, { user: null });
    if (url.pathname === "/api/auth/me") return send(res, 200, { user: { id: "u-1", name: "Ada", email: "ada@example.edu", avatarUrl: null, profileCompleted: true } });
    if (url.pathname === "/api/problem-statements") return send(res, 200, { data: [{ id: "ps-1", question: "What makes images memorable?", description: "Image memory", domain: "memorability", hypothesisCount: 1, datasets: [{ id: "ds-1", name: "Reddit CMV", huggingfaceUrl: dataset.huggingfaceUrl }] }] });
    if (url.pathname === "/api/datasets" && req.method === "GET") return send(res, 200, { data: [dataset] });
    if (url.pathname === "/api/datasets" && req.method === "POST") return send(res, 201, { data: { id: "ds-new" } });
    if (url.pathname === "/api/datasets/ds-1") return send(res, 200, { data: dataset, problemStatements: [{ id: "ps-1", question: "What makes images memorable?", domain: "memorability", hypothesisCount: 1 }], experiments: [experiment] });
    if (url.pathname === "/api/hypotheses" && req.method === "GET") return send(res, 200, { data: [hypothesis], total: 1 });
    if (url.pathname === "/api/hypotheses" && req.method === "POST") return send(res, 201, { data: { id: "h-new" } });
    if (url.pathname === "/api/hypotheses/h-1") {
      if (req.method === "PATCH") return send(res, 200, { data: { citationDois: ["10.1234/example"] } });
      return send(res, 200, { data: hypothesis, experiments: [experiment], comments: [{ id: "c-1", hypothesisId: "h-1", body: "Great idea", doi: null, createdAt: "2026-01-02", parentId: null }] });
    }
    if (url.pathname === "/api/comments" && req.method === "GET") return send(res, 200, { data: [{ id: "c-1", hypothesisId: "h-1", body: "Great idea", doi: null, createdAt: "2026-01-02", parentId: null, author: { id: "u-1", name: "Ada", avatarUrl: null } }] });
    if (url.pathname === "/api/comments" && req.method === "POST") return send(res, 201, { data: { id: "c-new", hypothesisId: "h-1", body: "Comment", doi: null, createdAt: "2026-01-03", author: { id: "u-1", name: "Ada", avatarUrl: null } } });
    if (url.pathname === "/api/hypotheses/h-1/star") {
      if (req.method === "GET") return send(res, 200, { data: { count: starState ? 2 : 1, starred: starState } });
      starState = !starState;
      return send(res, 200, { data: { count: starState ? 2 : 1, starred: starState } });
    }
    if (url.pathname === "/api/arena/rankings") return send(res, 200, { data: [{ id: "h-1", statement: hypothesis.statement, domain: hypothesis.domain, winRate: 55 }] });
    if (url.pathname === "/api/arena/matchup") return send(res, 200, { data: { id: "m-1", totalVotes: 3, votesA: 1, votesB: 1, votesTie: 1, hypothesisA: { id: "h-1", statement: hypothesis.statement, domain: hypothesis.domain, arenaElo: 1400 }, hypothesisB: { id: "h-2", statement: "Faces improve memory.", domain: ["memorability"], arenaElo: 1390 } } });
    if (url.pathname === "/api/arena/vote") return send(res, 200, { data: { id: "m-1", totalVotes: 4, votesA: 2, votesB: 1, votesTie: 1 } });
    if (url.pathname === "/api/experiments" && req.method === "GET") return send(res, 200, { data: [experiment] });
    if (url.pathname === "/api/experiments" && req.method === "POST") return send(res, 201, { data: { id: "exp-new" } });
    if (url.pathname === "/api/experiments/exp-1") {
      if (req.method === "PATCH") return send(res, 200, { data: { id: "exp-1", version: 2 } });
      return send(res, 200, { data: experiment, hypothesis: { id: "h-1", statement: hypothesis.statement, status: "proposed", phase: "live", domains: ["memorability"] }, versions: [{ version: 1, status: "planned", methodology: experiment.methodology, analysisPlan: experiment.analysisPlan, osfLink: experiment.osfLink, changeSummary: "Initial submission", createdAt: "2026-01-01T00:00:00Z" }] });
    }
    if (url.pathname === "/api/users/u-1") {
      if (req.method === "PATCH") return send(res, 200, { ok: true });
      return send(res, 200, { data: { user: { id: "u-1", name: "Ada", email: "ada@example.edu", avatarUrl: null, affiliation: "Example", position: "Scientist", scholarUrl: null, website: null, bio: "Researcher", orcid: null, twitterHandle: null, joinedAt: "2026-01-01" }, hypotheses: [{ id: "h-1", statement: hypothesis.statement, status: "proposed", phase: "live", domain: ["memorability"], isAnonymous: false, submittedAt: "2026-01-01" }], starredHypotheses: [], stats: { hypothesisCount: 1, experimentCount: 1, commentCount: 1, voteCount: 1 }, isOwner: true } });
    }
    send(res, 404, { error: `Unhandled ${req.method} ${url.pathname}` });
  })().catch((err) => send(res, 500, { error: err instanceof Error ? err.message : "test error" }));
}

async function makeClient(token?: string, url = apiUrl) {
  const server = new McpServer({ name: "test-openexperiments", version: "1.2.0" });
  registerOpenExperiments(server, {
    apiUrl: url,
    siteUrl: "http://site.test",
    getAuthToken: () => token,
    authHelp: "AUTH HELP",
  });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

function text(result: { content?: Array<{ type: string; text?: string }> }): string {
  return result.content?.map((c) => c.text ?? "").join("\n") ?? "";
}

beforeEach(async () => {
  requests = [];
  starState = false;
  httpServer = createServer(handler);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const address = httpServer.address() as AddressInfo;
  apiUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => httpServer.close((err) => (err ? reject(err) : resolve())));
});

describe("OpenExperiments MCP registration", () => {
  it("lists all tools, prompts, resources, and annotations", async () => {
    const client = await makeClient("token-1");
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      "add_citation", "browse_hypotheses", "generate_submission_url", "get_arena_matchup", "get_arena_rankings", "get_dataset", "get_experiment", "get_hypothesis", "get_my_hypotheses", "get_star_status", "get_user_profile", "list_comments", "list_datasets", "list_experiments", "list_problem_statements", "platform_overview", "post_comment", "search_hypotheses", "star_hypothesis", "submit_dataset", "submit_experiment", "submit_hypothesis", "unstar_hypothesis", "update_experiment", "update_my_profile", "vote_arena", "whoami",
    ].sort());
    for (const tool of tools.tools) assert.ok(tool.annotations, `${tool.name} missing annotations`);
    assert.equal(tools.tools.find((t) => t.name === "list_datasets")?.annotations?.readOnlyHint, true);
    assert.equal(tools.tools.find((t) => t.name === "submit_hypothesis")?.annotations?.readOnlyHint, false);
    assert.equal(tools.tools.find((t) => t.name === "star_hypothesis")?.annotations?.idempotentHint, true);

    const prompts = await client.listPrompts();
    assert.deepEqual(prompts.prompts.map((p) => p.name).sort(), ["co-ideate", "design-experiment", "formulate-hypothesis", "review-arena"].sort());
    const resources = await client.listResources();
    assert.equal(resources.resources[0]?.uri, "openexperiments://guide");
    const templates = await client.listResourceTemplates();
    assert.equal(templates.resourceTemplates[0]?.uriTemplate, "openexperiments://hypothesis/{id}");
  });

  it("renders every read tool with fixture content and encodes query params", async () => {
    const client = await makeClient("token-1");
    const calls: Array<[string, Record<string, unknown>]> = [
      ["whoami", {}],
      ["platform_overview", {}],
      ["list_problem_statements", {}],
      ["list_datasets", { domain: "attention & memory" }],
      ["get_dataset", { datasetId: "ds-1" }],
      ["browse_hypotheses", { search: "warm colors", limit: 5 }],
      ["search_hypotheses", { query: "warm", domain: "memory space" }],
      ["get_hypothesis", { hypothesisId: "h-1" }],
      ["get_my_hypotheses", {}],
      ["list_comments", { hypothesisId: "h-1" }],
      ["get_star_status", { hypothesisId: "h-1" }],
      ["get_arena_rankings", {}],
      ["get_arena_matchup", {}],
      ["list_experiments", { hypothesisId: "h-1" }],
      ["get_experiment", { experimentId: "exp-1" }],
      ["get_user_profile", { userId: "u-1" }],
      ["generate_submission_url", { statement: "A sufficiently long hypothesis", rationale: "A sufficiently long rationale", customProblemStatement: "A new problem statement", domains: ["attention & memory"] }],
    ];
    for (const [name, args] of calls) {
      const result = await client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, `${name} should not error: ${text(result)}`);
      assert.ok(text(result).length > 0, `${name} returned empty text`);
    }
    assert.ok(requests.some((r) => r.path === "/api/datasets?domain=attention+%26+memory"));
    assert.ok(requests.some((r) => r.path.includes("domain=memory+space")));
  });

  it("sends correct write methods, paths, bodies, and Authorization header", async () => {
    const client = await makeClient("token-1");
    await client.callTool({ name: "submit_hypothesis", arguments: { statement: "A sufficiently long hypothesis", rationale: "A sufficiently long rationale", problemStatement: "What makes images memorable?", domains: ["memorability"] } });
    await client.callTool({ name: "add_citation", arguments: { hypothesisId: "h-1", citation: "10.1234/example" } });
    await client.callTool({ name: "post_comment", arguments: { hypothesisId: "h-1", content: "Comment" } });
    await client.callTool({ name: "star_hypothesis", arguments: { hypothesisId: "h-1" } });
    await client.callTool({ name: "unstar_hypothesis", arguments: { hypothesisId: "h-1" } });
    await client.callTool({ name: "vote_arena", arguments: { matchupId: "m-1", vote: "a" } });
    await client.callTool({ name: "submit_experiment", arguments: { hypothesisId: "h-1", type: "observational", datasetId: "ds-1", status: "planned" } });
    await client.callTool({ name: "update_experiment", arguments: { experimentId: "exp-1", status: "running", methodology: "Updated methods" } });
    await client.callTool({ name: "submit_dataset", arguments: { name: "New Dataset", huggingfaceUrl: "https://huggingface.co/datasets/open/new", foreknowledgeStatus: "data_unobserved", unitOfAnalysis: "Root comment", osf: { provenance: "This dataset is collected prospectively after registration.", collectionProcedure: "We collect all root comments in the chosen data window.", variables: "text is the argument and delta is the outcome variable.", inclusionExclusion: "We exclude deleted posts and rows missing required fields.", missingData: "Rows with missing core fields are excluded.", tags: ["test"] } } });
    await client.callTool({ name: "update_my_profile", arguments: { name: "Ada Lovelace", bio: "Researcher" } });

    const writes = requests.filter((r) => ["POST", "PATCH"].includes(r.method));
    assert.ok(writes.length >= 10);
    for (const r of writes) assert.equal(r.auth, "Bearer token-1", `${r.method} ${r.path}`);
    assert.ok(requests.some((r) => r.method === "POST" && r.path === "/api/hypotheses" && (r.body as { statement?: string }).statement));
    assert.ok(requests.some((r) => r.method === "PATCH" && r.path === "/api/hypotheses/h-1" && (r.body as { addCitation?: string }).addCitation === "10.1234/example"));
    assert.ok(requests.some((r) => r.method === "POST" && r.path === "/api/comments" && (r.body as { content?: string }).content === "Comment"));
    assert.ok(requests.some((r) => r.method === "POST" && r.path === "/api/hypotheses/h-1/star"));
    assert.ok(requests.some((r) => r.method === "POST" && r.path === "/api/arena/vote" && (r.body as { vote?: string }).vote === "a"));
    assert.ok(requests.some((r) => r.method === "POST" && r.path === "/api/experiments"));
    assert.ok(requests.some((r) => r.method === "PATCH" && r.path === "/api/experiments/exp-1"));
    assert.ok(requests.some((r) => r.method === "POST" && r.path === "/api/datasets"));
    assert.ok(requests.some((r) => r.method === "PATCH" && r.path === "/api/users/u-1"));
  });

  it("update_my_profile merges over the current profile instead of wiping fields", async () => {
    const client = await makeClient("token-1");
    const result = await client.callTool({ name: "update_my_profile", arguments: { website: "https://ada.example.edu", clearFields: ["bio"] } });
    assert.equal(result.isError, false, text(result));
    const patch = requests.find((r) => r.method === "PATCH" && r.path === "/api/users/u-1");
    assert.deepEqual(patch?.body, { name: "Ada", position: "Scientist", scholarUrl: null, website: "https://ada.example.edu", bio: null, orcid: null, twitterHandle: null });
  });

  it("whoami flags an invalid or revoked token", async () => {
    const client = await makeClient("revoked");
    const result = await client.callTool({ name: "whoami", arguments: {} });
    assert.equal(result.isError, true);
    assert.match(text(result), /invalid, expired, or revoked/);
  });

  it("write tools without a token return auth help and make no request", async () => {
    const client = await makeClient(undefined);
    const before = requests.length;
    const result = await client.callTool({ name: "submit_hypothesis", arguments: { statement: "A sufficiently long hypothesis", rationale: "A sufficiently long rationale", problemStatement: "What makes images memorable?", domains: ["memorability"] } });
    assert.equal(result.isError, true);
    assert.match(text(result), /AUTH HELP/);
    assert.equal(requests.length, before);
  });

  it("maps API and network errors to tool results", async () => {
    const client = await makeClient("token-1");
    const cases: Array<[string, RegExp]> = [["401", /Not signed in/], ["403", /Forbidden.*complete-profile/], ["404", /Not found/], ["500", /API unavailable/]];
    for (const [id, pattern] of cases) {
      const result = await client.callTool({ name: "get_hypothesis", arguments: { hypothesisId: id } });
      assert.equal(result.isError, true);
      assert.match(text(result), pattern);
    }
    const networkClient = await makeClient("token-1", "http://127.0.0.1:1");
    const network = await networkClient.callTool({ name: "platform_overview", arguments: {} });
    assert.equal(network.isError, true);
    assert.match(text(network), /API unavailable/);
  });

  it("star and unstar are idempotent", async () => {
    const client = await makeClient("token-1");
    starState = true;
    requests = [];
    const star = await client.callTool({ name: "star_hypothesis", arguments: { hypothesisId: "h-1" } });
    assert.match(text(star), /Already starred/);
    assert.equal(requests.filter((r) => r.method === "POST").length, 0);

    starState = false;
    requests = [];
    const unstar = await client.callTool({ name: "unstar_hypothesis", arguments: { hypothesisId: "h-1" } });
    assert.match(text(unstar), /Already not starred/);
    assert.equal(requests.filter((r) => r.method === "POST").length, 0);
  });

  it("serves prompts and resources", async () => {
    const client = await makeClient("token-1");
    const prompt = await client.getPrompt({ name: "formulate-hypothesis", arguments: { idea: "color and memory" } });
    assert.match(prompt.messages[0]?.content.type === "text" ? prompt.messages[0].content.text : "", /submit_hypothesis|generate_submission_url/);
    const guide = await client.readResource({ uri: "openexperiments://guide" });
    assert.match(guide.contents[0]?.text as string, /submit_hypothesis/);
    const hyp = await client.readResource({ uri: "openexperiments://hypothesis/h-1" });
    assert.match(hyp.contents[0]?.text as string, /Warm colors/);
  });
});
