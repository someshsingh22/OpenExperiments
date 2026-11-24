---
name: OpenExperiments
description: An open lab notebook where anyone can propose, rank, and test hypotheses about human behaviour.
colors:
  ink: "#1c1917"
  paper: "#fafaf9"
  sheet: "#ffffff"
  graphite: "#57534e"
  pencil: "#78716c"
  rule: "#e7e5e4"
  ink-indigo: "#4f46e5"
  ink-indigo-wash: "#e0e7ff"
  error-red: "#b91c1c"
  status-sky: "#0369a1"
  status-teal: "#0f766e"
  status-amber: "#92400e"
typography:
  display:
    fontFamily: "STIX Two Text, Georgia, Times New Roman, serif"
    fontSize: "clamp(2.5rem, 1.6rem + 3.6vw, 3.75rem)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title:
    fontFamily: "STIX Two Text, Georgia, Times New Roman, serif"
    fontSize: "2.5rem"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  heading:
    fontFamily: "STIX Two Text, Georgia, Times New Roman, serif"
    fontSize: "1.375rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  statement:
    fontFamily: "STIX Two Text, Georgia, Times New Roman, serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.375
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  data:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    fontFeature: "tnum"
rounded:
  sm: "6px"
  md: "8px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "56px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  status-chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
---

# Design System: OpenExperiments

## Overview

**Creative North Star: "The Open Lab Notebook"**

OpenExperiments should read like a well-kept research notebook that anyone may open: quiet paper, dark ink, ruled lines, and claims written in the typeface of a scientific journal. The interface keeps out of the way, so hypotheses, evidence and numbers carry the page. It is calm without being bland. The serif signals that ideas here are treated as scholarship, and the rest of the UI stays plain enough that a first-time visitor never feels they need credentials to take part.

The system serves two audiences with equal weight: researchers, who scan for evidence, effect sizes and provenance, and the curious public, who need plain language and an obvious next step. Every page should work for both without a separate "expert mode".

**Key Characteristics:**

- Warm stone neutrals on near-white paper, one indigo ink for focus and selection.
- Serif for ideas (titles, hypothesis statements), sans for interface, mono for measurements.
- Flat surfaces separated by hairline rules rather than shadows.
- Accessible by default: WCAG 2.2 AA everywhere, AAA for body and secondary text.

## Colors

A near-monochrome stone palette with a single cool accent. Colour is used to carry status and focus, almost never for decoration.

### Primary

- **Ink Indigo** (ink-indigo): the only accent. Focus outlines, selected filters and active states. It never fills large areas; its scarcity is what makes focus easy to find.

### Neutral

- **Ink** (ink): headings, hypothesis statements, primary buttons.
- **Paper** (paper): page background, a faintly warm off-white.
- **Sheet** (sheet): cards, form fields and tables sit on pure white so they lift off the paper without shadow.
- **Graphite** (graphite): the floor for any secondary text (captions, metadata, helper text). About 7:1 on white.
- **Pencil** (pencil): placeholders and decorative icons only. Never for text a reader must read.
- **Rule** (rule): hairline borders and dividers.

### Status

- **Status Sky / Teal / Amber** mark lifecycle stage (arena-ranked, tested, field-validated) on pale washes of the same hue. Domain tags reuse the same tonal pattern (700-weight text on a 50-weight wash with a 200-weight ring).
- **Error Red** for validation messages, always paired with text, never colour alone.

### Named Rules

**The Graphite Floor Rule.** No text a reader needs is lighter than Graphite. Pencil exists for placeholders and icons only.

**The One Ink Rule.** Indigo means "you are here / this is selected". If it appears anywhere else, remove it.

## Typography

**Display, title and statement font:** STIX Two Text (with Georgia fallback)
**Interface font:** Geist (with system-ui fallback)
**Data font:** Geist Mono with tabular figures

**Character:** STIX Two is the face of scientific journals, so a hypothesis set in it reads as a claim worth examining. Geist keeps controls crisp and modern. Mono is reserved for numbers so that p-values, win rates and dates line up and look measured.

### Hierarchy

- **Display** (500, fluid 2.5–3.75rem, 1.05): the home hero only.
- **Title** (500, 2rem → 2.5rem at 40rem, 1.1): one per page, the page's h1.
- **Heading** (500, 1.375rem, 1.25): section h2s. Sub-sections use the same serif at 1.25rem.
- **Statement** (400, 1–1.125rem, snug): every rendering of a hypothesis statement, in cards, tables, arena matchups and profiles. The detail page uses it as its h1 at 1.5–1.875rem.
- **Body** (400, 0.875–1rem, 1.625): prose and descriptions, capped at about 65 characters per line.
- **Label** (500, 0.75rem): chips, metadata, table headers. 12px is the absolute minimum anywhere.
- **Data** (mono, tabular): p-values (APA style, `0.032` / `< 0.001`), effect sizes, confidence intervals, win rates, counts and dates (`Jan 5, 2026`, rendered in a `<time>` element).

