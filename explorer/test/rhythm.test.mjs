// Tests for js/rhythm.js. Run with:  node test/rhythm.test.mjs
//
// Every expected value is a known answer — derived by hand, or a property that
// must hold for mathematical reasons. None of them were captured from this
// implementation's output, which would only prove the code is deterministic.
//
// The centrepiece is the stratified-permutation test near the bottom. It builds
// a synthetic dataset with a KNOWN confound and checks that the naive null
// reports a huge effect while the stratified null correctly attributes ~all of
// it to composition. That is the behaviour the whole app is built around, so it
// is tested against a case where the right answer is known by construction.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  npvi, cv, rhythmRatios, standardise, centroid, euclidean,
  permutationTest, surrogateTest, surrogateBlockTest, fdr, cohensD,
  surrogateShuffle, surrogateIsochronous, surrogatePoisson, surrogateJittered,
  SURROGATES, KINDS,
} from "../js/rhythm.js";
import { interpret } from "../js/claims.js";
import { makeRng } from "../js/random.js";

const here = dirname(fileURLToPath(import.meta.url));
const G = JSON.parse(readFileSync(join(here, "fixtures/rhythm-golden.json"), "utf8"));

let fails = 0;
let asserts = 0;
const skipped = [];
const ok = (c, m, extra = "") => {
  asserts++;
  console.log(`${c ? "  ok  " : " FAIL "} ${m}${extra ? "  " + extra : ""}`);
  if (!c) fails++;
};
const skip = (why) => { skipped.push(why); console.log(`  skip  ${why}`); };
const near = (a, b, tol = 1e-9) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

// ------------------------------------------------------------ golden values
console.log("\n== nPVI against hand-derived values ==");
for (const c of G.npvi) {
  const got = npvi(c.iois);
  if (c.expected === null) {
    ok(Number.isNaN(got), `${c.name}: undefined -> NaN`, `got ${got}`);
  } else {
    ok(near(got, c.expected), `${c.name}: ${c.expected}`, `got ${got}`);
  }
}

console.log("\n== CV ==");
for (const c of G.cv) ok(near(cv(c.iois), c.expected), `${c.name}: ${c.expected}`, `got ${cv(c.iois)}`);

console.log("\n== rhythm ratios ==");
for (const c of G.ratios) {
  const got = rhythmRatios(c.iois);
  ok(got.length === c.expected.length && got.every((v, i) => near(v, c.expected[i])),
    `${c.name}: [${c.expected.join(", ")}]`, `got [${got.join(", ")}]`);
}

console.log("\n== standardise ==");
for (const c of G.standardise) {
  const got = standardise(c.iois);
  ok(got.every((v, i) => near(v, c.expected[i])), `${c.name}`, `got [${got.join(", ")}]`);
  ok(near(got.reduce((s, v) => s + v, 0), 1), `${c.name}: sums to exactly 1`);
}

console.log("\n== Benjamini-Hochberg FDR ==");
for (const c of G.fdr) {
  const got = fdr(c.pvalues);
  ok(got.every((v, i) => near(v, c.expected[i], 1e-12)), `${c.name}`, `got [${got.map((v) => v.toFixed(4)).join(", ")}]`);
}
ok(fdr([]).length === 0, "empty input returns empty");
{
  const q = fdr([0.001, 0.5, 0.9]);
  ok(q[0] <= q[1] && q[1] <= q[2], "q-values are monotone in p");
  ok(q.every((v) => v >= 0 && v <= 1), "q-values stay in [0,1]");
}

console.log("\n== Cohen's d ==");
for (const c of G.cohensD) ok(near(cohensD(c.a, c.b), c.expected, 1e-12), `${c.name}: ${c.expected}`, `got ${cohensD(c.a, c.b)}`);

