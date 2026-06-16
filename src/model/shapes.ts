// Table-driven mapping between our canonical shapes/edge-kinds and Mermaid syntax.
// The emitter reads the forward tables; the parser reads the reverse maps that
// translate Mermaid's internal db `type`/`stroke` values back to our model.

import type { EdgeKind, NodeShape } from "./types";

/** Open/close brackets for each shape. Label sits between, always quoted by the emitter. */
export const SHAPE_BRACKETS: Record<NodeShape, [open: string, close: string]> = {
  rect: ["[", "]"],
  round: ["(", ")"],
  stadium: ["([", "])"],
  subroutine: ["[[", "]]"],
  cylinder: ["[(", ")]"],
  circle: ["((", "))"],
  doublecircle: ["(((", ")))"],
  rhombus: ["{", "}"],
  hexagon: ["{{", "}}"],
  parallelogram: ["[/", "/]"],
  parallelogram_alt: ["[\\", "\\]"],
  trapezoid: ["[/", "\\]"],
  trapezoid_alt: ["[\\", "/]"],
};

/** Arrow string for each edge kind. `{label}` is filled in (or the pipes dropped). */
export const EDGE_ARROWS: Record<EdgeKind, string> = {
  arrow: "-->",
  open: "---",
  dotted: "-.->",
  dotted_open: "-.-",
  thick: "==>",
  thick_open: "===",
};

/**
 * Mermaid flowDb vertex `.type` → our shape. `undefined`/unknown → "rect".
 * (Mermaid uses "square" for the default `[ ]`, "diamond" for `{ }`, etc.)
 */
const VERTEX_TYPE_TO_SHAPE: Record<string, NodeShape> = {
  square: "rect",
  rect: "rect",
  round: "round",
  stadium: "stadium",
  subroutine: "subroutine",
  cylinder: "cylinder",
  circle: "circle",
  doublecircle: "doublecircle",
  diamond: "rhombus",
  hexagon: "hexagon",
  lean_right: "parallelogram",
  lean_left: "parallelogram_alt",
  trapezoid: "trapezoid",
  inv_trapezoid: "trapezoid_alt",
};

export function vertexTypeToShape(type: string | undefined): NodeShape {
  if (!type) return "rect";
  return VERTEX_TYPE_TO_SHAPE[type] ?? "rect";
}

/**
 * Mermaid flowDb edge → our edge kind. The db encodes the line style in
 * `stroke` ("normal" | "thick" | "dotted") and the arrowhead in `type`
 * ("arrow_point" = filled head, "arrow_open" = no head).
 */
export function edgeToKind(
  stroke: string | undefined,
  type: string | undefined,
): EdgeKind {
  const hasHead = type !== "arrow_open" && type !== "double_arrow_open";
  switch (stroke) {
    case "thick":
      return hasHead ? "thick" : "thick_open";
    case "dotted":
      return hasHead ? "dotted" : "dotted_open";
    default:
      return hasHead ? "arrow" : "open";
  }
}
