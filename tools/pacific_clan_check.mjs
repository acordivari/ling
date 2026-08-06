// pacific_clan_check.mjs — does the Pacific corpus answer what Dominica could not?
//
//     python3 tools/fetch_pacific.py
//     node tools/pacific_clan_check.mjs
//
// Experiment 01 concluded that the within-type clan-rhythm question is NOT
// DETERMINABLE from the Dominica corpus: EC1 and EC2 barely use the same coda
// types, leaving ~33 codas of leverage out of 6,038, and a design whose finest
// possible p was 1/66 = 0.0152. Its closing line was that answering it needs a
// corpus with real repertoire overlap, or more clusters — not more codas.
//
// This runs the identical test on Hersh et al. 2022: 7 Pacific clans, 191
// repertoires, 23 regions, 1978-2017.
//
// The STATISTIC and its NULL are the shipped browser code, imported directly and
// not reimplemented. Two things are harness-side and labelled as such:
// `contrastMagnitude` (an effect size, which the shipped code does not expose)
// and the region restriction.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  decodeCorpus, studentisedContrast, contrastLeverage,
} from "../explorer/js/claims.js";
import { permutationTest, fdr } from "../explorer/js/rhythm.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(HERE, "..", "explorer", "data", "pacific-corpus.json");

// ---------------------------------------------------------------------------
// PRE-REGISTERED PARAMETERS — fixed before the test was run.
// ---------------------------------------------------------------------------
const ITERATIONS = 2000;
const SEED = 1;
const ALPHA = 0.05;
const FDR_Q = 0.05;

const NEG_SPLITS_PER_CLAN = 24;
const NEG_MIN_REPERTOIRES = 8;
const NEG_ITERATIONS = 500;
const NEG_FAIL_ABOVE = 0.10;

const POWER_TARGET = 0.80;
const DOMINICA_MDE = 0.40;
// Extended downward after the first run: power was 1.00 at every delta on the
// original grid, so the reported MDE was censored from below and was an upper
// bound rather than a measurement. Recorded rather than silently rescaled.
const INJECT_DELTAS = [0.001, 0.002, 0.004, 0.008, 0.016, 0.032, 0.08, 0.20, 0.40];
const INJECT_ITERATIONS = 500;
// CORRECTED after the second run. Injection was originally applied to real clan
// pairs, two of which already returned p = 0.0005 before anything was injected.
// Power was then 1.00 at every delta because the test was detecting the BASELINE
// difference, not the injected one — the MDE measured the effect already there.
// Injection now runs on within-clan repertoire splits, where the true effect is
// zero by construction, which is the only condition under which a detection
// floor means anything.
const INJECT_CLANS = ["SI", "PALI", "REG"];   // small / mid / large
const INJECT_SPLITS = 8;

// ---------------------------------------------------------------------------
// ADDED AFTER THE FIRST RUN — not pre-registered, and flagged as such, the same
// way experiment 01 flags its by-unit null.
//
// Clans differ in geographic range, and this corpus pools 23 regions across
// 1978-2017 from many research groups with different hydrophones, arrays and
// annotation tooling. Region is therefore confounded with clan, and a "clan
// rhythm difference" could be a recording-chain difference. The within-region
// contrast compares clans only where both were recorded.
// ---------------------------------------------------------------------------
const REGION_MIN_CODAS = 15;   // per clan per region, to be worth including

const NCLICKS = 5;             // studentisedContrast is defined for d = 4 ICIs
const D = 4;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const fmt = (v, d = 4) =>
  (v === null || v === undefined || Number.isNaN(v) ? "  --  " : v.toFixed(d));
const rule = (c = "=") => console.log(c.repeat(78));
const median = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

/**
 * HARNESS-SIDE effect size — the magnitude the shipped statistic studentises away.
 *
 * studentisedContrast returns |pooled within-type contrast| / SE, which answers
 * "is it detectable" and not "how big is it". This is the same pooled contrast
 * WITHOUT the SE division, expressed as a fraction of a typical standardised
 * interval (1/d). It is on the same scale as the injected delta below, and the
 * injection sweep is used to verify that: injecting delta must move this by
 * about delta.
 */
