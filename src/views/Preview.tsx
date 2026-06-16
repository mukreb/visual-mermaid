// Read-only, ground-truth render of the current text via mermaid.render(). Debounced.
// Independent of the canvas, so it catches emitter output the visual view would hide.
// Follows the system appearance: re-initializes + re-renders when light/dark flips.

import mermaid from "mermaid";
import { useEffect, useRef, useState } from "react";
import { debounce } from "../lib/debounce";
import { useColorScheme } from "../lib/useColorScheme";
import { useEditorStore } from "../model/store";

export function Preview() {
  const text = useEditorStore((s) => s.text);
  const scheme = useColorScheme();
  const [svg, setSvg] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const idRef = useRef(0);

  // Re-theme mermaid whenever the system appearance changes.
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: scheme === "dark" ? "dark" : "default",
    });
  }, [scheme]);

  // Render on text or theme change.
  useEffect(() => {
    const render = debounce(async (src: string) => {
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
  }, [text, scheme]);

  return (
    <div className="pane preview-pane">
      {err && <div className="diagnostic">⚠ {err}</div>}
      <div className="preview-svg" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
