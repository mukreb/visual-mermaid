// The adapter registry: maps text → adapter (by header detection) and model →
// adapter (by `kind` discriminant). The store routes every parse/serialize
// through here, so it never names a concrete diagram type.

import type { BaseModel, DiagramAdapter, DiagramKind } from "./adapter";
import { flowchartAdapter } from "./flowchart";
import { sequenceAdapter } from "./sequence";

// Order matters only for matches(): the first adapter whose matches() returns
// true wins. flowchart is the fallback (its matches is also the loosest), so it
// stays last and also serves as the default for unrecognized text.
const ADAPTERS: DiagramAdapter[] = [sequenceAdapter, flowchartAdapter];

/** The fallback adapter for empty/unrecognized documents. */
export const defaultAdapter: DiagramAdapter = flowchartAdapter;

/** Pick the adapter for some source text by its header keyword. */
export function adapterForText(text: string): DiagramAdapter {
  return ADAPTERS.find((a) => a.matches(text)) ?? defaultAdapter;
}

/** Pick the adapter that owns a given model, by its `kind` discriminant. */
export function adapterForModel(model: BaseModel): DiagramAdapter {
  const adapter = ADAPTERS.find((a) => a.kind === model.kind);
  if (!adapter) throw new Error(`No DiagramAdapter registered for kind: ${model.kind}`);
  return adapter;
}

/** The diagram type some source text declares (for kind-aware UI). */
export function detectKind(text: string): DiagramKind {
  return adapterForText(text).kind;
}
