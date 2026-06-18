// Toolbar export control: a button that opens a small SVG / PNG popover. The
// native File → Export menu covers the same actions in the desktop app; this is
// the surface that also works in the browser (`vite dev`).

import { useEffect, useRef, useState } from "react";
import { DownloadIcon } from "./icons";

export function ExportMenu({ onSvg, onPng }: { onSvg: () => void; onPng: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDocDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const pick = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div className="export-menu" ref={ref}>
      <button
        className={`tbtn${open ? " active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Export diagram"
      >
        <DownloadIcon />
        <span>Export</span>
      </button>
      {open && (
        <div className="export-pop" role="menu">
          <button className="export-item" role="menuitem" onClick={() => pick(onSvg)}>
            Export as SVG
          </button>
          <button className="export-item" role="menuitem" onClick={() => pick(onPng)}>
            Export as PNG
          </button>
        </div>
      )}
    </div>
  );
}