function contrastMagnitude(A, B) {
  const byType = new Map();
  for (const [g, arr] of [["A", A], ["B", B]]) {
    for (const c of arr) {
      if (!byType.has(c.type)) byType.set(c.type, { A: [], B: [] });
      byType.get(c.type)[g].push(c.std);
    }
  }
  const num = new Float64Array(D);
  let wsum = 0;
  for (const [, g] of byType) {
    const nA = g.A.length, nB = g.B.length;
    if (nA < 2 || nB < 2) continue;
    const mA = new Float64Array(D), mB = new Float64Array(D);
    for (const v of g.A) for (let i = 0; i < D; i++) mA[i] += v[i] / nA;
    for (const v of g.B) for (let i = 0; i < D; i++) mB[i] += v[i] / nB;
    const h = 1 / (1 / nA + 1 / nB);
    for (let i = 0; i < D; i++) num[i] += h * (mA[i] - mB[i]);
    wsum += h;
  }
  if (!wsum) return 0;
  let sq = 0;
  for (let i = 0; i < D; i++) sq += (num[i] / wsum) ** 2;
  // ||contrast|| relative to a typical interval, and w=[+1,-1,+1,-1] injection
  // of size delta moves each component by delta/d, so ||.|| moves by delta/d*sqrt(d).
  return Math.sqrt(sq) / (1 / D) / Math.sqrt(D);
}

// ---------------------------------------------------------------------------
let raw;
try {
  raw = JSON.parse(readFileSync(CORPUS, "utf8"));
} catch {
  console.error(`Corpus not found at ${CORPUS}\n  run: python3 tools/fetch_pacific.py`);
  process.exit(1);
}
const all = decodeCorpus(raw);
// decodeCorpus does not know about the Pacific-only region column; attach it by
// index, which is safe because decodeCorpus preserves order.
all.forEach((c, i) => {
  c.loc = raw.locs[raw.loc[i]];
  c.year = Number(raw.year[i]);
});

const five = all.filter((c) => c.nClicks === NCLICKS);
const clans = [...new Set(five.map((c) => c.clan))].sort();
const clanFull = raw.clan_full_names || {};

rule();
console.log("PACIFIC CLAN RHYTHM — does this corpus answer what Dominica could not?");
rule();
console.log(`corpus     ${raw.source.paper}`);
console.log(`           ${all.length.toLocaleString()} codas, ${raw.clans.length} clans, ` +
            `${raw.units.length} repertoires, ${raw.types.length} types, ${raw.locs.length} regions`);
console.log(`subset     ${five.length.toLocaleString()} five-click codas`);
console.log(`statistic  studentisedContrast + permutationTest, imported from explorer/js/`);
console.log(`null       clan labels permuted across whole REPERTOIRES ` +
            `(${raw.traps.repertoires_spanning_multiple_clans.count} of ` +
            `${raw.traps.repertoires_spanning_multiple_clans.of} span >1 clan)`);
console.log(`\nCIRCULARITY: clans were DEFINED by clustering repertoires on coda-type`);
console.log(`usage, so "clans use different coda types" is true by construction and is`);
console.log(`not tested here. Only within-shared-type TIMING is a real question.`);

const subset = (clan, pool = five) => pool.filter((c) => c.clan === clan);

function pairTest(A, B, { iterations = ITERATIONS, seed = SEED } = {}) {
  const items = A.concat(B);
  return permutationTest({
    items,
    labels: items.map((c) => c.clan),
    clusters: items.map((c) => c.unit),
    statistic: studentisedContrast,
    iterations, seed,
  });
}

// ---------------------------------------------------------------------------
// 1. The 21 pairwise clan tests
// ---------------------------------------------------------------------------
rule();
console.log("1. WITHIN-TYPE RHYTHM CONTRAST, ALL CLAN PAIRS");
rule();
console.log("leverage = effective codas carrying within-type information.");
console.log("Dominica EC1/EC2 had 33.3, and experiment 01 called that undeterminable.");
console.log("effect = ||pooled within-type contrast|| as a fraction of a typical interval.\n");

const pairs = [];
for (let i = 0; i < clans.length; i++) {
  for (let j = i + 1; j < clans.length; j++) {
    const a = clans[i], b = clans[j];
    const A = subset(a), B = subset(b);
    if (!A.length || !B.length) continue;
    pairs.push({
      a, b, nA: A.length, nB: B.length,
      lev: contrastLeverage(A, B),
      eff: contrastMagnitude(A, B),
      res: pairTest(A, B),
    });
  }
}
const qs = fdr(pairs.map((p) => p.res.p));
pairs.forEach((p, i) => { p.q = qs[i]; });
pairs.sort((x, y) => x.res.p - y.res.p);

console.log(`${"pair".padEnd(11)} ${"lever".padStart(7)} ${"clust".padStart(5)} ` +
            `${"T".padStart(7)} ${"nullT".padStart(7)} ${"effect".padStart(7)} ` +
            `${"p".padStart(8)} ${"q(FDR)".padStart(8)}`);
