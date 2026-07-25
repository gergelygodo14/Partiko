const COMBINING_MARKS_RE = new RegExp("[\\u0300-\\u036f]", "g");

export function normalizeProductName(name: string): string {
  return name
    .normalize("NFD")
    .replace(COMBINING_MARKS_RE, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[rows - 1][cols - 1];
}

// Min edit distance of `shorter` against ANY substring of `longer` (free start
// AND end position within `longer` - a classic "approximate substring search"
// DP: seed row 0 with zeros instead of 0..m, then read the minimum off the
// last row instead of the single bottom-right cell).
function partialDistance(shorter: string, longer: string): number {
  const rows = shorter.length + 1;
  const cols = longer.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i <= shorter.length; i++) dp[i][0] = i;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = shorter[i - 1] === longer[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return Math.min(...dp[shorter.length]);
}

export type ProductCandidate = { id: string; name: string };

const MAX_MATCH_DISTANCE_RATIO = 0.25;

// A real paper-invoice OCR reading is often a short, human-abbreviated
// description (e.g. "GYF. Hamburger zsemle szezámmaggal szórt 125 mm 82 g"),
// while the catalog name it should match was created from a much longer,
// verbose wholesale price-list SKU string (brand, pack size, SKU code
// appended). Comparing them as whole strings makes the ratio blow up purely
// because of the length gap, not because they're actually different
// products - findBestProductMatch would return null and a new PENDING
// product had to be created and manually re-merged every single time this
// same real item showed up on a new invoice. When the shorter name is
// meaningfully shorter, match it against its best-aligned substring of the
// longer name instead of the whole thing.
const PARTIAL_MATCH_LENGTH_RATIO_GATE = 0.8;
const PARTIAL_MATCH_MIN_LENGTH = 15;

function matchRatio(normTarget: string, normCandidate: string): number {
  const [shorter, longer] =
    normTarget.length <= normCandidate.length ? [normTarget, normCandidate] : [normCandidate, normTarget];

  if (shorter.length >= PARTIAL_MATCH_MIN_LENGTH && shorter.length / longer.length < PARTIAL_MATCH_LENGTH_RATIO_GATE) {
    return partialDistance(shorter, longer) / shorter.length;
  }

  const distance = levenshtein(normTarget, normCandidate);
  return distance / Math.max(normTarget.length, normCandidate.length);
}

export function findBestProductMatch(
  name: string,
  candidates: ProductCandidate[]
): ProductCandidate | null {
  const normTarget = normalizeProductName(name);
  if (!normTarget) return null;

  let best: ProductCandidate | null = null;
  let bestRatio = Infinity;

  for (const candidate of candidates) {
    const normCandidate = normalizeProductName(candidate.name);
    if (!normCandidate) continue;
    if (normCandidate === normTarget) return candidate;

    const ratio = matchRatio(normTarget, normCandidate);
    if (ratio < bestRatio) {
      bestRatio = ratio;
      best = candidate;
    }
  }

  return best && bestRatio <= MAX_MATCH_DISTANCE_RATIO ? best : null;
}
