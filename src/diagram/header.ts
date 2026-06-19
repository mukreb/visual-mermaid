// Shared header detection: the first line of actual diagram source, skipping YAML
// frontmatter, `%%{init}%%` directives and comments. Each adapter's matches()
// tests this against its own keyword.

export function firstKeywordLine(text: string): string {
  let inFrontmatter = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "---") {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) continue;
    if (line === "" || line.startsWith("%%")) continue;
    return line;
  }
  return "";
}
