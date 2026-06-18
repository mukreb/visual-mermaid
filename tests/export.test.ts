import { describe, expect, it } from "vitest";
import { deriveExportName, svgIntrinsicSize } from "../src/lib/exportDiagram";

describe("deriveExportName", () => {
  it("falls back to diagram.<ext> with no path", () => {
    expect(deriveExportName(null, "svg")).toBe("diagram.svg");
    expect(deriveExportName(null, "png")).toBe("diagram.png");
  });

  it("swaps a .mmd/.mermaid basename for the export extension", () => {
    expect(deriveExportName("/Users/me/flows/login.mmd", "svg")).toBe("login.svg");
    expect(deriveExportName("/Users/me/flows/login.mermaid", "png")).toBe("login.png");
    expect(deriveExportName("C:\\diagrams\\arch.mmd", "png")).toBe("arch.png");
  });

  it("keeps a basename that has no known extension", () => {
    expect(deriveExportName("/tmp/notes", "svg")).toBe("notes.svg");
  });
});

describe("svgIntrinsicSize", () => {
  it("prefers the viewBox dimensions", () => {
    const svg = '<svg viewBox="0 0 320 240" width="100%"><g/></svg>';
    expect(svgIntrinsicSize(svg)).toEqual({ width: 320, height: 240 });
  });

  it("falls back to width/height attributes without a usable viewBox", () => {
    const svg = '<svg width="640" height="480"><g/></svg>';
    expect(svgIntrinsicSize(svg)).toEqual({ width: 640, height: 480 });
  });

  it("uses sane defaults when nothing is parseable", () => {
    expect(svgIntrinsicSize("<svg><g/></svg>")).toEqual({ width: 800, height: 600 });
  });
});