// ------------------------------------------------------- required properties
console.log("\n== properties that must hold ==");
{
  // nPVI is tempo-invariant by construction: scaling all intervals cannot change it.
  const base = [0.13, 0.29, 0.07, 0.41];
  for (const k of [0.001, 3, 1000]) {
    ok(near(npvi(base), npvi(base.map((v) => v * k)), 1e-9),
      `nPVI invariant under ${k}x tempo scaling`);
  }
  // CV is likewise scale-invariant.
  ok(near(cv(base), cv(base.map((v) => v * 7)), 1e-12), "CV invariant under tempo scaling");

  // nPVI is order-SENSITIVE; CV is order-BLIND. That distinction is why both ship.
  const a = [0.1, 0.4, 0.1, 0.4], b = [0.1, 0.1, 0.4, 0.4];
  ok(!near(npvi(a), npvi(b), 1e-6), "nPVI distinguishes orderings of the same multiset",
    `${npvi(a).toFixed(3)} vs ${npvi(b).toFixed(3)}`);
  ok(near(cv(a), cv(b), 1e-12), "CV does not — same multiset, same CV");

  // Bounds.
  ok(npvi([0.2, 0.2, 0.2]) === 0, "nPVI floor is exactly 0 for isochronous");
  const extreme = npvi([1e-6, 1, 1e-6, 1]);
  ok(extreme > 190 && extreme <= 200, "nPVI approaches its ceiling of 200", `got ${extreme.toFixed(2)}`);

  // standardise is idempotent.
  const s1 = standardise([3, 1, 4, 1]);
  ok(s1.every((v, i) => near(v, standardise(s1)[i])), "standardise is idempotent");
}

console.log("\n== surrogates preserve what they claim to ==");
{
  const rng = makeRng(7);
  const iois = [0.11, 0.29, 0.07, 0.43];
  const total = iois.reduce((s, v) => s + v, 0);

  const sh = surrogateShuffle(iois, rng);
  ok(sh.length === iois.length, "shuffle preserves count");
  ok(near(sh.reduce((s, v) => s + v, 0), total, 1e-12), "shuffle preserves total duration");
  ok(near(cv(sh), cv(iois), 1e-12), "shuffle preserves CV (order-blind statistic)");
  ok(JSON.stringify([...sh].sort()) === JSON.stringify([...iois].sort()), "shuffle preserves the multiset");

  const iso = surrogateIsochronous(iois);
  ok(near(iso.reduce((s, v) => s + v, 0), total, 1e-12), "isochronous preserves total duration");
  ok(npvi(iso) === 0, "isochronous surrogate has nPVI exactly 0");

  const po = surrogatePoisson(iois, makeRng(3));
  ok(po.length === iois.length, "poisson preserves count");
  ok(po.every((v) => v > 0), "poisson intervals are strictly positive");
}

