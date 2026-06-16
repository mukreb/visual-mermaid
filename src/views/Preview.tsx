// Read-only, ground-truth render of the current text via mermaid.render(). Debounced.
// Independent of the canvas, so it catches emitter output the visual view would hide.

import mermaid from "mermaid";
import { useEffect, useRef, useState } from "react";
import { debounce } from "../lib/debounce";
import { useEditorStore } from "../model/store";

let initialized = false;
function ensureInit() {
  if (initialized) return;
  mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "dark" });
  initialized = true;
}

export function Preview() {
  const text = useEditorStore((s) => s.text);
  const [svg, setSvg] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    const render = debounce(async (src: string) => {
      ensureInit();
      const renderId = ++idRef.current;
      if (!src.trim()) {
        setSvg("");
        setErr(null);
        return;
      }
      try {
        const { svg: out } = await mermaid.render(`preview-${renderId}`, src);
        if (renderId === idRef.current) {
          setSvg(out);
          setErr(null);
        }
      } catch (e) {
        if (renderId === idRef.current) setErr(e instanceof Error ? e.message : String(e));
      }
    }, 300);

    render(text);
    return () => render.cancel();
  }, [text]);

  return (
    <div className="pane preview-pane">
      {err && <div className="diagnostic">⚠ {err}</div>}
      <div className="preview-svg" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
