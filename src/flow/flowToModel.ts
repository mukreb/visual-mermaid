// Helpers that translate React Flow editing gestures into model mutations.
// Pure functions returning a new GraphModel; the store calls these and then
// re-emits text. Keeping them pure makes the visual→text path unit-testable.

import type { GEdge, GNode, GraphModel, NodeShape } from "../model/types";

/** A fresh node id that doesn't collide with existing ones (n1, n2, ...). */
export function nextNodeId(model: GraphModel): string {
  let i = 1;
  const taken = new Set(model.nodes.map((n) => n.id));
  while (taken.has(`n${i}`)) i++;
  return `n${i}`;
}

function nextEdgeId(model: GraphModel): string {
  let i = 1;
  const taken = new Set(model.edges.map((e) => e.id));
  while (taken.has(`e${i}`)) i++;
  return `e${i}`;
}

export function addNode(
  model: GraphModel,
  opts: { label?: string; shape?: NodeShape; position?: { x: number; y: number } } = {},
): GraphModel {
  const node: GNode = {
    id: nextNodeId(model),
    label: opts.label ?? "New",
    shape: opts.shape ?? "rect",
    position: opts.position,
  };
  return { ...model, nodes: [...model.nodes, node] };
}

export function removeNode(model: GraphModel, id: string): GraphModel {
  return {
    ...model,
    nodes: model.nodes.filter((n) => n.id !== id),
    edges: model.edges.filter((e) => e.source !== id && e.target !== id),
    subgraphs: model.subgraphs.map((sg) => ({
      ...sg,
      nodeIds: sg.nodeIds.filter((nid) => nid !== id),
    })),
  };
}

export function renameNode(model: GraphModel, id: string, label: string): GraphModel {
  return {
    ...model,
    nodes: model.nodes.map((n) => (n.id === id ? { ...n, label } : n)),
  };
}

export function moveNode(
  model: GraphModel,
  id: string,
  position: { x: number; y: number },
): GraphModel {
  return {
    ...model,
    nodes: model.nodes.map((n) =>
      n.id === id ? { ...n, position: { x: Math.round(position.x), y: Math.round(position.y) } } : n,
    ),
  };
}

export function connect(model: GraphModel, source: string, target: string): GraphModel {
  const edge: GEdge = {
    id: nextEdgeId(model),
    source,
    target,
    kind: "arrow",
  };
  return { ...model, edges: [...model.edges, edge] };
}

export function removeEdge(model: GraphModel, id: string): GraphModel {
  return { ...model, edges: model.edges.filter((e) => e.id !== id) };
}
