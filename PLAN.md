# Plan: Visual Mermaid Editor for macOS

## Context

`visual-mermaid` is currently an empty repo (just `README.md` + the MIT `LICENSE`).
The goal: a **macOS desktop app** in which you edit Mermaid diagrams in two
synchronized ways:

1. **Code view** — type Mermaid syntax, with a live preview.
2. **Visual view** — drag nodes, double-click to rename, add/remove nodes and edges;
   those changes write themselves back to valid Mermaid code.

The **core challenge** is that Mermaid.js only works one way (text → SVG). A visual
editor requires a **two-way sync** between Mermaid text and an editable graph model.
That is what this plan is built around.

### Choices (agreed with the user)
- **Framework:** Tauri v2 (Rust shell + web frontend in the native WebView). Small, native feel.
- **MVP scope:** **flowchart only**, with full code↔visual sync. Other diagram types come later.
- **Distribution:** personal use — build/run locally, **no** code-signing/notarization for now.

---

## Tech stack

| Component | Choice | Version guidance |
|---|---|---|
| Desktop shell | **Tauri v2** | 2.x |
| Frontend | **React 18 + TypeScript + Vite** | Tauri-recommended toolchain |
| Code editor | **Monaco** (`monaco-editor` + `@monaco-editor/react`) | with a custom Mermaid tokenizer |
| Parser + preview | **mermaid 11** (`mermaid`) | **pin an exact version** (see risks) |
| Visual canvas | **@xyflow/react** (React Flow 12) | node/edge editor with drag/connect |
| State | **Zustand** | lightweight store (React Flow uses it internally too) |
| Auto-layout | **@dagrejs/dagre** | seed positions for newly parsed nodes (maintained fork of the abandoned `dagre`) |
| Tests | **Vitest** (+ browser mode / Playwright for render checks) | round-trip + sync tests |

Why not Electron: ~90 MB bundle + its own Chromium, not needed. Why not native SwiftUI:
you'd still have to embed a WKWebView for Mermaid + React Flow.

---

## Architecture

**Source of truth:** a dedicated **canonical graph model** (in Zustand) is the resting-state
truth. The view currently being edited is temporarily authoritative (**dual-master,
last-edited-wins**):

- **Typing in the code view** → debounce (~300 ms) → `mermaid` parse → on success rebuild the
  model → derive React Flow nodes (keep positions per node id; auto-layout only *new* nodes).
  On parse error: keep the last good model, show a diagnostic, don't touch the canvas.
- **Editing on the canvas** → mutate the model → run the emitter → replace the code-editor text (reformatted).
- A `lastEditedBy: 'code' | 'visual'` flag + dirty-tracking prevents feedback loops.

```
            ┌──────────────────────────────────────────┐
            │   Canonical Graph Model (Zustand)         │
            │   nodes[], edges[], subgraphs[],          │
            │   direction, styles, trivia, positions    │
            └─────────▲────────────────────▲────────────┘
        parse+map     │                    │   mutate
   (debounced, ok)    │                    │
   ┌──────────────────┴───┐        ┌───────┴──────────────────┐
   │ text → model         │        │ model → text (emitter)   │
   │ (mermaid flowchart db)│        └───────┬──────────────────┘
   └──────────▲───────────┘                 │
        ┌─────┴──────┐      ┌────────────────▼──┐     ┌─────────────┐
        │ Code (Monaco)│    │ Visual (@xyflow)  │     │ Preview SVG │
        └──────────────┘    └───────────────────┘     │ mermaid.render│
                                                       └─────────────┘
```

- **Live preview** always renders from the current *text* via `mermaid.render()` (read-only, debounced).
- The **visual view** binds to the *model* (mapped to React Flow shapes), not to the preview SVG.
- The preview pane is effectively a "ground-truth render" that catches emitter bugs the canvas
  would hide. Since the React Flow canvas is itself a rendered view, consider making the SVG
  preview a **toggle** rather than a permanent third of the window.

### Text → model (parsing)
For flowcharts, mermaid 11 still uses the legacy **Jison** parser; the newer
`@mermaid-js/parser` (Langium) does not cover flowchart yet. So: parse and read the internal
flowchart **db** (the same approach `@excalidraw/mermaid-to-excalidraw` uses in production):

```ts
// getDiagramFromText both parses AND exposes db; it throws on invalid input,
// so a separate mermaid.parse() call for validation is redundant — just catch the throw.
const diagram = await mermaid.mermaidAPI.getDiagramFromText(text);
const db = diagram.db;
db.getVertices();   // ⚠️ returns a Map in mermaid 11 (was a plain object in v10) — iterate accordingly
db.getEdges();
db.getSubGraphs();
db.getClasses();    // needed if/when we round-trip classDef styles
db.getDirection();  // verify this exists on FlowDB for the pinned version (Excalidraw derives direction differently)
```
→ map to the canonical model. **Isolate all db access in a single file** + exact version pin.

