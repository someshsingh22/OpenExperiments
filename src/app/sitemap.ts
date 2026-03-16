import type { MetadataRoute } from "next";
import { SITE_CONFIG } from "@/lib/constants";
import { getDB } from "@/db";
import { hypotheses } from "@/db/schema";

export const runtime = "edge";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_CONFIG.url,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_CONFIG.url}/explore`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_CONFIG.url}/arena`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_CONFIG.url}/submit`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_CONFIG.url}/data`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_CONFIG.url}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_CONFIG.url}/contribute`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // Dynamic hypothesis pages
  let hypothesisPages: MetadataRoute.Sitemap = [];
  try {
    const db = getDB();
    const allHypotheses = await db
      .select({ id: hypotheses.id, updatedAt: hypotheses.updatedAt })
      .from(hypotheses);

    hypothesisPages = allHypotheses.map((h) => ({
      url: `${SITE_CONFIG.url}/hypothesis/${h.id}`,
      lastModified: new Date(h.updatedAt * 1000),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // DB not available during build — return static pages only
  }

  return [...staticPages, ...hypothesisPages];
}
