// exp05_density_control.mjs — how much of experiment 05's nPVI rise is the
// detector reacting to onset DENSITY rather than to rhythm?
//
//     node tools/exp05_density_control.mjs
//
// The finding under test: mean output nPVI rises 33.9 -> 89.6 as the mask ratio
// rises, against real codas at 18.1 (Pacific) / 21.0 (Dominica). Taken at face
// value that says WhAM generates LESS coda-like rhythm as the input stops
// constraining it — the opposite of the grammar prediction, and the more
// interesting result.
//
// It is confounded. Output onset count rises 5.09 -> 8.76 over the same range in
// a FIXED duration (2.57 s mean, preserved exactly by the model), so intervals
// shorten — and G0 established that this detector inflates nPVI at short
// intervals: a 60 ms isochronous train reads 13.06 instead of 0.
//
// So: build click trains at KNOWN nPVI and MATCHED density, and measure what the
// detector reports. Whatever it reports for a coda-like input at the observed
// output densities is the artifact floor. No GPU, no model.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { analyze } from "../explorer/js/dsp.js";
import { npvi } from "../explorer/js/rhythm.js";
import { clickGrain } from "../explorer/js/synth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ART = join(HERE, "..", "experiments", "05-structure-vs-timbre", "artifacts");

const SR = 44100;
const FRAME = 1 / 58;              // measured codec token grid, G0 section 8
const DURATION = 2.57;             // mean real output duration, all masks
const TAIL_SEC = 0.35;
const CLICK = { durMs: 25, centerHz: 2000, q: 1.2, noise: 0.6 };
const GRAIN = clickGrain(SR, CLICK);

const ONSET_COUNTS = [5, 6, 7, 8, 9, 10, 12, 14, 16];
const TRUE_NPVI = [0, 20, 40, 60, 80, 100];
const CODA_NPVI = 20;              // 18.1 Pacific / 21.0 Dominica

const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "  n/a");
const rule = (c = "=") => console.log(c.repeat(78));
const mean = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : NaN);

