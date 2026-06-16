import { describe, expect, it } from "vitest";
import {
  addNode,
  connect,
  removeNode,
  setEdgeKind,
  setEdgeLabel,
  setNodeShape,
} from "../src/flow/flowToModel";
import { emptyModel } from "../src/model/types";

function seed() {
  let m = emptyModel();
  m = addNode(m, { label: "A" });
  m = addNode(m, { label: "B" });
  const [a, b] = m.nodes;
  m = connect(m, a.id, b.id);
  return m;
}

describe("flowToModel pure helpers", () => {
  it("setNodeShape changes only the target node", () => {
    const m = setNodeShape(seed(), "n1", "rhombus");
    expect(m.nodes.find((n) => n.id === "n1")?.shape).toBe("rhombus");
    expect(m.nodes.find((n) => n.id === "n2")?.shape).toBe("rect");
  });

  it("setEdgeKind changes the edge arrow kind", () => {
    const m = seed();
    const next = setEdgeKind(m, m.edges[0].id, "dotted");
    expect(next.edges[0].kind).toBe("dotted");
  });

  it("setEdgeLabel sets and clears the label", () => {
    const m = seed();
    const withLabel = setEdgeLabel(m, m.edges[0].id, "yes");
    expect(withLabel.edges[0].label).toBe("yes");
    const cleared = setEdgeLabel(withLabel, m.edges[0].id, "");
    expect(cleared.edges[0].label).toBeUndefined();
  });

  it("removeNode drops the node and its incident edges", () => {
    const m = removeNode(seed(), "n1");
    expect(m.nodes.map((n) => n.id)).toEqual(["n2"]);
    expect(m.edges).toHaveLength(0);
  });
});