// ------------------------------------------------- the confound, by construction
console.log("\n== stratified vs naive permutation: a KNOWN confound ==");
{
  // Build two groups that differ ONLY in which "type" they draw from. Within a
  // type both groups are drawn from the identical distribution, so the honest
  // answer is: all of the observed separation is composition, none is a real
  // within-type difference.
  const rng = makeRng(42);
  const TYPE_A = [0.40, 0.40, 0.10, 0.10];   // front-loaded
  const TYPE_B = [0.25, 0.25, 0.25, 0.25];   // even
  const items = [], labels = [], strata = [];
  const jitter = (v) => v.map((x) => x * (1 + (rng() * 2 - 1) * 0.02));

  // group X: 90% type A. group Y: 90% type B. No within-type difference at all.
  for (let i = 0; i < 500; i++) {
    const isA = i % 10 !== 0;
    items.push(standardise(jitter(isA ? TYPE_A : TYPE_B)));
    labels.push("X"); strata.push(isA ? "A" : "B");
  }
  for (let i = 0; i < 500; i++) {
    const isB = i % 10 !== 0;
    items.push(standardise(jitter(isB ? TYPE_B : TYPE_A)));
    labels.push("Y"); strata.push(isB ? "B" : "A");
  }

  const sep = (A, B) => euclidean(centroid(A), centroid(B));

  const naive = permutationTest({ items, labels, statistic: sep, iterations: 1000, seed: 11 });
  const strat = permutationTest({ items, labels, statistic: sep, strata, iterations: 1000, seed: 11 });

  // Hand-derived, not eyeballed. With a 90/10 mix:
  //   centroid X = 0.9*[.40,.40,.10,.10] + 0.1*[.25,.25,.25,.25] = [.385,.385,.115,.115]
  //   centroid Y = 0.9*[.25,.25,.25,.25] + 0.1*[.40,.40,.10,.10] = [.265,.265,.235,.235]
  //   difference = [.12,.12,-.12,-.12], norm = sqrt(4 * 0.12^2) = 0.24
  // The 2% jitter perturbs this only in the third decimal.
  ok(near(naive.observed, 0.24, 0.005), "observed separation matches the hand-derived 0.24",
    `${naive.observed.toFixed(4)}`);
  ok(naive.p < 0.01, "naive permutation calls it highly significant", `p=${naive.p.toFixed(4)}`);
  ok(naive.explainedByNull < 0.1, "naive null explains almost none of it",
    `explainedByNull=${naive.explainedByNull.toFixed(3)}`);

  // The whole point: the stratified null reproduces nearly the entire effect,
  // because by construction the effect IS composition.
  ok(strat.explainedByNull > 0.9,
    "stratified null explains >90% of the same observed effect",
    `explainedByNull=${strat.explainedByNull.toFixed(3)}`);
  ok(strat.residualFraction < 0.1, "residual after stratification is small",
    `residual=${strat.residualFraction.toFixed(3)}`);

  ok(near(naive.observed, strat.observed, 1e-12),
    "both nulls describe the SAME observed statistic - only the null differs");
}

console.log("\n== permutation test mechanics ==");
{
  const items = Array.from({ length: 200 }, (_, i) => [i % 7, (i * 3) % 5]);
  const labels = items.map((_, i) => (i < 100 ? "a" : "b"));
  const stat = (A, B) => euclidean(centroid(A), centroid(B));

  const r1 = permutationTest({ items, labels, statistic: stat, iterations: 500, seed: 99 });
  const r2 = permutationTest({ items, labels, statistic: stat, iterations: 500, seed: 99 });
  ok(r1.p === r2.p && r1.nullMean === r2.nullMean, "same seed reproduces the same p-value exactly");

  const r3 = permutationTest({ items, labels, statistic: stat, iterations: 500, seed: 100 });
  ok(r3.p !== r1.p || r3.nullMean !== r1.nullMean, "a different seed gives a different null draw");

  ok(r1.p > 0, "p is never exactly 0 — (k+1)/(n+1) respects the resolution limit");
  {
    // Force the floor with perfectly separated groups: every item in group a is
    // 0, every item in group b is 1, so the true labelling gives 1.0 and no
    // shuffle can reach it. p must come out as exactly 1/(iterations+1) — never
    // 0, which would overstate the resolution that 500 shuffles actually buy.
    const perfect = Array.from({ length: 200 }, (_, i) => (i < 100 ? [0] : [1]));
    const perfectLabels = perfect.map((_, i) => (i < 100 ? "a" : "b"));
    const meanGap = (A, B) => Math.abs(centroid(A)[0] - centroid(B)[0]);
    const floored = permutationTest({
      items: perfect, labels: perfectLabels, statistic: meanGap, iterations: 500, seed: 3,
    });
    ok(near(floored.observed, 1, 1e-12), "perfectly separated groups give observed 1.0");
    ok(near(floored.p, 1 / 501, 1e-12), "p bottoms out at exactly 1/(iterations+1), not 0",
      `p=${floored.p} vs ${(1 / 501).toFixed(8)}`);
    ok(floored.explainedByNull < 0.15,
      "a genuinely real effect has a LOW explainedByNull", `${floored.explainedByNull.toFixed(3)}`);
  }
  ok(r1.nullDist.length === 500, "null distribution is returned in full for plotting");
  ok(r1.nullQuantile(0.5) >= r1.nullMin && r1.nullQuantile(0.5) <= r1.nullMax, "quantiles land inside the null range");

  let threw = false;
  try { permutationTest({ items, labels: items.map(() => "only-one"), statistic: stat }); } catch { threw = true; }
  ok(threw, "rejects a single-group input rather than returning nonsense");

  threw = false;
  try { permutationTest({ items, labels: ["a"], statistic: stat }); } catch { threw = true; }
  ok(threw, "rejects mismatched items/labels lengths");
}

