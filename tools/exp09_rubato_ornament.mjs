// exp09_rubato_ornament.mjs — do rubato and ornamentation survive controls?
//
//     node tools/exp09_rubato_ornament.mjs
//
// Tests the two exchange-level dimensions of Sharma et al. 2024's "phonetic
// alphabet" — ornamentation (S1) and rubato (S2) — against the authors' own
// per-coda labels, controlling for rhythm-class composition and for how the
// sequences were cut. See experiments/09-rubato-ornamentation/README.md for the
// pre-registration; the gates, nulls, sweep and prediction were fixed there
// before this file was written.
//
// Implementation decisions the pre-registration left open, fixed here before
// first run:
//
//   1. "Separated by no more than GAP seconds" is OFFSET-to-onset: the silence
//      between codas, next.ts - (prev.ts + prev.dur). The sweep exists because
//      any such choice is arbitrary.
//   2. Runs are formed on the whale's full post-G0 timeline, INCLUDING codas
//      later excluded from observations (residual class 17, zero-duration).
//      Being sequence-final is a physical fact about what the whale produced;
//      exclusion removes a coda's *observation*, not the event. A run whose
//      final coda is unclassifiable simply contributes no final observation.
//   3. For S2, excluded codas BREAK a run into fragments rather than being
//      spliced over — splicing would manufacture adjacency between codas that
//      were never adjacent. Fragments need >= 3 codas (a 2-coda fragment has
//      per-fragment-centered lag-1 product identically <= 0: degenerate).
//   4. The S2 statistic is the pooled per-fragment-centered lag-1
//      autocorrelation: sum over fragments of sum_i (d_i - m_f)(d_{i+1} - m_f)
//      divided by the pooled sum of (d_i - m_f)^2. Short fragments give it a
//      negative small-sample bias (~ -1/(n-1)); the shuffle null has the SAME
//      bias, so the comparison is unaffected. Reported once, here.
//
// Everything below is deterministic given SEED.

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { makeRng } from "../explorer/js/random.js";
import { permutationTest } from "../explorer/js/rhythm.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSV = join(HERE, "..", "data", "sperm-whale-dialogues.csv");
const LABELS = join(HERE, "..", "data", "sharma_labels", "labels.json");
const ART = join(HERE, "..", "experiments", "09-rubato-ornamentation", "artifacts");

// --- pre-registered constants ----------------------------------------------
const SEED = 909;
const ITERATIONS = 2000;
const GAPS = [3, 5, 10, 15, 30];   // s of silence; the segmentation sweep
const ALPHA = 0.05;
const MIN_LEVERAGE = 33.3;         // exp01's floor, carried through 04/07
const MIN_RUN_S1 = 2;              // a run must have a final AND a non-final
const MIN_FRAG_S2 = 3;             // see decision 3 above
const NC_REPEATS = 40;             // placebo repeats per arm per gap
const NC_ITER = 1000;

const fmt = (v, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : "   n/a");
const rule = (c = "=") => console.log(c.repeat(78));
const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;
const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((v) => (v - m) ** 2))); };

for (const f of [CSV, LABELS]) if (!existsSync(f)) {
  console.error(`missing ${f}\n  run: python3 tools/fetch_corpus.py && ` +
                `./wham/.venv/bin/python tools/fetch_sharma_labels.py`);
  process.exit(1);
}

// --- load, attaching labels BY ROW INDEX before any filtering ---------------
// (CRLF trap documented in exp08: the deposit ships \r\n line endings.)
const lines = readFileSync(CSV, "utf8").trim().split(/\r?\n/);
const head = lines[0].replace(/^﻿/, "").split(",").map((s) => s.trim());
const iREC = head.indexOf("REC"), iN = head.indexOf("nClicks");
const iDur = head.indexOf("Duration"), iW = head.indexOf("Whale"), iTs = head.indexOf("TsTo");
const lab = JSON.parse(readFileSync(LABELS, "utf8"));

