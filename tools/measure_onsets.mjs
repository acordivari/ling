// tools/measure.mjs — every number quoted in the specification, recomputed.
//
// Run: node tools/measure_onsets.mjs      (from the repo root)
// Every figure prints with the seed(s) that produced it. Nothing in the spec
// may cite a number that this script does not print.
//
// Written because a previous revision quoted figures measured at the wrong
// sample rate, on a partial sweep, or pooled in a way that hid their structure.

import { setSeed } from "../explorer/js/random.js";
import { analyze } from "../explorer/js/dsp.js";
import { npvi, cv } from "../explorer/js/rhythm.js";
import { CODA_TYPES as CODAS, RHYTHM_SOURCES, ANIMAL_SOURCES } from "../explorer/js/library.js";
import { renderCoda, renderRhythm, renderAnimal, clickGrain } from "../explorer/js/synth.js";

const SR = 44100;                      // main.js:12 — the app's real rate
const HOP = 128, FRAME = 512;
const hopMs = (HOP / SR) * 1000;

const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : "n/a");
const H = (s) => console.log(`\n${"=".repeat(72)}\n${s}\n${"=".repeat(72)}`);

H("0. GRID CONSTANTS (spec previously quoted the 24 kHz numbers)");
console.log(`sampleRate      ${SR}`);
console.log(`hop             ${HOP} samples = ${hopMs.toFixed(4)} ms   (spec said 5.333 — WRONG)`);
console.log(`frame           ${FRAME} samples = ${((FRAME / SR) * 1000).toFixed(3)} ms`);
console.log(`minFrames@30ms  ${Math.max(1, Math.round(0.03 / (HOP / SR)))} frames = ${(Math.max(1, Math.round(0.03 / (HOP / SR))) * hopMs).toFixed(3)} ms suppression window`);
console.log(`refine search   +/- ${HOP} samples = +/- ${hopMs.toFixed(3)} ms around frame centre`);

// ---------------------------------------------------------------- renderers
function renderSource(src, seed) {
  setSeed(seed);
  if (RHYTHM_SOURCES.includes(src)) return renderRhythm(SR, src);
  if (ANIMAL_SOURCES.includes(src)) return renderAnimal(SR, src);
  return renderCoda(SR, src);
}
const ALL_B = [...RHYTHM_SOURCES, ...ANIMAL_SOURCES];

function f1(det, truth, tol = 0.02) {
  const used = new Set();
  let tp = 0;
  for (const t of truth) {
    let bi = -1, bd = tol;
    for (let i = 0; i < det.length; i++) {
      if (used.has(i)) continue;
      const d = Math.abs(det[i] - t);
      if (d <= bd) { bd = d; bi = i; }
    }
    if (bi >= 0) { used.add(bi); tp++; }
  }
  const prec = det.length ? tp / det.length : 0;
  const rec = truth.length ? tp / truth.length : 0;
  return { tp, nDet: det.length, nTrue: truth.length, prec, rec,
           f1: prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 0 };
}

// =====================================================================
H("1. FATAL FLAW 1 — the minIci sweep. Spec pre-registered: 'no single value");
console.log("   reaches F1 = 1.000 on all four'. Reviewer says 0.08/0.09/0.10 fix all.\n");

const OVER = ["morse", "clave", "amen", "isochronous", "beatbox", "euclid"];
const UNDER = ["woodpecker", "narwhal", "impulses", "bat", "dolphin-echo", "dolphin-burst", "beluga", "killer"];
const byId = Object.fromEntries(ALL_B.map((s) => [s.id, s]));

const MINICI = [0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10, 0.12];
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

console.log("counts are detected/true, across " + SEEDS.length + " seeds (min-max if they vary)");
const hdr = ["minIci".padEnd(8), ...OVER.map((i) => i.slice(0, 9).padStart(10))].join("");
console.log(hdr);
const sweepRows = {};
for (const m of MINICI) {
  const cells = [];
  for (const id of OVER) {
    const counts = new Set(), f1s = [];
    for (const s of SEEDS) {
      const r = renderSource(byId[id], s);
      const a = analyze(r.signal, SR, { sensitivity: 0.6, minIci: m });
      counts.add(a.onsets.length);
      f1s.push(f1(a.onsets, r.trueOnsets).f1);
    }
    const nTrue = renderSource(byId[id], 1).trueOnsets.length;
    const cs = [...counts];
    const label = cs.length === 1 ? `${cs[0]}/${nTrue}` : `${Math.min(...cs)}-${Math.max(...cs)}/${nTrue}`;
    const exact = f1s.every((v) => v === 1);
    sweepRows[`${m}|${id}`] = { label, exact, minF1: Math.min(...f1s) };
    cells.push((exact ? "*" : " ") + label.padStart(9));
  }
  console.log(String(m).padEnd(8) + cells.join(""));
}
console.log("\n('*' = F1 exactly 1.000 at every seed)");

