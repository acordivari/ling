// exp08_turn_taking.mjs — do sperm whales take turns?
//
//     node tools/exp08_turn_taking.mjs
//
// Two statistics over the Sharma dialogue corpus, each against a ladder of three
// nulls. See experiments/08-turn-taking/README.md for the pre-registration.
//
// The design turns on one structural fact: a whale cannot overlap itself. In
// this corpus 0 of 1,382 same-speaker adjacent pairs overlap and 908 of 2,239
// cross-speaker pairs do, so 40.55% of all "speaker switches" are forced by
// simultaneity rather than chosen. Statistics are therefore computed only over
// ADMISSIBLE pairs — those where the next coda begins after the previous one
// ends, so that both a same-speaker and a cross-speaker continuation were
// physically available.
//
// Everything below is deterministic given SEED.

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { makeRng } from "../explorer/js/random.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSV = join(HERE, "..", "data", "sperm-whale-dialogues.csv");
const ART = join(HERE, "..", "experiments", "08-turn-taking", "artifacts");

// --- pre-registered constants ----------------------------------------------
const SEED = 808;
const ITERATIONS = 2000;
const MIN_CODAS = 6;        // per recording, to be worth analysing
const MAX_GAP = 30;         // s; beyond this the two codas are not an exchange
const JITTER_W = [2, 5, 10, 20, 45, 90];
const ALPHA = 0.05;

const fmt = (v, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : "   n/a");
const rule = (c = "=") => console.log(c.repeat(78));
const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;
const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((v) => (v - m) ** 2))); };
const median = (xs) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b), h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

if (!existsSync(CSV)) {
  console.error(`missing ${CSV}\n  run: python3 tools/fetch_corpus.py`);
  process.exit(1);
}
// The deposit ships CRLF line endings. Splitting on "\n" alone leaves a trailing
// "\r" on the last field of every row, so `head.indexOf("TsTo")` returns -1 and
// every timestamp parses as NaN. That failed loudly here — 100% of pairs came
// back inadmissible, including same-speaker pairs that cannot overlap by
// anatomy — but a statistic less tied to a hard structural fact would have
// absorbed it and produced plausible numbers.
const lines = readFileSync(CSV, "utf8").trim().split(/\r?\n/);
const head = lines[0].replace(/^﻿/, "").split(",").map((s) => s.trim());
const iREC = head.indexOf("REC"), iDur = head.indexOf("Duration");
const iW = head.indexOf("Whale"), iTs = head.indexOf("TsTo");
const all = lines.slice(1).map((l) => {
  const p = l.split(",");
  const rec = p[iREC];
  const m = rec.match(/^(sw\d+)([a-z])/);
  return { rec, deployment: m ? m[1] : rec, tag: m ? m[2] : "?",
           whale: p[iW], ts: Number(p[iTs]), dur: Number(p[iDur]) };
});

rule();
console.log("EXPERIMENT 08 — do sperm whales take turns?");
rule();
console.log(`  ${all.length} codas   ${new Set(all.map((r) => r.rec)).size} recordings   ` +
            `${new Set(all.map((r) => r.deployment)).size} deployments`);

// --- G0: one tag per deployment --------------------------------------------
// Deployments carry more than one DTag at once, so two recordings can hold the
// SAME acoustic scene with speaker indices assigned independently per tag.
// Keep the tag contributing the most codas; ties break alphabetically.
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
const perDepTags = new Map();
for (const r of rows) {
  if (!perDepTags.has(r.deployment)) perDepTags.set(r.deployment, new Set());
  perDepTags.get(r.deployment).add(r.tag);
}
const g0 = [...perDepTags.values()].every((s) => s.size === 1);
console.log(`  G0  one tag per deployment: ${g0 ? "PASS" : "FAIL"}   ` +
            `kept ${rows.length} of ${all.length} codas ` +
            `(${(100 * rows.length / all.length).toFixed(1)}%)`);
if (!g0) process.exit(1);

// --- recordings with two speakers -------------------------------------------
const byRec = new Map();
for (const r of rows) {
  if (!byRec.has(r.rec)) byRec.set(r.rec, []);
  byRec.get(r.rec).push(r);
}
const recs = [];
for (const [, rs] of byRec) {
  const w = new Set(rs.map((r) => r.whale));
  if (w.size !== 2 || rs.length < MIN_CODAS) continue;
  recs.push(rs.sort((a, b) => a.ts - b.ts));
}
console.log(`  ${recs.length} two-speaker recordings with >= ${MIN_CODAS} codas   ` +
            `${recs.reduce((s, r) => s + r.length, 0)} codas`);
console.log();

