// g0_measurement_gate.mjs — can the shipped onset detector recover a rhythm we
// put in on purpose?
//
//     python3 tools/fetch_corpus.py && python3 tools/fetch_pacific.py
//     python3 tools/fetch_comparanda.py
//     node tools/g0_measurement_gate.mjs
//
// This is experiment 05's G0 gate. It runs BEFORE any GPU time, and if it fails
// the experiment stops, because experiment 05's deliverable is a slope of OUTPUT
// nPVI against INPUT nPVI and neither term is trustworthy if the instrument
// cannot measure a rhythm it was handed.
//
// Why this gate exists, specifically:
//
//   Experiment 03 established that this repo's onset/IPI machinery CANNOT
//   distinguish real click structure from periodic broadband artifacts —
//   synthetic impulse trains fired 8 of 8 inside the physical band, at HIGHER
//   confidence than real whale clicks. WhAM output is synthetic click-like
//   audio. That is precisely the regime where the instrument is known to fail.
//
// The detector under test is `analyze` from explorer/js/dsp.js, called exactly as
// the browser calls it. Nothing is reimplemented. The renderer is harness-side
// and labelled, because rendering is not measurement.
//
// Input TIMBRE is held constant: every source is rendered with the same click
// grain, varying only the inter-click intervals, so rhythm is the only
// manipulated variable. That is also how experiment 05 builds its inputs.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { analyze } from "../explorer/js/dsp.js";
import { npvi } from "../explorer/js/rhythm.js";
import { CODA_TYPES } from "../explorer/js/library.js";
import { clickGrain } from "../explorer/js/synth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "explorer", "data");

// ---------------------------------------------------------------------------
// PRE-REGISTERED — fixed before the gate was run.
// ---------------------------------------------------------------------------
const SR = 44100;               // main.js:12, the app's real rate
const N_PER_SOURCE = 20;
const TARGET_MEAN_ICI = 0.200;  // s. Coda ICI median is 0.171 (Dominica) /
                                // 0.185 (Pacific), so this sits in distribution.
const MATCH_TOL = 0.015;        // s, for pairing recovered onsets to true ones

const G0A_MIN_R = 0.95;
const G0A_SLOPE = [0.90, 1.10];
const G0B_MAX_BIAS = 5.0;

const DETECTOR_MIN_ICI = 0.03;  // dsp.js detectOnsets default
const SEED = 1;

// ---------------------------------------------------------------------------
// Harness. The RNG is reseeded at the START OF EVERY EVALUATION, not shared.
//
// An earlier revision seeded once and let state carry across sections, so the
// same configuration reported worst-bias 18.17 in one section and 20.35 in
// another — the same test on a different sample, presented as a comparison.
// ---------------------------------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : " n/a");
const rule = (c = "=") => console.log(c.repeat(78));
const mean = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : NaN);
const readJson = (p) => JSON.parse(readFileSync(join(DATA, p), "utf8"));

const GRAIN = clickGrain(SR, { durMs: 25, centerHz: 2000, q: 1.2, noise: 0.6 });