const all = lines.slice(1).map((l, i) => {
  const p = l.split(",");
  const rec = p[iREC];
  const m = rec.match(/^(sw\d+)([a-z])/);
  return { i, rec, deployment: m ? m[1] : rec, tag: m ? m[2] : "?",
           whale: p[iW], ts: Number(p[iTs]), dur: Number(p[iDur]),
           nClicks: Number(p[iN]), cls: lab.rhythms[i], orn: lab.ornaments[i] };
});
if (lab.rhythms.length !== all.length || lab.ornaments.length !== all.length) {
  console.error(`label/CSV length mismatch: ${lab.rhythms.length} vs ${all.length}`);
  process.exit(1);
}
if (all.some((r) => !Number.isFinite(r.ts))) {
  console.error("non-numeric TsTo — the CRLF trap or worse; refusing to continue");
  process.exit(1);
}

rule();
console.log("EXPERIMENT 09 — do rubato and ornamentation survive controls?");
rule();
console.log(`  ${all.length} codas   ${new Set(all.map((r) => r.rec)).size} recordings   ` +
            `${new Set(all.map((r) => r.deployment)).size} deployments   ` +
            `${all.reduce((s, r) => s + r.orn, 0)} ornamented`);

// --- G1: alignment, re-derived here rather than trusted from the fetch ------
// Residual-class RULE (not a hardcoded class id): a class whose members' click
// counts MOSTLY disagree with its own centroid click count is a bucket, not a
// category. Finds class 17 and nothing else.
const K = lab.classClickCounts.length;
if (lab.meanCodas.some((c, k) => c.length !== lab.classClickCounts[k])) {
  console.error("classClickCounts disagrees with meanCodas lengths"); process.exit(1);
}
const clsMatch = Array.from({ length: K }, () => [0, 0]); // [match, total]
for (const r of all) {
  clsMatch[r.cls][1]++;
  if (r.nClicks === lab.classClickCounts[r.cls]) clsMatch[r.cls][0]++;
}
const residual = new Set();
clsMatch.forEach(([m, t], k) => { if (t > 0 && m / t < 0.5) residual.add(k); });
const agree = all.filter((r) => r.nClicks === lab.classClickCounts[r.cls]).length;
const mismOutside = all.filter((r) => !residual.has(r.cls) &&
                                      r.nClicks !== lab.classClickCounts[r.cls]).length;
const g1 = agree / all.length >= 0.95 && mismOutside === 0;
console.log(`  G1  nClicks == class centroid: ${agree}/${all.length} = ` +
            `${fmt(100 * agree / all.length, 2)}%   residual classes {${[...residual]}}   ` +
            `mismatches outside residual: ${mismOutside}   ${g1 ? "PASS" : "FAIL"}`);
if (!g1) process.exit(1);
// Consequence worth having on the record: within every NON-residual class,
// click count is exactly the centroid's. Within-class duration variation is
// therefore pure timing, never click-count — which is what makes S2b's
// within-class shuffle a test of rubato rather than of coda length.

// --- G2: zero-duration single clicks ----------------------------------------
const zeroDur = all.filter((r) => r.dur === 0);
const g2 = zeroDur.every((r) => r.nClicks === 1);
console.log(`  G2  zero-duration codas: ${zeroDur.length}, all single-click: ` +
            `${g2 ? "yes" : "NO"}   all in residual class: ` +
            `${zeroDur.every((r) => residual.has(r.cls)) ? "yes" : "NO"}`);
if (!g2) process.exit(1);

// A coda contributes OBSERVATIONS only if classifiable and durationful.
const observable = (r) => !residual.has(r.cls) && r.dur > 0;

// --- G0: one tag per deployment (carried unchanged from exp08) --------------
const tagCount = new Map();
for (const r of all) {
  const k = `${r.deployment}|${r.tag}`;
  tagCount.set(k, (tagCount.get(k) || 0) + 1);
}
const keepTag = new Map();
for (const [k, n] of tagCount) {
  const [dep, tag] = k.split("|");
  const cur = keepTag.get(dep);
  if (!cur || n > cur.n || (n === cur.n && tag < cur.tag)) keepTag.set(dep, { tag, n });
}
const rows = all.filter((r) => keepTag.get(r.deployment).tag === r.tag);
const g0 = [...new Set(rows.map((r) => r.deployment))]
  .every((d) => new Set(rows.filter((r) => r.deployment === d).map((r) => r.tag)).size === 1);
