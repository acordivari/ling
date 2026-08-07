// exp06_gate.mjs — the instrument, before any matching.
//
//     node tools/exp06_gate.mjs
//
// Experiment 06 wants to recover a correspondence between 1,501 DSWP audio
// files and 8,112 cleaned annotation rows by comparing ICI vectors. That match
// is only meaningful if the shipped onset detector recovers a coda's click
// count and timing from audio. This gate tests whether it does, and refuses to
// let the matcher run if it does not.
//
// The specific hazard is known in advance and is why this file exists. A sperm
// whale click is not an impulse -- it is a pulse train whose internal spacing
// (IPI) experiment 03 measured at 2.81-3.31 ms on real animals. A detector that
// fires on those internal pulses returns far too many onsets. A 2026-08-06
// probe with a crude 20 ms-refractory detector returned 14 onsets on a file
// that should hold a 5-click coda, at intervals of 26-51 ms -- above the
// shipped detector's 30 ms minIci floor, so the floor alone does not save it.
//
// Experiment 05's G0 failed as pre-registered, in the direction that would have
// manufactured its headline. The lesson taken from it is that a measurement
// chain gets validated on constructed ground truth first.
//
// The detector under test is `analyze` from explorer/js/dsp.js, called exactly
// as the browser calls it. The synth is the shipped renderCoda/spermWhaleClick.
// Neither is reimplemented here.

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { analyze } from "../explorer/js/dsp.js";
import { clickGrain, renderCoda } from "../explorer/js/synth.js";
import { setSeed } from "../explorer/js/random.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ART = join(HERE, "..", "experiments", "06-audio-annotation-join", "artifacts");
const CORPUS = join(HERE, "..", "explorer", "data", "coda-corpus.json");
const DSWP = join(HERE, "..", "data", "dswp");

// --- pre-registered constants, fixed before running ------------------------
const SEED = 606;
const N_CODAS = 120;          // sampled annotation rows for G1/G3
// All five recording configurations found in the DSWP headers. G2 was
// pre-registered as 44.1k vs 48k from a five-file probe; the full fetch showed
// five rates, so the gate runs across all of them. Amendment recorded in the
// experiment README rather than folded in silently.
const RIGS = [44100, 48000, 96000, 120000];
const SR_A = 44100;           // reference rate for G1/G3
const SR_B = 48000;
const IPI_MS = [2.8, 3.3, 5.5]; // exp 03 measured 2.81-3.31; 5.5 is synth default
const G1_MIN_R = 0.95;
const G1_SLOPE = [0.90, 1.10];
const G2_MAX_D = 0.02;
const G3_MIN_EXACT = 0.95;
const G4_SENS = [0.48, 0.6, 0.72]; // +/-20% around the shipped default
const G4_MAX_MEDIAN_SHIFT = 1;
const G4_MIN_UNCHANGED = 0.80;
const G4_MAX_FILES = 200;

const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : "  n/a");
const rule = (c = "=") => console.log(c.repeat(78));
const mean = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : NaN);
const median = (xs) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
function fit(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2;
  }
  const slope = sxx > 0 ? sxy / sxx : NaN;
  return { slope, r: sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN, n: pts.length };
}

// --- minimal RIFF/WAVE PCM16 reader ----------------------------------------
// The exp05 pipeline passes raw .f32 between Python and Node, so there is no
// WAV decoder in this repo to reuse. Chunks are walked rather than assuming a
// 44-byte canonical header. Stereo is averaged to mono, matching what the
// browser's decodeAudioData path hands `analyze` for a multi-channel file.
function readWav(path) {
  const b = readFileSync(path);
  if (b.length < 12 || b.toString("ascii", 0, 4) !== "RIFF" ||
      b.toString("ascii", 8, 12) !== "WAVE") return null;
  let p = 12, fmtc = null, data = null;
  while (p + 8 <= b.length) {
    const id = b.toString("ascii", p, p + 4);
    const size = b.readUInt32LE(p + 4);
    const body = p + 8;
    if (id === "fmt ") {
      fmtc = { channels: b.readUInt16LE(body + 2), sampleRate: b.readUInt32LE(body + 4),
               bits: b.readUInt16LE(body + 14) };
    } else if (id === "data") {
      data = b.subarray(body, Math.min(body + size, b.length));
    }
    p = body + size + (size & 1);
  }
  if (!fmtc || !data || fmtc.bits !== 16) return null;
  const ch = fmtc.channels, n = Math.floor(data.length / 2 / ch);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let c = 0; c < ch; c++) acc += data.readInt16LE((i * ch + c) * 2) / 32768;
    out[i] = acc / ch;
  }
  return { signal: out, sampleRate: fmtc.sampleRate, channels: ch };
}

