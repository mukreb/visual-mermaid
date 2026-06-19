// The most important tests: parse → serialize → parse must yield a semantically
// equal model. We compare the *model*, not the string, because formatting is
// deliberately normalized. Runs under jsdom (parsing only — no rendering).

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseTextToModel } from "../src/sync/parseTextToModel";
import { serializeModelToText } from "../src/sync/serializeModelToText";
import { normalize } from "./helpers";

const fixturesDir = join(process.cwd(), "tests", "fixtures");
const fixtures = readdirSync(fixturesDir).filter((f) => f.endsWith(".mmd"));

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
