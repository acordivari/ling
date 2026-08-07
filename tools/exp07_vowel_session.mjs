// exp07_vowel_session.mjs — does the coda vowel stay put when the SAME animal is
// recorded in a different session?
//
//     node tools/exp07_vowel_session.mjs
//
// The previous test asked whether whales differ from each other and found the
// question unanswerable: 9 of 13 whales were recorded in exactly one deployment,
// so individual identity and recording session are the same variable for most of
// the corpus.
//
// Four whales escape that. FORK, TBB, JOCASTA and LAIUS were each tagged in more
// than one deployment, which inverts the design: hold the ANIMAL fixed and vary
// the RECORDING SESSION. That is the artifact question stated directly.
//
//   vowel is body-size / click structure  ->  stable within an animal
//   vowel moves with recording conditions ->  shifts between that animal's own
//                                             sessions
//
// Diamant, Gruber, Gero & Begus (Ecological Informatics, June 2026) already
// showed ship noise moves the a/i distribution. This asks how big that movement
// is relative to the between-animal differences an "individual vowel signature"
// would have to rest on.
//
// PRE-REGISTERED, reusing exp07_vowel_individual.mjs's thresholds unchanged so
// the two analyses are directly comparable: MIN_LEVERAGE 33.3, MIN_ASSIGNMENTS
// 20, alpha 0.05. Applying them here admits ONE contrast. That is reported as
// the design's answer, not worked around.

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { permutationTest } from "../explorer/js/rhythm.js";
import { makeRng } from "../explorer/js/random.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const JOINED = join(HERE, "..", "data", "vowel", "joined.json");
const ART = join(HERE, "..", "experiments", "07-vowel-artifact", "artifacts");

const MIN_LEVERAGE = 33.3;
const MIN_ASSIGNMENTS = 20;
const ITERATIONS = 4000;
const SEED = 707;
const ALPHA = 0.05;
const MIN_CELL = 10;   // codas per (whale, deployment) cell to enter arm 2

const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : "  n/a");
const rule = (c = "=") => console.log(c.repeat(78));
const comb = (n, k) => { let c = 1; for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1); return Math.round(c); };
const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;
const sd = (xs) => (xs.length < 2 ? NaN
  : Math.sqrt(xs.reduce((s, v) => s + (v - mean(xs)) ** 2, 0) / (xs.length - 1)));

if (!existsSync(JOINED)) {
  console.error(`missing ${JOINED}\n  run: python3 tools/exp07_join_bouts.py`);
  process.exit(1);
}
const rows = JSON.parse(readFileSync(JOINED, "utf8")).rows
  .filter((r) => r.handv === "a" || r.handv === "i");

const byWhale = new Map();
for (const r of rows) {
  if (!byWhale.has(r.whale)) byWhale.set(r.whale, []);
  byWhale.get(r.whale).push(r);
}
const depsOf = (rs) => [...new Set(rs.map((r) => r.deployment))].sort();
const multi = [...byWhale.keys()].filter((w) => depsOf(byWhale.get(w)).length >= 2).sort();

rule();
console.log("EXPERIMENT 07 — does the vowel move when the SAME whale is re-recorded?");
rule();
console.log(`  ${rows.length} joined + vowel-labelled codas   ` +
            `${multi.length} whales with 2+ deployments: ${multi.join(", ")}`);
console.log();

const rate = (rs) => rs.filter((r) => r.handv === "i").length / rs.length;
const lev = (A, B) => {
  const ta = new Map(), tb = new Map();
  for (const r of A) ta.set(r.codatype, (ta.get(r.codatype) || 0) + 1);
  for (const r of B) tb.set(r.codatype, (tb.get(r.codatype) || 0) + 1);
  let L = 0;
  for (const [t, na] of ta) { const nb = tb.get(t); if (nb) L += (na * nb) / (na + nb); }
  return L;
};

// --- what the raw numbers look like ----------------------------------------
console.log("Raw P(vowel = i) per (whale, deployment)");
console.log(`  ${"whale".padEnd(10)}${"deployment".padEnd(11)}${"codas".padStart(7)}` +
            `${"bouts".padStart(7)}${"P(i)".padStart(8)}`);
