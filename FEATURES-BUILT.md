# What was built — feature list for review

Branch `facets-and-daily-pool`. **99 commits, 96 files, ~10,000 lines added.**
Nothing is on a PR yet.

This is the *what was built* list. For step-by-step "click here, confirm that"
instructions, use [CHECKLIST-facets.md](CHECKLIST-facets.md).

**Verified state:** 319 tests pass, TypeScript clean, ESLint clean on changed
files, live Events benchmark passing.

---

## 1. Location and date now actually exist

Before this, every web-discovered event stored the literal text `"See event
page"` as its location, and jobs stored an empty string. There was nothing to
filter on.

- [ ] Peer opens the real event page and reads its structured data — three layers, in order of trust: embedded event data → page preview tags → body text.
- [ ] Cities, regions, countries, and dates are pulled out and stored properly.
- [ ] A hybrid event keeps **both** its city and its online flag, so "Chicago + Virtual" is findable either way.
- [ ] Country names are normalised to one spelling — `United States`, never also `US` / `USA` / `United States of America`.
- [ ] A country is only attached when it actually belongs to the city, so a Cologne conference is no longer filed under China because the page mentioned China elsewhere.
- [ ] Job locations arrive already comma-delimited and are split properly, so the filter shows `Aiken` rather than `Columbia, SC, United States`.
- [ ] A value that cannot be a real place name (a slogan, a whole sentence) is discarded rather than shown as a city.

## 2. The daily pool — Peer searches once a day

- [ ] Each surface builds its candidate pool once per local day and reuses it for the rest of the day.
- [ ] Reloading the page never re-searches.
- [ ] Two storage backends: local disk for your own development, Supabase for the shipped product.
- [ ] Search spend is capped and measured: **16 Events + 12 Jobs + 4 Papers = 32/day**, about 990/month against your 1000 limit.
- [ ] The Papers search layer is cached too — its free academic sources still run live on every load, so papers stay fresh without spending credits.

## 3. The pool got big enough to be worth filtering

- [ ] Fixed a formula that divided a fixed result cap across the query set, so every query added starved the others. Providers bill per search, not per result, so this was throwing away most of the pool for free.
- [ ] Measured effect: event pool **11 → 24**, job pool **6 → 15**, location filter **3 → 12 cities**.

## 4. Filtering by location, date, and format

- [ ] An always-visible panel under the search box on Events and Jobs, with a count on every tag.
- [ ] Counts describe the **whole pool**, not just the cards on screen — so you can see cities you are not currently being shown.
- [ ] Selecting a filter shows **everything** that matches, not just the top slice.
- [ ] Selecting a filter **overrides the quality cutoff** — if you ask for Chicago, weak Chicago matches still appear rather than the list coming back empty.
- [ ] Results paginate 10 at a time with a "show more" control.
- [ ] Free-text search on the tab filters the day's pool and works alongside a selected filter.

## 5. Relevance is visible

- [ ] Cards are tinted in three green tiers, strongest match to weakest.
- [ ] Tiers use fixed thresholds, so a card does not change colour day to day.
- [ ] Readable in both light and dark mode.

## 6. Junk removed from the feed

Each of these was found in a real feed and is now filtered:

- [ ] Social media posts — an Instagram reel was being presented as an academic event.
- [ ] Journal and abstract pages — IOPscience, ScienceDirect, ProgramMaster, HAL.
- [ ] Predatory conference mills — waset.org and similar.
- [ ] Online shops — a battery retailer's product catalogue.
- [ ] News articles *about* events, e.g. "The Year Ahead: Key Events at the IAEA in 2026".
- [ ] Calendar index and research-group pages — "Events for July 2026".
- [ ] Job-board search pages — "60 Molten Salt Jobs, Employment".
- [ ] Bare careers-index pages whose title is just `CAREERS`.
- [ ] Expired postings — a "Summer 2025 Internship" surfacing in mid-2026, and titles led by a past year.

## 7. Cards are named properly

- [ ] Event names come from the most informative part of the page title, then the event URL, then the description — so a card reads "EMEA2026 Workshop on Ion Exchange Membranes" instead of "DLR Events" or "Meeting Summary".

## 8. Three separate topic lists — Papers, Events, Jobs

- [ ] **Profile** shows three Required/Explore pairs instead of one shared pair, each with a line explaining what it seeds.
- [ ] Each of Papers, Events, and Jobs has its own topic panel under the search box — expanded on Papers, collapsed on Events and Jobs.
- [ ] The onboarding walkthrough asks for all three, with Events and Jobs prefilling from Papers as you type — and stopping once you edit them directly.
- [ ] Only Papers Required blocks progress through onboarding.
- [ ] Existing profiles migrate automatically: your current topics are copied into all three.
- [ ] The three lists are fully independent afterwards — changing one never touches another.

## 9. Edits take effect tomorrow, not today

- [ ] Topic edits are held as "pending" and promoted the next local day, so editing never triggers a search.
- [ ] Career stage and location preferences are frozen the same way.
- [ ] Panels show `Active now` and `Pending tomorrow` when they differ, so an edit does not look like it did nothing.
- [ ] Every panel states `Changes take effect in tomorrow's search.`
- [ ] No limit on how often you edit — editing costs nothing.

## 10. Feed learns from filter clicks

- [ ] Selecting a location filter is recorded as a weak preference, nudging that place up in future days.
- [ ] The boost is capped and decays, so one Chicago click does not bury Berlin forever.
- [ ] A card lifted this way says why.
- [ ] Existing rule kept: papers influence events and jobs, events weakly influence jobs, nothing flows back into papers.

## 11. Honest reasons

- [ ] A card's stated reason names something actually in your profile.
- [ ] Nothing falls back to "Upcoming in your field" when nothing matched.
- [ ] Fixed the case where an AI conference told a battery researcher it "covers your machine learning focus".

## 12. Two defects found in review, not by the builder

Both were found by re-running the real feature rather than trusting the reports:

- [ ] **Empty pool.** The per-search result cap was starving every query — the fix is item 3 above.
- [ ] **New user got an empty feed for a full day.** The day-lock stamped the day's search inputs during app start, before onboarding had collected anything, so everything entered during setup sat unused until the next day. Now the first real input promotes immediately, while later same-day edits still correctly wait for tomorrow.

---

## Not built — deliberately deferred

- Rebuild-on-demand. You settled on edits landing tomorrow, so there is no "search again now" button and no way to spend extra credits from the UI.
- A `Reset to Papers` button on Events/Jobs. Dropped when the design moved to onboarding-time seeding.
- Per-device promotion is per-device: if you use two machines, each promotes on its own first load of the day.

## Known imperfections — expected

- A company name can occasionally land in the location filter, e.g. `Quintus Technologies`.
- One or two stray items still reach Events: a paper title, or a title starting with `##`.
- A job card may read `Careers Open application` when the page has no better label.
- One live result carries a 2026 date despite a 2024 title, so date extraction can disagree with the title's year.
- Some events legitimately have no date (shown as TBA) or no city.

## Also still unmerged, separate from this branch

- **PR #15** — the event/job relevance rebuild this branch is built on. Reviewed and mergeable.
- **PR #14, PR #13** — earlier work, untouched by any of this.
- **`local-profile-snapshot`** — a dev-only convenience branch, parked on purpose.
