import { Domain } from "@/lib/types";
import clsx from "clsx";

const domainConfig: Record<Domain, { bg: string; text: string; ring: string }> = {
  persuasion: { bg: "bg-violet-50", text: "text-violet-600", ring: "ring-violet-200" },
  memorability: { bg: "bg-rose-50", text: "text-rose-600", ring: "ring-rose-200" },
};

interface DomainTagProps {
  domain: Domain;
  size?: "sm" | "md";
}

export function DomainTag({ domain, size = "sm" }: DomainTagProps) {
  const config = domainConfig[domain];
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
