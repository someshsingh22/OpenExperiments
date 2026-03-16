import type { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Submit a Hypothesis",
  description: `Have a theory about human behaviour, persuasion, or perception? Submit it on ${SITE_CONFIG.name}. No credentials required. We bring the data and experiments.`,
  openGraph: {
    title: `Submit a Hypothesis | ${SITE_CONFIG.name}`,
    description:
      "Share your scientific idea. The community evaluates it and AI agents test it against real-world data.",
    url: `${SITE_CONFIG.url}/submit`,
  },
  alternates: { canonical: `${SITE_CONFIG.url}/submit` },
};

export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return children;
}
