// Mapping tables between Mermaid's sequence LINETYPE enum (numeric, internal) and
// our SeqArrow / block model — plus the inverse arrow→syntax table the emitter
// uses. The numeric LINETYPE values are an unofficial surface (like the flowchart
// db); the sequence canary test pins them so an upgrade that renumbers them fails
// loudly instead of silently mis-mapping arrows.

import type { SeqArrow, SeqBlockKind } from "./model";

// LINETYPE values observed in mermaid 11.15 (db.LINETYPE), kept as named consts
// so the intent is legible where they're matched.
export const LINETYPE = {
  SOLID: 0,
  DOTTED: 1,
  NOTE: 2,
  SOLID_CROSS: 3,
  DOTTED_CROSS: 4,
  SOLID_OPEN: 5,
  DOTTED_OPEN: 6,
  LOOP_START: 10,
  LOOP_END: 11,
  ALT_START: 12,
  ALT_ELSE: 13,
  ALT_END: 14,
  OPT_START: 15,
  OPT_END: 16,
  PAR_START: 19,
  PAR_AND: 20,
  PAR_END: 21,
  SOLID_POINT: 24,
  DOTTED_POINT: 25,
  AUTONUMBER: 26,
  CRITICAL_START: 27,
  CRITICAL_OPTION: 28,
  CRITICAL_END: 29,
  BREAK_START: 30,
  BREAK_END: 31,
  PAR_OVER_START: 32,
  BIDIRECTIONAL_SOLID: 33,
  BIDIRECTIONAL_DOTTED: 34,
} as const;

export const PLACEMENT = { LEFTOF: 0, RIGHTOF: 1, OVER: 2 } as const;

/** Message LINETYPE → our SeqArrow. Returns null for non-message line types. */
export function lineTypeToArrow(type: number): SeqArrow | null {
  switch (type) {
    case LINETYPE.SOLID:
      return "solid";
    case LINETYPE.DOTTED:
      return "dotted";
    case LINETYPE.SOLID_OPEN:
      return "solid_open";
    case LINETYPE.DOTTED_OPEN:
      return "dotted_open";
    case LINETYPE.SOLID_CROSS:
      return "solid_cross";
    case LINETYPE.DOTTED_CROSS:
      return "dotted_cross";
    case LINETYPE.SOLID_POINT:
      return "solid_point";
    case LINETYPE.DOTTED_POINT:
      return "dotted_point";
    case LINETYPE.BIDIRECTIONAL_SOLID:
      return "bi_solid";
    case LINETYPE.BIDIRECTIONAL_DOTTED:
      return "bi_dotted";
    default:
      return null;
  }
}

/** SeqArrow → the Mermaid sequence arrow token the emitter writes. */
export const ARROW_SYNTAX: Record<SeqArrow, string> = {
  solid: "->>",
  dotted: "-->>",
  solid_open: "->",
  dotted_open: "-->",
  solid_cross: "-x",
  dotted_cross: "--x",
  solid_point: "-)",
  dotted_point: "--)",
  bi_solid: "<<->>",
  bi_dotted: "<<-->>",
};

/** Block-start LINETYPE → block kind + whether it opens a block / section / closes it. */
export type BlockMarker =
  | { role: "start"; blockKind: SeqBlockKind }
  | { role: "section"; blockKind: SeqBlockKind }
  | { role: "end" };

export function blockMarker(type: number): BlockMarker | null {
  switch (type) {
    case LINETYPE.LOOP_START:
      return { role: "start", blockKind: "loop" };
    case LINETYPE.OPT_START:
      return { role: "start", blockKind: "opt" };
    case LINETYPE.ALT_START:
      return { role: "start", blockKind: "alt" };
    case LINETYPE.PAR_START:
    case LINETYPE.PAR_OVER_START:
      return { role: "start", blockKind: "par" };
    case LINETYPE.CRITICAL_START:
      return { role: "start", blockKind: "critical" };
    case LINETYPE.BREAK_START:
      return { role: "start", blockKind: "break" };
    case LINETYPE.ALT_ELSE:
      return { role: "section", blockKind: "alt" };
    case LINETYPE.PAR_AND:
      return { role: "section", blockKind: "par" };
    case LINETYPE.CRITICAL_OPTION:
      return { role: "section", blockKind: "critical" };
    case LINETYPE.LOOP_END:
    case LINETYPE.OPT_END:
    case LINETYPE.ALT_END:
    case LINETYPE.PAR_END:
    case LINETYPE.CRITICAL_END:
    case LINETYPE.BREAK_END:
      return { role: "end" };
    default:
      return null;
  }
}

/** Block kind → its opening keyword and section keyword (for the emitter). */
export const BLOCK_SYNTAX: Record<SeqBlockKind, { open: string; section?: string }> = {
  loop: { open: "loop" },
  opt: { open: "opt" },
  alt: { open: "alt", section: "else" },
  par: { open: "par", section: "and" },
  critical: { open: "critical", section: "option" },
  break: { open: "break" },
};
