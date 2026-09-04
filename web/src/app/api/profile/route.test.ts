import { describe, expect, it } from "vitest";
import { profilePatchToRow, profileRowToProfile } from "./route";

const rowFixture = {
  user_id: "user-1",
  display_name: "Peer Member",
  research_topics: ["solid-state battery"],
  preferred_methods: ["electrochemistry"],
  location_preferences: ["Chicago"],
  authorised_countries: ["United States", "Canada"],
  career_stage: "Postdoc",
  industry_vs_academia: "both",
  phd_year: null,
  school: null,
  current_project: null,
  current_challenges: null,
  disliked_topics: [],
  preference_ledger: {},
  feed_focus: "balanced" as const,
  feed_freshness: "week" as const,
  paper_count: 10 as const,
  feed_source_mix: "balanced" as const,
  feed_importance: "new" as const,
  feed_method_mode: "relatedOk" as const,
  feed_discovery_mode: "core" as const,
  feed_avoid_reviews: true,
  feed_avoid_old_papers: false,
  feed_avoid_broad_surveys: true,
  lab: null,
  digest_enabled: true,
  digest_hour_local: 8,
  digest_timezone: "America/Chicago",
  digest_channel: "inapp" as const,
  digest_frequency: "daily" as const,
  digest_email: null,
  color_theme: "system:ember" as const,
  updated_at: "2026-07-31T00:00:00.000Z",
};

describe("profile route work-authorisation mapping", () => {
  it("reads authorised countries from a remote profile row", () => {
    expect(profileRowToProfile(rowFixture).authorisedCountries).toEqual([
      "United States",
      "Canada",
    ]);
  });

  it("defaults old rows without the new column to an empty list", () => {
    const { authorised_countries: _omitted, ...oldRow } = rowFixture;
    void _omitted;
    expect(
      profileRowToProfile(oldRow).authorisedCountries,
    ).toEqual([]);
  });

  it("writes only the changed work-authorisation field in a partial patch", () => {
    expect(
      profilePatchToRow(
        { authorisedCountries: ["Germany"] },
        "user-1",
      ),
    ).toEqual({
      user_id: "user-1",
      authorised_countries: ["Germany"],
    });
  });
});

/**
 * ABC-freemium 1-16 · R-ENT-1, R-ENT-3, R-TEST-1.
 *
 * The two halves of "the plan is the server's, not the browser's". The read
 * half is that the entitlement is computed server-side and delivered; the write
 * half is that no request path can set a plan. **The write half is asserted
 * here because the SQL that enforces it — 1-13's column grants — cannot be
 * exercised from this loop.**
 */
describe("the plan is server-owned (R-ENT-1)", () => {
  it("cannot be written through PUT /api/profile", () => {
    // Send a body that tries to buy an upgrade. `profilePatchToRow` maps a
    // fixed set of fields, and none of the four plan columns is among them, so
    // the upsert payload must carry no trace of them.
    const row = profilePatchToRow(
      {
        displayName: "Peter",
        plan: "paid",
        effectivePlan: "paid",
        trial_ends_at: "2099-01-01T00:00:00.000Z",
      } as unknown as Parameters<typeof profilePatchToRow>[0],
      "user-1",
    );

    const keys = Object.keys(row);
    expect(keys).not.toContain("plan");
    expect(keys).not.toContain("trial_started_at");
    expect(keys).not.toContain("trial_ends_at");
    expect(keys).not.toContain("plan_updated_at");
    // Nothing plan-shaped at all, however it were spelled.
    expect(keys.filter((k) => /plan|trial/i.test(k))).toEqual([]);
    // And the legitimate field still went through, so this is not passing by
    // mapping nothing.
    expect(row.display_name).toBe("Peter");
  });

  it("does not leak the stored plan into the profile the browser holds", () => {
    // `select("*")` means the new columns arrive in `data` once the migration
    // is applied. Only `profileRowToProfile` decides what reaches the browser,
    // and the plan must reach it inside the entitlement instead — otherwise a
    // later round is invited to add it to the write mapping too.
    const mapped = profileRowToProfile({
      ...rowFixture,
      plan: "paid",
      trial_ends_at: "2099-01-01T00:00:00.000Z",
    } as unknown as Parameters<typeof profileRowToProfile>[0]);

    expect(Object.keys(mapped).filter((k) => /plan|trial/i.test(k))).toEqual([]);
  });
});
