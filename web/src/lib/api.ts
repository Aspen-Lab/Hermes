// Thin typed client for the app's own /api routes.
//
// Every client-side call goes through apiFetch so JSON headers, the res.ok
// check, and error shape live in exactly one place. Callers that want
// fire-and-forget semantics wrap it in their own try/catch (see the cloud*
// helpers in store/feed.ts).

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    throw new ApiError(
      `${init.method ?? "GET"} ${path} → HTTP ${res.status}`,
      res.status,
    );
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
