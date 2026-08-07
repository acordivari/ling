// exp07_vowel_individual.mjs — is the coda vowel a property of the INDIVIDUAL,
// or of which coda types that individual happens to produce?
//
//     node tools/exp07_vowel_individual.mjs
//
// Rendell's objection to the coda-vowel claim runs through click structure: a
// click is a pulse train, and its internal spacing scales with body size. If
// that is what the a/i categories track, vowel should be a stable property of an
// ANIMAL. If it is phonology, it should vary within an animal by context.
//
// This is experiment 01's confound one level up. Whales differ in repertoire
// (ATWOOD is 260/359 type `1+1+3`, SAM is 45/52 type `5R1`) and coda type
// predicts vowel strongly on its own (`1+1+3` is 46.1% "i", `5R1` is 7.7%). So a
// raw between-whale difference is mostly a difference in which codas each whale
// produces.
//
// Three arms, in increasing honesty about non-independence:
//
//   A  stratified by coda type, permuted at CODA level
//   B  joint: residualise by coda type, permute whale across BOUTS
//   C  joint: residualise by coda type, permute whale across DEPLOYMENTS
//
// Arm A treats codas from one whale in one bout as independent draws.
// Experiment 04 measured that substitution against ground truth and found it
// ANTI-CONSERVATIVE: 101 of 126 true-null splits shifted p downward, sign test
// p = 5e-12. Arms B and C exist because of that measurement.
//
// Uses the SHIPPED permutationTest from explorer/js/rhythm.js, including its
// joint strata x clusters mode. Nothing is reimplemented here.
//
// PRE-REGISTERED. Every constant below was fixed before any p was run.

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { permutationTest, fdr } from "../explorer/js/rhythm.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const JOINED = join(HERE, "..", "data", "vowel", "joined.json");
const ART = join(HERE, "..", "experiments", "07-vowel-artifact", "artifacts");

// --- pre-registered constants ----------------------------------------------
const MIN_N = 15;          // codas per whale to enter at all
const MIN_LEVERAGE = 33.3; // Dominica's leverage in exp 01 — the design that
                           // experiment called UNDERPOWERED. Below it, no p.
const MIN_ASSIGNMENTS = 20; // a cluster permutation cannot reach p < 0.05 with
                            // fewer distinct assignments than 1/0.05. Pairs
                            // below this are NOT tested and NOT counted as null.
const ITERATIONS = 4000;
const SEED = 707;
const ALPHA = 0.05;

const fmt = (v, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : "   n/a");
const rule = (c = "=") => console.log(c.repeat(78));
const comb = (n, k) => { let c = 1; for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1); return Math.round(c); };

if (!existsSync(JOINED)) {
  console.error(`missing ${JOINED}\n  run: python3 tools/exp07_join_bouts.py`);
  process.exit(1);
}
const J = JSON.parse(readFileSync(JOINED, "utf8"));
const recs = J.rows.filter((r) => r.handv === "a" || r.handv === "i");

const byWhale = new Map();
for (const r of recs) {
  if (!byWhale.has(r.whale)) byWhale.set(r.whale, []);
  byWhale.get(r.whale).push(r);
}
const whales = [...byWhale.keys()].filter((w) => byWhale.get(w).length >= MIN_N).sort();

rule();
console.log("EXPERIMENT 07 — is the coda vowel individual, or repertoire composition?");
rule();
console.log(`  ${recs.length} joined + vowel-labelled codas   ${byWhale.size} named whales   ` +
            `${whales.length} with n >= ${MIN_N}`);
console.log(`  join       Duration, ${J.counts.uniquelyMatched} uniquely matched, ` +
            `all validations passed`);
console.log(`  statistic  |P(vowel=i | A) - P(vowel=i | B)|   kind: distance`);
console.log();

const lev = (A, B) => {
  const ta = new Map(), tb = new Map();
  for (const r of A) ta.set(r.codatype, (ta.get(r.codatype) || 0) + 1);
  for (const r of B) tb.set(r.codatype, (tb.get(r.codatype) || 0) + 1);
  let L = 0;
  for (const [t, na] of ta) { const nb = tb.get(t); if (nb) L += (na * nb) / (na + nb); }
  return L;
};
const uniq = (rs, k) => new Set(rs.map((r) => r[k])).size;

