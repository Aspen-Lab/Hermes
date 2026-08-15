import type { OpportunityPlace } from "@/types";
import type { RawEventItem } from "@/lib/events/types";
import { bestEventTitleSegment } from "@/lib/events/sources/eventweb";
import { cleanOwnedEventReportSummary } from "@/lib/events/mapper";
import type { RawJobItem } from "@/lib/jobs/types";
import { classifyRoleKind } from "@/lib/jobs/role-kind";
import { extractDeclaredEventName, extractEventDetails } from "./event-details";
import { extractEventRoster } from "./event-roster";
import { extractJobDetails } from "./job-details";
import { resolveEmployerIdentity } from "./employer-identity";
import { resolveJobPostingScope } from "./job-posting-scope";
import { fetchPagesConcurrently } from "./page-fetch";
import {
  declaresArticleKind,
  extractOpportunityPageDetails,
} from "./structured-extract";
import { extractVisaState } from "./visa";

export const MAX_ENRICHMENT_CANDIDATES = 40;

function tryExtract<T>(extractor: () => T): T | undefined {
  try {
    return extractor();
  } catch {
    return undefined;
  }
}

function hasExtractedEventSignal(
  structured: ReturnType<typeof extractOpportunityPageDetails> | undefined,
  details: ReturnType<typeof extractEventDetails> | undefined,
  roster: ReturnType<typeof extractEventRoster> | undefined,
): boolean {
  return Boolean(
    structured?.typedOpportunityName ||
      structured?.typedOpportunityDescription ||
      structured?.openGraphDescription ||
      structured?.startDate ||
      structured?.endDate ||
      structured?.place ||
      structured?.isOnline ||
      details?.registrationDeadline ||
      details?.fees?.length ||
      details?.activities?.length ||
      details?.travelGrant ||
      details?.invitationLetter ||
      details?.expectedSize ||
      roster?.organisations?.length ||
      roster?.people?.length,
  );
}

function hasExtractedJobSignal(
  structured: ReturnType<typeof extractOpportunityPageDetails> | undefined,
  details: ReturnType<typeof extractJobDetails> | undefined,
  visa: RawJobItem["visa"] | undefined,
  pageText: string | undefined,
): boolean {
  return Boolean(
    structured?.datePosted ||
      structured?.place ||
      details?.applicationDeadline ||
      details?.startDate ||
      // B3-06. Without this, a posting where flexibility is the only new
      // signal found would cause enrichJobCandidates to discard the whole
      // enrichment below, silently throwing away the extracted flag.
      details?.startDateFlexible ||
      details?.contractLength ||
      details?.applicationMaterials?.length ||
      // B4-11. Same reasoning as startDateFlexible above: a posting whose
      // only new signal is salary, employment type, or work mode must not be
      // discarded by this gate.
      details?.salary ||
      details?.employmentType ||
      details?.workMode ||
      pageText ||
      (visa &&
        (visa.state !== "not-stated" || visa.evidence || visa.country)),
  );
}

