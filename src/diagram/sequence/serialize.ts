// Pure, deterministic emitter: SequenceModel → Mermaid sequence text. No DOM, no
// mermaid dependency — fully unit-testable. Mirrors serializeModelToText for
// flowcharts: declare participants once (in order), then emit the statement tree
// recursively, indenting nested blocks.

import { ARROW_SYNTAX, BLOCK_SYNTAX } from "./lineTypes";
import type { SeqNote, SeqParticipant, SeqStatement, SequenceModel } from "./model";

const INDENT = "    ";

function declareParticipant(p: SeqParticipant): string {
  const keyword = p.kind === "actor" ? "actor" : "participant";
  return p.alias ? `${keyword} ${p.id} as ${p.alias}` : `${keyword} ${p.id}`;
}

function noteLine(note: SeqNote): string {
  const target =
    note.placement === "over"
      ? `over ${note.actors.join(",")}`
      : `${note.placement} of ${note.actors[0]}`;
  return `Note ${target}: ${note.text}`;
}

/** A keyword + optional trailing label (`alt is ok` / bare `else`). */
function keywordLine(keyword: string, label: string): string {
  return label ? `${keyword} ${label}` : keyword;
}

function emitStatements(statements: SeqStatement[], depth: number, out: string[]): void {
  const pad = INDENT.repeat(depth);
  for (const s of statements) {
    if (s.type === "message") {
      const activate = s.activate === "activate" ? "+" : "";
      out.push(`${pad}${s.from}${ARROW_SYNTAX[s.arrow]}${activate}${s.to}: ${s.text}`);
    } else if (s.type === "note") {
      out.push(`${pad}${noteLine(s)}`);
    } else {
      const { open, section } = BLOCK_SYNTAX[s.blockKind];
      s.branches.forEach((branch, i) => {
        const keyword = i === 0 ? open : (section ?? open);
        out.push(`${pad}${keywordLine(keyword, branch.label)}`);
        emitStatements(branch.statements, depth + 1, out);
      });
      out.push(`${pad}end`);
    }
  }
}

export function serializeSequenceToText(model: SequenceModel): string {
  const lines: string[] = [];

  for (const h of model.trivia.header) lines.push(h);
  lines.push("sequenceDiagram");
  if (model.autonumber) lines.push(`${INDENT}autonumber`);

  for (const p of model.participants) lines.push(`${INDENT}${declareParticipant(p)}`);

  emitStatements(model.statements, 1, lines);

  return lines.join("\n") + "\n";
}
