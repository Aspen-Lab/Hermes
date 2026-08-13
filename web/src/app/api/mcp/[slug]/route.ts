import { createMcpHandler } from "mcp-handler";
import { getDevTestUserId, verifyDevSlug } from "@/lib/mcp/dev-auth";
import { registerPeerTools } from "@/lib/mcp/server";

// Node APIs (crypto.timingSafeEqual in dev-auth.ts, the SDK's own runtime
// needs) are required here — Edge won't do. A tool-call response must never
// be cached (route.md's "GET handlers are cached by default" caching
// section).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SERVER_INFO = { name: "peer", version: "0.1.0" };

// Dev-only auth (RULING 2, docs/handoff/MULTIAGENT-mcp-app.md §1c): an
// unguessable slug in the path, checked in constant time, mapped
// server-side to one designated test user. 404 on any mismatch or missing
// config — never 401/403 — so a prober can't even confirm `/api/mcp/*` is a
// meaningful path shape. This route and dev-auth.ts are deleted in M3 the
// same day real OAuth lands.
async function handleRequest(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!verifyDevSlug(slug)) {
    return new Response(null, { status: 404 });
  }

  let userId: string;
  try {
    userId = getDevTestUserId();
  } catch {
    return new Response(null, { status: 404 });
  }

  // mcp-handler routes internally by exact `pathname === streamableHttpEndpoint`
  // string match (it defaults to "/mcp", built for its own [transport] catch-all
  // convention). We own routing via this dynamic segment instead, so point it at
  // whatever path this particular request actually arrived on.
  //
  // Fresh McpServer per request: createMcpHandler is called here, inside the
  // handler, not at module scope, so registerPeerTools always sees the
  // userId resolved for *this* request.
  const handler = createMcpHandler(
    (server) => {
      registerPeerTools(server, { userId });
    },
    { serverInfo: SERVER_INFO },
    {
      maxDuration: 60,
      streamableHttpEndpoint: new URL(request.url).pathname,
      disableSse: true,
    },
  );
  return handler(request);
}

export const GET = handleRequest;
export const POST = handleRequest;
export const DELETE = handleRequest;
