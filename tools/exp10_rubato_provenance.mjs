// exp10_rubato_provenance.mjs — does rubato carry state signatures beyond the exchange?
//
//     node tools/exp10_rubato_provenance.mjs [--gates-only]
//
// Implements experiments/10-rubato-provenance/README.md exactly. STATUS: the
// registration FROZE 2026-08-07 (five adversarial review rounds, clean round
// at round 5). This implementation was then independently verified against
// the frozen text (six clause-domains, 170 clauses, fixture-based); the 14
// confirmed defects were repaired before any statistic ran — see the dated
// note in the README's Reproducing section. This file
// implements the pinned design and adds nothing. Order of operations is
// registered and enforced here: gates -> feasibility echo -> NEGATIVE
// CONTROLS -> PLACEBO BATTERY -> only then the real statistics. A statistic
// whose battery fails at any arm is NOT TESTED in toto and its real value is
// neither computed nor printed. There is no gate-bypass branch: the registered
// "no other branch" clause is implemented literally.
//
// Implementation pins the registration leaves to the tool (registered in the
// README's "Implementation pins (registered pre-freeze)" section; the values
// below must match that section verbatim):
//   P1. Pooled partial correlation: the three pooled per-fragment-centered
//       correlations r_xy, r_xz, r_yz are computed over the same aligned
//       triplets, then combined as (r_xy - r_xz r_yz)/sqrt((1-r_xz^2)(1-r_yz^2)).
//   P2. T3 pair orientation: double entry — each unordered pair contributes
//       (res_a, res_b) and (res_b, res_a) — so the correlation is symmetric
//       and no per-recording whale ordering is privileged. Identical inside
//       every null draw.
//   P3. T3 rotates/jitters the lexicographically LARGER whale index (exp08
//       rotated ws[1]); ties in nearest-neighbour distance break toward the
//       earlier-onset coda (registered), and equal-onset ties toward lower
//       row index.
//   P4. Placebo-world marginals: synthetic IOIs / silences are resampled
//       i.i.d. from the fragment's own observed values; synthetic res is
//       Gaussian AR(1) at the arm's pinned phi with the fragment's (or run's)
//       observed res sd. T3-P couples each whale's res to its own preceding
//       silence at standardized beta = 0.3 on the whale's REAL onsets, with
//       own-whale AR(1) smoothness at the mid-arm pin phi = 0.405.
//   P5. Sensitivity: one-sided statistics report the null 95th percentile;
//       T1 (two-sided) reports null 2.5th and 97.5th percentiles.
//
// Deterministic given SEED. Every rng is seeded from SEED plus a fixed,
// documented offset; nothing depends on execution order.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makeRng } from "../explorer/js/random.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSV = join(HERE, "..", "data", "sperm-whale-dialogues.csv");
const LABELS = join(HERE, "..", "data", "sharma_labels", "labels.json");
const ART = join(HERE, "..", "experiments", "10-rubato-provenance", "artifacts");

// --- registered constants ---------------------------------------------------
const SEED = 1010;
const ITERATIONS = 2000;
const ALPHA = 0.05;
const MASS_FLOOR = 33.3;
const GAPS = [3, 5, 10, 15, 30];
const WINDOWS = [5, 10, 30];
const PRIMARY_W = 5;
const JITTERS = [2, 5];
const NC_REPEATS = 40, NC_ITER = 1000, NC_THRESHOLD = 0.15;
const PHI = { 3: 0.106, 5: 0.265, 10: 0.405, 15: 0.483, 30: 0.522 }; // exp09 S2, pinned per arm
const T3P_BETA = 0.3; // P4
const MIN_FRAG = 4, MIN_RUN_T2 = 2, MIN_UNIT_RUNS = 3;

const fmt = (v, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : "   n/a");
const rule = (c = "=") => console.log(c.repeat(78));
const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;
const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((v) => (v - m) ** 2))); };
const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)))];
};
const shuffleInPlace = (a, rng) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
};
const pick = (xs, rng) => xs[(rng() * xs.length) | 0];
// +1-smoothed p from a null distribution (shift convention for two-sided)
const pvals = (obs, dist) => {
  const ge = dist.filter((v) => v >= obs).length, le = dist.filter((v) => v <= obs).length;
  const pG = (ge + 1) / (dist.length + 1), pL = (le + 1) / (dist.length + 1);
  return { pG, pL, p2: Math.min(1, 2 * Math.min(pG, pL)) };
};

for (const f of [CSV, LABELS]) if (!existsSync(f)) {
  console.error(`missing ${f} — run the fetch tools first`); process.exit(1);
}

// --- load + gates G0/G1/G2 (exp09's, asserted to exp09's numbers) -----------
const lines = readFileSync(CSV, "utf8").trim().split(/\r?\n/);
const head = lines[0].replace(/^﻿/, "").split(",").map((s) => s.trim());
const iREC = head.indexOf("REC"), iN = head.indexOf("nClicks");
const iDur = head.indexOf("Duration"), iW = head.indexOf("Whale"), iTs = head.indexOf("TsTo");
const lab = JSON.parse(readFileSync(LABELS, "utf8"));
const all = lines.slice(1).map((l, i) => {
  const p = l.split(",");
  const rec = p[iREC], m = rec.match(/^(sw\d+)([a-z])/);
  return { i, rec, deployment: m ? m[1] : rec, tag: m ? m[2] : "?", whale: p[iW],
           ts: Number(p[iTs]), dur: Number(p[iDur]), nClicks: Number(p[iN]),
           cls: lab.rhythms[i] };
});
const K = lab.classClickCounts.length;
const clsMatch = Array.from({ length: K }, () => [0, 0]);
for (const r of all) { clsMatch[r.cls][1]++; if (r.nClicks === lab.classClickCounts[r.cls]) clsMatch[r.cls][0]++; }
const residual = new Set();
clsMatch.forEach(([m, t], k) => { if (t > 0 && m / t < 0.5) residual.add(k); });
const agree = all.filter((r) => r.nClicks === lab.classClickCounts[r.cls]).length;
const mismOutside = all.filter((r) => !residual.has(r.cls) && r.nClicks !== lab.classClickCounts[r.cls]).length;
const zeroDur = all.filter((r) => r.dur === 0);
const observable = (r) => !residual.has(r.cls) && r.dur > 0;

const tagCount = new Map();
for (const r of all) { const k = `${r.deployment}|${r.tag}`; tagCount.set(k, (tagCount.get(k) || 0) + 1); }
const keepTag = new Map();
for (const [k, n] of tagCount) {
  const [dep, tag] = k.split("|"); const cur = keepTag.get(dep);
  if (!cur || n > cur.n || (n === cur.n && tag < cur.tag)) keepTag.set(dep, { tag, n });
}
const rows = all.filter((r) => keepTag.get(r.deployment).tag === r.tag);

rule();
console.log("EXPERIMENT 10 — does rubato carry state signatures beyond the exchange?");
rule();
const gateFail = (msg) => { console.error("  GATE FAIL: " + msg); process.exit(1); };
if (!(agree / all.length >= 0.95 && mismOutside === 0)) gateFail("G1");
if (![...residual].every((c) => c === 17) || residual.size !== 1) gateFail("G1 residual rule");
if (!zeroDur.every((r) => r.nClicks === 1 && residual.has(r.cls)) || zeroDur.length !== 8) gateFail("G2");
if (rows.length !== 3083) gateFail(`G0 kept ${rows.length}, expected 3083`);
console.log(`  G0/G1/G2: PASS  (kept ${rows.length}/3840; agreement ${fmt(100 * agree / all.length, 2)}%; residual {17}; ${zeroDur.length} zero-dur)`);