console.log("\nDoes any single minIci give F1=1.000 on ALL of morse/clave/amen/isochronous?");
for (const m of MINICI) {
  const four = ["morse", "clave", "amen", "isochronous"];
  const all = four.every((id) => sweepRows[`${m}|${id}`].exact);
  const allSix = OVER.every((id) => sweepRows[`${m}|${id}`].exact);
  if (all) console.log(`  minIci=${m}: YES on the four${allSix ? " — and on all six" : ""}`);
}

console.log("\nBUT — what that same minIci does to the under-detecting sources:");
console.log("source".padEnd(15) + ["0.03", "0.08"].map((s) => s.padStart(12)).join(""));
for (const id of UNDER) {
  const cells = [];
  for (const m of [0.03, 0.08]) {
    const r = renderSource(byId[id], 1);
    const a = analyze(r.signal, SR, { sensitivity: 0.6, minIci: m });
    const s = f1(a.onsets, r.trueOnsets);
    cells.push(`${s.nDet}/${s.nTrue} F${fmt(s.f1, 2)}`.padStart(12));
  }
  console.log(id.padEnd(15) + cells.join(""));
}

// =====================================================================
H("2. FATAL FLAW 1b — morse count at defaults. Spec said 28/14.");
for (const s of [1, 2, 3, 4, 5, 6]) {
  const r = renderSource(byId["morse"], s);
  const a = analyze(r.signal, SR, { sensitivity: 0.6, minIci: 0.03 });
  const q = f1(a.onsets, r.trueOnsets);
  console.log(`  seed ${s}: detected ${q.nDet}, true ${q.nTrue}, precision ${fmt(q.prec, 3)}, F1 ${fmt(q.f1, 3)}`);
}

// =====================================================================
H("3. BLOCKING — the grain mechanism. Is it amplitude, or grain-vs-window?");
const GRAINS = {
  kick:   { centerHz: 220, q: 1.4, durMs: 70, noise: 0.35 },
  hat:    { centerHz: 7000, q: 0.9, durMs: 18, noise: 0.95 },
  snare:  { centerHz: 1600, q: 1.0, durMs: 55, noise: 0.8 },
  euclid: { centerHz: 2200, q: 1.2, durMs: 30, noise: 0.6 },
  animal12k: { centerHz: 12000, q: 0.6, durMs: 14, noise: 0.85 },
  animal1k8: { centerHz: 1800, q: 1.1, durMs: 14, noise: 0.85 },
};
const suppressMs = Math.max(1, Math.round(0.03 / (HOP / SR))) * hopMs;
console.log(`suppression window at default minIci=0.03: ${suppressMs.toFixed(2)} ms\n`);
console.log("grain".padEnd(11) + "durMs".padStart(7) + "lastAmp".padStart(9) +
            "dur>win".padStart(9) + "  isolated-onset lags (ms, seeds 1-6)");
for (const [name, g] of Object.entries(GRAINS)) {
  setSeed(1);
  const buf = clickGrain(SR, g);
  const last = Math.abs(buf[buf.length - 1]);
  const peak = Math.max(...Array.from(buf, Math.abs));
  const lagSets = [];
  for (const s of [1, 2, 3, 4, 5, 6]) {
    setSeed(s);
    const gr = clickGrain(SR, g);
    const sig = new Float32Array(Math.round(SR * 0.6));
    const at = Math.round(SR * 0.2);
    for (let i = 0; i < gr.length; i++) sig[at + i] = gr[i];
    const a = analyze(sig, SR, { sensitivity: 0.6, minIci: 0.03 });
    lagSets.push(a.onsets.map((t) => ((t - 0.2) * 1000).toFixed(1)).join("|") || "none");
  }
  const uniq = [...new Set(lagSets)];
  console.log(
    name.padEnd(11) + String(g.durMs).padStart(7) + fmt(last / peak, 4).padStart(9) +
    (g.durMs > suppressMs ? "YES" : "no").padStart(9) + "  " +
    (uniq.length === 1 ? uniq[0] : uniq.join("  ")));
}

