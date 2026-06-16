import "@xyflow/react/dist/style.css";
import "./App.css";
import { useEffect, useState } from "react";
import { addNode } from "./flow/flowToModel";
import { openMermaidFile, saveMermaidFile } from "./lib/tauriFiles";
import { useEditorStore } from "./model/store";
import type { Direction } from "./model/types";
import { CodeView } from "./views/CodeView";
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
      <header className="toolbar">
        <strong className="brand">Visual Mermaid</strong>
        <button onClick={onOpen}>Open</button>
        <button onClick={onSave}>Save</button>
        <button onClick={() => mutate((m) => addNode(m, { label: "New" }))}>+ Node</button>
        <button onClick={cycleDirection}>Direction: {direction}</button>
        <label className="toggle">
          <input
            type="checkbox"
            checked={showPreview}
            onChange={(e) => setShowPreview(e.target.checked)}
          />
          Preview
        </label>
        <span className="status">
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
