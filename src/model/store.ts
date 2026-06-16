// The dual-master orchestrator. Holds the canonical model + the code-view text,
// and mediates the two edit directions so they never feed back into each other:
//
//   code edit   →  setText()  →  (debounced) parseNow()  → model   [text untouched]
//   visual edit →  mutate()   →  serialize → text                  [no re-parse]
//
// Loop guard: parseNow() ignores text that already equals serialize(model) — i.e.
// text we ourselves just emitted from a visual edit — so a visual mutation can
// never trigger a parse, and the code editor's onChange (which may fire on a
// programmatic setValue) is a no-op when the value matches.
//
// Undo/redo keeps a stack of model snapshots; restoring re-emits the text.
// Dirty tracking compares the current text to the last saved/opened baseline.

import { create } from "zustand";
import { layoutNewNodes } from "../sync/layout";
import { MermaidParseError, parseTextToModel } from "../sync/parseTextToModel";
import { serializeModelToText } from "../sync/serializeModelToText";
import type { GraphModel } from "./types";
import { emptyModel } from "./types";

export type EditSource = "code" | "visual" | null;

const HISTORY_LIMIT = 100;

function pushCapped(stack: GraphModel[], model: GraphModel): GraphModel[] {
  const next = [...stack, model];
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

export interface EditorState {
  model: GraphModel;
  /** Current code-view text (source of truth while the user types in code). */
  text: string;
  /** Baseline for dirty tracking — set on open/save. */
  savedText: string;
  /** Last successful parse diagnostic, or null. */
  error: string | null;
  lastEditedBy: EditSource;

  past: GraphModel[];
  future: GraphModel[];

  /** User typed in the code view. Does not parse — the view debounces parseNow(). */
  setText: (text: string) => void;

  /** Parse the current text into the model, preserving positions. No-op on loop. */
  parseNow: () => Promise<void>;

  /** Apply a visual edit: mutate the model and re-emit the text (reformatted). */
  mutate: (fn: (model: GraphModel) => GraphModel) => void;

  /** Replace the whole document (e.g. on file open). Resets history + dirty. */
  loadText: (text: string) => Promise<void>;

  undo: () => void;
  redo: () => void;

  /** Mark the current text as saved (clears dirty). */
  markSaved: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  model: emptyModel(),
  text: "",
  savedText: "",
  error: null,
  lastEditedBy: null,
  past: [],
  future: [],

  setText: (text) => set({ text, lastEditedBy: "code" }),

  parseNow: async () => {
    const { text, model: prev } = get();

    // Loop guard: this exact text is what we last emitted — nothing to parse.
    if (text === serializeModelToText(prev)) return;

    let parsed: GraphModel;
    try {
      parsed = await parseTextToModel(text);
    } catch (err) {
      set({ error: err instanceof MermaidParseError ? err.message : String(err) });
      return; // keep last good model + canvas untouched
    }

    // Stale-parse guard: bail if the text changed while we awaited the parse.
    if (get().text !== text) return;

    // Preserve on-canvas positions for nodes that already existed, so typing in
    // the code view doesn't make the canvas jump. Only genuinely new nodes layout.
    const prevPos = new Map(
      prev.nodes.filter((n) => n.position).map((n) => [n.id, n.position!]),
    );
    const merged: GraphModel = {
      ...parsed,
      nodes: parsed.nodes.map((n) =>
        n.position ? n : prevPos.has(n.id) ? { ...n, position: prevPos.get(n.id) } : n,
      ),
    };

    set({
      model: layoutNewNodes(merged),
      error: null,
      lastEditedBy: "code",
      past: pushCapped(get().past, prev),
      future: [],
    });
  },

  mutate: (fn) => {
    const prev = get().model;
    const next = fn(prev);
    set({
      model: next,
      text: serializeModelToText(next),
      error: null,
      lastEditedBy: "visual",
      past: pushCapped(get().past, prev),
      future: [],
    });
  },

  loadText: async (text) => {
    set({
      text,
      savedText: text,
      lastEditedBy: "code",
      error: null,
      past: [],
      future: [],
    });
    await get().parseNow();
    // parseNow records history for the parse; reset it — a fresh document
    // starts with a clean undo stack.
    set({ past: [], future: [] });
  },

  undo: () => {
    const { past, future, model } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    set({
      model: prev,
      text: serializeModelToText(prev),
      lastEditedBy: "visual",
      error: null,
      past: past.slice(0, -1),
      future: [model, ...future],
    });
  },

  redo: () => {
    const { past, future, model } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      model: next,
      text: serializeModelToText(next),
      lastEditedBy: "visual",
      error: null,
      past: [...past, model],
      future: future.slice(1),
    });
  },

  markSaved: () => set({ savedText: get().text }),
}));
