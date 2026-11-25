import type { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Arena",
  description: `Vote for the hypotheses that interest you most and help decide which ideas get tested on ${SITE_CONFIG.name}.`,
  openGraph: {
    title: `Hypothesis Arena | ${SITE_CONFIG.name}`,
    description: "Vote for the hypotheses that interest you most. Community-driven ranking.",
    url: `${SITE_CONFIG.url}/arena`,
  },
  alternates: { canonical: `${SITE_CONFIG.url}/arena` },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Hypothesis Arena",
  description: "Vote for the hypotheses that interest you most.",
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
