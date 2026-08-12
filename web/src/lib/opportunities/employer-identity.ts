import { cleanJobSubtitlePart } from "./job-cleanup";

export type EmployerIdentityResolution =
  | { status: "structured"; company: string }
  | { status: "declared"; company: string }
  | { status: "none" }
  | { status: "ambiguous" };

export interface EmployerIdentityEvidence {
  /** A source adapter's existing label; it is deliberately only a fallback. */
  catalogLabel?: string;
  /** Retained only from the selected JobPosting record. */
  structuredOrganizations?: string | readonly string[];
  /** Text already owned by the selected source record or posting scope. */
  ownedTexts?: readonly string[];
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
 * Resolves employer identity only from explicitly owned evidence. Callers keep
 * their catalog label when this returns `none`; ambiguity intentionally has no
 * fallback because a competing high-tier identity would otherwise be a lie.
 */
export function resolveEmployerIdentity(
  evidence: EmployerIdentityEvidence,
): EmployerIdentityResolution {
  const structuredValues = Array.isArray(evidence.structuredOrganizations)
    ? evidence.structuredOrganizations
    : evidence.structuredOrganizations ? [evidence.structuredOrganizations] : [];
  const structured = uniqueNames(structuredValues);
  const declared = uniqueNames((evidence.ownedTexts ?? []).flatMap(directDeclarations));

  if (structured.length > 1 || declared.length > 1) return { status: "ambiguous" };
  if (structured[0] && declared[0] && normalized(structured[0]) !== normalized(declared[0])) {
    return { status: "ambiguous" };
  }
  if (structured[0]) return { status: "structured", company: structured[0] };
  if (declared[0]) return { status: "declared", company: declared[0] };
  return { status: "none" };
}