console.log("-".repeat(78));
for (const p of pairs) {
  console.log(`${(p.a + "/" + p.b).padEnd(11)} ${p.lev.toFixed(1).padStart(7)} ` +
              `${String(p.res.clusterCount).padStart(5)} ${fmt(p.res.observed, 3).padStart(7)} ` +
              `${fmt(p.res.nullMean, 3).padStart(7)} ${fmt(p.eff, 3).padStart(7)} ` +
              `${fmt(p.res.p).padStart(8)} ${fmt(p.q).padStart(8)}${p.q < FDR_Q ? " *" : ""}`);
}
console.log("-".repeat(78));
const survivors = pairs.filter((p) => p.q < FDR_Q);
console.log(`pairs surviving FDR q < ${FDR_Q}: ${survivors.length} of ${pairs.length}`);
console.log(`leverage  min ${Math.min(...pairs.map((p) => p.lev)).toFixed(1)}  ` +
            `median ${median(pairs.map((p) => p.lev)).toFixed(1)}  ` +
            `max ${Math.max(...pairs.map((p) => p.lev)).toFixed(1)}`);
console.log(`EFFECT SIZE  min ${Math.min(...pairs.map((p) => p.eff)).toFixed(3)}  ` +
            `median ${median(pairs.map((p) => p.eff)).toFixed(3)}  ` +
            `max ${Math.max(...pairs.map((p) => p.eff)).toFixed(3)} of a typical interval`);
console.log(`coarsest p-resolution limit: ${Math.max(...pairs.map((p) => p.res.pResolutionLimit)).toExponential(2)} ` +
            `(Dominica: 1/66 = 0.0152)`);

// ---------------------------------------------------------------------------
// R. Region control (added after the first run — NOT pre-registered)
// ---------------------------------------------------------------------------
rule();
console.log("R. REGION CONTROL — compare clans only where BOTH were recorded");
rule();
console.log("NOT PRE-REGISTERED. Added after the first run, and flagged rather than");
console.log("folded in silently. 23 regions over 1978-2017, many research groups:");
console.log("region is confounded with clan, so a clan difference may be a recording");
console.log(`difference. Regions need >= ${REGION_MIN_CODAS} five-click codas from each clan.\n`);

const regionRows = [];
for (const p of pairs) {
  const shared = raw.locs.filter((L) => {
    const na = five.filter((c) => c.clan === p.a && c.loc === L).length;
    const nb = five.filter((c) => c.clan === p.b && c.loc === L).length;
    return na >= REGION_MIN_CODAS && nb >= REGION_MIN_CODAS;
  });
  if (!shared.length) { regionRows.push({ p, shared, res: null }); continue; }
  const pool = five.filter((c) => shared.includes(c.loc));
  const A = subset(p.a, pool), B = subset(p.b, pool);
  const lev = contrastLeverage(A, B);
  if (lev <= 0) { regionRows.push({ p, shared, res: null, lev }); continue; }
  regionRows.push({ p, shared, lev, eff: contrastMagnitude(A, B), res: pairTest(A, B) });
}
const testable = regionRows.filter((r) => r.res);
console.log(`${"pair".padEnd(11)} ${"regions".padEnd(18)} ${"lever".padStart(7)} ` +
            `${"T".padStart(7)} ${"effect".padStart(7)} ${"p".padStart(8)}`);