// --- admissibility ----------------------------------------------------------
// A pair is admissible when the next coda begins after the previous one ENDS.
// Only then were both a same-speaker and a cross-speaker continuation possible.
function pairsOf(seq) {
  const out = [];
  for (let i = 0; i < seq.length - 1; i++) {
    const gap = seq[i + 1].t - seq[i].t;
    if (gap <= 0 || gap > MAX_GAP) continue;
    out.push({ gap, admissible: gap >= seq[i].d, switched: seq[i].w !== seq[i + 1].w });
  }
  return out;
}
const asSeq = (rs) => rs.map((r) => ({ t: r.ts, d: r.dur, w: r.whale }));

{
  let ov = 0, tot = 0, sameOv = 0, sameTot = 0;
  for (const rs of recs) for (const p of pairsOf(asSeq(rs))) {
    if (p.switched) { tot++; if (!p.admissible) ov++; } else { sameTot++; if (!p.admissible) sameOv++; }
  }
  console.log(`  overlapping (inadmissible) pairs:  cross-speaker ${ov}/${tot} = ` +
              `${fmt(100 * ov / tot, 1)}%   same-speaker ${sameOv}/${sameTot}`);
}

// --- surrogates -------------------------------------------------------------
// Rotation is a RIGID shift of one speaker's whole timeline, so every interval
// within that speaker survives and the surrogate never asks a whale to overlap
// itself. Jitter does not have that property and is reported as a sweep, not as
// the primary null.
function surrogate(rs, rng, mode, W) {
  const ws = [...new Set(rs.map((r) => r.whale))].sort();
  const A = rs.filter((r) => r.whale === ws[0]);
  const B = rs.filter((r) => r.whale === ws[1]);
  const lo = Math.min(...rs.map((r) => r.ts)), hi = Math.max(...rs.map((r) => r.ts));
  const span = hi - lo;
  if (span <= 0) return null;
  let Bs;
  if (mode === "rotate") {
    const d = rng() * span;
    Bs = B.map((r) => ({ ...r, ts: lo + ((r.ts - lo + d) % span) }));
  } else {
    Bs = B.map((r) => ({ ...r, ts: r.ts + (rng() * 2 - 1) * W }));
  }
  return [...A, ...Bs].sort((a, b) => a.ts - b.ts);
}
function shuffleLabels(rs, rng) {
  const labs = rs.map((r) => r.whale);
  for (let i = labs.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0; const t = labs[i]; labs[i] = labs[j]; labs[j] = t;
  }
  return rs.map((r, i) => ({ ...r, whale: labs[i] }));
}

// --- the two statistics, over ADMISSIBLE pairs only -------------------------
function stats(recSet) {
  let sw = 0, n = 0, xOv = 0, xTot = 0; const gaps = [];
  for (const rs of recSet) {
    for (const p of pairsOf(asSeq(rs))) {
      // Overlap rate is measured over ALL cross-speaker pairs, admissible or
      // not — it is the statistic the admissibility filter exists to remove, so
      // it must be scored before that filter, not after.
      if (p.switched) { xTot++; if (!p.admissible) xOv++; }
      if (!p.admissible) continue;
      n++;
      if (p.switched) { sw++; gaps.push(p.gap); }
    }
  }
  return { switchRate: n ? sw / n : NaN, medianGap: median(gaps), nPairs: n, nSwitch: sw,
           overlapRate: xTot ? xOv / xTot : NaN, nCross: xTot };
}

const obs = stats(recs);
console.log(`  admissible pairs ${obs.nPairs}   switches ${obs.nSwitch}`);
console.log();
console.log(`  OBSERVED   switch rate ${fmt(obs.switchRate)}   ` +
            `median switch gap ${fmt(obs.medianGap, 3)} s`);
console.log();

// --- the ladder -------------------------------------------------------------
const NULLS = [
  { id: "N1", label: "naive label shuffle", mode: "labels" },
  { id: "N2", label: "speaker rotation (bout-preserving)", mode: "rotate" },
  ...JITTER_W.map((W) => ({ id: `N3`, label: `local jitter +/-${W}s`, mode: "jitter", W })),
];

const results = [];
console.log(`  ${"".padEnd(32)}${"--- OVERLAP ---".padStart(24)}${"--- SWITCH RATE ---".padStart(25)}${"--- MEDIAN GAP ---".padStart(23)}`);
console.log(`  ${"null".padEnd(32)}${"null".padStart(9)}${"z".padStart(7)}${"p".padStart(9)}` +
            `${"null".padStart(9)}${"z".padStart(7)}${"p".padStart(9)}${"null".padStart(8)}${"z".padStart(7)}${"p".padStart(9)}`);
