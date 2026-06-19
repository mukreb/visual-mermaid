import { beforeEach, describe, expect, it } from "vitest";
import { addNode } from "../src/flow/flowToModel";
import { useEditorStore } from "../src/model/store";
import { emptyModel } from "../src/model/types";
import { asFlow } from "./helpers";

const store = useEditorStore;
const SAMPLE = "flowchart TD\n  A[Start] --> B[End]\n";

describe("undo/redo + dirty tracking", () => {
  beforeEach(() => {
    store.setState({
      model: emptyModel(),
      text: "",
      savedText: "",
      error: null,
      lastEditedBy: null,
      past: [],
      future: [],
    });
  });

  it("a freshly loaded document has a clean undo stack and is not dirty", async () => {
    await store.getState().loadText(SAMPLE);
    expect(store.getState().past).toHaveLength(0);
    expect(store.getState().future).toHaveLength(0);
    expect(store.getState().text).toBe(store.getState().savedText);
  });

  it("undo and redo step through model snapshots", async () => {
    await store.getState().loadText(SAMPLE);
    store.getState().mutate((m) => addNode(asFlow(m), { label: "X" }));
    store.getState().mutate((m) => addNode(asFlow(m), { label: "Y" }));
    expect(asFlow(store.getState().model).nodes).toHaveLength(4);

    store.getState().undo();
    expect(asFlow(store.getState().model).nodes).toHaveLength(3);
    store.getState().undo();
    expect(asFlow(store.getState().model).nodes).toHaveLength(2);

    store.getState().redo();
    expect(asFlow(store.getState().model).nodes).toHaveLength(3);
  });

  it("a new edit clears the redo stack", async () => {
    await store.getState().loadText(SAMPLE);
    store.getState().mutate((m) => addNode(asFlow(m), { label: "X" }));
    store.getState().undo();
    expect(store.getState().future).toHaveLength(1);
    store.getState().mutate((m) => addNode(asFlow(m), { label: "Z" }));
    expect(store.getState().future).toHaveLength(0);
  });

  it("marking a stale snapshot as saved keeps newer edits dirty", async () => {
    await store.getState().loadText(SAMPLE);
    const snapshot = store.getState().text; // what a save would have written
    store.getState().mutate((m) => addNode(asFlow(m), { label: "X" })); // edit mid-save
    store.getState().markSaved(snapshot); // baseline = the OLD written snapshot
    expect(store.getState().text !== store.getState().savedText).toBe(true);
  });

  it("tracks dirty against the saved baseline", async () => {
    await store.getState().loadText(SAMPLE);
    const dirty = () => store.getState().text !== store.getState().savedText;
    expect(dirty()).toBe(false);
    store.getState().mutate((m) => addNode(asFlow(m), { label: "X" }));
    expect(dirty()).toBe(true);
    store.getState().markSaved();
    expect(dirty()).toBe(false);
  });
});
