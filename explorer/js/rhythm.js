// rhythm.js — rhythm statistics and null models over inter-onset intervals.
//
// Everything here is a pure function over plain arrays or typed arrays. No DOM,
// no audio, no I/O — so it runs identically in the browser and under `node` in
// the test suite, and the same code path produces the numbers the UI shows and
// the numbers the tests assert.
//
// The design principle, learned the hard way on this dataset:
//
//   A distance without a null model is decoration, and a p-value without an
//   effect size is worse than nothing.
//
// Worked example that motivated `explainedByNull` below. Sperm whale clans EC1
// and EC2 have visibly different mean rhythms — centroid separation 0.1287 in
// standardised-ICI space. Shuffle the clan labels and the null separation is
// 0.0030, so p < 0.0005 and the effect looks enormous. But EC1 is 65% type
// `1+1+3` and EC2 is 98% type `5R3`: the clans mostly differ in WHICH codas they
// use. Permute the labels *within* coda type and the null mean is 0.1274 — 99.0%
// of the observed separation. The honest statement is not "clans differ,
// p<0.001" but "99.0% of this is repertoire composition; the residual is 1.0%
// and rests on crossover cells of n=15 and n=19".
//
// Both permutations return p < 0.0005. Only `explainedByNull` tells them apart.
//
// IMPORTANT — `explainedByNull` is nullMean/observed, which silently assumes
// that "no effect" means "statistic near zero". That holds for a DISTANCE
// (two identical groups have separation 0) and fails completely for a SHIFT
// (mean nPVI under a null is ~62, not 0). Applied to a shift statistic the
// ratio exceeds 1 and reads as "the null explains everything" when the true
// finding may be a huge effect in the opposite direction. So every test must
// declare its `kind`, and `explainedByNull` is only computed for distances.
//
//   kind: "distance"  natural zero at no-effect; one-sided, larger = stronger.
//                     e.g. centroid separation, |mean difference|.
//   kind: "shift"     no natural zero; two-sided. The observed value can sit
//                     far BELOW the null, which is a finding, not a null result.
//                     e.g. mean nPVI, mean CV.

import { makeRng } from "./random.js";

export const KINDS = ["distance", "shift"];

function summarise(observed, dist, iterations, kind) {
  // Guard rather than document. Passing an unrecognised kind would silently fall
  // through to the shift branch and suppress explainedByNull on a distance
  // statistic — a wrong answer that looks like a deliberate one.
  if (!KINDS.includes(kind)) {
    throw new Error(`unknown statistic kind '${kind}'; expected one of ${KINDS.join(", ")}`);
  }
  const sorted = Float64Array.from(dist).sort();
  let mean = 0;
  for (let i = 0; i < iterations; i++) mean += dist[i];
  mean /= iterations;
  let v = 0;
  for (let i = 0; i < iterations; i++) { const d = dist[i] - mean; v += d * d; }
  const sd = Math.sqrt(v / iterations);

  let ge = 0, le = 0;
  for (let i = 0; i < iterations; i++) {
    if (dist[i] >= observed) ge++;
    if (dist[i] <= observed) le++;
  }
  const pGreater = (ge + 1) / (iterations + 1);
  const pLess = (le + 1) / (iterations + 1);

  return {
    observed, nullMean: mean, nullSd: sd,
    nullMin: sorted[0], nullMax: sorted[iterations - 1],
    nullDist: sorted, iterations, kind,
    nullQuantile: (q) => sorted[Math.min(iterations - 1, Math.max(0, Math.floor(q * iterations)))],

    pGreater, pLess,
    // distance statistics are one-sided (only "larger than null" is a finding);
    // shift statistics are two-sided.
    p: kind === "distance" ? pGreater : Math.min(1, 2 * Math.min(pGreater, pLess)),

    z: sd > 0 ? (observed - mean) / sd : NaN,
    direction: observed >= mean ? "above" : "below",
    residual: observed - mean,

    // Only meaningful when no-effect implies statistic ~= 0. Null otherwise, so
    // downstream code cannot accidentally interpret a shift as a proportion.
    explainedByNull: kind === "distance" && observed !== 0 ? mean / observed : null,
    residualFraction: kind === "distance" && observed !== 0 ? (observed - mean) / observed : null,
  };
}

