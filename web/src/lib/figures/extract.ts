// Figure extraction for paper briefings.
//
// Two strategies:
//   - arxiv items → fetch ar5iv (LaTeX→HTML rendering) and pull the first
//     <figure><img>. ar5iv hosts images on its own CDN, so the URL is
//     stable and embeddable.
//   - everything else → fetch the item URL and parse <meta property="og:image">.
//
// Caching: relies on Next.js's fetch cache (`next.revalidate`) — each
// upstream URL is hit at most once per `REVALIDATE_S`. Vercel's CDN handles
// the inflight dedup. We deliberately do NOT cache to Supabase here; if we
// outgrow fetch cache we add a `paper_figures` table later.

const REVALIDATE_S = 86_400; // 24h
const FETCH_TIMEOUT_MS = 4_000;
const MAX_BODY_BYTES = 2_000_000;

interface ExtractInput {
  itemId: string;
  url?: string;
}

export interface FigureResult {
  imageUrl: string | null;
  source?: "ar5iv" | "og" | null;
}

async function timedFetch(url: string, init?: RequestInit): Promise<Response | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      // Browsers / Vercel will dedup + cache identical requests.
      next: { revalidate: REVALIDATE_S },
      headers: {
        // Some hosts serve different markup (or 403) without a UA.
        "User-Agent":
          "Mozilla/5.0 (compatible; HermesBot/0.1; +https://hermes-flax-six.vercel.app)",
        Accept: "text/html,application/xhtml+xml",
        ...(init?.headers ?? {}),
      },
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function readBoundedText(res: Response): Promise<string> {
  // Stream-read with a hard byte cap so we don't load whole 10MB ar5iv pages.
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const decoder = new TextDecoder("utf-8");
  let bytes = 0;
  let out = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (bytes >= MAX_BODY_BYTES) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      break;
    }
  }
  out += decoder.decode();
  return out;
}

function absolutize(src: string, baseUrl: string): string {
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return src;
  }
}

// Reject hits that look like site logos / social-card placeholders rather
// than actual paper figures. Common offender: arXiv abs pages set
// og:image to "static.arxiv.org/icons/...arxiv-logo...png", which is the
// site logo, not the paper. Same idea for Semantic Scholar, NeurIPS, etc.
const BAD_URL_PATTERNS: RegExp[] = [
  /static\.arxiv\.org/i,
  /\barxiv-logo\b/i,
  /\bar5iv-logo\b/i,
  /\b(logo|favicon|sprite|placeholder|icons?)[-_./]/i,
  /\/static\/(?:icons?|images?|logos?)\//i,
  /og[-_]?image[-_]?default/i,
  /twitter[-_]?(?:card|image)[-_]?default/i,
  /opengraph[-_]?default/i,
];

function looksLikeLogo(url: string): boolean {
  return BAD_URL_PATTERNS.some((re) => re.test(url));
}

// Walks every <figure> in order and returns the first <img src> that
// passes the logo-rejection filter. Returns null only if none qualify.
function firstFigureImg(html: string, baseUrl: string): string | null {
  const figRe = /<figure\b[^>]*>([\s\S]*?)<\/figure>/gi;
  for (const figMatch of html.matchAll(figRe)) {
    const imgMatch = figMatch[1].match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
    if (!imgMatch) continue;
    const src = imgMatch[1].trim();
    if (!src || src.startsWith("data:")) continue;
    const abs = absolutize(src, baseUrl);
    if (looksLikeLogo(abs)) continue;
    return abs;
  }
  return null;
}

// Heuristic: ar5iv returns a 200 page with an error placeholder when the
// LaTeX source failed to render. Detect those and treat as a miss so we
// don't surface boilerplate logos.
function isAr5ivErrorPage(html: string): boolean {
  return (
    /ar5iv\s+could\s+not\s+(?:generate|render|process)/i.test(html) ||
    /failed\s+to\s+(?:convert|render|process)\s+the\s+source/i.test(html) ||
    /no\s+ar5iv\s+rendering\s+available/i.test(html)
  );
}

function metaOgImage(html: string, baseUrl: string): string | null {
  // og:image OR twitter:image — both commonly set.
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url|:url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      const src = m[1].trim();
      if (src.startsWith("data:")) continue;
      const abs = absolutize(src, baseUrl);
      if (looksLikeLogo(abs)) continue;
      return abs;
    }
  }
  return null;
}

// Strips a source prefix like "arxiv:2401.12345" → "2401.12345".
function bareArxivId(itemId: string): string | null {
  const m = itemId.match(/^arxiv:(.+)$/);
  if (!m) return null;
  // ar5iv accepts both v-suffixed and bare; strip any leading "abs/".
  return m[1].replace(/^abs\//, "");
}

export async function extractFigure(input: ExtractInput): Promise<FigureResult> {
  const arxivId = bareArxivId(input.itemId);
  if (arxivId) {
    const ar5ivUrl = `https://ar5iv.labs.arxiv.org/html/${encodeURIComponent(arxivId)}`;
    const res = await timedFetch(ar5ivUrl);
    if (res && res.ok) {
      const html = await readBoundedText(res);
      if (!isAr5ivErrorPage(html)) {
        const img = firstFigureImg(html, ar5ivUrl);
        if (img) return { imageUrl: img, source: "ar5iv" };
      }
    }
    // ar5iv miss — DO NOT fall through to arxiv abs og:image; that's the
    // arxiv site logo, not a figure. We'd rather show no image than a
    // misleading one. Keeping the metaOgImage filter is belt-and-braces.
    return { imageUrl: null, source: null };
  }

  // Generic path: fetch the item URL and read og:image.
  if (!input.url) return { imageUrl: null, source: null };
  const res = await timedFetch(input.url);
  if (!res || !res.ok) return { imageUrl: null, source: null };
  const html = await readBoundedText(res);
  const og = metaOgImage(html, input.url);
  return { imageUrl: og, source: og ? "og" : null };
}
