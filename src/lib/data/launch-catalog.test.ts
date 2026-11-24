import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

const root = new URL("../../../", import.meta.url);

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "openexperiments-launch-"));
  const source = join(directory, "source");
  const output = join(directory, "output");
  for (const path of ["osf", "studies", "ICLR/osf/studies"]) {
    mkdirSync(join(source, path), { recursive: true });
  }
  const study = (hypothesis: string) =>
    JSON.stringify({
      Metadata: { Title: "Submitted study", Description: "An observational study." },
      Overview: { "Research questions or hypotheses": hypothesis },
      "Research Design": { "Study design": "Account for clustering." },
      Sampling: { "Starting and stopping rules": "Post-registration data only." },
      Variables: { "Measured variables": "Observe the outcome." },
      "Analysis Plan": { "Statistical models": "A prespecified regression." },
    });
  writeFileSync(
    join(source, "osf/registrations1.md"),
    "## Registered\n| study-02 | [cmv01](https://osf.io/cmv01/) |\n" +
      "| study-03 | [cmv02](https://osf.io/cmv02/) |\n" +
      "## Not Yet Registered\n| study-24 | draft |\n",
  );
  writeFileSync(
    join(source, "studies/study-02.json"),
    study("Longer comments receive more deltas."),
  );
  writeFileSync(
    join(source, "studies/study-03.json"),
    study("Length matching is associated with deltas."),
  );
  writeFileSync(
    join(source, "ICLR/osf/registrations.md"),
    "| iclr-2027-h01-rating | primary | yes | True | True | False | [iclr1](https://osf.io/iclr1/) | 2026-11-05T04:01:44.650123 | check |\n",
  );
  const iclr = study(
    "Research question?\n\n**Primary hypothesis:** Lower ratings are associated with improvement.\n\n" +
      "**Secondary hypothesis:** The consensus gap is associated with improvement.",
  );
  const iclrPath = "ICLR/osf/studies/iclr-2027-h01-rating.json";
  writeFileSync(join(source, iclrPath), iclr);
  writeFileSync(
    join(source, "ICLR/osf/manifest.json"),
    JSON.stringify([
      {
        study_id: "iclr-2027-h01-rating",
        json: iclrPath,
        json_sha256: createHash("sha256").update(iclr).digest("hex"),
      },
    ]),
  );
  const statusFile = join(directory, "statuses.json");
  writeFileSync(
    statusFile,
    JSON.stringify([
      { study: "study-02", id: "cmv01", http_status: 401 },
      {
        study: "iclr-2027-h01-rating",
        id: "iclr1",
        public: true,
        registered: true,
        withdrawn: false,
      },
    ]),
  );
  const generate = () =>
    execFileSync(
      process.execPath,
      [
        "scripts/launch-catalog.mjs",
        "--source-root",
        source,
        "--output",
        output,
        "--status-file",
        statusFile,
      ],
      { cwd: root, stdio: "pipe" },
    );
  return { directory, source, output, iclrPath, statusFile, generate };
}

