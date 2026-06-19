// Functional test: build a diagram containing EVERY node shape and EVERY edge
// kind by driving the same pure helpers the visual editor uses, "export" it via
// serializeModelToText (the app's text export), and assert it against a committed
// golden snapshot + a semantic round-trip. Runs under jsdom (no rendering).

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addNode, connect, setEdgeKind, setEdgeLabel } from "../src/flow/flowToModel";
import { emptyModel } from "../src/model/types";
import type { GraphModel } from "../src/model/types";
import { parseTextToModel } from "../src/sync/parseTextToModel";
import { serializeModelToText } from "../src/sync/serializeModelToText";
import { EDGE_OPTIONS, SHAPE_OPTIONS } from "../src/views/shapeOptions";
import { normalize } from "./helpers";

const goldenPath = join(process.cwd(), "tests", "fixtures", "all-shapes.mmd");

/**
 * Build the "setup diagram": one node per shape, chained edges cycling through
 * every edge kind, plus one labeled edge. Uses the same mutation helpers the
 * canvas calls, so this exercises the real visual-edit → text path.
 */
function buildAllShapesModel(): GraphModel {
  let m = emptyModel();

  // One node per shape (ids n1..n13 from nextNodeId, in SHAPE_OPTIONS order).
  for (const [shape, label] of SHAPE_OPTIONS) {
    m = addNode(m, { label, shape });
  }

  // Chain the nodes so we get (nodeCount - 1) edges to spread the kinds over.
  const nodeIds = m.nodes.map((n) => n.id);
  for (let i = 0; i + 1 < nodeIds.length; i++) {
    m = connect(m, nodeIds[i], nodeIds[i + 1]);
  }

  // Apply every edge kind cyclically; label the first edge to cover labeled edges.
  const edgeIds = m.edges.map((e) => e.id);
  edgeIds.forEach((id, i) => {
    m = setEdgeKind(m, id, EDGE_OPTIONS[i % EDGE_OPTIONS.length][0]);
  });
  m = setEdgeLabel(m, edgeIds[0], "yes");

  return m;
}

describe("all shapes + all edge kinds", () => {
  it("covers every shape and every edge kind", () => {
    const m = buildAllShapesModel();

    const shapes = new Set(m.nodes.map((n) => n.shape));
    for (const [shape] of SHAPE_OPTIONS) {
      expect(shapes.has(shape), `missing shape: ${shape}`).toBe(true);
    }

    const kinds = new Set(m.edges.map((e) => e.kind));
    for (const [kind] of EDGE_OPTIONS) {
      expect(kinds.has(kind), `missing edge kind: ${kind}`).toBe(true);
    }
  });

  it("matches the golden all-shapes export", async () => {
    const out = serializeModelToText(buildAllShapesModel());
    // Auto-creates tests/fixtures/all-shapes.mmd on first run; compares after.
    // Regenerate intentionally with `vitest -u` after an emitter change.
    await expect(out).toMatchFileSnapshot(goldenPath);
  });

  it("round-trips without loss (export → parse stays semantically equal)", async () => {
    const m1 = buildAllShapesModel();
    const m2 = await parseTextToModel(serializeModelToText(m1));
    expect(normalize(m2)).toEqual(normalize(m1));
  });
  // Note: the golden all-shapes.mmd is also exercised by the fixture glob in
  // roundtrip.test.ts, which asserts it parses + round-trips cleanly.
});