// --- G3: residual cells ------------------------------------------------------
const cellRows = new Map(); // rec|whale|cls -> rows
for (const r of rows) if (observable(r)) {
  const k = `${r.rec}|${r.whale}|${r.cls}`;
  if (!cellRows.has(k)) cellRows.set(k, []);
  cellRows.get(k).push(r);
}
const cellMean = new Map();
for (const [k, rs] of cellRows) cellMean.set(k, mean(rs.map((r) => r.dur)));
const cellSize = (r) => (cellRows.get(`${r.rec}|${r.whale}|${r.cls}`) || []).length;
const eligible = (r) => observable(r) && cellSize(r) >= 2;
const res = (r) => r.dur - cellMean.get(`${r.rec}|${r.whale}|${r.cls}`);
const nObs = rows.filter(observable).length, nElig = rows.filter(eligible).length;
if (nObs !== 2958 || nElig !== 2766) gateFail(`G3 universe ${nObs}/${nElig}, expected 2958/2766`);
const cellSizes = [...cellRows.values()].map((rs) => rs.length);
console.log(`  G3: ${nObs} observable, ${nObs - nElig} in size-1 cells, ${nElig} eligible; ` +
            `cell sizes n=${cellSizes.length} median ${quantile(cellSizes, 0.5)} max ${Math.max(...cellSizes)}`);
console.log();

// --- run construction (exp09 decisions 1-2; G3-excluded codas break stretches)
function runsOf(gap) {
  const bySpk = new Map();
  for (const r of rows) {
    const k = `${r.rec}|${r.whale}`;
    if (!bySpk.has(k)) bySpk.set(k, []);
    bySpk.get(k).push(r);
  }
  const out = [];
  for (const [key, rs] of bySpk) {
    rs.sort((a, b) => a.ts - b.ts || a.i - b.i);
    let cur = [rs[0]];
    for (let j = 1; j < rs.length; j++) {
      if (rs[j].ts - (rs[j - 1].ts + rs[j - 1].dur) > gap) { out.push({ key, run: cur }); cur = [rs[j]]; }
      else cur.push(rs[j]);
    }
    out.push({ key, run: cur });
  }
  return out;
}

// --- T1 scaffolds ------------------------------------------------------------
// A fragment: maximal stretch of consecutive G3-eligible codas within a run
// (any non-eligible coda breaks it), >= MIN_FRAG eligible codas. Stored with
// aligned vectors over i = 2..L: x = res_i, z = res_{i-1}, y = preceding
// silence, ioi = preceding inter-onset interval.
function t1Fragments(gap) {
  const frags = [];
  for (const { run } of runsOf(gap)) {
    let f = [];
    const flush = () => {
      if (f.length >= MIN_FRAG) {
        const x = [], z = [], y = [], ioi = [];
        for (let j = 1; j < f.length; j++) {
          x.push(res(f[j])); z.push(res(f[j - 1]));
          y.push(f[j].ts - (f[j - 1].ts + f[j - 1].dur));
          ioi.push(f[j].ts - f[j - 1].ts);
        }
        frags.push({ x, z, y, ioi, rec: f[0].rec });
      }
      f = [];
    };
    for (const r of run) { if (eligible(r)) f.push(r); else flush(); }
    flush();
  }
  return frags;
}
// Pooled per-fragment-centered correlation of two per-fragment vector lists.
function pooledCorr(As, Bs) {
  let num = 0, dA = 0, dB = 0;
  for (let f = 0; f < As.length; f++) {
    const a = As[f], b = Bs[f], ma = mean(a), mb = mean(b);
    for (let j = 0; j < a.length; j++) {
      num += (a[j] - ma) * (b[j] - mb);
      dA += (a[j] - ma) ** 2; dB += (b[j] - mb) ** 2;
    }
  }
  return num / Math.sqrt(dA * dB);
}
// P1: pooled partial correlation of x with y controlling z. rxz is constant
// across null draws (only y rotates), so callers may precompute and pass it.
function pooledPartial(xs, ys, zs, rxzPre) {
  const rxy = pooledCorr(xs, ys);
  const rxz = rxzPre !== undefined ? rxzPre : pooledCorr(xs, zs);
  const ryz = pooledCorr(ys, zs);
  return (rxy - rxz * ryz) / Math.sqrt((1 - rxz ** 2) * (1 - ryz ** 2));
}
// Pinned null draw: rotate each fragment's y by k in {0..L-2} (identity
// included), triplets (x, z) intact.
function t1NullDraw(frags, rng, field = "y") {
  return frags.map((fr) => {
    const y = fr[field], n = y.length;
    const k = (rng() * n) | 0;                  // 0..n-1 == 0..L-2, identity included
    const rot = new Array(n);
    for (let j = 0; j < n; j++) rot[j] = y[(j + k) % n];
    return rot;
  });
}
function t1Test(frags, seed, iterations = ITERATIONS) {
  const xs = frags.map((f) => f.x), zs = frags.map((f) => f.z), ys = frags.map((f) => f.y);
  const rxz = pooledCorr(xs, zs);
  const observed = pooledPartial(xs, ys, zs, rxz);
  const rng = makeRng(seed);
  const dist = [];
  for (let it = 0; it < iterations; it++) dist.push(pooledPartial(xs, t1NullDraw(frags, rng), zs, rxz));
  const { pG, pL, p2 } = pvals(observed, dist);
  return { observed, nullMean: mean(dist), nullSd: sd(dist),
           z: (observed - mean(dist)) / sd(dist), p: p2, pG, pL,
           q025: quantile(dist, 0.025), q975: quantile(dist, 0.975),
           rawSilence: pooledCorr(xs, ys),
           rawIOI: frags.every((f) => f.ioi) ? pooledCorr(xs, frags.map((f) => f.ioi)) : NaN };
}
const t1Mass = (frags) => frags.reduce((s, f) => s + f.x.length, 0);

// --- T2 scaffolds ------------------------------------------------------------
// Run-collapse: element = mean res over the G3-eligible codas of one run
// (>= MIN_RUN_T2 eligible), unit = rec x whale with >= MIN_UNIT_RUNS runs.
function t2Units(gap) {
  const byUnit = new Map();
  for (const { key, run } of runsOf(gap)) {
    const el = run.filter(eligible);
    if (el.length < MIN_RUN_T2) continue;
    if (!byUnit.has(key)) byUnit.set(key, []);
    const rv = el.map(res);
    byUnit.get(key).push({
      m: mean(rv), n: el.length, sdRes: sd(rv),
      start: run[0].ts, end: run[run.length - 1].ts + run[run.length - 1].dur,
      rec: run[0].rec, deployment: run[0].deployment, whale: run[0].whale,
    });
  }
  const units = [];
  for (const [key, runsArr] of byUnit) {
    if (runsArr.length < MIN_UNIT_RUNS) continue;
    runsArr.sort((a, b) => a.start - b.start);
    units.push({ key, runs: runsArr, deployment: runsArr[0].deployment });
  }
  return units;
}
function pooledLag1(seriesList) {
  let num = 0, den = 0;
  for (const s of seriesList) {
    const m = mean(s);
    for (let j = 0; j < s.length - 1; j++) num += (s[j] - m) * (s[j + 1] - m);
    for (const v of s) den += (v - m) ** 2;
  }
  return den > 0 ? num / den : NaN;
}
function t2Test(units, seed, iterations = ITERATIONS) {
  const series = units.map((u) => u.runs.map((r) => r.m));
  const observed = pooledLag1(series);
  const rng = makeRng(seed);
  const dist = [];
  const work = series.map((s) => s.slice());
  for (let it = 0; it < iterations; it++) {
    for (const s of work) shuffleInPlace(s, rng);
    dist.push(pooledLag1(work));
  }
  const { pG } = pvals(observed, dist);
  return { observed, nullMean: mean(dist), nullSd: sd(dist),
           z: (observed - mean(dist)) / sd(dist), p: pG, q95: quantile(dist, 0.95) };
}
const t2Mass = (units) => units.reduce((s, u) => s + u.runs.length - 1, 0);

