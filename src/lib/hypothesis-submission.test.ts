import { describe, expect, it } from "vitest";
import { validateHypothesisSubmission } from "./hypothesis-submission";

const valid = {
  statement: "A valid hypothesis",
  rationale: "A valid rationale",
  problemStatement: "An existing question",
  domains: ["persuasion"],
  isProposingNew: false,
};

describe("hypothesis submission validation", () => {
  it("preserves valid existing and proposed problem statement inputs", () => {
    expect(validateHypothesisSubmission(valid)).toEqual({});
    expect(validateHypothesisSubmission({ ...valid, isProposingNew: true })).toEqual({});
  });

  it("reports empty/whitespace fields and missing selection before a request", () => {
    expect(
      validateHypothesisSubmission({
        statement: " ",
        rationale: "",
        problemStatement: "\n",
        domains: [],
        isProposingNew: false,
      }),
    ).toEqual({
      statement: "Please provide your hypothesis",
      rationale: "Please provide your rationale",
      problemStatement: "Please select or propose a problem statement",
      domains: "Please select a problem statement first",
    });
  });

  it("preserves trimmed minimum lengths without rewriting the payload", () => {
    expect(validateHypothesisSubmission({ ...valid, statement: " 123456789 " })).toEqual({
      statement: "Hypothesis must be at least 10 characters",
    });
    expect(validateHypothesisSubmission({ ...valid, rationale: " 123456789 " })).toEqual({
      rationale: "Rationale must be at least 10 characters",
    });
    expect(
      validateHypothesisSubmission({
        ...valid,
        statement: " 1234567890 ",
        rationale: " 1234567890 ",
      }),
    ).toEqual({});
  });

  it("requires a domain for proposed questions", () => {
    expect(validateHypothesisSubmission({ ...valid, isProposingNew: true, domains: [] })).toEqual({
      domains: "Please select a domain for your new problem statement",
    });
  });
});
