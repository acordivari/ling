// claims.js — the questions the Observatory can actually answer, and the null
// models that decide what each answer means.
//
// Every claim here is stated BEFORE it is run, with its control condition named
// up front, because it is very easy to rationalise a distance ordering after
// seeing it. Each one carries a `prediction` written in advance. Where the
// prediction turned out wrong, the text says so rather than being quietly
// edited — a claim whose prediction cannot fail is not a claim.
//
// The design point of this file: a claim is not "statistic + data". It is
// "statistic + data + a CHOICE of null", and that third term is usually what
// decides the conclusion. So each claim offers several nulls and the UI makes
// switching between them the primary interaction, instead of hiding the choice
// behind a single p-value.

import {
  npvi, cv, standardise, centroid, euclidean,
  permutationTest, surrogateTest, surrogateBlockTest, cohensD,
} from "./rhythm.js";

/** Decode the packed corpus into per-coda records. */
export function decodeCorpus(corpus) {
  const scale = 10000;
  const out = [];
  for (let i = 0; i < corpus.ici.length; i++) {
    const ici = corpus.ici[i].map((v) => v / scale);
    out.push({
      ici,
      std: standardise(ici),
      type: corpus.types[corpus.codaType[i]],
      clan: corpus.clans[corpus.clan[i]],
      unit: corpus.units[corpus.unit[i]],
      idn: corpus.idn[i],
      idnCertain: !!corpus.idnCertain[i],
      nClicks: ici.length + 1,
      duration: ici.reduce((s, v) => s + v, 0),
      npvi: npvi(ici),
      cv: cv(ici),
    });
  }
  return out;
}

/**
 * Studentised pooled within-type contrast between two groups of codas.
 *
 * Within each coda type present in both groups, take the difference of group
 * means. Pool those differences with inverse-variance (effective-n) weights, then
 * divide by the pooled contrast's own standard error.
 *
 * The division is the whole point. A raw contrast is larger where the effective
 * sample is smaller, so comparing it across cluster assignments with wildly
 * different leverage (here: 33 codas for the real clan split, median 873) compares
 * noise levels rather than effects. Studentising puts them on one scale.
 */
export function studentisedContrast(A, B) {
  const d = 4;
  const byType = new Map();
  for (const [group, arr] of [["A", A], ["B", B]]) {
    for (const c of arr) {
      if (!byType.has(c.type)) byType.set(c.type, { A: [], B: [] });
      byType.get(c.type)[group].push(c.std);
    }
  }
  const num = new Float64Array(d);
  let wsum = 0, varAcc = 0, df = 0;
  for (const [, g] of byType) {
    const nA = g.A.length, nB = g.B.length;
    if (nA < 2 || nB < 2) continue;              // not estimable in both groups
    const mA = new Float64Array(d), mB = new Float64Array(d);
    for (const v of g.A) for (let i = 0; i < d; i++) mA[i] += v[i] / nA;
    for (const v of g.B) for (let i = 0; i < d; i++) mB[i] += v[i] / nB;
    const h = 1 / (1 / nA + 1 / nB);
    for (let i = 0; i < d; i++) num[i] += h * (mA[i] - mB[i]);
    wsum += h;
    for (const [arr, m, n] of [[g.A, mA, nA], [g.B, mB, nB]]) {
      for (const v of arr) for (let i = 0; i < d; i++) varAcc += (v[i] - m[i]) ** 2;
      df += n - 1;
    }
  }
  if (!wsum || df <= 0) return 0;
  let sq = 0;
  for (let i = 0; i < d; i++) sq += (num[i] / wsum) ** 2;
  const se = Math.sqrt((d * (varAcc / df)) / wsum);
  return se > 0 ? Math.sqrt(sq) / se : 0;
}

/** Effective sample size available to the within-type contrast, in codas. */
export function contrastLeverage(A, B) {
  const byType = new Map();
  for (const [g, arr] of [["A", A], ["B", B]]) {
    for (const c of arr) {
      if (!byType.has(c.type)) byType.set(c.type, { A: 0, B: 0 });
      byType.get(c.type)[g]++;
    }
  }
  let w = 0;
  for (const [, g] of byType) if (g.A >= 2 && g.B >= 2) w += 1 / (1 / g.A + 1 / g.B);
  return w;
}