// --- T3 scaffolds ------------------------------------------------------------
// Two-speaker basis: exactly two whale indices post-G0, both with >= 1
// eligible coda; arm W needs span >= 2W. P3 pins who moves under the nulls.
function t3Recordings() {
  const byRec = new Map();
  for (const r of rows) {
    if (!byRec.has(r.rec)) byRec.set(r.rec, []);
    byRec.get(r.rec).push(r);
  }
  const out = [];
  for (const [rec, rs] of byRec) {
    const whales = [...new Set(rs.map((r) => r.whale))].sort();
    if (whales.length !== 2) continue;
    const A = rs.filter((r) => r.whale === whales[0] && eligible(r)).sort((a, b) => a.ts - b.ts || a.i - b.i);
    const B = rs.filter((r) => r.whale === whales[1] && eligible(r)).sort((a, b) => a.ts - b.ts || a.i - b.i);
    if (!A.length || !B.length) continue;
    const span = Math.max(...rs.map((r) => r.ts + r.dur)) - Math.min(...rs.map((r) => r.ts));
    const lo = Math.min(...rs.map((r) => r.ts));
    // preceding same-whale silence (any post-G0 coda), for the diagnostic
    const bySpk = new Map();
    for (const r of rs) {
      if (!bySpk.has(r.whale)) bySpk.set(r.whale, []);
      bySpk.get(r.whale).push(r);
    }
    const prevSil = new Map();
    for (const [, ss] of bySpk) {
      ss.sort((a, b) => a.ts - b.ts || a.i - b.i);
      for (let j = 1; j < ss.length; j++) prevSil.set(ss[j].i, ss[j].ts - (ss[j - 1].ts + ss[j - 1].dur));
    }
    out.push({ rec, deployment: rs[0].deployment, A, B, span, lo, prevSil });
  }
  return out;
}
// Pairing on explicit coordinate arrays (so null draws can move B): P3 ties.
function derivePairs(A, tsA, B, tsB, W) {
  const seen = new Map(); // "ia|ib" -> [ia, ib]
  const scan = (P, tsP, Q, tsQ, flip) => {
    for (let p = 0; p < P.length; p++) {
      let best = -1, bestD = Infinity;
      for (let q = 0; q < Q.length; q++) {
        const d = Math.abs(tsP[p] - tsQ[q]);
        if (d < bestD - 1e-12 ||
            (Math.abs(d - bestD) <= 1e-12 && best >= 0 &&
             (tsQ[q] < tsQ[best] || (tsQ[q] === tsQ[best] && Q[q].i < Q[best].i)))) {
          bestD = d; best = q;
        }
      }
      if (best >= 0 && bestD <= W) {
        const ia = flip ? best : p, ib = flip ? p : best;
        seen.set(`${ia}|${ib}`, [ia, ib]);
      }
    }
  };
  scan(A, tsA, B, tsB, false);
  scan(B, tsB, A, tsA, true);
  return [...seen.values()];
}
// P2: double-entry Pearson correlation over pairs of (a, b) value arrays.
function pairCorr(vals) {
  if (vals.length < 2) return NaN;
  const xs = [], ys = [];
  for (const [a, b] of vals) { xs.push(a); ys.push(b); xs.push(b); ys.push(a); }
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let j = 0; j < xs.length; j++) {
    num += (xs[j] - mx) * (ys[j] - my);
    dx += (xs[j] - mx) ** 2; dy += (ys[j] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}
const overlapPair = (a, b) => a.ts < b.ts + b.dur && b.ts < a.ts + a.dur;
// One full T3 statistic evaluation on possibly-moved B coordinates.
function t3Statistic(recs, W, moveB = null, stratum = "all") {
  const vals = [], ids = [];
  for (const rc of recs) {
    const tsA = rc.A.map((r) => r.ts);
    const tsB = moveB ? moveB(rc) : rc.B.map((r) => r.ts);
    for (const [ia, ib] of derivePairs(rc.A, tsA, rc.B, tsB, W)) {
      const a = rc.A[ia], b = rc.B[ib];
      if (stratum === "nonoverlap") {
        // stratum membership follows the coordinates in force for this draw
        const bMoved = { ts: tsB[ib], dur: b.dur };
        if (overlapPair(a, bMoved)) continue;
      }
      vals.push([res(a), res(b)]);
      ids.push(`${a.i}|${b.i}`);
    }
  }
  return { r: pairCorr(vals), n: vals.length, ids };
}
function t3Null(recs, W, seed, mode, J, stratum, iterations = ITERATIONS) {
  const rng = makeRng(seed);
  const obsIds = new Set(t3Statistic(recs, W, null, stratum).ids);
  const dist = [], ns = [], rets = [];
  for (let it = 0; it < iterations; it++) {
    const moveB = mode === "rotate"
      ? (rc) => { const d = rng() * rc.span; return rc.B.map((r) => rc.lo + ((r.ts - rc.lo + d) % rc.span)); }
      : (rc) => rc.B.map((r) => r.ts + (rng() * 2 - 1) * J);
    const { r, n, ids } = t3Statistic(recs, W, moveB, stratum);
    if (Number.isFinite(r)) {
      dist.push(r); ns.push(n);
      // pair-identity retention: fraction of observed pairs re-derived identically
      rets.push(obsIds.size ? ids.filter((id) => obsIds.has(id)).length / obsIds.size : NaN);
    }
  }
  return { dist, meanN: mean(ns), retention: mean(rets.filter(Number.isFinite)) };
}
function t3Test(recs, W, seed, stratum = "all", iterations = ITERATIONS) {
  const { r: observed, n } = t3Statistic(recs, W, null, stratum);
  const out = { observed, n };
  const rot = t3Null(recs, W, seed, "rotate", 0, stratum, iterations);
  const rotP = pvals(observed, rot.dist);
  out.rotation = { nullMean: mean(rot.dist), z: (observed - mean(rot.dist)) / sd(rot.dist),
                   p: rotP.pG, pLess: rotP.pL, meanN: rot.meanN, retention: rot.retention,
                   q95: quantile(rot.dist, 0.95) };
  out.jitter = {};
  for (const J of JITTERS) {
    const jd = t3Null(recs, W, seed + J, "jitter", J, stratum, iterations);
    const jP = pvals(observed, jd.dist);
    out.jitter[J] = { nullMean: mean(jd.dist), z: (observed - mean(jd.dist)) / sd(jd.dist),
                      p: jP.pG, pLess: jP.pL, meanN: jd.meanN, retention: jd.retention,
                      q95: quantile(jd.dist, 0.95) };
  }
  out.fires = out.rotation.p < ALPHA && JITTERS.every((J) => out.jitter[J].p < ALPHA);
  return out;
}

// Registered diagnostic (not survival-bearing): partial correlation of the
// pair residuals controlling each whale's OWN preceding silence — removes the
// T1 channel from T3. Double-entry (P2); pairs where either side has no
// same-whale predecessor are dropped from the diagnostic only.
function t3PartialDiag(recs, W) {
  const rows2 = [];
  for (const rc of recs) {
    const tsA = rc.A.map((r) => r.ts), tsB = rc.B.map((r) => r.ts);
    for (const [ia, ib] of derivePairs(rc.A, tsA, rc.B, tsB, W)) {
      const a = rc.A[ia], b = rc.B[ib];
      const sa = rc.prevSil.get(a.i), sb = rc.prevSil.get(b.i);
      if (Number.isFinite(sa) && Number.isFinite(sb)) rows2.push([res(a), sa, res(b), sb]);
    }
  }
  if (rows2.length < 4) return { r: NaN, n: rows2.length };
  const x = [], sx = [], y = [], sy = [];
  for (const [ra, sa, rb, sb] of rows2) {
    x.push(ra); sx.push(sa); y.push(rb); sy.push(sb);
    x.push(rb); sx.push(sb); y.push(ra); sy.push(sa);
  }
  const beta = (v, sv) => {
    const mv = mean(v), ms = mean(sv);
    let num = 0, den = 0;
    for (let j = 0; j < v.length; j++) { num += (v[j] - mv) * (sv[j] - ms); den += (sv[j] - ms) ** 2; }
    return den > 0 ? num / den : 0;
  };
  const bX = beta(x, sx), bY = beta(y, sy);
  const ex = x.map((v, j) => v - bX * sx[j]), ey = y.map((v, j) => v - bY * sy[j]);
  const mx = mean(ex), my = mean(ey);
  let num = 0, dx = 0, dy = 0;
  for (let j = 0; j < ex.length; j++) { num += (ex[j] - mx) * (ey[j] - my); dx += (ex[j] - mx) ** 2; dy += (ey[j] - my) ** 2; }
  return { r: num / Math.sqrt(dx * dy), n: rows2.length };
}

// --- AR(1) generator for placebo worlds (P4) ---------------------------------
function ar1(n, phi, sigma, rng) {
  const gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const out = new Array(n);
  out[0] = gauss() * sigma;
  const innov = sigma * Math.sqrt(1 - phi * phi);
  for (let j = 1; j < n; j++) out[j] = phi * out[j - 1] + gauss() * innov;
  return out;
}

// --- feasibility echo (counts only) — must reproduce the registered table ---
// Masses are stored: the mass floor is one of the three registered NOT TESTED
// channels (floor, negative-control failure, battery failure).
const armMass = { t1: {}, t2: {}, t3: {} };
{
  console.log("feasibility echo (must match the registered table exactly):");
  console.log(`  T1: ` + GAPS.map((g) => { const f = t1Fragments(g); armMass.t1[g] = t1Mass(f); return `${g}s ${armMass.t1[g]}p/${f.length}f`; }).join("  "));
  console.log(`  T2: ` + GAPS.map((g) => { const u = t2Units(g); armMass.t2[g] = t2Mass(u); return `${g}s ${armMass.t2[g]}p/${u.length}u`; }).join("  "));
  const t3r = t3Recordings();
  console.log(`  T3: ` + WINDOWS.map((W) => {
    const recs = t3r.filter((rc) => rc.span >= 2 * W);
    let n = 0;
    for (const rc of recs) n += derivePairs(rc.A, rc.A.map((r) => r.ts), rc.B, rc.B.map((r) => r.ts), W).length;
    armMass.t3[W] = n;
    return `${W}s ${n}p/${recs.length}r`;
  }).join("  "));
  console.log();
  if (process.argv.includes("--gates-only")) {
    console.log("--gates-only: stopping before any statistic.");
    process.exit(0);
  }
}

// ============================================================================
// STAGE 1 — negative controls (machinery checks; own-null draws)
// ============================================================================
console.log("STAGE 1 — negative controls (draw from own null, run full test; 40x)");
const negativeControls = { t1: {}, t2: {}, t3: {} };
for (const gap of GAPS) {
  const frags = t1Fragments(gap);
  let fired = 0;
  for (let k = 0; k < NC_REPEATS; k++) {
    const rng = makeRng(SEED + 11000 + GAPS.indexOf(gap) * 100 + k);
    const placebo = frags.map((f, fi) => ({ ...f, y: t1NullDraw([frags[fi]], rng)[0] }));
    if (t1Test(placebo, SEED + 12000 + GAPS.indexOf(gap) * 100 + k, NC_ITER).p < ALPHA) fired++;
  }
  negativeControls.t1[gap] = { fired, ran: NC_REPEATS };
  const units = t2Units(gap);
  let fired2 = 0;
  for (let k = 0; k < NC_REPEATS; k++) {
    const rng = makeRng(SEED + 13000 + GAPS.indexOf(gap) * 100 + k);
    const placebo = units.map((u) => ({ ...u, runs: shuffleInPlace(u.runs.slice(), rng) }));
    if (t2Test(placebo, SEED + 14000 + GAPS.indexOf(gap) * 100 + k, NC_ITER).p < ALPHA) fired2++;
  }
  negativeControls.t2[gap] = { fired: fired2, ran: NC_REPEATS };
}
const t3All = t3Recordings();
for (const W of WINDOWS) {
  const recs = t3All.filter((rc) => rc.span >= 2 * W);
  let fired = 0;
  for (let k = 0; k < NC_REPEATS; k++) {
    const rng = makeRng(SEED + 15000 + WINDOWS.indexOf(W) * 100 + k);
    // draw once from the rotation null, then run the full conjunction on it
    const shifted = recs.map((rc) => {
      const d = rng() * rc.span;
      const tsB = rc.B.map((r) => rc.lo + ((r.ts - rc.lo + d) % rc.span));
      return { ...rc, B: rc.B.map((r, j) => ({ ...r, ts: tsB[j] })) };
    });
    if (t3Test(shifted, W, SEED + 16000 + WINDOWS.indexOf(W) * 100 + k, "all", NC_ITER).fires) fired++;
  }
  negativeControls.t3[W] = { fired, ran: NC_REPEATS };
}
const ncFail = [];
for (const gap of GAPS) {
  if (negativeControls.t1[gap].fired / NC_REPEATS > NC_THRESHOLD) ncFail.push(`T1@${gap}`);
  if (negativeControls.t2[gap].fired / NC_REPEATS > NC_THRESHOLD) ncFail.push(`T2@${gap}`);
}
for (const W of WINDOWS) if (negativeControls.t3[W].fired / NC_REPEATS > NC_THRESHOLD) ncFail.push(`T3@${W}`);
console.log(`  T1: ${GAPS.map((g) => `${g}s ${negativeControls.t1[g].fired}/40`).join("  ")}`);
console.log(`  T2: ${GAPS.map((g) => `${g}s ${negativeControls.t2[g].fired}/40`).join("  ")}`);
console.log(`  T3: ${WINDOWS.map((W) => `${W}s ${negativeControls.t3[W].fired}/40`).join("  ")}   [nominal 2/40, threshold 6/40]`);
console.log(`  ${ncFail.length ? "FAIL at: " + ncFail.join(", ") : "all pass"}`);
console.log();

// ============================================================================
// STAGE 2 — synthetic-H0 placebo battery (exchangeability checks)
// ============================================================================
console.log("STAGE 2 — placebo battery (synthetic H0 worlds through the full pipeline; 40x per arm)");
const battery = { t1: {}, t1p: {}, t2: {}, t3: {} };

for (const gap of GAPS) {
  const frags = t1Fragments(gap);
  const scaffolds = frags.map((f) => ({
    n: f.x.length,
    sdRes: Math.max(sd([...f.x, f.z[0]]), 1e-6),
    ioiPool: f.ioi.slice(), silPool: f.y.slice(),
  }));
  // T1-P (onset-clocked): i.i.d. IOIs resampled, AR(1) res at pinned phi,
  // y_i = IOI_i - dur_{i-1}; centering absorbs the cell-mean constant.
  let firedP = 0, firedPp = 0;
  for (let k = 0; k < NC_REPEATS; k++) {
    const rng = makeRng(SEED + 21000 + GAPS.indexOf(gap) * 100 + k);
    const worldP = scaffolds.map((s) => {
      const r = ar1(s.n + 1, PHI[gap], s.sdRes, rng);
      const x = [], z = [], y = [];
      for (let j = 0; j < s.n; j++) {
        x.push(r[j + 1]); z.push(r[j]);
        y.push(pick(s.ioiPool, rng) - r[j]);
      }
      return { x, z, y };
    });
    if (t1Test(worldP, SEED + 22000 + GAPS.indexOf(gap) * 100 + k, NC_ITER).p < ALPHA) firedP++;
    // T1-P' (silence-clocked): i.i.d. silences resampled, AR(1) res.
    const rng2 = makeRng(SEED + 23000 + GAPS.indexOf(gap) * 100 + k);
    const worldPp = scaffolds.map((s) => {
      const r = ar1(s.n + 1, PHI[gap], s.sdRes, rng2);
      const x = [], z = [], y = [];
      for (let j = 0; j < s.n; j++) {
        x.push(r[j + 1]); z.push(r[j]);
        y.push(pick(s.silPool, rng2));
      }
      return { x, z, y };
    });
    if (t1Test(worldPp, SEED + 24000 + GAPS.indexOf(gap) * 100 + k, NC_ITER).p < ALPHA) firedPp++;
  }
  battery.t1[gap] = { fired: firedP, ran: NC_REPEATS };
  battery.t1p[gap] = { fired: firedPp, ran: NC_REPEATS };

  // T2-P: coda-level AR(1) on the real (run-size, order) scaffolds at pinned
  // phi, collapsed to run means through the registered pipeline.
  const units = t2Units(gap);
  let fired2 = 0;
  for (let k = 0; k < NC_REPEATS; k++) {
    const rng = makeRng(SEED + 25000 + GAPS.indexOf(gap) * 100 + k);
    const world = units.map((u) => ({
      ...u,
      runs: u.runs.map((run) => {
        // coda-level AR(1) at the run's own observed res sd, collapsed to a mean
        const sig = Math.max(run.sdRes, 1e-4);
        return { ...run, m: mean(ar1(run.n, PHI[gap], sig, rng)) };
      }),
    }));
    if (t2Test(world, SEED + 26000 + GAPS.indexOf(gap) * 100 + k, NC_ITER).p < ALPHA) fired2++;
  }
  battery.t2[gap] = { fired: fired2, ran: NC_REPEATS };
}
// T3-P: real onsets (shared envelope), own-whale gap coupling at beta=0.3,
// zero cross-whale coupling; the full conjunction must certify at ~alpha.
for (const W of WINDOWS) {
  const recs = t3All.filter((rc) => rc.span >= 2 * W);
  let fired = 0;
  for (let k = 0; k < NC_REPEATS; k++) {
    const rng = makeRng(SEED + 27000 + WINDOWS.indexOf(W) * 100 + k);
    const world = recs.map((rc) => {
      const synth = (side) => {
        const sils = side.map((r) => rc.prevSil.get(r.i));
        const finite = sils.filter(Number.isFinite);
        const ms = finite.length ? mean(finite) : 0, ss = finite.length > 1 ? sd(finite) : 1;
        const sdR = Math.max(sd(side.map(res)), 1e-6);
        const noise = ar1(side.length, PHI[10], sdR, rng); // moderate own-whale smoothness
        return side.map((r, j) => {
          const zs = Number.isFinite(sils[j]) && ss > 0 ? (sils[j] - ms) / ss : 0;
          return { ...r, __synthRes: T3P_BETA * sdR * zs + Math.sqrt(1 - T3P_BETA ** 2) * noise[j] };
        });
      };
      return { ...rc, A: synth(rc.A), B: synth(rc.B) };
    });
    // swap res() for the synthetic values via a shadow map
    const synthRes = new Map();
    for (const rc of world) for (const r of [...rc.A, ...rc.B]) synthRes.set(r.i, r.__synthRes);
    const realRes = res;
    // temporarily evaluate with synthetic residuals
    const t3TestSynth = (recs2, W2, seed2) => {
      const evalStat = (moveB, stratum) => {
        const vals = [];
        for (const rc of recs2) {
          const tsA = rc.A.map((r) => r.ts);
          const tsB = moveB ? moveB(rc) : rc.B.map((r) => r.ts);
          for (const [ia, ib] of derivePairs(rc.A, tsA, rc.B, tsB, W2)) {
            vals.push([synthRes.get(rc.A[ia].i), synthRes.get(rc.B[ib].i)]);
          }
        }
        return pairCorr(vals);
      };
      const observed = evalStat(null, "all");
      const runNull = (mode, J, seed3) => {
        const rng2 = makeRng(seed3), dist = [];
        for (let it = 0; it < NC_ITER; it++) {
          const moveB = mode === "rotate"
            ? (rc) => { const d = rng2() * rc.span; return rc.B.map((r) => rc.lo + ((r.ts - rc.lo + d) % rc.span)); }
            : (rc) => rc.B.map((r) => r.ts + (rng2() * 2 - 1) * J);
          const v = evalStat(moveB, "all");
          if (Number.isFinite(v)) dist.push(v);
        }
        return pvals(observed, dist).pG;
      };
      return runNull("rotate", 0, seed2) < ALPHA &&
             JITTERS.every((J) => runNull("jitter", J, seed2 + J) < ALPHA);
    };
    if (t3TestSynth(world, W, SEED + 28000 + WINDOWS.indexOf(W) * 100 + k)) fired++;
  }
  battery.t3[W] = { fired, ran: NC_REPEATS };
}

const batteryFail = { t1: [], t2: [], t3: [] };
for (const gap of GAPS) {
  if (battery.t1[gap].fired / NC_REPEATS > NC_THRESHOLD ||
      battery.t1p[gap].fired / NC_REPEATS > NC_THRESHOLD) batteryFail.t1.push(gap);
  if (battery.t2[gap].fired / NC_REPEATS > NC_THRESHOLD) batteryFail.t2.push(gap);
}
for (const W of WINDOWS) if (battery.t3[W].fired / NC_REPEATS > NC_THRESHOLD) batteryFail.t3.push(W);
console.log(`  T1-P : ${GAPS.map((g) => `${g}s ${battery.t1[g].fired}/40`).join("  ")}`);
console.log(`  T1-P': ${GAPS.map((g) => `${g}s ${battery.t1p[g].fired}/40`).join("  ")}`);
console.log(`  T2-P : ${GAPS.map((g) => `${g}s ${battery.t2[g].fired}/40`).join("  ")}`);
console.log(`  T3-P : ${WINDOWS.map((W) => `${W}s ${battery.t3[W].fired}/40`).join("  ")}`);
// Per-arm NOT TESTED: mass floor or a failed negative control. Statistic-level
// NOT TESTED (registered propagation rule): a failed battery at ANY arm, or
// ALL arms NOT TESTED (T1/T2), or the PRIMARY arm NOT TESTED (T3).
const armNotTested = {
  t1: Object.fromEntries(GAPS.map((g) => [g, armMass.t1[g] < MASS_FLOOR || ncFail.includes(`T1@${g}`)])),
  t2: Object.fromEntries(GAPS.map((g) => [g, armMass.t2[g] < MASS_FLOOR || ncFail.includes(`T2@${g}`)])),
  t3: Object.fromEntries(WINDOWS.map((W) => [W, armMass.t3[W] < MASS_FLOOR || ncFail.includes(`T3@${W}`)])),
};
const notTested = {
  t1: batteryFail.t1.length > 0 || GAPS.every((g) => armNotTested.t1[g]),
  t2: batteryFail.t2.length > 0 || GAPS.every((g) => armNotTested.t2[g]),
  t3: batteryFail.t3.length > 0 || armNotTested.t3[PRIMARY_W],
};
const notTestedChannels = Object.fromEntries(["t1", "t2", "t3"].map((k) => [k, {
  battery: batteryFail[k], negativeControl: ncFail.filter((f) => f.toLowerCase().startsWith(k)),
  massFloor: Object.entries(armMass[k]).filter(([, m]) => m < MASS_FLOOR).map(([a]) => a),
}]));
for (const s of ["t1", "t2", "t3"]) {
  if (notTested[s]) console.log(`  ${s.toUpperCase()} battery FAIL at ${batteryFail[s].join(", ")} — ${s.toUpperCase()} is NOT TESTED in toto`);
}
if (!notTested.t1 && !notTested.t2 && !notTested.t3) console.log("  battery: all arms pass");
console.log();

// ============================================================================
// STAGE 3 — the real statistics (only for battery-passing statistics)
// ============================================================================
if (notTested.t1 || notTested.t2 || notTested.t3) {
  console.log("STAGE 3 — skipped for NOT TESTED statistics per the propagation rule.");
}

const results = { t1: {}, t2: {}, t3: {} };

if (!notTested.t1) {
  console.log("T1 — GAP COUPLING (pooled partial correlation, pinned rotation null, two-sided)");
  console.log(`  ${"gap".padEnd(6)}${"frags".padStart(6)}${"mass".padStart(7)}${"partial-r".padStart(11)}` +
              `${"null".padStart(9)}${"z".padStart(7)}${"p".padStart(9)}${"raw(sil)".padStart(10)}${"raw(IOI)".padStart(10)}`);
  for (const gap of GAPS) {
    if (armNotTested.t1[gap]) {
      const ch = ncFail.includes(`T1@${gap}`) ? "negative control" : "mass floor";
      results.t1[gap] = { mass: armMass.t1[gap], tested: false, notTestedChannel: ch };
      console.log(`  ${(gap + "s").padEnd(6)}${"—".padStart(6)}${String(armMass.t1[gap]).padStart(7)}` +
                  `   NOT TESTED (${ch}) — not computed, counts neither way`);
      continue;
    }
    const frags = t1Fragments(gap);
    const massv = t1Mass(frags);
    const t = t1Test(frags, SEED + 31000 + GAPS.indexOf(gap));
    results.t1[gap] = { fragments: frags.length, mass: massv, ...t,
                        tested: !armNotTested.t1[gap] };
    console.log(`  ${(gap + "s").padEnd(6)}${String(frags.length).padStart(6)}${String(massv).padStart(7)}` +
                `${fmt(t.observed).padStart(11)}${fmt(t.nullMean).padStart(9)}${fmt(t.z, 1).padStart(7)}` +
                `${fmt(t.p).padStart(8)}${t.p < ALPHA ? "*" : " "}${fmt(t.rawSilence).padStart(10)}${fmt(t.rawIOI).padStart(10)}`);
  }
  const tested = GAPS.filter((g) => results.t1[g].tested);
  const signs = tested.map((g) => Math.sign(results.t1[g].observed));
  results.t1.survives = tested.length > 0 &&
    tested.every((g) => results.t1[g].p < ALPHA) && new Set(signs).size === 1;
  console.log(`  T1 ${results.t1.survives ? "SURVIVES (sign-consistent, all tested arms)" : "does not survive"}`);
  console.log();
}

if (!notTested.t2) {
  console.log("T2 — BEYOND-GAP PERSISTENCE (run-collapse, within-unit permutation, one-sided high)");
  console.log(`  ${"gap".padEnd(6)}${"units".padStart(6)}${"mass".padStart(6)}${"lag1-r".padStart(9)}` +
              `${"null".padStart(9)}${"z".padStart(7)}${"p".padStart(9)}${"sw061%".padStart(8)}${"LODO-p".padStart(9)}`);
  for (const gap of GAPS) {
    if (armNotTested.t2[gap]) {
      const ch = ncFail.includes(`T2@${gap}`) ? "negative control" : "mass floor";
      results.t2[gap] = { mass: armMass.t2[gap], tested: false, notTestedChannel: ch };
      console.log(`  ${(gap + "s").padEnd(6)}${"—".padStart(6)}${String(armMass.t2[gap]).padStart(6)}` +
                  `   NOT TESTED (${ch}) — not computed, counts neither way`);
      continue;
    }
    const units = t2Units(gap);
    const massv = t2Mass(units);
    const t = t2Test(units, SEED + 32000 + GAPS.indexOf(gap));
    // registered reports: separations, own-codas-inside, scene composition, concentration, LODO
    const seps = [], own = [], scene = [];
    const byRecAll = new Map();
    for (const r of rows) { if (!byRecAll.has(r.rec)) byRecAll.set(r.rec, []); byRecAll.get(r.rec).push(r); }
    for (const u of units) for (let j = 1; j < u.runs.length; j++) {
      const a = u.runs[j - 1], b = u.runs[j];
      seps.push(b.start - a.end);
      const inSep = (byRecAll.get(a.rec) || []).filter((r) => r.ts > a.end && r.ts < b.start);
      own.push(inSep.some((r) => r.whale === a.whale) ? 1 : 0);
      scene.push(inSep.some((r) => r.whale !== a.whale) ? 1 : 0);
    }
    const depMass = new Map();
    for (const u of units) depMass.set(u.deployment, (depMass.get(u.deployment) || 0) + u.runs.length - 1);
    const sw061 = (depMass.get("sw061") || 0) / massv;
    let lodo = null; const lodoBelowFloor = [];
    for (const dep of depMass.keys()) {
      const sub = units.filter((u) => u.deployment !== dep);
      if (t2Mass(sub) < MASS_FLOOR || sub.length === 0) { lodoBelowFloor.push(dep); continue; }
      const ts = t2Test(sub, SEED + 33000 + GAPS.indexOf(gap), 1000);
      if (!lodo || ts.p > lodo.p) lodo = { dep, p: ts.p, mass: t2Mass(sub) };
    }
    if (lodo) lodo.belowFloorDeps = lodoBelowFloor;
    else if (lodoBelowFloor.length) lodo = { p: NaN, belowFloorDeps: lodoBelowFloor };
    results.t2[gap] = { units: units.length, mass: massv, ...t,
                        separations: { p10: quantile(seps, 0.10), median: quantile(seps, 0.5),
                                       p90: quantile(seps, 0.90), shareGe30s: mean(seps.map((v) => (v >= 30 ? 1 : 0))) },
                        ownInSep: mean(own), otherInSep: mean(scene),
                        deploymentMass: Object.fromEntries(depMass), sw061Share: sw061, lodoWorst: lodo,
                        tested: !armNotTested.t2[gap] };
    console.log(`  ${(gap + "s").padEnd(6)}${String(units.length).padStart(6)}${String(massv).padStart(6)}` +
                `${fmt(t.observed).padStart(9)}${fmt(t.nullMean).padStart(9)}${fmt(t.z, 1).padStart(7)}` +
                `${fmt(t.p).padStart(8)}${t.p < ALPHA ? "*" : " "}${fmt(100 * sw061, 0).padStart(7)}%` +
                `${(lodo && Number.isFinite(lodo.p) ? fmt(lodo.p) : "floor").padStart(9)}` +
                `   sep med ${fmt(quantile(seps, 0.5), 1)}s, ${fmt(100 * mean(seps.map((v) => (v >= 30 ? 1 : 0))), 0)}% >= 30s`);
  }
  const tested2 = GAPS.filter((g) => results.t2[g].tested);
  results.t2.survives = tested2.length > 0 && tested2.every((g) => results.t2[g].p < ALPHA);
  // Statistic-level registered qualifiers — retained in EVERY configuration,
  // including no-row ones (round-4 scope clause).
  {
    const firedArms = tested2.filter((g) => results.t2[g].p < ALPHA);
    const lodoLoses = firedArms.some((g) => results.t2[g].lodoWorst &&
      Number.isFinite(results.t2[g].lodoWorst.p) && results.t2[g].lodoWorst.p >= ALPHA);
    results.t2.qualifiers = { firedArms, lodoLoses };
    if (firedArms.length && lodoLoses) {
      console.log(`  QUALIFIER (registered): concentrated in one annotation scene — consistent with ` +
                  `block-wise attribution error as well as state; the state reading is not licensed at full strength`);
    }
  }
  console.log(`  T2 ${results.t2.survives ? "SURVIVES (all tested arms)" : "does not survive"}` +
              `   (beyond-exchange reading requires the 30s arm: ${!results.t2[30] || !results.t2[30].tested ? "NOT TESTED — reading not licensed" : results.t2[30].p < ALPHA ? "fired" : "did not fire"})`);
  console.log();
}

if (!notTested.t3) {
  console.log("T3 — CROSS-SPEAKER CONCURRENCE (rotation + jitter conjunction; primary arm W=5)");
  console.log(`  ${"W".padEnd(5)}${"recs".padStart(5)}${"pairs".padStart(7)}${"r".padStart(9)}` +
              `${"rot-null".padStart(10)}${"p".padStart(9)}${"jit2-p".padStart(9)}${"jit5-p".padStart(9)}${"overlap%".padStart(9)}`);
  const w30set = new Set(t3All.filter((rc) => rc.span >= 60).map((rc) => rc.rec));
  const armIds = {};
  for (const W of WINDOWS) {
    const recs = t3All.filter((rc) => rc.span >= 2 * W);
    if (armNotTested.t3[W]) {
      const ch = ncFail.includes(`T3@${W}`) ? "negative control" : "mass floor";
      const idsNT = new Set();
      for (const rc of recs) {
        const tsA = rc.A.map((r) => r.ts), tsB = rc.B.map((r) => r.ts);
        for (const [ia, ib] of derivePairs(rc.A, tsA, rc.B, tsB, W)) idsNT.add(`${rc.A[ia].i}|${rc.B[ib].i}`);
      }
      armIds[W] = idsNT;
      results.t3[W] = { recordings: recs.length, n: armMass.t3[W], tested: false, notTestedChannel: ch };
      console.log(`  ${(W + "s").padEnd(5)}${String(recs.length).padStart(5)}${String(armMass.t3[W]).padStart(7)}` +
                  `   NOT TESTED (${ch}) — not computed, counts neither way`);
      continue;
    }
    const t = t3Test(recs, W, SEED + 34000 + WINDOWS.indexOf(W));
    // overlap share, deployment shares, and pair ids on the observed pairing
    let nOv = 0, nAll = 0;
    const depPairs = new Map(); const idsHere = new Set();
    for (const rc of recs) {
      const tsA = rc.A.map((r) => r.ts), tsB = rc.B.map((r) => r.ts);
      for (const [ia, ib] of derivePairs(rc.A, tsA, rc.B, tsB, W)) {
        nAll++; if (overlapPair(rc.A[ia], rc.B[ib])) nOv++;
        depPairs.set(rc.deployment, (depPairs.get(rc.deployment) || 0) + 1);
        idsHere.add(`${rc.A[ia].i}|${rc.B[ib].i}`);
      }
    }
    armIds[W] = idsHere;
    const leaders = [...depPairs.entries()].sort((a, b) => b[1] - a[1])
      .map(([d, n]) => ({ deployment: d, share: n / nAll }));
    // registered diagnostic: partial correlation controlling own preceding silence
    const diag = t3PartialDiag(recs, W);
    // composition-constant profile arm (fixed W=30-eligible recording set)
    const cc = t3Test(t3All.filter((rc) => w30set.has(rc.rec)), W, SEED + 35000 + WINDOWS.indexOf(W), "all", 1000);
    results.t3[W] = { recordings: recs.length, ...t, overlapShare: nOv / nAll,
                      deploymentLeaders: leaders.slice(0, 5),
                      partialControllingOwnSilence: diag,
                      compositionConstant: { r: cc.observed, rotP: cc.rotation.p },
                      tested: !armNotTested.t3[W] };
    console.log(`  ${(W + "s").padEnd(5)}${String(recs.length).padStart(5)}${String(t.n).padStart(7)}` +
                `${fmt(t.observed).padStart(9)}${fmt(t.rotation.nullMean).padStart(10)}${fmt(t.rotation.p).padStart(8)}${t.rotation.p < ALPHA ? "*" : " "}` +
                `${fmt(t.jitter[2].p).padStart(9)}${fmt(t.jitter[5].p).padStart(9)}${fmt(100 * nOv / nAll, 0).padStart(8)}%`);
    console.log(`        retention rot ${fmt(100 * t.rotation.retention, 1)}% / J2 ${fmt(100 * t.jitter[2].retention, 1)}% / J5 ${fmt(100 * t.jitter[5].retention, 1)}%` +
                `   partial(own-sil) r=${fmt(diag.r)} n=${diag.n}` +
                `   leaders ${leaders.slice(0, 3).map((l) => `${l.deployment} ${fmt(100 * l.share, 0)}%`).join(", ")}`);
  }
  // registered: shared-pair fraction across windows (so a scale profile cannot
  // be read as three confirmations)
  results.t3.sharedPairFraction = {
    w5inW10: [...armIds[5]].filter((id) => armIds[10].has(id)).length / armIds[5].size,
    w5inW30: [...armIds[5]].filter((id) => armIds[30].has(id)).length / armIds[5].size,
  };
  console.log(`  shared pairs: ${fmt(100 * results.t3.sharedPairFraction.w5inW10, 1)}% of W=5 pairs at W=10, ` +
              `${fmt(100 * results.t3.sharedPairFraction.w5inW30, 1)}% at W=30`);
  const prim = results.t3[PRIMARY_W];
  results.t3.survives = prim.tested && prim.fires;
  // Registered pre-assigned reading for a rotation-only positive at the
  // primary arm, with the retention shares printed beside it (bio-r5-02).
  results.t3.rotationOnly = prim.tested && !prim.fires && prim.rotation.p < ALPHA;
  if (results.t3.rotationOnly) {
    console.log(`  PRE-ASSIGNED READING (registered): fires under rotation but not under jitter — ` +
                `"co-activity plus private state, or fine alignment below the co-null's discrimination ` +
                `at the reported retention; no evidence of tempo concurrence at that discrimination" ` +
                `[retention rot ${fmt(100 * prim.rotation.retention, 1)}% / ` +
                `J2 ${fmt(100 * prim.jitter[2].retention, 1)}% / J5 ${fmt(100 * prim.jitter[5].retention, 1)}%]`);
  }
  // stability on the non-overlapping stratum (pinned sense) — only meaning-bearing
  // on a surviving fire, computed regardless for the record
  const recs5 = t3All.filter((rc) => rc.span >= 2 * PRIMARY_W);
  const strat = t3Test(recs5, PRIMARY_W, SEED + 36000, "nonoverlap");
  results.t3.nonOverlapStratum = { r: strat.observed, n: strat.n,
    sameSign: Math.sign(strat.observed) === Math.sign(prim.observed),
    rotP: strat.rotation.p, jit2P: strat.jitter[2].p, jit5P: strat.jitter[5].p,
    stable: Math.sign(strat.observed) === Math.sign(prim.observed) &&
            strat.rotation.p < ALPHA && JITTERS.every((J) => strat.jitter[J].p < ALPHA) };
  console.log(`  primary arm (W=5): ${results.t3.survives ? "FIRES under both nulls" : "does not survive"}` +
              `   non-overlap stratum: r=${fmt(strat.observed)} n=${strat.n} ` +
              `${results.t3.nonOverlapStratum.stable ? "STABLE (pinned sense)" : "not stable"}`);
  console.log();
}

// --- verdict + artifacts -----------------------------------------------------
rule();
const state = (s) => notTested[s] ? "NOT TESTED" : (results[s].survives ? "fires" : "null");

// T1 state classification — the registered five states; partial fires get the
// registered arm-pattern reading with its precedence rule.
function classifyT1() {
  if (notTested.t1) return { state: "NOT TESTED" };
  const tested = GAPS.filter((g) => results.t1[g]?.tested);
  const fired = tested.filter((g) => results.t1[g].p < ALPHA);
  const firedSigns = new Set(fired.map((g) => Math.sign(results.t1[g].observed)));
  if (results.t1.survives) {
    const sign = Math.sign(results.t1[tested[0]].observed);
    return { state: sign > 0 ? "survives-positive" : "survives-negative", firedArms: fired };
  }
  if (fired.length === 0 || firedSigns.size > 1) return { state: "null-or-mixed", firedArms: fired };
  // sign-consistent partial fire: classify against the three registered patterns
  const testedSorted = [...tested].sort((a, b) => a - b);
  const wideFired = fired.includes(30);
  const narrowOnly = fired.every((g) => g <= 5);
  const suffix = testedSorted.slice(testedSorted.length - fired.length);
  const isWideSuffix = wideFired && suffix.every((g) => fired.includes(g));
  let monotone = true;
  for (let j = 1; j < testedSorted.length; j++) {
    if (Math.abs(results.t1[testedSorted[j]].observed) + 1e-12 <
        Math.abs(results.t1[testedSorted[j - 1]].observed)) monotone = false;
  }
  let pattern;
  if (isWideSuffix && monotone) {
    pattern = "truncation-consistent: wide-arm fires with |r| attenuating monotonically as GAP " +
      "shrinks — registered as consistent with a real coupling at timescales the narrow arms " +
      "truncate away; does not survive, and is reported as this pattern, not as a cut artifact";
  } else if (narrowOnly) {
    pattern = "narrow-edge-only (GAP 3-5, no wide-arm support): registered signature of residual " +
      "null miscalibration on short-fragment geometry — triggers re-examination of the placebo " +
      "battery at those arms; licenses no coupling reading";
  } else {
    pattern = "generic cut-dependence (matches none of the three registered arm-patterns)";
  }
  return { state: "partial-fire", firedArms: fired, pattern };
}
const t1Class = classifyT1();
const t1Verdict = { "NOT TESTED": "NOT TESTED", "survives-positive": "fires positive",
                    "survives-negative": "fires negative", "null-or-mixed": "null",
                    "partial-fire": "partial fire (does not survive)" }[t1Class.state];

// Registered reading-matrix machinery: row selection, row-3 sub-cases (a)-(d),
// the (a)-only stamp, and the reading qualifiers.
function readMatrix() {
  const out = { row: null, rowLabel: "", subcases: [], stamps: [], notes: [], t1: t1Class };
  if (!notTested.t3 && results.t3.survives) {
    out.row = 2; out.rowLabel = `row 2 (T3 fires; T2 ${state("t2")})`;
    if (results.t3.nonOverlapStratum.stable) {
      out.notes.push("stable on the non-overlapping stratum (pinned sense): shared driver or " +
        "interaction, undecidable here; no communication claim licensed");
    } else {
      out.notes.push("NOT stable on the non-overlapping stratum: two generators this corpus " +
        "cannot separate (split same-whale train / genuine chorus-confined imitation); licenses " +
        "neither concurrence nor a reduction of the published sub-claim to artifact");
    }
    return out;
  }
  if (notTested.t3) {
    out.rowLabel = "no matrix row selectable — T3 NOT TESTED; machinery-only report per the propagation rule";
    return out;
  }
  if (notTested.t2) {
    out.rowLabel = "no matrix row selectable — T2 NOT TESTED with T3 null; machinery-only report per the propagation rule";
    return out;
  }
  if (results.t2.survives) {
    out.row = 1; out.rowLabel = "row 1 (T2 fires, T3 null) — beyond-gap persistence, no detectable concurrence at the reported sensitivity: state-flavored";
    const arm30 = results.t2[30];
    out.notes.push(arm30?.tested && arm30.p < ALPHA
      ? "GAP-30 fired: the session-scale reading is licensed"
      : "GAP-30 did not fire or is NOT TESTED: 'session-scale' is NOT licensed");
    if (results.t2.qualifiers?.lodoLoses) out.notes.push("LODO qualifier applies: concentrated in one annotation scene — " +
      "consistent with block-wise attribution error as well as state; the state reading is not licensed at full strength");
    return out;
  }
  // row 3: T2 tested-null, T3 tested-null (partial fires land here)
  out.row = 3; out.rowLabel = "row 3 (T2 null, T3 null)";
  const t2tested = GAPS.filter((g) => results.t2[g]?.tested);
  const t2fired = t2tested.filter((g) => results.t2[g].p < ALPHA);
  if (t2fired.length > 0) {
    out.subcases.push(`(b) T2 partial fire at {${t2fired.join(", ")}s}: scale-limited persistence at the fired arms; ` +
      "persistence is not established beyond the widest fired gap, a thin-arm miss is a non-detection " +
      "there, and 'local to the exchange' may not be asserted");
  }
  if (t1Class.state === "survives-positive") {
    out.subcases.push("(c) T1 surviving positive: a pacing-state signature exists but is exchange-local — " +
      "evidence against the beyond-exchange state predictions specifically, not against state; no signal claim");
  } else if (t1Class.state === "survives-negative") {
    out.subcases.push("(d) T1 surviving negative: compensatory / isochronous motor timing, exchange-local — " +
      "'evidence against the pacing-state prediction' may be stated; 'maximally signal-compatible' may not");
  } else if (t1Class.state === "partial-fire") {
    out.subcases.push(`T1 partial fire — no sub-case stamp; registered narrative label: ${t1Class.pattern}`);
  } else if (t1Class.state === "NOT TESTED") {
    out.notes.push("T1 NOT TESTED: T1-keyed sub-case labels (a)/(c)/(d) stripped; row reported beside the null-machinery finding");
  }
  if (t2fired.length === 0 && t1Class.state === "null-or-mixed") {
    out.subcases.push("(a) clean null: drift is local to the exchange and not detectably shared");
    out.stamps.push("maximally signal-compatible outcome; evidence against the state predictions " +
      "made here — and still licensing no signal claim: unexplained is not signal");
  }
  return out;
}
const matrix = readMatrix();
if (!notTested.t3 && results.t3.rotationOnly) {
  const prim = results.t3[PRIMARY_W];
  matrix.notes.push("rotation-only positive at the primary arm: the registered pre-assigned reading " +
    "applies — 'co-activity plus private state, or fine alignment below the co-null's discrimination " +
    `at the reported retention' [retention rot ${fmt(100 * prim.rotation.retention, 1)}% / ` +
    `J2 ${fmt(100 * prim.jitter[2].retention, 1)}% / J5 ${fmt(100 * prim.jitter[5].retention, 1)}%]`);
}
results.matrix = matrix;

console.log(`  T1: ${t1Verdict}   T2: ${state("t2")}   T3: ${state("t3")}`);
console.log(`  matrix: ${matrix.rowLabel}`);
for (const sc of matrix.subcases) console.log(`    sub-case ${sc}`);
for (const st of matrix.stamps) console.log(`    STAMP: ${st}`);
for (const nt of matrix.notes) console.log(`    note: ${nt}`);
// Prediction scoring (registered: NOT TESTED predictions are unevaluated;
// clause (ii) is conditional on a surviving T3)
const score1 = notTested.t1 ? "unevaluated (NOT TESTED)"
  : t1Class.state === "survives-positive" ? "hit" : "miss";
const score2 = notTested.t2 ? "unevaluated (NOT TESTED)" : results.t2.survives ? "hit" : "miss";
const score3i = notTested.t3 ? "unevaluated (NOT TESTED)" : results.t3.survives ? "miss" : "hit";
const score3ii = notTested.t3 ? "unevaluated (NOT TESTED)"
  : !results.t3.survives ? "unevaluated (conditional on a surviving T3)"
  : results.t3.nonOverlapStratum.stable ? "miss" : "hit";
results.predictions = { t1: score1, t2: score2, t3i: score3i, t3ii: score3ii };
console.log(`  predictions: T1 fires-positive-sign-consistent — ${score1}; T2 fires — ${score2};`);
console.log(`               T3(i) no survival — ${score3i}; T3(ii) any fire unstable off-overlap — ${score3ii}`);
rule();

mkdirSync(ART, { recursive: true });
writeFileSync(join(ART, "rubato_provenance.json"), JSON.stringify({
  experiment: "10-rubato-provenance",
  preregistered: { SEED, ITERATIONS, ALPHA, MASS_FLOOR, GAPS, WINDOWS, PRIMARY_W, JITTERS,
                   NC_REPEATS, NC_ITER, NC_THRESHOLD, PHI, T3P_BETA, MIN_FRAG, MIN_RUN_T2, MIN_UNIT_RUNS },
  gates: { g0Kept: rows.length, g1Agreement: agree / all.length, residualClasses: [...residual],
           g3: { observable: nObs, sizeOneExcluded: nObs - nElig, eligible: nElig } },
  negativeControls, battery, armMass, armNotTested, notTested, notTestedChannels, results,
}, (k, v) => (typeof v === "number" && !Number.isFinite(v) ? String(v) : v), 2));
console.log(`  written ${join(ART, "rubato_provenance.json")}`);
