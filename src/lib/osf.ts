// OSF-style scientific characterization for datasets.
//
// A dataset on OpenExperiments is registered as a scientific instrument, not an
// ML benchmark: the submitter links a Hugging Face dataset and answers a subset
// of the OSF Preregistration questions that describe the *data substrate* itself
// (provenance, collection, variables, inclusion/exclusion, missing data). Every
// hypothesis tested on the dataset inherits this shared, vetted understanding.
//
// Only the dataset-level (substrate) OSF fields live here. Study-level fields
// (the specific hypothesis, its IV/DV, statistical model, inference criteria)
// stay on the experiment/hypothesis, since they vary per test.

// OSF "Foreknowledge of data or evidence" options (from the OSF Preregistration
// schema). Captures whether the data could have influenced analysis decisions —
// the leakage/provenance gate. Stored as the short code; labels shown in the UI.
export const FOREKNOWLEDGE_OPTIONS: { code: string; label: string }[] = [
  { code: "data_not_exist", label: "Data does not yet exist." },
  { code: "data_inaccessible", label: "Data exists but the authors cannot observe it yet." },
  { code: "data_unobserved", label: "Data exists but the authors have not observed it yet." },
  { code: "others_observed", label: "Only people other than the authors have observed the data." },
  {
    code: "limited_observation",
    label: "Authors' limited observation of the data could not influence their analysis decisions.",
  },
  {
    code: "observed_not_analyzed",
    label: "Authors have observed the data, but have not performed the proposed analyses.",
  },
  {
    code: "observed_cannot_certify",
    label:
      "Authors have observed the data. The authors cannot certify that observation did not influence analysis decisions.",
  },
  { code: "analyses_conducted", label: "Analyses in this plan have been conducted already." },
];

export const FOREKNOWLEDGE_CODES = FOREKNOWLEDGE_OPTIONS.map((o) => o.code);

export function foreknowledgeLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return FOREKNOWLEDGE_OPTIONS.find((o) => o.code === code)?.label ?? code;
}

// Common open-data licenses offered in the submission form.
export const DATASET_LICENSES: string[] = [
  "CC0 1.0 Universal",
  "CC BY 4.0",
  "CC BY-SA 4.0",
  "CC BY-NC 4.0",
  "MIT",
  "Apache 2.0",
  "ODC-BY 1.0",
  "Other / see dataset card",
];

// The dataset-level OSF characterization, stored as a JSON blob on the dataset.
// All fields are free-text prose (mirroring OSF textareas) except `tags`.
export interface OsfCharacterization {
  // Overview — where the data comes from and why prior observation can't bias it.
  provenance: string;
  foreknowledgeExplanation?: string;
  // Sampling — how observations are gathered, and the collection window.
  collectionProcedure: string;
  startStopRules?: string;
  // Variables — the column dictionary: each field, its meaning, how it's computed.
  variables: string;
  // Analysis Plan (substrate level) — how data is filtered and missing values handled.
  inclusionExclusion: string;
  missingData: string;
  // Other — known biases, ethical considerations, appropriate/inappropriate uses.
  limitations?: string;
  tags: string[];
}

// Ordered section metadata that drives the submission form and the detail page,
// so the two never drift. `key` maps to a field on OsfCharacterization.
export interface OsfSection {
  key: keyof Omit<OsfCharacterization, "tags">;
  title: string;
  help: string;
  placeholder: string;
  required: boolean;
  minLength: number;
}

export const OSF_SECTIONS: OsfSection[] = [
  {
    key: "provenance",
    title: "Provenance",
    help: "Where does the data come from, and why can prior observation of it not bias the analyses?",
    placeholder:
      "Data is drawn from … The corpus is collected prospectively, so no analysis decisions can be influenced by prior observation.",
    required: true,
    minLength: 30,
  },
  {
    key: "foreknowledgeExplanation",
    title: "Explanation of foreknowledge",
    help: "Optional. How are unintended influences of any prior data observation managed?",
    placeholder:
      "Confirmatory analyses use only data generated after registration; the registration timestamp is the boundary between hypothesis-generation and confirmatory data.",
    required: false,
    minLength: 0,
  },
  {
    key: "collectionProcedure",
    title: "Collection procedure",
    help: "How are observations gathered? What is captured for each unit?",
    placeholder:
      "For each thread we capture the original post, all root comments, the OP's replies, and the automated view-change confirmation records …",
    required: true,
    minLength: 30,
  },
  {
    key: "startStopRules",
    title: "Starting and stopping rules",
    help: "Optional. When does collection begin and end (for prospective corpora)?",
    placeholder:
      "Collection begins at the registration timestamp and runs for a fixed 6-month window; only records created within the window are eligible.",
    required: false,
    minLength: 0,
  },
  {
    key: "variables",
    title: "Variable dictionary",
    help: "For each column: its name, what it means, how it is computed, and its type / role (id, predictor, outcome, covariate).",
    placeholder:
      "comment_id — root comment identifier; the unit of analysis.\ndelta — binary outcome (1 if the OP awarded a confirmed view-change, else 0).\npost_score — score of the original post (covariate).",
    required: true,
    minLength: 30,
  },
  {
    key: "inclusionExclusion",
    title: "Inclusion & exclusion",
    help: "How is data considered or removed at the dataset level? What filters define a valid record?",
    placeholder:
      "Post-level: exclude deleted/removed bodies and unengaged authors. Comment-level: only root comments within the activity window …",
    required: true,
    minLength: 30,
  },
  {
    key: "missingData",
    title: "Missing data",
    help: "How are missing values handled?",
    placeholder:
      "Records meeting the inclusion criteria are used as-is; observations with missing required fields are excluded by the filtering pipeline. No imputation is performed.",
    required: true,
    minLength: 15,
  },
  {
    key: "limitations",
    title: "Limitations & ethics",
    help: "Optional. Known biases, ethical considerations, and appropriate / inappropriate uses.",
    placeholder:
      "Observational data — associations are not causal. The population is self-selected and may not generalize …",
    required: false,
    minLength: 0,
  },
];
