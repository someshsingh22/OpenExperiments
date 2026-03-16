import type { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Experiments",
  description: `View and submit experiments on ${SITE_CONFIG.name}. Observational studies, A/B tests, and pre-registered field experiments testing community hypotheses.`,
  openGraph: {
    title: `Experiments | ${SITE_CONFIG.name}`,
    description:
      "Scientific experiments testing community-submitted hypotheses with rigorous statistical methods.",
    url: `${SITE_CONFIG.url}/experiments`,
  },
  alternates: { canonical: `${SITE_CONFIG.url}/experiments` },
};

export default function ExperimentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
