// Human-readable [value, label] lists for node shapes and edge kinds, shared by
// the selection inspector and the shapes palette so a new shape is added in one
// place. Order is the display order.

import type { EdgeKind, NodeShape } from "../model/types";

export const SHAPE_OPTIONS: [NodeShape, string][] = [
  ["rect", "Rectangle"],
  ["round", "Rounded"],
  ["stadium", "Stadium"],
  ["subroutine", "Subroutine"],
  ["cylinder", "Cylinder"],
  ["circle", "Circle"],
  ["doublecircle", "Double circle"],
  ["rhombus", "Decision"],
  ["hexagon", "Hexagon"],
  ["parallelogram", "Parallelogram"],
  ["parallelogram_alt", "Parallelogram alt"],
  ["trapezoid", "Trapezoid"],
  ["trapezoid_alt", "Trapezoid alt"],
];

export const EDGE_OPTIONS: [EdgeKind, string][] = [
  ["arrow", "Arrow  -->"],
  ["open", "Line  ---"],
  ["dotted", "Dotted  -.->"],
  ["dotted_open", "Dotted line  -.-"],
  ["thick", "Thick  ==>"],
  ["thick_open", "Thick line  ==="],
];
