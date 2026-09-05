import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  OPERATOR_SENTINEL,
  deleteSpendableKeys,
  deployedRuntimeEnv,
  signedIn,
  signedOut,
  supabaseServerStub,
} from "@/test-support/route-harness";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  resolveProvider: vi.fn(),
  runFeedPipeline: vi.fn(),
  runJobsPipeline: vi.fn(),
  runEventsPipeline: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      ...supabaseServerStub(mocks.getUser),
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
      }),
    }),
}));

// The registry is stubbed so no model is reachable — the subject here is the
// GUARD, not what a provider would have returned. `resolveProvider` returning
// null is the same state every keyless runtime is in.
vi.mock("@/lib/llm/providers/registry", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/llm/providers/registry")>();
  return { ...actual, resolveProvider: mocks.resolveProvider };
});

import { POST as digestPost } from "./digest/route";
import { POST as jobsReportPost } from "./jobs/report/route";
import { POST as eventsReportPost } from "./events/report/route";
import { POST as papersReportPost } from "./papers/report/route";
import { resetCounterStoreForTests } from "@/lib/usage/counters";

/**
 * ABC-freemium 2-06 · R-SEC-2, R-SEC-3, R-TEST-1 · Ruling 2 point 7 · Ruling 4
 * point 8.
 *
 * **The persona pass for the AI routes that had none, in one runnable place.**
 *
 * Round-1 A and round-2 A each built persona probes, measured with them, and
 * deleted them — 65 cases of coverage reconstructed from prose and thrown away,
 * twice. Ruling 2 point 7 turned round-1 A's probe into three permanent route
 * suites for exactly this reason; four routes were still uncovered and this is
 * their half.
 *
 * ── WHY THIS IS A NEW FILE RATHER THAN FOUR EDITS ────────────────────────────
 *
 * B's guide says to add these cases to the existing `route.test.ts` files. I did
 * that for `GET /api/profile` in 2-03, where the file had no module-scope mocks
 * to disturb. These four are different: each already has its own `vi.mock`
 * setup, none of them stubs `@/lib/supabase/server`, and `vi.mock` is
 * module-scoped and hoisted — so adding a session stub to any of them would
 * change the runtime of every case already in the file. That is exactly the
 * collateral breakage §3 warns about, for no gain in what is measured.
 *
 * One file also gives A **one command** for the whole persona pass instead of
 * four, which is the property Ruling 2 point 7 actually wanted.
 *
 * ── WHAT EACH ROUTE MUST DO ──────────────────────────────────────────────────
 *
 * The anonymous 401, and **zero outgoing requests carrying `OPERATOR_SENTINEL`**
 * for `anonymous` and `free-no-key`. That sentinel assertion is the one A's
 * standing tallies depend on and the one that would catch a regression of
 * round-1's differences 1–3.
 */

type Handler = (request: NextRequest) => Promise<Response>;

interface RouteCase {
  name: string;
  handler: Handler;
  path: string;
  body: Record<string, unknown>;
}

const ROUTES: RouteCase[] = [
  {
    name: "POST /api/digest",
    handler: digestPost as Handler,
    path: "/api/digest",
    body: { papers: [{ id: "p:1", title: "A paper", abstract: "text" }] },
  },
  {
    name: "POST /api/jobs/report",
    handler: jobsReportPost as Handler,
    path: "/api/jobs/report",
    body: { job: { id: "job:1", roleTitle: "Scientist" } },
  },
  {
    name: "POST /api/events/report",
    handler: eventsReportPost as Handler,
    path: "/api/events/report",
    body: { event: { id: "ev:1", name: "Conference" } },
  },
  {
    name: "POST /api/papers/report",
    handler: papersReportPost as Handler,
    path: "/api/papers/report",
    body: {
      paper: {
        id: "p:1",
        title: "A paper",
        // Required by the shallow report builder, which a free caller reaches.
        summaryExperimentKeywords: [],
        authors: [],
      },
    },
  },
];

function request(path: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("the AI routes, driven through the real handlers", () => {
  let fetchSpy: { mock: { calls: unknown[][] } };

  /** Outgoing requests whose URL, headers or body carry the operator's key. */
  function requestsCarrying(sentinel: string): string[] {
    return fetchSpy.mock.calls
      .map((call) => JSON.stringify(call))
      .filter((serialised) => serialised.includes(sentinel));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    resetCounterStoreForTests();
    deleteSpendableKeys();
    deployedRuntimeEnv(vi.stubEnv);
    // The operator's keys ARE set, so "zero searches" is a statement about the
    // gate rather than about an empty environment. A test that asserted zero
    // with no key configured would pass whether or not the gate existed.
    vi.stubEnv("TAVILY_API_KEY", OPERATOR_SENTINEL);
    vi.stubEnv("BRAVE_SEARCH_API_KEY", OPERATOR_SENTINEL);
    mocks.getUser.mockResolvedValue(signedOut());
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.resolveProvider.mockReturnValue(null);
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetCounterStoreForTests();
    vi.restoreAllMocks();
  });

  for (const route of ROUTES) {
    describe(route.name, () => {
      it("answers a signed-out visitor 401", async () => {
        // R-ENT-4 — the reports are for signed-in readers. Before 1-06 three of
        // these answered a stranger 200 and never authenticated at all.
        const response = await route.handler(request(route.path, route.body));

        expect(response.status).toBe(401);
      });

      it("spends NO operator search key for an anonymous caller", async () => {
        await route.handler(request(route.path, route.body));

        expect(requestsCarrying(OPERATOR_SENTINEL)).toEqual([]);
      });

      it("spends NO operator search key for a signed-in FREE caller", async () => {
        // D2 — the system search key is for trial and paid only. This is the
        // `free-no-key` persona, and it is the number A's tally tracks.
        mocks.getUser.mockResolvedValue(signedIn("user-1"));

        await route.handler(request(route.path, route.body));

        expect(requestsCarrying(OPERATOR_SENTINEL)).toEqual([]);
      });

      it("does not resolve a provider for a signed-out visitor", async () => {
        // R-SEC-2's ordering property: the guard runs BEFORE `resolveProvider`.
        // A route that resolved first would have obtained a spendable provider
        // and only then discovered it should not have.
        await route.handler(request(route.path, route.body));

        expect(mocks.resolveProvider).not.toHaveBeenCalled();
      });
    });
  }
});