console.log("\n== surrogate test ==");
{
  const iso = [0.2, 0.2, 0.2, 0.2, 0.2];
  const r = surrogateTest({ iois: iso, statistic: npvi, surrogate: "poisson", iterations: 500, seed: 5 });
  ok(r.observed === 0, "isochronous input has observed nPVI 0");
  ok(r.nullMean > 50, "Poisson surrogate is far more irregular", `null mean nPVI ${r.nullMean.toFixed(1)}`);
  ok(r.pLess < 0.01, "observed is significantly LOWER than the Poisson null", `pLess=${r.pLess.toFixed(4)}`);

  const s1 = surrogateTest({ iois: [0.1, 0.3, 0.2, 0.4], statistic: npvi, surrogate: "shuffle", iterations: 300, seed: 8 });
  const s2 = surrogateTest({ iois: [0.1, 0.3, 0.2, 0.4], statistic: npvi, surrogate: "shuffle", iterations: 300, seed: 8 });
  ok(s1.p === s2.p, "surrogate test is reproducible under a fixed seed");
  ok(typeof s1.controlsFor === "string" && s1.controlsFor.length > 0,
    "surrogate declares what it controls for", s1.controlsFor);

  let threw = false;
  try { surrogateTest({ iois: iso, statistic: npvi, surrogate: "nonexistent" }); } catch { threw = true; }
  ok(threw, "rejects an unknown surrogate name");

  threw = false;
  try {
    permutationTest({ items: [[0], [1]], labels: ["a", "b"], statistic: () => 1, iterations: 10, kind: "bogus" });
  } catch { threw = true; }
  ok(threw, "rejects an unknown statistic kind rather than silently defaulting");
  ok(KINDS.length === 2 && KINDS.includes("distance") && KINDS.includes("shift"),
    "KINDS enumerates exactly the two supported kinds", KINDS.join("/"));

  // Every registered surrogate must actually run and declare what it controls
  // for. A registry entry nothing exercises is a trap for whoever adds the next.
  for (const name of Object.keys(SURROGATES)) {
    const spec = SURROGATES[name];
    ok(typeof spec.fn === "function" && !!spec.label && !!spec.explains,
      `SURROGATES.${name} is fully specified`);
    let out = null, e = null;
    try {
      out = surrogateTest({ iois: [0.1, 0.3, 0.2, 0.4], statistic: npvi, surrogate: name, iterations: 100, seed: 12 });
    } catch (err) { e = err; }
    ok(!e && Number.isFinite(out.nullMean), `surrogate '${name}' runs and yields a finite null`,
      e ? String(e.message) : `nullMean ${out.nullMean.toFixed(2)}`);
  }

  // jittered isochronous: the "sloppy metronome" null. It must sit between a
  // perfect metronome (nPVI 0) and a memoryless process (~100).
  const jit = surrogateJittered([0.2, 0.2, 0.2, 0.2, 0.2], makeRng(21), 0.1);
  ok(jit.length === 5, "jittered preserves count");
  ok(jit.every((v) => v > 0), "jittered intervals stay positive");
  const jn = npvi(jit);
  ok(jn > 0 && jn < 40, "jittered isochronous lands between metronome and noise", `nPVI ${jn.toFixed(1)}`);
  ok(npvi(surrogateJittered([0.2, 0.2, 0.2, 0.2], makeRng(21), 0)) === 0,
    "zero jitter reduces exactly to isochronous");
}

