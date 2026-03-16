export const runtime = "edge";

import { ImageResponse } from "next/og";
import { getDB } from "@/db";
import { hypotheses } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Missing id", { status: 400 });
  }

  let statement = "Hypothesis";
  let domains: string[] = [];
  let status = "proposed";
  let source = "human";

  try {
    const db = getDB();
    const [h] = await db.select().from(hypotheses).where(eq(hypotheses.id, id)).limit(1);
    if (h) {
      statement = h.statement;
      domains = h.domains as string[];
      status = h.status;
      source = h.source;
    }
  } catch {
    // Fallback to generic image
  }

  const statusLabel =
    status === "field_validated"
      ? "Field Validated"
      : status === "data_tested"
        ? "Data Tested"
        : status === "arena_ranked"
          ? "Arena Ranked"
          : "Proposed";

  const statusColor =
    status === "field_validated"
      ? "#059669"
      : status === "data_tested"
        ? "#0d9488"
        : status === "arena_ranked"
          ? "#6366f1"
          : "#78716c";

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#fafaf9",
        padding: "60px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "40px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#1c1917",
              letterSpacing: "-0.5px",
            }}
          >
            OpenExperiments
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <div
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 600,
              color: statusColor,
              backgroundColor: `${statusColor}15`,
              border: `1px solid ${statusColor}30`,
            }}
          >
            {statusLabel}
          </div>
          {source === "ai_agent" && (
            <div
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#6366f1",
                backgroundColor: "#eef2ff",
                border: "1px solid #c7d2fe",
              }}
            >
              AI Generated
            </div>
          )}
        </div>
      </div>

      {/* Statement */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontSize: statement.length > 120 ? "32px" : "40px",
            fontWeight: 600,
            color: "#1c1917",
            lineHeight: 1.3,
            maxHeight: "320px",
            overflow: "hidden",
          }}
        >
          {statement.length > 200 ? `${statement.slice(0, 197)}...` : statement}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "40px",
          paddingTop: "20px",
          borderTop: "1px solid #e7e5e4",
        }}
      >
        <div style={{ display: "flex", gap: "8px" }}>
          {domains.slice(0, 3).map((d) => (
            <div
              key={d}
              style={{
                padding: "5px 12px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#57534e",
                backgroundColor: "#f5f5f4",
                border: "1px solid #d6d3d1",
                textTransform: "capitalize",
              }}
            >
              {d}
            </div>
          ))}
        </div>
        <div
          style={{
            fontSize: "16px",
            color: "#a8a29e",
          }}
        >
          openexperiments.ai
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
