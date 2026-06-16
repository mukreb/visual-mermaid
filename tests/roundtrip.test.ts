// The most important tests: parse → serialize → parse must yield a semantically
// equal model. We compare the *model*, not the string, because formatting is
// deliberately normalized. Runs under jsdom (parsing only — no rendering).

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { GraphModel } from "../src/model/types";
import { parseTextToModel } from "../src/sync/parseTextToModel";
import { serializeModelToText } from "../src/sync/serializeModelToText";

const fixturesDir = join(process.cwd(), "tests", "fixtures");
const fixtures = readdirSync(fixturesDir).filter((f) => f.endsWith(".mmd"));

/** Order-independent, id-independent projection for semantic comparison. */
function normalize(m: GraphModel) {
  return {
    direction: m.direction,
    nodes: [...m.nodes]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((n) => ({ id: n.id, label: n.label, shape: n.shape })),
    edges: [...m.edges]
      .map((e) => ({ source: e.source, target: e.target, kind: e.kind, label: e.label ?? "" }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    subgraphs: [...m.subgraphs]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((s) => ({
        id: s.id,
        title: s.title ?? "",
        nodeIds: [...s.nodeIds].sort(),
        direction: s.direction ?? null,
      })),
  };
}

describe("round-trip over fixtures", () => {
  for (const file of fixtures) {
    it(`parse(serialize(parse(${file}))) is semantically stable`, async () => {
      const text = readFileSync(join(fixturesDir, file), "utf8");
      const m1 = await parseTextToModel(text);
      const out = serializeModelToText(m1);
      const m2 = await parseTextToModel(out);
      expect(normalize(m2)).toEqual(normalize(m1));
    });

    it(`serialized ${file} re-parses without error`, async () => {
      const text = readFileSync(join(fixturesDir, file), "utf8");
      const out = serializeModelToText(await parseTextToModel(text));
      await expect(parseTextToModel(out)).resolves.toBeDefined();
    });
  }

  it("preserves @pos positions through a round-trip", async () => {
    const text = readFileSync(join(fixturesDir, "comments.mmd"), "utf8");
    const m = await parseTextToModel(serializeModelToText(await parseTextToModel(text)));
    const a = m.nodes.find((n) => n.id === "A");
    expect(a?.position).toEqual({ x: 40, y: 0 });
  });

  it("preserves a leading comment through a round-trip", async () => {
    const text = readFileSync(join(fixturesDir, "comments.mmd"), "utf8");
    const out = serializeModelToText(await parseTextToModel(text));
    expect(out).toContain("%% a leading comment");
  });
});
