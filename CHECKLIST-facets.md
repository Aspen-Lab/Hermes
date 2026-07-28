# Manual checklist — faceted event/job filtering

Branch `facets-and-daily-pool`, in this worktree. Nothing is on a PR yet.

**Start the app**

```bash
cd "C:/I/Personal/Github - start up project/Peer-facets/web" && npm run dev
```

Then open the Events tab and the Jobs tab. Tick as you go; anything that fails, note the item number and tell me.

---

## 0. The three fixes from this round — check these first

- [ ] **Papers tab shows the summary card again** (the one-paragraph digest above the cards).
- [ ] **All tab shows only two things**: the opportunity pool panel and the paper summary card. No paper/event/job cards, no "show more".
- [ ] The tab chips (All / Papers / Events / Jobs) are still there on All — you need them to navigate.
- [ ] **Every word on the page is English.** Nothing in Chinese anywhere, especially the opportunity pool panel: "Today's opportunity pool", "Location", "When", "Format", "In person / Online / Hybrid", "Clear filters", "More +N" / "Show fewer", "August 2026" rather than a Chinese date.

---

## 1. The panel is always there

- [ ] On **All**, there is no search box. The opportunity pool panel IS shown (it is the overview).
- [ ] On **Papers**, **Events**, **Jobs**, the search box appears, roughly two-thirds width, centered.
- [ ] Under the search box on Events and Jobs there is a facet panel that is **always visible** — no collapse or hide control.
- [ ] Each tag shows a count, e.g. `Chicago (4)`.
- [ ] Tags are grouped — location, time, format.

## 2. The counts describe the whole pool, not the visible cards

This is the point of the whole feature: you need to see places you *aren't* currently being shown.

- [ ] The panel lists cities that do **not** appear in the first 10 cards.
- [ ] Add up a location's count — it can exceed 10.
- [ ] Reload the page. **The counts stay exactly the same.** (Same pool all day.)

## 3. Filtering shows everything, not just the top 10

- [ ] Click a location with a count above 10 — you get 10 cards plus a "show more" control.
- [ ] Click through to the end; the total you saw matches the number on the tag.
- [ ] Click a location with a small count, e.g. `Cologne (1)` — you get exactly that many, and the list does not pad itself with unrelated items.
- [ ] Select a location whose events are all weak matches — **they still appear.** Filtering overrides the quality cutoff, because you asked for them specifically.
- [ ] Deselect everything and the feed returns to the normal ranked view.

## 4. Ordering and colour

- [ ] Cards are ordered most relevant first, all the way down, including after "show more".
- [ ] Strongest matches are the most saturated green; relevance fades down the list.
- [ ] Only three distinct shades — not a smooth gradient.
- [ ] Switch to dark mode: text stays readable on every tier.
- [ ] The same event keeps the same shade after a reload.

## 5. Search box

- [ ] On Events, type a word from a card you can see — the list narrows to matching events.
- [ ] Combine two words and only events matching both remain.
- [ ] Clear the box and the full list returns.
- [ ] Search works together with a selected facet, not instead of it.

## 6. Ten, not five

- [ ] Events and Jobs each show up to **10** cards before "show more".
- [ ] On a thin day you may see fewer than 10 — that is intended, it will not pad with junk.

## 7. Dates and locations are real

- [ ] Events show real cities — Chicago, Cambridge, Cologne, Salt Lake City.
- [ ] **No card shows a city that is actually a sentence or a slogan.**
- [ ] **No card pairs a city with the wrong country.** Cologne should read Germany, never China.
- [ ] Jobs show cities as single names — `Aiken`, `Fremont`, `Idaho Falls` — not `Columbia, SC, United States`.
- [ ] One country appears under one label only — `United States`, never also `US`, `USA`, `United States of America`.
- [ ] The Jobs time facet is **not empty**.
- [ ] A hybrid event (e.g. the Chicago Solid-State Battery Summit, "Chicago + Virtual") appears under **both** its city and the online/hybrid format.

## 8. Junk is gone

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

## 9. The benchmark

- [ ] The **Solid-State Battery Summit** (Cambridge EnerTech, Aug 11–12 2026, Chicago) is in the Events list.
- [ ] Its card shows **Chicago** and an August 2026 date.
- [ ] Filtering to Chicago keeps it.

## 10. Reasons are honest

- [ ] Every card's reason names something actually in your profile — battery, molten salt, ion exchange, LCO.
- [ ] **No card claims a match you don't have.** Nothing should say "machine learning focus".
- [ ] Nothing falls back to vague filler like "Upcoming in your field".

## 11. It only searches once a day

- [ ] Reload Events several times — it should return instantly after the first load.
- [ ] Confirm your Tavily usage does not climb with each reload. Budget is ~30 searches per day, ~900/month against your 1000 limit.

## 12. Preference learning

- [ ] Select a location facet a few times, then reload — events in that place rank a little higher.
- [ ] A card boosted this way says why, e.g. "because you often view Chicago".
- [ ] Other places are still present — you should not be locked into one city.

## 13. Papers are untouched

- [ ] The Papers tab still returns the same solid-state-battery papers as before.
- [ ] The Papers tab has **no** location or date facet panel.

---

## Known imperfections — expected, no need to report

- A company name can occasionally appear as a location, e.g. `Quintus Technologies`.
- One or two stray items still slip into Events: a paper title, or a title starting with `##`.
- A job card may still read `Careers Open application` when the page has no better label.
- Some events have no date and show as TBA; some have no city.

## Verified state at commit time

296 tests pass, TypeScript clean, ESLint clean on `src/lib`. Live event pool 24 items with 12 cities; job pool 13 items with a populated month facet. Paper feed returns the identical top five in the identical order as before this work.
