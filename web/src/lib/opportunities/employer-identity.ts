import { cleanJobSubtitlePart } from "./job-cleanup";
import { looksLikeHostBrand } from "./shared";

export type EmployerIdentityResolution =
  | { status: "structured"; company: string }
  | { status: "declared"; company: string }
  | { status: "catalog"; company: string }
  | { status: "none" }
  | { status: "ambiguous" };

export interface EmployerIdentityEvidence {
  /**
   * A source adapter's existing label. Lowest-priority tier: only used when
   * neither `structuredOrganizations` nor `ownedTexts` yields a candidate.
   * J1 (Phase 3 round 3, Ruling 120g item 1): before this item, this field
   * was accepted by the type and populated by both callers but never read
   * in the function body below — each caller re-implemented its own
   * unvalidated raw fallback instead, which is how Himalayas' own upstream
   * placeholder value `"name"` (see `isPlaceholderIdentityValue` below)
   * reached real job cards. Now it is routed through the SAME cleaning and
   * host-brand rejection the tiers above already get, plus the new
   * placeholder check, so it is validated rather than merely trusted.
   */
  catalogLabel?: string;
  /** Retained only from the selected JobPosting record. */
  structuredOrganizations?: string | readonly string[];
  /** Text already owned by the selected source record or posting scope. */
  ownedTexts?: readonly string[];
  /**
   * B8-04 (round 8): the selected posting's own host. Optional and additive
   * — every existing caller that omits it keeps today's exact behavior.
   * When present, a `structured`/`declared` candidate equal to the page's
   * own site brand (an ATS platform's templated "our team" blurb, or a
   * JSON-LD record inheriting the platform's own organization name) is
   * rejected the same way jobweb.ts's ingestion-time parse already protects
   * its own candidates with `looksLikeHostBrand` — neither tier here had
   * any shape/brand guard before this.
   */
  host?: string;
}

function normalized(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function uniqueNames(values: readonly string[]): string[] {
  const names = new Map<string, string>();
  for (const value of values) {
    const cleaned = cleanJobSubtitlePart(value);
    if (!cleaned) continue;
    const key = normalized(cleaned);
    if (key) names.set(key, cleaned);
  }
  return [...names.values()];
}

/**
 * J1 (Phase 3 round 3, Ruling 120g item 1): a closed, EXACT full-string-match
 * list of values that are themselves a form field's own generic label, not a
 * real company name — never a shape/length/casing heuristic.
 *
 * Measured live against Himalayas' own upstream API (Phase 3 round 2 B,
 * Deliverable 1): `companyName: "name"` appears verbatim on 20 of 200 sampled
 * real job records (10%), spanning 18 distinct real employers (Salesforce,
 * ServiceNow, Lockheed Martin among them) — a platform-side data defect, not
 * a per-employer anomaly. Ruling out a shape heuristic is load-bearing, not
 * theoretical: the SAME 200-row corpus also contains a real company styled as
 * a bare lowercase word (`companyName: "mercor"`), which any "short lowercase
 * single word" guess would have wrongly rejected.
 *
 * Only `"name"` ships. B named same-shape, unmeasured siblings (`company`,
 * `employer`, `organization`, `n/a`, `tbd`, …) explicitly as reasoned-by-
 * analogy, not observed this round; Ruling 120g's commission is explicit that
 * they are not to be added blind. A future census can confirm and promote
 * them one at a time.
 */
const PLACEHOLDER_IDENTITY_VALUES = new Set(["name"]);

function isPlaceholderIdentityValue(value: string): boolean {
  return PLACEHOLDER_IDENTITY_VALUES.has(normalized(value));
}

function directDeclarations(text: string): string[] {
  // The first paragraph/window is the only text an owned record may use for
  // identity. A later benefits mention is not a self-identification.
  const opening = text.split(/\n\s*\n/)[0]?.slice(0, 600) ?? "";
  const candidates: string[] = [];
  const declaration = /\bat\s+([^,.;:]{2,80}),\s*our\s+(?:people|employees|team)\b|\bwhen\s+you\s+join\s+([^,.;:]{2,80})[,.;:]/gi;
  for (const match of opening.matchAll(declaration)) {
    const candidate = match[1] ?? match[2];
    const cleaned = cleanJobSubtitlePart(candidate);
    if (!cleaned || !/^[\p{L}\p{N}][\p{L}\p{N}&' .-]{1,78}$/u.test(cleaned)) continue;
    if (/\b(?:our\s+client|client|partner|vendor|on\s+behalf\s+of|for)\b/i.test(cleaned)) continue;
    candidates.push(cleaned);
  }
  return candidates;
}

/**
 * Resolves employer identity, preferring explicitly owned evidence over the
 * source adapter's own catalog label; ambiguity intentionally has no fallback
 * because a competing high-tier identity would otherwise be a lie.
 *
 * J1 (Phase 3 round 3): `catalogLabel` is a real, lowest-priority tier, not a
 * caller-side afterthought — reached only when neither `structured` nor
 * `declared` has a candidate, cleaned and host-brand-checked the same as
 * those tiers, and additionally rejected when it is a closed-list placeholder
 * value (`isPlaceholderIdentityValue`). When `catalogLabel` is absent or
 * fails validation, `status` stays exactly `"none"`, unchanged from before
 * this item — a miss here can only remove a value, never invent one.
 */
export function resolveEmployerIdentity(
  evidence: EmployerIdentityEvidence,
): EmployerIdentityResolution {
  const structuredValues = Array.isArray(evidence.structuredOrganizations)
    ? evidence.structuredOrganizations
    : evidence.structuredOrganizations ? [evidence.structuredOrganizations] : [];
  // Reject a candidate that is itself the page's own host brand, on either
  // tier — no-op when no host was supplied, so this is purely additive.
  const isOwnHostBrand = (name: string) =>
    evidence.host ? looksLikeHostBrand(name, evidence.host) : false;
  const structured = uniqueNames(structuredValues).filter((name) => !isOwnHostBrand(name));
  const declared = uniqueNames((evidence.ownedTexts ?? []).flatMap(directDeclarations)).filter(
    (name) => !isOwnHostBrand(name),
  );

  if (structured.length > 1 || declared.length > 1) return { status: "ambiguous" };
  if (structured[0] && declared[0] && normalized(structured[0]) !== normalized(declared[0])) {
    return { status: "ambiguous" };
  }
  if (structured[0]) return { status: "structured", company: structured[0] };
  if (declared[0]) return { status: "declared", company: declared[0] };

  const catalog = cleanJobSubtitlePart(evidence.catalogLabel);
  if (catalog && !isOwnHostBrand(catalog) && !isPlaceholderIdentityValue(catalog)) {
    return { status: "catalog", company: catalog };
  }
  return { status: "none" };
}
