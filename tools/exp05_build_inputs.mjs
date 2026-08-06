// exp05_build_inputs.mjs — stage 1 of 3.
//
//     node tools/exp05_build_inputs.mjs
//
// Constructs experiment 05's input set, renders each as a click train with a
// FIXED grain, and writes raw float32 mono @ 44100 plus a manifest.
//
// Pipeline, and why it is split across two languages:
//
//   1. build   (node)   construct + render + manifest        <- this file
//   2. generate (python) WhAM translation, mask x seed sweep
//   3. measure (node)   shipped analyze() on inputs AND outputs
//
// Rendering and measurement both live in node so they use the SHIPPED
// explorer/js code. Reimplementing clickGrain or the onset detector in Python
// to keep the pipeline monolingual would create a second copy that can silently
// diverge from the one G0 characterised — the exact failure mode this project
// keeps catching. Interchange is raw float32, so neither side parses WAV headers.
//
// Every interval is an INTEGER NUMBER OF CODEC TOKENS. G0 section 8 measured
// that a 200 ms interval is 11.6 tokens, and that the resulting 11/12 alternation
// manufactures nPVI 8.70 out of a perfectly even input — before the model does
// anything. On-grid construction removes that exactly.

import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { npvi } from "../explorer/js/rhythm.js";
import { clickGrain } from "../explorer/js/synth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ART = join(HERE, "..", "experiments", "05-structure-vs-timbre", "artifacts");
const IN_DIR = join(ART, "inputs");

// ---------------------------------------------------------------------------
// Measured constants — see G0 section 8. Not assumed.
// ---------------------------------------------------------------------------
const SR = 44100;               // codec sample_rate, same as the analysis chain
const TOKENS_PER_SEC = 58;      // Interface.s2t(1.0)
const FRAME = 1 / TOKENS_PER_SEC;   // 17.241 ms

// Interval bounds, in tokens.
//   min 10 tokens = 172 ms. Below ~12 tokens the detector's own onset jitter
//   starts to dominate nPVI (G0 section 7: at a 60 ms shortest interval the
//   isochronous case reads 13.06 instead of 0).
//   max total 176 tokens = 3.03 s, the measured maximum real coda duration.
const MIN_TOK = 10;
const MAX_TOK = 60;
const MAX_TOTAL_TOK = 176;

const N_INTERVALS = 4;          // 5 clicks, matching the dominant coda length
const N_ITEMS = 140;            // 20 per nPVI decile band
const N_BANDS = 7;
const BAND_EDGES = [0, 10, 30, 50, 70, 90, 110, 130];
const SEED = 1;

const CLICK = { durMs: 25, centerHz: 2000, q: 1.2, noise: 0.6 };
const TAIL_SEC = 0.35;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);

const GRAIN = clickGrain(SR, CLICK);

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
  return { signal: out, trueOnsets: times };
}

// ---------------------------------------------------------------------------
// Enumerate on-grid token patterns, then sample stratified across nPVI so the
// regression has even leverage along the axis instead of piling up wherever
// random 4-tuples happen to land.
// ---------------------------------------------------------------------------
const pool = [];
for (let a = MIN_TOK; a <= MAX_TOK; a++) {
  for (let b = MIN_TOK; b <= MAX_TOK; b++) {
    for (let c = MIN_TOK; c <= MAX_TOK; c++) {
      for (let d = MIN_TOK; d <= MAX_TOK; d++) {
        const toks = [a, b, c, d];
        const total = a + b + c + d;
        if (total > MAX_TOTAL_TOK) continue;
        const icis = toks.map((t) => t * FRAME);
        const n = npvi(icis);
        if (!Number.isFinite(n) || n > BAND_EDGES[BAND_EDGES.length - 1]) continue;
        pool.push({ toks, n });
      }
    }
  }
}

