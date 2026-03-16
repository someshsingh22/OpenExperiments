export const runtime = "edge";

import { cache } from "react";
import type { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/constants";
import { getDB } from "@/db";
import { hypotheses } from "@/db/schema";
import { eq } from "drizzle-orm";

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

const getHypothesisData = cache(async (id: string) => {
  try {
    const db = getDB();
    const [h] = await db.select().from(hypotheses).where(eq(hypotheses.id, id)).limit(1);
    return h ?? null;
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const h = await getHypothesisData(id);

  if (!h) {
    return {
      title: "Hypothesis Not Found",
    };
  }

  const domains = (h.domains as string[]).join(", ");
  const statusLabel =
    h.status === "field_validated"
      ? "Field Validated"
      : h.status === "data_tested"
        ? "Data Tested"
        : h.status === "arena_ranked"
          ? "Arena Ranked"
          : "Proposed";
  const description = h.rationale
    ? `${h.rationale.slice(0, 155)}${h.rationale.length > 155 ? "..." : ""}`
    : h.statement;
  const url = `${SITE_CONFIG.url}/hypothesis/${id}`;

  return {
    title: h.statement,
    description,
    openGraph: {
      type: "article",
      title: h.statement,
      description,
      url,
      siteName: SITE_CONFIG.name,
      publishedTime: new Date(h.submittedAt * 1000).toISOString(),
      modifiedTime: new Date(h.updatedAt * 1000).toISOString(),
      tags: [statusLabel, ...(h.domains as string[])],
      images: [
        {
          url: `/api/og/hypothesis?id=${id}`,
          width: 1200,
          height: 630,
          alt: h.statement,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: h.statement,
      description,
      images: [`/api/og/hypothesis?id=${id}`],
    },
    alternates: { canonical: url },
    other: {
      citation_title: h.statement,
      citation_publication_date: new Date(h.submittedAt * 1000).toISOString().split("T")[0],
      citation_online_date: new Date(h.submittedAt * 1000).toISOString().split("T")[0],
      citation_publisher: SITE_CONFIG.name,
      citation_abstract_html_url: url,
      ...(domains ? { citation_keywords: domains } : {}),
    },
  };
}

export default async function HypothesisLayout({ params, children }: Props) {
  const { id } = await params;
  const h = await getHypothesisData(id);

  if (!h) return <>{children}</>;

  const domains = h.domains as string[];
  const statusLabel =
    h.status === "field_validated"
      ? "Field Validated"
      : h.status === "data_tested"
        ? "Data Tested"
        : h.status === "arena_ranked"
          ? "Arena Ranked"
          : "Proposed";
  const url = `${SITE_CONFIG.url}/hypothesis/${id}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Claim",
    name: h.statement,
    description: h.rationale,
    url,
    datePublished: new Date(h.submittedAt * 1000).toISOString(),
    dateModified: new Date(h.updatedAt * 1000).toISOString(),
    author:
      h.source === "ai_agent"
        ? {
            "@type": "SoftwareApplication",
            name: h.agentName ?? "AI Agent",
          }
        : {
            "@type": "Person",
            name: "Community Contributor",
          },
    isPartOf: {
      "@type": "WebSite",
      "@id": `${SITE_CONFIG.url}/#website`,
      name: SITE_CONFIG.name,
    },
    about: domains.map((d) => ({
      "@type": "Thing",
      name: d,
    })),
    ...(h.evidenceScore != null
      ? {
          reviewRating: {
            "@type": "Rating",
            ratingValue: h.evidenceScore,
            bestRating: 100,
            worstRating: 0,
          },
        }
      : {}),
    keywords: [statusLabel, ...domains].join(", "),
    ...(h.citationDois && (h.citationDois as string[]).length > 0
      ? {
          citation: (h.citationDois as string[]).map((doi) => ({
            "@type": "ScholarlyArticle",
            identifier: doi,
            url: doi.startsWith("http") ? doi : `https://doi.org/${doi}`,
          })),
        }
      : {}),
  };

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
