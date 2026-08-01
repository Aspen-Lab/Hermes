const JOB_CALL_TO_ACTION_RE =
  /^(?:apply(?:\s+(?:now|today|here))?|learn\s+more|read\s+more|view(?:\s+(?:job|position|posting))?|see\s+(?:details|posting)|job\s+details)[.!]*$/i;

function stripUnbalancedBrackets(value: string): string {
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const opening = new Set(Object.keys(pairs));
  const closing = new Set(Object.values(pairs));
  const stack: Array<{ character: string; index: number }> = [];
  const remove = new Set<number>();

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (opening.has(character)) {
      stack.push({ character, index });
      continue;
    }
    if (!closing.has(character)) continue;
    const candidate = stack.at(-1);
    if (candidate && pairs[candidate.character] === character) {
      stack.pop();
    } else {
      remove.add(index);
    }
  }
  for (const unmatched of stack) remove.add(unmatched.index);

  return Array.from(value, (character, index) =>
    remove.has(index) ? "" : character,
  ).join("");
}

function cleanJobText(value: string | null | undefined): string {
  return stripUnbalancedBrackets(value ?? "")
    .replace(/^[\s\u2026.·•|/\\:;-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanJobTitle(value: string | null | undefined): string {
  return cleanJobText(value);
}

export function cleanJobSubtitlePart(
  value: string | null | undefined,
): string | undefined {
  const cleaned = cleanJobText(value);
  return cleaned && !JOB_CALL_TO_ACTION_RE.test(cleaned) ? cleaned : undefined;
}

export function cleanJobDescription(
  value: string | null | undefined,
): string {
  return cleanJobText(value);
}