console.log("-".repeat(78));
for (const r of regionRows) {
  if (!r.res) {
    console.log(`${(r.p.a + "/" + r.p.b).padEnd(11)} ${"— no shared region".padEnd(18)}`);
    continue;
  }
  console.log(`${(r.p.a + "/" + r.p.b).padEnd(11)} ${r.shared.join(",").slice(0, 18).padEnd(18)} ` +
              `${r.lev.toFixed(1).padStart(7)} ${fmt(r.res.observed, 3).padStart(7)} ` +
              `${fmt(r.eff, 3).padStart(7)} ${fmt(r.res.p).padStart(8)}` +
              `${r.res.p < ALPHA ? " *" : ""}`);
}
console.log("-".repeat(78));
console.log(`pairs with any shared region: ${testable.length} of ${pairs.length}`);
if (testable.length) {
  const sig = testable.filter((r) => r.res.p < ALPHA).length;
  console.log(`of those, p < ${ALPHA}: ${sig}`);
  console.log(`effect size within region: median ${median(testable.map((r) => r.eff)).toFixed(3)} ` +
              `vs ${median(pairs.map((p) => p.eff)).toFixed(3)} pooled across regions`);

  // How much of this control is really one place?
  const onlyGal = testable.filter((r) => r.shared.length === 1 && r.shared[0] === "GAL").length;
  console.log(`\n  WHAT THIS CONTROL ACTUALLY IS: ${onlyGal} of ${testable.length} pairs are`);
  console.log(`  testable ONLY in GAL (Galapagos). This is largely a within-Galapagos`);
  console.log(`  comparison, not a general region control. It removes between-region`);
  console.log(`  differences; it cannot remove anything that varies WITHIN Galapagos.`);

  // Year is the residual confound inside a region: same place, different decade,
  // different equipment and different annotators.
  console.log(`\n  YEAR OVERLAP inside the shared regions (the residual confound):`);
  console.log(`  Same place, different decade = different hydrophone, different`);
  console.log(`  annotator, different software. That is confounded with clan too.\n`);
  for (const r of testable) {
    const pool = five.filter((c) => r.shared.includes(c.loc));
    const ya = pool.filter((c) => c.clan === r.p.a).map((c) => c.year).filter(Number.isFinite);
    const yb = pool.filter((c) => c.clan === r.p.b).map((c) => c.year).filter(Number.isFinite);
    if (!ya.length || !yb.length) { r.yearOverlap = 0; continue; }
    const [a0, a1] = [Math.min(...ya), Math.max(...ya)];
    const [b0, b1] = [Math.min(...yb), Math.max(...yb)];
    r.ylo = Math.max(a0, b0); r.yhi = Math.min(a1, b1);
    r.yearOverlap = Math.max(0, r.yhi - r.ylo + 1);
    r.yearSpans = `${r.p.a}: ${a0}-${a1}  ${r.p.b}: ${b0}-${b1}`;
  }
  for (const r of testable.slice().sort((x, y) => x.yearOverlap - y.yearOverlap)) {
    console.log(`    ${(r.p.a + "/" + r.p.b).padEnd(11)} ${(r.yearSpans || "").padEnd(34)} ` +
                `overlap ${String(r.yearOverlap).padStart(2)} yr` +
                `${r.yearOverlap === 0 && r.res.p < ALPHA ? "   <- significant, ZERO year overlap" : ""}`);
  }
  const zero = testable.filter((r) => r.yearOverlap === 0 && r.res.p < ALPHA).length;
  console.log(`\n  ${zero} of the region-controlled significant pairs have NO overlapping years.`);
}

// ---------------------------------------------------------------------------
// Y. Region AND year matched — the strictest control available
// ---------------------------------------------------------------------------
rule();
console.log("Y. REGION + YEAR MATCHED");
rule();
console.log("Restrict to shared regions AND the overlapping year window, so the two");
console.log("clans are compared on recordings made in the same place at the same time.");
console.log("This is the only condition under which the recording chain is plausibly");
console.log("matched. It is available for only some pairs, and that is the point.\n");

console.log(`${"pair".padEnd(11)} ${"years".padEnd(11)} ${"nA".padStart(5)} ${"nB".padStart(5)} ` +
            `${"lever".padStart(7)} ${"effect".padStart(7)} ${"p".padStart(8)}`);
console.log("-".repeat(78));
let ymTestable = 0, ymSig = 0;
for (const r of testable) {
  if (!r.yearOverlap) {
    console.log(`${(r.p.a + "/" + r.p.b).padEnd(11)} ${"— none".padEnd(11)}`);
    continue;
  }
  const pool = five.filter((c) => r.shared.includes(c.loc) && c.year >= r.ylo && c.year <= r.yhi);
  const A = subset(r.p.a, pool), B = subset(r.p.b, pool);
  const lev = A.length && B.length ? contrastLeverage(A, B) : 0;
  if (lev <= 0) {
    console.log(`${(r.p.a + "/" + r.p.b).padEnd(11)} ${`${r.ylo}-${r.yhi}`.padEnd(11)} ` +
                `${String(A.length).padStart(5)} ${String(B.length).padStart(5)} ` +
                `${"0.0".padStart(7)}   no shared type with n>=2 in both`);
    continue;
  }
  const res = pairTest(A, B);
  ymTestable++;
  if (res.p < ALPHA) ymSig++;
  console.log(`${(r.p.a + "/" + r.p.b).padEnd(11)} ${`${r.ylo}-${r.yhi}`.padEnd(11)} ` +
              `${String(A.length).padStart(5)} ${String(B.length).padStart(5)} ` +
              `${lev.toFixed(1).padStart(7)} ${contrastMagnitude(A, B).toFixed(3).padStart(7)} ` +
              `${fmt(res.p).padStart(8)}${res.p < ALPHA ? " *" : ""}`);
}
console.log("-".repeat(78));
console.log(`testable with region AND year matched: ${ymTestable} of ${pairs.length} pairs`);
console.log(`of those, p < ${ALPHA}: ${ymSig}`);