const cells = [];
for (const w of multi) {
  for (const d of depsOf(byWhale.get(w))) {
    const rs = byWhale.get(w).filter((r) => r.deployment === d);
    cells.push({ whale: w, deployment: d, n: rs.length,
                 bouts: new Set(rs.map((r) => r.rec)).size, pi: rate(rs), rows: rs });
    console.log(`  ${w.padEnd(10)}${d.padEnd(11)}${String(rs.length).padStart(7)}` +
                `${String(new Set(rs.map((r) => r.rec)).size).padStart(7)}${fmt(rate(rs)).padStart(8)}`);
  }
}
console.log();
for (const w of multi) {
  const cs = cells.filter((c) => c.whale === w).map((c) => c.pi);
  console.log(`  ${w.padEnd(10)} within-animal range of P(i) across its own sessions: ` +
              `${fmt(Math.min(...cs))} - ${fmt(Math.max(...cs))}  (spread ${fmt(Math.max(...cs) - Math.min(...cs))})`);
}
console.log();

// --- ARM 1: the formal contrast, same thresholds as the individual test -----
console.log("ARM 1 — within-whale deployment contrasts, joint null");
console.log("  strata = coda type, clusters = bout, permuted across bouts");
console.log(`  ${"contrast".padEnd(28)}${"n".padStart(10)}${"lev".padStart(7)}` +
            `${"C".padStart(10)}${"obs".padStart(8)}${"null".padStart(8)}${"p".padStart(9)}`);
const arm1 = [], skipped = [];
for (const w of multi) {
  const ds = depsOf(byWhale.get(w));
  for (let i = 0; i < ds.length; i++) {
    for (let j = i + 1; j < ds.length; j++) {
      const A = byWhale.get(w).filter((r) => r.deployment === ds[i]);
      const B = byWhale.get(w).filter((r) => r.deployment === ds[j]);
      const bA = new Set(A.map((r) => r.rec)).size, bB = new Set(B.map((r) => r.rec)).size;
      const C = comb(bA + bB, bA), L = lev(A, B);
      const tag = `${w} ${ds[i]}/${ds[j]}`;
      if (C < MIN_ASSIGNMENTS || L < MIN_LEVERAGE) {
        skipped.push({ contrast: tag, assignments: C, leverage: L,
                       why: C < MIN_ASSIGNMENTS ? "assignments" : "leverage" });
        continue;
      }
      const all = [...A, ...B];
      const r = permutationTest({
        items: all.map((x) => [x.handv === "i" ? 1 : 0]),
        labels: [...A.map(() => ds[i]), ...B.map(() => ds[j])],
        strata: all.map((x) => x.codatype),
        clusters: all.map((x) => x.rec),
        statistic: (P, Q) => Math.abs(mean(P.map((v) => v[0])) - mean(Q.map((v) => v[0]))),
        iterations: ITERATIONS, seed: SEED, kind: "distance",
      });
      arm1.push({ contrast: tag, nA: A.length, nB: B.length, leverage: L,
                  assignments: r.distinctAssignments, observed: r.observed,
                  nullMean: r.nullMean, p: r.p });
      console.log(`  ${tag.padEnd(28)}${(A.length + "+" + B.length).padStart(10)}` +
                  `${fmt(L, 1).padStart(7)}${(r.distinctAssignments ?? C).toLocaleString().padStart(10)}` +
                  `${fmt(r.observed).padStart(8)}${fmt(r.nullMean).padStart(8)}${fmt(r.p, 4).padStart(9)}`);
    }
  }
}
for (const s of skipped) {
  console.log(`  ${s.contrast.padEnd(28)} not tested — ${s.why} ` +
              `(C=${s.assignments.toLocaleString()}, leverage ${fmt(s.leverage, 1)})`);
}
console.log(`  => ${arm1.filter((r) => r.p < ALPHA).length} of ${arm1.length} at p < ${ALPHA}`);
console.log();

// --- ARM 2: is session movement smaller than between-animal movement? -------
//
// Residualise every coda against its own coda-type mean, so composition is gone,
// then compare two spreads of cell means:
//
//   between-animal   SD across whales of their mean residual
//   within-animal    SD across a whale's OWN sessions, pooled over whales
//
// If the second is not smaller than the first, an "individual vowel signature"
// cannot be separated from a session signature.
console.log("ARM 2 — session movement vs between-animal movement, coda-type residuals");
const typeMean = new Map();
{
  const g = new Map();
  for (const r of rows) {
    if (!g.has(r.codatype)) g.set(r.codatype, []);
    g.get(r.codatype).push(r.handv === "i" ? 1 : 0);
  }
  for (const [t, vs] of g) typeMean.set(t, mean(vs));
}
const resid = (r) => (r.handv === "i" ? 1 : 0) - typeMean.get(r.codatype);