console.log("\n== regression: shift statistics must not be read as proportions ==");
{
  // This shipped wrong once. `explainedByNull` is nullMean/observed, which is a
  // proportion only when "no effect" implies "statistic near 0". Mean nPVI has
  // no such zero: real codas score ~21 against a shuffled null of ~62, so the
  // ratio is 2.97 and a naive reading calls it ">0.9, the null explains it all"
  // — exactly backwards, on what is actually the strongest result in the tool.
  const codaLike = [];
  const rng = makeRng(4);
  for (let i = 0; i < 400; i++) {
    // front-loaded, strongly non-isochronous within a coda but consistent across
    const jit = () => 1 + (rng() * 2 - 1) * 0.05;
    codaLike.push(0.30 * jit(), 0.30 * jit(), 0.20 * jit(), 0.20 * jit());
  }
  const meanOfWindows = (flat) => {
    let s = 0, n = 0;
    for (let i = 0; i + 4 <= flat.length; i += 4) {
      const v = npvi(flat.slice(i, i + 4));
      if (Number.isFinite(v)) { s += v; n++; }
    }
    return n ? s / n : NaN;
  };
  const res = surrogateTest({
    iois: codaLike, statistic: meanOfWindows, surrogate: "poisson",
    iterations: 300, seed: 9,
  });

  ok(res.kind === "shift", "surrogateTest defaults to kind 'shift'", res.kind);
  ok(res.explainedByNull === null,
    "explainedByNull is null for a shift statistic, not a misleading ratio",
    `${res.explainedByNull}`);
  ok(res.observed < res.nullMean, "observed sits BELOW the null mean",
    `${res.observed.toFixed(2)} < ${res.nullMean.toFixed(2)}`);
  ok(res.direction === "below", "direction reports 'below'");
  ok(res.z < -2, "z is strongly negative", `z=${res.z.toFixed(1)}`);
  ok(res.p <= 0.05, "two-sided p is small for a large negative shift", `p=${res.p.toFixed(4)}`);

  // And a distance statistic must still get its proportion.
  const dist = permutationTest({
    items: [[0], [0], [1], [1]], labels: ["a", "a", "b", "b"],
    statistic: (A, B) => Math.abs(centroid(A)[0] - centroid(B)[0]),
    iterations: 100, seed: 2, kind: "distance",
  });
  ok(dist.kind === "distance", "permutationTest defaults to kind 'distance'");
  ok(typeof dist.explainedByNull === "number",
    "explainedByNull IS computed for a distance statistic", `${dist.explainedByNull.toFixed(3)}`);
  ok(dist.p === dist.pGreater, "distance p-value is one-sided (greater)");
}