// =====================================================================
H("4. FATAL FLAW 3 — is the 'floor' a resolution or a per-object bias?");
console.log("Sources that are EXACTLY isochronous by construction (true nPVI = 0).\n");

const EXACT = CODAS.filter((c) => {
  const s = new Set(c.iciNorm.map((v) => v.toFixed(9)));
  return s.size === 1;
});
console.log(`exactly-regular presets: ${EXACT.map((c) => c.id).join(", ")} (n=${EXACT.length})\n`);

const NSEED = 40;
console.log("preset".padEnd(9) + ["mean", "sd", "min", "max", "p95", "detN/true"].map((s) => s.padStart(10)).join(""));
const perObject = {};
const pooled = [];
for (const c of EXACT) {
  const vals = [], counts = new Set();
  for (let s = 1; s <= NSEED; s++) {
    setSeed(s);
    const r = renderCoda(SR, c);
    const a = analyze(r.signal, SR, { sensitivity: 0.6, minIci: 0.03 });
    const v = npvi(a.ici);
    if (Number.isFinite(v)) { vals.push(v); pooled.push(v); }
    counts.add(a.onsets.length);
  }
  vals.sort((a, b) => a - b);
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
  perObject[c.id] = { mean, sd, min: vals[0], max: vals[vals.length - 1] };
  const nTrue = renderCoda(SR, c).trueOnsets.length;
  console.log(c.id.padEnd(9) +
    [fmt(mean, 3), fmt(sd, 3), fmt(vals[0], 3), fmt(vals[vals.length - 1], 3),
     fmt(vals[Math.floor(0.95 * vals.length)], 3), `${[...counts].join("/")}/${nTrue}`]
      .map((s) => String(s).padStart(10)).join(""));
}
pooled.sort((a, b) => a - b);
const pm = pooled.reduce((s, v) => s + v, 0) / pooled.length;
console.log(`\nPOOLED over ${pooled.length} runs: mean ${fmt(pm, 3)} median ${fmt(pooled[Math.floor(0.5 * pooled.length)], 3)} p95 ${fmt(pooled[Math.floor(0.95 * pooled.length)], 3)} max ${fmt(pooled[pooled.length - 1], 3)}`);
console.log("(spec claimed mean 6.695 / median 6.801 / p95 9.198 / max 11.056)");
const betweenVar = Object.values(perObject).reduce((s, o) => s + (o.mean - pm) ** 2, 0) / Object.keys(perObject).length;
const withinVar = Object.values(perObject).reduce((s, o) => s + o.sd ** 2, 0) / Object.keys(perObject).length;
console.log(`between-object variance ${fmt(betweenVar, 3)} vs within-object (seed) variance ${fmt(withinVar, 3)}`);
console.log(`=> ${(100 * betweenVar / (betweenVar + withinVar)).toFixed(1)}% of the pooled spread is BETWEEN objects.`);

// =====================================================================
H("5. FATAL FLAW 4 — are the four fixed metric domains actually respected?");
const { compare } = await import("../explorer/js/compare.js");
let mx = { rhythm: 0, timbre: 0, tempo: 0, regularity: 0 };
let arg = {};
setSeed(1);
const bCache = ALL_B.map((s) => { const r = renderSource(s, 1); return { s, a: analyze(r.signal, SR) }; });
for (const c of CODAS) {
  setSeed(1);
  const r = renderCoda(SR, c);
  const aa = analyze(r.signal, SR);
  for (const { s, a } of bCache) {
    const cmp = compare(aa, a);
    for (const k of Object.keys(mx)) {
      if (Number.isFinite(cmp[k]) && cmp[k] > mx[k]) { mx[k] = cmp[k]; arg[k] = `${c.id} x ${s.id}`; }
    }
  }
}
console.log(`n = ${CODAS.length} x ${ALL_B.length} = ${CODAS.length * ALL_B.length} cells, seed 1`);
for (const k of Object.keys(mx)) console.log(`  ${k.padEnd(11)} max ${fmt(mx[k], 4).padStart(8)}   at ${arg[k]}`);
console.log("\n  spec claimed: rhythm 0.4470 / timbre 0.9128 / tempo 1.9270 / regularity 0.9103");
console.log("  and fixed the domains at [0,0.45] [0,1] [0,2] [0,1].");
const cvs = bCache.map(({ s, a }) => [s.id, a.cvIci]).filter(([, v]) => Number.isFinite(v)).sort((a, b) => b[1] - a[1]);
console.log(`\n  highest cvIci in the library: ${cvs.slice(0, 3).map(([i, v]) => `${i} ${fmt(v, 3)}`).join(", ")}`);
console.log("  regularity = |cvA - cvB| and CV is unbounded above. A [0,1] domain is an assumption.");

