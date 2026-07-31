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