console.log("\n== nulls must do what their label says ==");
{
  // Regression for a real defect. Claim 4's null was described as "each coda
  // keeps its own intervals; only the ORDER is destroyed" but was implemented by
  // flattening every coda into one pool and shuffling globally. That also
  // destroys tempo differences BETWEEN codas, so it answers an easier question
  // and inflates the effect. On the real corpus the two nulls give 34.8 vs 62.4
  // against an observed 20.99 — roughly a 3x overstatement.
  //
  // These assert COMPOSITION, not just that a number came out.
  const blocks = [[0.10, 0.40], [0.20, 0.20], [1.00, 3.00]];
  const totals = blocks.map((b) => b.reduce((s, v) => s + v, 0));

  const seen = [];
  surrogateBlockTest({
    blocks, iterations: 60, seed: 5, surrogate: "shuffle",
    statistic: (bs) => { seen.push(bs.map((b) => b.slice())); return 0; },
  });
  ok(seen.length === 61, "block test evaluates the statistic once per iteration plus the observed",
    `${seen.length}`);
  const everyDraw = seen.every((draw) =>
    draw.length === blocks.length &&
    draw.every((b, i) =>
      b.length === blocks[i].length &&
      Math.abs(b.reduce((s, v) => s + v, 0) - totals[i]) < 1e-12 &&
      JSON.stringify([...b].sort()) === JSON.stringify([...blocks[i]].sort())));
  ok(everyDraw,
    "EVERY draw preserves each block's own multiset, length and total — no interval crosses a boundary");

  // The 1.0/3.0 block can never contaminate the 0.1/0.4 block.
  const contaminated = seen.some((draw) => draw[0].some((v) => v >= 1));
  ok(!contaminated, "a large interval from block 3 never appears in block 1");

  // And the contrast that motivated the fix: pooled shuffling DOES contaminate.
  const flat = blocks.flat();
  const pooled = [];
  surrogateTest({
    iois: flat, iterations: 60, seed: 5, surrogate: "shuffle",
    statistic: (a) => { pooled.push(a.slice()); return 0; },
  });
  const pooledContaminates = pooled.some((d) => d.slice(0, 2).some((v) => v >= 1));
  ok(pooledContaminates,
    "pooled shuffling DOES move intervals across block boundaries — which is why it is a different null");
}

console.log("\n== cluster-level permutation ==");
{
  // When the label is a property of a group, permuting item-by-item invents
  // impossible worlds and inflates the effective sample size. Clan is nested in
  // social unit in the real corpus: every unit is single-clan.
  const items = [], labels = [], clusters = [];
  for (let u = 0; u < 6; u++) {
    const lab = u < 3 ? "A" : "B";
    for (let k = 0; k < 50; k++) { items.push([u < 3 ? 0 : 1]); labels.push(lab); clusters.push(`unit${u}`); }
  }
  const stat = (A, B) => Math.abs(centroid(A)[0] - centroid(B)[0]);

  const byItem = permutationTest({ items, labels, statistic: stat, iterations: 500, seed: 4 });
  const byCluster = permutationTest({ items, labels, clusters, statistic: stat, iterations: 500, seed: 4 });

  ok(near(byItem.observed, byCluster.observed, 1e-12),
    "both describe the same observed statistic", `${byItem.observed}`);
  ok(byCluster.clustered === true && byCluster.clusterCount === 6,
    "cluster permutation reports its cluster count", `${byCluster.clusterCount}`);
  ok(byCluster.distinctAssignments === 20,
    "C(6,3) = 20 distinct cluster assignments exist", `${byCluster.distinctAssignments}`);
  // The floor is a LOWER bound, not the answer. Here it does not bind: with a
  // 3/3 split the true assignment AND its complement both give |difference| = 1,
  // so about 2 of the 20 assignments match the observed value and the empirical
  // p lands near 0.09 — legitimately above 1/20.
  ok(byCluster.p >= 1 / 20 - 1e-12,
    "p never drops below the 1/20 resolution floor", `p=${byCluster.p.toFixed(5)}`);
  ok(near(byCluster.pResolutionLimit, 1 / 20, 1e-12),
    "the resolution limit is reported so it cannot be quoted past", `${byCluster.pResolutionLimit}`);
  {
    // A case where the floor DOES bind: 10 clusters, 1 in group B, so only
    // C(10,1) = 10 assignments exist. Even 5,000 shuffles cannot resolve below 0.1.
    const it2 = [], lb2 = [], cl2 = [];
    for (let u = 0; u < 10; u++) {
      for (let k = 0; k < 20; k++) { it2.push([u === 0 ? 5 : 0]); lb2.push(u === 0 ? "B" : "A"); cl2.push(`u${u}`); }
    }
    const r = permutationTest({ items: it2, labels: lb2, clusters: cl2, statistic: stat, iterations: 5000, seed: 6 });
    ok(r.distinctAssignments === 10, "C(10,1) = 10 assignments", `${r.distinctAssignments}`);
    ok(near(r.p, 0.1, 1e-12),
      "with 5,000 shuffles p is still floored at 0.1 — the design, not the compute, is the limit",
      `p=${r.p}`);
  }
  ok(byItem.p < byCluster.p,
    "item-level permutation reports a smaller p than the design can support",
    `${byItem.p.toFixed(5)} vs ${byCluster.p.toFixed(5)}`);

  // A cluster spanning two labels is not permutable as a unit and must be rejected.
  let threw = false;
  try {
    const bad = labels.slice(); bad[0] = "B";
    permutationTest({ items, labels: bad, clusters, statistic: stat, iterations: 10 });
  } catch { threw = true; }
  ok(threw, "rejects a cluster that spans more than one label");

  threw = false;
  try { permutationTest({ items, labels, clusters, strata: clusters, statistic: stat, iterations: 10 }); } catch { threw = true; }
  ok(threw, "rejects clusters and strata used together");
}

