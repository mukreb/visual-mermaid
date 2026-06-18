// Auto-layout for nodes that don't already have a position. Uses dagre — the same
// layout engine Mermaid uses for flowcharts — so seeded positions look natural.
// Nodes with an existing position are left untouched (layout stability on re-import).
//
// Subgraphs are laid out as dagre *clusters* (compound graph), so a subgraph's
// members stay grouped together the way Mermaid renders them — instead of being
// scattered by raw edge connectivity, which made the decorative containers overlap.

import dagre from "@dagrejs/dagre";
import { estimateNodeSize } from "../model/nodeSize";
import type { GraphModel } from "../model/types";

const clusterIdFor = (id: string) => `__cluster__${id}`;

export function layoutNewNodes(model: GraphModel): GraphModel {
  const needsLayout = model.nodes.some((n) => !n.position);
  if (!needsLayout) return model;

  const g = new dagre.graphlib.Graph({ compound: true });
  const rankdir =
    model.direction === "LR" || model.direction === "RL" ? "LR" : "TB";
  g.setGraph({ rankdir, nodesep: 50, ranksep: 70, marginx: 12, marginy: 12 });
  g.setDefaultEdgeLabel(() => ({}));

  const nodeIds = new Set(model.nodes.map((n) => n.id));
  const subgraphIds = new Set(model.subgraphs.map((s) => s.id));

  for (const n of model.nodes) {
    g.setNode(n.id, estimateNodeSize(n.label));
  }

  // One cluster per subgraph that actually contains a real node. The direct
  // member set is used both to create the cluster and to pick a node's innermost
  // parent (smallest containing subgraph wins on nesting).
  const memberSets = model.subgraphs.map((s) => ({
    id: s.id,
    members: new Set(s.nodeIds.filter((id) => nodeIds.has(id))),
  }));
  const created = new Set<string>();
  for (const ms of memberSets) {
    if (ms.members.size === 0) continue;
    g.setNode(clusterIdFor(ms.id), {});
    created.add(ms.id);
  }

  for (const n of model.nodes) {
    let parent: { id: string; size: number } | null = null;
    for (const ms of memberSets) {
      if (!created.has(ms.id) || !ms.members.has(n.id)) continue;
      if (parent === null || ms.members.size < parent.size) {
        parent = { id: ms.id, size: ms.members.size };
      }
    }
    if (parent) g.setParent(n.id, clusterIdFor(parent.id));
  }

  // Nested subgraphs: an outer subgraph lists an inner subgraph's id as a member.
  for (const s of model.subgraphs) {
    if (!created.has(s.id)) continue;
    for (const member of s.nodeIds) {
      if (subgraphIds.has(member) && created.has(member)) {
        g.setParent(clusterIdFor(member), clusterIdFor(s.id));
      }
    }
  }

  for (const e of model.edges) {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) g.setEdge(e.source, e.target);
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
        x: Math.round(p.x - p.width / 2),
        y: Math.round(p.y - p.height / 2),
      },
    };
  });

  return { ...model, nodes };
}