> ⚠️ **API stability:** `mermaidAPI.getDiagramFromText` is **deprecated for external use as of
> mermaid 11.6, with no public replacement that exposes `db`** — Excalidraw's own source notes
> this. It works today, but it is the single most upgrade-fragile dependency in this project.
> Mitigation: pin an exact mermaid version (match what Excalidraw currently ships against),
> isolate it behind one module, and rely on the version canary test (see Verification).

### Model → text (serializing)
Hand-written, deterministic, pure emitter (fully unit-testable). Table-driven:
shape→bracket (`[]` / `{}` / `(())`), edge-kind→arrow (`-->` / `---` / `-.->` / `==>`),
labels `-->|text|`, subgraphs, `direction`.

### Round-trip pitfalls (explicit)
- **Comments (`%% ...`) disappear** in the Jison lexer → preserve them + directives/frontmatter via
  a light pre-pass (`trivia.ts`) and re-emit them.
- **Formatting gets normalized** — after a visual edit the code is reformatted (Prettier-style).
  Documented, intentional behavior; only on visual edits, never while typing.
- **Positions** are stored per node id in the model and as `%% @pos` trivia in the `.mmd` file,
  so the layout survives a round-trip and the file still opens in other Mermaid tools. (Because
  these positions live in comments, the `trivia` pre-pass must extract them *before* parsing,
  since mermaid drops comments.)

---

## Project structure (to be created)

```
visual-mermaid/
├─ src-tauri/
│  ├─ src/main.rs                  # Tauri entrypoint, window/menu
│  ├─ src/commands.rs              # open/save .mmd, recent files
│  ├─ tauri.conf.json              # bundle id, window (signing later)
│  └─ Cargo.toml
├─ src/
│  ├─ main.tsx                     # React root
│  ├─ App.tsx                      # 3-pane layout (code | visual | preview) + toolbar
│  ├─ model/
│  │  ├─ types.ts                  # GraphModel, GNode, GEdge, GSubgraph, Trivia  ← DESIGN FIRST
│  │  ├─ store.ts                  # Zustand + lastEditedBy + dirty flags + loop guards
│  │  └─ shapes.ts                 # shape↔bracket + edge-kind↔arrow tables
│  ├─ sync/
│  │  ├─ parseTextToModel.ts       # mermaid db → GraphModel  ← highest risk
│  │  ├─ serializeModelToText.ts   # GraphModel → mermaid text (pure emitter)
│  │  ├─ trivia.ts                 # extract + re-emit comments/directives/positions
│  │  └─ layout.ts                 # dagre auto-layout for new nodes
│  ├─ views/
│  │  ├─ CodeView.tsx              # Monaco + Mermaid language + error diagnostics
│  │  ├─ VisualView.tsx            # React Flow canvas + custom nodes/edges
│  │  ├─ Preview.tsx               # mermaid.render() SVG, debounced
│  │  └─ nodes/                    # ProcessNode, DecisionNode, RoundNode, ...
│  ├─ flow/
│  │  ├─ modelToFlow.ts            # GraphModel → {nodes,edges} for React Flow
│  │  └─ flowToModel.ts            # React Flow change events → model mutations
│  ├─ mermaid/mermaidLanguage.ts   # Monarch tokenizer for Monaco
│  └─ lib/debounce.ts
├─ tests/
│  ├─ roundtrip.test.ts
│  └─ fixtures/*.mmd
├─ package.json · vite.config.ts · tsconfig.json
```

### Most important files
- **`model/types.ts`** — the model contract; everything hangs off it. Design first.
- **`sync/parseTextToModel.ts`** — text→model via the mermaid db; most version-sensitive, behind tests.
- **`sync/serializeModelToText.ts`** — deterministic emitter; pure function.
- **`model/store.ts`** — orchestrates dual-master sync (debounce, lastEditedBy, loop guards, positions).
- **`flow/modelToFlow.ts` + `flowToModel.ts`** — binding between the model and React Flow.

---

## Build plan (phased)

### Phase 0 — Scaffold
`npm create tauri-app@latest` (React + TS + Vite, Tauri v2). Add dependencies:
`mermaid @xyflow/react monaco-editor @monaco-editor/react zustand @dagrejs/dagre` (+ `vitest` dev).
3-pane layout shell. Verify it opens as a macOS window (`npm run tauri dev`).

