// cluster_calibration.mjs — is a recording day a valid stand-in for a social unit?
//
//     python3 tools/fetch_corpus.py
//     node tools/cluster_calibration.mjs
//
// Experiment 04 permutes clan labels across REPERTOIRES, because the Hersh et al.
// Pacific deposit has no social-unit or individual ids and a repertoire is one
// recording day. But clan is a property of a social UNIT, not of a day, and one
// unit contributes many days. Permuting days therefore treats correlated
// observations as independent — the same pseudoreplication experiment 01 caught
// one level down, when clan was permuted across codas instead of units.
//
// The Dominica corpus has BOTH Date and Unit. So the substitution can be tested
// against ground truth rather than argued about.
//
// Design. A fake clan is assigned to whole UNITS, so the label has exactly the
// structure real clan has: unit-determined, and constant within a unit. That is a
// TRUE NULL — the fake clans differ by nothing but which units landed in them.
// The same data is then tested twice:
//
//   correct   clusters = social unit   (what the design actually requires)
//   proxy     clusters = recording day (what a corpus without unit ids forces)
//
// A well-behaved test rejects at alpha under a true null. Any excess in the proxy
// arm is the inflation that experiment 04 carries and cannot see.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { decodeCorpus, studentisedContrast, contrastLeverage } from "../explorer/js/claims.js";
import { permutationTest } from "../explorer/js/rhythm.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(HERE, "..", "explorer", "data", "coda-corpus.json");

const ALPHA = 0.05;
const ITERATIONS = 1000;
const NCLICKS = 5;

// All C(10,5)/2 = 126 distinct 5/5 splits of EC1's 10 units are enumerated, not
// sampled. Sampling 60 of 126 estimated a quantity that can simply be computed.
//
// The comparison is PAIRED — both arms see byte-identical data and differ only
// in the permutation cluster — so the informative statistic is the paired shift
// in p, not the false-positive rate. The rate comparison is kept but is nearly
// uninformative here: with ~2 rejections per arm its 95% interval spans roughly
// 0.4-11.5%, which cannot distinguish nominal from double-nominal.
const PAIRED = true;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rule = (c = "=") => console.log(c.repeat(78));
const fmt = (v, d = 4) => (v == null || Number.isNaN(v) ? "  --  " : v.toFixed(d));
const median = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

let raw;
try {
  raw = JSON.parse(readFileSync(CORPUS, "utf8"));
} catch {
  console.error(`Corpus not found at ${CORPUS}\n  run: python3 tools/fetch_corpus.py`);
  process.exit(1);
}
if (!raw.dates) {
  console.error("This corpus has no `dates` array — re-run tools/fetch_corpus.py.");
  process.exit(1);
}
const all = decodeCorpus(raw);
all.forEach((c, i) => { c.date = raw.date[i] >= 0 ? raw.dates[raw.date[i]] : null; });

const five = all.filter((c) => c.nClicks === NCLICKS && c.unit !== "ZZZ" && c.date);

rule();
console.log("IS A RECORDING DAY A VALID STAND-IN FOR A SOCIAL UNIT?");
rule();
console.log("Calibrated on Dominica, the only corpus here that has both.\n");

const units = [...new Set(five.map((c) => c.unit))].sort();
const days = [...new Set(five.map((c) => c.date))].sort();
console.log(`  ${five.length.toLocaleString()} five-click codas`);
console.log(`  social units    ${units.length}`);
console.log(`  recording days  ${days.length}`);
console.log(`  INFLATION       ${(days.length / units.length).toFixed(1)}x more clusters than the design has`);
const perUnit = units.map((u) => [u, new Set(five.filter((c) => c.unit === u).map((c) => c.date)).size]);
console.log(`  days per unit   ${perUnit.map(([u, n]) => `${u}:${n}`).join(" ")}`);

// ---------------------------------------------------------------------------
// 1. The real EC1/EC2 test under both clusterings
// ---------------------------------------------------------------------------
rule();
console.log("1. THE REAL CLAN TEST, BOTH WAYS");
rule();
console.log("Experiment 01's standing result is p = 0.6061 (exact, 66 assignments).\n");