console.log(`  ${"(observed)".padEnd(32)}${fmt(obs.overlapRate, 3).padStart(9)}${"".padStart(16)}` +
            `${fmt(obs.switchRate, 3).padStart(9)}${"".padStart(16)}${fmt(obs.medianGap, 2).padStart(8)}`);
for (const nul of NULLS) {
  const rng = makeRng(SEED);
  const rates = [], gaps = [], nPairs = [], ovs = [];
  for (let it = 0; it < ITERATIONS; it++) {
    const sur = [];
    for (const rs of recs) {
      const s = nul.mode === "labels" ? shuffleLabels(rs, rng)
                                      : surrogate(rs, rng, nul.mode, nul.W);
      if (s) sur.push(s);
    }
    const st = stats(sur);
    nPairs.push(st.nPairs);
    if (Number.isFinite(st.overlapRate)) ovs.push(st.overlapRate);
    if (Number.isFinite(st.switchRate)) rates.push(st.switchRate);
    if (Number.isFinite(st.medianGap)) gaps.push(st.medianGap);
  }
  // A surrogate that admits a different NUMBER of pairs is not comparing like
  // with like: the admissibility filter selects on the previous coda's own
  // duration, and moving one speaker changes which pairs are adjacent at all.
  // Reported so a median-gap difference cannot be read without it.
  nul.nPairsNull = mean(nPairs);
  const zo = (obs.overlapRate - mean(ovs)) / sd(ovs);
  const po = (ovs.filter((v) => v >= obs.overlapRate).length + 1) / (ovs.length + 1);
  const zr = (obs.switchRate - mean(rates)) / sd(rates);
  const zg = (obs.medianGap - mean(gaps)) / sd(gaps);
  // switch rate: one-sided high (alternation). gap: one-sided low (fast reply).
  const pr = (rates.filter((v) => v >= obs.switchRate).length + 1) / (rates.length + 1);
  const pg = (gaps.filter((v) => v <= obs.medianGap).length + 1) / (gaps.length + 1);
  results.push({ id: nul.id, label: nul.label, W: nul.W ?? null,
                 nPairsNull: nul.nPairsNull, nPairsObs: obs.nPairs,
                 overlapNull: mean(ovs), overlapZ: zo, overlapP: po,
                 rateNull: mean(rates), rateZ: zr, rateP: pr,
                 gapNull: mean(gaps), gapZ: zg, gapP: pg });
  console.log(`  ${nul.label.padEnd(32)}${fmt(mean(ovs), 3).padStart(9)}${fmt(zo, 1).padStart(7)}` +
              `${fmt(po, 4).padStart(8)}${po < ALPHA ? "*" : " "}` +
              `${fmt(mean(rates), 3).padStart(9)}${fmt(zr, 1).padStart(7)}${fmt(pr, 4).padStart(8)}${pr < ALPHA ? "*" : " "}` +
              `${fmt(mean(gaps), 2).padStart(8)}${fmt(zg, 1).padStart(7)}${fmt(pg, 4).padStart(8)}${pg < ALPHA ? "*" : ""}`);
}
console.log();
console.log(`  overlap:     one-sided high (do they call SIMULTANEOUSLY more than chance)`);
console.log(`  switch rate: one-sided high (do they alternate MORE than chance)`);
console.log(`  median gap:  one-sided low  (do they answer FASTER than chance)`);
console.log();

rule();
const rot = results.find((r) => r.label.startsWith("speaker rotation"));
const smallJ = results.find((r) => r.W === 2);
console.log(`  switch rate vs rotation: ${rot.rateP < ALPHA ? "SURVIVES" : "does not survive"} ` +
            `(p ${fmt(rot.rateP)})`);
console.log(`  median gap  vs rotation: ${rot.gapP < ALPHA ? "SURVIVES" : "does not survive"} ` +
            `(p ${fmt(rot.gapP)})`);
console.log(`  median gap  vs +/-2s jitter: ${smallJ.gapP < ALPHA ? "SURVIVES" : "does not survive"} ` +
            `(p ${fmt(smallJ.gapP)})`);
rule();

mkdirSync(ART, { recursive: true });
writeFileSync(join(ART, "turn_taking.json"), JSON.stringify({
  experiment: "08-turn-taking",
  preregistered: { SEED, ITERATIONS, MIN_CODAS, MAX_GAP, JITTER_W, ALPHA },
  g0: { keptCodas: rows.length, totalCodas: all.length, pass: g0 },
  recordings: recs.length, observed: obs, ladder: results,
}, null, 2));
console.log(`  written ${join(ART, "turn_taking.json")}`);
