# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`visual-mermaid` is a two-way (visual + code) editor for Mermaid **flowcharts**,
shipped as a macOS desktop app (Tauri v2). Code view, canvas, and live preview all
stay in sync. See `PLAN.md` for the full design and rationale.

## Commands

```bash
npm install
npm test               # vitest run — the full suite (sync engine, round-trip, store, export)
npm run test:watch     # vitest in watch mode
npm run typecheck      # tsc --noEmit — the only static-analysis gate (there is no ESLint/Prettier)
npm run dev            # vite dev server: the UI in a plain browser (no native features)
npm run build          # tsc && vite build — CI runs this after the tests; it must pass

# Run a single test file or by name:
npx vitest run tests/roundtrip.test.ts
npx vitest run -t "preserves comments"
```

CI (`.github/workflows/ci.yml`) runs `npm test` then `npm run build` on Node 22.
Treat both as the bar for any change. `tsconfig.json` is `strict` with
`noUnusedLocals`/`noUnusedParameters`, so dead code fails the build.

### macOS app (needs a real Mac — WKWebView, not cross-compilable from Linux)

```bash
npm run tauri dev      # live-reload desktop window
npm run tauri build    # local .app / .dmg (unsigned)
```

The web layer (`src/`) is platform-independent and fully testable/runnable without
a Mac; only the Tauri shell needs macOS.

## Architecture

**Single source of truth:** the canonical `GraphModel` (in the Zustand store). The
code text and the React Flow canvas are both *derived* from it. `model/types.ts` is
the contract — it was designed first and everything hangs off it; change it
deliberately.

**Dual-master sync** lives entirely in `model/store.ts`. The two edit directions
must never feed back into each other:

- **Code edit** → `setText()` (no parse) → the view debounces `parseNow()` →
  parse text into a new model. Text is left untouched.
- **Visual edit** → `mutate()` → re-emit text via `serializeModelToText()`. No re-parse.
- **Loop guard:** `parseNow()` returns early when `text === serialize(model)` — i.e.
  text we ourselves just emitted. Combined with the `lastEditedBy` flag, a visual
  mutation can never trigger a parse, and Monaco's `onChange` from a programmatic
  `setValue` is a no-op.
- Undo/redo are stacks of whole model snapshots; restoring re-emits the text.
  `docVersion` is bumped only on a full document load so the canvas refits on
  open/new but **not** while you type.

Read the comment header in `store.ts` before touching sync logic — the ordering of
`set()` calls and the stale-parse / position-preservation guards are load-bearing.

### Key modules and the data flow

```
text  ──parseTextToModel──▶  GraphModel  ──serializeModelToText──▶  text
                              ▲      │
                    flowToModel      modelToFlow
                              │      ▼
                          React Flow canvas (views/VisualView)
```

- **`sync/parseTextToModel.ts`** — text → model. **The highest-risk file.** It reads
  Mermaid's *internal* flowchart `db` via `mermaidAPI.getDiagramFromText`, an
  unofficial API that is **deprecated as of mermaid 11.6 with no public successor
  that exposes `db`**. All such access is isolated behind `getFlowDb()` — keep it
  that way. `getVertices()` returns a **Map** in mermaid 11 (was a plain object in v10).
- **`sync/serializeModelToText.ts`** — model → text. Pure, deterministic, fully
  unit-tested emitter. Table-driven via `model/shapes.ts` (shape↔bracket, edge-kind↔arrow).
- **`sync/trivia.ts`** — preserves what Mermaid's lossy parse drops: comments,
  frontmatter/`%%{init}%%` directives, and per-node positions stored as `%% @pos`
  comment lines. Must run **before** the parse, since mermaid strips comments.
- **`sync/layout.ts`** — dagre auto-layout, applied only to genuinely new nodes so
  existing positions survive a round-trip and the canvas doesn't jump on re-parse.
- **`flow/modelToFlow.ts` / `flowToModel.ts`** — bind the model to React Flow's
  `{nodes, edges}` and translate canvas change events back into model mutations.
- **`views/`** — `CodeView` (Monaco), `VisualView` (React Flow), `Preview`
  (`mermaid.render()`, debounced), `ShapePalette`, `ExportMenu`, custom `nodes/`.
- **`mermaid/mermaidLanguage.ts`** — Monaco Monarch tokenizer for Mermaid syntax.
- **Tauri shell (`src-tauri/`)** — Rust just registers the dialog + fs plugins; file
  open/save is done on the frontend in `src/lib/tauriFiles.ts`. The app gates native
  features behind `isTauri()`, so it degrades gracefully in a plain browser.

## Critical constraints

- **Mermaid is pinned to an exact version (`11.15.0`).** Do not bump it casually. The
  internal db API is the most upgrade-fragile dependency in the project.
- **`tests/canary.test.ts` is the safeguard for that pin.** It asserts the shape of
  `db.getVertices/getEdges/getDirection`. If you upgrade mermaid, expect this to fail
  first and update it (and the parser) deliberately — never just delete it.
- **Round-trip tests assert *semantic* model equality, not string equality.**
  Formatting is intentionally normalized on visual edits; `parse(serialize(parse(text)))`
  must yield a semantically equal model, not identical text.
- **`mermaid.render()` needs a real browser** (`getBBox`, SVG measurement) that jsdom
  lacks. Render-equivalence checks belong in Vitest browser mode / Playwright, not the
  jsdom unit run. Keep pure-emitter and db-extraction tests in node.
- **Releases** require the version to match across `package.json`,
  `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`; pushing a `v*` tag triggers
  the macOS build workflow (`.github/workflows/release.yml`).
