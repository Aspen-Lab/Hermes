import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

// RULING 75 / RULING 76d — the live benchmark runs on the Vertex Gemini search
// provider, so the test process needs the same Vertex credentials the dev server
// reads from `.env.local`. **Measured, not assumed: Vitest does NOT copy env
// files into `process.env`** (probed 2026-08-15 — `GOOGLE_VERTEX_PROJECT` read
// back `false` inside a test while the same file was loaded fine by
// `node --env-file`). Without this the live benchmark can only ever SKIP, and a
// skipped benchmark is the "green by absence" round 28 A refused to bank.
//
// **Scoped to the `GOOGLE_` prefix on purpose.** Loading every local variable
// would hand all 97 suites `PEER_DIGEST_PROVIDER` and any other operator
// credential, which changes which provider path unrelated tests take. The
// narrow prefix carries exactly what a Vertex grounding call needs
// (`GOOGLE_VERTEX_PROJECT`, `GOOGLE_VERTEX_LOCATION`,
// `GOOGLE_APPLICATION_CREDENTIALS`) and nothing else. `registry.test.ts` deletes
// and stubs these names itself, so it is unaffected — verified by running it.
const vertexEnv = loadEnv("test", process.cwd(), "GOOGLE_");

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
    env: vertexEnv,
  },
});
