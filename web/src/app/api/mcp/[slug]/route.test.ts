import { describe, expect, it } from "vitest";
import { POST } from "./route";

// This is the exact request A's own "Fixture/protocol pass" method (see
// docs/handoff/MULTIAGENT-mcp-app.md §2 Agent A) reuses next round — kept
// deliberately minimal and spec-literal so it can be lifted verbatim.
function initializeRequest(): Request {
  return new Request("http://localhost/api/mcp/anything", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-client", version: "0.0.1" },
      },
    }),
  });
}

async function readJsonRpcBody(res: Response): Promise<Record<string, unknown>> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    const dataLine = text
      .split("\n")
      .find((line) => line.startsWith("data:"));
    if (!dataLine) throw new Error(`no data: line in SSE body: ${text}`);
    return JSON.parse(dataLine.slice("data:".length).trim());
  }
  return res.json();
}

describe("POST /api/mcp/[slug] — 1-01 endpoint skeleton", () => {
  // 1-01 skeleton is transiently unauthenticated (the slug itself isn't
  // validated until 1-10, the very next commit) — any slug value reaches
  // the MCP handler at this step. `params` still has to resolve so the
  // dynamic route + Next 16's Promise-based params contract are exercised.
  it("responds 200 with a valid InitializeResult shape", async () => {
    const res = await POST(initializeRequest(), {
      params: Promise.resolve({ slug: "anything" }),
    });

    expect(res.status).toBe(200);
    const body = await readJsonRpcBody(res);
    expect(body.jsonrpc).toBe("2.0");
    expect(body.id).toBe(1);
    const result = body.result as Record<string, unknown>;
    expect(result).toBeTruthy();
    expect(result.protocolVersion).toEqual(expect.any(String));
    expect(result.capabilities).toBeTruthy();
    const serverInfo = result.serverInfo as Record<string, unknown>;
    expect(serverInfo.name).toBe("peer");
    expect(serverInfo.version).toBe("0.1.0");
  });
});
