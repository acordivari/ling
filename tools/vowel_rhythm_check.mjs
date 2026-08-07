// vowel_rhythm_check.mjs — is the coda "vowel" contrast independent of rhythm?
//
//     python3 tools/fetch_corpus.py && python3 tools/fetch_vowels.py
//     node tools/vowel_rhythm_check.mjs
//
// Beguš et al. annotate each coda as vowel 'a' or 'i' from its SPECTRAL
// structure. Sharma et al. give the inter-click intervals of the same codas.
// Joined, they allow a question neither deposit can answer alone:
//
//     within a single coda type, do 'a' and 'i' codas differ in TIMING?
//
// If they do not, the vowel is a genuinely separate axis from rhythm — the first
// independent dimension this project has had. If they do, the annotation is
// partly picking up timing, and any claim that spectral vowels are a distinct
// channel needs to account for it.
//
// The test is confined to coda type 1+1+3 because the contrast is
// overwhelmingly carried by it (702 codas, 46.6 % 'i'); every other type is
// 0-8 % 'i', so pooling types would measure coda type rather than vowel.
//
// THE NULL. Unlike clan, vowel is NOT a property of the individual — most whales
// use both categories. So the permutation cluster reasoning from experiments 01
// and 04 does not transfer: there is no whole-whale relabelling to do. What must
// be preserved is each whale's own vowel rate and the correlation among that
// whale's codas, so vowel is permuted WITHIN whale. The naive null is reported
// beside it to show what the stratification costs.
//
// Statistic and null are the shipped browser code.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  standardise, centroid, euclidean, permutationTest, cohensD, npvi,
} from "../explorer/js/rhythm.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(HERE, "..", "explorer", "data", "vowel-corpus.json");

// ---------------------------------------------------------------------------
// PRE-REGISTERED — fixed before the test was run.
// ---------------------------------------------------------------------------
const TYPE = "1+1+3";
const ITERATIONS = 5000;
const SEED = 1;
const ALPHA = 0.05;
const CALIB_DRAWS = 200;      // random within-whale relabellings for calibration
const MIN_PER_WHALE = 15;

const fmt = (v, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : "  n/a");
const rule = (c = "=") => console.log(c.repeat(78));
const mean = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : NaN);

let raw;
try {
  raw = JSON.parse(readFileSync(CORPUS, "utf8"));
} catch {
  console.error(`Corpus not found at ${CORPUS}\n  run: python3 tools/fetch_vowels.py`);
  process.exit(1);
}

const SCALE = 10000;
const all = raw.ici.map((row, i) => {
  const ici = row.map((v) => v / SCALE);
  return {
    ici, std: standardise(ici), npvi: npvi(ici),
    type: raw.types[raw.codaType[i]],
    whale: raw.whale[i] >= 0 ? raw.whales[raw.whale[i]] : null,
    vowel: raw.vowel[i], autov: raw.autov[i], nClicks: ici.length + 1,
    duration: ici.reduce((s, v) => s + v, 0),
  };
});

rule();
console.log("DOES THE CODA VOWEL CONTRAST CARRY TIMING INFORMATION?");
rule();
console.log(`  vowel annotations  Beguš et al. (OSF 9t6qu), hand-labelled a/i`);
console.log(`  inter-click times  Sharma et al. 2024, same codas, join verified`);
console.log(`  join               ${raw.join.shared_ids} ids, type ${(100 * raw.join.codatype_agreement).toFixed(1)}%,` +
            ` duration ${(100 * raw.join.duration_agreement).toFixed(1)}%`);
console.log(`  IDN <-> whale      ${raw.idn_check.collisions} collisions across ` +
            `${raw.idn_check.names} names / ${raw.idn_check.idns} IDNs`);

const sub = all.filter((c) => c.type === TYPE && (c.vowel === "a" || c.vowel === "i") && c.whale);
const nClicks = [...new Set(sub.map((c) => c.nClicks))];
console.log(`\n  restricted to coda type ${TYPE}: ${sub.length} codas, ` +
            `${sub.filter((c) => c.vowel === "a").length} a / ${sub.filter((c) => c.vowel === "i").length} i`);
