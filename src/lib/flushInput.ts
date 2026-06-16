// Commit a focused text field by blurring it, so its onBlur fires before a
// global action (save / open / new / window close) reads the store. Used to
// flush the inspector's label inputs, which only commit on blur/Enter.

export function flushFocusedInput(): void {
  const el = document.activeElement;
  if (el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
    el.blur();
  }
}