// ---------------------------------------------------------------- statistics

/**
 * Normalised Pairwise Variability Index (Grabe & Low; Patel & Daniele 2003).
 * Mean absolute difference between adjacent intervals, each normalised by that
 * pair's own mean, times 100. Tempo-invariant by construction: scaling every
 * interval leaves nPVI unchanged.
 *
 * 0 = perfectly isochronous. ~66.7 = strict 2:1 alternation. ~100 = 3:1.
 * Returns NaN for fewer than 2 intervals, where it is undefined rather than 0.
 */
export function npvi(iois) {
  const n = iois.length;
  if (n < 2) return NaN;
  let acc = 0;
  for (let i = 0; i < n - 1; i++) {
    const a = iois[i], b = iois[i + 1];
    acc += Math.abs(a - b) / ((a + b) / 2);
  }
  return (100 * acc) / (n - 1);
}

/** Coefficient of variation. Unlike nPVI this is order-blind. */
export function cv(iois) {
  const n = iois.length;
  if (n < 2) return NaN;
  let m = 0;
  for (let i = 0; i < n; i++) m += iois[i];
  m /= n;
  if (m <= 0) return NaN;
  let v = 0;
  for (let i = 0; i < n; i++) { const d = iois[i] - m; v += d * d; }
  return Math.sqrt(v / n) / m;
}

/**
 * Rhythm ratios r_k = ioi_k / (ioi_k + ioi_{k+1}), the coordinate used by
 * Roeske et al. 2020 to look for categorical rhythm in birdsong and human
 * music. 0.5 is 1:1 isochrony, 1/3 is 1:2, 2/3 is 2:1.
 */
export function rhythmRatios(iois) {
  const out = [];
  for (let i = 0; i < iois.length - 1; i++) {
    const a = iois[i], b = iois[i + 1];
    out.push(a / (a + b));
  }
  return out;
}

/**
 * Sharma et al.'s "standardised absolute ICI": each interval divided by the
 * total, so the vector sums to 1. Keeps rhythm, discards tempo. This is the
 * same normalisation the explorer already calls `iciNorm`.
 */
export function standardise(iois) {
  let s = 0;
  for (let i = 0; i < iois.length; i++) s += iois[i];
  if (s <= 0) return Array.from(iois, () => 0);
  return Array.from(iois, (v) => v / s);
}

/** Mean of a set of equal-length standardised vectors. */
export function centroid(vectors) {
  if (!vectors.length) return [];
  const d = vectors[0].length;
  const out = new Float64Array(d);
  for (const v of vectors) for (let i = 0; i < d; i++) out[i] += v[i];
  for (let i = 0; i < d; i++) out[i] /= vectors.length;
  return Array.from(out);
}

