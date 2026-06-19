// The pluggable-diagram seam. Each diagram type (flowchart, sequence, …) ships a
// DiagramAdapter that owns the full two-way pipeline for that type: detect →
// parse → reconcile → serialize, plus the React Flow projection for the canvas.
// The store and views talk to *an adapter*, never to a specific diagram type.
//
// DiagramModel is the discriminated union of every concrete model; the `kind`
// field selects the adapter (see registry.ts). Adding a type = add a module +
// a union member + a registry entry; nothing else needs to know it exists.

import type { AppNode, FlowEdge } from "../flow/modelToFlow";
import type { GraphModel } from "../model/types";

export type DiagramKind = GraphModel["kind"] | "sequence";

/** Marker every concrete diagram model carries, for union dispatch. */
export interface BaseModel {
  kind: DiagramKind;
}

/**
 * The resting-state model the store holds — the discriminated union of every
 * concrete diagram model. Widened (with `| SequenceModel`, …) as types are added.
 */
export type DiagramModel = GraphModel;

export interface DiagramAdapter<M extends BaseModel = DiagramModel> {
  readonly kind: DiagramKind;

  /** True if `text` opens with this diagram type's header keyword. */
  matches(text: string): boolean;

  /** A blank model of this kind (File ▸ New, initial state). */
  empty(): M;

  /** Parse text → model. Throws (MermaidParseError) on invalid input. */
  parse(text: string): Promise<M>;

  /** Pure, deterministic model → text. No DOM, no mermaid dependency. */
  serialize(model: M): string;

  /**
   * Reconcile a fresh parse with the previous model of the same kind: preserve
   * per-id layout that already existed, lay out only genuinely new elements.
   * `prev` is guaranteed to be this adapter's own kind (the store passes an
   * empty model when the diagram type changed).
   */
  reconcile(parsed: M, prev: M): M;

  /** Project the model onto React Flow shapes for the visual canvas. */
  toFlow(model: M): { nodes: AppNode[]; edges: FlowEdge[] };
}