function renderIcis(icis, tailSec = 0.35) {
  const times = [0];
  for (const v of icis) times.push(times[times.length - 1] + v);
  const out = new Float32Array(Math.ceil((times[times.length - 1] + tailSec) * SR));
  for (const t of times) {
    const off = Math.round(t * SR);
    for (let i = 0; i < GRAIN.length && off + i < out.length; i++) out[off + i] += GRAIN[i];
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak;
  return { signal: out, trueOnsets: times };
}

/**
 * ONE-TO-ONE greedy match of recovered onsets to true onsets.
 *
 * An earlier revision asked "does some recovered onset lie within tolerance of
 * this true onset?" independently per true onset, which lets ONE recovered
 * onset satisfy TWO true onsets. That reports 100% recall on exactly the short
 * intervals where the detector is in fact merging clicks — the failure it was
 * written to detect. Each recovered onset is now consumed at most once.
 */
function matchOnsets(trueOnsets, got) {
  const used = new Set();
  let matched = 0;
  for (const t of trueOnsets) {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < got.length; i++) {
      if (used.has(i)) continue;
      const d = Math.abs(got[i] - t);
      if (d <= MATCH_TOL && d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0) { used.add(best); matched++; }
  }
  return { matched, missing: trueOnsets.length - matched, spurious: got.length - used.size };
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------
const comparanda = readJson("comparanda.json");
const windowsOf = (frag) =>
  comparanda.entries.filter((e) => e.name.includes(frag)).flatMap((e) => e.iciSample || []);

function corpusWindows(file) {
  const c = readJson(file);
  const out = [];
  for (const row of c.ici) if (row.length === 4) out.push(row.map((v) => v / 10000));
  return out;
}

const SOURCES = [
  { id: "isochronous", windows: [[1, 1, 1, 1]] },
  { id: "coda 5R3", windows: [CODA_TYPES.find((c) => c.id === "5R3").iciNorm] },
  { id: "coda, Pacific", windows: corpusWindows("pacific-corpus.json") },
  { id: "coda, Dominica", windows: corpusWindows("coda-corpus.json") },
  { id: "drumming (Groove)", windows: windowsOf("human drumming") },
  { id: "Morse (ITU)", windows: windowsOf("Morse code") },
  { id: "Poisson", windows: windowsOf("Poisson") },
].map((s) => ({
  ...s,
  windows: s.windows.filter((w) => w && w.length === 4 && w.every((v) => v > 0)),
}));

/**
 * Evaluate every source under one configuration. Reseeds, so configurations are
 * compared on the SAME sampled windows.
 */
function evaluate({ scaling = "mean", scaleTo = TARGET_MEAN_ICI, floor = DETECTOR_MIN_ICI } = {}) {
  const rng = mulberry32(SEED);
  const pick = (arr, k) => {
    if (arr.length <= k) return arr.slice();
    const out = [], seen = new Set();
    while (out.length < k && seen.size < arr.length) {
      const i = Math.floor(rng() * arr.length);
      if (seen.has(i)) continue;
      seen.add(i); out.push(arr[i]);
    }
    return out;
  };

  const perSource = [], pooled = [];
  let slowest = 0;
  for (const src of SOURCES) {
    if (!src.windows.length) continue;
    const chosen = src.windows.length === 1
      ? Array.from({ length: N_PER_SOURCE }, () => src.windows[0])
      : pick(src.windows, Math.min(N_PER_SOURCE, src.windows.length));

    const ins = [], outs = [], rows = [];
    for (const w of chosen) {
      const base = scaling === "mean" ? mean(w) : Math.min(...w);
      if (!(base > 0)) continue;
      const icis = w.map((v) => (v / base) * scaleTo);
      slowest = Math.max(slowest, icis.reduce((s, v) => s + v, 0));

      const inN = npvi(icis);
      const { signal, trueOnsets } = renderIcis(icis);
      const got = analyze(signal, SR, { minIci: floor }).onsets;
      const m = matchOnsets(trueOnsets, got);

      const outIcis = got.slice(1).map((v, i) => v - got[i]);
      const outN = outIcis.length >= 2 ? npvi(outIcis) : NaN;
      rows.push({ ...m, nTrue: trueOnsets.length, belowFloor: icis.filter((v) => v < floor).length });
      if (Number.isFinite(inN) && Number.isFinite(outN)) {
        ins.push(inN); outs.push(outN); pooled.push([inN, outN]);
      }
    }
    perSource.push({
      id: src.id, n: rows.length,
      inN: mean(ins), outN: mean(outs), bias: mean(outs) - mean(ins),
      recall: mean(rows.map((r) => r.matched / r.nTrue)),
      missing: mean(rows.map((r) => r.missing)),
      spurious: mean(rows.map((r) => r.spurious)),
      belowFloor: mean(rows.map((r) => r.belowFloor)),
    });
  }

  const xs = pooled.map((p) => p[0]), ys = pooled.map((p) => p[1]);
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2;
  }
  const slope = sxx > 0 ? sxy / sxx : NaN;
  const r = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
  const worstBias = Math.max(...perSource.map((s) => Math.abs(s.bias)).filter(Number.isFinite));
  return {
    perSource, n: xs.length, slope, r, intercept: my - slope * mx, worstBias, slowest,
    spurious: mean(perSource.map((s) => s.spurious)),
    pass: r >= G0A_MIN_R && slope >= G0A_SLOPE[0] && slope <= G0A_SLOPE[1] && worstBias < G0B_MAX_BIAS,
  };
}

// ---------------------------------------------------------------------------
rule();
console.log("G0 — MEASUREMENT-CHAIN GATE for experiment 05");
rule();
console.log("Can the SHIPPED onset detector recover a rhythm we constructed?");
console.log("Runs before any GPU time. If this fails, experiment 05 does not run.\n");
console.log(`  sample rate     ${SR} Hz      click grain  fixed, 25 ms / 2 kHz / q 1.2`);
console.log(`  tempo           mean ICI ${TARGET_MEAN_ICI * 1000} ms   detector    analyze(), as the browser calls it`);
console.log(`  n per source    ${N_PER_SOURCE}          seed        ${SEED} (reseeded per configuration)`);
console.log(`  detector floor  ${DETECTOR_MIN_ICI * 1000} ms       criteria    r>=${G0A_MIN_R}, slope ${G0A_SLOPE[0]}-${G0A_SLOPE[1]}, |bias|<${G0B_MAX_BIAS}`);

const base = evaluate();

rule();
console.log("1. PER-SOURCE RECOVERY, as pre-registered");
rule();
console.log(`${"source".padEnd(19)} ${"n".padStart(3)} ${"nPVI in".padStart(8)} ${"nPVI out".padStart(9)} ` +
            `${"bias".padStart(7)} ${"recall".padStart(7)} ${"miss".padStart(6)} ${"spur".padStart(6)} ${"<floor".padStart(7)}`);
console.log("-".repeat(78));
for (const s of base.perSource) {
  console.log(`${s.id.padEnd(19)} ${String(s.n).padStart(3)} ${fmt(s.inN).padStart(8)} ` +
              `${fmt(s.outN).padStart(9)} ${fmt(s.bias).padStart(7)} ` +
              `${fmt(100 * s.recall, 0).padStart(6)}% ${fmt(s.missing, 2).padStart(6)} ` +
              `${fmt(s.spurious, 2).padStart(6)} ${fmt(s.belowFloor, 2).padStart(7)}`);
}
console.log("-".repeat(78));
console.log("recall/miss/spur use ONE-TO-ONE onset matching, so a single recovered onset");
console.log("cannot satisfy two true clicks. <floor = constructed ICIs under the floor.");

rule();
console.log("2. G0a / G0b");
rule();
console.log(`  n            ${base.n} items across ${base.perSource.length} sources`);
console.log(`  r            ${fmt(base.r, 4)}   [>= ${G0A_MIN_R}]   ${base.r >= G0A_MIN_R ? "pass" : "FAIL"}`);
console.log(`  slope        ${fmt(base.slope, 4)}   [${G0A_SLOPE[0]}-${G0A_SLOPE[1]}]  ${base.slope >= G0A_SLOPE[0] && base.slope <= G0A_SLOPE[1] ? "pass" : "FAIL"}`);
console.log(`  intercept    ${fmt(base.intercept, 3)}`);
console.log(`  worst bias   ${fmt(base.worstBias)}   [< ${G0B_MAX_BIAS}]    ${base.worstBias < G0B_MAX_BIAS ? "pass" : "FAIL"}`);
console.log(`\n  A detector accurate at coda-like nPVI but compressive at high nPVI would`);
console.log(`  produce experiment 05's "grammar" result with no model involved.`);

rule();
console.log("3. DIAGNOSIS A — retempo so every interval clears the floor");
rule();
console.log("nPVI is tempo-invariant, so a window can be slowed until its shortest");
console.log("interval clears the floor without altering the measured quantity.\n");
console.log(`${"rule".padEnd(30)} ${"slope".padStart(7)} ${"r".padStart(7)} ${"bias".padStart(7)} ${"slowest".padStart(10)}`);
console.log("-".repeat(78));
for (const mult of [1.0, 1.5, 2.0]) {
  const e = evaluate({ scaling: "min", scaleTo: mult * DETECTOR_MIN_ICI });
  console.log(`${`min ICI = ${mult.toFixed(1)}x floor (${(mult * DETECTOR_MIN_ICI * 1000).toFixed(0)} ms)`.padEnd(30)} ` +
              `${fmt(e.slope, 4).padStart(7)} ${fmt(e.r, 4).padStart(7)} ${fmt(e.worstBias).padStart(7)} ` +
              `${(fmt(e.slowest, 1) + "s").padStart(10)}  ${e.pass ? "criteria met" : ""}`);
}
console.log("-".repeat(78));
console.log("Read SLOWEST before believing any row. Real codas last 0.5-3 s. A rule that");
console.log("needs a five-click train to run tens of seconds puts the input far outside");
console.log("the model's training distribution, defeating the purpose of experiment 05.");
console.log("This is a diagnosis of the mechanism, not a usable remedy.");

rule();
console.log("4. DIAGNOSIS B — lower the floor instead (it is a parameter, not a constant)");
rule();
console.log("GUARD: experiment 03 showed this detector family invents structure when");
console.log("thresholds are relaxed. A lower floor is acceptable ONLY if it improves");
console.log("recovery WITHOUT adding spurious onsets. `spur` is the veto.\n");
console.log(`${"minIci".padStart(8)} ${"slope".padStart(7)} ${"r".padStart(7)} ${"bias".padStart(7)} ` +
            `${"recall".padStart(7)} ${"miss/item".padStart(10)} ${"spur/item".padStart(10)}`);
console.log("-".repeat(78));
let bestFloor = null;
for (const floor of [0.030, 0.020, 0.015, 0.010, 0.005]) {
  const e = evaluate({ floor });
  const clean = e.pass && e.spurious < 0.05;
  if (clean && !bestFloor) bestFloor = floor;
  console.log(`${(floor * 1000).toFixed(0).padStart(6)}ms ${fmt(e.slope, 4).padStart(7)} ${fmt(e.r, 4).padStart(7)} ` +
              `${fmt(e.worstBias).padStart(7)} ${fmt(100 * mean(e.perSource.map((s) => s.recall)), 0).padStart(6)}% ` +
              `${fmt(mean(e.perSource.map((s) => s.missing)), 3).padStart(10)} ` +
              `${fmt(e.spurious, 3).padStart(10)}  ${clean ? "PASSES cleanly" : ""}`);
}
console.log("-".repeat(78));

console.log("Results are IDENTICAL for 20/15/10/5 ms, so minIci is not what binds below");
console.log("20 ms. The suppression window is round(minIci/hop) with hop = 128 samples =");
console.log("2.90 ms, but the onset function itself is computed on 512-sample frames =");
console.log("11.6 ms. Two clicks closer than a frame do not produce two resolvable peaks");
console.log("at any minIci. That is a property of the shipped analyze(), and changing");
console.log("frameSize would invalidate every measurement exp 02, 03 and the observatory");
console.log("have already made with it.");

rule();
console.log("5. DIAGNOSIS C — slow the whole input down, staying in coda duration range");
rule();
console.log("If the limit is absolute time, a uniformly slower input clears it. Unlike");
console.log("diagnosis A this scales every window by the SAME factor, so the durations");
console.log("stay comparable. Real codas run 0.5-3.04 s (max measured, exp 04), so a");
console.log("four-interval train must stay under ~3 s to remain in distribution.\n");
console.log(`${"mean ICI".padStart(9)} ${"slope".padStart(7)} ${"r".padStart(7)} ${"bias".padStart(7)} ` +
            `${"recall".padStart(7)} ${"spur".padStart(6)} ${"max dur".padStart(9)}  in-range?`);
console.log("-".repeat(78));
let bestTempo = null;
for (const ms of [200, 300, 400, 500, 600, 750]) {
  const e = evaluate({ scaleTo: ms / 1000 });
  const inRange = e.slowest <= 3.04;
  const clean = e.pass && e.spurious < 0.05 && inRange;
  if (clean && !bestTempo) bestTempo = ms;
  console.log(`${(ms + "ms").padStart(9)} ${fmt(e.slope, 4).padStart(7)} ${fmt(e.r, 4).padStart(7)} ` +
              `${fmt(e.worstBias).padStart(7)} ${fmt(100 * mean(e.perSource.map((s) => s.recall)), 0).padStart(6)}% ` +
              `${fmt(e.spurious, 2).padStart(6)} ${(fmt(e.slowest, 2) + "s").padStart(9)}  ` +
              `${inRange ? "yes" : "NO"}${clean ? "   PASSES cleanly" : ""}`);
}
console.log("-".repeat(78));

rule();
console.log("6. DIAGNOSIS D — restrict the input domain to where the instrument is linear");
rule();
console.log("The bias table in section 1 is not uniform: it is ~0 up to the Morse range");
console.log("and large above it. Dropping the two high-nPVI sources costs experiment 05");
console.log("its most out-of-distribution inputs but may buy a linear instrument.\n");
console.log(`${"domain".padEnd(34)} ${"n".padStart(4)} ${"slope".padStart(7)} ${"r".padStart(7)} ${"bias".padStart(7)}`);
console.log("-".repeat(78));
for (const [label, keep] of [
  ["all 7 sources (as pre-registered)", null],
  ["nPVI <= 50 (drop drumming, Poisson)", ["isochronous", "coda 5R3", "coda, Pacific", "coda, Dominica", "Morse (ITU)"]],
]) {
  for (const ms of [200, 600]) {
    const e = evaluate({ scaleTo: ms / 1000 });
    const rows = keep ? e.perSource.filter((s) => keep.includes(s.id)) : e.perSource;
    // pooled regression restricted to the kept sources
    const pts = [];
    for (const s of rows) pts.push([s.inN, s.outN]);
    const px = pts.map((p) => p[0]), py = pts.map((p) => p[1]);
    const pmx = mean(px), pmy = mean(py);
    let a = 0, b = 0, c = 0;
    for (let i = 0; i < px.length; i++) {
      a += (px[i] - pmx) * (py[i] - pmy); b += (px[i] - pmx) ** 2; c += (py[i] - pmy) ** 2;
    }
    const wb = Math.max(...rows.map((s) => Math.abs(s.bias)));
    console.log(`${(label + ` @ ${ms}ms`).padEnd(34)} ${String(rows.length).padStart(4)} ` +
                `${fmt(b > 0 ? a / b : NaN, 4).padStart(7)} ${fmt(b > 0 && c > 0 ? a / Math.sqrt(b * c) : NaN, 4).padStart(7)} ` +
                `${fmt(wb).padStart(7)}  ${wb < G0B_MAX_BIAS ? "bias OK" : ""}`);
  }
}
console.log("-".repeat(78));
console.log("Regression here is over SOURCE MEANS, not items, so slope/r are not");
console.log("comparable to sections 2-5. The bias column is the decision-relevant one.");

rule();
console.log("7. DIAGNOSIS E — is it high nPVI, or short intervals?");
rule();
console.log("Those are not the same thing, and sections 1-6 conflated them. Drumming and");
console.log("Poisson are high-nPVI AND contain short absolute intervals; the instrument");
console.log("fails on the second, not necessarily the first.");
console.log("");
console.log("An alternating sequence [a,b,a,b] has nPVI = 100*|a-b|/((a+b)/2), so for a");
console.log("target N and a chosen shortest interval b: a = b*(2+r)/(2-r), r = N/100.");
console.log("The whole nPVI range is therefore constructible with ANY minimum interval.\n");

const TARGETS = [0, 20, 40, 60, 80, 100, 120];
function constructed(floorMs) {
  const pts = [], rows = [];
  let maxDur = 0, spur = 0, recall = 0;
  for (const N of TARGETS) {
    const r = N / 100;
    const b = floorMs / 1000;
    const a = b * (2 + r) / (2 - r);
    const icis = [a, b, a, b];
    const dur = icis.reduce((s, v) => s + v, 0);
    maxDur = Math.max(maxDur, dur);
    const inN = npvi(icis);
    const { signal, trueOnsets } = renderIcis(icis);
    const got = analyze(signal, SR).onsets;
    const m = matchOnsets(trueOnsets, got);
    spur += m.spurious; recall += m.matched / trueOnsets.length;
    const outIcis = got.slice(1).map((v, i) => v - got[i]);
    const outN = outIcis.length >= 2 ? npvi(outIcis) : NaN;
    if (Number.isFinite(inN) && Number.isFinite(outN)) pts.push([inN, outN]);
    rows.push({ N, a, b, dur, inN, outN, bias: outN - inN, ...m, nTrue: trueOnsets.length });
  }
  const px = pts.map((p) => p[0]), py = pts.map((p) => p[1]);
  const pmx = mean(px), pmy = mean(py);
  let a2 = 0, b2 = 0, c2 = 0;
  for (let i = 0; i < px.length; i++) {
    a2 += (px[i] - pmx) * (py[i] - pmy); b2 += (px[i] - pmx) ** 2; c2 += (py[i] - pmy) ** 2;
  }
  const slope = b2 > 0 ? a2 / b2 : NaN;
  const r = b2 > 0 && c2 > 0 ? a2 / Math.sqrt(b2 * c2) : NaN;
  const worstBias = Math.max(...rows.map((x) => Math.abs(x.bias)).filter(Number.isFinite));
  return {
    rows, slope, r, worstBias, maxDur, spur, recall: recall / TARGETS.length,
    pass: r >= G0A_MIN_R && slope >= G0A_SLOPE[0] && slope <= G0A_SLOPE[1]
          && worstBias < G0B_MAX_BIAS && spur === 0 && maxDur <= 3.04,
  };
}

console.log("Onset times are quantised on a 128-sample hop = 2.90 ms grid. nPVI is a");
console.log("difference of ADJACENT intervals, so a few ms of timing jitter matters in");
console.log("proportion to the interval. Sweeping the shortest interval:\n");
console.log(`${"shortest".padStart(9)} ${"slope".padStart(7)} ${"r".padStart(7)} ${"worst bias".padStart(11)} ` +
            `${"recall".padStart(7)} ${"spur".padStart(5)} ${"max dur".padStart(8)}  verdict`);
console.log("-".repeat(78));
let chosen = null;
for (const f of [60, 100, 150, 200, 300]) {
  const e = constructed(f);
  if (e.pass && !chosen) chosen = { f, e };
  console.log(`${(f + "ms").padStart(9)} ${fmt(e.slope, 4).padStart(7)} ${fmt(e.r, 4).padStart(7)} ` +
              `${fmt(e.worstBias).padStart(11)} ${fmt(100 * e.recall, 0).padStart(6)}% ${String(e.spur).padStart(5)} ` +
              `${(fmt(e.maxDur, 2) + "s").padStart(8)}  ${e.pass ? "ALL CRITERIA MET" : ""}`);
}
console.log("-".repeat(78));
if (chosen) {
  console.log(`Per-target detail at ${chosen.f} ms:\n`);
  console.log(`${"target".padStart(7)} ${"a/b (ms)".padStart(12)} ${"dur".padStart(6)} ` +
              `${"nPVI in".padStart(8)} ${"nPVI out".padStart(9)} ${"bias".padStart(7)}`);
  for (const x of chosen.e.rows) {
    console.log(`${String(x.N).padStart(7)} ${(`${(x.a * 1000).toFixed(0)}/${(x.b * 1000).toFixed(0)}`).padStart(12)} ` +
                `${(fmt(x.dur, 2) + "s").padStart(6)} ${fmt(x.inN).padStart(8)} ` +
                `${fmt(x.outN).padStart(9)} ${fmt(x.bias).padStart(7)}`);
  }
  console.log(`\n  Full nPVI 0-120, every input inside the real coda duration range`);
  console.log(`  (max ${fmt(chosen.e.maxDur, 2)}s vs 3.04s measured maximum), 100% recall, no spurious onsets.`);
}

rule();
console.log("VERDICT");
rule();
console.log(`  G0a  r ${fmt(base.r, 3)}, slope ${fmt(base.slope, 3)}`);
console.log(`  G0b  worst bias ${fmt(base.worstBias)}`);
console.log(`\n  ${base.pass ? "GATE OPEN — experiment 05 may proceed."
  : "GATE CLOSED as pre-registered."}`);
if (!base.pass && chosen) {
  console.log(`\n  AMENDMENT FOUND, and it is to the INPUTS, not the instrument.`);
  console.log(`\n  The pre-registration sourced high-nPVI inputs from real drum performances`);
  console.log(`  and a Poisson process. Those are high-nPVI AND contain short absolute`);
  console.log(`  intervals, and it is the second property the instrument cannot handle:`);
  console.log(`  onsets are quantised on a 2.90 ms hop and the onset function runs on`);
  console.log(`  11.6 ms frames, so a few ms of jitter corrupts nPVI in proportion to the`);
  console.log(`  interval. High nPVI was never the problem.`);
  console.log(`\n  Constructed alternating inputs with a ${chosen.f} ms shortest interval span the`);
  console.log(`  FULL nPVI 0-120 range at slope ${fmt(chosen.e.slope, 3)}, r ${fmt(chosen.e.r, 4)}, worst bias ${fmt(chosen.e.worstBias)},`);
  console.log(`  100% recall, no spurious onsets, max duration ${fmt(chosen.e.maxDur, 2)}s (coda max is 3.04s).`);
  console.log(`\n  Experiment 05 must build its inputs this way and must state that it`);
  console.log(`  therefore tests CONSTRUCTED rhythms, not real drum microtiming. The gate`);
  console.log(`  as pre-registered FAILED; this is the recorded amendment, not a pass.`);
} else if (!base.pass) {
  if (bestTempo) {
    console.log(`\n  AMENDMENT AVAILABLE: mean ICI = ${bestTempo} ms opens the gate cleanly and keeps`);
    console.log(`  the longest input inside the real coda duration range. Experiment 05's`);
    console.log(`  pre-registered ${TARGET_MEAN_ICI * 1000} ms tempo must be amended to ${bestTempo} ms.`);
    console.log(`  This is an amendment to a FAILED gate, recorded as such — not a pass.`);
  } else if (bestFloor) {
    console.log(`\n  PARTIAL: minIci = ${(bestFloor * 1000).toFixed(0)} ms helps but does not clear all criteria.`);
  } else {
    console.log(`\n  NO AMENDMENT FOUND. The instrument cannot recover high-nPVI rhythm at any`);
    console.log(`  tempo that keeps the input inside the coda duration range. Experiment 05`);
    console.log(`  must either restrict its input domain to where the instrument is linear`);
    console.log(`  (roughly nPVI <= 50, the Morse range) and say so, or change its`);
    console.log(`  deliverable to something that does not depend on onset detection.`);
  }
}
rule();