/**
 * B18-02 (round 18, Ruling 50c/51c). A search provider hands Peer its own
 * TRUNCATED title — `Actinide Chemistry/Ion Exchange Postdoc Research ...` —
 * while the posting's own page carries the whole thing in its first `<h1>`
 * (`… Postdoc Research Associate`). The job card rendered the ellipsis on 5
 * pulls out of 5. The defect is multi-host: 4 of 10 provider rows on one
 * targeted query were truncated, on `linkedin.com`, `talent.com`, `xtalks.com`
 * and `bebee.com` — the identical string on all four.
 *
 * THIS IS NOT B4-01's R8 EVENT FIX PORTED. There is nothing to port, and that
 * was established by execution, not assumed. Three independent reasons, any one
 * of which is fatal: the job path never calls `extractOpportunityPageDetails`;
 * that function refuses to produce a typed name unless `kind === "event"`; and
 * — decisively — `enrichJobCandidates` RETURNS EARLY on an unproven posting
 * scope, and all three live `linkedin.com` rows are `unproven`, 3 of 3. A fix
 * placed where the event fix lives could never see the row.
 *
 * THE OWNERSHIP WITNESS IS THE STRING ITSELF. The repair never REPLACES a
 * title; it only EXTENDS a title the page demonstrably continues. The heading
 * must literally BEGIN with the truncated stem, so a different posting's
 * heading — or this page's own employer-prefixed `<title>` — cannot satisfy it.
 * That is why this is safe without a page-level scope proof: it is a per-field
 * witness, the same heading-equality idea `selectedDomScopes` already uses,
 * weakened from equality to prefix precisely because the ellipsis is what makes
 * equality impossible.
 *
 * ONLY THE `<h1>` WORKS, AND THAT IS FORCED RATHER THAN PREFERRED. LinkedIn's
 * `<title>` and `og:title` are EMPLOYER-PREFIXED (`Savannah River National
 * Laboratory hiring …`), so they do not begin with the stem and the containment
 * test rejects them. The natural "prefer the page title" port produces nothing
 * here, and using them as a fallback would import site brand (`… - EV.Careers`)
 * into role titles. Do not add them.
 *
 * ^^^ CORRECTED BY B19-02 (round 19, Rulings 52a + 53a). THE PARAGRAPH ABOVE IS
 * KEPT VERBATIM BECAUSE IT IS STILL TRUE ABOUT LINKEDIN — it was wrong only to
 * GENERALISE from one host. On `careers.dupont.com` the page has NO `<h1>` AT
 * ALL and its `<title>` DOES strictly prefix-match the stem, so the repair sat
 * inert on a row it should have fixed, 5 pulls out of 5.
 *
 * WHAT MADE THE EXTENSION SAFE IS THAT THE RISK ABOVE CANNOT MATERIALISE, AND
 * THE REASON IS STRUCTURAL RATHER THAN LUCKY: an employer-prefixed string does
 * not BEGIN with the stem, so the very containment test that rejects a
 * different posting's `<h1>` rejects it too. Re-measured by execution on round
 * 18's own recorded LinkedIn string, including the hard case where the page has
 * no `<h1>` at all to fall back on. `extendTruncatedTitle` is UNCHANGED — same
 * 12-character floor, same strict-prefix test, same strictly-longer test — and
 * that is the whole argument for this item's safety. Do not weaken it into a
 * second, looser gate for the `<title>`.
 *
 * THE OTHER HALF OF B18-02's WARNING WAS RIGHT AND IS HANDLED SEPARATELY: the
 * brand tail is real, and containment cannot catch it because containment only
 * checks the FRONT of the string. The raw `<title>` renders dupont's card as
 * `… United States of America | Science & Technology jobs at Dupont` — a site
 * slogan in a role title, which Ruling 23 ranks as wrong data. So the `<title>`
 * is CUT, and not with a blind `split()[0]`: a real role title can contain a
 * separator (`Battery Cell Engineer - Gigafactory Berlin`). See
 * `pageTitleWitnesses`.
 *
 * THE `<h1>` STILL WINS OUTRIGHT WHENEVER ONE EXISTS (Ruling 53a, the NARROW
 * form). The wider form — try the `<h1>`, and if it produced nothing try the
 * `<title>` — was measured and differs on exactly ONE shape in the whole
 * corpus: a WRONG `<h1>` present alongside a `<title>` that does continue the
 * stem. Its extra exposure measured ZERO across every must-keep, but "zero on
 * the corpus we have" is the evidence position that preceded the round-16
 * singular lesson, so narrow ships and A's censuses must earn the widening.
 * That one separating shape is the reversal evidence and is asserted in the
 * tests.
 *
 * ONE NEW RISK CLASS, NAMED RATHER THAN DISCOVERED LATER: a job board's own
 * `<title>` can legitimately begin with the role and continue into listing
 * chrome (`Research Associate Jobs - 1,204 vacancies | JobBoard.com`). Neither
 * the raw nor the cut form leaves it alone. It is CONSTRUCTED; the catch is
 * LIVE 5 of 5. A `LISTING_TITLE_RE` guard against it was priced and REJECTED:
 * under the cut form it fires on nothing, so it would be a guard no test could
 * turn red.
 *
 * FAILURE DIRECTION: every rejection leaves today's value untouched. The
 * function's only non-identity return is the heading, which is required to be
 * strictly longer than the stem it extends, so it is structurally incapable of
 * shortening or blanking a title.
 */