console.log(`  G0  one tag per deployment: ${g0 ? "PASS" : "FAIL"}   ` +
            `kept ${rows.length} of ${all.length} codas ` +
            `(${(100 * rows.length / all.length).toFixed(1)}%)`);
if (!g0) process.exit(1);

// --- the confound, restated on the post-G0 observation universe -------------
const obsRows = rows.filter(observable);
const perClass = new Map();
for (const r of obsRows) {
  if (!perClass.has(r.cls)) perClass.set(r.cls, { n: 0, orn: 0 });
  const c = perClass.get(r.cls); c.n++; c.orn += r.orn;
}
const confound = [...perClass.entries()].map(([cls, c]) => ({ cls, ...c, rate: c.orn / c.n }))
  .sort((a, b) => b.rate - a.rate);
console.log(`  observation universe: ${obsRows.length} codas, ` +
            `${obsRows.reduce((s, r) => s + r.orn, 0)} ornamented; ornament rate by class: ` +
            confound.slice(0, 4).map((c) => `${c.cls}:${fmt(c.rate, 2)}`).join("  ") +
            `  ...  2:${fmt(perClass.get(2)?.orn / perClass.get(2)?.n, 3)}`);
console.log();

// --- run construction --------------------------------------------------------
// A run: consecutive codas by the SAME speaker within one recording, split
// where the silence (offset-to-onset) exceeds `gap`. Built on the full post-G0
// timeline — see decision 2 in the header.
function buildRuns(gap) {
  const bySpk = new Map();
  for (const r of rows) {
    const k = `${r.rec}|${r.whale}`;
    if (!bySpk.has(k)) bySpk.set(k, []);
    bySpk.get(k).push(r);
  }
  const runs = [];
  let negGaps = 0;
  for (const [, rs] of bySpk) {
    rs.sort((a, b) => a.ts - b.ts || a.i - b.i);
    let cur = [rs[0]];
    for (let j = 1; j < rs.length; j++) {
      const silence = rs[j].ts - (rs[j - 1].ts + rs[j - 1].dur);
      if (silence < 0) negGaps++;
      if (silence > gap) { runs.push(cur); cur = [rs[j]]; }
      else cur.push(rs[j]);
    }
    runs.push(cur);
  }
  return { runs, negGaps };
}

// --- S1 machinery ------------------------------------------------------------
// Observed statistic: P(orn | final) - P(orn | non-final), identical in both
// arms. What changes is the null: the naive arm shuffles the flag anywhere, the
// stratified arm shuffles it only WITHIN rhythm class — destroying position
// while preserving class composition and per-class ornament rate, per the
// pre-registered ledger.
function s1Observations(runs, finalIndexOf = null) {
  const finals = [], nonfinals = [];
  for (const run of runs) {
    if (run.length < MIN_RUN_S1) continue;
    const fi = finalIndexOf ? finalIndexOf(run) : run.length - 1;
    run.forEach((r, j) => {
      if (!observable(r)) return;
      (j === fi ? finals : nonfinals).push(r);
    });
  }
  return { finals, nonfinals };
}
function s1Test(finals, nonfinals, { stratified, seed, iterations }) {
  const rows2 = [...finals, ...nonfinals]; // finals first => gA === "final"
  const opts = {
    items: rows2.map((r) => [r.orn]),
    labels: [...finals.map(() => "final"), ...nonfinals.map(() => "nonfinal")],
    statistic: (A, B) => A.reduce((s, v) => s + v[0], 0) / A.length -
                         B.reduce((s, v) => s + v[0], 0) / B.length,
    iterations, seed, kind: "shift",
  };
  if (stratified) opts.strata = rows2.map((r) => r.cls);
  return permutationTest(opts);
}
// Leverage, exp07's convention: only strata holding BOTH sides of the contrast
// inform it; each contributes its harmonic pair mass.
function s1Leverage(finals, nonfinals) {
  const g = new Map();
  const bump = (cls, side) => {
    if (!g.has(cls)) g.set(cls, [0, 0]);
    g.get(cls)[side]++;
  };
  for (const r of finals) bump(r.cls, 0);
  for (const r of nonfinals) bump(r.cls, 1);
  let L = 0, informative = 0;
  for (const [, [a, b]] of g) if (a && b) { L += (a * b) / (a + b); informative++; }
  return { leverage: L, informative };
}

