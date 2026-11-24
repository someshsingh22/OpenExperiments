"use client";

import type { ReactNode } from "react";

interface SignInPromptProps {
  title: string;
  items: ReactNode[];
  duration: string;
  actionLabel: string;
  onSignIn: () => void;
}

/** Explains what a gated form will ask for before the visitor signs in. */
export function SignInPrompt({ title, items, duration, actionLabel, onSignIn }: SignInPromptProps) {
  return (
    <section
      aria-labelledby="sign-in-prompt-title"
      className="mb-10 rounded-lg border border-stone-300 bg-white p-6 sm:p-8"
    >
      <h2 id="sign-in-prompt-title" className="font-serif text-xl font-medium text-stone-900">
        {title}
      </h2>
      <p className="mt-3 text-sm text-stone-700">You&rsquo;ll be asked for:</p>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-stone-700 marker:text-stone-600">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-stone-600">{duration}</p>
      <button
        type="button"
        onClick={onSignIn}
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg border border-stone-900 bg-stone-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-800"
      >
        {actionLabel}
      </button>
    </section>
  );
}

interface GatedPreviewProps {
  locked: boolean;
  children: ReactNode;
}

/**
 * Wraps a form so signed-out visitors see it faded and non-interactive.
 * The wrapper is always rendered so the form is not remounted when `locked` changes.
 */
export function GatedPreview({ locked, children }: GatedPreviewProps) {
  return (
    <div
      inert={locked}
      aria-hidden={locked || undefined}
      className={locked ? "pointer-events-none opacity-50 select-none" : undefined}
    >
      {children}
    </div>
  );
}
