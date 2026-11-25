"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { ProblemStatement } from "@/lib/types";

export type OpenQuestion = Omit<ProblemStatement, "datasets"> & {
  datasets?: { name: string }[];
};

export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function OpenQuestionsCarousel({ problems }: { problems: OpenQuestion[] }) {
  // Server render keeps a stable order; shuffle after hydration so every visit differs.
  const [ordered, setOrdered] = useState(problems);
  const [edges, setEdges] = useState({ start: true, end: problems.length <= 2 });
  const track = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setOrdered(shuffled(problems));
    track.current?.scrollTo({ left: 0 });
  }, [problems]);

  const updateEdges = () => {
    const el = track.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  };

  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [ordered]);

  const page = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
  };

  if (problems.length === 0) return null;

  const button =
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 transition-colors hover:border-stone-400 hover:text-stone-900 disabled:cursor-default disabled:opacity-35 disabled:hover:border-stone-300";

  return (
    <section className="border-b border-stone-200 bg-white" aria-labelledby="open-questions">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="open-questions" className="type-heading text-stone-900">
              Open questions
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/explore"
              className="mr-2 inline-flex items-center gap-1 text-sm font-medium text-stone-700 hover:text-stone-900"
            >
              All questions <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <button
              type="button"
              className={button}
              onClick={() => page(-1)}
              disabled={edges.start}
              aria-label="Previous questions"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={button}
              onClick={() => page(1)}
              disabled={edges.end}
              aria-label="Next questions"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <ul
          ref={track}
          onScroll={updateEdges}
          className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:thin] sm:mx-0 sm:scroll-px-0 sm:px-0"
          aria-label="Open research questions"
        >
          {ordered.map((ps) => (
            <li key={ps.id} className="flex w-[85%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)]">
              <Link
                href={`/explore?ps=${ps.id}`}
                className="group flex w-full flex-col rounded-lg border border-stone-200 bg-stone-50/50 p-5 transition-colors duration-300 hover:border-stone-300 hover:bg-white hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
              >
                <span className="mb-1 block text-xs font-semibold tracking-wide text-stone-600 uppercase">
                  {ps.domain}
                </span>
                <h3 className="mb-1.5 text-base font-semibold text-stone-900 group-hover:text-black">
                  {ps.question}
                </h3>
                <p className="mb-3 line-clamp-3 text-sm text-stone-600">{ps.description}</p>
                <span className="mt-auto text-xs text-stone-600">
                  {ps.hypothesisCount} {ps.hypothesisCount === 1 ? "hypothesis" : "hypotheses"}
                  {ps.datasets && ps.datasets.length > 0
                    ? ` \u00B7 ${ps.datasets.map((d) => d.name).join(", ")}`
                    : " \u00B7 Dataset pending"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
