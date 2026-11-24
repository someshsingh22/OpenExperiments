import { Fragment } from "react";
import { DatasetInlineText } from "./dataset-prose";

function InlineResearchText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*\n]+\*\*)/).map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index} className="font-semibold">
            <DatasetInlineText text={part.slice(2, -2)} />
          </strong>
        ) : (
          <Fragment key={index}>
            <DatasetInlineText text={part} />
          </Fragment>
        ),
      )}
    </>
  );
}

export function ResearchPlanText({ text }: { text: string }) {
  return (
    <div className="min-w-0 space-y-4 text-base leading-relaxed text-stone-700">
      {text.split(/(^```[^\n]*\n[\s\S]*?^```[ \t]*$)/m).map((block, index) =>
        block.startsWith("```") ? (
          <pre
            key={index}
            tabIndex={0}
            aria-label="Analysis code"
            className="max-w-full overflow-x-auto rounded-md border border-stone-200 bg-white p-4 text-sm"
          >
            <code>{block.replace(/^```[^\n]*\n|^```[ \t]*$/gm, "").trimEnd()}</code>
          </pre>
        ) : (
          <Fragment key={index}>
            {block
              .split(/\n\s*\n/)
              .filter((paragraph) => paragraph.trim())
              .map((paragraph, paragraphIndex) =>
                /^## [^\n]+$/.test(paragraph) ? (
                  <h3 key={paragraphIndex} className="type-heading pt-2 text-stone-900">
                    <InlineResearchText text={paragraph.slice(3)} />
                  </h3>
                ) : (
                  <p key={paragraphIndex} className="max-w-prose break-words whitespace-pre-line">
                    <InlineResearchText text={paragraph} />
                  </p>
                ),
              )}
          </Fragment>
        ),
      )}
    </div>
  );
}
