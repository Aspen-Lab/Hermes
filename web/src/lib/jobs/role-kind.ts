import type { RoleKind } from "@/types";

export const INTERN_RE =
  /\b(intern(ship)?|phd student|student researcher|working student)\b/i;
export const PHD_POSITION_RE =
  /\b(phd (position|candidate|fellowship)|doctoral)\b/i;
export const POSTDOC_RE = /\b(post[- ]?doc(toral)?|research fellow)\b/i;
export const RESEARCH_SCIENTIST_RE =
  /\b(research (scientist|engineer)|applied scientist|member of technical staff|researcher)\b/i;
export const FACULTY_RE =
  /\b(professor|faculty|lecturer|tenure[- ]track)\b/i;

const ROLE_PATTERNS: readonly [RoleKind, RegExp][] = [
  ["internship", INTERN_RE],
  ["phd-position", PHD_POSITION_RE],
  ["postdoc", POSTDOC_RE],
  // Prefer a specific faculty title over the broader "researcher" staff signal.
  ["faculty", FACULTY_RE],
  ["staff", RESEARCH_SCIENTIST_RE],
];

function classifyText(text: string): RoleKind | undefined {
  return ROLE_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0];
}

/**
 * Classify from the role title first. Description text is only a fallback so
 * incidental mentions of colleagues or eligibility do not override the role's
 * own name.
 */
export function classifyRoleKind(
  title: string,
  description = "",
): RoleKind | undefined {
  return classifyText(title) ?? classifyText(description);
}
