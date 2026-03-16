export const runtime = "edge";

import { ImageResponse } from "next/og";

export async function GET() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#fafaf9",
        fontFamily: "system-ui, sans-serif",
        padding: "60px",
      }}
    >
      <div
        style={{
          fontSize: "20px",
          fontWeight: 600,
          letterSpacing: "0.2em",
          color: "#a8a29e",
          textTransform: "uppercase",
          marginBottom: "20px",
        }}
      >
        OpenExperiments
      </div>
      <div
        style={{
          fontSize: "56px",
          fontWeight: 700,
          color: "#1c1917",
          textAlign: "center",
          lineHeight: 1.2,
          marginBottom: "24px",
        }}
      >
        Democratising Science
      </div>
      <div
        style={{
          fontSize: "22px",
          color: "#78716c",
          textAlign: "center",
          maxWidth: "800px",
          lineHeight: 1.5,
        }}
      >
        An open platform where anyone can submit scientific hypotheses, have the community evaluate
        them, and see them tested against real-world data.
      </div>
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginTop: "40px",
        }}
      >
        {["Ideate", "Evaluate", "Validate"].map((step, i) => (
          <div
            key={step}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              borderRadius: "8px",
              border: "1px solid #d6d3d1",
              backgroundColor: "#ffffff",
            }}
          >
            <span style={{ fontWeight: 700, color: "#a8a29e", fontSize: "14px" }}>0{i + 1}</span>
            <span style={{ fontWeight: 600, color: "#1c1917", fontSize: "16px" }}>{step}</span>
          </div>
        ))}
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
