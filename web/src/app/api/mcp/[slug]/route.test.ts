import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// Fixtures only — never a real slug or a real Supabase user id (RULING 2,
// docs/handoff/MULTIAGENT-mcp-app.md §1c).
const FIXTURE_SLUG = "test-fixture-slug-xyz";
const FIXTURE_USER_ID = "00000000-0000-4000-8000-000000000000";

function stubDevAuthEnv() {
  vi.stubEnv("MCP_DEV_SLUG", FIXTURE_SLUG);
  vi.stubEnv("MCP_DEV_TEST_USER_ID", FIXTURE_USER_ID);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

// This is the exact request A's own "Fixture/protocol pass" method (see
// docs/handoff/MULTIAGENT-mcp-app.md §2 Agent A) reuses next round — kept
// deliberately minimal and spec-literal so it can be lifted verbatim.
function initializeRequest(path = `/api/mcp/${FIXTURE_SLUG}`): Request {
  return new Request(`http://localhost${path}`, {
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

describe("POST /api/mcp/[slug]", () => {
  // Rewritten in 1-10 (was: "any slug reaches the handler," true only for
  // the transiently-open 1-01 skeleton). Now the correct slug is required —
  // this is the same InitializeResult assertion, just gated correctly.
  it("responds 200 with a valid InitializeResult shape for the correct slug", async () => {
    stubDevAuthEnv();
    const res = await POST(initializeRequest(), {
      params: Promise.resolve({ slug: FIXTURE_SLUG }),
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

  it("404s on a wrong slug — never 401/403 (RULING 2)", async () => {
    stubDevAuthEnv();
    const res = await POST(initializeRequest("/api/mcp/wrong-slug"), {
      params: Promise.resolve({ slug: "wrong-slug" }),
    });
    expect(res.status).toBe(404);
  });

  it("404s when MCP_DEV_SLUG is unset, regardless of the slug tried", async () => {
    vi.stubEnv("MCP_DEV_SLUG", "");
    vi.stubEnv("MCP_DEV_TEST_USER_ID", FIXTURE_USER_ID);
    const res = await POST(initializeRequest(), {
      params: Promise.resolve({ slug: FIXTURE_SLUG }),
    });
    expect(res.status).toBe(404);
  });

  it("404s when the slug is right but MCP_DEV_TEST_USER_ID is unset", async () => {
    vi.stubEnv("MCP_DEV_SLUG", FIXTURE_SLUG);
    vi.stubEnv("MCP_DEV_TEST_USER_ID", "");
    const res = await POST(initializeRequest(), {
      params: Promise.resolve({ slug: FIXTURE_SLUG }),
    });
    expect(res.status).toBe(404);
  });
});