const sepStat = (A, B) => euclidean(centroid(A.map((c) => c.std)), centroid(B.map((c) => c.std)));
const meanNpvi = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;

// ---------------------------------------------------------------- the claims

export function buildClaims(codas, comparanda) {
  const five = codas.filter((c) => c.nClicks === 5);
  const claims = [];

  // ---- 1. the centrepiece -------------------------------------------------
  claims.push({
    id: "clan",
    question: "Do the two vocal clans use different coda rhythms?",
    plain:
      "EC1 and EC2 are separate vocal clans sharing the same waters off Dominica. " +
      "Clan membership is thought to be marked by coda repertoire. If that is right, " +
      "their rhythms should differ.",
    statistic: "Distance between clan mean rhythms (standardised ICI space, 5-click codas)",
    prediction:
      "Stated in advance: the clans WILL separate strongly under a naive null, and " +
      "most of that separation will turn out to be repertoire composition rather than " +
      "different timing of a shared coda type. " +
      "REVISED TWICE after review, and both revisions are kept in " +
      "experiments/01 rather than overwritten. (1) The two single-confound nulls " +
      "each left a residual; a joint null was added and appeared to show a clean " +
      "null result at p = 0.96. (2) That p was an artifact — the statistic was " +
      "least sensitive on precisely the split under test. The current joint null " +
      "uses a studentised contrast over exactly-enumerated unit assignments. It " +
      "does not clear the design's 1/66 resolution floor, and the standing " +
      "conclusion is that this dataset CANNOT ANSWER the question: only ~33 codas " +
      "carry within-type information.",
    outcome: "underpowered — the design cannot resolve the question",
    n: five.length,
    nulls: [
      {
        id: "naive", kind: "distance",
        label: "Shuffle clan labels freely",
        controls: "nothing except the group sizes",
        why:
          "The obvious null. It asks: could this separation arise if clan membership " +
          "were assigned at random? It cannot distinguish 'these clans time codas " +
          "differently' from 'these clans use different codas'.",
        run: (seed, iterations) => permutationTest({
          items: five, labels: five.map((c) => c.clan), statistic: sepStat, iterations, seed,
        }),
      },
      {
        id: "stratified", kind: "distance",
        label: "Shuffle clan labels within each coda type",
        controls: "each clan's repertoire composition",
        why:
          "The honest null. Labels are permuted only among codas of the SAME type, so " +
          "the null keeps each clan's mix of coda types and destroys only the timing " +
          "difference. Whatever survives is a genuine within-type difference.",
        run: (seed, iterations) => permutationTest({
          items: five, labels: five.map((c) => c.clan), strata: five.map((c) => c.type),
          statistic: sepStat, iterations, seed,
        }),
      },
      {
        id: "joint", kind: "distance",
        label: "Studentised within-type contrast, shuffled by unit",
        controls: "repertoire composition AND non-independence, on a scale-matched statistic",
        why:
          "The decisive test — and it took three attempts to state correctly. " +
          "Controlling both confounds at once is necessary but not sufficient: the " +
          "statistic must also be comparable across the assignments it is compared " +
          "against. A first version residualised each coda against its coda-type " +
          "mean, which attenuates a real effect in proportion to how exclusively a " +
          "group owns its coda types — and the real clan split is by construction " +
          "the most extreme such split, so it was the LEAST sensitive of all 66 " +
          "assignments (17.7x below the median). Its p of 0.96 measured the " +
          "instrument, not the whales. This version forms the within-type contrast " +
          "explicitly, pools it with inverse-variance weights and divides by its own " +
          "standard error, so assignments with very different effective sample sizes " +
          "are on one scale. All 66 assignments are enumerated exactly; no sampling, " +
          "no seed. " +
          "KNOWN RESIDUAL PROBLEM, stated rather than hidden: this statistic is still " +
          "not perfectly calibrated. Its denominator is a coda-level standard error " +
          "while the null permutes UNITS, so T retains a dependence on leverage " +
          "(log-log slope ~0.31 against an ideal of 0, measured with the effect held " +
          "at exactly zero). A unit-level standard error reduces that to ~0.21 but " +
          "cannot remove it, because EC2 has only two social units and its " +
          "between-unit variance is barely estimable. Across three defensible " +
          "denominators the real split ranks 27, 59 and 66 of 66. The rank is " +
          "therefore soft; the conclusion is not, because none of the three clears " +
          "the 1/66 floor.",
        run: () => {
          const real = five.filter((c) => c.unit !== "ZZZ");
          return permutationTest({
            items: real, labels: real.map((c) => c.clan), clusters: real.map((c) => c.unit),
            statistic: studentisedContrast, iterations: 1, seed: 1,
          });
        },
      },
      {
        id: "byUnit", kind: "distance",
        label: "Shuffle clan labels across SOCIAL UNITS",
        controls: "the fact that codas from one unit are not independent",
        // Note the ZZZ exclusion below. 'ZZZ' is the corpus's own unknown-unit
        // sentinel (`unit_ZZZ_is_unknown_sentinel: true`), not a social unit.
        // Counting it gives 13 clusters and C(13,3) = 286 assignments; excluding
        // it gives the true 12 clusters, C(12,2) = 66, and a resolution floor of
        // 0.0152 rather than 0.0035. Treating a sentinel as a cluster manufactures
        // exactly the precision this null exists to disclaim.
        why:
          "The exchangeability question the other two nulls skip. Clan is a " +
          "deterministic property of a social unit — every unit in this corpus is " +
          "single-clan — so shuffling clan across individual codas invents a world " +
          "where two codas from the same unit belong to different clans. That " +
          "treats 6,105 correlated codas as 6,105 independent draws. Here whole " +
          "units are relabelled together, which is the only randomisation that " +
          "could actually have happened. The effective sample size collapses from " +
          "6,105 codas to 12 units, and the p-value cannot go below 1/(number of " +
          "possible unit assignments) however many shuffles you run. The unknown-unit " +
          "sentinel 'ZZZ' is excluded — it is not a social unit, and counting it " +
          "would inflate the assignment space from 66 to 286 and so manufacture " +
          "four times the resolution this null exists to disclaim.",
        run: (seed, iterations) => {
          const real = five.filter((c) => c.unit !== "ZZZ");
          return permutationTest({
            items: real, labels: real.map((c) => c.clan), clusters: real.map((c) => c.unit),
            statistic: sepStat, iterations, seed,
          });
        },
      },
    ],
    context: () => {
      const real = five.filter((c) => c.unit !== "ZZZ");
      const A = real.filter((c) => c.clan === "EC1"), B = real.filter((c) => c.clan === "EC2");
      const lev = contrastLeverage(A, B);
      const comp = {
        "n per null": `naive and stratified use all ${five.length.toLocaleString()} five-click codas; ` +
          `the unit-level and joint nulls use ${real.length.toLocaleString()}, excluding the ` +
          `${(five.length - real.length)} codas whose unit is the sentinel 'ZZZ'. Every excluded ` +
          `coda is EC2, so the observed statistic legitimately differs between tabs ` +
          `(0.12871 vs 0.12793) — it is not the same number computed twice`,
        "within-type leverage": `${lev.toFixed(1)} codas of ${real.length.toLocaleString()} ` +
          `— only where both clans use the SAME coda type (15 EC2 codas of 1+1+3, 19 EC1 of 5R3)`,
        "smallest detectable within-type effect": `~40% of a typical interval ` +
          `(measured by injection; a change that large would reclassify the coda)`,
      };
      for (const clan of [...new Set(five.map((c) => c.clan))]) {
        const sub = five.filter((c) => c.clan === clan);
        const counts = {};
        for (const c of sub) counts[c.type] = (counts[c.type] || 0) + 1;
        comp[clan] = Object.entries(counts).sort((a, b) => b[1] - a[1])
          .slice(0, 3).map(([t, n]) => `${t} ${(100 * n / sub.length).toFixed(0)}%`).join(", ");
      }
      return comp;
    },
  });

  // ---- 2. social unit -----------------------------------------------------
  const units = [...new Set(five.map((c) => c.unit))]
    .filter((u) => u !== "ZZZ" && five.filter((c) => c.unit === u).length >= 150);
  if (units.length >= 2) {
    const [uA, uB] = units.slice(0, 2);
    const pair = five.filter((c) => c.unit === uA || c.unit === uB);
    claims.push({
      id: "unit",
      question: `Do social units ${uA} and ${uB} differ in coda rhythm?`,
      plain:
        "Social units are stable groups of females and young within a clan. If rhythm " +
        "encoded identity below the clan level, units within one clan should separate too.",
      statistic: `Distance between unit mean rhythms (units ${uA} vs ${uB})`,
      prediction:
        "Stated in advance: weaker than the clan effect, and again largely explained by " +
        "which coda types each unit favours.",
      outcome: "see result",
      n: pair.length,
      nulls: [
        {
          id: "naive", kind: "distance", label: "Shuffle unit labels freely", controls: "nothing except group sizes",
          why: "Asks whether the units differ at all, by any route.",
          run: (seed, iterations) => permutationTest({
            items: pair, labels: pair.map((c) => c.unit), statistic: sepStat, iterations, seed,
          }),
        },
        {
          id: "stratified", kind: "distance", label: "Shuffle unit labels within each coda type",
          controls: "each unit's repertoire composition",
          why: "Asks whether they time the SAME coda types differently.",
          run: (seed, iterations) => permutationTest({
            items: pair, labels: pair.map((c) => c.unit), strata: pair.map((c) => c.type),
            statistic: sepStat, iterations, seed,
          }),
        },
      ],
      context: () => ({ [uA]: `${pair.filter((c) => c.unit === uA).length} codas`,
                        [uB]: `${pair.filter((c) => c.unit === uB).length} codas` }),
    });
  }

  // ---- 3. cross-domain: the whale/human comparison ------------------------
  if (comparanda) {
    const drums = comparanda.entries.filter((e) => e.tier === "measured" && e.npviSample.length >= 100);
    for (const d of drums.slice(0, 3)) {
      const whaleN = five.map((c) => c.npvi).filter(Number.isFinite);
      const humanN = d.npviSample;
      const items = [...whaleN.map((v) => ({ v })), ...humanN.map((v) => ({ v }))];
      const labels = [...whaleN.map(() => "whale"), ...humanN.map(() => "human")];
      claims.push({
        id: `xdomain-${d.name.replace(/\W+/g, "-")}`,
        question: `Are sperm whale codas more evenly timed than ${d.name}?`,
        plain:
          "nPVI measures how much adjacent intervals differ. Both sides are real " +
          "measurements — annotated coda ICIs and MIDI from human drummers — cut into " +
          "matched 4-interval windows and put through the identical pipeline.",
        statistic: "Difference in mean nPVI (durational contrast) — judge this one by effect size, not p",
        prediction:
          "Stated in advance: whale codas will be markedly MORE even. Codas cluster on " +
          "1:1 isochrony; drumming exploits durational contrast.",
        outcome: "confirmed",
        n: items.length,
        crossDomain: true,
        nulls: [
          {
            id: "naive", kind: "distance", label: "Shuffle domain labels",
            controls: "nothing except group sizes",
            why:
              "Both groups are pooled and relabelled at random. Be sceptical of the " +
              "p-value here: the two samples come from different species measured " +
              "through different pipelines, so they are not exchangeable under ANY " +
              "plausible null, and with thousands of windows a tiny p is guaranteed " +
              "before the data is even seen. It tells you the distributions differ, " +
              "which was never in doubt. The number that carries information is " +
              "Cohen's d in the table below — read that, not p.",
            run: (seed, iterations) => permutationTest({
              items, labels, iterations, seed,
              statistic: (A, B) => Math.abs(meanNpvi(A.map((x) => x.v)) - meanNpvi(B.map((x) => x.v))),
            }),
          },
        ],
        effect: () => cohensD(whaleN, humanN),
        // Read from humanN — the SAME array the permutation test and Cohen's d
        // use — not from the full-population npviMean. Mixing them printed a
        // context row of "whale 21.0 / rock 64.9" beside an observed statistic of
        // 39.56, and 64.9 - 21.0 = 43.9. A reader who subtracts the two numbers
        // the panel gave them must land on the number the panel reports.
        context: () => ({
          "whale mean nPVI": meanNpvi(whaleN).toFixed(1),
          [`${d.name} mean nPVI (sample)`]: meanNpvi(humanN).toFixed(1),
          "difference": Math.abs(meanNpvi(whaleN) - meanNpvi(humanN)).toFixed(2),
          [`${d.name} full-population mean`]: `${d.npviMean.toFixed(1)} (n=${d.n.toLocaleString()}; ` +
            `the test uses a ${humanN.length}-window random subsample of it)`,
        }),
      });
    }
  }

  // ---- 4. does ORDER carry information? -----------------------------------
  claims.push({
    id: "order",
    question: "Does the ORDER of intervals in a coda carry information?",
    plain:
      "A coda is a set of intervals in a particular sequence. If the sequence were " +
      "irrelevant, shuffling the intervals within each coda would leave its rhythm " +
      "statistics unchanged. nPVI is order-sensitive; CV is not.",
    statistic: "Mean nPVI across all 5-click codas",
    prediction:
      "Stated in advance: real codas will be markedly MORE even than their own shuffles, " +
      "because coda types place their long intervals in specific positions. Also " +
      "predicted: the pooled null will overstate that gap substantially, because it " +
      "destroys between-coda tempo variation as well as within-coda order.",
    outcome: "confirmed",
    n: five.length,
    surrogateBased: true,
    nulls: [
      {
        id: "within", kind: "shift",
        label: "Shuffle intervals within each coda",
        controls: "each coda's own interval multiset, count and duration",
        why:
          "The honest strong null. Each coda keeps its own four intervals and its " +
          "own total duration; only their ORDER is destroyed, and no interval ever " +
          "crosses a coda boundary. Whatever survives this is sequence structure " +
          "and nothing else.",
        run: (seed, iterations) => surrogateBlockTest({
          blocks: five.map((c) => c.ici), iterations, seed, surrogate: "shuffle",
          statistic: (bs) => {
            let s = 0, n = 0;
            for (const b of bs) { const v = npvi(b); if (Number.isFinite(v)) { s += v; n++; } }
            return n ? s / n : NaN;
          },
        }),
      },
      {
        id: "pooled", kind: "shift",
        label: "Shuffle intervals across ALL codas",
        controls: "only the global pool of intervals — coda boundaries are destroyed",
        why:
          "A deliberately WEAKER null, kept because the contrast is the lesson. " +
          "Pooling every interval and reshuffling does not just scramble order " +
          "inside a coda, it lets intervals migrate between codas and so wipes out " +
          "differences in tempo BETWEEN them as well. It therefore answers a much " +
          "easier question and makes the effect look far larger. Compare its null " +
          "mean against the within-coda null above: the gap is how much of the " +
          "'order effect' is really just between-coda tempo variation.",
        run: (seed, iterations) => surrogateTest({
          iois: five.flatMap((c) => c.ici), iterations, seed, surrogate: "shuffle",
          statistic: (flat) => {
            let s = 0, n = 0;
            for (let i = 0; i + 4 <= flat.length; i += 4) {
              const v = npvi(flat.slice(i, i + 4));
              if (Number.isFinite(v)) { s += v; n++; }
            }
            return n ? s / n : NaN;
          },
        }),
      },
      {
        id: "poisson", kind: "shift",
        label: "Replace with a Poisson process",
        controls: "click count and mean rate only",
        why:
          "The weakest null of the three: all timing structure is gone. It will " +
          "show an enormous effect, which is the point — a weak null makes any " +
          "signal look strong.",
        run: (seed, iterations) => surrogateBlockTest({
          blocks: five.map((c) => c.ici), iterations, seed, surrogate: "poisson",
          statistic: (bs) => {
            let s = 0, n = 0;
            for (const b of bs) { const v = npvi(b); if (Number.isFinite(v)) { s += v; n++; } }
            return n ? s / n : NaN;
          },
        }),
      },
    ],
    context: () => ({ "5-click codas": five.length }),
  });

  return claims;
}

