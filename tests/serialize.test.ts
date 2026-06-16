// Pure emitter tests — no mermaid, no DOM. These pin the exact, deterministic
// output format (labels always quoted, node-then-edge ordering, %% @pos trivia).

import { describe, expect, it } from "vitest";
import { serializeModelToText } from "../src/sync/serializeModelToText";
import type { GraphModel } from "../src/model/types";
import { emptyModel } from "../src/model/types";

function model(partial: Partial<GraphModel>): GraphModel {
  return { ...emptyModel(), ...partial };
}

describe("serializeModelToText", () => {
  it("emits quoted labels, declarations then edges", () => {
    const out = serializeModelToText(
      model({
        direction: "TD",
        nodes: [
          { id: "A", label: "Start", shape: "rect" },
          { id: "B", label: "Decision", shape: "rhombus" },
        ],
        edges: [{ id: "e1", source: "A", target: "B", kind: "arrow", label: "go" }],
      }),
    );
    expect(out).toBe(
      ["flowchart TD", '    A["Start"]', '    B{"Decision"}', "    A -->|go| B", ""].join("\n"),
    );
  });

  it("maps every shape to its bracket", () => {
    const out = serializeModelToText(
      model({
        nodes: [
          { id: "a", label: "x", shape: "stadium" },
          { id: "b", label: "x", shape: "circle" },
          { id: "c", label: "x", shape: "hexagon" },
          { id: "d", label: "x", shape: "cylinder" },
        ],
      }),
    );
    expect(out).toContain('a(["x"])');
    expect(out).toContain('b(("x"))');
    expect(out).toContain('c{{"x"}}');
    expect(out).toContain('d[("x")]');
  });

  it("maps every edge kind to its arrow", () => {
    const kinds = ["arrow", "open", "dotted", "dotted_open", "thick", "thick_open"] as const;
    const arrows = ["-->", "---", "-.->", "-.-", "==>", "==="];
    const out = serializeModelToText(
      model({
        nodes: [
          { id: "A", label: "A", shape: "rect" },
          { id: "B", label: "B", shape: "rect" },
        ],
        edges: kinds.map((kind, i) => ({ id: `e${i}`, source: "A", target: "B", kind })),
      }),
    );
    for (const a of arrows) expect(out).toContain(`A ${a} B`);
  });

  it("escapes double quotes in labels", () => {
    const out = serializeModelToText(
      model({ nodes: [{ id: "A", label: 'Say "hi"', shape: "rect" }] }),
    );
    expect(out).toContain('A["Say #quot;hi#quot;"]');
  });

  it("appends positions as @pos trivia and re-emits header", () => {
    const out = serializeModelToText(
      model({
        trivia: { header: ["%% keep me"], positions: {} },
        nodes: [{ id: "A", label: "A", shape: "rect", position: { x: 10, y: 20 } }],
      }),
    );
    expect(out.startsWith("%% keep me\nflowchart")).toBe(true);
    expect(out).toContain("%% @pos A 10 20");
  });

  it("nests subgraph member nodes and declares the rest at top level", () => {
    const out = serializeModelToText(
      model({
        nodes: [
          { id: "A", label: "A", shape: "rect" },
          { id: "B", label: "B", shape: "rect" },
          { id: "C", label: "C", shape: "rect" },
        ],
        subgraphs: [{ id: "g1", title: "Group", nodeIds: ["A", "B"] }],
      }),
    );
    expect(out).toContain("    subgraph g1 [Group]");
    expect(out).toContain('        A["A"]');
    expect(out).toContain('        B["B"]');
    expect(out).toContain("    end");
    expect(out).toContain('    C["C"]'); // top level, outside subgraph
  });
});