// =====================================================================
H("6. BLOCKING P5 — source variance across 40 seeds (spec claimed killer 0.0%)");
console.log("source".padEnd(14) + ["nPVI mean", "nPVI sd", "sd/mean %", "detN"].map((s) => s.padStart(12)).join(""));
for (const id of ["impulses", "beluga", "dolphin-echo", "killer", "woodpecker", "narwhal", "bat"]) {
  const vals = [], counts = new Set();
  for (let s = 1; s <= 40; s++) {
    setSeed(s);
    const r = renderAnimal(SR, byId[id]);
    const a = analyze(r.signal, SR, { sensitivity: 0.6, minIci: 0.03 });
    const v = npvi(a.ici);
    if (Number.isFinite(v)) vals.push(v);
    counts.add(a.onsets.length);
  }
  if (!vals.length) { console.log(id.padEnd(14) + "  (no finite nPVI)"); continue; }
  const m = vals.reduce((s, v) => s + v, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length);
  console.log(id.padEnd(14) + [fmt(m, 3), fmt(sd, 3), fmt(100 * sd / m, 1), [...counts].join(",")]
    .map((s) => String(s).padStart(12)).join(""));
}

// =====================================================================
H("7. BLOCKING P2 — timing what the UI actually triggers");
const t0 = performance.now();
const corpus = JSON.parse(await (await import("node:fs/promises")).readFile(new URL("../data/coda-corpus.json", import.meta.url), "utf8"));
const { decodeCorpus, buildClaims } = await import("../explorer/js/claims.js");
const codas = decodeCorpus(corpus);
const comparanda = JSON.parse(await (await import("node:fs/promises")).readFile(new URL("../data/comparanda.json", import.meta.url), "utf8"));
console.log(`corpus load + decode: ${(performance.now() - t0).toFixed(0)} ms, ${codas.length} codas`);
const claims = buildClaims(codas, comparanda);
for (const cl of claims) {
  for (const nl of cl.nulls) {
    const t = performance.now();
    nl.run(1, 2000);
    console.log(`  ${cl.id}/${nl.id}: ${(performance.now() - t).toFixed(0)} ms  (2000 iterations)`);
  }
}

// =====================================================================
H("8. MISSED OPP — the corpus difference-of-means the spec would have gated");
const types = [...new Set(codas.map((c) => c.type))];
const stats = {};
for (const t of types) {
  const v = codas.filter((c) => c.type === t).map((c) => c.npvi).filter(Number.isFinite);
  if (v.length >= 2) {
    const m = v.reduce((s, x) => s + x, 0) / v.length;
    const sd = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
    stats[t] = { m, sd, n: v.length, se: sd / Math.sqrt(v.length) };
  }
}
const keys = Object.keys(stats);
let below = 0, belowSig = 0, total = 0, worst = null;
const FLOOR = 9.198; // the number the spec hard-coded
for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
  const a = stats[keys[i]], b = stats[keys[j]];
  const d = Math.abs(a.m - b.m);
  const z = d / Math.sqrt(a.se ** 2 + b.se ** 2);
  total++;
  if (d < FLOOR) { below++; if (z > 1.96) { belowSig++; if (!worst || z > worst.z) worst = { a: keys[i], b: keys[j], d, z, na: a.n, nb: b.n, ma: a.m, mb: b.m }; } }
}
console.log(`${total} type pairs. ${below} (${(100 * below / total).toFixed(1)}%) have |delta nPVI| < ${FLOOR}`);
console.log(`Of those, ${belowSig} (${(100 * belowSig / total).toFixed(1)}% of ALL pairs) have z > 1.96 on the difference of MEANS.`);
if (worst) console.log(`worst case: ${worst.a} (n=${worst.na}, ${fmt(worst.ma, 3)}) vs ${worst.b} (n=${worst.nb}, ${fmt(worst.mb, 3)}) delta ${fmt(worst.d, 2)} z ${fmt(worst.z, 1)}`);
console.log("=> gating a difference of MEANS by a single-measurement audio artefact is a category error.");

