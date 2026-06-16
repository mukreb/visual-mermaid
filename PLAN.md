# Plan: Visual Mermaid Editor voor macOS

## Context

`visual-mermaid` is nu een lege repo (alleen `README.md` + MIT `LICENSE`). Het doel:
een **macOS desktop-app** waarin je Mermaid-diagrammen op twee gesynchroniseerde
manieren bewerkt:

1. **Code-view** — typ Mermaid-syntax, met live preview.
2. **Visuele view** — sleep nodes, dubbelklik om te hernoemen, voeg nodes/edges toe
   of verwijder ze; die wijzigingen schrijven zich terug naar geldige Mermaid-code.

De **kern­uitdaging** is dat Mermaid.js maar één kant op werkt (tekst → SVG). Een
visuele editor vereist een **tweerichtings-sync** tussen Mermaid-tekst en een
bewerkbaar graph-model. Daar draait dit plan om.

### Keuzes (afgestemd met gebruiker)
- **Framework:** Tauri v2 (Rust-schil + web-frontend in native WebView). Klein, native gevoel.
- **MVP-scope:** alléén **flowchart** met volledige code↔visueel sync. Andere types later.
- **Distributie:** persoonlijk gebruik — lokaal bouwen/draaien, **geen** code-signing/notarisatie nu.

---

## Tech stack

