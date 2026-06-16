import "@xyflow/react/dist/style.css";
import "./App.css";
import { useEffect, useState } from "react";
import { addNode } from "./flow/flowToModel";
import { openMermaidFile, saveMermaidFile } from "./lib/tauriFiles";
import { useEditorStore } from "./model/store";
import type { Direction } from "./model/types";
import { CodeView } from "./views/CodeView";
import { DirectionIcon, EyeIcon, FolderOpenIcon, PlusIcon, SaveIcon } from "./views/icons";
import { Preview } from "./views/Preview";
import { VisualView } from "./views/VisualView";

const SAMPLE = `flowchart TD
    A[Start] --> B{Decision}
    B -->|yes| C[Approve]
    B -->|no| D[Reject]
    C --> E[End]
    D --> E
`;

const DIRECTIONS: Direction[] = ["TB", "LR", "BT", "RL"];

export default function App() {
  const text = useEditorStore((s) => s.text);
  const direction = useEditorStore((s) => s.model.direction);
  const error = useEditorStore((s) => s.error);
  const loadText = useEditorStore((s) => s.loadText);
  const mutate = useEditorStore((s) => s.mutate);

  const [showPreview, setShowPreview] = useState(true);
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    void loadText(SAMPLE);
  }, [loadText]);

  const onOpen = async () => {
    const file = await openMermaidFile();
    if (file) {
      setPath(file.path);
      await loadText(file.text);
    }
  };

  const onSave = async () => {
    const saved = await saveMermaidFile(text, path);
    if (saved) setPath(saved);
  };

  const cycleDirection = () => {
    const i = DIRECTIONS.indexOf(direction);
    const next = DIRECTIONS[(i + 1) % DIRECTIONS.length];
    mutate((m) => ({ ...m, direction: next }));
  };

  return (
    <div className="app">
      <header className="toolbar" data-tauri-drag-region>
        <span className="brand" data-tauri-drag-region>
          Visual Mermaid
        </span>
        <div className="toolbar-group">
          <button className="tbtn" onClick={onOpen} title="Open .mmd">
            <FolderOpenIcon />
            <span>Open</span>
          </button>
          <button className="tbtn" onClick={onSave} title="Save .mmd">
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
          <button
            className={`tbtn${showPreview ? " active" : ""}`}
            onClick={() => setShowPreview((v) => !v)}
            aria-pressed={showPreview}
            title="Toggle preview"
          >
            <EyeIcon />
            <span>Preview</span>
          </button>
        </div>
        <span className="status" data-tauri-drag-region>
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
