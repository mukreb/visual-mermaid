// GraphModel → React Flow {nodes, edges}. The visual view binds to this, not to
// the preview SVG. Subgraphs are preserved in the model but not yet rendered as
// nested containers (Phase 2); membership round-trips through text regardless.

import type { Edge, Node } from "@xyflow/react";
import type { EdgeKind, GraphModel, NodeShape } from "../model/types";

export interface ShapeNodeData extends Record<string, unknown> {
  label: string;
  shape: NodeShape;
}

export interface FlowEdgeData extends Record<string, unknown> {
  kind: EdgeKind;
}

export type ShapeNode = Node<ShapeNodeData, "shape">;
export type FlowEdge = Edge<FlowEdgeData>;

export function modelToFlow(model: GraphModel): {
  nodes: ShapeNode[];
  edges: FlowEdge[];
} {
  const nodes: ShapeNode[] = model.nodes.map((n) => ({
    id: n.id,
    type: "shape",
    position: n.position ?? { x: 0, y: 0 },
    data: { label: n.label, shape: n.shape },
  }));

  const edges: FlowEdge[] = model.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    data: { kind: e.kind },
    animated: e.kind === "dotted" || e.kind === "dotted_open",
  }));

  return { nodes, edges };
}