console.log("\n== regression: a distance whose null EXCEEDS it must not print a percentage ==");
{
  // explainedByNull = nullMean/observed is only a proportion while nullMean <=
  // observed. When the null is larger the ratio exceeds 1 and the old wording
  // produced "the null reproduces 703.4% of it, leaving -603.4%".
  // Values 0..39 split by parity: group means 19 and 20, so the TRUE split is
  // near-identical (observed = 1) while a random 20/20 split of 0..39 typically
  // separates the means by ~2. Small but strictly nonzero, so the ratio is
  // defined and lands above 1.
  const items = [], labels = [];
  for (let i = 0; i < 40; i++) { items.push([i]); labels.push(i % 2 === 0 ? "a" : "b"); }
  const r = permutationTest({
    items, labels, iterations: 500, seed: 3, kind: "distance",
    statistic: (A, B) => Math.abs(centroid(A)[0] - centroid(B)[0]),
  });
  ok(near(r.observed, 1, 1e-12),
    "the true split separates the group means by exactly 1", `${r.observed}`);
  ok(r.observed < r.nullMean,
    "a random split separates them MORE than the real one does",
    `observed ${r.observed.toFixed(3)} < null ${r.nullMean.toFixed(3)}`);
  ok(r.explainedByNull > 1, "so explainedByNull exceeds 1", `${r.explainedByNull.toFixed(2)}`);
  const i2 = interpret(r);
  ok(i2.headline === "Smaller than the null produces by chance",
    "interpret() reports the direction instead of a nonsense percentage", i2.headline);
  ok(!/-\d+\.\d+%/.test(i2.body) && !i2.body.includes("%"),
    "no percentage — negative or otherwise — appears in the body");
}

console.log("\n== cluster resolution floor survives pooled slices ==");
{
  // The app runs >2,000 permutations as independent slices and pools them. An
  // earlier version rebuilt p from the pooled draws and so silently restored
  // resolution the design does not have, reporting 0.0030 for a design whose
  // exact minimum is 0.0152.
  const it = [], lb = [], cl = [];
  for (let u = 0; u < 12; u++) {
    for (let k = 0; k < 30; k++) { it.push([u < 2 ? 1 : 0]); lb.push(u < 2 ? "B" : "A"); cl.push(`u${u}`); }
  }
  const stat = (A, B) => Math.abs(centroid(A)[0] - centroid(B)[0]);
  const r = permutationTest({ items: it, labels: lb, clusters: cl, statistic: stat, iterations: 2000, seed: 2 });
  ok(r.distinctAssignments === 66, "C(12,2) = 66 assignments", `${r.distinctAssignments}`);
  ok(near(r.pResolutionLimit, 1 / 66, 1e-12), "resolution limit is 1/66", `${r.pResolutionLimit.toFixed(4)}`);
  ok(r.p >= 1 / 66 - 1e-12, "p respects the 1/66 floor", `p=${r.p.toFixed(4)}`);

  // more shuffles must not buy resolution
  const big = permutationTest({ items: it, labels: lb, clusters: cl, statistic: stat, iterations: 10000, seed: 2 });
  ok(big.p >= 1 / 66 - 1e-12,
    "10,000 shuffles still cannot resolve below 1/66 — the design is the limit, not the compute",
    `p=${big.p.toFixed(4)}`);
}

