// Pure, deterministic emitter: GraphModel → Mermaid flowchart text.
// No DOM, no mermaid dependency — fully unit-testable in isolation.
//
// Strategy: declare every node once (top-level or inside its subgraph), always
// quoting the label so special characters never break the bracket; then emit all
// edges by id; then append positions as `%% @pos` trivia (which mermaid drops on
// re-parse but trivia.ts reads back). Node-then-edge ordering keeps output stable.

import { EDGE_ARROWS, SHAPE_BRACKETS } from "../model/shapes";
import type { GEdge, GNode, GraphModel } from "../model/types";

const INDENT = "    ";

/** Mermaid renders `#quot;` as a literal double-quote inside a quoted string. */
function escapeLabel(label: string): string {
  return label.replace(/"/g, "#quot;");
}

function declareNode(node: GNode): string {
  const [open, close] = SHAPE_BRACKETS[node.shape];
  return `${node.id}${open}"${escapeLabel(node.label)}"${close}`;
}

function edgeLine(edge: GEdge): string {
  const arrow = EDGE_ARROWS[edge.kind];
  if (edge.label && edge.label.length > 0) {
    return `${edge.source} ${arrow}|${escapeLabel(edge.label)}| ${edge.target}`;
  }
  return `${edge.source} ${arrow} ${edge.target}`;
}

export function serializeModelToText(model: GraphModel): string {
  const lines: string[] = [];

  // Preserved frontmatter / init directives, verbatim.
  for (const h of model.trivia.header) lines.push(h);

  lines.push(`flowchart ${model.direction}`);

  const inSubgraph = new Set<string>();
  for (const sg of model.subgraphs) {
    for (const id of sg.nodeIds) inSubgraph.add(id);
  }
  const nodeById = new Map(model.nodes.map((n) => [n.id, n]));

  // Subgraphs, each declaring its member nodes (so mermaid assigns them correctly).
  for (const sg of model.subgraphs) {
    // Quote the title (like node labels) so punctuation in it — e.g. "(Supabase)"
    // — doesn't break the bracket when the text is re-parsed.
    const title = sg.title ? `["${escapeLabel(sg.title)}"]` : "";
    lines.push(`${INDENT}subgraph ${sg.id}${title}`);
    if (sg.direction) lines.push(`${INDENT}${INDENT}direction ${sg.direction}`);
    for (const id of sg.nodeIds) {
      const node = nodeById.get(id);
      if (node) lines.push(`${INDENT}${INDENT}${declareNode(node)}`);
    }
    lines.push(`${INDENT}end`);
  }

  // Top-level node declarations (those not in any subgraph).
  for (const node of model.nodes) {
    if (!inSubgraph.has(node.id)) {
      lines.push(`${INDENT}${declareNode(node)}`);
    }
  }

  // Edges, referencing nodes by id (all declared above).
  for (const edge of model.edges) {
    lines.push(`${INDENT}${edgeLine(edge)}`);
  }

  // Positions as trivia — survives a round-trip, ignored by other Mermaid tools.
  for (const node of model.nodes) {
    if (node.position) {
      lines.push(`%% @pos ${node.id} ${node.position.x} ${node.position.y}`);
    }
  }

  return lines.join("\n") + "\n";
}