// --- S2 machinery ------------------------------------------------------------
function fragments(runs) {
  const frags = [];
  for (const run of runs) {
    let cur = [];
    for (const r of run) {
      if (observable(r)) cur.push(r);
      else { if (cur.length >= MIN_FRAG_S2) frags.push(cur); cur = []; }
    }
    if (cur.length >= MIN_FRAG_S2) frags.push(cur);
  }
  return frags;
}
// Pooled per-fragment-centered lag-1 autocorrelation over duration series.
function pooledR(series) {
  let num = 0, den = 0;
  for (const ds of series) {
    const m = mean(ds);
    for (let j = 0; j < ds.length - 1; j++) num += (ds[j] - m) * (ds[j + 1] - m);
    for (const d of ds) den += (d - m) ** 2;
  }
  return den > 0 ? num / den : NaN;
}
function monotoneCounts(series, lengths) {
  const out = new Map(lengths.map((L) => [L, [0, 0]])); // [monotone, total]
  for (const ds of series) {
    if (!out.has(ds.length)) continue;
    const c = out.get(ds.length); c[1]++;
    let up = true, down = true;
    for (let j = 1; j < ds.length; j++) {
      if (ds[j] <= ds[j - 1]) up = false;
      if (ds[j] >= ds[j - 1]) down = false;
    }
    if (up || down) c[0]++;
  }
  return out;
}
const shuffleInPlace = (a, rng) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
};
// One null draw. mode "seq": shuffle each fragment's durations freely.
// mode "seqXclass": shuffle only among same-class positions within a fragment,
// so the class sequence — and any duration structure it carries — is preserved.
function nullDraw(frags, rng, mode) {
  return frags.map((fr) => {
    const ds = fr.map((r) => r.dur);
    if (mode === "seq") return shuffleInPlace(ds, rng);
    const byCls = new Map();
    fr.forEach((r, j) => {
      if (!byCls.has(r.cls)) byCls.set(r.cls, []);
      byCls.get(r.cls).push(j);
    });
    const out = new Array(fr.length);
    for (const idx of byCls.values()) {
      const vals = shuffleInPlace(idx.map((j) => ds[j]), rng);
      idx.forEach((j, k) => { out[j] = vals[k]; });
    }
    return out;
  });
}
const MONO_LENGTHS = [4, 5, 6, 7, 8];
function s2Test(frags, seed, mode) {
  const observedSeries = frags.map((fr) => fr.map((r) => r.dur));
  const observed = pooledR(observedSeries);
  const monoObs = monotoneCounts(observedSeries, MONO_LENGTHS);
  const rng = makeRng(seed);
  const dist = [];
  const monoNull = new Map(MONO_LENGTHS.map((L) => [L, []]));
  for (let it = 0; it < ITERATIONS; it++) {
    const drawn = nullDraw(frags, rng, mode);
    dist.push(pooledR(drawn));
    const mc = monotoneCounts(drawn, MONO_LENGTHS);
    for (const L of MONO_LENGTHS) {
      const [m, t] = mc.get(L); if (t) monoNull.get(L).push(m / t);
    }
  }
  // Smoothness is directional: the claim is POSITIVE lag-1 autocorrelation, so
  // the p-value is one-sided high.
  const p = (dist.filter((v) => v >= observed).length + 1) / (dist.length + 1);
  return {
    observed, nullMean: mean(dist), nullSd: sd(dist),
    z: (observed - mean(dist)) / sd(dist), p,
    mono: MONO_LENGTHS.map((L) => {
      const [m, t] = monoObs.get(L);
      const nm = monoNull.get(L);
      return { L, n: t, obs: t ? m / t : NaN, null: nm.length ? mean(nm) : NaN };
    }),
  };
}
// Shuffle mass: how many independent transpositions the null actually has. A
// cell of size k contributes k-1; below ~33 the test cannot resolve anything,
// so the exp01 floor is applied to this quantity for S2/S2b.
function shuffleMass(frags, mode) {
  let mass = 0;
  for (const fr of frags) {
    if (mode === "seq") { mass += fr.length - 1; continue; }
    const byCls = new Map();
    for (const r of fr) byCls.set(r.cls, (byCls.get(r.cls) || 0) + 1);
    for (const n of byCls.values()) mass += n - 1;
  }
  return mass;
}

