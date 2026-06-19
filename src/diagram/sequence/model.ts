// The sequence-diagram canonical model. Unlike a flowchart (a positional graph),
// a sequence diagram is an *ordered script*: a list of statements (messages,
// notes, control blocks) over a set of participants. Layout is implicit (time
// flows down, participants are columns), so there are no per-node positions to
// persist — the model is purely the logical content, in source order.

/** A lifeline. `actor` renders as a stick figure; `participant` as a box. */
export interface SeqParticipant {
  /** Stable id used in messages (the left-hand token in `participant X as Y`). */
  id: string;
  /** Display name (the `as` alias); absent when it equals the id. */
  alias?: string;
  kind: "participant" | "actor";
}

/**
 * Message arrow styles, named by intent and mapped to Mermaid's `->>` family in
 * lineTypes.ts. Names mirror the flowchart EdgeKind spirit.
 */
export type SeqArrow =
  | "solid" // ->>   solid line, filled arrowhead
  | "dotted" // -->>  dotted line, filled arrowhead (replies)
  | "solid_open" // ->    solid line, no arrowhead
  | "dotted_open" // -->   dotted line, no arrowhead
  | "solid_cross" // -x    solid line, cross head (lost)
  | "dotted_cross" // --x   dotted line, cross head
  | "solid_point" // -)    solid line, open arrow (async)
  | "dotted_point" // --)   dotted line, open arrow (async)
  | "bi_solid" // <<->>  bidirectional solid
  | "bi_dotted"; // <<-->> bidirectional dotted

export interface SeqMessage {
  type: "message";
  from: string;
  to: string;
  arrow: SeqArrow;
  text: string;
  /** `+`/`-` activation suffix on the target, if any. */
  activate?: "activate" | "deactivate";
}

export interface SeqNote {
  type: "note";
  placement: "left" | "right" | "over";
  /** One actor for left/right; one or two for `over`. */
  actors: string[];
  text: string;
}

/** loop/opt/alt/par/critical/break — a grouping box with one or more branches. */
export type SeqBlockKind = "loop" | "opt" | "alt" | "par" | "critical" | "break";

export interface SeqBranch {
  /** The keyword's trailing label (`alt is ok` → "is ok"); "" when none. */
  label: string;
  statements: SeqStatement[];
}

export interface SeqBlock {
  type: "block";
  blockKind: SeqBlockKind;
  /** One branch for loop/opt/break; multiple for alt(else)/par(and)/critical(option). */
  branches: SeqBranch[];
}

export type SeqStatement = SeqMessage | SeqNote | SeqBlock;

export interface SequenceTrivia {
  /** Frontmatter / `%%{init}%%` directives / leading comments, verbatim. */
  header: string[];
}

export interface SequenceModel {
  kind: "sequence";
  /** `autonumber` directive present. */
  autonumber: boolean;
  participants: SeqParticipant[];
  statements: SeqStatement[];
  trivia: SequenceTrivia;
}

export function emptySequence(): SequenceModel {
  return {
    kind: "sequence",
    autonumber: false,
    participants: [],
    statements: [],
    trivia: { header: [] },
  };
}
