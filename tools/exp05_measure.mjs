// exp05_measure.mjs — stage 3 of 3.
//
//     node tools/exp05_measure.mjs p0
//     node tools/exp05_measure.mjs n
//     node tools/exp05_measure.mjs sweep
//
// Runs the SHIPPED analyze() over both the inputs and the model outputs, and
// reports beta: the slope of output nPVI on input nPVI.
//
// Inputs are measured through the SAME detector as outputs, deliberately. G0
// showed the detector is near-linear on this input set (slope 0.986) but not
// exactly 1, and regressing measured-output on measured-input cancels that
// systematic to first order. Beta against the CONSTRUCTED nPVI is reported
// alongside so the difference is visible rather than hidden.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { analyze } from "../explorer/js/dsp.js";
import { npvi } from "../explorer/js/rhythm.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ART = join(HERE, "..", "experiments", "05-structure-vs-timbre", "artifacts");

const mode = process.argv[2];
if (!mode) { console.error("usage: node tools/exp05_measure.mjs <p0|n|sweep>"); process.exit(1); }

const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : "  n/a");
const rule = (c = "=") => console.log(c.repeat(78));
const mean = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : NaN);
const sd = (xs) => {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
};
function fit(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2;
  }
  const slope = sxx > 0 ? sxy / sxx : NaN;
  return { slope, intercept: my - slope * mx, r: sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN, n: pts.length };
}

// "<mode>_asacter" reads the real-audio manifest and input dir; anything else
// reads the synthetic ones. ASACTER items carry no constructed nPVI — there is
// no ground-truth annotation for real recordings — so npviConstructed is null
// there and only the measured-on-measured regression is defined.
const isAsacter = mode.endsWith("_asacter");
const isCoda = mode.endsWith("_coda");
const man = JSON.parse(readFileSync(join(ART,
  isAsacter ? "manifest_asacter.json" : isCoda ? "manifest_coda.json" : "manifest.json"), "utf8"));
const IN_DIR = isAsacter ? "inputs_asacter" : isCoda ? "inputs_coda" : "inputs";
const SR = man.meta.sampleRate;
const byId = new Map(man.items.map((it) => [it.id, it]));

const genPath = join(ART, `gen_${mode}.json`);
if (!existsSync(genPath)) {
  console.error(`missing ${genPath}\n  run: ./wham/.venv/bin/python tools/exp05_generate.py --mode ${mode}`);
  process.exit(1);
}
const gen = JSON.parse(readFileSync(genPath, "utf8"));

function readF32(p) {
  const buf = readFileSync(p);
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}
function measure(signal) {
  const onsets = analyze(signal, SR).onsets;
  if (onsets.length < 3) return { npvi: NaN, nOnsets: onsets.length };
  const icis = onsets.slice(1).map((v, i) => v - onsets[i]);
  return { npvi: npvi(icis), nOnsets: onsets.length };
}

rule();
console.log(`EXPERIMENT 05 — stage 3, measurement (${mode})`);
rule();
console.log(`  ${gen.generations.length} generations, torch ${gen.torch}, device ${gen.device}`);
console.log(`  masks ${JSON.stringify(gen.masks)}  seeds ${JSON.stringify(gen.seeds)}`);
console.log(`  checkpoints  ` + Object.entries(gen.checkpoints)
  .map(([k, v]) => `${k} ${(v.bytes / 1e6).toFixed(1)}MB`).join("  "));

// --- measure every input once ---------------------------------------------
const inMeas = new Map();
const usedIds = [...new Set(gen.generations.map((g) => g.input))];
for (const id of usedIds) {
  inMeas.set(id, measure(readF32(join(ART, IN_DIR, `${id}.f32`))));
}
const inPts = usedIds.map((id) => [byId.get(id).npviIn ?? NaN, inMeas.get(id).npvi])
  .filter((p) => p.every(Number.isFinite));
const inFit = fit(inPts);
console.log(`\n  detector on the inputs: slope ${fmt(inFit.slope)}  r ${fmt(inFit.r, 4)}  n ${inFit.n}`);
console.log(`  (G0 measured 0.986 / 0.9987 on the grid-aligned spec — a consistency check)`);

