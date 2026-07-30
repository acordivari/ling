// observatory.js — the Null Lab.
//
// One idea drives this whole screen: a statistic means nothing until you say
// what it is being compared against, and the comparison is usually where the
// answer actually comes from. So the null model is not a buried setting, it is
// the main control, and switching it visibly rewrites the conclusion.
//
// The predict-before-reveal step is not a game mechanic bolted on. Committing to
// an expectation before seeing the answer IS pre-registration, which is the
// habit this repo already holds itself to in prose. Making it an interaction
// means the tool rewards the process rather than the outcome — you cannot score
// well by finding a big effect, only by having understood what the null would do.

import { decodeCorpus, buildClaims, interpret } from "./claims.js";
import { fdr } from "./rhythm.js";

const $ = (id) => document.getElementById(id);
const fmt = (v, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : "—");

const state = {
  codas: null, comparanda: null, claims: [],
  claim: null, nullId: null,
  prediction: null,     // user's guess, 0..1 along the axis
  revealed: false,
  result: null,
  iterations: 2000,
  seed: 1,
  history: [],          // {claimId, nullId, predicted, actual, band}
  tests: [],            // every distinct test run this session, for FDR
};

// ------------------------------------------------------------------ loading

async function load() {
  const status = $("loadStatus");
  try {
    // no-cache, deliberately. The corpus is a build artifact: re-running
    // tools/fetch_corpus.py with changed cleaning rules must change what this
    // page analyses. With the default HTTP cache the browser happily serves the
    // previous corpus after a regeneration — and silently analysing stale data
    // is the worst failure mode a tool like this can have.
    const opts = { cache: "no-cache" };
    const [corpusRes, compRes] = await Promise.all([
      fetch("data/coda-corpus.json", opts),
      fetch("data/comparanda.json", opts).catch(() => null),
    ]);
    if (!corpusRes.ok) throw new Error(`corpus HTTP ${corpusRes.status}`);
    const corpus = await corpusRes.json();
    state.corpusMeta = corpus;
    state.codas = decodeCorpus(corpus);
    state.comparanda = compRes && compRes.ok ? await compRes.json() : null;
    state.claims = buildClaims(state.codas, state.comparanda);
    status.remove();
    $("app").hidden = false;
    renderProvenance();
    renderLadder();
    renderClaimList();
    selectClaim(state.claims[0]);
  } catch (err) {
    status.innerHTML =
      `<h2>No corpus loaded</h2>
       <p>This page analyses real measured sperm whale codas. They are not committed to the
       repository — the data deposit carries no licence file, so it is fetched on demand.</p>
       <pre>python3 tools/fetch_corpus.py
python3 tools/fetch_comparanda.py</pre>
       <p>Then reload. Serve over HTTP, not <code>file://</code> — this page uses ES modules and fetch.</p>
       <p class="dim">Underlying error: ${String(err.message || err)}</p>`;
  }
}

