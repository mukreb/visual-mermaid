// Dual-master sync + loop guard. Asserts a visual mutation re-emits text without
// triggering a parse (no feedback loop), and that the code→model path works.

import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "../src/model/store";
import { addNode } from "../src/flow/flowToModel";
import { emptyModel } from "../src/model/types";
import { asFlow } from "./helpers";

const store = useEditorStore;

describe("editor store", () => {
  beforeEach(() => {
    store.setState({ model: emptyModel(), text: "", error: null, lastEditedBy: null });
  });

  it("code path: loadText parses text into the model", async () => {
    await store.getState().loadText("flowchart TD\n  A[Start] --> B[End]\n");
    const { model, error, lastEditedBy } = store.getState();
    expect(error).toBeNull();
    expect(lastEditedBy).toBe("code");
    expect(asFlow(model).nodes.map((n) => n.id).sort()).toEqual(["A", "B"]);
    expect(asFlow(model).edges).toHaveLength(1);
  });

  it("visual path: mutate re-emits text and marks source visual", async () => {
    await store.getState().loadText("flowchart TD\n  A[Start] --> B[End]\n");
    store.getState().mutate((m) => addNode(asFlow(m), { label: "Extra" }));
    const { model, text, lastEditedBy } = store.getState();
    expect(lastEditedBy).toBe("visual");
    expect(asFlow(model).nodes).toHaveLength(3);
    expect(text).toContain('"Extra"');
  });

  it("loop guard: parseNow is a no-op on text we just emitted from a visual edit", async () => {
    await store.getState().loadText("flowchart TD\n  A[Start] --> B[End]\n");
    store.getState().mutate((m) => addNode(asFlow(m), { label: "Extra" }));
    const before = store.getState().model;

    await store.getState().parseNow(); // must not re-parse our own emitted text

    const after = store.getState();
    expect(after.lastEditedBy).toBe("visual"); // unchanged — parse was skipped
    expect(after.model).toBe(before); // same reference — model untouched
  });

  it("ignores a stale parse whose text was superseded mid-flight", async () => {
    await store.getState().loadText("flowchart TD\n  A[Start] --> B[End]\n");
    const sample = store.getState().model;

    // Kick off a parse, then immediately supersede the text before it resolves.
    const inFlight = store.getState().parseNow();
    store.getState().setText("flowchart TD\n  X[New] --> Y[New]\n");
    await inFlight;

    // The stale result for the old text must not have been committed.
    expect(store.getState().model).toBe(sample);
    expect(asFlow(store.getState().model).nodes.map((n) => n.id).sort()).toEqual(["A", "B"]);
  });

  it("toolbar-added nodes get a position (no stacking, emits @pos)", async () => {
    await store.getState().loadText("flowchart TD\n  A[Start] --> B[End]\n");
    store.getState().mutate((m) => addNode(asFlow(m), { label: "Extra" }));
    const added = asFlow(store.getState().model).nodes.find((n) => n.label === "Extra");
    expect(added?.position).toBeDefined();
    expect(store.getState().text).toContain("%% @pos");
  });

  it("bumps docVersion only after the parsed model is installed", async () => {
    // Guards the canvas-refit race: if docVersion advances before parseNow
    // commits the new model, VisualView remounts and fits the *previous* graph.
    await store.getState().loadText("flowchart TD\n  A[Start] --> B[End]\n");
    const startVersion = store.getState().docVersion;
    const startModel = store.getState().model;

    const violations: string[] = [];
    const unsub = store.subscribe((s) => {
      if (s.docVersion > startVersion && s.model === startModel) {
        violations.push("docVersion bumped while model was still the previous document");
      }
    });
    await store.getState().loadText("flowchart TD\n  X[New] --> Y[New]\n");
    unsub();

    expect(violations).toEqual([]);
    expect(store.getState().docVersion).toBe(startVersion + 1);
    expect(asFlow(store.getState().model).nodes.map((n) => n.id).sort()).toEqual(["X", "Y"]);
  });

  it("keeps the last good model on a parse error", async () => {
    await store.getState().loadText("flowchart TD\n  A[Start] --> B[End]\n");
    const good = store.getState().model;
    store.getState().setText("flowchart TD\n  A[Start] -->"); // invalid
    await store.getState().parseNow();
    const s = store.getState();
    expect(s.error).not.toBeNull();
    expect(s.model).toBe(good); // canvas untouched
  });
});
