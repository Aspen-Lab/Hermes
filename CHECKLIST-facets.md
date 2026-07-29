# Manual checklist — faceted event/job filtering

Branch `facets-and-daily-pool`, in this worktree. Nothing is on a PR yet.

**Start the app**

```bash
cd "C:/I/Personal/Github - start up project/Peer-facets/web" && npm run dev
```

**If the paper summary box is missing, check this first.** This directory is a
git worktree, and `git worktree add` does not copy gitignored files — so
`web/.env.local` (which holds the AI provider credentials) and
`web/.local-data/` did not come across when it was created. Without the
provider the digest endpoint returns `noLlm` and the summary box hides itself,
which looks exactly like the feature being broken. Both files have now been
copied in. If you ever create another worktree, copy them again:

```bash
cp "C:/I/Personal/Github - start up project/Peer/web/.env.local" web/.env.local
```

They stay gitignored in the worktree, so they will not be committed.

Then open the Events tab and the Jobs tab. Tick as you go; anything that fails, note the item number and tell me.

---

## 0. Per-surface Required / Explore topics — newest round, check these first

### 0a. Where the topic boxes are now

- [ ] **Profile** shows **three** Required/Explore pairs, labelled Papers, Events, and Jobs — not one shared pair.
- [ ] Each pair has a one-line description saying it seeds that surface's daily search.
- [ ] **Papers**, **Events**, and **Jobs** each have their own Required/Explore panel under the search box.
- [ ] The panel is **expanded by default on Papers**, **collapsed on Events and Jobs** (paper interests change often; the other two rarely).
- [ ] **All** has no topic panel.
- [ ] Editing on a tab and editing in **Profile** change the same thing — set a topic in one, see it in the other.

### 0b. The three lists are genuinely independent

- [ ] Add a topic to **Events** Required. **Papers** and **Jobs** do not change.
- [ ] Change **Papers** Required. **Events** and **Jobs** do not change.

### 0c. Edits land tomorrow, never today

This is the core rule — Peer searches once a day, so an edit cannot take effect until the next search.

