import { Fragment, type ReactNode } from "react";

const INLINE_TOKEN =
  /`([^`\n]+)`|\[([^\]\n]+)\]\((https?:\/\/(?:[^\s()]|\([^()\s]*\))+)\)|(https?:\/\/[^\s<>"'`]+)/g;

function trimUrlEnd(value: string) {
  let url = value.replace(/[.,!?;:]+$/, "");
  while (url.endsWith(")") && (url.match(/\)/g)?.length ?? 0) > (url.match(/\(/g)?.length ?? 0)) {
    url = url.slice(0, -1);
  }
  while (url.endsWith("]") && (url.match(/\]/g)?.length ?? 0) > (url.match(/\[/g)?.length ?? 0)) {
    url = url.slice(0, -1);
  }
  return url;
}

export function DatasetInlineText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let offset = 0;

  for (const match of text.matchAll(INLINE_TOKEN)) {
    const index = match.index;
    parts.push(text.slice(offset, index));

    if (match[1]) {
      parts.push(
        <code key={index} className="font-mono text-[0.9em]">
          {match[1]}
        </code>,
      );
    } else {
      const url = match[3] ?? trimUrlEnd(match[4]);
      const label = match[2] ?? url;
      parts.push(
        <a
          key={index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="break-words text-stone-800 underline decoration-stone-400 underline-offset-2 hover:decoration-stone-800"
        >
          {label}
        </a>,
      );
      if (match[4]) parts.push(match[4].slice(url.length));
    }

    offset = index + match[0].length;
  }
  parts.push(text.slice(offset));
  return <>{parts}</>;
}

interface Variable {
  names: string[];
  type?: string;
  description: string;
}

type VariableBlock = { kind: "variables"; entries: Variable[] } | { kind: "text"; lines: string[] };

function variableBlocks(text: string): VariableBlock[] {
  const blocks: VariableBlock[] = [];
  const pattern =
    /^\s*(?:[-*]\s+)?((?:`?[A-Za-z_][\w.-]*`?)(?:\s*,\s*`?[A-Za-z_][\w.-]*`?)*)(?:\s*\(([^)]*)\))?\s*(?::\s+|[—–]\s+)(.+)$/;

  for (const line of text.split("\n")) {
    const match = line.match(pattern);
    const last = blocks[blocks.length - 1];
    if (match) {
      const variable = {
        names: match[1].split(/\s*,\s*/).map((name) => name.replace(/^`|`$/g, "")),
        type: match[2],
        description: match[3],
      };
      if (last?.kind === "variables") last.entries.push(variable);
      else blocks.push({ kind: "variables", entries: [variable] });
    } else if (last?.kind === "text") {
      last.lines.push(line);
    } else {
      blocks.push({ kind: "text", lines: [line] });
    }
  }
  return blocks;
}

export function VariableDictionary({ text }: { text: string }) {
  return (
    <div className="space-y-4">
      {variableBlocks(text).map((block, index) =>
        block.kind === "text" ? (
          block.lines.some((line) => line.trim()) && (
            <p
              key={index}
              className="max-w-prose text-sm leading-relaxed whitespace-pre-line text-stone-700"
            >
              <DatasetInlineText text={block.lines.join("\n")} />
            </p>
          )
        ) : (
          <dl key={index} className="space-y-3">
            {block.entries.map((entry, entryIndex) => (
              <div key={entryIndex}>
                <dt className="text-sm font-medium text-stone-800">
                  {entry.names.map((name, nameIndex) => (
                    <Fragment key={nameIndex}>
                      {nameIndex > 0 && ", "}
                      <code className="font-mono text-xs font-semibold">{name}</code>
                    </Fragment>
                  ))}
                  {entry.type && (
                    <span className="font-normal text-stone-600"> ({entry.type})</span>
                  )}
                </dt>
                <dd className="mt-1 max-w-prose text-sm leading-relaxed text-stone-700">
                  <DatasetInlineText text={entry.description} />
                </dd>
              </div>
            ))}
          </dl>
        ),
      )}
    </div>
  );
}
