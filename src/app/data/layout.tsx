import type { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Datasets",
  description: `Explore curated Hugging Face datasets powering hypothesis testing on ${SITE_CONFIG.name}. Each comes with task descriptions, schemas, and links to problem statements.`,
  openGraph: {
    title: `Datasets | ${SITE_CONFIG.name}`,
    description:
      "Curated datasets for hypothesis testing. Persuasion, memorability, and more domains with clear schemas and task descriptions.",
    url: `${SITE_CONFIG.url}/data`,
  },
  alternates: { canonical: `${SITE_CONFIG.url}/data` },
};

export default function DataLayout({ children }: { children: React.ReactNode }) {
  return children;
}