console.log(`  clicks per coda: ${nClicks.join(", ")}  (d = ${nClicks[0] - 1} intervals)`);
if (nClicks.length > 1) console.log("  WARNING: mixed click counts; standardised vectors differ in length");

const D = nClicks[0] - 1;
const work = sub.filter((c) => c.nClicks === nClicks[0]);

// ---------------------------------------------------------------------------
// The statistic: distance between vowel-group centroids in standardised ICI
// space. Same construction claims.js uses for the clan question.
// ---------------------------------------------------------------------------
const sepStat = (A, B) => euclidean(centroid(A.map((c) => c.std)), centroid(B.map((c) => c.std)));

rule();
console.log("1. STRUCTURE — who says what");
rule();
console.log(`  ${"whale".padEnd(10)} ${"a".padStart(5)} ${"i".padStart(5)} ${"n".padStart(6)} ${"% i".padStart(7)}`);
console.log("  " + "-".repeat(40));
const byWhale = new Map();
for (const c of work) {
  if (!byWhale.has(c.whale)) byWhale.set(c.whale, { a: 0, i: 0 });
  byWhale.get(c.whale)[c.vowel]++;
}
for (const [w, c] of [...byWhale].sort((x, y) => (y[1].a + y[1].i) - (x[1].a + x[1].i))) {
  const n = c.a + c.i;
  console.log(`  ${w.padEnd(10)} ${String(c.a).padStart(5)} ${String(c.i).padStart(5)} ` +
              `${String(n).padStart(6)} ${fmt(100 * c.i / n, 1).padStart(7)}`);
}
const usable = [...byWhale].filter(([, c]) => c.a >= 5 && c.i >= 5);
console.log("  " + "-".repeat(40));
console.log(`  whales using both (>=5 each): ${usable.length} of ${byWhale.size}`);
console.log(`  -> vowel is NOT a property of the individual, so it is permuted`);
console.log(`     WITHIN whale, not across whole whales as clan was.`);

// ---------------------------------------------------------------------------
rule();
console.log("2. THE TEST");
rule();
const A = work.filter((c) => c.vowel === "a");
const B = work.filter((c) => c.vowel === "i");
const observed = sepStat(A, B);
const ca = centroid(A.map((c) => c.std)), cb = centroid(B.map((c) => c.std));

console.log(`  observed centroid separation   ${fmt(observed, 5)}`);
console.log(`  centroid 'a'  [${ca.map((v) => fmt(v, 3)).join(", ")}]`);
console.log(`  centroid 'i'  [${cb.map((v) => fmt(v, 3)).join(", ")}]`);
console.log(`  difference    [${ca.map((v, i) => fmt(v - cb[i], 3)).join(", ")}]`);
console.log(`  as a fraction of a typical interval (1/${D}): ` +
            `${fmt(observed / (1 / D), 3)}`);

const nulls = [
  ["naive — shuffle vowel across all codas", null],
  ["STRATIFIED — shuffle vowel WITHIN whale", work.map((c) => c.whale)],
];
console.log(`\n  ${"null".padEnd(42)} ${"null mean".padStart(10)} ${"expl.".padStart(7)} ${"p".padStart(8)}`);
console.log("  " + "-".repeat(70));
const results = {};
for (const [label, strata] of nulls) {
  const res = permutationTest({
    items: work, labels: work.map((c) => c.vowel), statistic: sepStat,
    strata, iterations: ITERATIONS, seed: SEED, kind: "distance",
  });
  results[label] = res;
  console.log(`  ${label.padEnd(42)} ${fmt(res.nullMean, 5).padStart(10)} ` +
              `${fmt(100 * res.explainedByNull, 1).padStart(6)}% ${fmt(res.p).padStart(8)}`);
}
console.log("  " + "-".repeat(70));
console.log("  expl. = null mean / observed: how much of the separation the null");
console.log("  produces anyway. A p-value alone does not answer that.");

