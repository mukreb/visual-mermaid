// Regression guard for the subgraph-heavy architecture diagrams that rendered
// fine in mermaid's own preview but came out scrambled on the canvas:
//   1. the auto-layout ignored subgraph membership, so members scattered by edge
//      connectivity and the decorative containers overlapped wildly;
//   2. `style <subgraphId>` left a phantom vertex that showed as a stray node.
// These tests assert the canvas-side geometry: clusters stay tight and disjoint,
// every member sits inside its container, and no phantom nodes leak through.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { modelToFlow } from "../src/flow/modelToFlow";
import { estimateNodeSize } from "../src/model/nodeSize";
import { layoutNewNodes } from "../src/sync/layout";
import { parseTextToModel } from "../src/sync/parseTextToModel";

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const rectsOverlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

async function laidOut(fixture: string) {
  const text = readFileSync(`${__dirname}/fixtures/${fixture}`, "utf8");
  return layoutNewNodes(await parseTextToModel(text));
}

function containers(model: Awaited<ReturnType<typeof laidOut>>): Box[] {
  return modelToFlow(model)
    .nodes.filter((n) => n.type === "group")
    .map((g) => ({ id: g.id, x: g.position.x, y: g.position.y, w: g.width!, h: g.height! }));
}

for (const fixture of ["subgraph-arch-current.mmd", "subgraph-arch-future.mmd"]) {
  describe(`cluster layout — ${fixture}`, () => {
    it("draws one container per subgraph with members positioned", async () => {
      const model = await laidOut(fixture);
      expect(model.subgraphs.length).toBeGreaterThan(0);
      expect(containers(model).length).toBe(model.subgraphs.length);
      expect(model.nodes.every((n) => n.position)).toBe(true);
    });

    it("keeps subgraph containers from overlapping each other", async () => {
      const boxes = containers(await laidOut(fixture));
      const hits: string[] = [];
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          if (rectsOverlap(boxes[i], boxes[j])) hits.push(`${boxes[i].id} ∩ ${boxes[j].id}`);
        }
      }
      expect(hits).toEqual([]);
    });

    it("encloses every member node inside its own container", async () => {
      const model = await laidOut(fixture);
      const boxes = containers(model);
      const byId = new Map(model.nodes.map((n) => [n.id, n]));
      const escaped: string[] = [];
      for (const sg of model.subgraphs) {
        const box = boxes.find((b) => b.id === `__sg_${sg.id}`);
        if (!box) continue;
        for (const id of sg.nodeIds) {
          const n = byId.get(id);
          if (!n?.position) continue;
          const { width, height } = estimateNodeSize(n.label);
          const inside =
            n.position.x >= box.x &&
            n.position.y >= box.y &&
            n.position.x + width <= box.x + box.w &&
            n.position.y + height <= box.y + box.h;
          if (!inside) escaped.push(`${id} ∉ ${sg.id}`);
        }
      }
      expect(escaped).toEqual([]);
    });
  });
}

describe("phantom vertices from style/class on a subgraph id", () => {
  it("does not surface the styled subgraph id as a node", async () => {
    // The future fixture styles its `ops` subgraph: `style ops fill:#FEF3C7,...`.
    const model = await parseTextToModel(
      readFileSync(`${__dirname}/fixtures/subgraph-arch-future.mmd`, "utf8"),
    );
    expect(model.subgraphs.some((s) => s.id === "ops")).toBe(true);
    expect(model.nodes.some((n) => n.id === "ops")).toBe(false);
  });

  it("keeps a subgraph-id vertex when an edge actually connects to it", async () => {
    // Here `core` is both a subgraph and an edge endpoint — it must be preserved.
    const text = [
      "flowchart TB",
      "  subgraph core",
      "    a[A]",
      "  end",
      "  x[X] --> core",
      "  style core fill:#eee",
    ].join("\n");
    const model = await parseTextToModel(text);
    expect(model.nodes.some((n) => n.id === "core")).toBe(true);
  });
});
