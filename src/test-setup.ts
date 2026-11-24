import { vi } from "vitest";

// Route tests mock getDB with exact query chains; keep the limiter out of them.
// src/lib/rate-limit.test.ts exercises the real implementation.
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  enforceRateLimit: vi.fn(async () => null),
}));
