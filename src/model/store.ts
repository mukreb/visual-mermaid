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
import type { DiagramModel } from "../diagram/adapter";
import { adapterForModel, adapterForText, defaultAdapter } from "../diagram/registry";
import { MermaidParseError } from "../sync/parseTextToModel";

export type EditSource = "code" | "visual" | null;

const HISTORY_LIMIT = 100;

function pushCapped(stack: DiagramModel[], model: DiagramModel): DiagramModel[] {
  const next = [...stack, model];
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

/** Serialize through whichever adapter owns the model. */
function emit(model: DiagramModel): string {
  return adapterForModel(model).serialize(model);
}

export interface EditorState {
  model: DiagramModel;
  /** Current code-view text (source of truth while the user types in code). */
  text: string;
  /** Baseline for dirty tracking — set on open/save. */
  savedText: string;
  /** Last successful parse diagnostic, or null. */
  error: string | null;
  lastEditedBy: EditSource;
  /**
   * Bumped each time a whole new document is loaded (open/new/initial). The
   * canvas watches this to refit the view — incremental edits don't bump it, so
   * typing in the code view never makes the canvas jump.
   */
  docVersion: number;

  past: DiagramModel[];
  future: DiagramModel[];

  /** User typed in the code view. Does not parse — the view debounces parseNow(). */
  setText: (text: string) => void;

  /** Parse the current text into the model, preserving positions. No-op on loop. */
  parseNow: () => Promise<void>;

  /** Apply a visual edit: mutate the model and re-emit the text (reformatted). */
  mutate: (fn: (model: DiagramModel) => DiagramModel) => void;

  /** Replace the whole document (e.g. on file open). Resets history + dirty. */
  loadText: (text: string) => Promise<void>;

  undo: () => void;
  redo: () => void;

  /**
   * Set the dirty baseline to the snapshot that was actually written. Pass the
   * exact saved text — defaulting to the current text would wrongly clear dirty
   * for edits made while a save was still pending.
   */
  markSaved: (savedText?: string) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  model: defaultAdapter.empty(),
  text: "",
  savedText: "",
  error: null,
  lastEditedBy: null,
  docVersion: 0,
  past: [],
  future: [],

  setText: (text) => set({ text, lastEditedBy: "code" }),

  parseNow: async () => {
    const { text, model: prev } = get();

    // Loop guard: this exact text is what we last emitted — nothing to parse.
    if (text === emit(prev)) return;

    const adapter = adapterForText(text);

    let parsed: DiagramModel;
    try {
      parsed = await adapter.parse(text);
    } catch (err) {
      set({ error: err instanceof MermaidParseError ? err.message : String(err) });
      return; // keep last good model + canvas untouched
    }

    // Stale-parse guard: bail if the text changed while we awaited the parse.
    if (get().text !== text) return;

    // Reconcile preserves per-id layout for things that already existed (so
    // typing in the code view doesn't make the canvas jump) and lays out only
    // new elements. If the diagram *type* changed, there's nothing to preserve —
    // hand the adapter an empty model of its own kind as the baseline.
    const baseline = prev.kind === adapter.kind ? prev : adapter.empty();

    set({
      model: adapter.reconcile(parsed, baseline),
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
      text: emit(next),
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
    // starts with a clean undo stack. Bump docVersion only *after* the parsed
    // model is installed: bumping it before the await would let the canvas
    // remount and fit the previous (still-current) model mid-parse, leaving the
    // newly opened graph unframed.
    set({ past: [], future: [], docVersion: get().docVersion + 1 });
  },

  undo: () => {
    const { past, future, model } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    set({
      model: prev,
      text: emit(prev),
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
      text: emit(next),
      lastEditedBy: "visual",
      error: null,
      past: [...past, model],
      future: future.slice(1),
    });
  },

  markSaved: (savedText) => set({ savedText: savedText ?? get().text }),
}));
