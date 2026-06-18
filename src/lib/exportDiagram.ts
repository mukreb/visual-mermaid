// Diagram export (SVG + PNG). Renders the current text with a fresh
// mermaid.render() — independent of the Preview pane, so export works even when
// the preview is toggled off. Uses htmlLabels:false so labels are SVG <text>
// (not <foreignObject> HTML): that keeps the SVG self-contained and lets it
// rasterize to PNG reliably in WKWebView (foreignObject can blank or taint a
// canvas). The mermaid singleton's config is restored afterwards so the live
// Preview keeps its default (HTML) labels.

import mermaid from "mermaid";

export type ColorScheme = "light" | "dark";

/** Pure: default export filename derived from the open document path. */
export function deriveExportName(path: string | null, ext: "svg" | "png"): string {
  if (!path) return `diagram.${ext}`;
  const base = path.split(/[\\/]/).pop() ?? path;
  const stem = base.replace(/\.(mmd|mermaid)$/i, "");
  return `${stem || "diagram"}.${ext}`;
}

/** Pure: intrinsic pixel size of a rendered mermaid <svg>, preferring viewBox. */
export function svgIntrinsicSize(svg: string): { width: number; height: number } {
  const vb = svg.match(/viewBox\s*=\s*"([\d.\-\s]+)"/i);
  if (vb) {
    const parts = vb[1].trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }
  const w = svg.match(/\bwidth\s*=\s*"([\d.]+)/i);
  const h = svg.match(/\bheight\s*=\s*"([\d.]+)/i);
  return { width: w ? Number(w[1]) : 800, height: h ? Number(h[1]) : 600 };
}

/** Render the diagram to an SVG string, themed to match the app appearance. */
export async function renderDiagramSvg(text: string, scheme: ColorScheme): Promise<string> {
  if (!text.trim()) throw new Error("Nothing to export — the diagram is empty.");
  const theme = scheme === "dark" ? "dark" : "default";
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme,
    flowchart: { htmlLabels: false },
  });
  try {
    const { svg } = await mermaid.render(`export-${Date.now()}`, text);
    return svg;
  } finally {
    // Restore what Preview expects: same theme, default (HTML) labels. initialize
    // merges into the global config, so htmlLabels must be set back explicitly.
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme,
      flowchart: { htmlLabels: true },
    });
  }
}

/** Inject explicit pixel width/height so the SVG rasterizes at a known size. */
function withExplicitSize(svg: string, width: number, height: number): string {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const el = doc.documentElement;
  el.setAttribute("width", String(width));
  el.setAttribute("height", String(height));
  el.style.removeProperty("max-width");
  return new XMLSerializer().serializeToString(el);
}

/** Rasterize an SVG string to PNG bytes via a canvas. Browser/WebView only. */
export async function svgToPng(
  svg: string,
  opts: { scale?: number; background?: string } = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const scale = opts.scale ?? 2;
  const { width, height } = svgIntrinsicSize(svg);
  const sized = withExplicitSize(svg, width, height);

  const url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to load SVG for rasterization."));
      el.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable.");
    if (opts.background) {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) throw new Error("PNG encoding failed.");
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}
