import { Comment } from "../types";

export const comments: Comment[] = [
  {
    id: "c-1",
    hypothesisId: "h-1",
    body: "This aligns with Petty & Cacioppo's Elaboration Likelihood Model -- acknowledgment may function as a peripheral cue that increases processing motivation.",
    doi: "10.1016/S0065-2601(08)60214-2",
    createdAt: "2025-09-18",
  },
  {
    id: "c-2",
    hypothesisId: "h-1",
    body: "I wonder if this effect is moderated by topic sensitivity. On highly polarized topics, acknowledgment might be seen as weakness rather than good faith.",
    createdAt: "2025-09-20",
  },
  {
    id: "c-3",
    hypothesisId: "h-1",
    body: "The effect size of 0.41 is substantial for this kind of naturalistic data. Would be interesting to see if it replicates in controlled settings.",
    createdAt: "2025-09-25",
    parentId: "c-2",
  },
  {
    id: "c-4",
    hypothesisId: "h-3",
    body: "This is consistent with the prediction error framework in neuroscience. Incongruent contexts should generate larger hippocampal responses.",
    doi: "10.1038/nn.4135",
    createdAt: "2025-11-12",
  },
  {
    id: "c-5",
    hypothesisId: "h-4",
    body: "Fascinating -- this connects to the literature on 'attitude latitude' from Social Judgment Theory. Expanding the latitude of acceptance should indeed facilitate persuasion.",
    createdAt: "2025-10-25",
  },
  {
    id: "c-6",
    hypothesisId: "h-12",
    body: "This is genuinely surprising. I would not have predicted this interaction from the identity-protective cognition literature. The experimental design here is rigorous.",
    createdAt: "2025-11-02",
  },
  {
    id: "c-7",
    hypothesisId: "h-2",
    body: "Could this simply be a selection effect? Better arguers might also be faster responders. The position effect may be confounded with argument quality.",
    createdAt: "2025-10-08",
  },
  {
    id: "c-8",
    hypothesisId: "h-2",
    body: "Good point, but the paper controls for argument quality proxies (length, citations, acknowledgment). The timing effect persists after those controls.",
    createdAt: "2025-10-10",
    parentId: "c-7",
  },
];
