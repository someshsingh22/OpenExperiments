import { HypothesisStatus, Phase } from "@/lib/types";
import { FlaskConical, ShieldCheck } from "lucide-react";
import clsx from "clsx";

const statusConfig: Record<
  HypothesisStatus,
  {
    label: string;
    bg: string;
    text: string;
    ring: string;
    icon?: React.ComponentType<{ className?: string }>;
  }
> = {
  proposed: {
    label: "Proposed",
    bg: "bg-stone-50",
    text: "text-stone-500",
    ring: "ring-stone-200",
  },
  arena_ranked: {
    label: "Arena Ranked",
    bg: "bg-sky-50",
    text: "text-sky-700",
    ring: "ring-sky-200",
  },
  data_tested: {
    label: "Tested",
    bg: "bg-teal-50",
    text: "text-teal-700",
    ring: "ring-teal-200",
    icon: FlaskConical,
  },
  field_validated: {
    label: "Field Validated",
    bg: "bg-amber-50",
    text: "text-amber-700",
    ring: "ring-amber-200",
    icon: ShieldCheck,
  },
};

interface EvidenceBadgeProps {
  status: HypothesisStatus;
  phase?: Phase;
  size?: "sm" | "md" | "lg";
}

export function EvidenceBadge({ status, phase, size = "md" }: EvidenceBadgeProps) {
  const isLive = phase === "live";
  const config = isLive
    ? {
        label: "Evaluating",
        bg: "bg-stone-50",
        text: "text-stone-400",
        ring: "ring-stone-200",
        icon: undefined,
      }
    : statusConfig[status];

  const Icon = config.icon;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md font-medium ring-1 ring-inset",
        config.bg,
        config.text,
        config.ring,
        size === "sm" && "px-1.5 py-0.5 text-[11px]",
        size === "md" && "px-2 py-0.5 text-xs",
        size === "lg" && "px-2.5 py-1 text-sm",
      )}
    >
      {Icon && (
        <Icon
          className={clsx(
            size === "sm" && "h-3 w-3",
            size === "md" && "h-3.5 w-3.5",
            size === "lg" && "h-4 w-4",
          )}
        />
      )}
      {config.label}
    </span>
  );
}
