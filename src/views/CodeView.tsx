// Code editor (Monaco). Edits set the text and trigger a debounced parse into the
// model. The loop guard: ignore an onChange whose value already equals the store
// text (which happens when a visual edit programmatically replaces the buffer).

import Editor, { type Monaco } from "@monaco-editor/react";
import { useMemo } from "react";
import { debounce } from "../lib/debounce";
import { useColorScheme } from "../lib/useColorScheme";
import { useEditorStore } from "../model/store";
import { MERMAID_LANG_ID, registerMermaid } from "../mermaid/mermaidLanguage";

export function CodeView() {
  const text = useEditorStore((s) => s.text);
  const error = useEditorStore((s) => s.error);
  const setText = useEditorStore((s) => s.setText);
  const scheme = useColorScheme();

  const debouncedParse = useMemo(
    () => debounce(() => void useEditorStore.getState().parseNow(), 300),
    [],
  );

  const handleChange = (value: string | undefined) => {
    if (value === undefined) return;
    if (value === useEditorStore.getState().text) return; // loop guard
    setText(value);
    debouncedParse();
  };

  return (
    <div className="pane code-pane">
      <Editor
        language={MERMAID_LANG_ID}
        theme={scheme === "dark" ? "vs-dark" : "vs"}
        value={text}
        onChange={handleChange}
        beforeMount={(monaco: Monaco) => registerMermaid(monaco)}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          wordWrap: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
        }}
      />
      {error && <div className="diagnostic">⚠ {error}</div>}
    </div>
  );
}
