export function validateHypothesisSubmission(input: {
  statement: string;
  rationale: string;
  problemStatement: string;
  domains: string[];
  isProposingNew: boolean;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.statement.trim()) errors.statement = "Please provide your hypothesis";
  else if (input.statement.trim().length < 10)
    errors.statement = "Hypothesis must be at least 10 characters";
  if (!input.rationale.trim()) errors.rationale = "Please provide your rationale";
  else if (input.rationale.trim().length < 10)
    errors.rationale = "Rationale must be at least 10 characters";
  if (!input.problemStatement.trim())
    errors.problemStatement = "Please select or propose a problem statement";
  if (input.domains.length === 0) {
    errors.domains = input.isProposingNew
      ? "Please select a domain for your new problem statement"
      : "Please select a problem statement first";
  }
  return errors;
}
