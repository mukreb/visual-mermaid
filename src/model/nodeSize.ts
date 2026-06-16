// Estimated on-canvas footprint of a node from its label. Used by BOTH the
// auto-layout (dagre needs widths/heights to space nodes) and the subgraph
// container sizing, so the two always agree. React Flow renders nodes at their
// natural content size; these estimates are intentionally a touch generous so
// dagre reserves enough room and long labels don't overlap.

const CHAR_W = 7.3; // ~px per character at the 13px canvas font
const LINE_H = 18; // px per text line
const PAD_X = 30; // horizontal padding + border (matches .shape-node)
const PAD_Y = 22; // vertical padding + border
const MIN_W = 90; // .shape-node min-width
const MIN_H = 40; // .shape-node min-height

/** Split a Mermaid label into visual lines (it uses <br>/<br/> for breaks). */
function labelLines(label: string): string[] {
  return label.split(/<br\s*\/?>/i);
}

export function estimateNodeSize(label: string): { width: number; height: number } {
  const lines = labelLines(label);
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  return {
    width: Math.max(MIN_W, Math.round(longest * CHAR_W + PAD_X)),
    height: Math.max(MIN_H, lines.length * LINE_H + PAD_Y),
  };
}
