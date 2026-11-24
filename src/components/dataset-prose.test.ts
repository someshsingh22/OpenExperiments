import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DatasetInlineText, VariableDictionary } from "./dataset-prose";

describe("dataset prose", () => {
  it("renders labeled links, plain URLs, and inline variables as HTML", () => {
    const markup = renderToStaticMarkup(
      createElement(DatasetInlineText, {
        text: "Read [the guide](https://example.com/docs_(api)) or visit https://example.com/data?x=1&y=2. Use `delta`.",
      }),
    );

    expect(markup).toContain('href="https://example.com/docs_(api)"');
    expect(markup).toContain(">the guide</a>");
    expect(markup).toContain('href="https://example.com/data?x=1&amp;y=2"');
    expect(markup).toContain('target="_blank" rel="noopener noreferrer"');
    expect(markup).toContain(">delta</code>");
    expect(markup).not.toContain("[the guide]");
  });

  it("preserves punctuation and escapes untrusted content without unsafe links", () => {
    const markup = renderToStaticMarkup(
      createElement(DatasetInlineText, {
        text: "See (https://example.com/docs). [bad](javascript:alert(1)) <script>alert(1)</script>",
      }),
    );

    expect(markup).toContain('href="https://example.com/docs"');
    expect(markup).toContain("</a>).");
    expect(markup).not.toContain('href="javascript:');
    expect(markup).toContain("&lt;script&gt;");
    expect(markup).not.toContain("<script>");
  });

  it("renders variable definitions as a definition list and keeps other prose", () => {
    const markup = renderToStaticMarkup(
      createElement(VariableDictionary, {
        text: "Available fields:\npost_id (string): Submission identifier.\ntitle, abstract (strings): Submission metadata.\ndelta — Outcome; see [documentation](https://example.com/docs).\nRead the CSV with a multiline-aware parser.",
      }),
    );

    expect(markup).toContain("Available fields:");
    expect(markup).toContain("<dl");
    expect(markup).toContain("<dt");
    expect(markup).toContain("<dd");
    for (const variable of ["post_id", "title", "abstract", "delta"]) {
      expect(markup).toContain(`>${variable}</code>`);
    }
    expect(markup).toContain('href="https://example.com/docs"');
    expect(markup).toContain("Read the CSV with a multiline-aware parser.");
  });

  it("preserves free-form variable text and links without inventing fields", () => {
    const markup = renderToStaticMarkup(
      createElement(VariableDictionary, {
        text: "Variables are documented at https://example.com/schema.",
      }),
    );

    expect(markup).not.toContain("<dl");
    expect(markup).toContain('href="https://example.com/schema"');
    expect(markup).toContain("Variables are documented at");
  });
});
