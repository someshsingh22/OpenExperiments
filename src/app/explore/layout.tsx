import type { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Explore Hypotheses",
  description: `Browse and search community-submitted hypotheses on ${SITE_CONFIG.name}. Filter by domain, status, and more. From persuasion to memorability and beyond.`,
  openGraph: {
    title: `Explore Hypotheses | ${SITE_CONFIG.name}`,
    description:
      "Browse community-submitted scientific hypotheses. Filter by domain, phase, and rating.",
    url: `${SITE_CONFIG.url}/explore`,
  },
  alternates: { canonical: `${SITE_CONFIG.url}/explore` },
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
