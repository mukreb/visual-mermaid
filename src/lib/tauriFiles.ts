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

/**
 * Drain any files macOS asked the app to open (Finder double-click / "Open With").
 * The Rust side buffers these; each path is handed out exactly once. Returns [] in a
 * plain browser or when nothing is pending. Tauri only.
 */
export async function drainOpenedFiles(): Promise<OpenedFile[]> {
  if (!isTauri()) return [];
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const paths = await invoke<string[]>("take_opened_files");
    const files: OpenedFile[] = [];
    for (const path of paths) {
      try {
        files.push({ path, text: await readTextFile(path) });
      } catch (err) {
        console.warn("Failed to read opened file:", path, err);
      }
    }
    return files;
  } catch (err) {
    console.warn("drainOpenedFiles skipped:", err);
    return [];
  }
}

/**
 * Subscribe to macOS "open-file" signals (a file double-clicked while the app is
 * already running) and drain the pending files, invoking `handler` when any arrive.
 * Returns an unlisten fn; a no-op in a plain browser. Tauri only.
 */
export async function onOpenFiles(
  handler: (files: OpenedFile[]) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  try {
    const { listen } = await import("@tauri-apps/api/event");
    const unlisten = await listen("open-file", async () => {
      const files = await drainOpenedFiles();
      if (files.length > 0) handler(files);
    });
    return unlisten;
  } catch (err) {
    console.warn("open-file listener skipped:", err);
    return () => {};
  }
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

export interface ExportFilter {
  /** Human-readable filter name shown in the save dialog. */
  name: string;
  /** File extension without the dot, e.g. "svg" or "png". */
  ext: string;
  /** Blob MIME type for the browser-download fallback. */
  mime: string;
}

/** Save text content to a user-chosen path (export). Browser: downloads a file. */
export async function exportTextFile(
  content: string,
  defaultName: string,
  filter: ExportFilter,
): Promise<boolean> {
  if (!isTauri()) {
    browserDownload(new Blob([content], { type: filter.mime }), defaultName);
    return true;
  }
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  const target = await save({
    defaultPath: defaultName,
    filters: [{ name: filter.name, extensions: [filter.ext] }],
  });
  if (!target) return false;
  await writeTextFile(target, content);
  return true;
}

/** Save binary content to a user-chosen path (export). Browser: downloads a file. */
export async function exportBinaryFile(
  bytes: Uint8Array<ArrayBuffer>,
  defaultName: string,
  filter: ExportFilter,
): Promise<boolean> {
  if (!isTauri()) {
    browserDownload(new Blob([bytes], { type: filter.mime }), defaultName);
    return true;
  }
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  const target = await save({
    defaultPath: defaultName,
    filters: [{ name: filter.name, extensions: [filter.ext] }],
  });
  if (!target) return false;
  await writeFile(target, bytes);
  return true;
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
  browserDownload(new Blob([text], { type: "text/plain" }), "diagram.mmd");
}

function browserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
