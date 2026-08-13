import { afterEach, describe, expect, it, vi } from "vitest";

// Pipeline-layer mocks so a real tools/call for get_daily_forecast can
// succeed through the actual MCP dispatch (McpServer -> registerPeerTools
// -> get-daily-forecast.ts), not just at the unit level. This is what lets
// the tests below prove the tool<->widget data path end to end.
const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  profileRowToProfile: vi.fn(),
  runFeedPipeline: vi.fn(),
  runJobsPipeline: vi.fn(),
  runEventsPipeline: vi.fn(),
  scoredItemToPaper: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
  }),
}));
vi.mock("@/app/api/profile/route", () => ({ profileRowToProfile: mocks.profileRowToProfile }));
vi.mock("@/lib/feed/pipeline", () => ({ runFeedPipeline: mocks.runFeedPipeline }));
vi.mock("@/lib/jobs/pipeline", () => ({ runJobsPipeline: mocks.runJobsPipeline }));
vi.mock("@/lib/events/pipeline", () => ({ runEventsPipeline: mocks.runEventsPipeline }));
vi.mock("@/lib/feed/mapper", () => ({ scoredItemToPaper: mocks.scoredItemToPaper }));

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
  vi.clearAllMocks();
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

// 1-03+1-04+1-09: proves the tool<->widget data path through the REAL MCP
// dispatch (McpServer.registerTool/registerResource, not just unit-level
// function calls) -- exactly the gap that hid the original closure-based
// design's bug (a resources/read call never actually shares a server
// instance with the tools/call that preceded it, since each request builds
// a fresh McpServer; only a protocol-level test through the route can catch
// that class of problem).
function jsonRpcRequest(method: string, params: unknown, id = 2): Request {
  return new Request(`http://localhost/api/mcp/${FIXTURE_SLUG}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
}

async function callRoute(request: Request): Promise<Record<string, unknown>> {
  const res = await POST(request, { params: Promise.resolve({ slug: FIXTURE_SLUG }) });
  expect(res.status).toBe(200);
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    const dataLine = text.split("\n").find((line) => line.startsWith("data:"));
    if (!dataLine) throw new Error(`no data: line in SSE body: ${text}`);
    return JSON.parse(dataLine.slice("data:".length).trim());
  }
  return res.json();
}

const FIXTURE_JOB = {
  id: "remotive:proto-a",
  roleTitle: "Protocol Test Job",
  companyOrLab: "Co",
  location: "Remote",
  isRemote: true,
  keyRequirements: [],
  matchReason: "m",
  relevanceScore: 0.9,
  linkPosting: "https://x/proto-a",
};

describe("POST /api/mcp/[slug] — tools/list, tools/call, resources/read", () => {
  it("tools/list surfaces both tools, and get_daily_forecast's _meta points at the widget resource", async () => {
    stubDevAuthEnv();
    const body = await callRoute(jsonRpcRequest("tools/list", {}));
    const result = body.result as { tools: Array<Record<string, unknown>> };
    const names = result.tools.map((t) => t.name);
    expect(names).toContain("get_daily_forecast");
    expect(names).toContain("get_opportunity");
    expect(names).toContain("open_home");

    const forecastTool = result.tools.find((t) => t.name === "get_daily_forecast")!;
    const meta = forecastTool._meta as Record<string, unknown>;
    expect(meta["openai/outputTemplate"]).toBe("ui://peer/daily-forecast-card.html");

    const homeTool = result.tools.find((t) => t.name === "open_home")!;
    const homeMeta = homeTool._meta as Record<string, unknown>;
    expect(homeMeta["openai/outputTemplate"]).toBe("ui://peer/daily-forecast-home.html");
  });

  // 1-06+1-07 (discoverability): the model decides whether to call Peer by
  // reading these descriptions, not from any code path — this is the
  // mechanical part of that (real descriptions exist, are substantial, and
  // mention the trigger concepts a user's question would use); the rest
  // (does a real ChatGPT/Claude actually pick the right tool) is
  // NEEDS LOCAL VERIFY, A's job with the user's own host account, not C's.
  it("all three tools carry substantial, non-generic descriptions for model tool-selection", async () => {
    stubDevAuthEnv();
    const body = await callRoute(jsonRpcRequest("tools/list", {}));
    const result = body.result as { tools: Array<Record<string, unknown>> };

    for (const name of ["get_daily_forecast", "get_opportunity", "open_home"]) {
      const tool = result.tools.find((t) => t.name === name)!;
      expect(tool.description).toBeTypeOf("string");
      expect((tool.description as string).length).toBeGreaterThan(80);
      const inputSchema = tool.inputSchema as Record<string, unknown>;
      expect(inputSchema).toBeTruthy();
    }

    const forecastTool = result.tools.find((t) => t.name === "get_daily_forecast")!;
    expect(forecastTool.description).toMatch(/forecast|briefing|digest/i);

    const opportunityTool = result.tools.find((t) => t.name === "get_opportunity")!;
    expect(opportunityTool.description).toMatch(/get_daily_forecast/);
  });

  it("tools/call for get_daily_forecast returns structuredContent and non-empty text content", async () => {
    stubDevAuthEnv();
    mocks.maybeSingle.mockResolvedValue({
      data: { user_id: FIXTURE_USER_ID },
      error: null,
    });
    mocks.profileRowToProfile.mockReturnValue({ researchTopics: ["machine learning"] });
    mocks.runFeedPipeline.mockResolvedValue({ items: [], meta: {} });
    mocks.runJobsPipeline.mockResolvedValue({
      items: [FIXTURE_JOB],
      pool: [FIXTURE_JOB],
      facetCounts: {},
      meta: {},
    });
    mocks.runEventsPipeline.mockResolvedValue({ items: [], pool: [], facetCounts: {}, meta: {} });

    const body = await callRoute(
      jsonRpcRequest("tools/call", { name: "get_daily_forecast", arguments: {} }),
    );
    const result = body.result as {
      content: Array<{ type: string; text: string }>;
      structuredContent: { items: Array<Record<string, unknown>> };
    };

    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("Protocol Test Job");
    expect(result.structuredContent.items).toHaveLength(1);
    expect(result.structuredContent.items[0].title).toBe("Protocol Test Job");
  });

  it("tools/call for open_home returns structuredContent and non-empty text content", async () => {
    stubDevAuthEnv();
    mocks.maybeSingle.mockResolvedValue({
      data: { user_id: FIXTURE_USER_ID },
      error: null,
    });
    mocks.profileRowToProfile.mockReturnValue({ researchTopics: ["machine learning"] });
    mocks.runFeedPipeline.mockResolvedValue({ items: [], meta: {} });
    mocks.runJobsPipeline.mockResolvedValue({
      items: [FIXTURE_JOB],
      pool: [FIXTURE_JOB],
      facetCounts: {},
      meta: {},
    });
    mocks.runEventsPipeline.mockResolvedValue({ items: [], pool: [], facetCounts: {}, meta: {} });

    const body = await callRoute(jsonRpcRequest("tools/call", { name: "open_home", arguments: {} }));
    const result = body.result as {
      content: Array<{ type: string; text: string }>;
      structuredContent: { items: Array<Record<string, unknown>> };
    };

    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("Protocol Test Job");
    expect(result.structuredContent.items).toHaveLength(1);
    expect(result.structuredContent.items[0].title).toBe("Protocol Test Job");
  });

  it("resources/read for the card URI returns the static widget shell, independent of any tool call", async () => {
    stubDevAuthEnv();
    const body = await callRoute(
      jsonRpcRequest("resources/read", { uri: "ui://peer/daily-forecast-card.html" }),
    );
    const result = body.result as { contents: Array<Record<string, unknown>> };
    const content = result.contents[0];
    expect(content.mimeType).toBe("text/html;profile=mcp-app");
    expect(content.text).toContain("ui/notifications/tool-result");
    expect(content.text).toContain("#FF520D");
    // Static -- never contains a specific item's data baked in server-side.
    expect(content.text).not.toContain("Protocol Test Job");
  });

  // 3-01: the fullscreen home resource, same static-template proof as the
  // card resource above.
  it("resources/read for the home URI returns the static widget shell, independent of any tool call", async () => {
    stubDevAuthEnv();
    const body = await callRoute(
      jsonRpcRequest("resources/read", { uri: "ui://peer/daily-forecast-home.html" }),
    );
    const result = body.result as { contents: Array<Record<string, unknown>> };
    const content = result.contents[0];
    expect(content.mimeType).toBe("text/html;profile=mcp-app");
    expect(content.text).not.toContain("Protocol Test Job");
  });
});