// --- negative controls -------------------------------------------------------
// S1: relabel a uniformly random position in each run as pseudo-final. The
// pseudo label is independent of every flag by construction, so the stratified
// test must fire at about alpha. S2/S2b: pre-shuffle each fragment once under
// the arm's OWN null, then run the full test on the placebo data — null data
// tested against the null.
function s1NegativeControl(runs, seed) {
  let fired = 0;
  for (let k = 0; k < NC_REPEATS; k++) {
    const rng = makeRng(seed + 1000 + k);
    const { finals, nonfinals } =
      s1Observations(runs, (run) => (rng() * run.length) | 0);
    if (!finals.length || !nonfinals.length) continue;
    const r = s1Test(finals, nonfinals, { stratified: true, seed: seed + 2000 + k,
                                          iterations: NC_ITER });
    if (r.p < ALPHA) fired++;
  }
  return { ran: NC_REPEATS, fired };
}
function s2NegativeControl(frags, seed, mode) {
  let fired = 0;
  for (let k = 0; k < NC_REPEATS; k++) {
    const rng = makeRng(seed + 3000 + k);
    const placeboSeries = nullDraw(frags, rng, mode);
    const placebo = frags.map((fr, fi) =>
      fr.map((r, j) => ({ ...r, dur: placeboSeries[fi][j] })));
    const observed = pooledR(placeboSeries);
    const rng2 = makeRng(seed + 4000 + k);
    let ge = 0;
    for (let it = 0; it < NC_ITER; it++) {
      if (pooledR(nullDraw(placebo, rng2, mode)) >= observed) ge++;
    }
    if ((ge + 1) / (NC_ITER + 1) < ALPHA) fired++;
  }
  return { ran: NC_REPEATS, fired };
}

// --- the sweep ---------------------------------------------------------------
const sweep = [];
for (let gi = 0; gi < GAPS.length; gi++) {
  const gap = GAPS[gi];
  const seedG = SEED + 100 * gi;
  const { runs, negGaps } = buildRuns(gap);
  const multi = runs.filter((r) => r.length >= MIN_RUN_S1);

  // S1
  const { finals, nonfinals } = s1Observations(runs);
  const lev = s1Leverage(finals, nonfinals);
  const naive = s1Test(finals, nonfinals, { stratified: false, seed: seedG, iterations: ITERATIONS });
  const strat = s1Test(finals, nonfinals, { stratified: true, seed: seedG, iterations: ITERATIONS });
  const clickDeficit = mean(finals.map((r) => r.nClicks)) - mean(nonfinals.map((r) => r.nClicks));
  const ncS1 = s1NegativeControl(runs, seedG);

  // S2 / S2b
  const frags = fragments(runs);
  const singleClass = frags.filter((fr) => new Set(fr.map((r) => r.cls)).size === 1).length;
  const s2 = s2Test(frags, seedG + 10, "seq");
  const s2b = s2Test(frags, seedG + 20, "seqXclass");
  const ncS2 = s2NegativeControl(frags, seedG + 10, "seq");
  const ncS2b = s2NegativeControl(frags, seedG + 20, "seqXclass");

  sweep.push({
    gap, runs: runs.length, multiRuns: multi.length, negGaps,
    s1: {
      finals: finals.length, nonfinals: nonfinals.length,
      leverage: lev.leverage, informativeClasses: lev.informative,
      observed: naive.observed, clickDeficit,
      naive: { nullMean: naive.nullMean, z: naive.z, p: naive.p,
               pGreater: naive.pGreater, pLess: naive.pLess },
      stratified: { nullMean: strat.nullMean, z: strat.z, p: strat.p,
                    pGreater: strat.pGreater, pLess: strat.pLess },
      negativeControl: ncS1,
    },
    s2: {
      fragments: frags.length, singleClassFragments: singleClass,
      codas: frags.reduce((s, f) => s + f.length, 0),
      massSeq: shuffleMass(frags, "seq"), massSeqXclass: shuffleMass(frags, "seqXclass"),
      seq: { observed: s2.observed, nullMean: s2.nullMean, z: s2.z, p: s2.p, mono: s2.mono },
      seqXclass: { observed: s2b.observed, nullMean: s2b.nullMean, z: s2b.z, p: s2b.p },
      negativeControl: ncS2, negativeControlXclass: ncS2b,
    },
  });
}