for (const [label, key] of [["social unit (correct)", "unit"], ["recording day (proxy)", "date"]]) {
  const items = five;
  const labels = items.map((c) => c.clan);
  const clusters = items.map((c) => c[key]);
  // A day shared by two clans cannot be permuted as one cluster. In a corpus
  // without unit ids that day would simply carry one clan label; here we can see
  // the collision, so we drop it and report it.
  const byC = new Map();
  for (let i = 0; i < items.length; i++) {
    if (!byC.has(clusters[i])) byC.set(clusters[i], new Set());
    byC.get(clusters[i]).add(labels[i]);
  }
  const mixed = [...byC.entries()].filter(([, s]) => s.size > 1).map(([k]) => k);
  const keep = items.filter((c) => !mixed.includes(c[key]));
  const res = permutationTest({
    items: keep,
    labels: keep.map((c) => c.clan),
    clusters: keep.map((c) => c[key]),
    statistic: studentisedContrast,
    iterations: ITERATIONS, seed: 1,
  });
  console.log(`  ${label.padEnd(23)} clusters ${String(res.clusterCount).padStart(4)}   ` +
              `T ${fmt(res.observed, 3)}   p ${fmt(res.p)}   ` +
              `resolution ${res.pResolutionLimit.toExponential(1)}` +
              `${res.exhaustive ? "  (exact)" : ""}`);
  if (mixed.length) console.log(`  ${" ".repeat(23)} dropped ${mixed.length} multi-clan ${key}s`);
}

// ---------------------------------------------------------------------------
// 2. False-positive rate under a TRUE NULL, both ways
// ---------------------------------------------------------------------------
rule();
console.log("2. FALSE-POSITIVE RATE UNDER A TRUE NULL");
rule();
console.log("A fake clan is assigned to whole UNITS of EC1, so the label is");
console.log("unit-determined exactly as real clan is, and differs by nothing else.");
console.log(`Both arms see identical data. ALL 5/5 splits enumerated, alpha = ${ALPHA}.\n`);

const ec1Units = [...new Set(five.filter((c) => c.clan === "EC1").map((c) => c.unit))].sort();
const ec1 = five.filter((c) => c.clan === "EC1");
console.log(`  EC1: ${ec1.length.toLocaleString()} codas, ${ec1Units.length} units, ` +
            `${new Set(ec1.map((c) => c.date)).size} days`);

// Enumerate every 5/5 split, keeping one of each complementary pair.
const halves = [];
const n = ec1Units.length, half = Math.floor(n / 2);
const walk = (start, chosen) => {
  if (chosen.length === half) { halves.push(chosen.slice()); return; }
  for (let i = start; i <= n - (half - chosen.length); i++) { chosen.push(i); walk(i + 1, chosen); chosen.pop(); }
};
walk(0, []);
const splits = halves.filter((h) => h.includes(0));   // drop complements
console.log(`  distinct ${half}/${n - half} splits: ${splits.length}\n`);

const arm = { unit: [], date: [] };
const paired = [];
let dropped = 0;
for (let s = 0; s < splits.length; s++) {
  const groupA = new Set(splits[s].map((i) => ec1Units[i]));
  const tagged = ec1.map((c) => ({ ...c, fake: groupA.has(c.unit) ? "X" : "Y" }));
  const got = {};

  for (const key of ["unit", "date"]) {
    // Drop clusters that straddle the fake split (only possible for `date`).
    const byC = new Map();
    for (const c of tagged) {
      if (!byC.has(c[key])) byC.set(c[key], new Set());
      byC.get(c[key]).add(c.fake);
    }
    const mixed = new Set([...byC.entries()].filter(([, v]) => v.size > 1).map(([k]) => k));
    const keep = tagged.filter((c) => !mixed.has(c[key]));
    if (key === "date") dropped += mixed.size;
    const A = keep.filter((c) => c.fake === "X"), B = keep.filter((c) => c.fake === "Y");
    if (!A.length || !B.length || contrastLeverage(A, B) <= 0) continue;
    const res = permutationTest({
      items: keep,
      labels: keep.map((c) => c.fake),
      clusters: keep.map((c) => c[key]),
      statistic: studentisedContrast,
      iterations: ITERATIONS, seed: s + 1,
    });
    arm[key].push({ p: res.p, clusters: res.clusterCount, T: res.observed });
    got[key] = res;
  }
  if (got.unit && got.date) {
    paired.push({
      pUnit: got.unit.p, pDate: got.date.p,
      sdUnit: got.unit.nullSd, sdDate: got.date.nullSd,
      meanUnit: got.unit.nullMean, meanDate: got.date.nullMean,
    });
  }
}

console.log(`${"clustering".padEnd(24)} ${"n".padStart(4)} ${"clusters".padStart(9)} ` +
            `${"median p".padStart(9)} ${"p<0.05".padStart(8)} ${"rate".padStart(7)}`);
