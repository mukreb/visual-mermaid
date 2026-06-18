// Custom React Flow node. Renders the label with shape-dependent styling and the
// four connection handles. Visual fidelity is intentionally light — the SVG preview
// pane is the high-fidelity render; this is the editable surface.

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Fragment, type ReactNode } from "react";
import type { ShapeNode as ShapeNodeType } from "../../flow/modelToFlow";
import { SHAPE_STYLE } from "./shapeStyle";

/** Mermaid labels use <br>/<br/> for line breaks; render them as real breaks. */
function renderLabel(label: string): ReactNode {
  const lines = label.split(/<br\s*\/?>/i);
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line}
    </Fragment>
  ));
}

export function ShapeNode({ data, selected }: NodeProps<ShapeNodeType>) {
  const shape = data.shape;
  return (
    <div
      className="shape-node"
      style={{ ...SHAPE_STYLE[shape], outline: selected ? "2px solid var(--accent)" : undefined }}
      title={`shape: ${shape}`}
    >
      <Handle type="target" position={Position.Top} />
      <span className="shape-node-label">{renderLabel(data.label)}</span>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
    </div>
  );
}
