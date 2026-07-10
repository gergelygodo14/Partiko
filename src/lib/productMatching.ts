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

export type ProductCandidate = { id: string; name: string };

const MAX_MATCH_DISTANCE_RATIO = 0.25;

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

    const distance = levenshtein(normTarget, normCandidate);
    const maxLen = Math.max(normTarget.length, normCandidate.length);
    const ratio = distance / maxLen;
    if (ratio < bestRatio) {
      bestRatio = ratio;
      best = candidate;
    }
  }

  return best && bestRatio <= MAX_MATCH_DISTANCE_RATIO ? best : null;
}
