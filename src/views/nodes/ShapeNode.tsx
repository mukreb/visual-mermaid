// Custom React Flow node. Renders the label with shape-dependent styling and the
// four connection handles. Visual fidelity is intentionally light — the SVG preview
// pane is the high-fidelity render; this is the editable surface.

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { ShapeNode as ShapeNodeType } from "../../flow/modelToFlow";
import type { NodeShape } from "../../model/types";

const SHAPE_STYLE: Record<NodeShape, CSSProperties> = {
  rect: { borderRadius: 4 },
  round: { borderRadius: 20 },
  stadium: { borderRadius: 999 },
  subroutine: { borderRadius: 4, borderStyle: "double", borderWidth: 4 },
  cylinder: { borderRadius: "50% / 12%" },
  circle: { borderRadius: "50%", aspectRatio: "1 / 1" },
  doublecircle: { borderRadius: "50%", aspectRatio: "1 / 1", borderStyle: "double", borderWidth: 4 },
  rhombus: { borderRadius: 4, transform: "rotate(0deg)", clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" },
  hexagon: { clipPath: "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)" },
  parallelogram: { clipPath: "polygon(15% 0, 100% 0, 85% 100%, 0 100%)" },
  parallelogram_alt: { clipPath: "polygon(0 0, 85% 0, 100% 100%, 15% 100%)" },
  trapezoid: { clipPath: "polygon(15% 0, 85% 0, 100% 100%, 0 100%)" },
  trapezoid_alt: { clipPath: "polygon(0 0, 100% 0, 85% 100%, 15% 100%)" },
};

export function ShapeNode({ data, selected }: NodeProps<ShapeNodeType>) {
  const shape = data.shape;
  return (
    <div
      className="shape-node"
      style={{ ...SHAPE_STYLE[shape], outline: selected ? "2px solid var(--accent)" : undefined }}
      title={`shape: ${shape}`}
    >
      <Handle type="target" position={Position.Top} />
      <span className="shape-node-label">{data.label}</span>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
    </div>
  );
}
