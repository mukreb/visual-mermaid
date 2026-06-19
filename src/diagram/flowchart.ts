// The flowchart DiagramAdapter: a thin wrapper that binds the existing flowchart
// pipeline (parse/serialize/layout/flow modules) to the adapter seam. All the
// real logic still lives in those modules; this only composes them + owns
// flowchart's header detection and reconcile (position preservation + layout).

import { modelToFlow } from "../flow/modelToFlow";
import { emptyModel, type GraphModel } from "../model/types";
import { layoutNewNodes } from "../sync/layout";
import { parseTextToModel } from "../sync/parseTextToModel";
import { serializeModelToText } from "../sync/serializeModelToText";
import type { DiagramAdapter } from "./adapter";

// `flowchart`/`graph` is the legacy default; treat anything not claimed by a more
// specific adapter as a flowchart (the registry uses flowchart as its fallback).
const HEADER = /^(?:flowchart|graph)\b/;

/** First line of actual diagram source, skipping frontmatter, directives, comments. */
function firstKeywordLine(text: string): string {
  let inFrontmatter = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "---") {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) continue;
    if (line === "" || line.startsWith("%%")) continue;
    return line;
  }
  return "";
}

export function isFlowchart(text: string): boolean {
  return HEADER.test(firstKeywordLine(text));
}

/** Keep positions for nodes that already existed; only new ones get auto-layout. */
function mergePositions(parsed: GraphModel, prev: GraphModel): GraphModel {
  const prevPos = new Map(
    prev.nodes.filter((n) => n.position).map((n) => [n.id, n.position!]),
  );
  return {
    ...parsed,
    nodes: parsed.nodes.map((n) =>
      n.position ? n : prevPos.has(n.id) ? { ...n, position: prevPos.get(n.id) } : n,
    ),
  };
}

export const flowchartAdapter: DiagramAdapter<GraphModel> = {
  kind: "flowchart",
  matches: isFlowchart,
  empty: emptyModel,
  parse: parseTextToModel,
  serialize: serializeModelToText,
  reconcile: (parsed, prev) => layoutNewNodes(mergePositions(parsed, prev)),
  toFlow: modelToFlow,
};
