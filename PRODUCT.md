# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two primary audiences, weighted equally:

- **Researchers** (social scientists, graduate students, data scientists) who browse hypotheses that have already passed statistical scrutiny, inspect datasets and experiment results, find their next research question, and commission field experiments.
- **The curious public** (professionals, students, anyone with an idea) who propose a hypothesis about a domain where observational data exists, vote in the Arena, and follow their idea as it is tested.

AI agents also submit and test hypotheses through the MCP server (`mcp-server/`); humans review the results.

## Product Purpose

OpenExperiments exists to democratise and accelerate science. Anyone, human or AI, can submit a scientific hypothesis, have the community evaluate it, and see it tested against real-world data. Success means a passing observation becomes a rigorously tested, openly published finding, and researchers trust the results enough to build on them.

## Positioning

Powered by ExperiGen (arXiv:2602.07983), an agentic framework in which a Generator proposes hypotheses and an Experimenter tests them with statistical controls, in a loop inspired by Bayesian optimization. OpenExperiments pairs that automated discovery with open community ranking and a public, research-registry-grade record of datasets, tests and results.

## Operating Context

- Hypothesis lifecycle: `proposed → arena_ranked → data_tested → field_validated`. User-facing names for these stages are not yet unified (open decision; see below).
- Arena: blind pairwise voting with Elo ranking; scores are revealed only after a vote.
- Datasets: `ds-1` Reddit ChangeMyView, `ds-2` LaMem, `ds-3` Twitter Persuasion Pairs, `ds-4` Visual Attention & Memorability.
- Experiment results are reported the way a paper reports them: p-value, effect size, sample size, 95% CI.
- Hypotheses carry BibTeX citations; datasets carry provenance, stopping rules and limitations (OSF-style registration).
- Sign-in is Google OAuth; submitting hypotheses or datasets requires an account, voting does not.

## Capabilities and Constraints

- Next.js 15 App Router on Cloudflare Pages, Edge Runtime only; D1 via Drizzle; Tailwind CSS v4.
- Routes: home, explore, arena, hypothesis detail, experiments (+ detail), data (+ detail, submit), submit, profile, contribute, about, complete-profile.
- Open decision: one canonical set of user-facing lifecycle stage names, and plain-language definitions of "win rate", "Evidence Score" and "Foreknowledge".

## Brand Commitments

- Name: OpenExperiments. Tagline: "Democratising Science". Domain: openexperiments.ai.
- Voice: plain, evidence-first, open-science; claims are always backed by the paper or the data.
- The user has asked for an editorial, lab-notebook character (recorded here as a binding direction; visual specifics live in DESIGN.md).

## Evidence on Hand

Confirmed against arXiv:2602.07983 (may be surfaced anywhere):

- Best performance on 9/10 benchmark settings.
- 2–4× more statistically significant hypotheses, 7–17% more predictive than prior approaches.
- False discovery rate below 5% vs 20–25% for prior methods (manual review by data scientists).
- ~40% of significant hypotheses not documented in prior peer-reviewed work.
- Expert review of 25 hypotheses by senior faculty: 88% moderately or strongly novel, 70% impactful and worth pursuing.
- First A/B test of LLM-generated hypotheses, with a Fortune 500 consumer brand: +344% effect, p < 10⁻⁶.

Do not fabricate: user counts, testimonials, partner names beyond "a Fortune 500 consumer brand", or activity numbers not drawn from the database. Note: `/about` currently says "76% research-worthy"; the paper says 70%.

## Product Principles

1. **Evidence before assertion.** Every number shown is traceable to data or the paper.
2. **Open by default.** Methods, data provenance and results are public and citable.
3. **Anyone can start, rigor decides.** Low barrier to propose; the lifecycle, not status, decides what advances.
4. **Unbiased evaluation.** Blind voting stays blind until the vote is cast.

## Accessibility & Inclusion

WCAG 2.2 AAA where practical, AA as the minimum: 4.5:1 text contrast (7:1 for body text where feasible), 44×44px touch targets, full keyboard operability, labelled form controls, and visible focus.
