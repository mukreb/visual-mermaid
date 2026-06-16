// Code editor (Monaco). Edits set the text and trigger a debounced parse into the
// model. The loop guard: ignore an onChange whose value already equals the store
// text (which happens when a visual edit programmatically replaces the buffer).
// Parse errors are surfaced as an inline gutter marker on the offending line.

import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useEffect, useMemo, useRef } from "react";
import { debounce } from "../lib/debounce";
import { useColorScheme } from "../lib/useColorScheme";
import { useEditorStore } from "../model/store";
import { MERMAID_LANG_ID, registerMermaid } from "../mermaid/mermaidLanguage";

export function CodeView() {
  const text = useEditorStore((s) => s.text);
  const error = useEditorStore((s) => s.error);
  const setText = useEditorStore((s) => s.setText);
  const scheme = useColorScheme();

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

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

  const handleMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
    monacoRef.current = monaco;
  };

  // Surface parse errors as a gutter marker; mermaid messages often carry a line.
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    const model = ed?.getModel();
    if (!ed || !monaco || !model) return;
    if (!error) {
      monaco.editor.setModelMarkers(model, "mermaid", []);
      return;
    }
    const m = /line\s+(\d+)/i.exec(error);
    const line = Math.min(m ? Number(m[1]) : 1, model.getLineCount());
    monaco.editor.setModelMarkers(model, "mermaid", [
      {
        severity: monaco.MarkerSeverity.Error,
        message: error,
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: model.getLineMaxColumn(line),
      },
    ]);
  }, [error]);

  return (
    <div className="pane code-pane">
      <Editor
        language={MERMAID_LANG_ID}
        theme={scheme === "dark" ? "vs-dark" : "vs"}
        value={text}
        onChange={handleChange}
        onMount={handleMount}
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
