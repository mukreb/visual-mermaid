// Prompt before closing the window with unsaved changes (Tauri only).
// Defensive: no-op in a browser, try/catch so an API mismatch never breaks the app.

import { flushFocusedInput } from "./flushInput";
import { confirmDiscard, isTauri } from "./tauriFiles";

export async function setupCloseGuard(isDirty: () => boolean): Promise<() => void> {
  if (!isTauri()) return () => {};
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
      flushFocusedInput(); // commit a focused inspector label before checking dirty
      if (!isDirty()) return;
      const ok = await confirmDiscard("Discard unsaved changes and quit?");
      if (!ok) event.preventDefault();
    });
    return unlisten;
  } catch (err) {
    console.warn("Close guard setup skipped:", err);
    return () => {};
  }
}