// ---------------------------------------------------------------------------
// L. Cluster ladder (added after tools/cluster_calibration.mjs)
// ---------------------------------------------------------------------------
rule();
console.log("L. CLUSTER LADDER — how much does the repertoire proxy buy?");
rule();
console.log("A repertoire is ONE RECORDING DAY, not a social unit, and this deposit has");
console.log("no unit ids. tools/cluster_calibration.mjs measures that substitution against");
console.log("ground truth at Dominica and finds it anti-conservative: 101 of 126 true-null");
console.log("splits return a SMALLER p under day clustering than unit clustering (sign");
console.log("test p = 5e-12), because the day-permuted null is ~12% narrower.");
console.log("");
console.log("So the repertoire-level p-values above are optimistic. Coarser clusters group");
console.log("repertoires that COULD be one unit. None spans more than one clan, so all are");
console.log("valid. Coarsening can only lose resolution, never manufacture it.\n");

const LADDER = [
  ["repertoire (used above)", (c) => c.unit],
  ["region x year x clan", (c) => `${c.loc}|${c.year}|${c.clan}`],
  ["region x clan", (c) => `${c.loc}|${c.clan}`],
];

console.log(`${"clustering".padEnd(24)} ${"clusters".padStart(9)} ${"FDR q<0.05".padStart(11)} ` +
            `${"min clust/clan".padStart(15)}`);
console.log("-".repeat(78));
const ladderResults = [];
for (const [label, keyFn] of LADDER) {
  const ps = [];
  for (const p of pairs) {
    const A = subset(p.a), B = subset(p.b);
    const items = A.concat(B);
    try {
      ps.push(permutationTest({
        items,
        labels: items.map((c) => c.clan),
        clusters: items.map(keyFn),
        statistic: studentisedContrast,
        iterations: ITERATIONS, seed: SEED,
      }).p);
    } catch { ps.push(NaN); }
  }
  const q = fdr(ps.map((v) => (Number.isNaN(v) ? 1 : v)));
  const nClust = new Set(five.map(keyFn)).size;
  const perClan = {};
  for (const c of five) (perClan[c.clan] ??= new Set()).add(keyFn(c));
  const minPer = Math.min(...Object.values(perClan).map((s) => s.size));
  ladderResults.push({ label, ps, q, nClust, minPer });
  console.log(`${label.padEnd(24)} ${String(nClust).padStart(9)} ` +
              `${String(q.filter((v) => v < FDR_Q).length + " of " + pairs.length).padStart(11)} ` +
              `${String(minPer).padStart(15)}`);
}
console.log("-".repeat(78));
console.log("per-pair p across the ladder (pairs ordered as above):\n");
console.log(`${"pair".padEnd(11)} ` + LADDER.map(([l]) => l.split(" ")[0].padStart(11)).join(" "));
for (let i = 0; i < pairs.length; i++) {
  const cells = ladderResults.map((r) => fmt(r.ps[i]).padStart(11)).join(" ");
  const stars = ladderResults.map((r) => (r.q[i] < FDR_Q ? "*" : " ")).join("");
  console.log(`${(pairs[i].a + "/" + pairs[i].b).padEnd(11)} ${cells}   ${stars}`);
}
console.log("-".repeat(78));
console.log(`Region x clan leaves PO with only ${(() => {
  const s = new Set(five.filter((c) => c.clan === "PO").map((c) => `${c.loc}|${c.clan}`)).size;
  return s;
})()} clusters and PALI with ${(() => {
  const s = new Set(five.filter((c) => c.clan === "PALI").map((c) => `${c.loc}|${c.clan}`)).size;
  return s;
})()}, which reintroduces the`);
console.log("EC2-style degeneracy that capped Dominica at p >= 0.0152. Read that row as");
console.log("a floor on resolution, not as a better answer.");

// ---------------------------------------------------------------------------
// J. Joint control — region + year matched AND conservatively clustered
// ---------------------------------------------------------------------------
rule();
console.log("J. JOINT — region+year matched AND region x year x clan clustering");
rule();
console.log("Sections Y and L each remove one confound. Reading them together ('these");
console.log("pairs appear in both lists') is not a joint test, so here is the joint test.");
console.log("It is the strictest thing this corpus supports, and for most pairs it is");
console.log("not computable at all — which is itself the finding.\n");

