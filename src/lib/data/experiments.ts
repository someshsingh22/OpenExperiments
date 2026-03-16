import { Experiment } from "../types";

export const experiments: Experiment[] = [
  {
    id: "exp-1",
    hypothesisId: "h-1",
    type: "observational",
    status: "completed",
    datasetName: "Reddit ChangeMyView",
    methodology:
      "Logistic regression on 4,000 CMV posts. Features: acknowledgment presence (LLM-annotated), argument length, citation count, response position. Covariates: topic, time of day, author karma. Bonferroni-corrected across 4 refinement steps.",
    results: {
      pValue: 0.0003,
      effectSize: 0.41,
      confidenceInterval: [0.28, 0.54],
      sampleSize: 4000,
      summary:
        "Counterarguments containing explicit acknowledgment of the OP's position show a significant positive association with opinion change (OR = 1.51, p < 0.001), robust after controlling for length, citations, and response timing.",
    },
    startedAt: "2025-09-20",
    completedAt: "2025-09-22",
    osfLink: "https://osf.io/",
    version: 1,
  },
  {
    id: "exp-2",
    hypothesisId: "h-1",
    type: "ab_test",
    status: "completed",
    datasetName: "Fortune 500 Consumer Brand",
    methodology:
      "Online A/B experiment. 50/50 traffic split between business-as-usual control and challenger implementing the hypothesized design. Primary metric: newsletter sign-ups. Two-proportion z-test.",
    results: {
      pValue: 1e-6,
      effectSize: 3.44,
      confidenceInterval: [2.8, 4.1],
      sampleSize: 18500,
      summary:
        "The challenger produced 15,100 sign-ups versus 3,400 for control -- a +344% uplift in sign-ups. At a conservative cost-per-click of $0.22, equivalent sign-ups via paid traffic would cost ~$29,570 per week.",
      uplift: "+344%",
    },
    startedAt: "2025-10-01",
    completedAt: "2025-10-22",
    osfLink: "https://osf.io/",
    version: 1,
  },
  {
    id: "exp-3",
    hypothesisId: "h-2",
    type: "observational",
    status: "completed",
    datasetName: "Reddit ChangeMyView",
    methodology:
      "Within-thread ranking analysis. Computed response position for each reply. Logistic regression predicting delta-award with position rank, controlling for length, time-of-day, and author history. Bonferroni correction over 4 tests.",
    results: {
      pValue: 0.001,
      effectSize: 0.38,
      confidenceInterval: [0.22, 0.54],
      sampleSize: 4000,
      summary:
        "First-three responders achieve 19.9% opinion change rate versus 9.5% for later responders (OR = 2.1, p = 0.001). Effect is robust after controlling for argument quality proxies.",
    },
    startedAt: "2025-10-05",
    completedAt: "2025-10-06",
    osfLink: "https://osf.io/",
    version: 1,
  },
  {
    id: "exp-4",
    hypothesisId: "h-3",
    type: "observational",
    status: "completed",
    datasetName: "LaMem",
    methodology:
      "Paired comparison of visually similar images. LLM-annotated features: face presence, context congruence, scene category. Binomial test on preference within face-present pairs, stratified by congruence. Bonferroni correction over 3 tests.",
    results: {
      pValue: 0.004,
      effectSize: 0.29,
      confidenceInterval: [0.12, 0.46],
      sampleSize: 1200,
      summary:
        "Among image pairs where both contain faces, the image with the incongruent context is preferred as more memorable 68.3% of the time (binomial p = 0.004).",
    },
    startedAt: "2025-11-10",
    completedAt: "2025-11-11",
    osfLink: "https://osf.io/",
    version: 1,
  },
  {
    id: "exp-5",
    hypothesisId: "h-4",
    type: "observational",
    status: "completed",
    datasetName: "Reddit ChangeMyView",
    methodology:
      "LLM-annotated framing type (binary vs. spectrum) for 2,500 counterarguments. Logistic regression on opinion change controlling for length, acknowledgment, and citations.",
    results: {
      pValue: 0.002,
      effectSize: 0.33,
      confidenceInterval: [0.18, 0.48],
      sampleSize: 2500,
      summary:
        "Counterarguments that frame the issue as a spectrum rather than a binary choice are associated with 1.4x higher opinion change rate (p = 0.002).",
    },
    startedAt: "2025-10-22",
    completedAt: "2025-10-23",
    osfLink: "https://osf.io/",
    version: 1,
  },
  {
    id: "exp-6",
    hypothesisId: "h-12",
    type: "observational",
    status: "completed",
    datasetName: "Reddit ChangeMyView",
    methodology:
      "Interaction analysis between accuracy-motivating elements (citations, data references) and identity-relevant topic classification. Two-way logistic regression with interaction term, controlling for length and position.",
    results: {
      pValue: 0.0008,
      effectSize: 0.36,
      confidenceInterval: [0.2, 0.52],
      sampleSize: 3800,
      summary:
        "The interaction between accuracy cues and identity-relevance produces a significant amplification (interaction OR = 1.65, p < 0.001), counter to identity-protective cognition predictions.",
    },
    startedAt: "2025-10-30",
    completedAt: "2025-11-01",
    osfLink: "https://osf.io/",
    version: 1,
  },
  {
    id: "exp-7",
    hypothesisId: "h-10",
    type: "observational",
    status: "completed",
    datasetName: "LaMem",
    methodology:
      "Color palette extraction using k-means clustering on pixel values. Warm/cool classification based on dominant hue. Paired comparison within visually similar pairs, controlling for scene category and complexity.",
    results: {
      pValue: 0.032,
      effectSize: 0.15,
      confidenceInterval: [0.01, 0.29],
      sampleSize: 800,
      summary:
        "Warm-palette images show a modest memorability advantage (57.2% preference rate, p = 0.032), but effect size is small and may be confounded with content type.",
    },
    startedAt: "2025-12-02",
    completedAt: "2025-12-03",
    osfLink: "https://osf.io/",
    version: 1,
  },
  {
    id: "exp-8",
    hypothesisId: "h-8",
    type: "observational",
    status: "completed",
    datasetName: "Reddit ChangeMyView",
    methodology:
      "Narrative structure annotation via LLM (personal story vs. abstract argument). Logistic regression controlling for length, position, citations, and acknowledgment.",
    results: {
      pValue: 0.018,
      effectSize: 0.19,
      confidenceInterval: [0.04, 0.34],
      sampleSize: 3200,
      summary:
        "Personal narratives show a positive association with opinion change (OR = 1.22, p = 0.018), but effect attenuates after controlling for argument length.",
    },
    startedAt: "2025-11-24",
    completedAt: "2025-11-25",
    osfLink: "https://osf.io/",
    version: 1,
  },
];