function renderProvenance() {
  const m = state.corpusMeta;
  const c = m.cleaning;
  $("provText").innerHTML =
    `<strong>${c.kept.toLocaleString()} real codas</strong> from ${c.input_rows.toLocaleString()} annotated rows
     (${Object.entries(c.dropped).map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`).join(", ")} removed).
     ${m.source.paper}. Measured inter-click intervals, not synthesis.
     <span class="warn-inline">${m.caveats.single_clan_caveat}</span>`;
}

// -------------------------------------------------------- cross-domain ladder

function renderLadder() {
  const el = $("ladder");
  if (!state.comparanda) {
    el.innerHTML = `<p class="dim">Comparison sources not loaded — run <code>python3 tools/fetch_comparanda.py</code>.</p>`;
    return;
  }
  const five = state.codas.filter((c) => c.nClicks === 5);
  const whaleNpvi = five.map((c) => c.npvi).filter(Number.isFinite);
  const whaleMean = whaleNpvi.reduce((s, v) => s + v, 0) / whaleNpvi.length;

  const byType = {};
  for (const c of five) {
    if (!Number.isFinite(c.npvi)) continue;
    (byType[c.type] ||= []).push(c.npvi);
  }
  const rows = [
    ...Object.entries(byType).filter(([, v]) => v.length >= 200)
      .map(([t, v]) => ({ name: `sperm whale · ${t}`, tier: "whale",
        mean: v.reduce((s, x) => s + x, 0) / v.length, n: v.length })),
    { name: "sperm whale · all 5-click", tier: "whale-all", mean: whaleMean, n: whaleNpvi.length },
    ...state.comparanda.entries.map((e) => ({ name: e.name, tier: e.tier, mean: e.npviMean, n: e.n, note: e.note })),
  ].sort((a, b) => a.mean - b.mean);

  const max = 110;
  el.innerHTML = rows.map((r) => {
    const pct = Math.min(100, (r.mean / max) * 100);
    return `<div class="lad-row tier-${r.tier}">
      <div class="lad-name" title="${r.note ? r.note.replace(/"/g, "&quot;") : ""}">${r.name}
        <span class="lad-tier">${r.tier === "whale" || r.tier === "whale-all" ? "measured" : r.tier}</span></div>
      <div class="lad-track"><div class="lad-bar" style="width:${pct}%"></div>
        <span class="lad-val">${r.mean.toFixed(1)}</span></div>
      <div class="lad-n">n=${r.n.toLocaleString()}</div>
    </div>`;
  }).join("");
}

// ------------------------------------------------------------------- claims

function renderClaimList() {
  $("claimList").innerHTML = state.claims.map((c, i) =>
    `<button class="claim-btn" data-i="${i}" aria-pressed="false">
       <span class="claim-q">${c.question}</span>
       <span class="claim-n">n = ${c.n.toLocaleString()}</span>
     </button>`).join("");
  $("claimList").querySelectorAll(".claim-btn").forEach((b) => {
    b.addEventListener("click", () => selectClaim(state.claims[+b.dataset.i]));
  });
}

function selectClaim(claim) {
  state.claim = claim;
  state.nullId = claim.nulls[0].id;
  state.prediction = null;
  state.revealed = false;
  state.result = null;

  $("claimList").querySelectorAll(".claim-btn").forEach((b, i) => {
    const on = state.claims[i] === claim;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  });

  $("qTitle").textContent = claim.question;
  $("qPlain").textContent = claim.plain;
  $("qStat").textContent = claim.statistic;
  $("qPred").textContent = claim.prediction;

  const ctx = claim.context ? claim.context() : {};
  $("qContext").innerHTML = Object.entries(ctx)
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");

  $("nullTabs").innerHTML = claim.nulls.map((n) =>
    `<button class="null-tab" data-id="${n.id}" aria-pressed="false">
       <span class="nt-label">${n.label}</span>
       <span class="nt-controls">controls for: ${n.controls}</span>
     </button>`).join("");
  $("nullTabs").querySelectorAll(".null-tab").forEach((b) => {
    b.addEventListener("click", () => selectNull(b.dataset.id));
  });
  selectNull(state.nullId);
}

function selectNull(id) {
  state.nullId = id;
  state.revealed = false;
  state.result = null;
  state.prediction = null;
  const n = state.claim.nulls.find((x) => x.id === id);
  $("nullTabs").querySelectorAll(".null-tab").forEach((b) => {
    const on = b.dataset.id === id;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  });
  $("nullWhy").textContent = n.why;
  showPredictStep();
}

// ------------------------------------------------- predict, then reveal

function showPredictStep() {
  $("predictStep").hidden = false;
  $("resultStep").hidden = true;
  initPredictButtons();
  $("revealBtn").disabled = true;
  $("predictHint").textContent =
    "Commit to an expectation before you look. This is the same discipline as writing " +
    "down a control condition before running — and it is the only part of this screen " +
    "you can get right or wrong through understanding rather than luck.";
}

// Two different questions, because there are two kinds of statistic.
//
// DISTANCE statistics (centroid separation, |mean difference|) are zero when
// there is no effect, so the meaningful question is "how much of the observed
// value does the null already reproduce?".
//
// SHIFT statistics (mean nPVI) have no such zero — the null sits at ~62, not 0 —
// so that question is meaningless and the real one is "which side of the null
// does the real data fall on, and by how much?". Asking the distance question
// about a shift is exactly the bug this tool exists to make visible, so the UI
// must not ask it.
const BANDS_DISTANCE = [
  { id: "explained", label: "The null explains almost all of it", hint: ">90% reproduced by the null", lo: 0.9, hi: Infinity },
  { id: "mostly-explained", label: "The null explains most of it", hint: "50-90% reproduced", lo: 0.5, hi: 0.9 },
  { id: "partial", label: "The null explains some of it", hint: "15-50% reproduced", lo: 0.15, hi: 0.5 },
  { id: "survives", label: "It survives the null almost intact", hint: "<15% reproduced", lo: -Infinity, hi: 0.15 },
];

const BANDS_SHIFT = [
  { id: "below", label: "Real data far MORE regular than the null", hint: "observed well below the null mean" },
  { id: "inside", label: "Indistinguishable from the null", hint: "observed inside the null's own range" },
  { id: "above", label: "Real data far MORE irregular than the null", hint: "observed well above the null mean" },
];

function bandsFor(claim) {
  const n = claim.nulls.find((x) => x.id === state.nullId);
  return n && n.kind === "shift" ? BANDS_SHIFT : BANDS_DISTANCE;
}

function bandFor(res) {
  if (res.kind === "shift") {
    const inRange = res.observed >= res.nullMin && res.observed <= res.nullMax;
    if (inRange && Math.abs(res.z) < 2) return BANDS_SHIFT.find((b) => b.id === "inside");
    return BANDS_SHIFT.find((b) => b.id === (res.direction === "below" ? "below" : "above"));
  }
  const e = res.explainedByNull;
  return BANDS_DISTANCE.find((b) => e >= b.lo && e < b.hi) || BANDS_DISTANCE[BANDS_DISTANCE.length - 1];
}

function initPredictButtons() {
  const bands = bandsFor(state.claim);
  $("predictChoice").innerHTML = bands.map((b) =>
    `<button data-band="${b.id}" aria-pressed="false"><strong>${b.label}</strong><span>${b.hint}</span></button>`).join("");
  $("predictChoice").querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.prediction = btn.dataset.band;
      $("predictChoice").querySelectorAll("button").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", String(on));
      });
      $("revealBtn").disabled = false;
    });
  });
}

function reveal() {
  const n = state.claim.nulls.find((x) => x.id === state.nullId);
  $("revealBtn").disabled = true;
  $("revealBtn").textContent = "running…";

  // Run in slices, yielding to the browser between each.
  //
  // 10,000 permutations over 6,105 codas is ~2.1 s of straight-line work, and a
  // synchronous loop that long freezes the page — no scrolling, no cancelling,
  // and on some browsers a "page unresponsive" prompt. Permutation draws are
  // i.i.d., so N slices of M draws with deterministically derived seeds are
  // statistically identical to one run of N*M, and the null distributions pool
  // by concatenation. Determinism is preserved: the same base seed yields the
  // same derived seeds and therefore the same pooled null.
  const SLICE = 2000;
  (async () => {
    const t0 = performance.now();
    const slices = Math.max(1, Math.ceil(state.iterations / SLICE));
    const parts = [];
    for (let k = 0; k < slices; k++) {
      const iters = Math.min(SLICE, state.iterations - k * SLICE);
      // yield first so the label paints, then again between slices
      await new Promise((r) => setTimeout(r, 0));
      $("revealBtn").textContent = slices > 1 ? `running… ${k + 1}/${slices}` : "running…";
      parts.push(n.run(state.seed + k, iters));
    }
    const res = parts.length === 1 ? parts[0] : poolResults(parts, state.iterations);
    const ms = performance.now() - t0;
    state.result = res;
    state.revealed = true;

    const actualBand = bandFor(res);
    const correct = state.prediction === actualBand.id;
    // Every reveal is a hypothesis test. Key by claim+null so re-running the
    // same test with a different seed replaces rather than accumulates — otherwise
    // a user could inflate their own test count just by pressing the button again.
    const key = `${state.claim.id}::${state.nullId}`;
    const prior = state.tests.findIndex((t) => t.key === key);
    // Record the iteration count this test actually ran at. Reading the live
    // dropdown later would render a p of 0.0001 as "<0.0050" simply because the
    // user lowered the selector afterwards.
    const entry = { key, claim: state.claim.question, nullId: state.nullId,
                    p: res.p ?? res.pGreater, iterations: res.iterations,
                    floor: res.pResolutionLimit ?? 1 / (res.iterations + 1) };
    if (prior >= 0) state.tests[prior] = entry; else state.tests.push(entry);

    state.history.push({
      claim: state.claim.question, nullId: state.nullId,
      predicted: state.prediction, actual: actualBand.id, correct,
    });

    // Unhide BEFORE rendering. A canvas inside a `hidden` container reports
    // clientWidth 0, so sizing it there produces a 0-wide bitmap and the plot
    // silently comes out blank — everything else on the page looks fine, which
    // is what makes it easy to miss.
    $("predictStep").hidden = true;
    $("resultStep").hidden = false;

    renderResult(res, actualBand, correct, ms);
    $("revealBtn").textContent = "Reveal the result";
    $("resultStep").focus();
  })();
}

/**
 * Concatenate the null distributions of independent slices and recompute the
 * summary over the pooled draws. Every slice shares the same observed statistic
 * (it does not depend on the shuffling), so only the null side pools.
 */
function poolResults(parts) {
  const first = parts[0];
  const all = new Float64Array(parts.reduce((n, p) => n + p.nullDist.length, 0));
  let o = 0;
  for (const p of parts) { all.set(p.nullDist, o); o += p.nullDist.length; }
  all.sort();
  const N = all.length;
  let mean = 0;
  for (let i = 0; i < N; i++) mean += all[i];
  mean /= N;
  let v = 0;
  for (let i = 0; i < N; i++) { const d = all[i] - mean; v += d * d; }
  const sd = Math.sqrt(v / N);
  let ge = 0, le = 0;
  for (let i = 0; i < N; i++) { if (all[i] >= first.observed) ge++; if (all[i] <= first.observed) le++; }
  const pGreater = (ge + 1) / (N + 1), pLess = (le + 1) / (N + 1);
  // A clustered test's p is bounded by the number of distinct cluster assignments,
  // not by how many shuffles were run. Pooling slices rebuilds p from the pooled
  // draws and would quietly restore precision the design does not have — the app
  // reported p = 0.0030 at 10,000 permutations for a design whose exact minimum is
  // 0.0152. Re-apply the floor after pooling.
  const floor = first.pResolutionLimit;
  const applyFloor = (v) => (floor ? Math.max(v, floor) : v);
  return {
    ...first,
    nullDist: all, iterations: N,
    nullMean: mean, nullSd: sd, nullMin: all[0], nullMax: all[N - 1],
    nullQuantile: (q) => all[Math.min(N - 1, Math.max(0, Math.floor(q * N)))],
    pGreater, pLess,
    p: applyFloor(first.kind === "distance" ? pGreater : Math.min(1, 2 * Math.min(pGreater, pLess))),
    z: sd > 0 ? (first.observed - mean) / sd : NaN,
    direction: first.observed >= mean ? "above" : "below",
    residual: first.observed - mean,
    explainedByNull: first.kind === "distance" && first.observed !== 0 ? mean / first.observed : null,
    residualFraction: first.kind === "distance" && first.observed !== 0 ? (first.observed - mean) / first.observed : null,
  };
}

function renderResult(res, actualBand, correct, ms) {
  const interp = interpret(res);

  // Name the null in the verdict. Claim 4's three nulls produced a byte-identical
  // headline ("Far more regular than the null") because the wording never said
  // WHICH null — so the page's core promise, that switching the control rewrites
  // the conclusion, was not visible in the one element that states the conclusion.
  const nullSpec = state.claim.nulls.find((x) => x.id === state.nullId);
  $("verdictBox").className = `verdict level-${interp.level}`;
  $("verdictHead").textContent = interp.headline;
  // Use the null's OWN `controls` string, never the surrogate registry's generic
  // one. The pooled null is a global shuffle, but SURROGATES.shuffle describes
  // itself as "everything except the ORDER of the intervals" — true for a single
  // sequence, false once it is applied to a pooled corpus. That generic string
  // leaking into the verdict is the same mislabel the block-test fix removed.
  $("verdictNull").textContent = `against: ${nullSpec.label.toLowerCase()} — controls for ${nullSpec.controls}`;
  $("verdictBody").textContent = interp.body;

  const predBand = [...BANDS_DISTANCE, ...BANDS_SHIFT].find((b) => b.id === state.prediction);
  $("predictFeedback").className = `pred-feedback ${correct ? "hit" : "miss"}`;
  $("predictFeedback").innerHTML = correct
    ? `<strong>You called it.</strong> You expected “${predBand.label.toLowerCase()}”, and that is what the null did.
       Predicting the behaviour of a null model is the skill this screen is actually for.`
    : `<strong>Not what you expected.</strong> You predicted “${predBand.label.toLowerCase()}”; the null in fact
       ${actualBand.label.toLowerCase().replace(/^the null /, "")}.
       That gap is the useful part — it is where your model of the data was wrong, which is
       the only place learning can happen. Try the other null and see whether the surprise persists.`;

  const rows = [
    ["Observed statistic", fmt(res.observed, 5), "what the real data gives"],
    ["Null mean", fmt(res.nullMean, 5), "what the control produces on its own"],
    res.explainedByNull === null
      ? ["Direction", `${res.direction} the null`,
         "this statistic has no natural zero, so a 'fraction explained' would be meaningless"]
      : res.explainedByNull > 1
      ? ["Explained by null", "n/a",
         "the null produces a LARGER value than the real data, so there is no fraction to " +
         "report — a percentage above 100% would be meaningless here"]
      : ["Explained by null", `${(100 * res.explainedByNull).toFixed(1)}%`,
         res.clustered
           ? "this null controls for non-independence but NOT repertoire composition — " +
             "not comparable with the stratified null's figure"
           : (res.stratified
               ? "this null controls for repertoire composition but NOT non-independence — " +
                 "not comparable with the cluster null's figure"
               : "how much of the observed value this control already produces")],
    ["Residual", fmt(res.residual, 5), "observed minus null mean"],
    ["p",
      res.p <= (res.pResolutionLimit ?? 1 / (res.iterations + 1))
        ? `< ${(res.pResolutionLimit ?? 1 / (res.iterations + 1)).toFixed(4)}`
        : fmt(res.p, 4),
      res.pResolutionLimit
        ? `only ${res.distinctAssignments} distinct cluster assignments exist, so this cannot ` +
          `resolve below ${res.pResolutionLimit.toFixed(4)} however many shuffles run`
        : `${res.iterations.toLocaleString()} shuffles; cannot resolve below 1/${res.iterations + 1}`],
    res.distinctAssignments && res.distinctAssignments <= 500
      ? ["rank",
         // Use res.rank — the exact value from enumeration — and state the
         // convention. This row and the verdict text used to compute the rank
         // independently with OPPOSITE conventions, printing "40 of 66" here and
         // "27 of 66" two lines below for the same position.
         `${res.rank} of ${res.distinctAssignments} (ascending)`,
         "position among all possible cluster assignments, counting UP from the smallest: " +
         "1 = least separated, N = most. A z-score off this few discrete outcomes is not " +
         "an interpretable standardised deviate"]
      : ["z", fmt(res.z, 2), "null SDs above the null mean — inflates with sample size"],
  ];
  if (state.claim.effect) rows.push(["Cohen's d", fmt(state.claim.effect(), 2), "standardised effect size"]);
  $("statTable").innerHTML = rows.map(([k, v, note]) =>
    `<tr><th>${k}</th><td class="num">${v}</td><td class="note">${note}</td></tr>`).join("");

  $("runNote").textContent =
    `${res.iterations.toLocaleString()} permutations in ${ms.toFixed(0)} ms · seed ${res.seed} · ` +
    `${res.clustered ? `clustered by ${res.clusterCount} groups` : (res.stratified ? "stratified" : "unstratified")} · ` +
    `rerunning with this seed gives the identical p`;

  drawNull(res);
  renderMultiplicity();
  renderHistory();
}

// Multiple comparisons, made visible rather than mentioned in a footnote.
//
// The app offers 4 claims x 2+ nulls. A user who works through them is running
// a dozen tests and reading a dozen p-values, and nothing in a single p-value
// knows that. So the running set of tests is tracked and Benjamini-Hochberg
// q-values are shown alongside, updating as more are run.
//
// Honest caveat, stated in the UI too: BH assumes independent or positively
// dependent tests. Several of these run on the SAME codas with different nulls,
// so they are strongly dependent and BH is not exactly right here. It is
// reported as an indication of the multiplicity cost, not as a certified
// correction — which is still far better than showing raw p-values alone.
function renderMultiplicity() {
  const box = $("multiplicityBox");
  if (state.tests.length < 2) { box.hidden = true; return; }
  box.hidden = false;
  const qs = fdr(state.tests.map((t) => t.p));
  $("multiplicityNote").textContent =
    `You have run ${state.tests.length} distinct tests this session. A p-value does not ` +
    `know how many others were run alongside it. Benjamini-Hochberg q-values below.`;
  $("multiplicityList").innerHTML = state.tests.map((t, i) => {
    const pStr = t.p <= t.floor ? `<${t.floor.toFixed(4)}` : t.p.toFixed(4);
    const qStr = qs[i] <= t.floor ? `<${t.floor.toFixed(4)}` : qs[i].toFixed(4);
    return `<tr><td>${t.claim} <em>(${t.nullId})</em></td>
      <td class="num">${pStr}</td><td class="num">${qStr}</td></tr>`;
  }).join("");
}

// --------------------------------------------------------------- null plot

function drawNull(res) {
  const canvas = $("nullPlot");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = 220;
  // Fail loudly rather than rendering an empty box. A zero-width canvas means
  // this ran while an ancestor was still `hidden`, and a blank plot next to a
  // full statistics table reads as "there was nothing to show" — the most
  // misleading possible failure for this particular tool.
  if (!w) {
    $("plotCaption").textContent =
      "Plot could not be drawn: the canvas had zero width when rendered. The numbers below are still valid.";
    return;
  }
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.height = h + "px";
  const g = canvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);

  const dist = res.nullDist;
  const lo = Math.min(dist[0], res.observed);
  const hi = Math.max(dist[dist.length - 1], res.observed);
  const pad = (hi - lo) * 0.08 || 1;
  const min = lo - pad, max = hi + pad;
  const x = (v) => ((v - min) / (max - min)) * (w - 60) + 40;

  const BINS = 60;
  const counts = new Array(BINS).fill(0);
  for (let i = 0; i < dist.length; i++) {
    const b = Math.min(BINS - 1, Math.floor(((dist[i] - min) / (max - min)) * BINS));
    counts[b]++;
  }
  const peak = Math.max(...counts);
  const base = h - 34;

  // null distribution
  g.fillStyle = "#2b3446";
  for (let b = 0; b < BINS; b++) {
    const bw = (w - 60) / BINS;
    const bh = (counts[b] / peak) * (base - 24);
    g.fillRect(40 + b * bw, base - bh, Math.max(1, bw - 1), bh);
  }

  // null mean
  const mx = x(res.nullMean);
  g.strokeStyle = "#8b97a8"; g.lineWidth = 1; g.setLineDash([4, 4]);
  g.beginPath(); g.moveTo(mx, 18); g.lineTo(mx, base); g.stroke();
  g.setLineDash([]);
  g.fillStyle = "#8b97a8"; g.font = "11px ui-monospace, monospace"; g.textAlign = "center";
  g.fillText("null mean", mx, 13);

  // observed — marked with a triangle as well as colour, so the plot still
  // reads without colour vision
  const ox = x(res.observed);
  g.strokeStyle = "#38bdf8"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(ox, 18); g.lineTo(ox, base); g.stroke();
  g.fillStyle = "#38bdf8";
  g.beginPath(); g.moveTo(ox, base + 2); g.lineTo(ox - 6, base + 12); g.lineTo(ox + 6, base + 12); g.closePath(); g.fill();
  g.fillText("observed", ox, 13);

  // axis
  g.strokeStyle = "#232b38"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(40, base); g.lineTo(w - 20, base); g.stroke();
  // Same AA fix as css/observatory.css --faint. #5c6675 measures 3.23:1 on the
  // plot background (#0d1219), below the 4.5:1 floor for 11px text. The CSS
  // custom property cannot reach a canvas fillStyle, so the value is repeated
  // here deliberately — keep the two in step.
  g.fillStyle = "#7d8998"; g.textAlign = "left";
  g.fillText(min.toPrecision(3), 40, h - 12);
  g.textAlign = "right";
  g.fillText(max.toPrecision(3), w - 20, h - 12);

  $("plotCaption").textContent =
    `Grey: ${res.iterations.toLocaleString()} values the statistic takes when the null is true. ` +
    `Blue triangle: the real data. The distance between the dashed null mean and the blue line ` +
    `is the only part of the observed value the null does not already account for.`;
}

// --------------------------------------------------------------- history

function renderHistory() {
  const h = state.history;
  if (!h.length) return;
  const hits = h.filter((x) => x.correct).length;
  $("historyBox").hidden = false;
  $("historyScore").textContent = `${hits} of ${h.length} predictions matched`;
  $("historyNote").textContent = hits === h.length
    ? "Your model of these nulls is holding up. Try a claim you have not seen yet."
    : "Mismatches are the informative ones — each marks a place the null did something you did not expect.";
  $("historyList").innerHTML = h.slice(-6).reverse().map((x) =>
    `<li class="${x.correct ? "hit" : "miss"}"><span class="hm">${x.correct ? "✓" : "→"}</span>
      ${x.claim} <em>(${x.nullId})</em></li>`).join("");
}

// ------------------------------------------------------------------- wiring

$("revealBtn").addEventListener("click", reveal);
$("iterSel").addEventListener("change", (e) => {
  state.iterations = +e.target.value;
  if (state.revealed) showPredictStep();
});
$("seedInput").addEventListener("change", (e) => {
  state.seed = +e.target.value || 1;
  if (state.revealed) showPredictStep();
});
window.addEventListener("resize", () => { if (state.result) drawNull(state.result); });

load();
