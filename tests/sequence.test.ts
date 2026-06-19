// Sequence-diagram two-way sync: round-trip over fixtures (the core property),
// targeted serializer checks, and a db-shape canary mirroring canary.test.ts.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import mermaid from "mermaid";
import { describe, expect, it } from "vitest";
import { parseSequenceToModel } from "../src/diagram/sequence/parse";
import { serializeSequenceToText } from "../src/diagram/sequence/serialize";
import type { SequenceModel } from "../src/diagram/sequence/model";

const fixturesDir = join(process.cwd(), "tests", "fixtures", "sequence");
const fixtures = readdirSync(fixturesDir).filter((f) => f.endsWith(".mmd"));

/** Trivia is re-emitted at the top; the model content is what must stay stable. */
function content(m: SequenceModel) {
  return { ...m, trivia: undefined };
}

describe("sequence round-trip over fixtures", () => {
  for (const file of fixtures) {
    it(`parse(serialize(parse(${file}))) is semantically stable`, async () => {
      const text = readFileSync(join(fixturesDir, file), "utf8");
      const m1 = await parseSequenceToModel(text);
      const m2 = await parseSequenceToModel(serializeSequenceToText(m1));
      expect(content(m2)).toEqual(content(m1));
    });
  }
});

describe("sequence serializer", () => {
  it("emits participants, actors and aliases", async () => {
    const m = await parseSequenceToModel(
      "sequenceDiagram\n  participant A as Alice\n  actor B\n  A->>B: hi",
    );
    const out = serializeSequenceToText(m);
    expect(out).toContain("participant A as Alice");
    expect(out).toContain("actor B");
    expect(out).toContain("A->>B: hi");
  });

  it("preserves note placement", async () => {
    const m = await parseSequenceToModel(
      "sequenceDiagram\n  participant A\n  participant B\n  Note over A,B: x\n  Note left of A: y",
    );
    const out = serializeSequenceToText(m);
    expect(out).toContain("Note over A,B: x");
    expect(out).toContain("Note left of A: y");
  });

  it("nests blocks with sections", async () => {
    const m = await parseSequenceToModel(
      "sequenceDiagram\n  participant A\n  participant B\n  alt ok\n    A->>B: yes\n  else no\n    A->>B: nope\n  end",
    );
    const out = serializeSequenceToText(m);
    expect(out).toMatch(/alt ok[\s\S]*else no[\s\S]*end/);
  });
});

describe("mermaid sequence db canary (pinned 11.15.0)", () => {
  it("exposes the sequence db shape + LINETYPE values we rely on", async () => {
    mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });
    const api = (mermaid as any).mermaidAPI;
    const diagram = await api.getDiagramFromText(
      "sequenceDiagram\n  participant A as Alice\n  actor B\n  A->>B: hi\n  B-->>A: yo\n  Note right of B: n",
    );
    const db = diagram.db;

    expect(db.getActorKeys()).toEqual(["A", "B"]);
    expect(db.getActor("A")).toMatchObject({ description: "Alice", type: "participant" });
    expect(db.getActor("B")).toMatchObject({ type: "actor" });

    const msgs = db.getMessages();
    expect(Array.isArray(msgs)).toBe(true);
    // First message: solid arrow (LINETYPE.SOLID === 0) from A to B.
    expect(msgs[0]).toMatchObject({ from: "A", to: "B", message: "hi", type: 0 });
    // Reply: dotted (LINETYPE.DOTTED === 1).
    expect(msgs[1]).toMatchObject({ type: 1 });
    // Note: LINETYPE.NOTE === 2, PLACEMENT.RIGHTOF === 1.
    expect(msgs[2]).toMatchObject({ type: 2, placement: 1 });

    // The enum values the line-type tables hard-code must match the db's.
    expect(db.LINETYPE).toMatchObject({ SOLID: 0, DOTTED: 1, NOTE: 2, LOOP_START: 10, ALT_ELSE: 13, AUTONUMBER: 26 });
    expect(db.PLACEMENT).toMatchObject({ LEFTOF: 0, RIGHTOF: 1, OVER: 2 });
  });
});
