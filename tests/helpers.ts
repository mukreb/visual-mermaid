// Shared test helpers.

import type { GraphModel } from "../src/model/types";

/** Order-independent, id-independent projection for semantic model comparison. */
export function normalize(m: GraphModel) {
  return {
    direction: m.direction,
    nodes: [...m.nodes]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((n) => ({ id: n.id, label: n.label, shape: n.shape })),
    edges: [...m.edges]
      .map((e) => ({ source: e.source, target: e.target, kind: e.kind, label: e.label ?? "" }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    subgraphs: [...m.subgraphs]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((s) => ({
        id: s.id,
        title: s.title ?? "",
        nodeIds: [...s.nodeIds].sort(),
        direction: s.direction ?? null,
      })),
  };
}