console.log("\n== degenerate input does not throw or return silent nonsense ==");
{
  ok(Number.isNaN(npvi([])), "npvi([]) is NaN");
  ok(Number.isNaN(cv([])), "cv([]) is NaN");
  ok(Number.isNaN(cv([0, 0, 0])), "cv of all-zero is NaN, not 0/0 propagated");
  ok(rhythmRatios([]).length === 0, "ratios of empty is empty");
  ok(rhythmRatios([0.5]).length === 0, "ratios needs 2 intervals");
  ok(standardise([0, 0]).every((v) => v === 0), "standardise of all-zero returns zeros, not NaN");
  ok(centroid([]).length === 0, "centroid of nothing is empty");
  ok(euclidean([1, 2], [1, 2]) === 0, "euclidean self-distance is 0");
}

// --------------------------------------- optional: check against the real corpus
console.log("\n== real corpus (skipped unless data/coda-corpus.json exists) ==");
{
  let corpus = null;
  try {
    corpus = JSON.parse(readFileSync(join(here, "../data/coda-corpus.json"), "utf8"));
  } catch { /* not fetched; that is the normal case for a fresh clone */ }

  if (!corpus) {
    skip("real-corpus checks: run `python3 tools/fetch_corpus.py` to enable them");
  } else {
    const five = [];
    for (let i = 0; i < corpus.ici.length; i++) if (corpus.ici[i].length === 4) five.push(i);
    const mean = five.reduce((s, i) => s + npvi(corpus.ici[i]), 0) / five.length;
    // Reference computed independently in Python/numpy over the same cleaning rules.
    ok(Math.abs(mean - 20.9871) < 0.01,
      "5-click mean nPVI matches the independent Python reference (20.9871)",
      `got ${mean.toFixed(4)} over ${five.length} codas`);

    const clanNames = corpus.clans;
    const items = five.map((i) => standardise(corpus.ici[i]));
    const labels = five.map((i) => clanNames[corpus.clan[i]]);
    const strata = five.map((i) => corpus.types[corpus.codaType[i]]);
    const sep = (A, B) => euclidean(centroid(A), centroid(B));

    const naive = permutationTest({ items, labels, statistic: sep, iterations: 1000, seed: 1 });
    const strat = permutationTest({ items, labels, statistic: sep, strata, iterations: 1000, seed: 1 });
    ok(Math.abs(naive.observed - 0.12871) < 1e-4,
      "clan separation matches the Python reference (0.12871)", `got ${naive.observed.toFixed(5)}`);
    ok(strat.explainedByNull > 0.95,
      "stratified null explains >95% of the clan effect on real data",
      `explainedByNull=${strat.explainedByNull.toFixed(4)}`);
  }
}

// Report the assertion count and any skipped block. A suite that prints
// ALL PASS while silently running 92 fewer assertions trains people to trust a
// green that means nothing — and explorer/data/ is gitignored, so the skipping
// path is what every fresh clone and CI runner takes by default.
// Set REQUIRE_CORPUS=1 to make a missing corpus a hard failure.
const requireCorpus = process.env.REQUIRE_CORPUS === "1";
if (skipped.length && requireCorpus) {
  console.log(` FAIL  REQUIRE_CORPUS=1 but ${skipped.length} block(s) were skipped: ${skipped.join("; ")}`);
  fails++;
}
const tail = skipped.length
  ? ` (${asserts} assertions; ${skipped.length} block(s) SKIPPED - ${skipped.join("; ")})`
  : ` (${asserts} assertions)`;
console.log(fails ? `\n${fails} FAILURE(S)${tail}\n` : `\nALL PASS${tail}\n`);
process.exit(fails ? 1 : 0);