const TRUNCATED_TITLE_RE = /\s*(?:\.\.\.|…)\s*$/;

function firstHeadingText(html: string): string | undefined {
  const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) return undefined;
  const text = match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text || undefined;
}

/**
 * B19-02: the SAME separator class `webResultToRawJobItem` already splits
 * provider titles on. No new vocabulary is introduced by this item.
 */
const TITLE_CHROME_SEPARATOR_RE = /(\s+[-–—|·]\s+)/;

function pageTitleText(html: string): string | undefined {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return undefined;
  const text = match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text || undefined;
}

/**
 * B19-02: every separator-boundary PREFIX of the page title, shortest first.
 *
 * WHY NOT `split(sep)[0]`. Cutting at the first separator is wrong on its own,
 * because a real role title can contain one — `Battery Cell Engineer -
 * Gigafactory Berlin | Tesla Careers` would be cut to `Battery Cell Engineer`,
 * which is SHORTER than the stem and so repairs nothing at all. Offering every
 * boundary in turn lets the caller stop at the FIRST one that already satisfies
 * the existing gate, which crosses the separator inside the real title and
 * stops before the chrome. There is a test that goes red for exactly this.
 */
function pageTitleWitnesses(html: string): string[] {
  const full = pageTitleText(html);
  if (!full) return [];
  const parts = full.split(TITLE_CHROME_SEPARATOR_RE);
  const out: string[] = [];
  let acc = "";
  for (const part of parts) {
    acc += part;
    const trimmed = acc.trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

/**
 * B19-02: the `<title>` witness, behind the IDENTICAL gate. Every candidate is
 * handed to the unchanged `extendTruncatedTitle`, so a witness that does not
 * begin with the stem, or is not strictly longer than it, changes nothing.
 */
function extendFromPageTitle(providerTitle: string, html: string): string {
  for (const witness of pageTitleWitnesses(html)) {
    const extended = extendTruncatedTitle(providerTitle, witness);
    if (extended !== providerTitle) return extended;
  }
  return providerTitle;
}

function extendTruncatedTitle(
  providerTitle: string,
  heading: string | undefined,
): string {
  if (!heading) return providerTitle;
  if (!TRUNCATED_TITLE_RE.test(providerTitle)) return providerTitle;
  const stem = providerTitle.replace(TRUNCATED_TITLE_RE, "").trim();
  // The 12-character floor and the strict-prefix test below are what make this
  // a witness rather than a guess. Do not relax either: without the floor,
  // `Jobs ...` would be "extended" by any heading that happens to start
  // `Jobs at …`.
  if (stem.length < 12) return providerTitle;
  const norm = (value: string) => value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  if (!norm(heading).startsWith(norm(stem))) return providerTitle;
  if (heading.length <= stem.length) return providerTitle;
  return heading.replace(/\s+/g, " ").trim();
}

export function formatOpportunityPlace(
  place: OpportunityPlace | undefined,
): string {
  if (!place) return "";
  return [place.city, place.region, place.country]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .filter((part, index, parts) => parts.indexOf(part) === index)
    .join(", ");
}

export function mergeOpportunityPlace(
  current: OpportunityPlace | undefined,
  extracted: OpportunityPlace | undefined,
): OpportunityPlace | undefined {
  const merged = {
    city: extracted?.city || current?.city,
    region: extracted?.region || current?.region,
    country: extracted?.country || current?.country,
  };
  return merged.city || merged.region || merged.country ? merged : undefined;
}

export async function enrichEventCandidates(
  items: RawEventItem[],
  limit = MAX_ENRICHMENT_CANDIDATES,
): Promise<RawEventItem[]> {
  if (items.length === 0) return [];
  const cappedLength = Math.min(
    items.length,
    Number.isFinite(limit) && limit > 0
      ? Math.floor(limit)
      : MAX_ENRICHMENT_CANDIDATES,
  );
  const candidates = items.slice(0, cappedLength);

  let pages: Array<string | null>;
  try {
    pages = await fetchPagesConcurrently(
      candidates.map((item) => item.url),
    );
  } catch {
    return items;
  }

  const enriched = candidates.map((item, index) => {
    const html = pages[index];
    if (!html) return item;
    // A23-03 / Ruling 62a: the item's own name is the `P_name` co-witness —
    // the guard asks whether the EVENT ITSELF is present beside the city, and
    // this is the only place that knows what the event is called.
    const structured = tryExtract(() =>
      extractOpportunityPageDetails(html, "event", { eventName: item.name }),
    );
    const details = tryExtract(() => extractEventDetails(html));
    const declaredEventName = tryExtract(() => extractDeclaredEventName(html));
    const roster = tryExtract(() => extractEventRoster(html));
    if (!hasExtractedEventSignal(structured, details, roster) && !declaredEventName) return item;
    const place = mergeOpportunityPlace(item.place, structured?.place);
    const location = formatOpportunityPlace(place) || item.location;
    // B6-01: reuse the guarded ingestion title segment. A fetched title can
    // improve the name only when it contains its own non-chrome event title.
    const typedName = structured?.typedOpportunityName;
    const pageSummary = structured?.typedOpportunityDescription
      ? structured.typedOpportunityDescription
      : structured?.openGraphDescription && structured.openGraphTitle &&
          bestEventTitleSegment(structured.openGraphTitle, item.url)
        ? structured.openGraphDescription
        : undefined;
    const ownedPageSummary = pageSummary
      ? cleanOwnedEventReportSummary(pageSummary)
      : undefined;
    const name = typedName
      ? bestEventTitleSegment(typedName, item.url) ??
        // B9-04 Fix 2 (round 9, Ruling 32): the rescue term used to call
        // looksLikeEventTitle alone, which bypasses ALL FOUR of
        // isChromeSegment's checks (generic title, event index, document
        // filename, host-brand) when the SolarPACES-shaped test just below
        // only needs the host-brand one bypassed. Calling
        // bestEventTitleSegment a second time, with skipHostBrand, keeps
        // typedName passing through the SAME guarded function both times —
        // still correctly rescues a typed name rejected only for matching
        // its own host's brand (an organisation's domain commonly IS its
        // name), but still correctly rejects "Conference Program" and a
        // bare document filename, which are chrome for reasons unrelated to
        // host-brand and which this second call still catches.
        bestEventTitleSegment(typedName, item.url, { skipHostBrand: true }) ??
        declaredEventName ??
        (structured?.openGraphTitle
          ? bestEventTitleSegment(structured.openGraphTitle, item.url)
          : undefined) ??
        item.name
      : declaredEventName ??
        (structured?.openGraphTitle
          ? bestEventTitleSegment(structured.openGraphTitle, item.url)
          : undefined) ??
        item.name;
    return {
      ...item,
      name,
      startDate: item.startDate || structured?.startDate || "",
      endDate: item.endDate || structured?.endDate,
      place,
      location,
      isOnline: item.isOnline || structured?.isOnline || false,
      registrationDeadline:
        item.registrationDeadline ?? details?.registrationDeadline,
      fees: item.fees ?? details?.fees,
      activities: item.activities ?? details?.activities,
      organisations: item.organisations ?? roster?.organisations,
      people: item.people ?? roster?.people,
      travelGrant: item.travelGrant ?? details?.travelGrant,
      invitationLetter: item.invitationLetter ?? details?.invitationLetter,
      expectedSize: item.expectedSize ?? details?.expectedSize,
      ...(ownedPageSummary
        ? { reportSummary: { text: ownedPageSummary, authority: "page-owned" as const } }
        : {}),
    };
  });

  return [...enriched, ...items.slice(cappedLength)];
}

export async function enrichJobCandidates(
  items: RawJobItem[],
  limit = MAX_ENRICHMENT_CANDIDATES,
): Promise<RawJobItem[]> {
  if (items.length === 0) return [];
  const cappedLength = Math.min(
    items.length,
    Number.isFinite(limit) && limit > 0
      ? Math.floor(limit)
      : MAX_ENRICHMENT_CANDIDATES,
  );
  const candidates = items.slice(0, cappedLength);

  let pages: Array<string | null>;
  try {
    pages = await fetchPagesConcurrently(
      candidates.map((item) => item.url),
    );
  } catch {
    return items;
  }

  const enriched = candidates.map((item, index) => {
    const html = pages[index];
    if (!html) return item;
    // A23-04 / Ruling 62c. The page's own kind declaration, recorded on the
    // item the way `fetchedPostingScope` is. It must be computed ABOVE the
    // `unproven` early return below, for the same reason the title repair is:
    // a page that cannot prove ownership can still declare itself an article,
    // and a signal recorded below that return could never reach those rows.
    // Recording is not deciding — the check that reads it runs at the
    // post-enrichment gate and needs the URL clause to agree.
    const pageKind = tryExtract(() => declaresArticleKind(html))
      ? ("article" as const)
      : undefined;
    const scope = tryExtract(() => resolveJobPostingScope(html, { url: item.url, title: item.title })) ?? { status: "unproven" as const };
    // B18-02: computed AFTER the scope call ON PURPOSE, and this is the item's
    // real design decision rather than an accident of ordering.
    // `resolveJobPostingScope` takes the title as an ownership witness
    // (`titleMatches`), so feeding it a REPAIRED title would change the
    // ownership contract. B measured both sides: a control page whose only
    // ownership witness is its heading resolves `unproven` with the truncated
    // title and `owned` with the repaired one — so repairing first genuinely
    // widens which pages may donate `pageText`, `employer` and the summary —
    // while across all four real truncated rows the scope is UNCHANGED either
    // way. Take the fix, decline the widening: computed here, ownership is
    // byte-identical by construction. The `owned`-widening is a recorded lead
    // for a future round with its own evidence (Ruling 51c) and is deliberately
    // NOT bolted on here.
    // B19-02 (round 19, Ruling 53a): the `<h1>` WINS OUTRIGHT whenever one
    // exists — including when it produces no repair. The `<title>` is consulted
    // only when the page has NO `<h1>` at all, which is A's dupont row and
    // `xtalks.com`'s documented class. This shape, not the wider
    // `<h1>`-first-then-`<title>`, is what Ruling 53a authorised.
    const title = tryExtract(() => {
      const heading = firstHeadingText(html);
      if (heading) return extendTruncatedTitle(item.title, heading);
      return extendFromPageTitle(item.title, html);
    }) ?? item.title;
    // The repair must sit ABOVE this early return: an unproven scope is A's
    // actual row (all three live `linkedin.com` rows are unproven, 3 of 3), so
    // a repair placed below it could never reach the defect it exists to fix.
    if (scope.status === "unproven") {
      return {
        ...item,
        title,
        fetchedPostingScope: "unproven" as const,
        ...(pageKind ? { fetchedPageKind: pageKind } : {}),
      };
    }
    const structured = scope.status === "owned" ? scope.structured : undefined;
    const structuredDetails = structured
      ? { ...structured, isOnline: false }
      : undefined;
    const details = scope.status === "owned"
      ? tryExtract(() => extractJobDetails(scope.text, new Date(), structured))
      : undefined;
    const pageText = scope.status === "owned" ? scope.text : undefined;
    const place = mergeOpportunityPlace(item.place, structured?.place);
    const roleKind =
      item.roleKind ??
      tryExtract(() =>
        classifyRoleKind(item.title, pageText ?? ""),
      );
    const visa = item.visa ?? (pageText
      ? tryExtract(() => extractVisaState(pageText, place?.country))
      : undefined);
    // B8-04 (round 8): pass the posting's own host so a structured/declared
    // candidate that is itself the page's site brand gets rejected, the same
    // guard jobweb.ts's ingestion-time parse already applies (B8-01/B8-02).
    let host: string | undefined;
    try {
      host = new URL(item.url).hostname.replace(/^www\./, "");
    } catch {
      host = undefined;
    }
    const employer = resolveEmployerIdentity({
      catalogLabel: item.company,
      structuredOrganizations: structured?.hiringOrganization,
      ownedTexts: [item.description, pageText].filter((text): text is string => Boolean(text)),
      host,
    });
    const company = employer.status === "ambiguous"
      ? undefined
      : employer.status === "none"
        ? item.company
        : employer.company;
    // B18-02: this line returned a bare `item` as shipped, which would
    // SILENTLY DISCARD the repair on any posting whose page yielded no other
    // new signal and no new company. Carrying the title here is defensive, and
    // C RECORDS THE MEASURED CAVEAT RATHER THAN OVERSTATING THE COVERAGE: as
    // the code stands today this branch is UNREACHABLE. `pageText` is
    // `scope.text` whenever the scope is owned, and `resolveJobPostingScope`
    // only ever returns `owned` with a non-empty `text` (both of its
    // construction sites guard on it), so `hasExtractedJobSignal` is always
    // true by the time control reaches here and the `&&` short-circuits.
    // Verified by execution, not by reading: replacing this return with a
    // `throw` never fired across the whole 1311-test `src/lib/` suite. So NO
    // TEST CAN COVER THIS LINE — it is kept because it is correct if
    // `hasExtractedJobSignal`'s contract ever changes, not because a red test
    // protects it. Of the four return paths, `if (!html) return item;` above is
    // the one that deliberately does NOT carry a repair: no page was fetched,
    // so there is no witness.
    if (!hasExtractedJobSignal(structuredDetails, details, visa, pageText) && company === item.company) {
      return { ...item, title, ...(pageKind ? { fetchedPageKind: pageKind } : {}) };
    }
    return {
      ...item,
      title,
      ...(pageKind ? { fetchedPageKind: pageKind } : {}),
      place,
      location: formatOpportunityPlace(place) || item.location,
      // Web-discovered postings arrive with no date at all, which left the
      // jobs month facet permanently empty. schema.org JobPosting carries
      // datePosted; use it when the source gave us nothing.
      postedAt: item.postedAt || structured?.datePosted,
      applicationDeadline:
        item.applicationDeadline ?? details?.applicationDeadline,
      startDate: item.startDate ?? details?.startDate,
      startDateFlexible: item.startDateFlexible ?? details?.startDateFlexible,
      contractLength: item.contractLength ?? details?.contractLength,
      applicationMaterials:
        item.applicationMaterials ?? details?.applicationMaterials,
      // B4-11. JSON-LD JobPosting.baseSalary/employmentType, extracted
      // upstream in extractJobDetails alongside every other field this merge
      // already prefers-existing-then-falls-back-to. Adzuna/USAJobs already
      // populate these four from their own structured fields before
      // enrichment runs, so `item.X ?? details?.X` only ever fills a gap a
      // source left empty -- it cannot overwrite a real value with a worse
      // one, and the four always arrive together or not at all on either
      // side (see B4-11's own note on normalizeSalary's all-or-nothing
      // return).
      salaryMin: item.salaryMin ?? details?.salary?.min,
      salaryMax: item.salaryMax ?? details?.salary?.max,
      salaryCurrency: item.salaryCurrency ?? details?.salary?.currency,
      salaryPeriod: item.salaryPeriod ?? details?.salary?.period,
      employmentType: item.employmentType ?? details?.employmentType,
      // B4-11. Free-text hybrid/on-site signal from the fetched page;
      // scoredJobToJob() prefers this over its own cheap location-string
      // check when present (mapper.ts's jobWorkMode).
      workMode: item.workMode ?? details?.workMode,
      roleKind,
      visa,
      company,
      // B6-07: retain full furniture-stripped text separately so only the
      // report summary upgrades; scoring continues to use source snippets.
      pageText: item.pageText ?? pageText,
      fetchedPostingScope: scope.status,
      // A web page being "online" does not prove that a job is remote.
      isRemote: item.isRemote,
    };
  });

  return [...enriched, ...items.slice(cappedLength)];
}
