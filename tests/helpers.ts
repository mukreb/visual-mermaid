// Shared test helpers.

import type { DiagramModel } from "../src/diagram/adapter";
import type { GraphModel } from "../src/model/types";

/** Narrow the diagram-model union to a flowchart in tests (throws otherwise). */
export function asFlow(model: DiagramModel): GraphModel {
  if (model.kind !== "flowchart") throw new Error(`expected a flowchart model, got: ${model.kind}`);
  return model;
}

/** Order-independent, id-independent projection for semantic model comparison. */
export function normalize(model: DiagramModel) {
  const m = asFlow(model);
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
