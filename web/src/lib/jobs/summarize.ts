const MIN_SENTENCE_LENGTH = 40;
const MAX_SENTENCE_LENGTH = 300;
const MAX_SUMMARY_LENGTH = 240;

const NOISE_RE =
  /\b(equal opportunit|affirmative action|without regard to|does not discriminate|reasonable accommodation|protected veteran|benefits? (?:include|package)|health insurance|dental insurance|401\(k\)|how to apply|apply (?:now|today)|submit(?:ting)? (?:your|an) application|application instructions|about us|our history|founded in)\b/i;

const SECTION_RE =
  /^(?:key )?(?:responsibilities|requirements|qualifications|what you(?:'|’)ll do|the role|role overview)\b/i;

const ROLE_RE =
  /\b(?:in this role|you will|you(?:'|’)ll|responsible for|we(?:'|’)re hiring|develop|design|build|research|analy[sz]e|lead|manage)\b/i;

type ScoredSentence = {
  index: number;
  score: number;
  text: string;
};

function splitSentences(description: string): string[] {
  return (description.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [])
    .map((sentence) => sentence.replace(/^#+\s*/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function termMatches(sentence: string, term: string): boolean {
  return sentence.toLocaleLowerCase().includes(term.trim().toLocaleLowerCase());
}

function scoreSentences(description: string, matchedKeywords: string[]): ScoredSentence[] {
  const terms = matchedKeywords.map((term) => term.trim()).filter(Boolean);

  return splitSentences(description)
    .map((text, index): ScoredSentence | null => {
      if (
        text.length < MIN_SENTENCE_LENGTH ||
        text.length > MAX_SENTENCE_LENGTH ||
        NOISE_RE.test(text)
      ) {
        return null;
      }

      const matchedCount = terms.filter((term) => termMatches(text, term)).length;
      const positionScore = Math.max(0, 3 - index * 0.25);
      const sectionScore = SECTION_RE.test(text) ? 4 : 0;
      const roleScore = ROLE_RE.test(text) ? 2 : 0;
      const readableLengthScore = text.length >= 60 && text.length <= 180 ? 1 : 0;

      return {
        index,
        text,
        score: matchedCount * 6 + positionScore + sectionScore + roleScore + readableLengthScore,
      };
    })
    .filter((sentence): sentence is ScoredSentence => sentence !== null);
}

function bestCombination(sentences: ScoredSentence[]): ScoredSentence[] {
  const candidates = [...sentences].sort((a, b) => b.score - a.score).slice(0, 8);
  let best: ScoredSentence[] = [];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let mask = 1; mask < 1 << candidates.length; mask += 1) {
    const selected = candidates.filter((_, index) => (mask & (1 << index)) !== 0);
    if (selected.length > 3) continue;

    const ordered = [...selected].sort((a, b) => a.index - b.index);
    const text = ordered.map((sentence) => sentence.text).join(" ");
    if (text.length > MAX_SUMMARY_LENGTH) continue;

    const score =
      ordered.reduce((total, sentence) => total + sentence.score, 0) +
      Math.min(ordered.length, 2) * 0.5;
    if (
      score > bestScore ||
      (score === bestScore && ordered.length > best.length) ||
      (score === bestScore && ordered.length === best.length && text.length < best.map((s) => s.text).join(" ").length)
    ) {
      best = ordered;
      bestScore = score;
    }
  }

  return best;
}

export function summarizeJob(
  description: string | null | undefined,
  matchedKeywords: string[] = [],
): string {
  if (!description?.trim()) return "";

  const selected = bestCombination(scoreSentences(description, matchedKeywords));
  return selected.map((sentence) => sentence.text).join(" ");
}
