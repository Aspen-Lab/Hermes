import { createMcpHandler } from "mcp-handler";
import { registerPeerTools } from "@/lib/mcp/server";

// Node APIs (crypto.timingSafeEqual in 1-10, the SDK's own runtime needs)
// are required here — Edge won't do. A tool-call response must never be
// cached (route.md's "GET handlers are cached by default" caching section).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SERVER_INFO = { name: "peer", version: "0.1.0" };

// NOTE (1-01 skeleton): transiently unauthenticated. Item 1-10 (the dev-slug
// gate, RULING 2) lands in the very next commit, before any real data path
// exists. No tools are registered yet either (registerPeerTools is still a
// no-op), so there is nothing sensitive to protect at this step.
async function handleRequest(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  await params;

  // mcp-handler routes internally by exact `pathname === streamableHttpEndpoint`
  // string match (it defaults to "/mcp", built for its own [transport] catch-all
  // convention). We own routing via this dynamic segment instead, so point it at
  // whatever path this particular request actually arrived on.
  const handler = createMcpHandler(
    (server) => {
      registerPeerTools(server, { userId: "" });
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
