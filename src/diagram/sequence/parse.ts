// Text → SequenceModel. Reads Mermaid's internal sequence db — the same kind of
// unofficial surface as the flowchart parser, isolated here behind getSequenceDb()
// and guarded by the sequence canary test. The flat, ordered message list (which
// interleaves messages, notes and block markers) is rebuilt into the nested
// statement tree with a small container stack.

import mermaid from "mermaid";
import { MermaidParseError } from "../../sync/parseTextToModel";
import { blockMarker, LINETYPE, lineTypeToArrow, PLACEMENT } from "./lineTypes";
import type {
  SeqBlock,
  SeqParticipant,
  SeqStatement,
  SequenceModel,
} from "./model";

let initialized = false;
function ensureInit(): void {
  if (initialized) return;
  mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });
  initialized = true;
}

/**
 * ⚠️ ISOLATION POINT — the only place that touches Mermaid's internal sequence
 * API. Mirrors getFlowDb() in parseTextToModel.ts; same deprecation caveat.
 */
async function getSequenceDb(text: string): Promise<SeqDbLike> {
  ensureInit();
  const api = (mermaid as unknown as { mermaidAPI?: MermaidApiLike }).mermaidAPI;
  if (!api?.getDiagramFromText) {
    throw new MermaidParseError("mermaid.mermaidAPI.getDiagramFromText is unavailable");
  }
  const diagram = await api.getDiagramFromText(text);
  return diagram.db;
}

/** Leading frontmatter / `%%{init}%%` / comment lines mermaid would otherwise drop. */
function extractHeader(text: string): string[] {
  const header: string[] = [];
  const lines = text.split(/\r?\n/);
  let i = 0;
  if (lines[0]?.trim() === "---") {
    header.push(lines[0]);
    i = 1;
    while (i < lines.length && lines[i].trim() !== "---") header.push(lines[i++]);
    if (i < lines.length) header.push(lines[i++]); // closing ---
  }
  for (let j = i; j < lines.length; j++) {
    const line = lines[j];
    if (/^\s*%%\{.*\}%%\s*$/.test(line) || /^\s*%%/.test(line)) header.push(line.trim());
  }
  return header;
}

export async function parseSequenceToModel(text: string): Promise<SequenceModel> {
  const header = extractHeader(text);

  let db: SeqDbLike;
  try {
    db = await getSequenceDb(text);
  } catch (err) {
    throw new MermaidParseError(err instanceof Error ? err.message : String(err));
  }

  // Participants in declaration / first-appearance order.
  const participants: SeqParticipant[] = (db.getActorKeys?.() ?? []).map((id) => {
    const a = db.getActor?.(id);
    const name = String(id);
    const p: SeqParticipant = {
      id: name,
      kind: a?.type === "actor" ? "actor" : "participant",
    };
    if (a?.description != null && String(a.description) !== name) p.alias = String(a.description);
    return p;
  });

  // Rebuild the nested statement tree from the flat, ordered message list.
  const root: SeqStatement[] = [];
  const stack: { statements: SeqStatement[]; block: SeqBlock | null }[] = [
    { statements: root, block: null },
  ];
  const top = () => stack[stack.length - 1];
  let autonumber = false;

  for (const msg of db.getMessages?.() ?? []) {
    const text = msg.message != null ? String(msg.message) : "";

    if (msg.type === LINETYPE.AUTONUMBER) {
      autonumber = true;
      continue;
    }

    if (msg.type === LINETYPE.NOTE) {
      const from = String(msg.from);
      const to = String(msg.to);
      top().statements.push({
        type: "note",
        placement:
          msg.placement === PLACEMENT.LEFTOF
            ? "left"
            : msg.placement === PLACEMENT.RIGHTOF
              ? "right"
              : "over",
        actors: from === to ? [from] : [from, to],
        text,
      });
      continue;
    }

    const marker = blockMarker(msg.type);
    if (marker) {
      if (marker.role === "start") {
        const block: SeqBlock = {
          type: "block",
          blockKind: marker.blockKind,
          branches: [{ label: text, statements: [] }],
        };
        top().statements.push(block);
        stack.push({ statements: block.branches[0].statements, block });
      } else if (marker.role === "section") {
        const block = top().block;
        if (block) {
          const branch = { label: text, statements: [] as SeqStatement[] };
          block.branches.push(branch);
          top().statements = branch.statements;
        }
      } else if (stack.length > 1) {
        stack.pop();
      }
      continue;
    }

    const arrow = lineTypeToArrow(msg.type);
    if (arrow) {
      top().statements.push({
        type: "message",
        from: String(msg.from),
        to: String(msg.to),
        arrow,
        text,
        ...(msg.activate ? { activate: "activate" as const } : {}),
      });
    }
    // Anything else (activations, rect, …) is not yet modelled — skip it.
  }

  return { kind: "sequence", autonumber, participants, statements: root, trivia: { header } };
}

// --- Minimal structural types for the parts of the sequence db we read. ---

interface RawActor {
  name?: string;
  description?: string;
  type?: string;
}
interface RawMessage {
  from?: string | number;
  to?: string | number;
  message?: string;
  type: number;
  placement?: number;
  activate?: boolean;
}
interface SeqDbLike {
  getActorKeys?: () => string[];
  getActor?: (id: string) => RawActor | undefined;
  getMessages?: () => RawMessage[];
}
interface MermaidApiLike {
  getDiagramFromText: (text: string) => Promise<{ db: SeqDbLike }>;
}
