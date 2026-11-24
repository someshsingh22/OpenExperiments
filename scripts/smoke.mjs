import assert from "node:assert/strict";

const base = new URL(process.env.SMOKE_BASE_URL || "http://127.0.0.1:3107");
assert(
  ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname),
  "Smoke tests write fixture data and must target an isolated localhost database.",
);

let cookie = "";
let checks = 0;

async function request(path, { status = 200, authenticated = false, ...options } = {}) {
  const headers = new Headers(options.headers);
  if (authenticated) headers.set("Cookie", cookie);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(new URL(path, base), {
    ...options,
    headers,
    signal: AbortSignal.timeout(60_000),
  });
  assert.equal(response.status, status, `${options.method || "GET"} ${path}`);
  checks += 1;
  return response;
}

async function json(path, options) {
  return (await request(path, options)).json();
}

const hypotheses = await json("/api/hypotheses?limit=2");
assert.equal(hypotheses.data.length, 2);
assert(hypotheses.total >= 2);
const hypothesisId = hypotheses.data[0].id;
const datasets = await json("/api/datasets");
assert(datasets.data.length > 0, "Seed the isolated database before running smoke tests.");
const datasetId = datasets.data[0].id;
const problems = await json("/api/problem-statements?includeDatasets=true");
assert(problems.data.length > 0);

await json(`/api/hypotheses/${hypothesisId}`);
await json(`/api/datasets/${datasetId}`);
await json("/api/experiments?limit=2");
await json("/api/arena/rankings");
const matchup = (await json("/api/arena/matchup")).data;
assert(matchup?.id);

for (const path of [
  "/api/hypotheses?limit=-1",
  "/api/hypotheses?offset=-1",
  "/api/experiments?limit=-1",
]) {
  await request(path, { status: 400 });
}
const filtered = await json(
  `/api/hypotheses?problemStatementId=${encodeURIComponent(problems.data[0].id)}&limit=2`,
);
assert(filtered.data.every((h) => h.problemStatement === problems.data[0].question));

await request("/api/arena/vote", {
  method: "POST",
  status: 415,
  headers: { "Content-Type": "text/plain", Origin: "https://untrusted.example" },
  body: JSON.stringify({ matchupId: matchup.id, vote: "a" }),
});
await request("/api/arena/vote", {
  method: "POST",
  status: 403,
  headers: { Origin: "https://untrusted.example" },
  body: JSON.stringify({ matchupId: matchup.id, vote: "a" }),
});

const registration = await request("/api/auth/register", {
  method: "POST",
  status: 201,
  body: JSON.stringify({
    email: `smoke-${crypto.randomUUID()}@example.invalid`,
    name: "Local Smoke Researcher",
    password: `${crypto.randomUUID()}!`,
  }),
});
const session = registration.headers.get("set-cookie");
assert(session?.includes("HttpOnly") && session.includes("Secure"));
cookie = session.split(";")[0];
const { user } = await registration.json();
assert.equal((await json("/api/auth/me", { authenticated: true })).user.id, user.id);

const profileUpdate = await json(`/api/users/${user.id}`, {
  method: "PATCH",
  authenticated: true,
  body: JSON.stringify({ name: "Updated Local Researcher", bio: "Local regression fixture" }),
});
assert.equal(profileUpdate.data.name, "Updated Local Researcher");

const anonymous = await json("/api/hypotheses", {
  method: "POST",
  status: 201,
  authenticated: true,
  body: JSON.stringify({
    statement: "Local smoke fixtures preserve anonymous contribution privacy.",
    rationale: "Testing account-specific visibility prevents disclosure through public counts.",
    problemStatement: problems.data[0].question,
    domains: ["persuasion"],
    source: "human",
    isAnonymous: true,
  }),
});
assert(anonymous.data.id);
const owner = await json(`/api/users/${user.id}`, { authenticated: true });
const publicResponse = await request(`/api/users/${user.id}`);
assert.equal(publicResponse.headers.get("cache-control"), "private, no-store");
const publicProfile = await publicResponse.json();
assert.equal(owner.data.stats.hypothesisCount, 1);
assert.equal(publicProfile.data.stats.hypothesisCount, 0);
assert.equal(publicProfile.data.hypotheses.length, 0);
assert.equal(publicProfile.data.user.email, null);

const comment = await json("/api/comments", {
  method: "POST",
  status: 201,
  authenticated: true,
  body: JSON.stringify({ hypothesisId, content: "Local smoke regression comment." }),
});
assert(comment.data.id);
const comments = await json(`/api/comments?hypothesisId=${encodeURIComponent(hypothesisId)}`);
assert(comments.data.some((entry) => entry.id === comment.data.id));

const star = await json(`/api/hypotheses/${hypothesisId}/star`, {
  method: "POST",
  authenticated: true,
});
assert.equal(star.data.starred, true);
const stars = await json(`/api/hypotheses/stars?ids=${encodeURIComponent(hypothesisId)}`, {
  authenticated: true,
});
assert.equal(stars.data[hypothesisId].starred, true);

const experiment = await json("/api/experiments", {
  method: "POST",
  status: 201,
  authenticated: true,
  body: JSON.stringify({
    hypothesisId,
    type: "data_test",
    datasetId,
    status: "planned",
    methodology: "Local smoke test methodology.",
    analysisPlan: "Local smoke test analysis plan.",
  }),
});
const experimentId = experiment.data.id;
assert(experimentId);
const updated = await json(`/api/experiments/${experimentId}`, {
  method: "PATCH",
  authenticated: true,
  body: JSON.stringify({
    status: "completed",
    results: { pValue: 0.01, effectSize: 0.2, sampleSize: 10, summary: "Local smoke result." },
    changeSummary: "Complete local smoke test.",
  }),
});
assert.equal(updated.data.version, 2);
const current = await json(`/api/experiments/${experimentId}`);
assert.equal(current.data.results.pValue, 0.01);
assert.equal(current.data.results.effectSize, 0.2);
const historical = await json(`/api/experiments/${experimentId}?version=1`);
assert.equal(historical.data.status, "planned");

const vote = await json("/api/arena/vote", {
  method: "POST",
  authenticated: true,
  headers: { Origin: base.origin },
  body: JSON.stringify({ matchupId: matchup.id, vote: "tie" }),
});
assert.equal(vote.data.totalVotes, matchup.totalVotes + 1);
await request("/api/arena/vote", {
  method: "POST",
  authenticated: true,
  status: 409,
  body: JSON.stringify({ matchupId: matchup.id, vote: "tie" }),
});

for (const path of [
  "/",
  "/explore",
  "/data",
  "/experiments",
  "/arena",
  `/hypothesis/${hypothesisId}`,
  `/data/${datasetId}`,
  `/experiments/${experimentId}`,
  `/profile/${user.id}`,
  "/sitemap.xml",
  "/robots.txt",
]) {
  await request(path);
}

await request("/api/auth/logout", { method: "POST", authenticated: true });
assert.equal((await json("/api/auth/me", { authenticated: true })).user, null);
console.log(`Passed ${checks} localhost HTTP smoke checks against isolated D1.`);