### Phase 1 — MVP: flowchart with two-way sync (the core)
1. `model/types.ts` + emitter (`serializeModelToText`) + round-trip tests on fixtures.
2. `parseTextToModel` via the mermaid db; dagre auto-layout for positions.
3. Code view (Monaco) → debounced parse → model; live preview from text.
4. Visual view (React Flow) bound to the model: dragging, double-click rename,
   add/remove node, draw edge → mutate model → re-emit text.
5. Wire up dual-master sync + loop guards. Open/Save `.mmd` via Tauri commands.

**MVP done when:** typing flowchart text → appears on the canvas; drag/rename/add/remove/connect
on the canvas → valid text updates; round-trip tests green; comments preserved via trivia.

### Phase 2 — Polish (later)
Shapes palette, edge styles, subgraphs, `direction` toggle, undo/redo (Zustand history),
error diagnostics in the gutter, position persistence, theming, export SVG/PNG.

### Phase 3 — More diagram types (in progress)
A `DiagramAdapter` interface (`matches`, `empty`, `parse`, `serialize`, `reconcile`, `toFlow`) so
each type is a pluggable module (`src/diagram/`: `adapter.ts`, `registry.ts`, per-type modules).
Order: **sequence** → state → class → ER.

**Done:**
- ✅ `DiagramAdapter` seam + registry (text→adapter by header, model→adapter by `kind`); the
  flowchart pipeline refactored to implement it (`flowchartAdapter`). Store is adapter-driven.
- ✅ **Sequence** module: model (participants/actors, message arrow styles, notes,
  loop/opt/alt/par/critical/break blocks), parse via the mermaid sequence db (isolated +
  canary-pinned `LINETYPE` enum), deterministic emitter, round-trip tests. Wired into the editor:
  the code view + live Preview are fully two-way; the visual canvas shows a **read-only** lifeline/
  message projection (sequence editing is code-view only for now).

**Next:** sequence visual *editing* (drag participants, add messages) → then **state** diagrams.

### Phase 4 — Distribution (later, if wanted)
Code-signing + notarization in `tauri.conf.json`, DMG, auto-update, `.mmd` file association.

---

## Verification

- **Round-trip property tests (most important):** a corpus of `.mmd` fixtures (simple, branching,
  edge labels, subgraphs, all shapes, comments). Assert that `parse(serialize(parse(text)))` yields
  a **semantically equal** model (test on the model, not the string — formatting is deliberately normalized).
- **Render equivalence:** `mermaid.render(serialize(model))` succeeds without error (catches invalid
  emitter output). Note: `mermaid.render()` needs real browser layout APIs (`getBBox`, SVG measurement)
  that jsdom/happy-dom don't implement, so this test must run under **Vitest browser mode or Playwright**,
  not the plain node test env. The pure emitter and db-extraction tests can stay in node.
- **Trivia preservation:** input with `%% comment` survives a visual-edit cycle.
- **Sync loop guard:** simulate "model edit → emit text → text-change event" and assert it does **not**
  trigger a new parse (no infinite loop, no cursor jump).
- **Mermaid version canary:** a test that fails hard if the shape of `db.getVertices/getEdges` changes
  after an upgrade — this is the load-bearing safeguard for the deprecated parser API.
- **Manual on macOS:** `npm run tauri dev` (dev loop); `npm run tauri build` for a local `.app`.
  Smoke test: open/edit/save, both views stay in sync.

---

## Risks

1. **Deprecated parser API** (`mermaidAPI.getDiagramFromText` + `getVertices/getEdges` — deprecated
   for external use since mermaid 11.6, with no public successor that exposes `db`) → **pin an exact
   mermaid version**, isolate db access in one file, keep the canary test. Excalidraw runs on exactly
   this approach in production — which de-risks the *technique* but not the *upgrade path*: even the
   reference implementation is on borrowed time, so watch the changelog on every bump.
2. **Round-trip loss** (comments/formatting/directives) → trivia pre-pass + explicit "reformat on visual edit" UX.
3. **Layout instability** on re-import → keep positions per node id; only auto-layout genuinely new nodes.
4. **Sync feedback loops / cursor jumps** → `lastEditedBy` flag; replace text only on visual edits; test explicitly.
5. **WKWebView quirks** (Tauri = Safari engine; Monaco workers + Vite + Tauri asset protocol can be
   fiddly) → test Monaco + React Flow + mermaid early, not at the end.

### Locked-in defaults (were open questions)
- **On-disk file format:** plain `.mmd` with positions as `%% @pos` trivia (one file, opens in other tools).
- **Reformatting on visual edit:** accepted and documented (unavoidable given Mermaid's lossy parse).
- **Conflict policy:** on a syntax error in the code view → keep the last good model + a non-blocking diagnostic.
- **Diagram type #2:** sequence (after flowchart).
- **Auto-layout:** dagre (lightweight, same engine Mermaid uses for flowchart).
