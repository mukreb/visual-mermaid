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

import { create } from "zustand";
import { layoutNewNodes } from "../sync/layout";
import { MermaidParseError, parseTextToModel } from "../sync/parseTextToModel";
import { serializeModelToText } from "../sync/serializeModelToText";
import type { GraphModel } from "./types";
import { emptyModel } from "./types";

export type EditSource = "code" | "visual" | null;

export interface EditorState {
  model: GraphModel;
  /** Current code-view text (source of truth while the user types in code). */
  text: string;
  /** Last successful parse diagnostic, or null. */
  error: string | null;
  lastEditedBy: EditSource;

  /** User typed in the code view. Does not parse — the view debounces parseNow(). */
  setText: (text: string) => void;

  /** Parse the current text into the model, preserving positions. No-op on loop. */
  parseNow: () => Promise<void>;

  /** Apply a visual edit: mutate the model and re-emit the text (reformatted). */
  mutate: (fn: (model: GraphModel) => GraphModel) => void;

  /** Replace the whole document (e.g. on file open). */
  loadText: (text: string) => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  model: emptyModel(),
  text: "",
  error: null,
  lastEditedBy: null,

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

    // Stale-parse guard: if the text changed while we awaited the parse (a newer
    // keystroke or a file open), this result is outdated — discard it.
    if (get().text !== text) return;

    set({ model: layoutNewNodes(merged), error: null, lastEditedBy: "code" });
  },

  mutate: (fn) => {
    const next = fn(get().model);
    set({
      model: next,
      text: serializeModelToText(next),
      error: null,
      lastEditedBy: "visual",
    });
  },

  loadText: async (text) => {
    set({ text, lastEditedBy: "code", error: null });
    await get().parseNow();
  },
}));
