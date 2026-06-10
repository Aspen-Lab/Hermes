// Curated list of common research affiliations — universities, plus the
// industry research labs Peer users tend to come from. Used by the
// SchoolAutocomplete dropdown in /profile. Not exhaustive on purpose:
// the goal is fast match-on-typing for the obvious 80%, with free-text
// fallback for anything not in the list. ~200 entries is a fine ceiling
// for client-side fuzzy filter.

export const COMMON_AFFILIATIONS: readonly string[] = [
  // ── US: top research universities ─────────────────────────────
  "MIT",
  "Stanford University",
  "Carnegie Mellon University",
  "UC Berkeley",
  "Harvard University",
  "Princeton University",
  "Yale University",
  "Columbia University",
  "Cornell University",
  "Caltech",
  "Georgia Tech",
  "University of Michigan",
  "UCLA",
  "UC San Diego",
  "University of Washington",
  "UIUC",
  "UT Austin",
  "University of Pennsylvania",
  "NYU",
  "Northwestern University",
  "Brown University",
  "Duke University",
  "Johns Hopkins University",
  "Rice University",
  "University of Chicago",
  "USC",
  "UMass Amherst",
  "Purdue University",
  "Virginia Tech",
  "Penn State",
  "Ohio State University",
  "University of Wisconsin–Madison",
  "University of Minnesota",
  "University of Maryland",
  "UC Santa Barbara",
  "UC Davis",
  "UC Irvine",
  "University of Notre Dame",
  "Vanderbilt University",
  "Boston University",

  // ── UK ────────────────────────────────────────────────────────
  "University of Oxford",
  "University of Cambridge",
  "Imperial College London",
  "UCL",
  "King's College London",
  "University of Edinburgh",
  "University of Manchester",
  "University of Bristol",
  "University of Warwick",
  "Queen Mary University of London",

  // ── Canada ────────────────────────────────────────────────────
  "University of Toronto",
  "McGill University",
  "UBC",
  "University of Waterloo",
  "Université de Montréal",
  "MILA",
  "Vector Institute",

  // ── Continental Europe ────────────────────────────────────────
  "ETH Zürich",
  "EPFL",
  "TU München",
  "TU Berlin",
  "Max Planck Institute",
  "INRIA",
  "École Polytechnique",
  "Université PSL",
  "KU Leuven",
  "TU Delft",
  "Utrecht University",
  "University of Amsterdam",
  "KTH Royal Institute of Technology",
  "Aalto University",
  "Karolinska Institute",
  "University of Copenhagen",
  "ETH AI Center",
  "Technion",
  "Tel Aviv University",
  "Hebrew University of Jerusalem",

  // ── Asia ──────────────────────────────────────────────────────
  "Tsinghua University",
  "Peking University",
  "Shanghai Jiao Tong University",
  "Fudan University",
  "Zhejiang University",
  "USTC",
  "Hong Kong University of Science and Technology",
  "University of Hong Kong",
  "Chinese University of Hong Kong",
  "National University of Singapore",
  "Nanyang Technological University",
  "University of Tokyo",
  "Kyoto University",
  "RIKEN",
  "Seoul National University",
  "KAIST",
  "POSTECH",
  "IIT Bombay",
  "IIT Delhi",
  "IISc Bangalore",

  // ── Australia / NZ ────────────────────────────────────────────
  "University of Melbourne",
  "University of Sydney",
  "ANU",
  "UNSW",
  "Monash University",
  "University of Auckland",

  // ── Industry research labs ────────────────────────────────────
  "Anthropic",
  "OpenAI",
  "Google DeepMind",
  "Google Research",
  "Microsoft Research",
  "Meta AI (FAIR)",
  "Apple",
  "NVIDIA Research",
  "Allen Institute for AI (AI2)",
  "Hugging Face",
  "Cohere",
  "Mistral AI",
  "xAI",
  "IBM Research",
  "Adobe Research",
  "Salesforce Research",
  "Amazon Science",
  "Tencent AI Lab",
  "Alibaba DAMO Academy",
  "ByteDance Research",
  "Baidu Research",
  "Bell Labs",
  "Toyota Research Institute",
  "Honda Research Institute",
  "Bosch AI",
  "Sony AI",
  "Samsung Research",
  "Huawei Noah's Ark Lab",

  // ── Other / cross-cutting ─────────────────────────────────────
  "Independent researcher",
  "Self-employed",
] as const;

/**
 * Case-insensitive substring filter for autocomplete. Returns up to `limit`
 * matches. Empty query returns the first `limit` entries (popular by virtue
 * of order in COMMON_AFFILIATIONS).
 */
export function matchAffiliations(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return COMMON_AFFILIATIONS.slice(0, limit);
  const out: string[] = [];
  for (const a of COMMON_AFFILIATIONS) {
    if (a.toLowerCase().includes(q)) {
      out.push(a);
      if (out.length >= limit) break;
    }
  }
  return out;
}