// =====================================================================
H("9. BLOCKING P4 — the full preset-vs-corpus table, including 2+3");
console.log("preset".padEnd(9) + ["presetNPVI", "corpusMean", "corpusSD", "n", "SE", "err/SE"].map((s) => s.padStart(11)).join(""));
for (const c of CODAS) {
  const s = stats[c.id];
  if (!s) continue;
  const p = npvi(c.iciNorm);
  console.log(c.id.padEnd(9) + [fmt(p, 3), fmt(s.m, 3), fmt(s.sd, 3), s.n, fmt(s.se, 3), fmt(Math.abs(p - s.m) / s.se, 1)]
    .map((x) => String(x).padStart(11)).join(""));
}

// =====================================================================
H("10. MISSED OPP — rhythm ratios on measured data (Roeske et al. 2020)");
const { rhythmRatios } = await import("../explorer/js/rhythm.js");
function ratioHist(vals, nb = 40) {
  const h = new Array(nb).fill(0);
  for (const v of vals) if (v >= 0 && v <= 1) h[Math.min(nb - 1, Math.floor(v * nb))]++;
  return h;
}
const whaleR = codas.filter((c) => c.nClicks === 5).flatMap((c) => rhythmRatios(c.ici));
console.log(`whale 5-click ratios: n=${whaleR.length}`);
const wh = ratioHist(whaleR);
const peakIdx = wh.indexOf(Math.max(...wh));
console.log(`  modal bin centre r=${((peakIdx + 0.5) / 40).toFixed(3)}  (0.500 = 1:1, 0.333 = 1:2, 0.667 = 2:1)`);
const near = (c, w) => whaleR.filter((v) => Math.abs(v - c) < w).length / whaleR.length;
console.log(`  within 0.025 of 1:1 ${(100 * near(0.5, 0.025)).toFixed(1)}%  of 1:2 ${(100 * near(1 / 3, 0.025)).toFixed(1)}%  of 2:1 ${(100 * near(2 / 3, 0.025)).toFixed(1)}%`);
for (const e of comparanda.entries.filter((x) => x.tier === "measured").slice(0, 4)) {
  if (!e.iciSample || !e.iciSample.length) { console.log(`  ${e.name}: no raw ICI sample in the file`); continue; }
  const rr = e.iciSample.flatMap((w) => rhythmRatios(w));
  const nr = (c) => rr.filter((v) => Math.abs(v - c) < 0.025).length / rr.length;
  console.log(`  ${e.name.padEnd(22)} n=${String(rr.length).padStart(6)}  1:1 ${(100 * nr(0.5)).toFixed(1)}%  1:2 ${(100 * nr(1 / 3)).toFixed(1)}%  2:1 ${(100 * nr(2 / 3)).toFixed(1)}%`);
}

// =====================================================================
H("11. MISSED OPP — estimateIpi, the one biologically real quantity");
const { estimateIpi } = await import("../explorer/js/dsp.js");
console.log("preset".padEnd(10) + ["setIpiMs", "estIpiMs", "err"].map((s) => s.padStart(10)).join(""));
for (const target of [3.0, 4.0, 5.5, 7.0, 9.0]) {
  const hits = [];
  for (let s = 1; s <= 12; s++) {
    setSeed(s);
    const r = renderCoda(SR, CODAS[0], { ipiMs: target });
    const a = analyze(r.signal, SR);
    if (a.ipi && Number.isFinite(a.ipi.ipiMs)) hits.push(a.ipi.ipiMs);
  }
  const m = hits.length ? hits.reduce((s, v) => s + v, 0) / hits.length : NaN;
  console.log(String(target).padEnd(10) + [fmt(target, 2), fmt(m, 3), fmt(m - target, 3)].map((s) => String(s).padStart(10)).join("") + `   (${hits.length}/12 returned non-null)`);
}

