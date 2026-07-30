import { afterEach, describe, expect, it, vi } from "vitest";
import {
  streamPaperReport,
  type ReportStreamEvent,
} from "./report-stream";

function chunkedResponse(
  chunks: Uint8Array[],
  contentType = "application/x-ndjson; charset=utf-8",
): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    { headers: { "Content-Type": contentType } },
  );
}

async function collect(
  body: unknown,
  signal = new AbortController().signal,
): Promise<ReportStreamEvent[]> {
  const events: ReportStreamEvent[] = [];
  for await (const event of streamPaperReport(body, signal)) {
    events.push(event);
  }
  return events;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamPaperReport", () => {
  it("parses NDJSON across arbitrary byte and line boundaries", async () => {
    const expected: ReportStreamEvent[] = [
      { type: "mode", aiMode: "tier2" },
      {
        type: "stage",
        stage: "reading",
        label: "Reading 路",
        pct: 35,
      },
      { type: "error", message: "stopped" },
    ];
    const bytes = new TextEncoder().encode(
      expected.map((event) => JSON.stringify(event)).join("\n"),
    );
    const unicodeStart = bytes.indexOf(0xe8);
    const fetchMock = vi.fn().mockResolvedValue(
      chunkedResponse([
        bytes.slice(0, 7),
        bytes.slice(7, unicodeStart + 1),
        bytes.slice(unicodeStart + 1, unicodeStart + 2),
        bytes.slice(unicodeStart + 2),
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const controller = new AbortController();
    await expect(collect({ paper: { id: "paper-1" } }, controller.signal))
      .resolves.toEqual(expected);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/papers/report",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify({ paper: { id: "paper-1" } }),
        cache: "no-store",
        signal: controller.signal,
      }),
    );
  });

  it("rejects a successful non-stream response so callers can use JSON fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        chunkedResponse(
          [new TextEncoder().encode('{"type":"mode","aiMode":"tier1"}')],
          "application/json",
        ),
      ),
    );

    await expect(collect({})).rejects.toThrow(
      "report stream unsupported content type: application/json",
    );
  });

  it("rejects an unsuccessful response before reading its body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Unavailable", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    await expect(collect({})).rejects.toThrow("report stream HTTP 503");
  });

  it("cancels the response reader when the consumer stops early", async () => {
    const cancel = vi.fn();
    const bytes = new TextEncoder().encode(
      [
        JSON.stringify({ type: "mode", aiMode: "tier0" }),
        JSON.stringify({
          type: "stage",
          stage: "done",
          label: "Basic report ready",
          pct: 100,
        }),
      ].join("\n"),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(bytes);
            },
            cancel,
          }),
          {
            headers: {
              "Content-Type": "application/x-ndjson; charset=utf-8",
            },
          },
        ),
      ),
    );

    for await (const event of streamPaperReport(
      {},
      new AbortController().signal,
    )) {
      expect(event).toEqual({ type: "mode", aiMode: "tier0" });
      break;
    }

    expect(cancel).toHaveBeenCalledOnce();
  });
});