const pairs = [];
for (let i = 0; i < whales.length; i++) {
  for (let j = i + 1; j < whales.length; j++) {
    const A = byWhale.get(whales[i]), B = byWhale.get(whales[j]);
    pairs.push({
      a: whales[i], b: whales[j], nA: A.length, nB: B.length, leverage: lev(A, B),
      boutsA: uniq(A, "rec"), boutsB: uniq(B, "rec"),
      depsA: uniq(A, "deployment"), depsB: uniq(B, "deployment"),
    });
  }
}
pairs.sort((x, y) => y.leverage - x.leverage);
const testable = pairs.filter((p) => p.leverage >= MIN_LEVERAGE);
console.log(`  ${pairs.length} pairs   median leverage ` +
            `${fmt(pairs[Math.floor(pairs.length / 2)].leverage, 1)}   ` +
            `${pairs.length - testable.length} below exp 01's ${MIN_LEVERAGE} and not tested`);
console.log();

// --- the three arms ---------------------------------------------------------
const val = (r) => [r.handv === "i" ? 1 : 0];
const stat = (P, Q) => Math.abs(P.reduce((t, v) => t + v[0], 0) / P.length -
                                Q.reduce((t, v) => t + v[0], 0) / Q.length);

function run(p, clusterKey) {
  const A = byWhale.get(p.a), B = byWhale.get(p.b);
  const all = [...A, ...B];
  const opts = {
    items: all.map(val),
    labels: [...A.map(() => p.a), ...B.map(() => p.b)],
    strata: all.map((r) => r.codatype),
    statistic: stat, iterations: ITERATIONS, seed: SEED, kind: "distance",
  };
  if (clusterKey) opts.clusters = all.map((r) => r[clusterKey]);
  return permutationTest(opts);
}

const ARMS = [
  { id: "A", label: "stratified, permuted at CODA level", cluster: null },
  { id: "B", label: "joint, permuted across BOUTS", cluster: "rec" },
  { id: "C", label: "joint, permuted across DEPLOYMENTS", cluster: "deployment" },
];

