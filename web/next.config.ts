import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack project root to THIS directory.
  //
  // Turbopack otherwise infers the root by walking up for a lockfile, and it
  // refuses to resolve modules outside that root. A stray package-lock.json in
  // the repo root (easy to create by running `npm` one directory too high)
  // moved the inferred root above web/, which made `tailwindcss` unresolvable.
  // Every failed CSS compile then leaked a postcss worker process that was
  // never reaped — hundreds of orphaned node processes in one session.
  // Pinning the root makes resolution deterministic and immune to that.
  turbopack: {
    root: __dirname,
  },
  outputFileTracingIncludes: {
    "/api/figure": ["./scripts/extract_pdf_figures.py"],
  },
  outputFileTracingExcludes: {
    "/*": [".tmp*/**"],
  },
};

export default nextConfig;