/**
 * Turn a test result into language a non-statistician can act on, WITHOUT
 * overstating it. The wording is driven by explainedByNull, not by p — a tiny
 * p-value on an effect the null already reproduces is not a finding, and the
 * text has to say so.
 */
export function interpret(res) {
  const e = res.explainedByNull;
  const p = res.p ?? res.pGreater;
  const pStr = p <= 1 / (res.iterations + 1) ? `< ${(1 / (res.iterations + 1)).toFixed(4)}` : `= ${p.toFixed(4)}`;

  // A SHIFT statistic has no natural zero, so nullMean/observed is not a
  // proportion and must not be read as one. Here the finding is the direction
  // and size of the gap between observed and null, and a large gap BELOW the
  // null is as much a result as one above it.
  if (res.kind === "shift") {
    // A deterministic surrogate (isochronous) produces an identical value every
    // draw, so nullSd is 0 and z is NaN. Rendering "NaN standard deviations" is
    // worse than useless; say plainly that this null has no spread and therefore
    // supports no probabilistic statement at all.
    // Relative tolerance, not `> 0`. summarise() computes the mean by summation
    // before the variance pass, so a genuinely deterministic surrogate yields
    // nullSd ~1e-16 rather than exactly 0 — and `!(sd > 0)` then never fires,
    // producing "140111988407083.2 null standard deviations below it".
    const scale = Math.max(Math.abs(res.nullMean), Math.abs(res.observed), 1e-12);
    if (!(res.nullSd > 1e-9 * scale)) {
      return {
        level: "unclear",
        headline: "This null has no spread",
        body:
          `Every draw from this control gives exactly ${res.nullMean.toFixed(3)}, because the ` +
          `surrogate is deterministic. Observed is ${res.observed.toFixed(3)}. You can compare ` +
          `the two numbers, but there is no distribution here and so no p-value or z-score ` +
          `worth reporting — pick a stochastic null if you want an inferential statement.`,
      };
    }
    const below = res.direction === "below";
    const gap = Math.abs(res.observed - res.nullMean);
    const inRange = res.observed >= res.nullMin && res.observed <= res.nullMax;
    if (inRange && Math.abs(res.z) < 2) {
      return {
        level: "explained",
        headline: "Indistinguishable from the null",
        body:
          `The observed value (${res.observed.toFixed(2)}) sits inside the range this null ` +
          `produces on its own (${res.nullMin.toFixed(2)}–${res.nullMax.toFixed(2)}). ` +
          `There is nothing here the control does not already account for. p ${pStr}.`,
      };
    }
    return {
      level: "survives",
      headline: below
        ? "Far more regular than the null"
        : "Far more irregular than the null",
      body:
        `The observed value is ${res.observed.toFixed(2)} against a null mean of ` +
        `${res.nullMean.toFixed(2)} — a gap of ${gap.toFixed(2)}, or ${Math.abs(res.z).toFixed(1)} ` +
        `null standard deviations ${below ? "below" : "above"} it. ` +
        (below
          ? `The real data is markedly MORE evenly timed than this control can produce by chance. `
          : `The real data is markedly LESS evenly timed than this control. `) +
        `p ${pStr}.`,
    };
  }

  if (!Number.isFinite(e)) {
    return { level: "unclear", headline: "Cannot be interpreted",
      body: `The statistic is zero or undefined, so the ratio to the null is meaningless. p ${pStr}.` };
  }
  // A distance whose null mean EXCEEDS the observed value gives e > 1, and
  // "the null reproduces 703.4% of it, leaving -603.4%" is not a sentence about
  // anything. It means the observed separation is smaller than chance produces —
  // a real (if unusual) outcome that the proportion framing cannot express.
  // An exhaustively-enumerated test whose observed value sits in the body of the
  // distribution is not evidence of absence — especially when the design's
  // leverage is tiny. Saying "no effect" here would be the mirror of the
  // overclaiming this tool exists to prevent.
  if (res.exhaustive && res.rank && res.rank > 0.05 * res.distinctAssignments
      && res.rank < 0.95 * res.distinctAssignments) {
    return {
      level: "unclear",
      headline: "Cannot tell — this design has too little leverage",
      body:
        `The real split ranks ${res.rank} of ${res.distinctAssignments} possible assignments ` +
        `(exact p = ${res.p.toFixed(4)}), and it does not clear this design's resolution ` +
        `floor of ${(res.pResolutionLimit ?? 0).toFixed(4)}. That is NOT evidence the groups ` +
        `are the same — it means this design cannot distinguish them. ` +
        `All ${res.distinctAssignments} assignments were enumerated, so there is no sampling ` +
        `error and no seed. ` +
        `TREAT THE RANK ITSELF AS SOFT: the statistic is not perfectly calibrated across ` +
        `assignments with very different leverage, and three defensible choices of ` +
        `denominator place this split at rank 27, 59 and 66 of 66. What does NOT move is ` +
        `the conclusion — none of them clears the floor. Read the leverage figure in the ` +
        `claim header: ~33 codas of 6,038 carry the information.`,
    };
  }
  if (e > 1) {
    return {
      level: "explained",
      headline: "Smaller than the null produces by chance",
      body:
        `The control produces a larger value (${res.nullMean.toFixed(5)}) than the real data ` +
        `does (${res.observed.toFixed(5)}). The groups are less separated than random ` +
        `relabelling makes them, so there is no effect here in the expected direction. ` +
        `A "fraction explained" is not meaningful once the ratio exceeds 1, so it is not ` +
        `reported. p ${pStr}.`,
    };
  }
  if (e > 0.9) {
    // The residual can be small AND still lie outside the null's entire range.
    // Saying "not evidence of a real effect" when the observed value beat all
    // 2,000 draws contradicts the statistics printed directly beneath it. The
    // honest reading is "real but small", and the two must not be conflated.
    const outside = res.observed > res.nullMax;
    return {
      level: "explained",
      headline: outside
        ? "Real, but almost all of it is the null"
        : "This null already explains almost all of it",
      body:
        `The null reproduces ${(100 * e).toFixed(1)}% of the observed value on its own, ` +
        `leaving ${(100 * (1 - e)).toFixed(1)}%. ` +
        (outside
          ? `That residual is not noise — the observed value exceeds all ${res.iterations.toLocaleString()} ` +
            `null draws (z = ${res.z.toFixed(2)}), so something real survives. But it is ` +
            `${(100 * (1 - e)).toFixed(1)}% of the headline number, and a large sample makes ` +
            `even a trivial residual "significant". Judge it by that fraction, not by ${pStr}.`
          : `The observed value sits inside the range the null itself produces, so there is ` +
            `nothing here the control does not already account for. p ${pStr}.`),
    };
  }
  if (e > 0.5) {
    return {
      level: "mostly-explained",
      headline: "Most of this is explained by the null",
      body:
        `The null accounts for ${(100 * e).toFixed(1)}% of the observed value; ` +
        `${(100 * (1 - e)).toFixed(1)}% remains. There may be something real here, but the ` +
        `headline number badly overstates it. p ${pStr}.`,
    };
  }
  if (e > 0.15) {
    return {
      level: "partial",
      headline: "Part of this survives the null",
      body:
        `The null explains ${(100 * e).toFixed(1)}%, leaving ${(100 * (1 - e)).toFixed(1)}% ` +
        `unaccounted for. That residual is the part worth investigating. p ${pStr}.`,
    };
  }
  return {
    level: "survives",
    headline: "This survives the null",
    body:
      `The null reproduces only ${(100 * e).toFixed(1)}% of the observed value, so almost all ` +
      `of it is unexplained by the control. p ${pStr}, and the observed value sits ` +
      `${res.z.toFixed(1)} null standard deviations above the null mean.`,
  };
}