| Onderdeel | Keuze | Versie-richtlijn |
|---|---|---|
| Desktop-schil | **Tauri v2** | 2.x |
| Frontend | **React 18 + TypeScript + Vite** | Tauri-aanbevolen toolchain |
| Code-editor | **Monaco** (`monaco-editor` + `@monaco-editor/react`) | met custom Mermaid-tokenizer |
| Parser + preview | **mermaid 11** (`mermaid`) | **pin de versie** (zie risico's) |
| Visueel canvas | **@xyflow/react** (React Flow 12) | node/edge-editor met drag/connect |
| State | **Zustand** | lichtgewicht store (React Flow gebruikt het intern ook) |
| Auto-layout | **dagre** | seed-posities voor nieuw geparste nodes (zelfde als Mermaid intern) |
| Tests | **Vitest** | round-trip + sync-tests |

Waarom geen Electron: ~90MB bundel + eigen Chromium, niet nodig. Waarom geen native
SwiftUI: je zou alsnog een WKWebView moeten embedden voor Mermaid + React Flow.

---

## Architectuur

**Source of truth:** een eigen **canoniek graph-model** (in Zustand) is de waarheid in rust.
De actief bewerkte view is tijdelijk leidend (**dual-master, last-edited-wins**):

- **Typt in code-view** → debounce (~300ms) → `mermaid.parse` → bij succes model herbouwen →
  React Flow-nodes afleiden (posities per node-id behouden; alléén nieuwe nodes auto-layouten).
  Bij parse-fout: laatste goede model behouden, diagnostic tonen, canvas niet aanraken.
- **Bewerkt op canvas** → model muteren → emitter draaien → code-editor-tekst vervangen (geherformatteerd).
- Een `lastEditedBy: 'code' | 'visual'` vlag + dirty-tracking voorkomt feedback-loops.

```
            ┌──────────────────────────────────────────┐
            │   Canoniek Graph-model (Zustand)          │
            │   nodes[], edges[], subgraphs[],          │
            │   direction, styles, trivia, positions    │
            └─────────▲────────────────────▲────────────┘
        parse+map     │                    │   mutate
   (debounced, ok)    │                    │
   ┌──────────────────┴───┐        ┌───────┴──────────────────┐
   │ tekst → model        │        │ model → tekst (emitter)  │
   │ (mermaid flowchart db)│        └───────┬──────────────────┘
   └──────────▲───────────┘                 │
        ┌─────┴──────┐      ┌────────────────▼──┐     ┌─────────────┐
        │ Code (Monaco)│    │ Visueel (@xyflow) │     │ Preview SVG │
        └──────────────┘    └───────────────────┘     │ mermaid.render│
                                                       └─────────────┘
```

- **Live preview** rendert altijd uit de huidige *tekst* via `mermaid.render()` (read-only, debounced).
- De **visuele view** bindt aan het *model* (gemapt naar React Flow-shapes), niet aan de preview-SVG.

### Tekst → model (parsen)
Voor flowchart gebruikt mermaid 11 nog de legacy **Jison**-parser; de nieuwe
`@mermaid-js/parser` (Langium) dekt flowchart nog niet. Daarom: parse en lees de
interne flowchart-**db** (dezelfde aanpak die `@excalidraw/mermaid-to-excalidraw` in
productie gebruikt):

```ts
await mermaid.parse(text);                                    // valideer
const diagram = await mermaid.mermaidAPI.getDiagramFromText(text);
const db = diagram.db;
db.getVertices(); db.getEdges(); db.getSubGraphs(); db.getDirection();
```
→ mappen naar het canonieke model. **Isoleer alle db-toegang in één bestand** + version-pin.

### Model → tekst (serialiseren)
Zelfgeschreven, deterministische, pure emitter (volledig te unit-testen). Table-driven:
shape→bracket (`[]`/`{}`/`(())`), edge-kind→pijl (`-->`/`---`/`-.->`/`==>`), labels `-->|tekst|`,
subgraphs, `direction`.

### Round-trip valkuilen (expliciet)
- **Comments (`%% ...`) verdwijnen** in de Jison-lexer → bewaar ze + directives/frontmatter via
  een lichte pre-pass (`trivia.ts`) en her-emit ze.
- **Formatting wordt genormaliseerd** — na een visuele edit wordt de code geherformatteerd
  (zoals Prettier). Gedocumenteerd, opzettelijk gedrag; alléén bij visuele edits, nooit tijdens typen.
- **Posities** worden bewaard per node-id in het model en als `%% @pos`-trivia in het `.mmd`-bestand,
  zodat de layout een round-trip overleeft en het bestand in andere Mermaid-tools opent.

---

## Projectstructuur (aan te maken)

```
visual-mermaid/
├─ src-tauri/
│  ├─ src/main.rs                  # Tauri entrypoint, window/menu
│  ├─ src/commands.rs              # open/save .mmd, recent files
│  ├─ tauri.conf.json              # bundle-id, window (signing later)
│  └─ Cargo.toml
├─ src/
│  ├─ main.tsx                     # React root
│  ├─ App.tsx                      # 3-pane layout (code | visueel | preview) + toolbar
│  ├─ model/
│  │  ├─ types.ts                  # GraphModel, GNode, GEdge, GSubgraph, Trivia  ← EERST ontwerpen
│  │  ├─ store.ts                  # Zustand + lastEditedBy + dirty flags + loop-guards
│  │  └─ shapes.ts                 # shape↔bracket + edge-kind↔pijl tabellen
│  ├─ sync/
│  │  ├─ parseTextToModel.ts       # mermaid db → GraphModel  ← hoogste risico
│  │  ├─ serializeModelToText.ts   # GraphModel → mermaid-tekst (pure emitter)
│  │  ├─ trivia.ts                 # comments/directives/posities extraheren + her-emit
│  │  └─ layout.ts                 # dagre auto-layout voor nieuwe nodes
│  ├─ views/
│  │  ├─ CodeView.tsx              # Monaco + Mermaid-taal + error-diagnostics
│  │  ├─ VisualView.tsx            # React Flow canvas + custom nodes/edges
│  │  ├─ Preview.tsx               # mermaid.render() SVG, debounced
│  │  └─ nodes/                    # ProcessNode, DecisionNode, RoundNode, ...
│  ├─ flow/
│  │  ├─ modelToFlow.ts            # GraphModel → {nodes,edges} voor React Flow
│  │  └─ flowToModel.ts            # React Flow change-events → model-mutaties
│  ├─ mermaid/mermaidLanguage.ts   # Monarch tokenizer voor Monaco
│  └─ lib/debounce.ts
├─ tests/
│  ├─ roundtrip.test.ts
│  └─ fixtures/*.mmd
├─ package.json · vite.config.ts · tsconfig.json
```

### Belangrijkste bestanden
- **`model/types.ts`** — het modelcontract; alles hangt eraan. Eerst ontwerpen.
- **`sync/parseTextToModel.ts`** — tekst→model via mermaid-db; meest versie-gevoelig, achter tests.
- **`sync/serializeModelToText.ts`** — deterministische emitter; pure functie.
- **`model/store.ts`** — orkestreert dual-master sync (debounce, lastEditedBy, loop-guards, posities).
- **`flow/modelToFlow.ts` + `flowToModel.ts`** — binding tussen model en React Flow.

---

## Bouwplan (gefaseerd)

### Fase 0 — Scaffold
`npm create tauri-app@latest` (React + TS + Vite, Tauri v2). Dependencies toevoegen:
`mermaid @xyflow/react monaco-editor @monaco-editor/react zustand dagre` (+ `vitest` dev).
3-pane layout-shell. Verifieer dat het als macOS-venster opent (`npm run tauri dev`).

### Fase 1 — MVP: flowchart met tweerichtings-sync (de kern)
1. `model/types.ts` + emitter (`serializeModelToText`) + round-trip-tests op fixtures.
2. `parseTextToModel` via mermaid-db; dagre auto-layout voor posities.
3. Code-view (Monaco) → debounced parse → model; live preview uit tekst.
4. Visuele view (React Flow) gebonden aan model: slepen, dubbelklik-hernoemen,
   node toevoegen/verwijderen, edge tekenen → model muteren → tekst her-emit.
5. Dual-master sync + loop-guards bedraden. Open/Save `.mmd` via Tauri-commands.

**MVP klaar wanneer:** flowchart-tekst typen → verschijnt op canvas; slepen/hernoemen/
toevoegen/verwijderen/verbinden op canvas → geldige tekst update; round-trip-tests groen;
comments behouden via trivia.

### Fase 2 — Polish (later)
Shapes-palet, edge-stijlen, subgraphs, `direction`-toggle, undo/redo (Zustand history),
error-diagnostics in de gutter, positie-persistentie, theming, export SVG/PNG.

### Fase 3 — Meer diagramtypes (later)
`DiagramAdapter`-interface (`parse`, `serialize`, `toFlow`, `fromFlow`) zodat elk type een
pluggable module is. Volgorde: **sequence** → state → class → ER.

### Fase 4 — Distributie (later, indien gewenst)
Code-signing + notarisatie in `tauri.conf.json`, DMG, auto-update, `.mmd`-bestandsassociatie.

---

## Verificatie

- **Round-trip property-tests (belangrijkst):** corpus `.mmd`-fixtures (simpel, branching,
  edge-labels, subgraphs, alle shapes, comments). Assert: `parse(serialize(parse(text)))` levert
  een **semantisch gelijk** model op (test op het model, niet de string — formatting wordt bewust genormaliseerd).
- **Render-equivalentie:** `mermaid.render(serialize(model))` slaagt zonder fout (vangt ongeldige emitter-output).
- **Trivia-behoud:** input met `%% comment` overleeft een visuele-edit-cyclus.
- **Sync-loop-guard:** simuleer "model-edit → emit tekst → text-change-event" en assert dat dit
  geen nieuwe parse triggert (geen oneindige loop, geen cursor-sprong).
- **Mermaid-versie-canary:** test die hard faalt als `db.getVertices/getEdges`-vorm wijzigt na upgrade.
- **Handmatig op macOS:** `npm run tauri dev` (dev-loop); `npm run tauri build` voor lokale `.app`.
  Smoke-test: open/edit/save, beide views syncen.

---

## Risico's

1. **Onofficiële parser-API** (`getVertices/getEdges` is geen stabiel contract) → mermaid version-pinnen,
   db-toegang in één bestand isoleren, canary-test. (Excalidraw draait op exact deze aanpak → gederisked.)
2. **Round-trip-verlies** (comments/formatting/directives) → trivia pre-pass + expliciete "reformat bij visuele edit"-UX.
3. **Layout-instabiliteit** bij her-import → posities per node-id behouden; alleen écht nieuwe nodes auto-layouten.
4. **Sync-feedback-loops / cursor-sprongen** → `lastEditedBy`-vlag; tekst alléén vervangen bij visuele edits; expliciet testen.
5. **WKWebView-quirks** (Tauri = Safari-engine) → Monaco + React Flow + mermaid vroeg testen, niet pas aan het eind.

### Vastgelegde defaults (waren open vragen)
- **Bestandsformaat op schijf:** plain `.mmd` met posities als `%% @pos`-trivia (één bestand, opent in andere tools).
- **Reformatten bij visuele edit:** geaccepteerd en gedocumenteerd (onvermijdelijk door Mermaids lossy parse).
- **Conflict-policy:** bij syntax-fout in code-view → laatste goede model behouden + non-blocking diagnostic.
- **Diagramtype #2:** sequence (na flowchart).
- **Auto-layout:** dagre (lichter, zelfde als Mermaid).
