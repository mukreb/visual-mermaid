# visual-mermaid

A visual + code two-way editor for Mermaid **flowcharts**, packaged as a macOS
desktop app (Tauri v2). Type Mermaid on the left, edit the graph on a canvas in the
middle, see a live render on the right — all three stay in sync.

See [`PLAN.md`](./PLAN.md) for the full design and rationale.

## Status

**MVP core (implemented & tested):**

- Canonical graph model + deterministic, pure **emitter** (model → Mermaid text).
- **Parser** (text → model) via Mermaid's internal flowchart db, isolated behind a
  single module and pinned to `mermaid@11.6.0` (see the version canary test).
- **Trivia** pre-pass that preserves comments, frontmatter/`%%{init}%%` directives,
  and per-node positions (`%% @pos`) across a round-trip.
- **Dual-master sync store** (Zustand) with loop guards: code edits parse into the
  model (debounced); visual edits re-emit the text — neither feeds back on itself.
- React UI: Monaco code view, React Flow canvas, live `mermaid.render()` preview.
- Tauri v2 shell with open/save `.mmd` (dialog + fs plugins).

29 tests pass (pure emitter, trivia, round-trip over fixtures, store loop-guard,
and the mermaid db canary). The round-trip property tests assert that
`parse(serialize(parse(text)))` is **semantically equal** — formatting is
intentionally normalized.

> Note: `mermaid.render()` needs a real browser (`getBBox`), so the live-render
> equivalence check belongs in browser mode / Playwright, not the jsdom unit run.

## Develop

The web layer is platform-independent and runs anywhere:

```bash
npm install
npm test          # vitest — the sync engine + round-trip suite
npm run dev       # vite dev server (the UI in a plain browser)
npm run build     # typecheck + production bundle
```

## Run as a macOS app (local)

Tauri builds a native app against macOS's WKWebView, so this step needs a Mac
(it cannot be cross-compiled from Linux):

```bash
npm run tauri dev     # live-reload desktop window
npm run tauri build   # local .app / .dmg (unsigned — personal use)

# the repo ships a placeholder icon; to use your own, drop in a square PNG:
npm run tauri icon path/to/logo.png
```

## Layout

```
src/
  model/    types.ts (the contract) · store.ts (dual-master) · shapes.ts (tables)
  sync/     parseTextToModel.ts · serializeModelToText.ts · trivia.ts · layout.ts
  flow/     modelToFlow.ts · flowToModel.ts (React Flow <-> model)
  views/    CodeView · VisualView · Preview · nodes/ShapeNode
  mermaid/  mermaidLanguage.ts (Monaco tokenizer)
src-tauri/  Tauri v2 shell (Rust)
tests/      *.test.ts + fixtures/*.mmd
```
