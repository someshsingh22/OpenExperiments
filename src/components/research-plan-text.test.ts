import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResearchPlanText } from "./research-plan-text";

describe("research plan text", () => {
  it("renders hypotheses, sections, links and fenced analysis code without interpreting HTML", () => {
    const html = renderToStaticMarkup(
      createElement(ResearchPlanText, {
        text:
          "## Statistical models\n\n**Secondary hypothesis:** Retain the `consensus_gap`.\n\n" +
          "See [OSF](https://osf.io/tx5zs/).\n\n```python\nx = '<script>alert(1)</script>'\n```\n\n" +
          '<img src=x onerror="alert(1)">',
      }),
    );
    expect(html).toContain("<h3");
    expect(html).toContain(">Statistical models</h3>");
    expect(html).toContain(">Secondary hypothesis:</strong>");
    expect(html).toContain('href="https://osf.io/tx5zs/"');
    expect(html).toContain('aria-label="Analysis code"');
    expect(html).toContain("<code>x =");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("```");
  });
});
