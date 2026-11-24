import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { eq } from "drizzle-orm";

const mocks = vi.hoisted(() => ({
  getDB: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  image: vi.fn(),
}));

vi.mock("@/db", () => ({ getDB: mocks.getDB }));
vi.mock("next/og", () => ({
  ImageResponse: class extends Response {
    constructor(element: ReactElement, options: ResponseInit) {
      super(renderToStaticMarkup(element), options);
      mocks.image(element, options);
    }
  },
}));

import { GET } from "./route";
import { hypotheses } from "@/db/schema";

function request(id?: string) {
  return new Request(`https://openexperiments.ai/api/og/hypothesis${id ? `?id=${id}` : ""}`);
}

describe("hypothesis OG image", () => {
  beforeEach(() => {
    mocks.getDB.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ from: mocks.from });
    mocks.from.mockReturnValue({ where: mocks.where });
    mocks.where.mockReturnValue({ limit: mocks.limit });
    mocks.limit.mockResolvedValue([]);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("rejects a missing id without reading the DB or generating an image", async () => {
    const response = await GET(request());
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Missing id");
    expect(mocks.getDB).not.toHaveBeenCalled();
    expect(mocks.image).not.toHaveBeenCalled();
  });

  it("selects only the rendered columns and retains successful-image caching", async () => {
    mocks.limit.mockResolvedValue([
      {
        statement: "A scientific hypothesis",
        domains: ["science", "memory", "vision", "unused"],
        status: "field_validated",
        source: "ai_agent",
      },
    ]);
    const response = await GET(request("h-1"));
    expect(mocks.select).toHaveBeenCalledExactlyOnceWith({
      statement: hypotheses.statement,
      domains: hypotheses.domains,
      status: hypotheses.status,
      source: hypotheses.source,
    });
    expect(mocks.from).toHaveBeenCalledWith(hypotheses);
    expect(mocks.where).toHaveBeenCalledExactlyOnceWith(eq(hypotheses.id, "h-1"));
    expect(mocks.limit).toHaveBeenCalledExactlyOnceWith(1);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    );
    const body = await response.text();
    expect(body).toContain("A scientific hypothesis");
    expect(body).toContain("Field Validated");
    expect(body).toContain("AI Generated");
    expect(body).not.toContain("unused");
    expect(mocks.image).toHaveBeenCalledTimes(1);
    expect(mocks.image.mock.calls[0][1]).toMatchObject({ width: 1200, height: 630 });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("briefly caches the existing fallback image for an absent hypothesis", async () => {
    const response = await GET(request("absent"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=60");
    expect(await response.text()).toContain("Hypothesis");
    expect(mocks.image).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each(["connection", "query"])(
    "never caches a %s failure and logs without exposing the error or requested id",
    async (stage) => {
      const error = new Error("private database binding and credentials");
      if (stage === "connection")
        mocks.getDB.mockImplementationOnce(() => {
          throw error;
        });
      else mocks.limit.mockRejectedValueOnce(error);

      const response = await GET(request("private-id"));
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.text()).toContain("Hypothesis");
      expect(mocks.image).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledExactlyOnceWith(
        "[og/hypothesis] Failed to load hypothesis; returning fallback image.",
      );
    },
  );

  it("uses normal caching after a transient query failure recovers", async () => {
    mocks.limit
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValueOnce([
        { statement: "Recovered", domains: [], status: "proposed", source: "human" },
      ]);
    expect((await GET(request("h-1"))).headers.get("Cache-Control")).toBe("no-store");
    const recovered = await GET(request("h-1"));
    expect(recovered.headers.get("Cache-Control")).toContain("s-maxage=86400");
    expect(await recovered.text()).toContain("Recovered");
  });

  it("uses normal caching when a previously absent hypothesis is created", async () => {
    mocks.limit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { statement: "New hypothesis", domains: [], status: "proposed", source: "human" },
      ]);
    expect((await GET(request("h-1"))).headers.get("Cache-Control")).toBe(
      "public, max-age=60, s-maxage=60",
    );
    const created = await GET(request("h-1"));
    expect(created.headers.get("Cache-Control")).toContain("s-maxage=86400");
    expect(await created.text()).toContain("New hypothesis");
  });
});
