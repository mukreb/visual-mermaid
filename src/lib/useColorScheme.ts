// Tracks the OS appearance (macOS light/dark) and updates live when the user
// toggles it. WKWebView reports system appearance via prefers-color-scheme and
// fires the change event, so no restart is needed.

import { useEffect, useState } from "react";

export type ColorScheme = "light" | "dark";

function currentScheme(): ColorScheme {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function useColorScheme(): ColorScheme {
  const [scheme, setScheme] = useState<ColorScheme>(currentScheme);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setScheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return scheme;
}
