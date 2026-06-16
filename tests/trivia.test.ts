import { describe, expect, it } from "vitest";
import { extractTrivia } from "../src/sync/trivia";

describe("extractTrivia", () => {
  it("captures @pos position comments", () => {
    const t = extractTrivia("flowchart TD\n  A-->B\n%% @pos A 40 0\n%% @pos B 40 120\n");
    expect(t.positions).toEqual({ A: { x: 40, y: 0 }, B: { x: 40, y: 120 } });
  });

  it("preserves generic comments in the header", () => {
    const t = extractTrivia("%% a leading comment\nflowchart TD\n  A-->B\n");
    expect(t.header).toContain("%% a leading comment");
  });

  it("does not treat @pos lines as generic comments", () => {
    const t = extractTrivia("flowchart TD\n%% @pos A 1 2\n");
    expect(t.header).toEqual([]);
    expect(t.positions.A).toEqual({ x: 1, y: 2 });
  });

  it("captures frontmatter and init directives", () => {
    const text = "---\ntitle: Demo\n---\n%%{init: {'theme':'dark'}}%%\nflowchart TD\n  A-->B\n";
    const t = extractTrivia(text);
    expect(t.header).toContain("---");
    expect(t.header).toContain("title: Demo");
    expect(t.header.some((h) => h.startsWith("%%{init"))).toBe(true);
  });
});
