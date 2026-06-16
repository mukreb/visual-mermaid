// Auto-layout for nodes that don't already have a position. Uses dagre — the same
// layout engine Mermaid uses for flowcharts — so seeded positions look natural.
// Nodes with an existing position are left untouched (layout stability on re-import).

import dagre from "@dagrejs/dagre";
import type { GraphModel } from "../model/types";

const NODE_W = 160;
const NODE_H = 60;

export function layoutNewNodes(model: GraphModel): GraphModel {
  const needsLayout = model.nodes.some((n) => !n.position);
  if (!needsLayout) return model;

  const g = new dagre.graphlib.Graph();
  const rankdir =
    model.direction === "LR" || model.direction === "RL" ? "LR" : "TB";
  g.setGraph({ rankdir, nodesep: 50, ranksep: 70 });
  g.setDefaultEdgeLabel(() => ({}));

  const ids = new Set(model.nodes.map((n) => n.id));
  for (const n of model.nodes) {
    g.setNode(n.id, { width: NODE_W, height: NODE_H });
  }
  for (const e of model.edges) {
    if (ids.has(e.source) && ids.has(e.target)) g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  const nodes = model.nodes.map((n) => {
    if (n.position) return n;
    const p = g.node(n.id);
    if (!p) return { ...n, position: { x: 0, y: 0 } };
    // dagre returns center coordinates; React Flow positions are top-left.
    return {
      ...n,
      position: {
        x: Math.round(p.x - NODE_W / 2),
        y: Math.round(p.y - NODE_H / 2),
      },
    };
  });

  return { ...model, nodes };
}
