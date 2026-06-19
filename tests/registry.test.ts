// The diagram-adapter seam: detection (text → adapter), model dispatch
// (kind → adapter), and that the flowchart adapter still round-trips through
// the generic interface exactly as the underlying pipeline does.

import { describe, expect, it } from "vitest";
import { adapterForModel, adapterForText, detectKind } from "../src/diagram/registry";
import { normalize } from "./helpers";

describe("diagram registry", () => {
  it("detects flowchart from its header keywords (skipping frontmatter/comments)", () => {
    expect(detectKind("flowchart TD\n  A --> B")).toBe("flowchart");
    expect(detectKind("graph LR\n  A --> B")).toBe("flowchart");
    expect(detectKind("%% a comment\nflowchart TD\n  A --> B")).toBe("flowchart");
    expect(detectKind("---\ntitle: Hi\n---\nflowchart TD\n  A --> B")).toBe("flowchart");
  });

  it("detects sequence diagrams by their header keyword", () => {
    expect(detectKind("sequenceDiagram\n  A->>B: hi")).toBe("sequence");
    expect(detectKind("%% note\nsequenceDiagram\n  A->>B: hi")).toBe("sequence");
  });

  it("falls back to the flowchart adapter for empty/unknown text", () => {
    expect(detectKind("")).toBe("flowchart");
    expect(adapterForText("not a diagram").kind).toBe("flowchart");
  });

  it("round-trips a sequence diagram through the adapter interface", async () => {
    const src = "sequenceDiagram\n  participant A\n  participant B\n  A->>B: hi";
    const adapter = adapterForText(src);
    expect(adapter.kind).toBe("sequence");
    const m1 = await adapter.parse(src);
    const m2 = await adapter.parse(adapter.serialize(m1));
    expect(adapterForModel(m2).kind).toBe("sequence");
    expect(adapter.serialize(m2)).toBe(adapter.serialize(m1));
  });

  it("dispatches a model to its owning adapter by kind", () => {
    const empty = adapterForText("flowchart TD").empty();
    expect(adapterForModel(empty).kind).toBe("flowchart");
  });

  it("round-trips a flowchart through the adapter interface", async () => {
    const adapter = adapterForText("flowchart TD\n  A[Start] --> B{Go}");
    const m1 = await adapter.parse("flowchart TD\n  A[Start] --> B{Go}");
    const m2 = await adapter.parse(adapter.serialize(m1));
    expect(normalize(m2)).toEqual(normalize(m1));
  });
});
