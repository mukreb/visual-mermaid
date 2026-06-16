// Mermaid version canary. This is the load-bearing safeguard for our use of the
// deprecated internal db API: if a mermaid upgrade changes the shape of the db
// (getVertices/getEdges/getDirection), this fails LOUDLY and immediately, instead
// of silently producing empty graphs in production.

import { describe, expect, it } from "vitest";
import mermaid from "mermaid";

describe("mermaid internal db canary (pinned 11.15.0)", () => {
  it("getDiagramFromText exposes the db shape we rely on", async () => {
    mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });
    const api = (mermaid as any).mermaidAPI;
    expect(typeof api?.getDiagramFromText).toBe("function");

    const diagram = await api.getDiagramFromText(
      "flowchart TD\n  A[Start] --> B{Decision}\n  B -->|yes| C((Done))",
    );
    const db = diagram.db;

    // getVertices() must be a Map in v11, with id/type/text on each vertex.
    const vertices = db.getVertices();
    expect(vertices instanceof Map).toBe(true);
    const a = vertices.get("A");
    expect(a).toMatchObject({ id: "A", text: "Start", type: "square" });

    // getEdges() must be an array with start/end/type/stroke.
    const edges = db.getEdges();
    expect(Array.isArray(edges)).toBe(true);
    expect(edges[0]).toMatchObject({ start: "A", end: "B", stroke: "normal" });
    expect(typeof edges[0].type).toBe("string");

    // getDirection() must return the flow direction. Note: mermaid 11.15
    // normalizes the equivalent "TD" to "TB" (both are top-down).
    expect(db.getDirection()).toBe("TB");
  });
});
