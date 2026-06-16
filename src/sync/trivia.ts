// Pre-pass that captures what Mermaid's Jison lexer throws away, so a round-trip
// is non-destructive: frontmatter / `%%{init}%%` directives, and our own
// `%% @pos <id> <x> <y>` position comments. Runs before parsing; pure & DOM-free.

import type { Trivia } from "../model/types";

const POS_RE = /^\s*%%\s*@pos\s+(\S+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*$/;
const INIT_RE = /^\s*%%\{.*\}%%\s*$/;

export function extractTrivia(text: string): Trivia {
  const header: string[] = [];
  const positions: Record<string, { x: number; y: number }> = {};
  const lines = text.split(/\r?\n/);

  // Leading YAML frontmatter block: --- ... --- at the very top of the file.
  let i = 0;
  if (lines[0]?.trim() === "---") {
    header.push(lines[0]);
    i = 1;
    while (i < lines.length && lines[i].trim() !== "---") {
      header.push(lines[i]);
      i++;
    }
    if (i < lines.length) {
      header.push(lines[i]); // closing ---
      i++;
    }
  }

  for (let j = i; j < lines.length; j++) {
    const line = lines[j];
    if (INIT_RE.test(line)) {
      header.push(line.trim());
      continue;
    }
    const pos = POS_RE.exec(line);
    if (pos) {
      positions[pos[1]] = { x: Number(pos[2]), y: Number(pos[3]) };
      continue;
    }
    // Generic full-line comment — preserved (best-effort) by re-emitting in the
    // header. Position is normalized to the top; that is documented, intentional.
    if (/^\s*%%/.test(line)) {
      header.push(line.trim());
    }
  }

  return { header, positions };
}
