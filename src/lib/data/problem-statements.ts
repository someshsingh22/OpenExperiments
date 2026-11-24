import { ProblemStatement } from "../types";
import catalog from "./research-catalog.json";

export const problemStatements: ProblemStatement[] = catalog.problemStatements.map((ps) => ({
  ...ps,
  hypothesisCount: 0,
}));
