// Visual styling per node shape, shared by the canvas node (ShapeNode) and the
// shapes-palette swatches so both stay in sync. Size-agnostic (border-radius /
// clip-path / aspect-ratio), so the same map works on a full node and on a small
// palette preview. Visual fidelity is intentionally light — the SVG preview pane
// is the high-fidelity render.

import type { CSSProperties } from "react";
import type { NodeShape } from "../../model/types";

export const SHAPE_STYLE: Record<NodeShape, CSSProperties> = {
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