const whaleMeans = [...byWhale.entries()]
  .filter(([, rs]) => rs.length >= MIN_CELL)
  .map(([, rs]) => mean(rs.map(resid)));
const betweenSD = sd(whaleMeans);

const bigCells = cells.filter((c) => c.n >= MIN_CELL);
const withinDevs = [];
for (const w of multi) {
  const cs = bigCells.filter((c) => c.whale === w);
  if (cs.length < 2) continue;
  const ms = cs.map((c) => mean(c.rows.map(resid)));
  const mu = mean(ms);
  for (const m of ms) withinDevs.push(m - mu);
}
const withinSD = Math.sqrt(withinDevs.reduce((s, v) => s + v * v, 0) / (withinDevs.length - multi.length));

console.log(`  between-animal SD of residual vowel rate   ${fmt(betweenSD, 4)}  ` +
            `(${whaleMeans.length} whales)`);
console.log(`  within-animal, between-session SD          ${fmt(withinSD, 4)}  ` +
            `(${bigCells.length} cells in ${multi.length} whales)`);
console.log(`  ratio within / between                    ${fmt(withinSD / betweenSD, 3)}`);

// Null: shuffle each whale's bouts among its own deployments, preserving the
// number of bouts per session. Gives the session spread expected by chance.
const rng = makeRng(SEED);
const nullRatios = [];
for (let it = 0; it < ITERATIONS; it++) {
  const devs = [];
  for (const w of multi) {
    const cs = bigCells.filter((c) => c.whale === w);
    if (cs.length < 2) continue;
    const bouts = [...new Set(byWhale.get(w).map((r) => r.rec))];
    for (let a = bouts.length - 1; a > 0; a--) {
      const b = (rng() * (a + 1)) | 0; const t = bouts[a]; bouts[a] = bouts[b]; bouts[b] = t;
    }
    const byBout = new Map();
    for (const r of byWhale.get(w)) {
      if (!byBout.has(r.rec)) byBout.set(r.rec, []);
      byBout.get(r.rec).push(r);
    }
    let k = 0; const ms = [];
    for (const c of cs) {
      const take = [];
      const want = new Set(byWhale.get(w).filter((r) => r.deployment === c.deployment).map((r) => r.rec)).size;
      for (let z = 0; z < want && k < bouts.length; z++, k++) take.push(...(byBout.get(bouts[k]) || []));
      if (take.length) ms.push(mean(take.map(resid)));
    }
    if (ms.length >= 2) { const mu = mean(ms); for (const m of ms) devs.push(m - mu); }
  }
  if (devs.length > multi.length) {
    nullRatios.push(Math.sqrt(devs.reduce((s, v) => s + v * v, 0) / (devs.length - multi.length)) / betweenSD);
  }
}
nullRatios.sort((a, b) => a - b);
const obsRatio = withinSD / betweenSD;
const pRatio = (nullRatios.filter((v) => v >= obsRatio).length + 1) / (nullRatios.length + 1);
console.log(`  null ratio (bouts reshuffled among a whale's own sessions)  ` +
            `median ${fmt(nullRatios[nullRatios.length >> 1], 3)}  ` +
            `p95 ${fmt(nullRatios[Math.floor(0.95 * nullRatios.length)], 3)}`);
console.log(`  observed ${fmt(obsRatio, 3)}   p = ${fmt(pRatio, 4)}`);
console.log();

rule();
console.log(obsRatio >= 1
  ? "Session movement is at least as large as between-animal movement."
  : "Session movement is smaller than between-animal movement.");
rule();

mkdirSync(ART, { recursive: true });
writeFileSync(join(ART, "vowel_session.json"), JSON.stringify({
  experiment: "07-vowel-artifact", stage: "within-animal-between-session",
  preregistered: { MIN_LEVERAGE, MIN_ASSIGNMENTS, ITERATIONS, SEED, ALPHA, MIN_CELL },
  cells: cells.map(({ rows: _r, ...c }) => c),
  arm1: { tested: arm1, skipped },
  arm2: { betweenSD, withinSD, ratio: obsRatio, p: pRatio,
          nullMedian: nullRatios[nullRatios.length >> 1] },
}, null, 2));
console.log(`  written ${join(ART, "vowel_session.json")}`);