- [ ] Every topic panel shows `Changes take effect in tomorrow's search.`
- [ ] Add a topic to **Events** Required. The panel now shows **both** lines:
      `Active now` (what today's feed used) and `Pending tomorrow` (with your new topic).
- [ ] Reload the page. **The Events feed is unchanged** and the counts in the opportunity pool panel are identical — your edit did not trigger a new search.
- [ ] Remove the topic again — the `Pending tomorrow` line disappears because the two lists match.
- [ ] **Tomorrow** (or after changing your computer's date), the edit is live and `Active now` matches what you typed.

### 0d. A brand-new user gets a feed on day one

This one broke during the build and was fixed in review — worth confirming.

- [ ] Open Profile and use the reset/replay onboarding control, or open the app in a fresh browser profile.
- [ ] Complete the walkthrough. The topics step asks for **all three** sets, with Events and Jobs **prefilling from what you type into Papers**.
- [ ] Edit Events during the walkthrough, then keep typing in Papers — **Events keeps your edit** and stops following Papers.
- [ ] Only **Papers** Required blocks the "continue" step. Empty Events/Jobs must not block you.
- [ ] Finish onboarding. **The feed fills today, not tomorrow.** An empty feed here is the bug returning.

### 0e. Search budget

- [ ] Reload each tab several times. Tavily usage does not climb — one search per surface per day.
- [ ] A full day of first loads costs about **32** searches (16 Events + 12 Jobs + 4 Papers), roughly 990/month against your 1000 limit.
- [ ] The **Papers** tab still returns fresh papers on every load even though its search layer is cached — the free academic sources still run live.

---

## 1. Earlier round — summary card, All tab, English

- [ ] **Papers tab shows the summary card again** (the one-paragraph digest above the cards).
- [ ] **All tab shows only two things**: the opportunity pool panel and the paper summary card. No paper/event/job cards, no "show more".
- [ ] The tab chips (All / Papers / Events / Jobs) are still there on All — you need them to navigate.
- [ ] **Every word on the page is English.** Nothing in Chinese anywhere, especially the opportunity pool panel: "Today's opportunity pool", "Location", "When", "Format", "In person / Online / Hybrid", "Clear filters", "More +N" / "Show fewer", "August 2026" rather than a Chinese date.

---

## 2. The opportunity pool panel is always there

- [ ] On **All**, there is no search box. The opportunity pool panel IS shown (it is the overview).
- [ ] On **Papers**, **Events**, **Jobs**, the search box appears, roughly two-thirds width, centered.
- [ ] Under the search box on Events and Jobs there is a facet panel that is **always visible** — no collapse or hide control.
- [ ] Each tag shows a count, e.g. `Chicago (4)`.
- [ ] Tags are grouped — location, time, format.

## 3. The counts describe the whole pool, not the visible cards

This is the point of the whole feature: you need to see places you *aren't* currently being shown.

- [ ] The panel lists cities that do **not** appear in the first 10 cards.
- [ ] Add up a location's count — it can exceed 10.
- [ ] Reload the page. **The counts stay exactly the same.** (Same pool all day.)

## 4. Filtering shows everything, not just the top 10

- [ ] Click a location with a count above 10 — you get 10 cards plus a "show more" control.
- [ ] Click through to the end; the total you saw matches the number on the tag.
- [ ] Click a location with a small count, e.g. `Cologne (1)` — you get exactly that many, and the list does not pad itself with unrelated items.
- [ ] Select a location whose events are all weak matches — **they still appear.** Filtering overrides the quality cutoff, because you asked for them specifically.
- [ ] Deselect everything and the feed returns to the normal ranked view.

## 5. Ordering and colour

- [ ] Cards are ordered most relevant first, all the way down, including after "show more".
- [ ] Strongest matches are the most saturated green; relevance fades down the list.
- [ ] Only three distinct shades — not a smooth gradient.
- [ ] Switch to dark mode: text stays readable on every tier.
- [ ] The same event keeps the same shade after a reload.

## 6. Search box

- [ ] On Events, type a word from a card you can see — the list narrows to matching events.
- [ ] Combine two words and only events matching both remain.
- [ ] Clear the box and the full list returns.
- [ ] Search works together with a selected facet, not instead of it.

## 7. Ten, not five

- [ ] Events and Jobs each show up to **10** cards before "show more".
- [ ] On a thin day you may see fewer than 10 — that is intended, it will not pad with junk.

## 8. Dates and locations are real

- [ ] Events show real cities — Chicago, Cambridge, Cologne, Salt Lake City.
- [ ] **No card shows a city that is actually a sentence or a slogan.**
- [ ] **No card pairs a city with the wrong country.** Cologne should read Germany, never China.
- [ ] Jobs show cities as single names — `Aiken`, `Fremont`, `Idaho Falls` — not `Columbia, SC, United States`.
- [ ] One country appears under one label only — `United States`, never also `US`, `USA`, `United States of America`.
- [ ] The Jobs time facet is **not empty**.
- [ ] A hybrid event (e.g. the Chicago Solid-State Battery Summit, "Chicago + Virtual") appears under **both** its city and the online/hybrid format.

## 9. Junk is gone

Scan the full list on both tabs. None of these should be present:

- [ ] Social media links — Instagram, LinkedIn posts, YouTube.
- [ ] Journal or abstract pages — IOPscience, ScienceDirect, ProgramMaster, HAL.
- [ ] Predatory conference mills — waset.org and similar.
- [ ] Online shops — a battery retailer's product catalogue.
- [ ] News articles about events, e.g. "The Year Ahead: Key Events at the IAEA in 2026".
- [ ] Calendar index pages — "Events for July 2026", "Upcoming Events".
- [ ] Job aggregator search pages — "60 Molten Salt Jobs, Employment".
- [ ] Bare careers-index titles — a card whose title is just `CAREERS`.
- [ ] Expired postings — anything labelled 2025.

## 10. The benchmark

- [ ] The **Solid-State Battery Summit** (Cambridge EnerTech, Aug 11–12 2026, Chicago) is in the Events list.
- [ ] Its card shows **Chicago** and an August 2026 date.
- [ ] Filtering to Chicago keeps it.

## 11. Reasons are honest

- [ ] Every card's reason names something actually in your profile — battery, molten salt, ion exchange, LCO.
- [ ] **No card claims a match you don't have.** Nothing should say "machine learning focus".
- [ ] Nothing falls back to vague filler like "Upcoming in your field".

## 12. It only searches once a day

- [ ] Reload Events several times — it should return instantly after the first load.
- [ ] Confirm your Tavily usage does not climb with each reload. Budget is ~30 searches per day, ~900/month against your 1000 limit.

## 13. Preference learning

- [ ] Select a location facet a few times, then reload — events in that place rank a little higher.
- [ ] A card boosted this way says why, e.g. "because you often view Chicago".
- [ ] Other places are still present — you should not be locked into one city.

## 14. Papers are untouched

- [ ] The Papers tab still returns the same solid-state-battery papers as before.
- [ ] The Papers tab has **no** location or date facet panel.

---

## Known imperfections — expected, no need to report

- A company name can occasionally appear as a location, e.g. `Quintus Technologies`.
- One or two stray items still slip into Events: a paper title, or a title starting with `##`.
- A job card may still read `Careers Open application` when the page has no better label.
- Some events have no date and show as TBA; some have no city.
- One live result carries a 2026 date despite a 2024 title (`IEX 2024 — Ion Exchange for a Sustainable Future`) — date extraction can disagree with a year in the title.

## Verified state at commit time

319 tests pass, TypeScript clean, ESLint clean on changed files. Live Events benchmark passing. Live event pool 24 items with 12 cities; job pool 13 items with a populated month facet. Paper feed returns the identical top five in the identical order as before this work.