const bands = Array.from({ length: N_BANDS }, () => []);
for (const p of pool) {
  const bi = BAND_EDGES.findIndex((e, i) => i < N_BANDS && p.n >= e && p.n < BAND_EDGES[i + 1]);
  if (bi >= 0) bands[bi].push(p);
}

const perBand = Math.floor(N_ITEMS / N_BANDS);
const items = [];
bands.forEach((band, bi) => {
  if (!band.length) return;
  const seen = new Set();
  let guard = 0;
  while (items.filter((x) => x.band === bi).length < perBand && guard++ < perBand * 500) {
    const p = band[Math.floor(rng() * band.length)];
    const key = p.toks.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ band: bi, toks: p.toks, npviIn: p.n });
  }
});

mkdirSync(ART, { recursive: true });
rmSync(IN_DIR, { recursive: true, force: true });
mkdirSync(IN_DIR, { recursive: true });

const manifest = [];
for (let k = 0; k < items.length; k++) {
  const it = items[k];
  const icis = it.toks.map((t) => t * FRAME);
  const { signal, trueOnsets } = render(icis);
  const id = `in${String(k).padStart(4, "0")}`;
  writeFileSync(join(IN_DIR, `${id}.f32`), Buffer.from(signal.buffer, 0, signal.length * 4));
  manifest.push({
    id, band: it.band, tokens: it.toks, icis,
    npviIn: Number(it.npviIn.toFixed(6)),
    trueOnsets, durSec: signal.length / SR,
    totalTokens: it.toks.reduce((s, v) => s + v, 0),
  });
}

const meta = {
  schema: 1,
  sampleRate: SR,
  tokensPerSec: TOKENS_PER_SEC,
  frameMs: FRAME * 1000,
  click: CLICK,
  tailSec: TAIL_SEC,
  seed: SEED,
  constraints: {
    minTokens: MIN_TOK, maxTokens: MAX_TOK, maxTotalTokens: MAX_TOTAL_TOK,
    nIntervals: N_INTERVALS,
    note: ("Every interval is an integer token count, so the codec grid " +
           "contributes exactly zero nPVI error (G0 section 8). Minimum 10 " +
           "tokens keeps the detector's own onset jitter out of the measurement; " +
           "maximum total 176 tokens = 3.03 s, the longest real coda measured."),
  },
  poolSize: pool.length,
  bandEdges: BAND_EDGES,
  items: manifest.length,
  format: "raw float32 mono, little-endian, no header",
};
writeFileSync(join(ART, "manifest.json"), JSON.stringify({ meta, items: manifest }, null, 1));

console.log("experiment 05 — stage 1, inputs");
console.log(`  on-grid patterns enumerated   ${pool.length.toLocaleString()}`);
console.log(`  written                        ${manifest.length} inputs -> ${IN_DIR}`);
console.log(`  nPVI coverage`);
for (let b = 0; b < N_BANDS; b++) {
  const rows = manifest.filter((m) => m.band === b);
  if (!rows.length) { console.log(`    ${BAND_EDGES[b]}-${BAND_EDGES[b + 1]}: none`); continue; }
  const ns = rows.map((m) => m.npviIn);
  const ds = rows.map((m) => m.durSec);
  console.log(`    ${String(BAND_EDGES[b]).padStart(3)}-${String(BAND_EDGES[b + 1]).padStart(3)}  ` +
              `n=${String(rows.length).padStart(2)}  nPVI ${Math.min(...ns).toFixed(1)}-${Math.max(...ns).toFixed(1)}` +
              `   dur ${Math.min(...ds).toFixed(2)}-${Math.max(...ds).toFixed(2)}s`);
}
const allD = manifest.map((m) => m.durSec);
console.log(`  duration range                 ${Math.min(...allD).toFixed(2)}-${Math.max(...allD).toFixed(2)} s ` +
            `(real codas 0.5-3.04 s)`);
console.log(`  manifest                       ${join(ART, "manifest.json")}`);
