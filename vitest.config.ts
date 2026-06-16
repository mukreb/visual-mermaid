import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // jsdom gives mermaid a `document` so the Jison parser + flowDb run headless.
    // NOTE: mermaid.render() needs real layout (getBBox) which jsdom lacks — those
    // render-equivalence checks belong in browser mode / Playwright, not here.
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
