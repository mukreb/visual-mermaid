// GraphModel → React Flow {nodes, edges}. The visual view binds to this, not to
// the preview SVG. Subgraphs are rendered as decorative container nodes drawn
// behind their members (membership still round-trips through text); they are not
// part of the model, so they never affect serialization.

import type { Edge, Node } from "@xyflow/react";
import type { EdgeKind, GraphModel, NodeShape } from "../model/types";

export interface ShapeNodeData extends Record<string, unknown> {
  label: string;
  shape: NodeShape;
}

export interface GroupNodeData extends Record<string, unknown> {
  title: string;
}

export interface FlowEdgeData extends Record<string, unknown> {
  kind: EdgeKind;
}

export type ShapeNode = Node<ShapeNodeData, "shape">;
export type GroupNode = Node<GroupNodeData, "group">;
export type AppNode = ShapeNode | GroupNode;
export type FlowEdge = Edge<FlowEdgeData>;

// Approximate node footprint + padding used to size subgraph containers.
const NODE_W = 170;
const NODE_H = 56;
const PAD = 26;
const TITLE_H = 22;

export function modelToFlow(model: GraphModel): {
  nodes: AppNode[];
  edges: FlowEdge[];
} {
  const nodeById = new Map(model.nodes.map((n) => [n.id, n]));

  // Subgraph containers first, so they render behind their members.
  const groups: GroupNode[] = [];
  for (const sg of model.subgraphs) {
    const members = sg.nodeIds
      .map((id) => nodeById.get(id))
      .filter((n): n is NonNullable<typeof n> => !!n?.position);
    if (members.length === 0) continue;

    const xs = members.map((n) => n.position!.x);
    const ys = members.map((n) => n.position!.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs) + NODE_W;
    const maxY = Math.max(...ys) + NODE_H;

    groups.push({
      id: `__sg_${sg.id}`,
      type: "group",
      position: { x: minX - PAD, y: minY - PAD - TITLE_H },
      data: { title: sg.title ?? sg.id },
      draggable: false,
      selectable: false,
      connectable: false,
      width: maxX - minX + 2 * PAD,
      height: maxY - minY + 2 * PAD + TITLE_H,
    });
  }

  const shapeNodes: ShapeNode[] = model.nodes.map((n) => ({
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

  return { nodes: [...groups, ...shapeNodes], edges };
}

/** True for synthetic subgraph-container node ids (not part of the model). */
export function isGroupId(id: string): boolean {
  return id.startsWith("__sg_");
}