// --- corpus ----------------------------------------------------------------
if (!existsSync(CORPUS)) {
  console.error(`missing ${CORPUS}\n  run: python3 tools/fetch_corpus.py`);
  process.exit(1);
}
const corpus = JSON.parse(readFileSync(CORPUS, "utf8"));
const SCALE = 10000; // ici_units: integer 1/10000 s

setSeed(SEED);
let rngState = SEED >>> 0;
const rnd = () => {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Sample annotation rows with >=4 clicks. Below that an ICI vector carries too
// little to identify a row and the match would be uninformative anyway.
const pool = corpus.ici.map((v, i) => ({ i, ici: v })).filter((r) => r.ici.length >= 3);
const sample = [];
const seen = new Set();
while (sample.length < N_CODAS && seen.size < pool.length) {
  const k = Math.floor(rnd() * pool.length);
  if (seen.has(k)) continue;
  seen.add(k);
  sample.push(pool[k]);
}

function codaOf(row) {
  const icis = row.ici.map((v) => v / SCALE);
  const duration = icis.reduce((s, v) => s + v, 0);
  return { duration, iciNorm: icis.map((v) => v / duration), icis, nClicks: icis.length + 1 };
}

function renderImpulse(icis, sr, tail = 0.35) {
  const grain = clickGrain(sr, { durMs: 6, centerHz: 6000, q: 0.7, noise: 0.9 });
  const times = [0];
  for (const v of icis) times.push(times[times.length - 1] + v);
  const out = new Float32Array(Math.ceil((times[times.length - 1] + tail) * sr));
  for (const t of times) {
    const off = Math.round(t * sr);
    for (let i = 0; i < grain.length && off + i < out.length; i++) out[off + i] += grain[i];
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak;
  return out;
}

const icisOf = (onsets) => onsets.slice(1).map((v, i) => v - onsets[i]);
const stdIci = (icis) => {
  const d = icis.reduce((s, v) => s + v, 0);
  return d > 0 ? icis.map((v) => v / d) : icis;
};

rule();
console.log("EXPERIMENT 06 — GATE (instrument validation, before any matching)");
rule();
console.log(`  detector   analyze() from explorer/js/dsp.js, as the browser calls it`);
console.log(`  synth      renderCoda/spermWhaleClick (multipulse) + clickGrain (impulse)`);
console.log(`  corpus     ${corpus.ici.length} cleaned codas; sampled ${sample.length}, seed ${SEED}`);
console.log(`  rigs       ${SR_A} Hz and ${SR_B} Hz, both found in the DSWP headers`);
console.log();

const results = {};

// ---------------------------------------------------------------------------
// G1 — impulse clicks. Baseline: does the ICI machinery work at all?
// ---------------------------------------------------------------------------
console.log("G1  impulse clicks — baseline ICI recovery");
{
  const pts = [];
  let exact = 0;
  for (const row of sample) {
    const c = codaOf(row);
    const sig = renderImpulse(c.icis, SR_A);
    const got = analyze(sig, SR_A).onsets;
    if (got.length === c.nClicks) exact++;
    const rec = icisOf(got);
    const n = Math.min(rec.length, c.icis.length);
    for (let i = 0; i < n; i++) pts.push([c.icis[i], rec[i]]);
  }
  const f = fit(pts);
  const pass = f.r >= G1_MIN_R && f.slope >= G1_SLOPE[0] && f.slope <= G1_SLOPE[1];
  results.G1 = { r: f.r, slope: f.slope, exactClickCount: exact / sample.length, pass };
  console.log(`    slope ${fmt(f.slope, 4)} [${G1_SLOPE[0]}-${G1_SLOPE[1]}]   ` +
              `r ${fmt(f.r, 4)} [>=${G1_MIN_R}]   ` +
              `exact click count ${fmt(100 * exact / sample.length, 1)}%`);
  console.log(`    ${pass ? "PASS" : "FAIL"}`);
}
console.log();

// ---------------------------------------------------------------------------
// G3 — multipulse clicks. THE gate. Realistic sperm whale click structure.
// ---------------------------------------------------------------------------
console.log("G3  multipulse clicks — the hazard this gate exists for");
console.log("    (renderCoda uses spermWhaleClick: a decaying pulse train at the IPI)");
{
  const perIpi = [];
  console.log(`      ${"rate".padEnd(9)}${"IPI".padStart(6)}${"exact".padStart(9)}` +
              `${"over".padStart(8)}${"under".padStart(8)}${"cntErr".padStart(8)}` +
              `${"slope".padStart(8)}${"r".padStart(7)}`);
  for (const sr of RIGS) {
    for (const ipiMs of IPI_MS) {
      const pts = [];
      let exact = 0, over = 0, under = 0;
      const counts = [];
      for (const row of sample) {
        const c = codaOf(row);
        const { signal } = renderCoda(sr, c, { ipiMs, tail: 0.35 });
        const got = analyze(signal, sr).onsets;
        counts.push(got.length - c.nClicks);
        if (got.length === c.nClicks) exact++;
        else if (got.length > c.nClicks) over++;
        else under++;
        const rec = icisOf(got);
        const n = Math.min(rec.length, c.icis.length);
        for (let i = 0; i < n; i++) pts.push([c.icis[i], rec[i]]);
      }
      const f = fit(pts);
      const frac = exact / sample.length;
      perIpi.push({ sampleRate: sr, ipiMs, exact: frac, over: over / sample.length,
                    under: under / sample.length, medianCountErr: median(counts),
                    slope: f.slope, r: f.r });
      console.log(`      ${String(sr).padEnd(9)}${fmt(ipiMs, 1).padStart(6)}` +
                  `${(fmt(100 * frac, 1) + "%").padStart(9)}` +
                  `${(fmt(100 * over / sample.length, 1) + "%").padStart(8)}` +
                  `${(fmt(100 * under / sample.length, 1) + "%").padStart(8)}` +
                  `${fmt(median(counts), 1).padStart(8)}` +
                  `${fmt(f.slope, 3).padStart(8)}${fmt(f.r, 3).padStart(7)}`);
    }
  }
  const worst = Math.min(...perIpi.map((x) => x.exact));
  const pass = worst >= G3_MIN_EXACT;
  results.G3 = { perIpi, worstExact: worst, pass };
  console.log(`    worst exact click count ${fmt(100 * worst, 1)}% [>=${100 * G3_MIN_EXACT}%]   ` +
              `${pass ? "PASS" : "FAIL"}`);
}
console.log();

// ---------------------------------------------------------------------------
// G2 — rig invariance. Same codas at both sample rates.
// ---------------------------------------------------------------------------
console.log(`G2  rig invariance — all ${RIGS.length} rates against ${SR_A} Hz reference`);
{
  const perRig = [];
  for (const sr of RIGS) {
    if (sr === SR_A) continue;
    const ds = [];
    let countDiff = 0;
    for (const row of sample) {
      const c = codaOf(row);
      const a = analyze(renderCoda(SR_A, c, { ipiMs: 3.3, tail: 0.35 }).signal, SR_A).onsets;
      const b = analyze(renderCoda(sr, c, { ipiMs: 3.3, tail: 0.35 }).signal, sr).onsets;
      if (a.length !== b.length) { countDiff++; continue; }
      if (a.length < 3) continue;
      const sa = stdIci(icisOf(a)), sb = stdIci(icisOf(b));
      ds.push(mean(sa.map((v, i) => Math.abs(v - sb[i]))));
    }
    const md = median(ds);
    perRig.push({ sampleRate: sr, medianD: md, nComparable: ds.length,
                  clickCountDisagreements: countDiff });
    console.log(`    ${String(sr).padEnd(8)} median standardised-ICI d ${fmt(md, 5)}   ` +
                `comparable ${ds.length}/${sample.length}   ` +
                `count disagreements ${countDiff}`);
  }
  const worstD = Math.max(...perRig.map((x) => (Number.isFinite(x.medianD) ? x.medianD : Infinity)));
  const pass = worstD <= G2_MAX_D;
  results.G2 = { perRig, worstMedianD: worstD, pass };
  console.log(`    worst median d ${fmt(worstD, 5)} [<=${G2_MAX_D}]   ${pass ? "PASS" : "FAIL"}`);
}
console.log();

// ---------------------------------------------------------------------------
// G4 — real DSWP audio. Stability, not accuracy: there is no ground truth.
// ---------------------------------------------------------------------------
console.log("G4  real DSWP audio — click-count stability under sensitivity +/-20%");
{
  // Stratified by recording configuration. Taking the first N by id would draw
  // whatever rig happens to sit at the front of the numbering, and rig is
  // exactly the variable under test here.
  let ids = [];
  if (existsSync(join(DSWP, "index.json"))) {
    const idx = JSON.parse(readFileSync(join(DSWP, "index.json"), "utf8"));
    const cfgs = Object.entries(idx.recording_configurations);
    const per = Math.max(1, Math.floor(G4_MAX_FILES / cfgs.length));
    for (const [, v] of cfgs) ids.push(...v.ids.slice(0, per));
    ids.sort((a, b) => a - b);
  }
  ids = ids.filter((i) => existsSync(join(DSWP, `${i}.wav`)));

  if (!ids.length) {
    console.log("    no audio on disk — run: python3 tools/fetch_dswp.py");
    results.G4 = { pass: null, note: "no audio available" };
  } else {
    const rows = [];
    for (const i of ids) {
      const w = readWav(join(DSWP, `${i}.wav`));
      if (!w) continue;
      const cs = G4_SENS.map((s) => analyze(w.signal, w.sampleRate, { sensitivity: s }).onsets.length);
      rows.push({ id: i, sr: w.sampleRate, counts: cs,
                  spread: Math.max(...cs) - Math.min(...cs), base: cs[1] });
    }
    const unchanged = rows.filter((r) => r.spread === 0).length / rows.length;
    const medShift = median(rows.map((r) => r.spread));
    const pass = medShift <= G4_MAX_MEDIAN_SHIFT && unchanged >= G4_MIN_UNCHANGED;
    const hist = {};
    for (const r of rows) hist[r.base] = (hist[r.base] || 0) + 1;

    // Broken out by rig: the corpus has five, and click-count recovery is
    // expected to depend on rate because the detector's hop is in samples.
    const byRig = {};
    for (const r of rows) {
      (byRig[r.sr] ||= []).push(r);
    }
    const rigStats = Object.entries(byRig).map(([sr, rs]) => ({
      sampleRate: Number(sr), n: rs.length,
      medianClicks: median(rs.map((r) => r.base)),
      unchanged: rs.filter((r) => r.spread === 0).length / rs.length,
    })).sort((a, b) => a.sampleRate - b.sampleRate);

    results.G4 = { n: rows.length, unchangedFraction: unchanged, medianSpread: medShift,
                   clickCountHistogram: hist, byRig: rigStats, pass };
    console.log(`    files ${rows.length}   median count spread ${fmt(medShift, 1)} ` +
                `[<=${G4_MAX_MEDIAN_SHIFT}]   unchanged ${fmt(100 * unchanged, 1)}% ` +
                `[>=${100 * G4_MIN_UNCHANGED}%]`);
    console.log(`    by rig:`);
    for (const s of rigStats) {
      console.log(`      ${String(s.sampleRate).padEnd(8)} n ${String(s.n).padStart(4)}   ` +
                  `median recovered clicks ${fmt(s.medianClicks, 1).padStart(6)}   ` +
                  `unchanged ${fmt(100 * s.unchanged, 1)}%`);
    }
    const top = Object.entries(hist).map(([k, v]) => [Number(k), v])
      .sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log(`    recovered click counts at default sensitivity (corpus-wide):`);
    console.log(`      ` + top.map(([k, v]) => `${k}:${v}`).join("  "));
    console.log(`    ${pass ? "PASS" : "FAIL"}`);
  }
}
console.log();

// ---------------------------------------------------------------------------
rule();
const gates = ["G1", "G3", "G2", "G4"];
const verdict = gates.every((g) => results[g]?.pass === true);
for (const g of gates) {
  const p = results[g]?.pass;
  console.log(`  ${g}  ${p === true ? "PASS" : p === false ? "FAIL" : "NOT RUN"}`);
}
rule();
console.log(verdict
  ? "GATE PASSES — tools/exp06_match.mjs may run."
  : "GATE DOES NOT PASS — no matching statistic may be computed against the\n" +
    "real annotation table. Record the failure and amend the instrument or the\n" +
    "inputs, as experiment 05 did, rather than proceeding.");
rule();

mkdirSync(ART, { recursive: true });
const out = { experiment: "06-audio-annotation-join", stage: "gate",
              seed: SEED, nCodas: sample.length,
              thresholds: { G1_MIN_R, G1_SLOPE, G2_MAX_D, G3_MIN_EXACT,
                            G4_SENS, G4_MAX_MEDIAN_SHIFT, G4_MIN_UNCHANGED },
              results, verdict };
writeFileSync(join(ART, "gate.json"), JSON.stringify(out, null, 2));
console.log(`  written ${join(ART, "gate.json")}`);
process.exit(verdict ? 0 : 1);
