# visual-mermaid

A visual + code two-way editor for Mermaid **flowcharts**, packaged as a macOS
desktop app (Tauri v2). Type Mermaid on the left, edit the graph on a canvas in the
middle, see a live render on the right — all three stay in sync.

See [`PLAN.md`](./PLAN.md) for the full design and rationale.

## Download (macOS)

Grab the latest `.dmg` from the
[**Releases**](https://github.com/mukreb/visual-mermaid/releases) page, open it,
and drag **Visual Mermaid** to your Applications folder. The build is a universal
binary, so it runs on both Apple Silicon and Intel Macs.

The download is **not signed with an Apple Developer ID**, so the first time you
launch it macOS Gatekeeper will block it. To open it anyway:

- Right-click (or Control-click) the app and choose **Open**, then **Open** again, **or**
- run `xattr -dr com.apple.quarantine "/Applications/Visual Mermaid.app"` in Terminal.

You only need to do this once.

## Status

**MVP core (implemented & tested):**

- Canonical graph model + deterministic, pure **emitter** (model → Mermaid text).
- **Parser** (text → model) via Mermaid's internal flowchart db, isolated behind a
  single module and pinned to `mermaid@11.15.0` (see the version canary test).
- **Trivia** pre-pass that preserves comments, frontmatter/`%%{init}%%` directives,
  and per-node positions (`%% @pos`) across a round-trip.
- **Dual-master sync store** (Zustand) with loop guards: code edits parse into the
  model (debounced); visual edits re-emit the text — neither feeds back on itself.
- React UI: Monaco code view (with inline error markers), React Flow canvas, live
  `mermaid.render()` preview, and a selection **inspector** to edit a node's
  shape/label or an edge's style/label.
- **Shapes palette** on the canvas: drag a shape onto the canvas (dropped at the
  cursor) or click it to add a node.
- **Export** the diagram as **SVG** or **PNG** (rendered fresh, so it works even
  with the preview pane hidden).
- **Undo/redo** (model history), **dirty tracking** with an unsaved indicator, and
  subgraphs drawn as containers on the canvas.
- Native macOS feel: unified title bar, icon toolbar, live light/dark theming, a
  **menu bar** + keyboard shortcuts (⌘N/⌘O/⌘S/⇧⌘S, ⇧⌘E, ⌘Z/⇧⌘Z, ⌥⌘P), and an
  unsaved-changes prompt on close.
- Tauri v2 shell with open/save `.mmd` (dialog + fs plugins).

60 tests pass (pure emitter, trivia, round-trip over fixtures, store loop-guard,
undo/redo + dirty tracking, the editing helpers, export helpers, and the mermaid
db canary). The round-trip property tests assert that `parse(serialize(parse(text)))`
is **semantically equal** — formatting is intentionally normalized.

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

New to the codebase? [`CLAUDE.md`](./CLAUDE.md) is the orientation guide — the
dual-master sync model, the load-bearing constraints (the pinned mermaid version
and its canary test), and what each module owns. [`PLAN.md`](./PLAN.md) has the
deeper design rationale.

## Run as a macOS app (local)

Tauri builds a native app against macOS's WKWebView, so this step needs a Mac
(it cannot be cross-compiled from Linux):

```bash
npm run tauri dev     # live-reload desktop window
npm run tauri build   # local .app / .dmg (unsigned — personal use)

# the repo ships a placeholder icon; to use your own, drop in a square PNG:
npm run tauri icon path/to/logo.png
```

## Cut a release (downloadable build)

The [`Release macOS app`](.github/workflows/release.yml) GitHub Actions workflow
builds the universal `.dmg` on a macOS runner and attaches it to a GitHub Release —
no Mac required on your end.

1. Bump the version in `package.json`, `src-tauri/tauri.conf.json`, and
   `src-tauri/Cargo.toml` so they match.
2. Tag the commit and push the tag:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

3. The workflow builds the app and publishes a release named after the tag with the
   `.dmg` attached. (You can also re-run a build for an **existing** tag from the
   **Actions** tab — new releases should go through the tag push above so the
   binaries match the tag.)

The build is unsigned by default. To ship a signed + notarized `.dmg`, add your
Apple Developer credentials as repository secrets (`APPLE_CERTIFICATE`,
`APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`,
`APPLE_PASSWORD`, `APPLE_TEAM_ID`) — the workflow picks them up automatically.

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