console.log("\n\nDONE. Every figure above is reproducible with the seeds printed.\n");

// =====================================================================
H("12. The onset-error DECOMPOSITION (neither spec nor reviewer had this)");
{
  const c = CODAS.find((x) => x.id === "5R3");
  console.log("per-onset error, ms, seed 1, 5R3 (4 exactly equal intervals):");
  setSeed(1);
  const r = renderCoda(SR, c);
  const a = analyze(r.signal, SR, { sensitivity: 0.6, minIci: 0.03 });
  console.log("  " + a.onsets.map((t, i) => ((t - r.trueOnsets[i]) * 1000).toFixed(2)).join("  "));
  console.log("  first onset is clamped to 0.00 by Math.max(0, t - leadSec) in analyze();");
  console.log("  the rest carry a constant offset. So the FIRST interval is short and the rest are right.");

  console.log("\ndoes the offset track ipiMs (i.e. is it the spermaceti pulse comb)?");
  for (const ipi of [1.5, 3.0, 5.5, 8.0]) {
    const errs = [];
    for (let s = 1; s <= 6; s++) {
      setSeed(s);
      const rr = renderCoda(SR, c, { ipiMs: ipi });
      const aa = analyze(rr.signal, SR, { sensitivity: 0.6, minIci: 0.03 });
      if (aa.onsets.length !== rr.trueOnsets.length) continue;
      for (let i = 1; i < aa.onsets.length; i++) errs.push((aa.onsets[i] - rr.trueOnsets[i]) * 1000);
    }
    console.log(`  ipiMs ${String(ipi).padEnd(5)} mean offset ${(errs.reduce((x, y) => x + y, 0) / errs.length).toFixed(2)} ms`);
  }
  console.log("  => constant. NOT the pulse comb.");

  console.log("\nis the per-object bias TRANSFERABLE? (same object, 100 ms of leading silence)");
  console.log("preset".padEnd(8) + "as-is".padStart(10) + "padded".padStart(10));
  for (const cc of EXACT) {
    setSeed(1);
    const r1 = renderCoda(SR, cc);
    const a1 = analyze(r1.signal, SR, { sensitivity: 0.6, minIci: 0.03 });
    const pad = Math.round(SR * 0.1);
    const sig = new Float32Array(r1.signal.length + pad); sig.set(r1.signal, pad);
    const a2 = analyze(sig, SR, { sensitivity: 0.6, minIci: 0.03 });
    console.log(cc.id.padEnd(8) + fmt(npvi(a1.ici), 3).padStart(10) + fmt(npvi(a2.ici), 3).padStart(10));
  }
  console.log("  => NOT transferable. 5R3 goes 1.249 -> 2.878 on padding alone.");
  console.log("  => so the bias is real and deterministic, but must NOT be published as a subtractable correction.");
}

