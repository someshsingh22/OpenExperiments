import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, relative } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const { values } = parseArgs({
  options: {
    "source-root": { type: "string", default: resolve(homedir(), "GitHub/browser-agent") },
    output: { type: "string", default: resolve(root, ".wrangler/launch-review") },
    "status-file": { type: "string" },
  },
});
const sourceRoot = resolve(values["source-root"]);
const output = resolve(values.output);
const read = (path) => readFileSync(resolve(sourceRoot, path), "utf8");
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const catalog = JSON.parse(
  readFileSync(resolve(root, "src/lib/data/research-catalog.json"), "utf8"),
);
const statuses = new Map(
  (values["status-file"]
    ? JSON.parse(readFileSync(resolve(values["status-file"]), "utf8"))
    : []
  ).map((status) => [status.study, status]),
);
const manifest = new Map(
  JSON.parse(read("ICLR/osf/manifest.json")).map((entry) => [entry.study_id, entry]),
);
const cmvLedger = read("osf/registrations1.md").split("## Not Yet Registered")[0];
const iclrLedger = read("ICLR/osf/registrations.md");
const entries = [
  ...Array.from(cmvLedger.matchAll(/\| (study-\d+) \| \[([a-z0-9]+)\]/g), (match) => ({
    studyId: match[1],
    osfId: match[2],
    sourcePath: `studies/${match[1]}.json`,
    problemStatementId: "ps-1",
    kind: "primary",
    registeredDate: "2026-06-20",
    access: "ledger_only",
  })),
  ...Array.from(
    iclrLedger.matchAll(
      /\| (iclr-2027-[^ |]+) \| (primary|exploratory) \| yes \| True \| True \| False \| \[([a-z0-9]+)\][^\n]*?\| (2026-[^ |]+) \|/g,
    ),
    (match) => ({
      studyId: match[1],
      osfId: match[3],
      sourcePath: `ICLR/osf/studies/${match[1]}.json`,
      problemStatementId: "ps-iclr",
      kind: match[2],
      registeredDate: match[4].slice(0, 10),
      access: "public_in_ledger",
    }),
  ),
];
if (
  !entries.some((entry) => entry.problemStatementId === "ps-1") ||
  !entries.some((entry) => entry.problemStatementId === "ps-iclr")
) {
  throw new Error("No submitted CMV/ICLR registrations found; check the source ledgers.");
}
if (new Set(entries.map((entry) => entry.studyId)).size !== entries.length) {
  throw new Error("Duplicate study identifiers in the registration ledgers.");
}

function sectionText(study, sections) {
  return sections
    .flatMap((section) =>
      Object.entries(study[section] ?? {})
        .filter(([, text]) => typeof text === "string" && text.trim())
        .map(([label, text]) => `## ${label}\n\n${text}`),
    )
    .join("\n\n");
}