export function euclidean(a, b) {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

// --------------------------------------------------------------- null models

/**
 * Residualise each item against the mean of its own stratum, and report how
 * much data actually informs a WITHIN-stratum comparison.
 *
 * Subtracting the stratum mean removes between-stratum variation entirely, so a
 * statistic computed on the residuals cannot be driven by composition — by
 * WHICH strata each group occupies. Only within-stratum differences survive.
 * Residuals depend on `strata` alone and never on `labels`, so this is done once
 * before permuting rather than inside the loop.
 *
 * `leverage` is the effective sample size for the contrast:
 *
 *     leverage = SUM over strata of  (nA * nB) / (nA + nB)
 *
 * A stratum holding only one label contributes nothing — there is no
 * within-stratum comparison to make — which is why the raw item count badly
 * overstates what a joint test can see. On the Dominica corpus this evaluates to
 * 33.3 codas out of 6,038, against the 8,112 rows a naive reading would assume.
 * Experiment 01 established that a joint-null p-value is uninterpretable without
 * it: p = 0.9630 there came from a design that ranked 1 of 66 in sensitivity on
 * precisely the split under test, 17.7x below the median. Reported beside every
 * joint result for that reason.
 */
function residualiseWithinStrata(items, labels, strata) {
  const n = items.length;
  const byStratum = new Map();
  for (let i = 0; i < n; i++) {
    const k = strata[i];
    if (!byStratum.has(k)) byStratum.set(k, []);
    byStratum.get(k).push(i);
  }

  const vector = Array.isArray(items[0]);
  const dim = vector ? items[0].length : 0;
  if (vector) {
    for (let i = 0; i < n; i++) {
      if (!Array.isArray(items[i]) || items[i].length !== dim) {
        throw new Error("joint strata x clusters needs items of equal length to residualise");
      }
    }
  }

  const residuals = new Array(n);
  let leverage = 0;
  let informative = 0;

  for (const idx of byStratum.values()) {
    if (vector) {
      const m = new Array(dim).fill(0);
      for (const i of idx) for (let j = 0; j < dim; j++) m[j] += items[i][j];
      for (let j = 0; j < dim; j++) m[j] /= idx.length;
      for (const i of idx) residuals[i] = items[i].map((v, j) => v - m[j]);
    } else {
      let m = 0;
      for (const i of idx) m += items[i];
      m /= idx.length;
      for (const i of idx) residuals[i] = items[i] - m;
    }

    const counts = new Map();
    for (const i of idx) counts.set(labels[i], (counts.get(labels[i]) || 0) + 1);
    if (counts.size === 2) {
      const [a, b] = [...counts.values()];
      leverage += (a * b) / (a + b);
      informative++;
    }
  }

  return {
    residuals,
    leverage,
    informativeStrata: informative,
    strataCount: byStratum.size,
  };
}

/**
 * Permutation test with optional stratification.
 *
 * @param items      array of opaque items
 * @param labels     parallel array of group labels (2 groups)
 * @param statistic  (itemsOfA, itemsOfB) => number
 * @param strata     optional parallel array; when given, labels are shuffled
 *                   only WITHIN each stratum, so the null preserves each
 *                   group's composition across strata. This is what turns
 *                   "the clans differ" into "the clans use different coda types".
 * @param clusters   optional parallel array; when given, labels are permuted
 *                   across whole CLUSTERS and broadcast back, so correlated
 *                   items move together.
 * @param iterations number of shuffles
 * @param seed       integer; the same seed gives the same p-value, always
 *
 * Supplying BOTH `strata` and `clusters` runs the joint null: items are
 * residualised against their stratum mean, then labels are permuted across
 * clusters. This controls composition and non-independence AT THE SAME TIME.
 * Controlling either alone leaves a residual that looks like a finding —
 * experiment 01 reported p < 0.0005 stratified and p = 0.0152 clustered, and
 * nothing survived once both ran together. The joint result always carries
 * `leverage`; read it before reading `p`.
 *
 * Returns the observed statistic, the null distribution's summary, a p-value,
 * and — the field that matters most — `explainedByNull`.
 */
export function permutationTest({ items, labels, statistic, strata = null, clusters = null, iterations = 2000, seed = 1, kind = "distance" }) {
  const n = items.length;
  if (n !== labels.length) throw new Error("items and labels must be the same length");
  if (strata && strata.length !== n) throw new Error("strata must be the same length as items");
  if (clusters && clusters.length !== n) throw new Error("clusters must be the same length as items");

  // ---- joint strata x clusters -------------------------------------------
  //
  // Residualise against stratum means, then permute across clusters. This used
  // to throw. It was the one test experiment 01 actually needed, and refusing
  // to provide it meant the decisive analysis had to be written by hand outside
  // this module — which is how three superseded conclusions got published from
  // single-confound nulls that each left a residual.
  //
  // `joint` is null unless both were supplied, so every existing caller keeps
  // its exact behaviour.
  const joint = (clusters && strata) ? residualiseWithinStrata(items, labels, strata) : null;
  if (joint) items = joint.residuals;

  // Spread into every cluster-branch return. `leverage` sits beside `p` so a
  // caller cannot read one without seeing the other.
  const jointFields = joint
    ? { stratified: true, joint: true, residualised: true,
        leverage: joint.leverage,
        informativeStrata: joint.informativeStrata,
        strataCount: joint.strataCount }
    : { stratified: false, joint: false };

  // ---- cluster-level permutation ----------------------------------------
  //
  // Permuting labels item-by-item assumes items are exchangeable. When the label
  // is a property of a GROUP the items belong to, they are not. Sperm whale clan
  // is a deterministic function of social unit — every unit here is single-clan —
  // so shuffling clan across individual codas invents a world in which two codas
  // from the same unit can belong to different clans. That inflates the effective
  // sample size from 13 units to 6,105 codas and produces a z of 71.9 where the
  // honest test has a handful of degrees of freedom.
  //
  // Here the label is permuted across CLUSTERS and broadcast back, so every coda
  // from a unit moves together. The resolution limit is then the number of
  // distinct cluster assignments, not `iterations` — reported so the caller
  // cannot quote a p-value finer than the design supports.
  if (clusters) {
    const byCluster = new Map();
    for (let i = 0; i < n; i++) {
      const k = clusters[i];
      if (!byCluster.has(k)) byCluster.set(k, { idx: [], label: labels[i] });
      const c = byCluster.get(k);
      if (c.label !== labels[i]) {
        throw new Error(`cluster '${k}' spans more than one label; it cannot be permuted as a unit`);
      }
      c.idx.push(i);
    }
    const keys = [...byCluster.keys()];
    const clusterLabels = keys.map((k) => byCluster.get(k).label);
    const groups = [...new Set(clusterLabels)];
    if (groups.length !== 2) throw new Error(`cluster permutation needs exactly 2 groups, got ${groups.length}`);
    const [gA, gB] = groups;
    const nA = clusterLabels.filter((l) => l === gA).length;

    const split = (labs) => {
      const A = [], B = [];
      for (let i = 0; i < n; i++) (labs[i] === gA ? A : B).push(items[i]);
      return [A, B];
    };
    const observed = statistic(...split(labels));

    // C(nClusters, nA): how many distinct assignments exist at all.
    let comb = 1;
    for (let i = 0; i < nA; i++) comb = (comb * (keys.length - i)) / (i + 1);
    comb = Math.round(comb);

    const work = new Array(n);
    const assign = (labelsByCluster) => {
      keys.forEach((k, ci) => { for (const i of byCluster.get(k).idx) work[i] = labelsByCluster[ci]; });
      return statistic(...split(work));
    };

    // When the assignment space is small enough to walk, ENUMERATE it. Sampling
    // 2,000 times from 66 possibilities estimates a quantity that can simply be
    // computed, and the estimate then wobbles with the seed: the same test
    // printed p = 0.9630/0.9660/0.9715/0.9770 across seeds, and rank 63/64/65,
    // against a resolution unit of 1/66. An exact p is not only more precise, it
    // is reproducible without reference to a seed at all.
    const EXHAUSTIVE_LIMIT = 20000;
    if (comb <= EXHAUSTIVE_LIMIT) {
      const dist = new Float64Array(comb);
      const chosen = new Array(nA);
      let w = 0;
      const walk = (start, depth) => {
        if (depth === nA) {
          const labs = new Array(keys.length).fill(gB);
          for (const ci of chosen) labs[ci] = gA;
          dist[w++] = assign(labs);
          return;
        }
        for (let ci = start; ci <= keys.length - (nA - depth); ci++) {
          chosen[depth] = ci;
          walk(ci + 1, depth + 1);
        }
      };
      walk(0, 0);
      const observedEx = statistic(...split(labels));
      let atLeast = 0;
      for (let i = 0; i < comb; i++) if (dist[i] >= observedEx) atLeast++;
      const res = summarise(observedEx, dist, comb, kind);
      return {
        ...res, seed, ...jointFields, clustered: true, exhaustive: true,
        clusterCount: keys.length, distinctAssignments: comb,
        p: atLeast / comb,                       // exact, not (k+1)/(n+1)
        pResolutionLimit: 1 / comb,
        rank: comb - atLeast + 1,                // exact rank, ascending
      };
    }

    const rng = makeRng(seed);
    const shuffled = clusterLabels.slice();
    const dist = new Float64Array(iterations);
    for (let it = 0; it < iterations; it++) {
      for (let a = shuffled.length - 1; a > 0; a--) {
        const b = (rng() * (a + 1)) | 0;
        const t = shuffled[a]; shuffled[a] = shuffled[b]; shuffled[b] = t;
      }
      dist[it] = assign(shuffled);
    }

    const res = summarise(observed, dist, iterations, kind);
    return {
      ...res, seed, ...jointFields, clustered: true, exhaustive: false,
      clusterCount: keys.length,
      distinctAssignments: comb,
      // The p-value cannot be finer than 1/comb no matter how many shuffles run.
      p: Math.max(res.p, 1 / comb),
      pResolutionLimit: 1 / comb,
    };
  }

  const groups = [...new Set(labels)];
  if (groups.length !== 2) throw new Error(`permutationTest needs exactly 2 groups, got ${groups.length}`);
  const [gA, gB] = groups;

  const split = (labs) => {
    const A = [], B = [];
    for (let i = 0; i < n; i++) (labs[i] === gA ? A : B).push(items[i]);
    return [A, B];
  };

  const observed = statistic(...split(labels));

  // index buckets: one bucket overall, or one per stratum
  const buckets = new Map();
  for (let i = 0; i < n; i++) {
    const k = strata ? strata[i] : 0;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(i);
  }

  const rng = makeRng(seed);
  const work = labels.slice();
  const nullDist = new Float64Array(iterations);

  for (let it = 0; it < iterations; it++) {
    for (const idx of buckets.values()) {
      // Fisher-Yates over the labels sitting at these indices
      for (let a = idx.length - 1; a > 0; a--) {
        const b = (rng() * (a + 1)) | 0;
        const t = work[idx[a]]; work[idx[a]] = work[idx[b]]; work[idx[b]] = t;
      }
    }
    nullDist[it] = statistic(...split(work));
  }

  return { ...summarise(observed, nullDist, iterations, kind), seed, stratified: !!strata };
}

// ------------------------------------------------------------- surrogate IOI

/** Shuffle intervals within a sequence: destroys order, preserves the multiset. */
export function surrogateShuffle(iois, rng) {
  const a = Array.from(iois);
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/** Perfectly even sequence with the same count and total duration. */
export function surrogateIsochronous(iois) {
  let s = 0;
  for (let i = 0; i < iois.length; i++) s += iois[i];
  return Array.from(iois, () => s / iois.length);
}

/** Isochronous plus proportional jitter — the "sloppy metronome" null. */
export function surrogateJittered(iois, rng, jitter = 0.1) {
  const base = surrogateIsochronous(iois);
  return base.map((v) => v * (1 + (rng() * 2 - 1) * jitter));
}

/**
 * Exponential (Poisson-process) intervals with the same count and expected
 * total. The "no timing structure at all" null — a memoryless point process.
 */
export function surrogatePoisson(iois, rng) {
  let s = 0;
  for (let i = 0; i < iois.length; i++) s += iois[i];
  const mean = s / iois.length;
  return Array.from(iois, () => -mean * Math.log(1 - rng()));
}

export const SURROGATES = {
  shuffle: { fn: surrogateShuffle, label: "shuffled order",
    explains: "everything except the ORDER of the intervals" },
  isochronous: { fn: surrogateIsochronous, label: "isochronous",
    explains: "click count and total duration only" },
  jittered: { fn: surrogateJittered, label: "jittered isochronous",
    explains: "count, duration, and a little timing noise" },
  poisson: { fn: surrogatePoisson, label: "Poisson",
    explains: "click count and mean rate only — no timing structure" },
};

/**
 * Distribution of a statistic under repeated surrogate generation.
 * Same contract as permutationTest so the UI can render either identically.
 */
/**
 * Surrogate test over a SET OF BLOCKS, each resampled independently.
 *
 * This exists because the single-sequence form is a trap. Concatenating many
 * short sequences into one pool and shuffling it does not destroy "order within
 * each sequence" — it also destroys every difference BETWEEN sequences, because
 * intervals migrate across boundaries. On the coda corpus the two nulls are not
 * close: a genuine within-coda shuffle gives mean nPVI 34.8, while shuffling one
 * pooled 24,420-interval array gives 62.4 against an observed 20.99. Reporting
 * the second while describing the first inflates the effect roughly three-fold.
 *
 * So when the claim is about structure *inside* an item, pass `blocks` and the
 * surrogate is applied to each block separately, boundaries intact.
 *
 * @param blocks     array of interval arrays — one per coda, phrase, bar, ...
 * @param statistic  (blocks) => number, receiving the array of blocks
 */
export function surrogateBlockTest({ blocks, statistic, surrogate = "shuffle", iterations = 2000, seed = 1, jitter = 0.1, kind = "shift" }) {
  const spec = SURROGATES[surrogate];
  if (!spec) throw new Error(`unknown surrogate '${surrogate}'`);
  const rng = makeRng(seed);
  const observed = statistic(blocks.map((b) => Array.from(b)));
  const dist = new Float64Array(iterations);
  for (let i = 0; i < iterations; i++) {
    dist[i] = statistic(blocks.map((b) => spec.fn(b, rng, jitter)));
  }
  return {
    ...summarise(observed, dist, iterations, kind),
    seed, surrogate, surrogateLabel: spec.label, controlsFor: spec.explains,
    blockCount: blocks.length,
  };
}

export function surrogateTest({ iois, statistic, surrogate = "shuffle", iterations = 2000, seed = 1, jitter = 0.1, kind = "shift" }) {
  const spec = SURROGATES[surrogate];
  if (!spec) throw new Error(`unknown surrogate '${surrogate}'`);
  const rng = makeRng(seed);
  const observed = statistic(Array.from(iois));
  const dist = new Float64Array(iterations);
  for (let i = 0; i < iterations; i++) {
    dist[i] = statistic(spec.fn(iois, rng, jitter));
  }
  return {
    ...summarise(observed, dist, iterations, kind),
    seed, surrogate, surrogateLabel: spec.label, controlsFor: spec.explains,
  };
}

// ------------------------------------------------- multiple comparisons

/**
 * Benjamini-Hochberg FDR. Returns q-values in the input order.
 * An app that lets a user run 400 comparisons and reports raw p-values is
 * manufacturing findings; this is the minimum honest correction.
 */
export function fdr(pvalues) {
  const n = pvalues.length;
  if (!n) return [];
  const order = pvalues.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const q = new Array(n);
  let prev = 1;
  for (let k = n - 1; k >= 0; k--) {
    const [p, i] = order[k];
    prev = Math.min(prev, (p * n) / (k + 1));
    q[i] = Math.min(1, prev);
  }
  return q;
}

/** Cohen's d for two independent samples (pooled SD). */
export function cohensD(a, b) {
  const ma = a.reduce((s, v) => s + v, 0) / a.length;
  const mb = b.reduce((s, v) => s + v, 0) / b.length;
  const va = a.reduce((s, v) => s + (v - ma) ** 2, 0) / (a.length - 1);
  const vb = b.reduce((s, v) => s + (v - mb) ** 2, 0) / (b.length - 1);
  const sp = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2));
  return sp > 0 ? (ma - mb) / sp : NaN;
}