### Named Rules

**The Ideas Wear Serif Rule.** If text is a hypothesis or a page title, it is STIX Two. If it is a control, it is Geist. There is no third option for prose.

**The Mono Means Measured Rule.** Monospace is for numbers and identifiers only. Never use it for labels, eyebrows or decoration.

**The 12px Floor Rule.** Nothing renders below 12px.

## Layout

Single-column reading pages sit in a 56rem container; browse pages (Explore, Data, Experiments) use a 64rem container with a responsive one-, two- or three-column card grid. Vertical rhythm is generous between sections (56px) and tight inside components (8–16px). Long-form text is capped at about 65ch. Tables scroll horizontally inside their container on narrow screens instead of truncating content.

Process sequences (the "How it works" steps) are an ordered list with a heavy ink rule above each step, not numbered cards.

## Elevation & Depth

Flat. Depth comes from tonal layering (white sheets on paper) and 1px Rule borders. The one shadow in use is a very soft lift on interactive hypothesis cards on hover; static content never moves or casts a shadow. No blur, no glass, no translucent headers: the navbar is solid white with a bottom rule.

### Named Rules

**The Solid Header Rule.** Nothing on this site is frosted. Translucent surfaces break contrast guarantees.

## Shapes

Gently softened rectangles: 6px corners on controls and chips, 8px on cards and panels, full rounding only for avatars and toggle switches. Borders are always 1px Rule, or 2px Ink for the editorial step rules.

## Components

### Buttons

- **Primary:** Ink fill, white Geist 14px semibold text, 6px corners, at least 44px tall. Hover shifts to a slightly lighter stone.
- **Secondary:** white sheet with a Rule border and Ink text. Same size and shape.
- **Icon buttons** (Star, Share, menu, close) always carry an accessible name and a 44×44px hit area, even when the visible glyph is smaller.

### Chips

Status and domain chips: 12px label text in the hue's 700 or 800 weight on its 50 wash, with a matching 200 ring and 6px corners. Filter chips are toggle buttons with `aria-pressed`; the selected one fills with Ink.

### Cards / Containers

White sheet, 1px Rule border, 8px corners, 16px padding. Cards never nest inside other cards; group related content with spacing and rules instead.

### Inputs / Fields

White sheet, 1px Rule border, 6px corners, Graphite-labelled with a visible `<label>` above every field. Placeholders are examples, not labels. Errors appear as Error Red 12px text under the field, linked with `aria-describedby` and `aria-invalid`.

### Navigation

Solid white bar with a bottom rule. Links are Graphite, the current page is Ink with `aria-current="page"`. The Submit menu is a disclosure button that opens on hover, click, Enter or Space and closes on Escape or outside click.

### Sign-in gate (signature component)

When a signed-out visitor reaches a form, show a white card stating plainly what will be asked and how long it takes, with one primary sign-in button. The real form is shown faded beneath it (inert, hidden from assistive tech) so nobody is asked to commit blind. Drafts autosave locally and survive the sign-in round trip.

### Sign-in dialog

A true modal dialog: labelled by its heading, focus moves in on open and returns to the opener on close, Tab is trapped, Escape closes it, and every field has a visible label and autocomplete hint.

## Do's and Don'ts

### Do:

- **Do** set every hypothesis statement in STIX Two, wherever it appears.
- **Do** keep secondary text at Graphite (#57534e) or darker.
- **Do** format p-values in APA style and dates as `Jan 5, 2026` via the shared formatters in `src/lib/format.ts`.
- **Do** give every icon-only control an accessible name and a 44px target.
- **Do** show what a form will ask before asking someone to sign in.
- **Do** cap prose at roughly 65 characters per line.

### Don't:

- **Don't** use eyebrow or kicker labels above headings.
- **Don't** use gradient text, decorative blurred blobs, glassmorphism or frosted headers.
- **Don't** use monospace for anything that isn't a measurement or identifier.
- **Don't** nest cards inside cards or number section headings with tiny "01 / 02 / 03" labels.
- **Don't** convey state through colour alone; pair it with text or an icon.
- **Don't** render any text below 12px or lighter than Graphite.
