import type { Domain } from "@/lib/types";
import clsx from "clsx";

const knownDomains: Record<string, { bg: string; text: string; ring: string }> = {
  persuasion: { bg: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-200" },
  memorability: { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200" },
};

const fallbackPalettes = [
  { bg: "bg-sky-50", text: "text-sky-700", ring: "ring-sky-200" },
  { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" },
  { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  { bg: "bg-indigo-50", text: "text-indigo-700", ring: "ring-indigo-200" },
  { bg: "bg-pink-50", text: "text-pink-700", ring: "ring-pink-200" },
  { bg: "bg-teal-50", text: "text-teal-700", ring: "ring-teal-200" },
];

function getConfig(domain: string) {
  if (knownDomains[domain]) return knownDomains[domain];
  let hash = 0;
  for (let i = 0; i < domain.length; i++) hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  return fallbackPalettes[Math.abs(hash) % fallbackPalettes.length];
}

interface DomainTagProps {
  domain: Domain;
  size?: "sm" | "md";
}

export function DomainTag({ domain, size = "sm" }: DomainTagProps) {
  const config = getConfig(domain);
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md font-medium capitalize ring-1 ring-inset",
        config.bg,
        config.text,
        config.ring,
        size === "sm" && "px-1.5 py-0.5 text-[11px]",
        size === "md" && "px-2 py-0.5 text-xs",
      )}
    >
      {domain}
    </span>
  );
}
