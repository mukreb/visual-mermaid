// The canonical graph model — the resting-state source of truth.
// Both the code view and the visual view edit *this*; text and React Flow
// shapes are derived from it. Designed first, on purpose: everything hangs off it.

export type Direction = "TB" | "TD" | "BT" | "LR" | "RL";

/** Node shapes we support, named by intent. Mapped to Mermaid brackets in shapes.ts. */
export type NodeShape =
  | "rect" // [text]
  | "round" // (text)
  | "stadium" // ([text])
  | "subroutine" // [[text]]
  | "cylinder" // [(text)]
  | "circle" // ((text))
  | "doublecircle" // (((text)))
  | "rhombus" // {text}  (decision)
  | "hexagon" // {{text}}
  | "parallelogram" // [/text/]
  | "parallelogram_alt" // [\text\]
  | "trapezoid" // [/text\]
  | "trapezoid_alt"; // [\text/]

export interface GNode {
  id: string;
  label: string;
  shape: NodeShape;
  /** Layout position. Persisted per id so the layout survives a round-trip. */
  position?: { x: number; y: number };
  classes?: string[];
}

/** Edge line + arrowhead style. Mapped to Mermaid arrows in shapes.ts. */
export type EdgeKind =
  | "arrow" // -->
  | "open" // ---
  | "dotted" // -.->
  | "dotted_open" // -.-
  | "thick" // ==>
  | "thick_open"; // ===

export interface GEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  label?: string;
}

export interface GSubgraph {
  id: string;
  title?: string;
  nodeIds: string[];
  direction?: Direction;
}

/**
 * Everything Mermaid's lossy parse would otherwise drop, so a round-trip is
 * non-destructive. Captured by a pre-pass (trivia.ts) before parsing.
 */
export interface Trivia {
  /** Frontmatter / `%%{init}%%` directives / leading comment block, verbatim. */
  header: string[];
  /** Per-node positions parsed from `%% @pos <id> <x> <y>` comment lines. */
  positions: Record<string, { x: number; y: number }>;
}

export interface GraphModel {
  /** Discriminant for the DiagramModel union (see src/diagram). */
  kind: "flowchart";
  direction: Direction;
  nodes: GNode[];
  edges: GEdge[];
  subgraphs: GSubgraph[];
  trivia: Trivia;
}

export function emptyModel(): GraphModel {
  return {
    kind: "flowchart",
    direction: "TB",
    nodes: [],
    edges: [],
    subgraphs: [],
    trivia: { header: [], positions: {} },
  };
}
