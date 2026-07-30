import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Minimal config: resolve the `@/` path alias (same as tsconfig) so unit tests
// can import modules that use it, and run in a Node environment.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
