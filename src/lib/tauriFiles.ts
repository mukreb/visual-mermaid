// Open/save .mmd. Tauri dialog+fs plugins are imported lazily and guarded so the
// frontend still runs in a plain browser (e.g. `vite dev` during web sessions),
// falling back to <input type=file> / a download.

export interface OpenedFile {
  path: string | null;
  text: string;
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function openMermaidFile(): Promise<OpenedFile | null> {
  if (!isTauri()) return browserOpen();
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const selected = await open({
    multiple: false,
    filters: [{ name: "Mermaid", extensions: ["mmd", "mermaid"] }],
  });
  if (typeof selected !== "string") return null;
  return { path: selected, text: await readTextFile(selected) };
}

export interface SaveResult {
  saved: boolean;
  path: string | null;
}

export async function saveMermaidFile(
  text: string,
  path?: string | null,
): Promise<SaveResult> {
  if (!isTauri()) {
    browserSave(text);
    return { saved: true, path: null };
  }
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  const target =
    path ?? (await save({ filters: [{ name: "Mermaid", extensions: ["mmd"] }] }));
  if (!target) return { saved: false, path: null };
  await writeTextFile(target, text);
  return { saved: true, path: target };
}

/** Confirm a destructive action (uses the native dialog under Tauri). */
export async function confirmDiscard(message: string): Promise<boolean> {
  if (!isTauri()) return window.confirm(message);
  try {
    const { confirm } = await import("@tauri-apps/plugin-dialog");
    return await confirm(message, { title: "Unsaved changes", kind: "warning" });
  } catch {
    return window.confirm(message);
  }
}

function browserOpen(): Promise<OpenedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mmd,.mermaid,text/plain";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve({ path: null, text: String(reader.result ?? "") });
      reader.readAsText(file);
    };
    input.click();
  });
}

function browserSave(text: string): void {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "diagram.mmd";
  a.click();
  URL.revokeObjectURL(url);
}
