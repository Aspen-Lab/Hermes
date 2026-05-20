// Shared HTTP helper for source adapters: per-call timeout + one short
// retry on 429 honoring Retry-After (capped). Returns the Response so
// callers can decide how to consume the body.
export async function sourceFetch(
  url: string,
  options: { timeoutMs?: number; revalidate?: number } = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 7000;
  const init: RequestInit & { next?: { revalidate?: number } } = {
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (options.revalidate !== undefined) {
    init.next = { revalidate: options.revalidate };
  }

  let res = await fetch(url, init);
  if (res.status !== 429) return res;

  const retryAfter = Number(res.headers.get("Retry-After"));
  const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
    ? Math.min(retryAfter * 1000, 1500)
    : 500;
  await new Promise((resolve) => setTimeout(resolve, waitMs));

  const retryInit: RequestInit & { next?: { revalidate?: number } } = {
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (options.revalidate !== undefined) {
    retryInit.next = { revalidate: options.revalidate };
  }
  res = await fetch(url, retryInit);
  return res;
}
