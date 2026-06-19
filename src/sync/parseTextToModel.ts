// Text → model. The single highest-risk module: it reads Mermaid's internal
// flowchart db, which is an unofficial (and, as of 11.6, deprecated) surface.
// ALL db access is isolated here behind getFlowDb(); the mermaid version is
// pinned in package.json and the canary test guards the db shape on upgrade.

import mermaid from "mermaid";
import { edgeToKind, vertexTypeToShape } from "../model/shapes";
import type {
  Direction,
  GEdge,
  GNode,
  GraphModel,
  GSubgraph,
} from "../model/types";
import { extractTrivia } from "./trivia";

export class MermaidParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MermaidParseError";
  }
}

let initialized = false;
function ensureInit(): void {
  if (initialized) return;
  mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });
  initialized = true;
}

/**
 * ⚠️ ISOLATION POINT — the only place that touches Mermaid's internal API.
 * `mermaidAPI.getDiagramFromText` both parses (throwing on invalid input) and
 * exposes `diagram.db`; there is no public alternative that yields the db.
 * If a successor appears, this is the one function to swap.
 */
async function getFlowDb(text: string): Promise<FlowDbLike> {
  ensureInit();
  const api = (mermaid as unknown as { mermaidAPI?: MermaidApiLike }).mermaidAPI;
  if (!api?.getDiagramFromText) {
    throw new MermaidParseError("mermaid.mermaidAPI.getDiagramFromText is unavailable");
  }
  const diagram = await api.getDiagramFromText(text);
  return diagram.db;
}

export async function parseTextToModel(text: string): Promise<GraphModel> {
  const trivia = extractTrivia(text);

  let db: FlowDbLike;
  try {
    db = await getFlowDb(text);
  } catch (err) {
    throw new MermaidParseError(err instanceof Error ? err.message : String(err));
  }

  const direction = normalizeDirection(db.getDirection?.());

  // getVertices() returns a Map in mermaid 11 (was a plain object in v10).
  const verticesRaw = db.getVertices();
  const vertices: RawVertex[] =
    verticesRaw instanceof Map
      ? Array.from(verticesRaw.values())
      : Object.values(verticesRaw ?? {});

  const nodes: GNode[] = vertices.map((v) => {
    const id = String(v.id);
    const node: GNode = {
      id,
      label: v.text != null ? String(v.text) : id,
      shape: vertexTypeToShape(v.type),
    };
    if (v.classes && v.classes.length) node.classes = [...v.classes];
    if (trivia.positions[id]) node.position = trivia.positions[id];
    return node;
  });

  const edges: GEdge[] = (db.getEdges() ?? []).map((e, i) => {
    const edge: GEdge = {
      id: e.id ? String(e.id) : `e${i}`,
      source: String(e.start),
      target: String(e.end),
      kind: edgeToKind(e.stroke, e.type),
    };
    const label = e.text != null ? String(e.text) : "";
    if (label.length > 0) edge.label = label;
    return edge;
  });

  const subgraphs: GSubgraph[] = (db.getSubGraphs?.() ?? []).map((s) => {
    const id = String(s.id);
    const sg: GSubgraph = {
      id,
      nodeIds: (s.nodes ?? []).map((n) => String(n)),
    };
    if (s.title != null && String(s.title) !== id) sg.title = String(s.title);
    if (s.dir) sg.direction = normalizeDirection(s.dir);
    return sg;
  });

  // `style <subgraphId> ...` / `class <subgraphId> ...` make mermaid's db emit a
  // stray vertex whose id is a subgraph id. Mermaid styles the cluster, not a
  // node, so drop these phantom vertices (only when nothing connects to them).
  const subgraphIds = new Set(subgraphs.map((s) => s.id));
  const referenced = new Set<string>();
  for (const e of edges) {
    referenced.add(e.source);
    referenced.add(e.target);
  }
  const realNodes = nodes.filter((n) => !(subgraphIds.has(n.id) && !referenced.has(n.id)));

  return { kind: "flowchart", direction, nodes: realNodes, edges, subgraphs, trivia };
}

function normalizeDirection(d: string | undefined): Direction {
  switch (d) {
    case "TB":
    case "TD":
    case "BT":
    case "LR":
    case "RL":
      return d;
    default:
      return "TB";
  }
}

// --- Minimal structural types for the parts of the mermaid db we read. ---
// Kept here (not in the model) precisely because they describe an unstable surface.

interface RawVertex {
  id: string | number;
  text?: string;
  type?: string;
  classes?: string[];
}
interface RawEdge {
  id?: string;
  start: string | number;
  end: string | number;
  text?: string;
  type?: string;
  stroke?: string;
}
interface RawSubgraph {
  id: string;
  title?: string;
  nodes?: (string | number)[];
  dir?: string;
}
interface FlowDbLike {
  getDirection?: () => string | undefined;
  getVertices: () => Map<string, RawVertex> | Record<string, RawVertex>;
  getEdges: () => RawEdge[] | undefined;
  getSubGraphs?: () => RawSubgraph[] | undefined;
}
interface MermaidApiLike {
  getDiagramFromText: (text: string) => Promise<{ db: FlowDbLike }>;
}