console.log("-".repeat(78));
const rates = {};
for (const [key, label] of [["unit", "social unit (correct)"], ["date", "recording day (proxy)"]]) {
  const a = arm[key];
  const hits = a.filter((r) => r.p < ALPHA).length;
  rates[key] = hits / a.length;
  console.log(`${label.padEnd(24)} ${String(a.length).padStart(4)} ` +
              `${median(a.map((r) => r.clusters)).toFixed(0).padStart(9)} ` +
              `${fmt(median(a.map((r) => r.p)), 3).padStart(9)} ` +
              `${String(hits).padStart(8)} ${(100 * rates[key]).toFixed(1).padStart(6)}%`);
}
console.log("-".repeat(78));
console.log(`  nominal rate ${(100 * ALPHA).toFixed(0)}%`);
console.log(`  multi-clan days dropped from the proxy arm: ${dropped} across ${splits.length} splits`);
console.log(`\n  The rate comparison above is NEARLY UNINFORMATIVE and is not the result:`);
console.log(`  with ~${arm.unit.filter((r) => r.p < ALPHA).length} rejections per arm its 95% interval spans` +
            ` roughly 0.4-11.5%, which`);
console.log(`  cannot separate nominal from double-nominal. The paired test below can.`);

// ---------------------------------------------------------------------------
// 3. Paired shift — the informative comparison
// ---------------------------------------------------------------------------
rule();
console.log("3. PAIRED SHIFT IN p — the same data, only the cluster changes");
rule();

const lower = paired.filter((r) => r.pDate < r.pUnit).length;
const ties = paired.filter((r) => r.pDate === r.pUnit).length;
const nEff = paired.length - ties;

// Exact two-sided sign test.
function logC(n, k) {
  let s = 0;
  for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i);
  return s;
}
function binomTwoSided(k, n) {
  const pmf = (i) => Math.exp(logC(n, i) + n * Math.log(0.5));
  const obs = pmf(k);
  let p = 0;
  for (let i = 0; i <= n; i++) if (pmf(i) <= obs * (1 + 1e-9)) p += pmf(i);
  return Math.min(1, p);
}

console.log(`  splits compared              ${paired.length}`);
console.log(`  median p, social unit        ${fmt(median(paired.map((r) => r.pUnit)), 4)}`);
console.log(`  median p, recording day      ${fmt(median(paired.map((r) => r.pDate)), 4)}`);
console.log(`  splits where day gives a SMALLER p: ${lower} of ${nEff}` +
            `  (sign test p = ${binomTwoSided(lower, nEff).toExponential(2)})`);

const sdRatio = paired.map((r) => (r.sdUnit > 0 ? r.sdDate / r.sdUnit : NaN)).filter(Number.isFinite);
console.log(`\n  WHY: the day-permuted null is narrower, because a permuted group drawn`);
console.log(`  from 80 days contains pieces of every unit and so sits near the grand`);
console.log(`  mean, while a group of 5 whole units varies by the between-unit variance.`);
console.log(`  null SD ratio (day / unit)   median ${fmt(median(sdRatio), 3)}  ` +
            `min ${fmt(Math.min(...sdRatio), 3)}  max ${fmt(Math.max(...sdRatio), 3)}`);

rule();
console.log("READING THIS");
rule();
const signP = binomTwoSided(lower, nEff);
if (signP < 0.05 && lower > nEff / 2) {
  console.log("  Permuting recording days in place of social units IS anti-conservative.");
  console.log("  It shifts p DOWNWARD systematically, because it under-represents");
  console.log("  between-unit variance in the null. Experiment 04's p-values are");
  console.log("  therefore optimistic and its pair counts are UPPER BOUNDS.");
  console.log("");
  console.log("  What it does NOT show is how much that matters at a threshold. On this");
  console.log("  corpus almost every p sits far from 0.05, so the shift changes few");
  console.log("  verdicts — the rate comparison in section 2 is flat. In experiment 04,");
  console.log("  where many pairs return p = 0.0005, the shift has more room to matter,");
  console.log("  and nothing here bounds it there.");
} else {
  console.log("  No systematic shift detected. Permuting recording days in place of");
  console.log("  social units does not measurably inflate significance on this corpus.");
}
console.log("\n  Caveat that limits this in BOTH directions: Dominica is a longitudinal");
console.log("  study of a small resident population — one unit contributes up to 29");
console.log("  recording days. The Pacific corpus is 23 regions over 39 years of largely");
console.log("  opportunistic survey, where repeat encounters with the same unit are much");
console.log("  rarer. This measures the substitution where it is worst, not where");
console.log("  experiment 04 applies it.");
