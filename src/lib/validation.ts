type FieldError = { field: string; message: string };
type ValidationResult<T> = { ok: true; data: T } | { ok: false; errors: FieldError[] };

function trimmed(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

function between(s: string, min: number, max: number, field: string, label: string): FieldError | null {
  if (s.length < min) return { field, message: `${label} must be at least ${min} characters` };
  if (s.length > max) return { field, message: `${label} must be at most ${max} characters` };
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/.+/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOI_RE = /^10\.\d{4,9}\/[^\s]+$/;
const ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

const VALID_DOMAINS = ["persuasion", "memorability"] as const;
const VALID_SOURCES = ["human", "ai_agent"] as const;

export function validateHypothesis(body: Record<string, unknown>): ValidationResult<{
  statement: string;
  rationale: string;
  problemStatement: string;
  domains: string[];
  source: string;
  agentName: string | null;
  citationDois: string[];
  isAnonymous: boolean;
}> {
  const errors: FieldError[] = [];
  const statement = trimmed(body.statement);
  const rationale = trimmed(body.rationale);
  const problemStatement = trimmed(body.problemStatement);
  const domains = Array.isArray(body.domains) ? body.domains.filter((d): d is string => typeof d === "string") : [];
  const source = trimmed(body.source);
  const agentName = body.agentName ? trimmed(body.agentName) : null;
  const citationDois = Array.isArray(body.citationDois) ? body.citationDois.filter((d): d is string => typeof d === "string") : [];
  const isAnonymous = !!body.isAnonymous;

  if (!statement) errors.push({ field: "statement", message: "Please provide your hypothesis" });
  else {
    const e = between(statement, 10, 2000, "statement", "Hypothesis");
    if (e) errors.push(e);
  }

  if (!rationale) errors.push({ field: "rationale", message: "Please provide your rationale" });
  else {
    const e = between(rationale, 10, 5000, "rationale", "Rationale");
    if (e) errors.push(e);
  }

  if (!problemStatement) errors.push({ field: "problemStatement", message: "Please select or enter a problem statement" });
  else {
    const e = between(problemStatement, 5, 500, "problemStatement", "Problem statement");
    if (e) errors.push(e);
  }

  if (domains.length === 0) errors.push({ field: "domains", message: "Please select at least one domain" });
  else if (domains.some((d) => !VALID_DOMAINS.includes(d as typeof VALID_DOMAINS[number]))) {
    errors.push({ field: "domains", message: "Invalid domain selected" });
  }

  if (source && !VALID_SOURCES.includes(source as typeof VALID_SOURCES[number])) {
    errors.push({ field: "source", message: "Source must be 'human' or 'ai_agent'" });
  }

  if (agentName) {
    const e = between(agentName, 1, 100, "agentName", "Agent name");
    if (e) errors.push(e);
  }

  for (const doi of citationDois) {
    if (doi && !DOI_RE.test(doi) && !URL_RE.test(doi)) {
      errors.push({ field: "citationDois", message: `Invalid DOI or URL: ${doi}` });
      break;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      statement,
      rationale,
      problemStatement,
      domains,
      source: VALID_SOURCES.includes(source as typeof VALID_SOURCES[number]) ? source : "human",
      agentName,
      citationDois,
      isAnonymous,
    },
  };
}

export function validateComment(body: Record<string, unknown>): ValidationResult<{
  hypothesisId: string;
  content: string;
  doi: string | null;
  parentId: string | null;
}> {
  const errors: FieldError[] = [];
  const hypothesisId = trimmed(body.hypothesisId);
  const content = trimmed(body.content);
  const doi = body.doi ? trimmed(body.doi) : null;
  const parentId = body.parentId ? trimmed(body.parentId) : null;

  if (!hypothesisId || !UUID_RE.test(hypothesisId)) {
    errors.push({ field: "hypothesisId", message: "Invalid hypothesis reference" });
  }

  if (!content) errors.push({ field: "content", message: "Please write a comment" });
  else {
    const e = between(content, 1, 5000, "content", "Comment");
    if (e) errors.push(e);
  }

  if (doi && !DOI_RE.test(doi) && !URL_RE.test(doi)) {
    errors.push({ field: "doi", message: "Please enter a valid DOI (e.g., 10.1234/example)" });
  }

  if (parentId && !UUID_RE.test(parentId)) {
    errors.push({ field: "parentId", message: "Invalid parent comment reference" });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: { hypothesisId, content, doi, parentId } };
}

export function validateProfile(body: Record<string, unknown>): ValidationResult<{
  name: string;
  affiliation: string | null;
  scholarUrl: string | null;
  website: string | null;
  bio: string | null;
  orcid: string | null;
  twitterHandle: string | null;
}> {
  const errors: FieldError[] = [];
  const name = trimmed(body.name);
  const affiliation = body.affiliation ? trimmed(body.affiliation) : null;
  const scholarUrl = body.scholarUrl ? trimmed(body.scholarUrl) : null;
  const website = body.website ? trimmed(body.website) : null;
  const bio = body.bio ? trimmed(body.bio) : null;
  const orcid = body.orcid ? trimmed(body.orcid) : null;
  const twitterHandle = body.twitterHandle ? trimmed(body.twitterHandle) : null;

  if (!name) errors.push({ field: "name", message: "Please provide your name" });
  else {
    const e = between(name, 2, 100, "name", "Name");
    if (e) errors.push(e);
  }

  if (affiliation) {
    const e = between(affiliation, 2, 200, "affiliation", "Affiliation");
    if (e) errors.push(e);
  }

  if (scholarUrl && !URL_RE.test(scholarUrl)) {
    errors.push({ field: "scholarUrl", message: "Please enter a valid URL for Google Scholar" });
  }

  if (website && !URL_RE.test(website)) {
    errors.push({ field: "website", message: "Please enter a valid URL for your website" });
  }

  if (bio) {
    const e = between(bio, 1, 500, "bio", "Bio");
    if (e) errors.push(e);
  }

  if (orcid && !ORCID_RE.test(orcid)) {
    errors.push({ field: "orcid", message: "Please enter a valid ORCID (e.g., 0000-0002-1825-0097)" });
  }

  if (twitterHandle) {
    const clean = twitterHandle.startsWith("@") ? twitterHandle.slice(1) : twitterHandle;
    if (clean.length < 1 || clean.length > 15 || !/^[a-zA-Z0-9_]+$/.test(clean)) {
      errors.push({ field: "twitterHandle", message: "Please enter a valid X/Twitter handle" });
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: { name, affiliation, scholarUrl, website, bio, orcid, twitterHandle } };
}

export function validateRegistration(body: Record<string, unknown>): ValidationResult<{
  email: string;
  password: string;
  name: string;
}> {
  const errors: FieldError[] = [];
  const email = trimmed(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  const name = trimmed(body.name);

  if (!email) errors.push({ field: "email", message: "Please provide your email address" });
  else if (!EMAIL_RE.test(email)) errors.push({ field: "email", message: "Please enter a valid email address" });

  if (!password) errors.push({ field: "password", message: "Please create a password" });
  else if (password.length < 8) errors.push({ field: "password", message: "Password must be at least 8 characters" });

  if (!name) errors.push({ field: "name", message: "Please provide your name" });
  else {
    const e = between(name, 2, 100, "name", "Name");
    if (e) errors.push(e);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: { email, password, name } };
}
