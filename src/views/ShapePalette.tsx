// Shapes palette overlaid on the canvas. Each item can be dragged onto the
// canvas (dropped at the cursor) or clicked to add a node at a cascading
// position. The drag payload is the NodeShape under SHAPE_DND_MIME; VisualView's
// onDrop reads it. Swatches reuse the canvas node's shape styling.

import type { NodeShape } from "../model/types";
import { SHAPE_STYLE } from "./nodes/shapeStyle";
import { SHAPE_OPTIONS } from "./shapeOptions";

export const SHAPE_DND_MIME = "application/x-visual-mermaid-shape";

export function ShapePalette({ onAdd }: { onAdd: (shape: NodeShape) => void }) {
  return (
    <div className="palette" role="toolbar" aria-label="Shapes palette">
      {SHAPE_OPTIONS.map(([shape, label]) => (
        <button
          key={shape}
          type="button"
          className="palette-item"
          title={`${label} — drag onto the canvas or click to add`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(SHAPE_DND_MIME, shape);
            e.dataTransfer.effectAllowed = "copy";
          }}
          onClick={() => onAdd(shape)}
        >
          <span className="palette-swatch" style={SHAPE_STYLE[shape]} aria-hidden />
          <span className="palette-label">{label}</span>
        </button>
      ))}
    </div>
  );
}
