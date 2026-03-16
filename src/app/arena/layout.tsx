import type { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Arena",
  description: `Vote on which hypothesis has more potential in head-to-head comparisons. Help rank ideas by plausibility, novelty, and impact on ${SITE_CONFIG.name}.`,
  openGraph: {
    title: `Hypothesis Arena | ${SITE_CONFIG.name}`,
    description:
      "Compare hypotheses head-to-head and vote on which has more scientific potential. Community-driven ranking.",
    url: `${SITE_CONFIG.url}/arena`,
  },
  alternates: { canonical: `${SITE_CONFIG.url}/arena` },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Hypothesis Arena",
  description: "Compare hypotheses head-to-head and vote on which has more scientific potential.",
  url: `${SITE_CONFIG.url}/arena`,
  isPartOf: { "@id": `${SITE_CONFIG.url}/#website` },
  mainEntity: {
    "@type": "ItemList",
    name: "Arena Rankings",
    description: "Community-ranked hypotheses by win rate in head-to-head comparisons",
    itemListOrder: "https://schema.org/ItemListOrderDescending",
  },
};

export default function ArenaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
