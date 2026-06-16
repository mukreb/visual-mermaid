// Minimal Monarch tokenizer so Monaco highlights Mermaid flowchart syntax:
// keywords, directions, arrows, edge labels, comments, node brackets.

import type { Monaco } from "@monaco-editor/react";

export const MERMAID_LANG_ID = "mermaid";

export function registerMermaid(monaco: Monaco): void {
  if (monaco.languages.getLanguages().some((l) => l.id === MERMAID_LANG_ID)) return;

  monaco.languages.register({ id: MERMAID_LANG_ID });

  monaco.languages.setMonarchTokensProvider(MERMAID_LANG_ID, {
    defaultToken: "",
    tokenizer: {
      root: [
        [/%%\{.*?\}%%/, "annotation"],
        [/%%.*$/, "comment"],
        [/\b(flowchart|graph|subgraph|end|direction)\b/, "keyword"],
        [/\b(TB|TD|BT|LR|RL)\b/, "type"],
        [/-\.->|-->|---|-\.-|==>|===/, "operator"],
        [/\|[^|]*\|/, "string"],
        [/"(?:[^"\\]|\\.)*"/, "string"],
        [/[{}()[\]]/, "delimiter.bracket"],
        [/[A-Za-z_]\w*/, "identifier"],
      ],
    },
  });

  monaco.languages.setLanguageConfiguration(MERMAID_LANG_ID, {
    comments: { lineComment: "%%" },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
    ],
  });
}