describe("submitted OSF launch catalog", () => {
  it("imports complete plans without fabricated results and preserves edits on rerun", () => {
    const source = fixture();
    const db = new DatabaseSync(":memory:");
    try {
      source.generate();
      const migrations = new URL("drizzle/migrations/", root);
      for (const file of readdirSync(migrations)
        .filter((file) => file.endsWith(".sql"))
        .sort()) {
        db.exec(readFileSync(new URL(file, migrations), "utf8"));
      }
      db.exec("PRAGMA foreign_keys=ON");
      const sql = readFileSync(join(source.output, "seed.sql"), "utf8");
      db.exec(sql);
      expect(
        db
          .prepare("SELECT id, status, phase, p_value, arena_elo FROM hypotheses ORDER BY id")
          .all(),
      ).toEqual([
        { id: "osf-cmv01", status: "proposed", phase: "live", p_value: null, arena_elo: null },
        { id: "osf-cmv02", status: "proposed", phase: "live", p_value: null, arena_elo: null },
        { id: "osf-iclr1", status: "proposed", phase: "live", p_value: null, arena_elo: null },
      ]);
      const iclr = db
        .prepare("SELECT statement, rationale FROM hypotheses WHERE id='osf-iclr1'")
        .get()!;
      expect(iclr.statement).toBe("Lower ratings are associated with improvement.");
      expect(iclr.rationale).toContain("Secondary hypothesis");
      expect(iclr.rationale).toContain("consensus gap");
      const cmv = db.prepare("SELECT rationale FROM hypotheses WHERE id='osf-cmv01'").get()!;
      expect(cmv.rationale).toContain("embargoed registration");
      const plans = db.prepare("SELECT status, dataset_id, methodology FROM experiments").all();
      expect(plans).toHaveLength(3);
      expect(plans.every((plan) => plan.status === "running" && plan.dataset_id === null)).toBe(
        true,
      );
      expect(
        plans.every((plan) => String(plan.methodology).includes("Post-registration data only")),
      ).toBe(true);
      expect(db.prepare("SELECT count(*) AS n FROM experiment_results").get()).toEqual({ n: 0 });
      expect(db.prepare("SELECT count(*) AS n FROM arena_votes").get()).toEqual({ n: 0 });
      expect(db.prepare("SELECT count(*) AS n FROM experiment_versions").get()).toEqual({ n: 3 });
      expect(
        db
          .prepare("SELECT hypothesis_a_id, hypothesis_b_id, total_votes FROM arena_matchups")
          .all(),
      ).toEqual([{ hypothesis_a_id: "osf-cmv01", hypothesis_b_id: "osf-cmv02", total_votes: 0 }]);
      db.exec(
        "UPDATE hypotheses SET statement='User edit', status='arena_ranked' WHERE id='osf-iclr1'",
      );
      db.exec(sql);
      expect(db.prepare("SELECT count(*) AS n FROM hypotheses").get()).toEqual({ n: 3 });
      expect(db.prepare("SELECT count(*) AS n FROM arena_matchups").get()).toEqual({ n: 1 });
      expect(
        db.prepare("SELECT statement,status FROM hypotheses WHERE id='osf-iclr1'").get(),
      ).toEqual({
        statement: "User edit",
        status: "arena_ranked",
      });
      db.exec(`
        UPDATE experiments SET status='planned' WHERE id='osf-plan-cmv01';
        UPDATE experiment_versions SET status='planned' WHERE experiment_id='osf-plan-cmv01';
        UPDATE experiments SET status='completed' WHERE id='osf-plan-iclr1';
      `);
      const activation = readFileSync(join(source.output, "activate.sql"), "utf8");
      db.exec(activation);
      db.exec(activation);
      expect(
        db.prepare("SELECT status,version FROM experiments WHERE id='osf-plan-cmv01'").get(),
      ).toEqual({ status: "running", version: 2 });
      expect(
        db
          .prepare(
            "SELECT version,status FROM experiment_versions WHERE experiment_id='osf-plan-cmv01' ORDER BY version",
          )
          .all(),
      ).toEqual([
        { version: 1, status: "planned" },
        { version: 2, status: "running" },
      ]);
      expect(
        db.prepare("SELECT status,version FROM experiments WHERE id='osf-plan-iclr1'").get(),
      ).toEqual({ status: "completed", version: 1 });
      expect(db.prepare("SELECT count(*) AS n FROM experiment_results").get()).toEqual({ n: 0 });
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      db.close();
      rmSync(source.directory, { recursive: true });
    }
  });

  it("rejects modified submitted JSON and withdrawn registrations before generating SQL", () => {
    const source = fixture();
    try {
      const path = join(source.source, source.iclrPath);
      const original = readFileSync(path, "utf8");
      writeFileSync(path, `${original}\n`);
      expect(source.generate).toThrow(/does not match its manifest/);
      writeFileSync(path, original);
      writeFileSync(
        source.statusFile,
        JSON.stringify([{ study: "iclr-2027-h01-rating", id: "iclr1", withdrawn: true }]),
      );
      expect(source.generate).toThrow(/withdrawn or not registered/);
    } finally {
      rmSync(source.directory, { recursive: true });
    }
  });
});