function render(icis) {
  const times = [0];
  for (const v of icis) times.push(times[times.length - 1] + v);
  const out = new Float32Array(Math.ceil((times[times.length - 1] + TAIL_SEC) * SR));
  for (const t of times) {
    const off = Math.round(t * SR);
    for (let i = 0; i < GRAIN.length && off + i < out.length; i++) out[off + i] += GRAIN[i];
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak;
  return out;
}

/**
 * k onsets in `dur` seconds at target nPVI N, alternating a/b.
 * nPVI of an alternating sequence is 100|a-b|/((a+b)/2) at any length, so the
 * two-value construction covers the whole range for any k.
 * Snapped to the codec token grid; the ACHIEVED nPVI after snapping is returned
 * and used as ground truth, so snapping can never be mistaken for detector error.
 */
function build(k, N, dur) {
  const nInt = k - 1;
  const r = N / 100;
  const ratio = (2 + r) / (2 - r);
  const nA = Math.ceil(nInt / 2), nB = Math.floor(nInt / 2);
  const unit = dur / (nA * ratio + nB);
  let icis = [];
  for (let i = 0; i < nInt; i++) icis.push(i % 2 === 0 ? ratio * unit : unit);
  icis = icis.map((v) => Math.max(1, Math.round(v / FRAME)) * FRAME);
  return { icis, achieved: npvi(icis), dur: icis.reduce((s, v) => s + v, 0) };
}

rule();
console.log("EXPERIMENT 05 — DENSITY CONTROL");
rule();
console.log("Does the detector report higher nPVI purely because there are more onsets?");
console.log(`Duration fixed at ${DURATION}s (the real output mean, preserved at every mask).`);
console.log("No model involved. Ground truth is the achieved nPVI after grid snapping.\n");

console.log(`${"onsets".padStart(7)} ${"/s".padStart(5)}  ` +
            TRUE_NPVI.map((n) => `true ${String(n).padStart(3)}`).join("  "));
console.log("-".repeat(78));
const table = new Map();
for (const k of ONSET_COUNTS) {
  const cells = [];
  for (const N of TRUE_NPVI) {
    const { icis, achieved } = build(k, N, DURATION);
    const onsets = analyze(render(icis), SR).onsets;
    const got = onsets.length >= 3
      ? npvi(onsets.slice(1).map((v, i) => v - onsets[i]))
      : NaN;
    cells.push({ N, achieved, got, bias: got - achieved, detected: onsets.length, k });
    table.set(`${k}|${N}`, cells[cells.length - 1]);
  }
  console.log(`${String(k).padStart(7)} ${fmt(k / DURATION, 2).padStart(5)}  ` +
              cells.map((c) => fmt(c.got, 1).padStart(8)).join("  "));
}
console.log("-".repeat(78));
console.log("cells are DETECTED nPVI. Rows are onset count, columns are the true value.");

rule();
console.log("BIAS — detected minus true");
rule();
console.log(`${"onsets".padStart(7)}  ` + TRUE_NPVI.map((n) => `true ${String(n).padStart(3)}`).join("  "));
console.log("-".repeat(78));
for (const k of ONSET_COUNTS) {
  const cells = TRUE_NPVI.map((N) => table.get(`${k}|${N}`));
  console.log(`${String(k).padStart(7)}  ` +
              cells.map((c) => fmt(c.bias, 1).padStart(8)).join("  "));
}
console.log("-".repeat(78));

// --- the decisive column ---------------------------------------------------
rule();
console.log("THE DECISIVE QUESTION");
rule();
console.log(`If WhAM were producing CODA-LIKE rhythm (nPVI ~${CODA_NPVI}) at the observed`);
console.log("output densities, what would this detector report?\n");

const gp = join(ART, "gen_nsweep.json");
let observed = null;
if (existsSync(gp)) {
  const meas = join(ART, "nsweep_measured.txt");
  observed = existsSync(meas) ? readFileSync(meas, "utf8") : null;
}
const OBSERVED = [
  { mask: 0.10, onsets: 5.09, npvi: 33.9 },
  { mask: 0.20, onsets: 5.25, npvi: 45.8 },
  { mask: 0.30, onsets: 5.53, npvi: 54.1 },
  { mask: 0.40, onsets: 5.75, npvi: 62.3 },
  { mask: 0.60, onsets: 6.78, npvi: 84.5 },
  { mask: 0.80, onsets: 8.76, npvi: 89.6 },
];

function interpAtCoda(nOnsets) {
  const ks = ONSET_COUNTS;
  const lo = ks.filter((k) => k <= nOnsets).pop() ?? ks[0];
  const hi = ks.find((k) => k >= nOnsets) ?? ks[ks.length - 1];
  const a = table.get(`${lo}|${CODA_NPVI}`).got, b = table.get(`${hi}|${CODA_NPVI}`).got;
  if (lo === hi) return a;
  return a + (b - a) * ((nOnsets - lo) / (hi - lo));
}

console.log(`${"mask".padStart(6)} ${"out onsets".padStart(11)} ${"observed nPVI".padStart(14)} ` +
            `${"coda@density".padStart(13)} ${"unexplained".padStart(12)}`);
console.log("-".repeat(78));
for (const o of OBSERVED) {
  const pred = interpAtCoda(o.onsets);
  console.log(`${fmt(o.mask, 2).padStart(6)} ${fmt(o.onsets, 2).padStart(11)} ` +
              `${fmt(o.npvi, 1).padStart(14)} ${fmt(pred, 1).padStart(13)} ` +
              `${fmt(o.npvi - pred, 1).padStart(12)}`);
}
console.log("-".repeat(78));
console.log("coda@density = what the detector reports for a TRUE coda-like rhythm at");
console.log("that onset count. unexplained = observed minus that.");
console.log("");
console.log("If unexplained is near zero, the nPVI rise is a density artifact and says");
console.log("nothing about what WhAM generates. If it stays large, the model really is");
console.log("producing more irregular timing than a coda as the mask rises.");
rule();
