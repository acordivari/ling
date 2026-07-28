// compare.js — distances between two analysed clips.
//
// Deliberately kept to a few interpretable numbers rather than one opaque
// score. The rhythm distance is duration-invariant by construction, so it
// answers "is this the same shape?" independent of "is this the same tempo?".

// Dynamic time warping over scalar sequences. Returns the alignment path so
// the UI can draw which interval matched which.
export function dtw(a, b) {
  if (!a.length || !b.length) return { distance: Infinity, path: [], normalized: Infinity };
  const n = a.length, m = b.length;
  const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(Infinity));
  D[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = Math.abs(a[i - 1] - b[j - 1]);
      D[i][j] = cost + Math.min(D[i - 1][j], D[i][j - 1], D[i - 1][j - 1]);
    }
  }
  // backtrace
  const path = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    path.push([i - 1, j - 1]);
    const opts = [D[i - 1][j - 1], D[i - 1][j], D[i][j - 1]];
    const k = opts.indexOf(Math.min(...opts));
    if (k === 0) { i--; j--; } else if (k === 1) { i--; } else { j--; }
  }
  path.reverse();
  return { distance: D[n][m], path, normalized: D[n][m] / path.length };
}

// Cosine distance rescaled to [0,1]. The mel vectors are mean-centred, so
// cosine similarity genuinely spans [-1,1] and the raw distance spans [0,2];
// halving keeps 0 = identical, 0.5 = uncorrelated, 1 = opposite spectral tilt.
export function cosineDistance(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0.5;
  return (1 - dot / (Math.sqrt(na) * Math.sqrt(nb))) / 2;
}

// Log-ratio of click rates. 0 = identical tempo, 1 = ~2.7x apart.
function tempoDistance(fa, fb) {
  if (!(fa.rate > 0) || !(fb.rate > 0)) return null;
  return Math.abs(Math.log(fa.rate / fb.rate));
}

export function compare(fa, fb) {
  const rhythm = dtw(fa.iciNorm, fb.iciNorm);
  const timbre = cosineDistance(fa.mel, fb.mel);
  const tempo = tempoDistance(fa, fb);
  const regularity = Math.abs(fa.cvIci - fb.cvIci);
  const density = Math.abs((fa.nClicks || 0) - (fb.nClicks || 0));

  return {
    rhythm: rhythm.normalized,
    rhythmPath: rhythm.path,
    timbre,
    tempo,
    regularity,
    density,
    // Composite is shown with its weights visible in the UI. It exists to give
    // an ordering, not because the weighting is principled.
    composite: 0.5 * Math.min(1, rhythm.normalized * 4) + 0.3 * timbre +
               0.2 * Math.min(1, (tempo ?? 1) / 2),
  };
}

// Nearest coda type by duration-invariant rhythm. This is the miniature
// version of the structure-vs-timbre probe: if an arbitrary rhythm snaps
// cleanly onto a canonical coda shape, that tells you the shape space is
// coarse, not that the model did anything.
export function nearestCoda(iciNorm, inventory, k = 3) {
  if (!iciNorm.length) return [];
  return inventory
    .map((c) => ({ coda: c, d: dtw(iciNorm, c.iciNorm).normalized }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k);
}

// Rough verbal bucket. Thresholds are eyeballed from the synthetic library and
// are there to make the numbers legible, not to assert significance.
export function describeRhythm(d) {
  if (d < 0.02) return "near-identical shape";
  if (d < 0.05) return "closely matching shape";
  if (d < 0.10) return "loosely similar shape";
  if (d < 0.20) return "different shape";
  return "unrelated shape";
}

export function describeTimbre(d) {
  if (d < 0.05) return "near-identical spectrum";
  if (d < 0.20) return "similar spectrum";
  if (d < 0.45) return "different spectrum";
  return "opposed spectral tilt";
}