// --- measure every output --------------------------------------------------
const rows = [];
for (const g of gen.generations) {
  const m = measure(readF32(join(ART, `out_${mode}`, g.file)));
  rows.push({
    ...g,
    npviConstructed: byId.get(g.input).npviIn ?? NaN,
    npviInMeasured: inMeas.get(g.input).npvi,
    npviOut: m.npvi,
    nOnsetsOut: m.nOnsets,
    nOnsetsIn: inMeas.get(g.input).nOnsets,
  });
}
const usable = rows.filter((r) => Number.isFinite(r.npviOut) && Number.isFinite(r.npviInMeasured));
const dead = rows.length - usable.length;

rule();
console.log("BETA — slope of output nPVI on input nPVI, per mask ratio");
rule();
console.log(`${"mask".padStart(6)} ${"n".padStart(5)} ${"beta(meas)".padStart(11)} ${"r".padStart(7)} ` +
            `${"intercept".padStart(10)} ${"beta(constr)".padStart(13)} ${"out nPVI mean".padStart(14)}`);
console.log("-".repeat(78));
for (const mk of gen.masks) {
  const sub = usable.filter((r) => r.mask === mk);
  if (!sub.length) continue;
  const f = fit(sub.map((r) => [r.npviInMeasured, r.npviOut]));
  const fc = fit(sub.map((r) => [r.npviConstructed, r.npviOut]));
  console.log(`${fmt(mk, 2).padStart(6)} ${String(sub.length).padStart(5)} ${fmt(f.slope).padStart(11)} ` +
              `${fmt(f.r, 4).padStart(7)} ${fmt(f.intercept, 2).padStart(10)} ` +
              `${fmt(fc.slope).padStart(13)} ${fmt(mean(sub.map((r) => r.npviOut)), 2).padStart(14)}`);
}
console.log("-".repeat(78));
console.log("beta ~ 1  -> timbre: input rhythm passes through");
console.log("beta ~ 0 with intercept near the coda range -> grammar: outputs snap to");
console.log("           canonical coda timing regardless of input");
if (dead) console.log(`\n  ${dead} of ${rows.length} outputs yielded < 3 onsets and are excluded`);

