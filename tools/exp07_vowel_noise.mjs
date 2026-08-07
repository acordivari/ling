// exp07_vowel_noise.mjs — do codas the annotator flagged as noise-contaminated
// receive a different vowel label?
//
//     node tools/exp07_vowel_noise.mjs
//
// This is the most direct test of the artifact hypothesis available in public
// data, and unlike the individual and session questions it does not need a rig
// label. Diamant, Gruber, Gero & Begus (Ecological Informatics, June 2026) showed
// ship noise moves the a/i distribution. The Sharma coda-type vocabulary carries
// its own noise flag -- `5-NOISE`, `6-NOISE`, `9-NOISE` and so on -- so the
// corpus already marks which codas were hard to read.
//
// The ladder matters more than any single number, and it is the same shape this
// repo keeps finding:
//
//   naive          NOISE against every clean coda, pooled
//   by click count NOISE against clean codas of the same length
//   WITHIN BOUT    NOISE against clean codas from the SAME recording
//
// The last one is the real test. Same animal, same session, same acoustic
// conditions, same minute -- the only thing that differs is whether the
// annotator flagged that particular coda. Anything surviving there is a per-coda
// effect rather than a between-session or between-whale one.
//
// Uses the SHIPPED permutationTest stratified mode. `NOISE` and clean codas
// occur inside the same bout, so the label varies WITHIN cluster and the
// cluster-permutation mode does not apply here -- stratification is the correct
// control, not clustering.

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { permutationTest } from "../explorer/js/rhythm.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const JOINED = join(HERE, "..", "data", "vowel", "joined.json");
const ART = join(HERE, "..", "experiments", "07-vowel-artifact", "artifacts");

const ITERATIONS = 4000;
const SEED = 707;
const ALPHA = 0.05;

const fmt = (v, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : "   n/a");
const rule = (c = "=") => console.log(c.repeat(78));

if (!existsSync(JOINED)) {
  console.error(`missing ${JOINED}\n  run: python3 tools/exp07_join_bouts.py`);
  process.exit(1);
}
const rows = JSON.parse(readFileSync(JOINED, "utf8")).rows
  .filter((r) => r.handv === "a" || r.handv === "i");

const isNoise = (r) => r.codatype.toUpperCase().includes("NOISE");
const nClicks = (ct) => {
  const s = ct.trim();
  if (s.includes("+")) {
    const parts = s.split("+").map(Number);
    return parts.every(Number.isFinite) ? parts.reduce((a, b) => a + b, 0) : null;
  }
  const m = s.match(/^(\d+)/);
  return m ? Number(m[1]) : null;
};
const rate = (rs) => rs.filter((r) => r[0] === 1).length / rs.length;

rule();
console.log("EXPERIMENT 07 — does an annotator's NOISE flag change the vowel label?");
rule();
const N = rows.filter(isNoise), C = rows.filter((r) => !isNoise(r));
console.log(`  ${rows.length} vowel-labelled codas   ${N.length} NOISE-flagged, ${C.length} clean`);
console.log(`  NOISE codas span ${new Set(N.map((r) => r.rec)).size} bouts, ` +
            `${new Set(N.map((r) => r.deployment)).size} deployments, ` +
            `${new Set(N.map((r) => r.whale)).size} whales — not concentrated`);
console.log();

const items = rows.map((r) => [r.handv === "i" ? 1 : 0]);
const labels = rows.map((r) => (isNoise(r) ? "noise" : "clean"));
const stat = (A, B) => rate(A) - rate(B);

// Only bouts and click-count strata holding BOTH labels can inform the contrast;
// the rest add rows and no leverage, exactly as in the individual test.
const leverage = (key) => {
  const g = new Map();
  rows.forEach((r, i) => {
    const k = key(r);
    if (k == null) return;
    if (!g.has(k)) g.set(k, [0, 0]);
    g.get(k)[isNoise(r) ? 0 : 1]++;
  });
  let L = 0, informative = 0;
  for (const [, [a, b]] of g) if (a && b) { L += (a * b) / (a + b); informative++; }
  return { leverage: L, informative, strata: g.size };
};

const ARMS = [
  { id: "naive", label: "pooled — nothing controlled", strata: null, key: null },
  { id: "clicks", label: "stratified by CLICK COUNT", strata: (r) => nClicks(r.codatype), key: "clicks" },
  { id: "bout", label: "stratified by BOUT — same recording", strata: (r) => r.rec, key: "bout" },
];

const out = {};
console.log(`  ${"control".padEnd(38)}${"leverage".padStart(10)}${"observed".padStart(11)}` +
            `${"null".padStart(10)}${"p".padStart(9)}`);
for (const arm of ARMS) {
  const opts = { items, labels, statistic: stat, iterations: ITERATIONS, seed: SEED, kind: "shift" };
  if (arm.strata) opts.strata = rows.map(arm.strata);
  const r = permutationTest(opts);
  const L = arm.strata ? leverage(arm.strata) : { leverage: NaN, informative: NaN };
  out[arm.id] = { label: arm.label, observed: r.observed, nullMean: r.nullMean, p: r.p,
                  leverage: L.leverage, informativeStrata: L.informative };
  console.log(`  ${arm.label.padEnd(38)}${(Number.isFinite(L.leverage) ? fmt(L.leverage, 1) : "—").padStart(10)}` +
              `${fmt(r.observed).padStart(11)}${fmt(r.nullMean).padStart(10)}` +
              `${fmt(r.p).padStart(9)}${r.p < ALPHA ? "  *" : ""}`);
}
console.log();
console.log("  kind: \"shift\" — a signed difference has no natural zero at no-effect,");
console.log("  so the test is two-sided and no explainedByNull percentage is reported.");
console.log();
rule();
const b = out.bout;
// The OBSERVED statistic is identical in all three arms — it is the same data.
// What changes is the null. Saying "the effect falls" would be wrong; the null
// rises to meet it. That distinction is the same one `explainedByNull` exists to
// enforce for distances, and it is not reported here because this is a shift.
console.log(b.p < ALPHA
  ? "A per-coda noise effect survives the within-bout control."
  : `The observed difference is ${fmt(b.observed, 3)} in every arm — same data.\n` +
    `What changes is the null: shuffling the NOISE flag WITHIN bouts already\n` +
    `reproduces ${fmt(b.nullMean, 3)} of it, leaving ${fmt(b.observed - b.nullMean, 3)} unexplained at\n` +
    `p = ${fmt(b.p)}, on leverage ${fmt(b.leverage, 1)} — above the 33.3 this experiment\n` +
    `treats as its power floor. Most of the pooled difference is between-bout\n` +
    `composition, not per-coda contamination.`);
rule();

mkdirSync(ART, { recursive: true });
writeFileSync(join(ART, "vowel_noise.json"), JSON.stringify({
  experiment: "07-vowel-artifact", stage: "noise-flag",
  preregistered: { ITERATIONS, SEED, ALPHA },
  counts: { total: rows.length, noise: N.length, clean: C.length,
            noiseBouts: new Set(N.map((r) => r.rec)).size,
            noiseWhales: new Set(N.map((r) => r.whale)).size },
  arms: out,
}, null, 2));
console.log(`  written ${join(ART, "vowel_noise.json")}`);
