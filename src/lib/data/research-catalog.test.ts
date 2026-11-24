import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import catalog from "./research-catalog.json";
import { problemStatements } from "./problem-statements";
import type { OsfCharacterization } from "../osf";

const root = new URL("../../../", import.meta.url);
const sql = readFileSync(new URL("scripts/catalog.sql", root), "utf8");

function database() {
  const db = new DatabaseSync(":memory:");
  const directory = new URL("drizzle/migrations/", root);
  for (const file of readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    db.exec(readFileSync(new URL(file, directory), "utf8"));
  }
  db.exec("PRAGMA foreign_keys=ON");
  return db;
}

describe("real research catalog", () => {
  it("keeps generated seed and upgrade SQL synchronized with the source", () => {
    expect(() =>
      execFileSync(process.execPath, ["scripts/research-catalog.mjs", "--check"], { cwd: root }),
    ).not.toThrow();
    expect(readFileSync(new URL("scripts/seed.sql", root), "utf8")).toBe(sql);
    expect(problemStatements.map((ps) => ps.id)).toEqual([
      "ps-1",
      "ps-iclr",
      "ps-upworthy",
      "ps-newyorker",
      "ps-rjokes",
      "ps-fedreg",
      "ps-github-pr",
      "ps-aita",
      "ps-llm-slop",
      "ps-lamem",
      "ps-anthropic-persuasion",
    ]);
    expect(problemStatements.every((ps) => ps.hypothesisCount === 0)).toBe(true);
  });

  it("registers the launch catalog and its linked instruments on a fresh database, without mock research", () => {
    const db = database();
    try {
      db.exec(sql);
      expect(db.prepare("SELECT id FROM problem_statements ORDER BY id").all()).toEqual(
        catalog.problemStatements
          .map((ps) => ({ id: ps.id }))
          .sort((a, b) => (a.id < b.id ? -1 : 1)),
      );
      expect(
        db.prepare("SELECT * FROM dataset_problem_statements ORDER BY dataset_id").all(),
      ).toEqual(
        catalog.datasets
          .map((ds) => ({ dataset_id: ds.id, problem_statement_id: ds.problemStatementId }))
          .sort((a, b) => (a.dataset_id < b.dataset_id ? -1 : 1)),
      );
      for (const table of ["hypotheses", "experiments", "experiment_results", "arena_votes"]) {
        expect(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()).toEqual({ n: 0 });
      }
      for (const ds of catalog.datasets) {
        const row = db.prepare("SELECT * FROM datasets WHERE id=?").get(ds.id)!;
        expect(row.huggingface_url).toBe(ds.huggingfaceUrl);
        expect(row.target_column_name).toBe(ds.targetColumnName);
        expect(JSON.parse(String(row.data_column_names))).toEqual(ds.dataColumnNames);
        const osf: OsfCharacterization = JSON.parse(String(row.osf_characterization));
        expect(osf).toEqual(ds.osfCharacterization);
        expect(osf.provenance).toBeUndefined();
        expect(osf.foreknowledgeSummary).toBeTruthy();
        if (ds.huggingfaceUrl.startsWith("https://huggingface.co/"))
          expect(ds.revision).toMatch(/^[a-f0-9]{40}$/);
        expect(row.foreknowledge_status).toBe("observed_cannot_certify");
        expect(row.license).toBeTruthy();
      }
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("distinguishes historical releases from the planned future tests", () => {
    const cmv = catalog.datasets.find((dataset) => dataset.id === "ds-1")!;
    const iclr = catalog.datasets.find((dataset) => dataset.id === "ds-iclr")!;
    for (const dataset of [cmv, iclr]) {
      expect(dataset.description).not.toMatch(/train|holdout|split/i);
      expect(dataset.osfCharacterization).not.toHaveProperty("provenance");
      expect(dataset.foreknowledgeStatus).toBe("observed_cannot_certify");
    }
    expect(cmv.osfCharacterization.foreknowledgeExplanation).toContain("Arctic Shift API");
    expect(cmv.osfCharacterization.foreknowledgeExplanation).toContain("after it is submitted");
    expect(iclr.description).toContain("abstract, not the full paper");
    expect(iclr.osfCharacterization.foreknowledgeExplanation).toContain("Paper Copilot");
    expect(iclr.osfCharacterization.foreknowledgeExplanation).toContain("OpenReview API");
    expect(iclr.osfCharacterization.foreknowledgeExplanation).toContain("ICLR 2026");
    expect(iclr.osfCharacterization.foreknowledgeExplanation).toContain("ratings were reset");
    expect(JSON.stringify(iclr)).not.toMatch(/arxiv|author_affiliations/i);
  });

  it("upgrades demo metadata idempotently while preserving research and user catalog entries", () => {
    const db = database();
    try {
      db.exec(readFileSync(new URL("scripts/seed-demo.sql", root), "utf8"));
      db.exec(`
        INSERT INTO problem_statements VALUES ('user-ps', 'User question?', 'User description', 'custom', 0, 1, 1);
        INSERT INTO datasets (id, name, huggingface_url, created_at, updated_at) VALUES ('user-ds', 'User dataset', 'https://huggingface.co/datasets/user/data', 1, 1);
        INSERT INTO dataset_problem_statements VALUES ('user-ds', 'user-ps');
        UPDATE experiments SET problem_statement_id='ps-3' WHERE id='exp-3';
        UPDATE experiments SET problem_statement_id='ps-2' WHERE id='exp-1';
      `);
      const beforeHypotheses = db.prepare("SELECT * FROM hypotheses ORDER BY id").all();
      const beforeExperiments = db.prepare("SELECT * FROM experiments ORDER BY id").all();
      const beforeResults = db
        .prepare("SELECT * FROM experiment_results ORDER BY experiment_id")
        .all();
      db.exec(sql);
      const snapshot = db
        .prepare("SELECT id, question, hypothesis_count FROM problem_statements ORDER BY id")
        .all();
      db.exec(sql);
      expect(
        db
          .prepare("SELECT id, question, hypothesis_count FROM problem_statements ORDER BY id")
          .all(),
      ).toEqual(snapshot);
      expect(snapshot).toEqual([
        { id: "ps-1", question: catalog.problemStatements[0].question, hypothesis_count: 5 },
        ...catalog.problemStatements
          .slice(1)
          .map((ps) => ({ id: ps.id, question: ps.question, hypothesis_count: 0 }))
          .sort((a, b) => (a.id < b.id ? -1 : 1)),
        { id: "user-ps", question: "User question?", hypothesis_count: 0 },
      ]);
      expect(db.prepare("SELECT * FROM hypotheses ORDER BY id").all()).toEqual(beforeHypotheses);
      expect(db.prepare("SELECT * FROM experiments ORDER BY id").all()).toEqual(beforeExperiments);
      expect(db.prepare("SELECT * FROM experiment_results ORDER BY experiment_id").all()).toEqual(
        beforeResults,
      );
      expect(
        db
          .prepare(
            "SELECT id, problem_statement_id FROM experiments WHERE id IN ('exp-1', 'exp-3') ORDER BY id",
          )
          .all(),
      ).toEqual([
        { id: "exp-1", problem_statement_id: "ps-2" },
        { id: "exp-3", problem_statement_id: "ps-3" },
      ]);
      expect(
        db.prepare("SELECT * FROM dataset_problem_statements WHERE dataset_id='user-ds'").all(),
      ).toEqual([{ dataset_id: "user-ds", problem_statement_id: "user-ps" }]);
      expect(db.prepare("SELECT name FROM datasets WHERE id='user-ds'").get()).toEqual({
        name: "User dataset",
      });
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("does not retire a user-edited fixture question", () => {
    const db = database();
    try {
      db.exec(
        "INSERT INTO problem_statements VALUES ('ps-2', 'My real question?', 'Real data', 'custom', 0, 1726358400, 1)",
      );
      db.exec(sql);
      expect(db.prepare("SELECT question FROM problem_statements WHERE id='ps-2'").get()).toEqual({
        question: "My real question?",
      });
    } finally {
      db.close();
    }
  });
});
