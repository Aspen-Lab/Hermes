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

// Extracts the first <figure>'s first <img src="..."> from rendered ar5iv HTML.
// ar5iv markup is regular: <figure id="..."> ... <img src="..."> </figure>.
function firstFigureImg(html: string, baseUrl: string): string | null {
  const figMatch = html.match(/<figure\b[^>]*>([\s\S]*?)<\/figure>/i);
  if (!figMatch) return null;
  const imgMatch = figMatch[1].match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  if (!imgMatch) return null;
  const src = imgMatch[1].trim();
  // Skip 1×1 trackers / data URIs that aren't real figures.
  if (src.startsWith("data:")) return null;
  return absolutize(src, baseUrl);
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
      if (!src.startsWith("data:")) return absolutize(src, baseUrl);
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
      const img = firstFigureImg(html, ar5ivUrl);
      if (img) return { imageUrl: img, source: "ar5iv" };
    }
    // ar5iv miss — fall through to og:image on the abs page.
    if (input.url) {
      const r2 = await timedFetch(input.url);
      if (r2 && r2.ok) {
        const html = await readBoundedText(r2);
        const og = metaOgImage(html, input.url);
        if (og) return { imageUrl: og, source: "og" };
      }
    }
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
