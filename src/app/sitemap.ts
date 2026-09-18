import type { MetadataRoute } from "next";
import { SITE_CONFIG } from "@/lib/constants";
import { getDB } from "@/db";
import { hypotheses } from "@/db/schema";
import { cachedQuery } from "@/lib/edge-cache";

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
    // Crawlers hit /sitemap.xml often; cache the full-table scan for an hour
    // instead of reading every hypothesis row on each request.
    const allHypotheses = await cachedQuery("sitemap:hyps", 3600, () => {
      const db = getDB();
      return db.select({ id: hypotheses.id, updatedAt: hypotheses.updatedAt }).from(hypotheses);
    });

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
