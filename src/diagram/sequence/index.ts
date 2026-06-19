// The sequence DiagramAdapter: binds the sequence pipeline (parse/serialize/flow)
// to the adapter seam. There are no per-element positions to preserve, so
// reconcile is the identity — a fresh parse fully replaces the model.

import type { DiagramAdapter } from "../adapter";
import { firstKeywordLine } from "../header";
import { sequenceToFlow } from "./flow";
import { emptySequence, type SequenceModel } from "./model";
import { parseSequenceToModel } from "./parse";
import { serializeSequenceToText } from "./serialize";

const HEADER = /^sequenceDiagram\b/;

export function isSequence(text: string): boolean {
  return HEADER.test(firstKeywordLine(text));
}

export const sequenceAdapter: DiagramAdapter<SequenceModel> = {
  kind: "sequence",
  matches: isSequence,
  empty: emptySequence,
  parse: parseSequenceToModel,
  serialize: serializeSequenceToText,
  reconcile: (parsed) => parsed,
  toFlow: sequenceToFlow,
};