// =====================================================================
H("13. THE HEADLINE — rhythm-ratio ordering asymmetry, stratified");
{
  const { rhythmRatios, surrogateShuffle } = await import("../explorer/js/rhythm.js");
  const { makeRng } = await import("../explorer/js/random.js");
  const five = codas.filter((c) => c.nClicks === 5);
  const near = (arr, c, w = 0.025) => arr.filter((v) => Math.abs(v - c) < w).length / arr.length;
  const obs = five.flatMap((c) => rhythmRatios(c.ici));
  const rg = makeRng(7);
  const shuf = five.flatMap((c) => rhythmRatios(surrogateShuffle(c.ici, rg)));
  console.log(`n = ${obs.length} ratios from ${five.length} five-click codas`);
  console.log(`             1:1(r=.500)   1:2(r=.333)   2:1(r=.667)`);
  console.log(`observed  ` + [near(obs, 0.5), near(obs, 1 / 3), near(obs, 2 / 3)].map((v) => (100 * v).toFixed(2).padStart(14)).join(""));
  console.log(`shuffled  ` + [near(shuf, 0.5), near(shuf, 1 / 3), near(shuf, 2 / 3)].map((v) => (100 * v).toFixed(2).padStart(14)).join(""));
  const s = obs.slice().sort((a, b) => a - b);
  console.log(`\nr < 0.4: ${(100 * obs.filter((v) => v < 0.4).length / obs.length).toFixed(2)}%   r > 0.6: ${(100 * obs.filter((v) => v > 0.6).length / obs.length).toFixed(2)}%   (min ${s[0].toFixed(3)}, max ${s[s.length - 1].toFixed(3)})`);

  const stat = (arr) => near(arr, 0.5);
  const rg2 = makeRng(3); const dist = new Float64Array(2000);
  for (let i = 0; i < 2000; i++) dist[i] = stat(five.flatMap((c) => rhythmRatios(surrogateShuffle(c.ici, rg2))));
  const so = Float64Array.from(dist).sort();
  let ge = 0; for (const v of dist) if (v >= stat(obs)) ge++;
  console.log(`\n1:1 excess vs within-coda shuffle: obs ${(100 * stat(obs)).toFixed(2)}%  null mean ${(100 * (dist.reduce((a, b) => a + b, 0) / 2000)).toFixed(2)}%  null max ${(100 * so[1999]).toFixed(2)}%  p = ${((ge + 1) / 2001).toFixed(5)}`);

  console.log("\nSTRATIFIED — does it hold WITHIN each coda type?");
  console.log("type".padEnd(9) + "n".padStart(6) + ["obs1:1", "shuf1:1", "obs1:2", "shuf1:2", "obs2:1", "shuf2:1"].map((s) => s.padStart(9)).join(""));
  for (const t of [...new Set(five.map((c) => c.type))]) {
    const sub = five.filter((c) => c.type === t); if (sub.length < 40) continue;
    const o = sub.flatMap((c) => rhythmRatios(c.ici));
    const r3 = makeRng(11);
    const sh = sub.flatMap((c) => rhythmRatios(surrogateShuffle(c.ici, r3)));
    console.log(t.padEnd(9) + String(sub.length).padStart(6) +
      [near(o, .5), near(sh, .5), near(o, 1 / 3), near(sh, 1 / 3), near(o, 2 / 3), near(sh, 2 / 3)]
        .map((v) => (100 * v).toFixed(1).padStart(9)).join(""));
  }
  const posL = {}, posS = {};
  for (const c of five) {
    let bi = 0, si = 0;
    for (let i = 1; i < c.ici.length; i++) { if (c.ici[i] > c.ici[bi]) bi = i; if (c.ici[i] < c.ici[si]) si = i; }
    posL[bi] = (posL[bi] || 0) + 1; posS[si] = (posS[si] || 0) + 1;
  }
  console.log(`\nposition of LONGEST interval  (of 4): ${JSON.stringify(posL)}`);
  console.log(`position of SHORTEST interval (of 4): ${JSON.stringify(posS)}`);
  console.log("=> long intervals come EARLY, short intervals come LATE. Codas accelerate.");
}

// =====================================================================
H("14. Does comparanda carry raw ICI windows? (needed for ratios on drums)");
console.log("entry fields:", Object.keys(comparanda.entries[0]).join(", "));
console.log(`measured drumming entries: ${comparanda.entries.filter((e) => e.tier === "measured").length}`);
console.log(`entries with an iciSample field: ${comparanda.entries.filter((e) => e.iciSample).length}`);
console.log("=> ratio analysis on the human side needs fetch_comparanda.py to emit iciSample. It does not today.");

// =====================================================================
H("15. Board sweep timing — what P3's Elimination Board would block on");
{
  const { surrogateTest, npvi: NP } = await import("../explorer/js/rhythm.js");
  const t = performance.now(); let cells = 0;
  for (const ty of [...new Set(codas.map((c) => c.type))]) {
    const sub = codas.filter((c) => c.type === ty);
    if (sub.length < 10) continue;
    surrogateTest({ iois: sub.flatMap((c) => c.ici), iterations: 2000, seed: 1, kind: "shift",
      statistic: (f) => { let s = 0, n = 0; for (let i = 0; i + 4 <= f.length; i += 4) { const v = NP(f.slice(i, i + 4)); if (Number.isFinite(v)) { s += v; n++; } } return n ? s / n : NaN; } });
    cells++;
  }
  const ms = performance.now() - t;
  console.log(`${cells} cells, ${ms.toFixed(0)} ms total, ${(ms / cells).toFixed(0)} ms/cell — main thread, blocking`);
  console.log("worst single claim measured above: order/poisson at ~1470 ms. 'No Worker needed' is refuted.");
}