const studies = entries.map((entry) => {
  const source = read(entry.sourcePath);
  const study = JSON.parse(source);
  const sourceSha256 = sha256(source);
  if (entry.problemStatementId === "ps-iclr") {
    const submitted = manifest.get(entry.studyId);
    if (
      !submitted ||
      submitted.json !== entry.sourcePath ||
      submitted.json_sha256 !== sourceSha256
    ) {
      throw new Error(`${entry.studyId}: submitted JSON does not match its manifest.`);
    }
  }
  const researchQuestions = study.Overview?.["Research questions or hypotheses"];
  if (!study.Metadata?.Title || !study.Metadata.Description || !researchQuestions?.trim()) {
    throw new Error(`${entry.studyId}: missing title, description or hypothesis text.`);
  }
  if (!study["Analysis Plan"]?.["Statistical models"]?.trim()) {
    throw new Error(`${entry.studyId}: missing submitted statistical analysis plan.`);
  }
  const primary = researchQuestions.match(
    /\*\*(?:Primary hypothesis|Secondary\/exploratory hypothesis[^:]*):\*\*\s*([\s\S]*?)(?=\n\s*\*\*Secondary hypothesis|$)/,
  );
  const statement = (primary?.[1] ?? researchQuestions).replace(/\s+/g, " ").trim();
  const status = statuses.get(entry.studyId);
  if (status && status.id !== entry.osfId) {
    throw new Error(`${entry.studyId}: OSF status check refers to a different registration.`);
  }
  if (status?.withdrawn || status?.registered === false) {
    throw new Error(`${entry.studyId}: OSF registration is withdrawn or not registered.`);
  }
  const publiclyVerified = status?.public === true && status?.registered === true;
  const accessNote = publiclyVerified
    ? "Public OSF registration verified. Registration specifies an analysis plan, not a completed result."
    : status?.http_status === 404
      ? "Submitted to OSF. The OSF registration page is not currently publicly accessible, so its registration status cannot be independently checked yet."
      : entry.problemStatementId === "ps-1"
        ? "Submitted to OSF as an embargoed registration. The OSF registration page is not yet public, so its registration status cannot be independently checked yet."
        : "Listed as a public OSF registration; public access has not yet been independently checked.";
  const prospectiveNote =
    entry.problemStatementId === "ps-1"
      ? "Preregistered confirmatory collection uses posts created after registration, not the published historical CMV splits. A delta is an acknowledgment; this is observational, not a causal estimate."
      : "Preregistered ICLR 2027 collection is separate from the published ICLR 2024-2025 dataset. The improved outcome requires final_rating > initial_rating; historical label=changed also includes decreases.";
  const kindNote =
    entry.kind === "exploratory"
      ? "This is a separately registered secondary/exploratory study, not a confirmatory primary test."
      : "Primary and any secondary hypotheses are preserved from the submitted plan.";
  return {
    ...entry,
    sourceSha256,
    title: study.Metadata.Title,
    studyStatus: "running",
    statement,
    osfLink: `https://osf.io/${entry.osfId}/`,
    access: publiclyVerified ? "public_verified" : entry.access,
    accessNote,
    rationale: `${study.Metadata.Description}\n\n${researchQuestions}\n\n${accessNote}\n\n${prospectiveNote}\n\n${kindNote}`,
    methodology: [
      study.Metadata.Title,
      accessNote,
      prospectiveNote,
      kindNote,
      sectionText(study, ["Research Design", "Sampling", "Variables"]),
    ].join("\n\n"),
    analysisPlan: sectionText(study, ["Analysis Plan"]),
  };
});