// --- negative control -------------------------------------------------------
// Split a single whale in half and test it against itself. There is no real
// difference by construction, so the arm must fire at about alpha. For the
// clustered arms the split is over BOUTS, not codas — splitting codas would hand
// the cluster permutation a structure the real design never has.
function negativeControl(arm) {
  let s = SEED, fired = 0, ran = 0;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (const w of whales) {
    const rs = byWhale.get(w);
    for (let k = 0; k < 12; k++) {
      let A, B;
      if (arm.cluster) {
        const units = [...new Set(rs.map((r) => r[arm.cluster]))]
          .map((u) => [rnd(), u]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
        if (comb(units.length, units.length >> 1) < MIN_ASSIGNMENTS) continue;
        const half = new Set(units.slice(0, units.length >> 1));
        A = rs.filter((r) => half.has(r[arm.cluster]));
        B = rs.filter((r) => !half.has(r[arm.cluster]));
      } else {
        const sh = rs.map((r) => [rnd(), r]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
        A = sh.slice(0, sh.length >> 1); B = sh.slice(sh.length >> 1);
      }
      if (!A.length || !B.length || lev(A, B) < MIN_LEVERAGE) continue;
      const all = [...A, ...B];
      const opts = {
        items: all.map(val), labels: [...A.map(() => "x"), ...B.map(() => "y")],
        strata: all.map((r) => r.codatype), statistic: stat,
        iterations: 1000, seed: SEED + k, kind: "distance",
      };
      if (arm.cluster) opts.clusters = all.map((r) => r[arm.cluster]);
      ran++;
      if (permutationTest(opts).p < ALPHA) fired++;
    }
  }
  return { ran, fired };
}

const results = {};
for (const arm of ARMS) {
  console.log(`ARM ${arm.id} — ${arm.label}`);
  const nc = negativeControl(arm);
  console.log(`  negative control (whale split against itself): ` +
              (nc.ran ? `${nc.fired}/${nc.ran} fired at p < ${ALPHA} = ` +
                        `${fmt(100 * nc.fired / nc.ran, 1)}%  [nominal ${100 * ALPHA}%]  ` +
                        `${nc.fired / nc.ran <= 0.15 ? "pass" : "FAIL"}`
                      : "no split has enough leverage/assignments — NOT RUN"));
  const rows = [], skipped = [];
  for (const p of testable) {
    if (arm.cluster) {
      const n1 = arm.cluster === "rec" ? p.boutsA : p.depsA;
      const n2 = arm.cluster === "rec" ? p.boutsB : p.depsB;
      const C = comb(n1 + n2, n1);
      if (C < MIN_ASSIGNMENTS) {
        skipped.push({ ...p, assignments: C });
        continue;
      }
    }
    const r = run(p, arm.cluster);
    rows.push({ a: p.a, b: p.b, leverage: p.leverage, observed: r.observed,
                nullMean: r.nullMean, explainedByNull: r.explainedByNull, p: r.p,
                assignments: r.distinctAssignments ?? null,
                pFloor: r.pResolutionLimit ?? null });
  }
  const q = rows.length ? fdr(rows.map((r) => r.p)) : [];
  rows.forEach((r, i) => { r.q = q[i]; });
  const sig = rows.filter((r) => r.q < ALPHA);
  results[arm.id] = { label: arm.label, negativeControl: nc, tested: rows, skipped,
                      significant: sig.map((s) => `${s.a}/${s.b}`) };

  if (!rows.length) {
    console.log(`  no pair has ${MIN_ASSIGNMENTS}+ distinct assignments — nothing is testable`);
  } else {
    // Assignment counts run to 10^12; give them their own wide column so the
    // q-value beside them stays readable.
    const sci = (v) => (v == null ? "—"
      : v >= 1e6 ? v.toExponential(2).replace("e+", "e") : v.toLocaleString());
    console.log(`  ${"pair".padEnd(20)}${"lev".padStart(7)}${"obs".padStart(8)}` +
                `${"null".padStart(8)}${"p".padStart(9)}${"q".padStart(9)}` +
                `${"assignments".padStart(14)}`);
    for (const r of rows) {
      console.log(`  ${(r.a + "/" + r.b).padEnd(20)}${fmt(r.leverage, 1).padStart(7)}` +
                  `${fmt(r.observed, 3).padStart(8)}${fmt(r.nullMean, 3).padStart(8)}` +
                  `${fmt(r.p).padStart(9)}${fmt(r.q).padStart(9)}` +
                  `${sci(r.assignments).padStart(14)}`);
    }
  }
  if (skipped.length) {
    console.log(`  not testable (< ${MIN_ASSIGNMENTS} distinct assignments): ${skipped.length} pairs — ` +
                skipped.map((s) => `${s.a}/${s.b}(C=${s.assignments})`).join(", "));
  }
  console.log(`  => ${results[arm.id].significant.length} of ${rows.length} significant at q < ${ALPHA}` +
              (results[arm.id].significant.length ? ": " + results[arm.id].significant.join(", ") : ""));
  console.log();
}

rule();
console.log("LADDER");
for (const arm of ARMS) {
  const r = results[arm.id];
  console.log(`  ${arm.id}  ${arm.label.padEnd(38)} ` +
              `${r.significant.length} of ${r.tested.length} significant` +
              (r.skipped.length ? `   (${r.skipped.length} not testable)` : ""));
}
rule();

mkdirSync(ART, { recursive: true });
writeFileSync(join(ART, "vowel_individual.json"), JSON.stringify({
  experiment: "07-vowel-artifact", stage: "individual-vs-composition",
  preregistered: { MIN_N, MIN_LEVERAGE, MIN_ASSIGNMENTS, ITERATIONS, SEED, ALPHA },
  join: J.counts, nCodas: recs.length, whalesTested: whales.length,
  allPairs: pairs, arms: results,
}, null, 2));
console.log(`  written ${join(ART, "vowel_individual.json")}`);
