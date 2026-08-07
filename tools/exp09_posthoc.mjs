// exp09_posthoc.mjs — robustness diagnostics for exp09's S2b survival.
//
//     node tools/exp09_posthoc.mjs
//
// NOT pre-registered. Run after the registered sweep falsified the rubato half
// of the prediction, to check whether the pooled within-class autocorrelation
// is broad-based or carried by a few fragments, one recording, or the majority
// class. Duplicates the main tool's run construction on purpose: a bug shared
// through an import would replicate here invisibly.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makeRng } from "../explorer/js/random.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const lines = readFileSync(join(ROOT, "data", "sperm-whale-dialogues.csv"), "utf8").trim().split(/\r?\n/);
const head = lines[0].replace(/^﻿/, "").split(",").map((s) => s.trim());
const iREC = head.indexOf("REC"), iN = head.indexOf("nClicks");
const iDur = head.indexOf("Duration"), iW = head.indexOf("Whale"), iTs = head.indexOf("TsTo");
const lab = JSON.parse(readFileSync(join(ROOT, "data", "sharma_labels", "labels.json"), "utf8"));
const all = lines.slice(1).map((l, i) => {
  const p = l.split(",");
  const rec = p[iREC], m = rec.match(/^(sw\d+)([a-z])/);
  return { i, rec, deployment: m ? m[1] : rec, tag: m ? m[2] : "?", whale: p[iW],
           ts: Number(p[iTs]), dur: Number(p[iDur]), nClicks: Number(p[iN]),
           cls: lab.rhythms[i], orn: lab.ornaments[i] };
});
const residual = new Set(lab.validation.residualClasses);
const observable = (r) => !residual.has(r.cls) && r.dur > 0;
const tagCount = new Map();
for (const r of all) { const k = `${r.deployment}|${r.tag}`; tagCount.set(k, (tagCount.get(k) || 0) + 1); }
const keepTag = new Map();
for (const [k, n] of tagCount) {
  const [dep, tag] = k.split("|"); const cur = keepTag.get(dep);
  if (!cur || n > cur.n || (n === cur.n && tag < cur.tag)) keepTag.set(dep, { tag, n });
}
const rows = all.filter((r) => keepTag.get(r.deployment).tag === r.tag);

function frags(gap) {
  const bySpk = new Map();
  for (const r of rows) {
    const k = `${r.rec}|${r.whale}`;
    if (!bySpk.has(k)) bySpk.set(k, []);
    bySpk.get(k).push(r);
  }
  const out = [];
  for (const [, rs] of bySpk) {
    rs.sort((a, b) => a.ts - b.ts || a.i - b.i);
    const runs = [];
    let cur = [rs[0]];
    for (let j = 1; j < rs.length; j++) {
      if (rs[j].ts - (rs[j - 1].ts + rs[j - 1].dur) > gap) { runs.push(cur); cur = [rs[j]]; }
      else cur.push(rs[j]);
    }
    runs.push(cur);
    for (const run of runs) {
      let f = [];
      for (const r of run) {
        if (observable(r)) f.push(r);
        else { if (f.length >= 3) out.push(f); f = []; }
      }
      if (f.length >= 3) out.push(f);
    }
  }
  return out;
}
const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;
function rOf(series) {
  let num = 0, den = 0;
  for (const ds of series) {
    const m = mean(ds);
    for (let j = 0; j < ds.length - 1; j++) num += (ds[j] - m) * (ds[j + 1] - m);
    for (const d of ds) den += (d - m) ** 2;
  }
  return den > 0 ? num / den : NaN;
}
const shuf = (a, rng) => { for (let i = a.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
function drawXclass(fs, rng) {
  return fs.map((fr) => {
    const ds = fr.map((r) => r.dur), byCls = new Map();
    fr.forEach((r, j) => { if (!byCls.has(r.cls)) byCls.set(r.cls, []); byCls.get(r.cls).push(j); });
    const out = new Array(fr.length);
    for (const idx of byCls.values()) {
      const vals = shuf(idx.map((j) => ds[j]), rng);
      idx.forEach((j, k) => { out[j] = vals[k]; });
    }
    return out;
  });
}
function testXclass(fs, seed = 909, iters = 2000) {
  const obs = rOf(fs.map((fr) => fr.map((r) => r.dur)));
  const rng = makeRng(seed), dist = [];
  for (let i = 0; i < iters; i++) dist.push(rOf(drawXclass(fs, rng)));
  const m = mean(dist), s = Math.sqrt(mean(dist.map((v) => (v - m) ** 2)));
  const p = (dist.filter((v) => v >= obs).length + 1) / (dist.length + 1);
  return { obs, nullMean: m, z: (obs - m) / s, p };
}

for (const gap of [3, 10]) {
  const fs = frags(gap);
  console.log(`\n=== GAP ${gap}s   ${fs.length} fragments ===`);

  // 1. per-fragment sign: fraction of fragments (len>=4) with positive own r
  const own = fs.filter((f) => f.length >= 4)
    .map((f) => ({ len: f.length, r: rOf([f.map((x) => x.dur)]) }))
    .filter((x) => Number.isFinite(x.r));
  const pos = own.filter((x) => x.r > 0).length;
  console.log(`  per-fragment r>0: ${pos}/${own.length} = ${(100 * pos / own.length).toFixed(1)}%` +
              ` (small-sample bias makes chance <50%)`);

  // 2. class-2-only single-class fragments
  const c2 = fs.filter((f) => f.every((r) => r.cls === 2));
  const t2 = testXclass(c2);
  console.log(`  class-2-only fragments: ${c2.length}   r=${t2.obs.toFixed(4)} ` +
              `null=${t2.nullMean.toFixed(4)} z=${t2.z.toFixed(1)} p=${t2.p.toFixed(4)}`);

  // 3. non-class-2 single-class fragments (does it generalize beyond the majority class?)
  const nc2 = fs.filter((f) => new Set(f.map((r) => r.cls)).size === 1 && f[0].cls !== 2);
  if (nc2.length >= 10) {
    const tn = testXclass(nc2);
    console.log(`  other single-class fragments: ${nc2.length}   r=${tn.obs.toFixed(4)} ` +
                `null=${tn.nullMean.toFixed(4)} z=${tn.z.toFixed(1)} p=${tn.p.toFixed(4)}`);
  } else console.log(`  other single-class fragments: only ${nc2.length}, skipped`);

  // 4. leave-one-recording-out: worst-case z
  const recs = [...new Set(fs.map((f) => f[0].rec))];
  let worst = null;
  for (const rec of recs) {
    const sub = fs.filter((f) => f[0].rec !== rec);
    const t = testXclass(sub, 909, 500);
    if (!worst || t.z < worst.z) worst = { rec, ...t };
  }
  console.log(`  leave-one-recording-out worst z: ${worst.z.toFixed(1)} ` +
              `(dropping ${worst.rec}; p=${worst.p.toFixed(4)}, ${recs.length} recordings)`);

  // 5. duration CV within class 2, for scale
  const d2 = fs.flat().filter((r) => r.cls === 2).map((r) => r.dur);
  const m2 = mean(d2), s2 = Math.sqrt(mean(d2.map((v) => (v - m2) ** 2)));
  console.log(`  class-2 duration: mean ${m2.toFixed(3)}s  sd ${s2.toFixed(3)}s  cv ${(s2 / m2).toFixed(3)}`);
}