const lines = [
  "-- Launch catalog. Generated from submitted OSF study JSON and registration ledgers.",
  "-- Includes embargoed CMV submissions; publication approved by the team at launch (2026-11-25).",
  "-- Insert-only: preserves existing records, user edits, results, votes and research lifecycle state.",
  readFileSync(resolve(root, "scripts/catalog.sql"), "utf8"),
];
const activation = [
  "-- Local review status correction per team confirmation: submitted studies are under test.",
  "-- Advances only listed planned studies; preserves completed/running states and version history.",
];
for (const study of studies) {
  const problem = catalog.problemStatements.find((item) => item.id === study.problemStatementId);
  if (!problem) throw new Error(`Unknown problem statement ${study.problemStatementId}`);
  const hypothesisId = `osf-${study.osfId}`;
  const experimentId = `osf-plan-${study.osfId}`;
  const timestamp = Math.floor(Date.parse(`${study.registeredDate}T00:00:00Z`) / 1000);
  if (!Number.isFinite(timestamp))
    throw new Error(`Invalid registration date for ${study.studyId}`);
  const datasetName =
    study.problemStatementId === "ps-1"
      ? "CMV post-registration collection"
      : "ICLR 2027 rating-improvement collection";
  lines.push(
    `INSERT INTO hypotheses (id, statement, rationale, source, agent_name, domains, problem_statement, status, phase, submitted_at, citation_dois, related_hypothesis_ids, created_at, updated_at) VALUES (${quote(hypothesisId)}, ${quote(study.statement)}, ${quote(study.rationale)}, 'ai_agent', 'ExperiGen', '["persuasion"]', ${quote(problem.question)}, 'proposed', 'live', ${timestamp}, '[]', '[]', ${timestamp}, ${timestamp}) ON CONFLICT(id) DO NOTHING;`,
    `INSERT INTO experiments (id, hypothesis_id, problem_statement_id, type, status, dataset_name, methodology, analysis_plan, started_at, osf_link, created_at, updated_at) VALUES (${quote(experimentId)}, ${quote(hypothesisId)}, ${quote(problem.id)}, 'pre_registered', 'running', ${quote(datasetName)}, ${quote(study.methodology)}, ${quote(study.analysisPlan)}, ${timestamp}, ${quote(study.osfLink)}, ${timestamp}, ${timestamp}) ON CONFLICT(id) DO NOTHING;`,
    `INSERT INTO experiment_versions (id, experiment_id, version, status, methodology, analysis_plan, osf_link, change_summary, created_at) VALUES (${quote(`${experimentId}-v1`)}, ${quote(experimentId)}, 1, 'running', ${quote(study.methodology)}, ${quote(study.analysisPlan)}, ${quote(study.osfLink)}, 'Imported active preregistered study per team confirmation; no results imported.', ${timestamp}) ON CONFLICT(id) DO NOTHING;`,
  );
  activation.push(
    `INSERT INTO experiment_versions (id, experiment_id, version, status, methodology, analysis_plan, osf_link, change_summary, created_at) SELECT id || '-v' || (version + 1), id, version + 1, 'running', methodology, analysis_plan, osf_link, 'Corrected planned to running: team confirms this submitted study is under test; no results claimed.', CAST(strftime('%s', 'now') AS INTEGER) FROM experiments WHERE id=${quote(experimentId)} AND status='planned';`,
    `UPDATE experiments SET status='running', version=version+1, dataset_name=CASE WHEN dataset_name=${quote(`${datasetName} (planned)`)} THEN ${quote(datasetName)} ELSE dataset_name END, updated_at=CAST(strftime('%s', 'now') AS INTEGER) WHERE id=${quote(experimentId)} AND status='planned';`,
  );
}
const matchupPairs = new Set();
for (const problem of catalog.problemStatements) {
  const group = studies
    .filter((study) => study.problemStatementId === problem.id)
    .map((study) => study.osfId)
    .sort();
  if (group.length < 2) continue;
  for (let index = 0; index < group.length; index++) {
    const [a, b] = [group[index], group[(index + 1) % group.length]].sort();
    const pair = `${a}-${b}`;
    if (matchupPairs.has(pair)) continue;
    matchupPairs.add(pair);
    lines.push(
      `INSERT INTO arena_matchups (id, hypothesis_a_id, hypothesis_b_id, created_at, updated_at) VALUES (${quote(`osf-match-${pair}`)}, ${quote(`osf-${a}`)}, ${quote(`osf-${b}`)}, CAST(strftime('%s', 'now') AS INTEGER), CAST(strftime('%s', 'now') AS INTEGER)) ON CONFLICT(id) DO NOTHING;`,
    );
  }
}
lines.push(
  "UPDATE problem_statements SET hypothesis_count=(SELECT count(*) FROM hypotheses WHERE hypotheses.problem_statement=problem_statements.question);",
);
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, "seed.sql"), `${lines.join("\n\n")}\n`);
writeFileSync(resolve(output, "activate.sql"), `${activation.join("\n\n")}\n`);
writeFileSync(
  resolve(output, "catalog.json"),
  `${JSON.stringify({ studies, matchupCount: matchupPairs.size, excludedDrafts: ["study-24", "study-27", "study-30"] }, null, 2)}\n`,
);
console.log(
  `Prepared ${studies.length} hypotheses and running studies in ${relative(root, output)}. ` +
    `${studies.filter((study) => study.access === "public_verified").length} public registrations independently verified; ` +
    "private/unverified entries require review before publication.",
);