console.log(`${"pair".padEnd(11)} ${"years".padEnd(11)} ${"clusters".padStart(8)} ` +
            `${"assign".padStart(9)} ${"lever".padStart(7)} ${"p".padStart(8)}  note`);
console.log("-".repeat(78));
let jointTestable = 0, jointSig = 0;
for (const r of testable) {
  const name = `${r.p.a}/${r.p.b}`;
  if (!r.yearOverlap) { console.log(`${name.padEnd(11)} ${"— none".padEnd(11)}`); continue; }
  const pool = five.filter((c) => r.shared.includes(c.loc) && c.year >= r.ylo && c.year <= r.yhi);
  const A = subset(r.p.a, pool), B = subset(r.p.b, pool);
  if (!A.length || !B.length) { console.log(`${name.padEnd(11)} ${"— empty".padEnd(11)}`); continue; }
  const items = A.concat(B);
  const keyFn = (c) => `${c.loc}|${c.year}|${c.clan}`;
  const perClan = {};
  for (const c of items) (perClan[c.clan] ??= new Set()).add(keyFn(c));
  const sizes = Object.values(perClan).map((s) => s.size);
  const nC = new Set(items.map(keyFn)).size;
  const lev = contrastLeverage(A, B);
  if (Math.min(...sizes) < 2 || lev <= 0) {
    console.log(`${name.padEnd(11)} ${`${r.ylo}-${r.yhi}`.padEnd(11)} ${String(nC).padStart(8)} ` +
                `${"—".padStart(9)} ${lev.toFixed(1).padStart(7)} ${"—".padStart(8)}  ` +
                `not computable (${sizes.join("/")} clusters per clan)`);
    continue;
  }
  let comb = 1;
  for (let i = 0; i < sizes[0]; i++) comb = (comb * (nC - i)) / (i + 1);
  const res = permutationTest({
    items, labels: items.map((c) => c.clan), clusters: items.map(keyFn),
    statistic: studentisedContrast, iterations: ITERATIONS, seed: SEED,
  });
  jointTestable++;
  if (res.p < ALPHA) jointSig++;
  console.log(`${name.padEnd(11)} ${`${r.ylo}-${r.yhi}`.padEnd(11)} ${String(nC).padStart(8)} ` +
              `${String(Math.round(comb)).padStart(9)} ${lev.toFixed(1).padStart(7)} ` +
              `${fmt(res.p).padStart(8)}${res.p < ALPHA ? " *" : "  "} ` +
              `floor ${res.pResolutionLimit.toExponential(1)}`);
}
console.log("-".repeat(78));
console.log(`computable under BOTH controls: ${jointTestable} of ${pairs.length} pairs`);
console.log(`of those, p < ${ALPHA}: ${jointSig}`);

// ---------------------------------------------------------------------------
// N. Negative control
// ---------------------------------------------------------------------------
rule();
console.log("N. NEGATIVE CONTROL — split a single clan's repertoires at random");
rule();
console.log("No clan difference exists by construction, so p should be ~uniform.");
console.log(`PRE-REGISTERED FAILURE: >${(NEG_FAIL_ABOVE * 100).toFixed(0)}% of splits with p < ${ALPHA}.\n`);

const negP = [];
for (const clan of clans) {
  const codas = subset(clan);
  const reps = [...new Set(codas.map((c) => c.unit))];
  if (reps.length < NEG_MIN_REPERTOIRES) {
    console.log(`  ${clan.padEnd(6)} skipped — ${reps.length} repertoires < ${NEG_MIN_REPERTOIRES}`);
    continue;
  }
  const rng = mulberry32(1000 + clan.charCodeAt(0));
  const ps = [], effs = [];
  for (let s = 0; s < NEG_SPLITS_PER_CLAN; s++) {
    const sh = reps.slice();
    for (let i = sh.length - 1; i > 0; i--) {
      const k = Math.floor(rng() * (i + 1));
      [sh[i], sh[k]] = [sh[k], sh[i]];
    }
    const half = new Set(sh.slice(0, Math.floor(sh.length / 2)));
    const A = codas.filter((c) => half.has(c.unit)).map((c) => ({ ...c, clan: "X" }));
    const B = codas.filter((c) => !half.has(c.unit)).map((c) => ({ ...c, clan: "Y" }));
    const lev = contrastLeverage(A, B);
    if (lev <= 0) continue;
    const res = pairTest(A, B, { iterations: NEG_ITERATIONS, seed: s + 1 });
    const eff = contrastMagnitude(A, B);
    ps.push(res.p);
    effs.push(eff);
    negP.push({ p: res.p, lev, T: res.observed, eff });
  }
  const hits = ps.filter((v) => v < ALPHA).length;
  console.log(`  ${clan.padEnd(6)} ${String(ps.length).padStart(3)} splits   ` +
              `p<${ALPHA}: ${String(hits).padStart(2)} (${(100 * hits / ps.length).toFixed(0)}%)   ` +
              `median p ${fmt(median(ps), 3)}   median effect ${fmt(median(effs), 3)}`);
}
const negRate = negP.filter((r) => r.p < ALPHA).length / negP.length;
console.log(`\n  overall false-positive rate: ${(100 * negRate).toFixed(1)}% of ${negP.length} splits ` +
            `(nominal ${(100 * ALPHA).toFixed(0)}%)`);
