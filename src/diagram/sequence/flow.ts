// SequenceModel → React Flow projection for the visual canvas. A sequence diagram
// has no free layout, so this is a derived view (not round-tripped through
// positions): participants become a row of lifeline nodes, and every message —
// flattened from the nested blocks, in order — becomes a numbered edge between
// them. It's a read-only overview; the faithful render is the Preview pane, and
// sequence editing happens in the code view.

import type { AppNode, FlowEdge } from "../../flow/modelToFlow";
import type { SeqStatement, SequenceModel } from "./model";

const GAP_X = 220;

export function sequenceToFlow(model: SequenceModel): {
  nodes: AppNode[];
  edges: FlowEdge[];
} {
  const nodes: AppNode[] = model.participants.map((p, i) => ({
    id: p.id,
    type: "shape",
    position: { x: i * GAP_X, y: 0 },
    // actors as stadium (rounded), participants as rect — a visual nod to Mermaid.
    data: { label: p.alias ?? p.id, shape: p.kind === "actor" ? "stadium" : "rect" },
  }));

  const edges: FlowEdge[] = [];
  let n = 0;
  const walk = (statements: SeqStatement[]): void => {
    for (const s of statements) {
      if (s.type === "message") {
        n++;
        const dotted = s.arrow.includes("dotted");
        edges.push({
          id: `seqmsg_${n}`,
          source: s.from,
          target: s.to,
          label: s.text ? `${n}. ${s.text}` : `${n}`,
          data: { kind: dotted ? "dotted" : "arrow" },
          animated: s.arrow === "solid_point" || s.arrow === "dotted_point",
        });
      } else if (s.type === "block") {
        for (const branch of s.branches) walk(branch.statements);
      }
    }
  };
  walk(model.statements);

  return { nodes, edges };
}