// --- report ------------------------------------------------------------------
console.log("S1 — IS AN ORNAMENTED CODA MORE LIKELY TO BE SEQUENCE-FINAL?");
console.log("  observed delta = P(orn|final) - P(orn|non-final); identical in both arms.");
console.log("  What changes is the null: naive shuffles the flag anywhere, stratified");
console.log("  shuffles it within rhythm class. Two-sided p (shift convention).");
console.log();
console.log(`  ${"gap".padEnd(6)}${"finals".padStart(7)}${"nonfin".padStart(8)}${"delta".padStart(9)}` +
            `${"naive-null".padStart(11)}${"z".padStart(7)}${"p".padStart(9)}` +
            `${"strat-null".padStart(11)}${"z".padStart(7)}${"p".padStart(9)}${"leverage".padStart(10)}`);
for (const s of sweep) {
  const a = s.s1;
  console.log(`  ${(s.gap + "s").padEnd(6)}${String(a.finals).padStart(7)}${String(a.nonfinals).padStart(8)}` +
              `${fmt(a.observed).padStart(9)}` +
              `${fmt(a.naive.nullMean).padStart(11)}${fmt(a.naive.z, 1).padStart(7)}${fmt(a.naive.p).padStart(8)}${a.naive.p < ALPHA ? "*" : " "}` +
              `${fmt(a.stratified.nullMean).padStart(11)}${fmt(a.stratified.z, 1).padStart(7)}${fmt(a.stratified.p).padStart(8)}${a.stratified.p < ALPHA ? "*" : " "}` +
              `${fmt(a.leverage, 1).padStart(10)}`);
}
console.log();
console.log(`  final-coda click deficit (final minus non-final mean nClicks): ` +
            sweep.map((s) => `${s.gap}s ${fmt(s.s1.clickDeficit, 2)}`).join("   "));
console.log(`  negative control (pseudo-final, stratified): ` +
            sweep.map((s) => `${s.gap}s ${s.s1.negativeControl.fired}/${s.s1.negativeControl.ran}`).join("   ") +
            `   [nominal ${NC_REPEATS * ALPHA}/${NC_REPEATS}]`);
console.log();

console.log("S2 — DOES DURATION VARY SMOOTHLY WITHIN A SEQUENCE?");
console.log("  pooled per-fragment-centered lag-1 autocorrelation of duration.");
console.log("  S2 null shuffles within fragment; S2b within fragment x class. One-sided");
console.log("  high: smoothness asserts POSITIVE autocorrelation.");
console.log();
console.log(`  ${"gap".padEnd(6)}${"frags".padStart(6)}${"codas".padStart(7)}${"1-class".padStart(9)}` +
            `${"r-obs".padStart(9)}${"S2-null".padStart(9)}${"z".padStart(7)}${"p".padStart(9)}` +
            `${"S2b-null".padStart(10)}${"z".padStart(7)}${"p".padStart(9)}${"mass-b".padStart(8)}`);
