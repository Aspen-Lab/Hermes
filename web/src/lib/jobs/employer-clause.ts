/**
 * A26-01 / ROUND 26 C, item 1 — **THE REDUNDANT ` at <Employer>` CLAUSE.**
 *
 * Round 26 A measured a card whose title read `Internship, Battery Engineering
 * (Summer 2026) at Tesla` directly above a subtitle reading `Tesla`: the reader
 * is told the employer twice, on two adjacent lines. Round 26 B then corrected
 * the MECHANISM by execution, and the correction is why this module exists at
 * all rather than a patch at ingestion:
 *
 * **THE BUILD NEVER STRIPS AN ` at <Employer>` CLAUSE. IT ONLY EVER AMPUTATES
 * ONE.** There is exactly one title rule in the whole job path
 * (`jobweb.ts:1253-1263`): the rendered title is the provider's title up to its
 * first chrome separator (`-`, `–`, `—`, `|`, `·`). So a clause survives if and
 * only if it lies BEFORE that separator. `Battery Engineer at Acme Labs -
 * JobBoard` keeps the clause; `Battery Engineer - Summer 2027 at Acme Labs |
 * Intern Insider` loses it. **The hosts do not diverge — the provider's
 * punctuation does**, which is why A's reading ("`magnet.me` strips the same
 * shape") does not hold: fed A's own recorded `magnet.me` `<title>`, the
 * shipped mapper KEEPS the tail. It was never offered a clause to strip.
 *
 * B swept the live offered corpus — 112 offered rows, union 96, 43 rendered —
 * and found **THREE hosts stating the employer twice, not one**: `ev.careers`,
 * `grad.wisc.edu` and `careers.jnj.com`. A26-01 is a CLASS, not a quirk, and
 * this rule is written for the class.
 *
 * **WHY IT IS A REDUNDANCY TEST AND NOT A PROVENANCE TEST.** Keying the strip
 * on "the title clause is the candidate that WON the employer slot" is knowable
 * at ingestion and is rejected: it is unavailable here, it needs the guard chain
 * restructured, and it is not what the defect is. The defect is that the reader
 * sees the same employer twice on two consecutive lines — which is true however
 * that employer was derived. **So the test reads the duplication, not its
 * history.** The strip can only ever remove a substring the adjacent field
 * provably repeats; it can never invent one, and it never touches the employer
 * field.
 *
 * **WHY THE MAPPER AND NOT INGESTION** (both reasons measured from source, not
 * stylistic):
 *  1. **Enrichment can put the clause back.** `enrich.ts:215-239`'s
 *     `extendFromPageTitle` / `extendTruncatedTitle` REPLACE a `…`-truncated
 *     provider title with the page's own `<title>` — precisely the string shape
 *     that carries ` at <Employer> | Brand`. An ingestion-time strip runs
 *     before enrichment and would be silently undone.
 *  2. **Coverage.** `titleEmployer` exists only on the `jobweb` source; the
 *     other six sources set `company` from structured provider fields, so an
 *     ingestion fix cannot reach them at all.
 *
 * `mapper.ts` is the one place holding the FINAL title and the FINAL company for
 * EVERY source, and it runs after `enrichJobCandidates`. Following round 25 C's
 * own precedent (`./remote-claim`), the rule lives in a small shared module so a
 * test can lock the invariant directly rather than through a component. This
 * file's imports are zero, so its cycle risk is zero.
 *
 * **WHAT THIS IS NOT.** It is not an employer-field edit: it READS `company` and
 * never writes it. **62d(a)'s parenthetical path and the employer guard chain
 * are NOT reopened** — 62d(a) is correct for a third round.
 *
 * **THE ORDERING CONSTRAINT AT THE CALL SITE IS LOAD-BEARING.** `mapper.ts:161`
 * passes `roleTitle` into `summarizeJob(...)` as its title-echo check, and
 * `mapper.ts:132`'s comment records that ordering as deliberately established in
 * B5-07/R4. **The stripped value must NOT be substituted before that call** —
 * the echo check compares against page prose that may legitimately contain the
 * employer, and shortening its input would weaken a check nobody asked to
 * weaken. **Strip at the FIELD; leave `roleTitle` itself untouched.**
 *
 * **BLAST RADIUS, MEASURED BY B ON THE LIVE CORPUS: 3 of 43 rendered titles
 * change, 40 unchanged, zero collateral.** `company === undefined` is the common
 * case — 40 of 43 — and every one of those returns byte-identical. There is no
 * empty state to design: one output shape (a shorter title) and one fallback
 * (the input, unchanged). It never renders a placeholder and never invents a
 * word.
 */
export function stripRedundantEmployerClause(
  roleTitle: string,
  company: string | undefined,
): string {
  const employer = company?.trim();
  if (!employer) return roleTitle;
  // END-ANCHORED ON PURPOSE: a mid-title `at X` is far more often a qualifier
  // or a place than a redundant employer statement. The employer is escaped
  // because real names carry regex metacharacters — `C.H. Robinson`,
  // `Acme (US) Inc.`.
  //
  // **`\s+` AND `\b` ARE REDUNDANT WITH EACH OTHER AND C MEASURED IT RATHER
  // THAN ASSUMING A LOCK FOR EACH.** Both exist to stop a word merely ENDING in
  // "at" ("Battery Engineer format Tesla") being read as the preposition, and
  // EITHER ONE ALONE is sufficient: removing `\s+` keeps the suite green,
  // removing `\b` keeps the suite green, and only removing BOTH turns that case
  // red. So neither carries a uniquely-red case, and the test says so instead
  // of implying two independent guards. Both are kept — this is B's executed
  // design, they cost nothing, and each states the intent from a different
  // direction — but a later round should not cite either as load-bearing on its
  // own. (`\s+` does bound the shape slightly harder: `\bat` alone would also
  // fire after a non-word character, e.g. `Battery Engineer/at Tesla`.)
  const clause = new RegExp(`\\s+\\bat\\s+${escapeRegExp(employer)}\\s*$`);
  const stripped = roleTitle.replace(clause, "").trim();
  // Stripping must never empty the title: when the clause IS the whole title
  // the original is kept, because a blank card line is worse than a repeated
  // word.
  return stripped ? stripped : roleTitle;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
