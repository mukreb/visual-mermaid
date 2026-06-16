import "@xyflow/react/dist/style.css";
import "./App.css";
import { useEffect, useRef, useState } from "react";
import { addNode } from "./flow/flowToModel";
import { setupAppMenu } from "./lib/appMenu";
import { setupCloseGuard } from "./lib/appWindow";
import { flushFocusedInput } from "./lib/flushInput";
import { confirmDiscard, isTauri, openMermaidFile, saveMermaidFile } from "./lib/tauriFiles";
import { useEditorStore } from "./model/store";
import type { Direction } from "./model/types";
import { CodeView } from "./views/CodeView";
import {
  DirectionIcon,
  EyeIcon,
  FolderOpenIcon,
  PlusIcon,
  RedoIcon,
  SaveIcon,
  UndoIcon,
} from "./views/icons";
import { Preview } from "./views/Preview";
import { VisualView } from "./views/VisualView";

const SAMPLE = `flowchart TD
    A[Start] --> B{Decision}
    B -->|yes| C[Approve]
    B -->|no| D[Reject]
    C --> E[End]
    D --> E
`;

const BLANK = "flowchart TD\n";
const DIRECTIONS: Direction[] = ["TB", "LR", "BT", "RL"];

export default function App() {
  const text = useEditorStore((s) => s.text);
  const savedText = useEditorStore((s) => s.savedText);
  const direction = useEditorStore((s) => s.model.direction);
  const error = useEditorStore((s) => s.error);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const loadText = useEditorStore((s) => s.loadText);
  const mutate = useEditorStore((s) => s.mutate);
  const markSaved = useEditorStore((s) => s.markSaved);

  const [showPreview, setShowPreview] = useState(true);
  const [path, setPath] = useState<string | null>(null);

  const dirty = text !== savedText;

  useEffect(() => {
    void loadText(SAMPLE);
  }, [loadText]);

  // Read dirty from the store *after* flushing, so a focused inspector edit counts.
  const isDirtyNow = () => {
    const s = useEditorStore.getState();
    return s.text !== s.savedText;
  };

  const onOpen = async () => {
    flushFocusedInput();
    if (isDirtyNow() && !(await confirmDiscard("Discard unsaved changes?"))) return;
    const file = await openMermaidFile();
    if (file) {
      setPath(file.path);
      await loadText(file.text);
    }
  };

  const onSave = async () => {
    flushFocusedInput();
    const snapshot = useEditorStore.getState().text;
    const res = await saveMermaidFile(snapshot, path);
    if (res.saved) {
      if (res.path) setPath(res.path);
      markSaved(snapshot); // baseline = exactly what was written, not later edits
    }
  };

  const onSaveAs = async () => {
    flushFocusedInput();
    const snapshot = useEditorStore.getState().text;
    const res = await saveMermaidFile(snapshot, null);
    if (res.saved) {
      if (res.path) setPath(res.path);
      markSaved(snapshot);
    }
  };

  const onNew = async () => {
    flushFocusedInput();
    if (isDirtyNow() && !(await confirmDiscard("Discard unsaved changes?"))) return;
    setPath(null);
    await loadText(BLANK);
  };

  const togglePreview = () => setShowPreview((v) => !v);

  const cycleDirection = () => {
    const i = DIRECTIONS.indexOf(direction);
    const next = DIRECTIONS[(i + 1) % DIRECTIONS.length];
    mutate((m) => ({ ...m, direction: next }));
  };

  // Keep the latest handlers reachable from the once-installed menu / key listener.
  const actions = { onNew, onOpen, onSave, onSaveAs, togglePreview };
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  // Native menu + unsaved-close guard (Tauri only; no-ops in a browser).
  useEffect(() => {
    void setupAppMenu({
      onNew: () => actionsRef.current.onNew(),
      onOpen: () => actionsRef.current.onOpen(),
      onSave: () => actionsRef.current.onSave(),
      onSaveAs: () => actionsRef.current.onSaveAs(),
      togglePreview: () => actionsRef.current.togglePreview(),
    });
    let unlisten: (() => void) | undefined;
    void setupCloseGuard(() => useEditorStore.getState().text !== useEditorStore.getState().savedText).then(
      (u) => (unlisten = u),
    );
    return () => unlisten?.();
  }, []);

  // Keyboard: ⌘Z / ⇧⌘Z always (routed away from text fields); the file/view
  // shortcuts are handled by the native menu in the app, JS only in the browser.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      const active = document.activeElement;
      const inText =
        active instanceof HTMLElement &&
        (active.closest(".monaco-editor") ||
          ["input", "textarea", "select"].includes(active.tagName.toLowerCase()));

      if (key === "z") {
        if (inText) return; // let Monaco / inputs do native undo
        e.preventDefault();
        if (e.shiftKey) useEditorStore.getState().redo();
        else useEditorStore.getState().undo();
        return;
      }
      if (isTauri()) return; // the native menu owns the rest in the app
      if (key === "n") {
        e.preventDefault();
        void actionsRef.current.onNew();
      } else if (key === "o") {
        e.preventDefault();
        void actionsRef.current.onOpen();
      } else if (key === "s") {
        e.preventDefault();
        void (e.shiftKey ? actionsRef.current.onSaveAs() : actionsRef.current.onSave());
      } else if (key === "p" && e.altKey) {
        e.preventDefault();
        actionsRef.current.togglePreview();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <header className="toolbar" data-tauri-drag-region>
        <span className="brand" data-tauri-drag-region>
          Visual Mermaid
        </span>
        <div className="toolbar-group">
          <button className="tbtn" onClick={onOpen} title="Open (⌘O)">
            <FolderOpenIcon />
            <span>Open</span>
          </button>
          <button className="tbtn" onClick={onSave} title="Save (⌘S)">
            <SaveIcon />
            <span>Save</span>
          </button>
          <span className="tsep" />
          <button
            className="tbtn"
            onClick={() => mutate((m) => addNode(m, { label: "New" }))}
            title="Add node"
          >
            <PlusIcon />
            <span>Node</span>
          </button>
          <button className="tbtn" onClick={cycleDirection} title="Cycle layout direction">
            <DirectionIcon />
            <span>{direction}</span>
          </button>
          <span className="tsep" />
          <button className="tbtn" onClick={() => useEditorStore.getState().undo()} disabled={!canUndo} title="Undo (⌘Z)">
            <UndoIcon />
          </button>
          <button className="tbtn" onClick={() => useEditorStore.getState().redo()} disabled={!canRedo} title="Redo (⇧⌘Z)">
            <RedoIcon />
          </button>
          <span className="tsep" />
          <button
            className={`tbtn${showPreview ? " active" : ""}`}
            onClick={togglePreview}
            aria-pressed={showPreview}
            title="Toggle preview (⌥⌘P)"
          >
            <EyeIcon />
            <span>Preview</span>
          </button>
        </div>
        <span className="status" data-tauri-drag-region>
          {dirty && <span className="dirty-dot" title="Unsaved changes" />}
          {path ?? "untitled.mmd"}
          {error ? " — parse error" : ""}
        </span>
      </header>
      <main className={`panes${showPreview ? "" : " no-preview"}`}>
        <CodeView />
        <VisualView />
        {showPreview && <Preview />}
      </main>
    </div>
  );
}