console.log(`  VERDICT: ${negRate <= NEG_FAIL_ABOVE ? "pass" : "FAIL — anti-conservative"}`);

// The effect measure is a NORM, so it is biased upward by noise and does not go
// to zero under a true null. Real effect sizes above are only interpretable
// against this distribution.
{
  const ne = negP.map((r) => r.eff).sort((a, b) => a - b);
  const q = (f) => ne[Math.min(ne.length - 1, Math.floor(f * ne.length))];
  console.log(`\n  NULL EFFECT-SIZE DISTRIBUTION (what "0" looks like for this measure):`);
  console.log(`    median ${q(0.5).toFixed(3)}   p90 ${q(0.9).toFixed(3)}   ` +
              `p95 ${q(0.95).toFixed(3)}   max ${ne[ne.length - 1].toFixed(3)}`);
  const real = pairs.map((p) => p.eff);
  console.log(`    real clan pairs: median ${median(real).toFixed(3)}, ` +
              `${real.filter((v) => v > q(0.95)).length} of ${real.length} above the null p95`);
}

// ---------------------------------------------------------------------------
// C. Calibration
// ---------------------------------------------------------------------------
rule();
console.log("C. CALIBRATION — T vs leverage under a true null");
rule();
{
  const pts = negP.filter((r) => r.lev > 0 && r.T > 0);
  const xs = pts.map((r) => Math.log(r.lev)), ys = pts.map((r) => Math.log(r.T));
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
  const my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  console.log(`  n = ${pts.length} within-clan splits`);
  console.log(`  log-log slope of T vs leverage: ${fmt(den > 0 ? num / den : NaN, 3)}   ` +
              `(experiment 01 on Dominica: 0.31, ideal 0)`);
  console.log(`  Reported, not scored. The RANK of a pair remains soft.`);
}

// ---------------------------------------------------------------------------
// P. Positive control — injection
// ---------------------------------------------------------------------------
rule();
console.log("P. POSITIVE CONTROL — minimum detectable within-type effect");
rule();
console.log("Inject delta x (1/d) into every standardised ICI of one half along");
console.log("w = [+1,-1,+1,-1] (sums to 0, so the vector still sums to 1). delta is on");
console.log("the same scale as the `effect` column above: fraction of a typical interval.\n");
console.log("Injection is applied to WITHIN-CLAN repertoire splits, where the true effect");
console.log("is zero, so the detected signal is the injected one and nothing else. The");
console.log("first version of this section injected into real clan pairs; two of the three");
console.log("already returned p = 0.0005 with nothing injected, so power was 1.00 at every");
console.log("delta and the 'MDE' was the baseline difference. That run is discarded.\n");

function inject(codas, delta) {
  const w = [1, -1, 1, -1];
  return codas.map((c) => {
    const std = c.std.slice();
    for (let i = 0; i < D; i++) std[i] += delta * (1 / D) * w[i];
    return { ...c, std };
  });
}

/** Random within-clan repertoire split — a true null by construction. */
function nullSplit(clan, s) {
  const codas = subset(clan);
  const reps = [...new Set(codas.map((c) => c.unit))];
  const rng = mulberry32(7000 + s * 131 + clan.charCodeAt(0));
  const sh = reps.slice();
  for (let i = sh.length - 1; i > 0; i--) {
    const k = Math.floor(rng() * (i + 1));
    [sh[i], sh[k]] = [sh[k], sh[i]];
  }
  const half = new Set(sh.slice(0, Math.floor(sh.length / 2)));
  return [
    codas.filter((c) => half.has(c.unit)).map((c) => ({ ...c, clan: "X" })),
    codas.filter((c) => !half.has(c.unit)).map((c) => ({ ...c, clan: "Y" })),
  ];
}