// ---------------------------------------------------------------------------
rule();
console.log("3. CALIBRATION — does the stratified test reject at nominal rate?");
rule();
console.log(`  ${CALIB_DRAWS} random within-whale relabellings, each with the SAME per-whale`);
console.log(`  a/i counts as the real data. Every one is a true null by construction.\n`);
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const crng = mulberry32(99);
const idxByWhale = new Map();
work.forEach((c, i) => {
  if (!idxByWhale.has(c.whale)) idxByWhale.set(c.whale, []);
  idxByWhale.get(c.whale).push(i);
});
let hits = 0;
const ps = [];
for (let d = 0; d < CALIB_DRAWS; d++) {
  const labs = work.map((c) => c.vowel);
  for (const idx of idxByWhale.values()) {
    for (let a = idx.length - 1; a > 0; a--) {
      const b = Math.floor(crng() * (a + 1));
      const t = labs[idx[a]]; labs[idx[a]] = labs[idx[b]]; labs[idx[b]] = t;
    }
  }
  const res = permutationTest({
    items: work, labels: labs, statistic: sepStat,
    strata: work.map((c) => c.whale), iterations: 400, seed: d + 1, kind: "distance",
  });
  ps.push(res.p);
  if (res.p < ALPHA) hits++;
}
ps.sort((a, b) => a - b);
console.log(`  false positives at alpha ${ALPHA}: ${hits}/${CALIB_DRAWS} ` +
            `(${fmt(100 * hits / CALIB_DRAWS, 1)}%)   median p ${fmt(ps[Math.floor(ps.length / 2)], 3)}`);
console.log(`  VERDICT: ${hits / CALIB_DRAWS <= 2 * ALPHA ? "calibrated" : "MISCALIBRATED — the test over-rejects"}`);

// ---------------------------------------------------------------------------
rule();
console.log("4. DESCRIPTIVE — where any difference sits");
rule();
const npa = A.map((c) => c.npvi), npb = B.map((c) => c.npvi);
const da = A.map((c) => c.duration), db = B.map((c) => c.duration);
console.log(`  ${"".padEnd(10)} ${"a".padStart(9)} ${"i".padStart(9)} ${"Cohen d".padStart(9)}`);
console.log(`  ${"nPVI".padEnd(10)} ${fmt(mean(npa), 2).padStart(9)} ${fmt(mean(npb), 2).padStart(9)} ` +
            `${fmt(cohensD(npa, npb), 3).padStart(9)}`);
console.log(`  ${"duration".padEnd(10)} ${fmt(mean(da), 3).padStart(9)} ${fmt(mean(db), 3).padStart(9)} ` +
            `${fmt(cohensD(da, db), 3).padStart(9)}`);
for (let k = 0; k < D; k++) {
  const xa = A.map((c) => c.std[k]), xb = B.map((c) => c.std[k]);
  console.log(`  ${("std ICI" + (k + 1)).padEnd(10)} ${fmt(mean(xa), 3).padStart(9)} ` +
              `${fmt(mean(xb), 3).padStart(9)} ${fmt(cohensD(xa, xb), 3).padStart(9)}`);
}

rule();
console.log("VERDICT");
rule();
const strat = results["STRATIFIED — shuffle vowel WITHIN whale"];
console.log(`  stratified p = ${fmt(strat.p)}, ${fmt(100 * strat.explainedByNull, 1)}% explained by the null`);
console.log(`  effect size  = ${fmt(observed / (1 / D), 3)} of a typical interval\n`);
console.log(strat.p < ALPHA
  ? "  The vowel annotation DOES carry timing information within a single coda\n" +
    "  type. It is not a purely spectral axis, and the effect size above is how\n" +
    "  much timing it carries."
  : "  No detectable timing difference between 'a' and 'i' codas of the same type.\n" +
    "  The vowel contrast is consistent with being a genuinely separate axis from\n" +
    "  rhythm — which makes it the first independent dimension in this project.");
rule();