for (const s of sweep) {
  const b = s.s2;
  console.log(`  ${(s.gap + "s").padEnd(6)}${String(b.fragments).padStart(6)}${String(b.codas).padStart(7)}` +
              `${fmt(100 * b.singleClassFragments / b.fragments, 0).padStart(8)}%` +
              `${fmt(b.seq.observed).padStart(9)}` +
              `${fmt(b.seq.nullMean).padStart(9)}${fmt(b.seq.z, 1).padStart(7)}${fmt(b.seq.p).padStart(8)}${b.seq.p < ALPHA ? "*" : " "}` +
              `${fmt(b.seqXclass.nullMean).padStart(10)}${fmt(b.seqXclass.z, 1).padStart(7)}${fmt(b.seqXclass.p).padStart(8)}${b.seqXclass.p < ALPHA ? "*" : " "}` +
              `${String(b.massSeqXclass).padStart(8)}`);
}
console.log();
console.log("  strictly monotone fragments, observed% (null%), by length:");
for (const s of sweep) {
  const cells = s.s2.seq.mono.map((m) => m.n
    ? `L${m.L} ${fmt(100 * m.obs, 1)}(${fmt(100 * m.null, 1)}) n=${m.n}`
    : `L${m.L} —`);
  console.log(`    ${(s.gap + "s").padEnd(5)}${cells.join("   ")}`);
}
console.log(`  negative controls: S2 ` +
            sweep.map((s) => `${s.gap}s ${s.s2.negativeControl.fired}/${s.s2.negativeControl.ran}`).join("  ") +
            `   S2b ` +
            sweep.map((s) => `${s.gap}s ${s.s2.negativeControlXclass.fired}/${s.s2.negativeControlXclass.ran}`).join("  "));
console.log();

// --- verdict against the pre-registered criterion ---------------------------
const s1Survives = sweep.every((s) => s.s1.stratified.p < ALPHA && s.s1.leverage >= MIN_LEVERAGE);
const s2Survives = sweep.every((s) => s.s2.seqXclass.p < ALPHA && s.s2.massSeqXclass >= MIN_LEVERAGE);
rule();
console.log(`  pre-registered prediction: NEITHER survives its stratified null at every gap`);
console.log(`  S1 ornamentation: ${s1Survives ? "SURVIVES — prediction FALSIFIED" : "does not survive"}` +
            `   (stratified p by gap: ${sweep.map((s) => fmt(s.s1.stratified.p)).join(", ")})`);
console.log(`  S2 rubato:        ${s2Survives ? "SURVIVES — prediction FALSIFIED" : "does not survive"}` +
            `   (S2b p by gap:        ${sweep.map((s) => fmt(s.s2.seqXclass.p)).join(", ")})`);
rule();

mkdirSync(ART, { recursive: true });
writeFileSync(join(ART, "rubato_ornament.json"), JSON.stringify({
  experiment: "09-rubato-ornamentation",
  preregistered: { SEED, ITERATIONS, GAPS, ALPHA, MIN_LEVERAGE, MIN_RUN_S1, MIN_FRAG_S2,
                   NC_REPEATS, NC_ITER },
  gates: {
    g1: { agreement: agree / all.length, residualClasses: [...residual],
          mismatchesOutsideResidual: mismOutside, pass: g1 },
    g2: { zeroDuration: zeroDur.length, allSingleClick: g2,
          allInResidual: zeroDur.every((r) => residual.has(r.cls)) },
    g0: { keptCodas: rows.length, totalCodas: all.length, pass: g0 },
  },
  observationUniverse: { codas: obsRows.length,
                         ornamented: obsRows.reduce((s, r) => s + r.orn, 0),
                         perClass: confound },
  sweep,
  verdict: { s1Survives, s2Survives },
}, null, 2));
console.log(`  written ${join(ART, "rubato_ornament.json")}`);
