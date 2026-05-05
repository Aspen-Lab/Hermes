// Adapted from DeerFlow's MIT-licensed PDF-first retrieval approach.
// See docs/THIRD_PARTY_NOTICES.md.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { cleanDisplayText } from "@/lib/text/clean";

const execFileAsync = promisify(execFile);

const FETCH_TIMEOUT_MS = 10_000;
const MAX_PDF_BYTES = 18_000_000;
const MAX_STDIO_BYTES = 10_000_000;
const MAX_PDF_PAGES = 24;
const MAX_PDF_FIGURES = 12;
const FETCH_VERSION = "2026-05-01-pdf-vision";
const OPEN_ACCESS_HOST_PATTERNS = [
  /(^|\.)pmc\.ncbi\.nlm\.nih\.gov$/i,
  /(^|\.)arxiv\.org$/i,
  /(^|\.)ar5iv\.labs\.arxiv\.org$/i,
  /(^|\.)biorxiv\.org$/i,
  /(^|\.)medrxiv\.org$/i,
];

type FigureSource = "semantic-scholar" | "ar5iv" | "publisher" | "open-access" | "og";

export interface PdfFigureCandidate {
  imageUrl: string;
  caption?: string | null;
  source: FigureSource;
  ordinal: number;
}

export interface PdfAttemptResult {
  status: "candidates" | "paywalled" | "no_figures" | "source_unavailable";
  candidates: PdfFigureCandidate[];
  reason?: string;
}

interface PdfExtractorFigure {
  ordinal?: number;
  page?: number;
  caption?: string | null;
  dataBase64?: string;
  mimeType?: string;
}

interface PdfExtractorOutput {
  figures?: PdfExtractorFigure[];
  reason?: string;
}

function resolveHelperScript(): string | null {
  const candidates = [
    path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      "scripts",
      "extract_pdf_figures.py",
    ),
    path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      "web",
      "scripts",
      "extract_pdf_figures.py",
    ),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function paywallReason(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return `Hermes reached ${host}, but that source appears to require paid or institutional access for figures.`;
  } catch {
    return "Hermes reached the source, but it appears to require paid or institutional access for figures.";
  }
}

function hostLooksOpenAccess(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return OPEN_ACCESS_HOST_PATTERNS.some((pattern) => pattern.test(host));
  } catch {
    return false;
  }
}

function appearsPaywalled(res: Response, html: string): boolean {
  if (hostLooksOpenAccess(res.url)) return false;
  if ([401, 402, 403, 451].includes(res.status)) return true;
  if (/captcha/i.test(html)) return true;
  const lowered = html.toLowerCase();
  const phrases = [
    "purchase access",
    "buy this article",
    "access through your institution",
    "institutional access",
    "sign in to access",
    "log in to access",
    "subscribe to continue",
    "subscription required",
    "preview of subscription content",
    "rent this article",
    "subscribe for full access",
  ];
  return phrases.some((phrase) => lowered.includes(phrase)) && !/creative commons|cc-by|free full text|open access/i.test(html);
}

async function fetchPdfResponse(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": "HermesBot/0.1 (+https://hermes.research)",
        "X-Hermes-Figure-Version": FETCH_VERSION,
        Accept: "application/pdf,text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function supportedMimeType(mimeType?: string | null): mimeType is "image/png" {
  return mimeType === "image/png";
}

function decodePreview(bytes: Buffer): string {
  return bytes.toString("utf-8", 0, Math.min(bytes.byteLength, 25_000));
}

async function runExtractor(pdfPath: string): Promise<PdfExtractorOutput | null> {
  const helperScript = resolveHelperScript();
  if (!helperScript) return null;

  const runners = [
    { command: process.env.PYTHON_BIN || "python", args: [] as string[] },
    { command: "py", args: ["-3"] },
  ];

  for (const runner of runners) {
    try {
      const { stdout } = await execFileAsync(
        runner.command,
        [
          ...runner.args,
          helperScript,
          "--input",
          pdfPath,
          "--max-pages",
          String(MAX_PDF_PAGES),
          "--max-figures",
          String(MAX_PDF_FIGURES),
        ],
        {
          timeout: 25_000,
          maxBuffer: MAX_STDIO_BYTES,
        },
      );
      const parsed = JSON.parse(stdout) as PdfExtractorOutput;
      return parsed;
    } catch (err) {
      const message = String(err);
      if (/not recognized|ENOENT/i.test(message)) continue;
      console.warn("[figures/pdf-extract] helper failed:", err);
      return null;
    }
  }

  return null;
}

export async function tryPdfCandidates(
  url: string,
  source: FigureSource,
): Promise<PdfAttemptResult> {
  const res = await fetchPdfResponse(url);
  if (!res || !res.ok) {
    return {
      status: "source_unavailable",
      candidates: [],
      reason: `Hermes could not reach ${url}.`,
    };
  }

  const contentLength = Number.parseInt(res.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_PDF_BYTES) {
    return {
      status: "source_unavailable",
      candidates: [],
      reason: "The legal PDF source was reachable, but the file was too large for Hermes to extract safely.",
    };
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.byteLength === 0) {
    return {
      status: "source_unavailable",
      candidates: [],
      reason: "The legal PDF source returned an empty file.",
    };
  }
  if (bytes.byteLength > MAX_PDF_BYTES) {
    return {
      status: "source_unavailable",
      candidates: [],
      reason: "The legal PDF source was reachable, but the file was too large for Hermes to extract safely.",
    };
  }

  const looksLikePdf =
    (res.headers.get("content-type") ?? "").toLowerCase().includes("pdf") ||
    bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (!looksLikePdf) {
    const preview = decodePreview(bytes);
    if (appearsPaywalled(res, preview)) {
      return {
        status: "paywalled",
        candidates: [],
        reason: paywallReason(res.url || url),
      };
    }
    return {
      status: "source_unavailable",
      candidates: [],
      reason: "The source looked like a landing page instead of a figure-readable PDF file.",
    };
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "hermes-pdf-"));
  const pdfPath = path.join(tempDir, "paper.pdf");

  try {
    await writeFile(pdfPath, bytes);
    const extracted = await runExtractor(pdfPath);
    if (!extracted) {
      return {
        status: "source_unavailable",
        candidates: [],
        reason: "Hermes found a legal PDF, but the server PDF figure extractor is unavailable here.",
      };
    }

    const candidates = (extracted.figures ?? [])
      .map((figure, index): PdfFigureCandidate | null => {
        if (!supportedMimeType(figure.mimeType) || !figure.dataBase64) return null;
        return {
          imageUrl: `data:${figure.mimeType};base64,${figure.dataBase64}`,
          caption: cleanDisplayText(figure.caption),
          source,
          ordinal: typeof figure.ordinal === "number" ? figure.ordinal : index,
        };
      })
      .filter((figure): figure is PdfFigureCandidate => figure !== null);

    if (candidates.length === 0) {
      return {
        status: "no_figures",
        candidates: [],
        reason:
          cleanDisplayText(extracted.reason) ||
          "Hermes opened a legal PDF for this paper, but did not extract any usable figures from it.",
      };
    }

    return {
      status: "candidates",
      candidates,
      reason: cleanDisplayText(extracted.reason),
    };
  } catch (err) {
    console.warn("[figures/pdf-extract] failed:", err);
    return {
      status: "source_unavailable",
      candidates: [],
      reason: "Hermes found a legal PDF, but could not finish extracting its figures.",
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