// --- onset counts: is the model even producing click trains? ---------------
// --- beta on SEED-AVERAGED outputs, with a bootstrap CI --------------------
//
// N (below) asks whether a SINGLE generation is input-driven. That is not the
// same question as whether the SLOPE is estimable: averaging k seeds shrinks the
// sampling component by sqrt(k) while leaving the input-driven component alone.
// So a mask can fail N and still support a slope, or fail both. This reports the
// second question explicitly rather than letting the first stand in for it.
//
// Added after N failed at every mask above 0.10. It does NOT relax the gate —
// beta remains uninterpretable where N fails; this quantifies how uninterpretable.
if (gen.seeds.length > 1) {
  rule();
  console.log("BETA ON SEED-AVERAGED OUTPUTS, with bootstrap CI over inputs");
  rule();
  console.log("N asks if one generation is input-driven. This asks if the SLOPE survives");
  console.log("averaging. A CI spanning 0 means no structure is recoverable at that mask;");
  console.log("a CI spanning 1 means it is indistinguishable from full passthrough.\n");
  console.log(`${"mask".padStart(6)} ${"inputs".padStart(7)} ${"beta".padStart(7)} ` +
              `${"95% CI".padStart(18)} ${"r".padStart(7)}  excludes 0?  excludes 1?`);
  console.log("-".repeat(78));
  const rngB = (() => { let a = 12345; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  for (const mk of gen.masks) {
    const sub = usable.filter((r) => r.mask === mk);
    const byInput = new Map();
    for (const r of sub) {
      if (!byInput.has(r.input)) byInput.set(r.input, { x: r.npviInMeasured, ys: [] });
      byInput.get(r.input).ys.push(r.npviOut);
    }
    const pts = [...byInput.values()].map((v) => [v.x, mean(v.ys)]);
    if (pts.length < 3) continue;
    const f = fit(pts);
    const boots = [];
    for (let b = 0; b < 2000; b++) {
      const samp = Array.from({ length: pts.length }, () => pts[Math.floor(rngB() * pts.length)]);
      const s = fit(samp).slope;
      if (Number.isFinite(s)) boots.push(s);
    }
    boots.sort((a, b) => a - b);
    const lo = boots[Math.floor(0.025 * boots.length)], hi = boots[Math.floor(0.975 * boots.length)];
    console.log(`${fmt(mk, 2).padStart(6)} ${String(pts.length).padStart(7)} ${fmt(f.slope).padStart(7)} ` +
                `${`[${fmt(lo, 2)}, ${fmt(hi, 2)}]`.padStart(18)} ${fmt(f.r, 3).padStart(7)}  ` +
                `${(lo > 0 || hi < 0) ? "    yes   " : "    no    "}  ` +
                `${(lo > 1 || hi < 1) ? "   yes" : "   no"}`);
  }
  console.log("-".repeat(78));
  console.log("Bootstrap resamples INPUTS (the unit of independence), not generations.");
}

rule();
console.log("SANITY — onset counts and level");
rule();
{
  console.log(`${"mask".padStart(6)} ${"out onsets mean".padStart(16)} ${"range".padStart(8)} ` +
              `${"= 5 (input)".padStart(12)}`);
  for (const mk of gen.masks) {
    const sub = rows.filter((r) => r.mask === mk);
    if (!sub.length) continue;
    const ns = sub.map((r) => r.nOnsetsOut);
    console.log(`${fmt(mk, 2).padStart(6)} ${fmt(mean(ns), 2).padStart(16)} ` +
                `${`${Math.min(...ns)}-${Math.max(...ns)}`.padStart(8)} ` +
                `${`${(100 * ns.filter((v) => v === 5).length / ns.length).toFixed(0)}%`.padStart(12)}`);
  }
  console.log("");
}
console.log(`  input onsets      mean ${fmt(mean(rows.map((r) => r.nOnsetsIn)), 2)} (constructed: 5)`);
console.log(`  output onsets     mean ${fmt(mean(rows.map((r) => r.nOnsetsOut)), 2)}  ` +
            `range ${Math.min(...rows.map((r) => r.nOnsetsOut))}-${Math.max(...rows.map((r) => r.nOnsetsOut))}`);
console.log(`  outputs with <3 onsets   ${dead}`);
console.log(`  output rms        mean ${fmt(mean(rows.map((r) => r.rms)), 5)}  ` +
            `min ${fmt(Math.min(...rows.map((r) => r.rms)), 5)}`);

// --- N: the control that decides whether beta exists, PER MASK -------------
//
// The pre-registration ran N at a single mask ratio. That was a design error:
// `n` FAILED at mask 0.6 (ratio 1.809) while `p0` returned beta 0.913 at mask
// 0.2 — validity is mask-dependent by construction, since mask 0 copies the
// input and mask 1 generates unconditionally. N is now evaluated per mask and
// beta is only interpretable where it passes.
if (gen.seeds.length > 1) {
  rule();
  console.log("N — SEED VARIANCE vs INPUT VARIANCE, per mask");
  rule();
  console.log("PRE-REGISTERED FAILURE: within-input SD >= 0.7 x between-input SD.");
  console.log("Where this fails, output rhythm is sampling noise and beta means nothing,");
  console.log("however clean its regression looks.\n");
  console.log(`${"mask".padStart(6)} ${"inputs".padStart(7)} ${"within SD".padStart(10)} ` +
              `${"between SD".padStart(11)} ${"ratio".padStart(7)}  verdict`);
  console.log("-".repeat(78));
  const valid = [];
  for (const mk of gen.masks) {
    const sub = usable.filter((r) => r.mask === mk);
    const byInput = new Map();
    for (const r of sub) {
      if (!byInput.has(r.input)) byInput.set(r.input, []);
      byInput.get(r.input).push(r.npviOut);
    }
    const withinSds = [...byInput.values()].filter((v) => v.length > 1).map(sd);
    const within = mean(withinSds);
    const between = sd([...byInput.values()].map(mean));
    const ratio = within / between;
    const ok = ratio < 0.7;
    if (ok) valid.push(mk);
    console.log(`${fmt(mk, 2).padStart(6)} ${String(byInput.size).padStart(7)} ${fmt(within, 2).padStart(10)} ` +
                `${fmt(between, 2).padStart(11)} ${fmt(ratio, 3).padStart(7)}  ` +
                `${ok ? "pass" : "FAIL — beta not interpretable"}`);
  }
  console.log("-".repeat(78));
  console.log(valid.length
    ? `  beta is interpretable at mask ${valid.map((v) => fmt(v, 2)).join(", ")} and nowhere else here.`
    : `  beta is interpretable at NO mask tested. The model's output rhythm is\n` +
      `  dominated by sampling noise across this range.`);
}

rule();
