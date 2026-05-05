import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/figure": ["./scripts/extract_pdf_figures.py"],
  },
  outputFileTracingExcludes: {
    "/*": [".tmp*/**"],
  },
};

export default nextConfig;