// Scale check on a true null, where the baseline contrast is ~0 so the injected
// norm is recoverable. (On a pair with a real baseline effect the measure moves
// by less than delta, because contrast vectors add geometrically, not scalarly.)
{
  const [A, B] = nullSplit("REG", 1);
  const base = contrastMagnitude(A, B);
  const moved = contrastMagnitude(A, inject(B, 0.20));
  console.log(`  scale check on a null split: injecting 0.200 moves the effect measure ` +
              `${base.toFixed(3)} -> ${moved.toFixed(3)}\n`);
}

console.log(`${"clan".padEnd(6)} ${"lever".padStart(7)}  ` +
            INJECT_DELTAS.map((d) => d.toFixed(3).padStart(6)).join(" "));
console.log("-".repeat(78));
const mdes = [];
for (const clan of INJECT_CLANS) {
  const levs = [];
  const powers = INJECT_DELTAS.map((delta) => {
    let hits = 0, n = 0;
    for (let s = 0; s < INJECT_SPLITS; s++) {
      const [A, B] = nullSplit(clan, s);
      if (contrastLeverage(A, B) <= 0) continue;
      if (delta === INJECT_DELTAS[0]) levs.push(contrastLeverage(A, B));
      n++;
      if (pairTest(A, inject(B, delta), { iterations: INJECT_ITERATIONS, seed: s + 1 }).p < ALPHA) hits++;
    }
    return n ? hits / n : NaN;
  });
  const idx = powers.findIndex((v) => v >= POWER_TARGET);
  mdes.push({ pair: clan, lev: median(levs), mde: idx === -1 ? null : INJECT_DELTAS[idx], powers });
  console.log(`${clan.padEnd(6)} ${median(levs).toFixed(1).padStart(7)}  ` +
              powers.map((v) => v.toFixed(2).padStart(6)).join(" "));
}
console.log("-".repeat(78));
console.log(`power at each delta, ${INJECT_SPLITS} within-clan splits each, alpha = ${ALPHA}\n`);
for (const m of mdes) {
  const censored = m.powers[0] >= POWER_TARGET;
  console.log(`  ${m.pair.padEnd(6)} median leverage ${m.lev.toFixed(1).padStart(6)}   MDE ` +
              `${m.mde === null ? `> ${DOMINICA_MDE}` : (censored ? `<= ${m.mde.toFixed(3)} (censored — power saturated at the smallest delta)` : m.mde.toFixed(3))}`);
}
const best = mdes.filter((m) => m.mde !== null).map((m) => m.mde);
console.log(`\n  Dominica (experiment 01): ~${DOMINICA_MDE.toFixed(2)}`);
console.log(`  VERDICT: ${best.length && Math.min(...best) < DOMINICA_MDE
  ? "pass — detects effects Dominica could not"
  : "FAIL — no better than Dominica"}`);

rule();
console.log("SUMMARY");
rule();
console.log("The result is the SEQUENCE, not the first row. Each control removes one");
console.log("confound and the count falls.\n");
console.log(`  pooled, repertoire-clustered      ${survivors.length} of ${pairs.length}`);
console.log(`  region matched                    ${testable.filter((r) => r.res.p < ALPHA).length} of ${testable.length}`);
console.log(`  region + year matched             ${ymSig} of ${ymTestable}`);
for (const r of ladderResults.slice(1)) {
  console.log(`  ${r.label.padEnd(33)} ${r.q.filter((v) => v < FDR_Q).length} of ${pairs.length}` +
              `   (${r.nClust} clusters)`);
}
console.log(`  BOTH JOINTLY                      ${jointSig} of ${jointTestable} computable` +
            `   <- the standing result`);
console.log("");
console.log(`  median effect size                ${median(pairs.map((p) => p.eff)).toFixed(3)} of a typical interval`);
console.log(`  null effect p95 (what "0" is)     ${(() => {
  const ne = negP.map((r) => r.eff).sort((a, b) => a - b);
  return ne[Math.floor(0.95 * ne.length)].toFixed(3);
})()}`);
console.log(`  negative control                  ${(100 * negRate).toFixed(1)}% false positives ` +
            `(${negRate <= NEG_FAIL_ABOVE ? "pass" : "FAIL"})`);
console.log(`  minimum detectable effect         ${best.length ? Math.min(...best).toFixed(3) : "n/a"} ` +
            `vs Dominica ~${DOMINICA_MDE}`);
console.log("");
console.log("  The repertoire-clustered row is ANTI-CONSERVATIVE and is retained only to");
console.log("  show the sequence. See tools/cluster_calibration.mjs, which measures the");
console.log("  day-for-unit substitution against ground truth at Dominica.");
rule();
