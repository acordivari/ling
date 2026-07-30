// Observatory wiring tests. Run with:  node test/observatory.test.mjs
//
// There is no browser here, so this cannot test rendering. What it CAN test is
// everything that silently half-works in a browser: a claim whose statistic
// throws, an HTML file referencing a script that does not exist, an element id
// the JS reaches for that the markup never defines. All three fail quietly at
// runtime — the page just renders blank — so they are worth catching here.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { decodeCorpus, buildClaims, interpret } from "../js/claims.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

let fails = 0;
let asserts = 0;
const skipped = [];
const ok = (c, m, extra = "") => {
  asserts++;
  console.log(`${c ? "  ok  " : " FAIL "} ${m}${extra ? "  " + extra : ""}`);
  if (!c) fails++;
};
const skip = (why) => { skipped.push(why); console.log(`  skip  ${why}`); };
const near = (a, b, tol = 1e-9) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

// ------------------------------------------------- markup / module wiring
console.log("\n== observatory.html wiring ==");
const html = readFileSync(join(root, "observatory.html"), "utf8");

for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const ref = m[1];
  if (/^https?:|^#|^mailto:/.test(ref)) continue;
  ok(existsSync(join(root, ref)), `referenced file exists: ${ref}`);
}

// Every getElementById the module reaches for must exist in the markup, or the
// page dies on load with a null dereference.
const js = readFileSync(join(root, "js/observatory.js"), "utf8");
const ids = new Set([...js.matchAll(/\$\("([^"]+)"\)/g)].map((m) => m[1]));
const missing = [...ids].filter((id) => !new RegExp(`id="${id}"`).test(html));
ok(missing.length === 0, `every element id used by observatory.js exists in the markup`,
  missing.length ? `missing: ${missing.join(", ")}` : `${ids.size} ids checked`);

// The reverse direction is only a warning: extra ids are harmless.
ok(!/\bdocument\.write\b/.test(js), "no document.write");
ok(!/<script[^>]*src="https?:/.test(html), "no external script tags — offline by construction");
ok(!/@import\s+url\(https?:/.test(readFileSync(join(root, "css/observatory.css"), "utf8")),
  "no remote CSS imports");

// ------------------------------------------------------------- claims logic
console.log("\n== claims over the real corpus ==");
const corpusPath = join(root, "data/coda-corpus.json");
if (!existsSync(corpusPath)) {
  skip("all claim tests: run `python3 tools/fetch_corpus.py` to enable them");
} else {
  const corpus = JSON.parse(readFileSync(corpusPath, "utf8"));
  const codas = decodeCorpus(corpus);
  ok(codas.length > 8000, "corpus decodes", `${codas.length} codas`);
  ok(codas.every((c) => c.ici.length === c.nClicks - 1), "every coda has nClicks-1 intervals");
  ok(codas.every((c) => c.std.length === c.ici.length), "standardised vector matches length");
  ok(codas.every((c) => Math.abs(c.std.reduce((s, v) => s + v, 0) - 1) < 1e-9),
    "every standardised vector sums to 1");
  ok(codas.every((c) => c.ici.every((v) => v >= 0.01)),
    "no interval sits inside the intra-click IPI band");

  const compPath = join(root, "data/comparanda.json");
  const comparanda = existsSync(compPath) ? JSON.parse(readFileSync(compPath, "utf8")) : null;
  ok(!!comparanda, "comparanda present", comparanda ? `${comparanda.entries.length} sources` : "run fetch_comparanda.py");

  const claims = buildClaims(codas, comparanda);
  ok(claims.length >= 3, "claims built", `${claims.length}`);

  for (const claim of claims) {
    ok(!!claim.question && !!claim.plain && !!claim.statistic && !!claim.prediction,
      `${claim.id}: has question, plain text, statistic and a pre-registered prediction`);
    ok(claim.nulls.length >= 1, `${claim.id}: has at least one null`);
    for (const n of claim.nulls) {
      ok(!!n.label && !!n.controls && !!n.why,
        `${claim.id}/${n.id}: null declares what it controls for`);
    }
  }

  // Actually run every claim under every null. Small iteration count — this is
  // checking that nothing throws and the outputs are well-formed, not the science.
  console.log("\n== every claim x every null actually runs ==");
  for (const claim of claims) {
    for (const n of claim.nulls) {
      let res = null, err = null;
      try { res = n.run(1, 200); } catch (e) { err = e; }
      // Deliberately NOT printing elapsed time. Wall-clock in test output makes
      // the suite's stdout differ on every run, which destroys the ability to
      // diff two runs to see whether anything actually changed — the whole
      // point of making the suite deterministic in the first place.
      ok(!err, `${claim.id}/${n.id}: runs without throwing`, err ? String(err.message) : "");
      if (!res) continue;
      ok(Number.isFinite(res.observed), `${claim.id}/${n.id}: observed is finite`, `${res.observed}`);
      ok(Number.isFinite(res.nullMean), `${claim.id}/${n.id}: null mean is finite`);
      const p = res.p ?? res.pGreater;
      ok(p > 0 && p <= 1, `${claim.id}/${n.id}: p in (0,1]`, `p=${p}`);
      ok(p >= 1 / 201 - 1e-12, `${claim.id}/${n.id}: p respects the resolution floor`);
      const i = interpret(res);
      ok(!!i.headline && !!i.body, `${claim.id}/${n.id}: interpretable`, i.headline);
    }
  }

  // The centrepiece must actually behave as advertised, on real data.
  console.log("\n== the clan claim behaves as documented ==");
  const clan = claims.find((c) => c.id === "clan");
  ok(!!clan, "clan claim exists");
  if (clan) {
    const naive = clan.nulls.find((n) => n.id === "naive").run(1, 1000);
    const strat = clan.nulls.find((n) => n.id === "stratified").run(1, 1000);
    ok(Math.abs(naive.observed - strat.observed) < 1e-12,
      "both nulls describe the same observed statistic", `${naive.observed.toFixed(5)}`);
    ok(naive.explainedByNull < 0.1,
      "naive null explains almost none of the clan separation",
      `${(100 * naive.explainedByNull).toFixed(1)}%`);
    ok(strat.explainedByNull > 0.95,
      "stratified null explains >95% — the confound the tool exists to expose",
      `${(100 * strat.explainedByNull).toFixed(1)}%`);
    ok(interpret(naive).level === "survives" && interpret(strat).level === "explained",
      "the two nulls produce OPPOSITE verdicts from identical data",
      `${interpret(naive).level} vs ${interpret(strat).level}`);
  }

  console.log("\n== the joint null: the decisive test, and an UNDERPOWERED result ==");
  {
    const clanClaim = claims.find((c) => c.id === "clan");
    const joint = clanClaim.nulls.find((n) => n.id === "joint");
    ok(!!joint, "the clan claim has a null controlling BOTH confounds at once");
    if (joint) {
      const r = joint.run(1, 1);
      ok(r.exhaustive === true,
        "all 66 assignments are enumerated exactly — no sampling, no seed");
      ok(r.distinctAssignments === 66 && r.clusterCount === 12,
        "over the 12 real social units, ZZZ excluded", `${r.clusterCount} units, ${r.distinctAssignments} assignments`);
      ok(near(r.p, 40 / 66, 1e-12),
        "exact p is an achievable value k/66, not a Monte Carlo estimate", `${r.p.toFixed(6)}`);
      ok(r.rank === 27, "the real split ranks 27 of 66 — the middle of the distribution", `${r.rank}`);

      // Seed-invariance: an enumerated result must not depend on an RNG at all.
      const r2 = joint.run(999, 1);
      ok(r.p === r2.p && r.rank === r2.rank,
        "a different seed gives the identical exact result");

      // The verdict must be "cannot tell", NOT "no effect". A mid-distribution
      // rank on a design with 33 codas of leverage is absence of evidence.
      const i = interpret(r);
      ok(i.headline === "Cannot tell — this design has too little leverage",
        "reported as underpowered, not as a null result", i.headline);
      ok(i.body.includes("NOT evidence"),
        "and it says explicitly that this is not evidence of sameness");
    }

    // The ZZZ sentinel must never be counted as a social unit.
    const byUnit = clanClaim.nulls.find((n) => n.id === "byUnit").run(1, 500);
    ok(byUnit.clusterCount === 12,
      "the cluster null uses 12 units, not 13 — ZZZ is a sentinel, not a unit",
      `${byUnit.clusterCount}`);
    ok(byUnit.distinctAssignments === 66,
      "so the design space is C(12,2) = 66, not C(13,3) = 286",
      `${byUnit.distinctAssignments}`);
  }

  {
    // Leverage must be surfaced: the whole reason the joint test cannot answer
    // the question is that only the crossover cells carry information.
    const clanClaim = claims.find((c) => c.id === "clan");
    const ctx = clanClaim.context();
    const lev = Object.keys(ctx).find((k) => k.includes("leverage"));
    ok(!!lev, "the claim reports its within-type leverage", lev);
    ok(/33\.\d codas of 6,038/.test(ctx[lev] || ""),
      "and states it as 33.3 codas out of 6,038", ctx[lev]);
    ok(Object.keys(ctx).some((k) => k.includes("detectable")),
      "and states the smallest detectable effect");
  }

  console.log("\n== cross-domain numbers must reconcile on screen ==");
  for (const c of claims.filter((x) => x.id.startsWith("xdomain"))) {
    const ctx = c.context();
    const diff = parseFloat(ctx["difference"]);
    const r = c.nulls[0].run(1, 200);
    ok(Math.abs(diff - r.observed) < 0.01,
      `${c.id}: the difference shown in context equals the observed statistic`,
      `${diff.toFixed(2)} vs ${r.observed.toFixed(2)}`);
  }

  console.log("\n== reproducibility ==");
  const c0 = claims[0].nulls[0];
  const r1 = c0.run(7, 300), r2 = c0.run(7, 300), r3 = c0.run(8, 300);
  ok((r1.p ?? r1.pGreater) === (r2.p ?? r2.pGreater) && r1.nullMean === r2.nullMean,
    "same seed reproduces the identical result");
  ok(r3.nullMean !== r1.nullMean, "a different seed draws a different null");
}

// Report the assertion count and any skipped block. A suite that prints
// ALL PASS while silently running 92 fewer assertions trains people to trust a
// green that means nothing — and explorer/data/ is gitignored, so the skipping
// path is what every fresh clone and CI runner takes by default.
// Set REQUIRE_CORPUS=1 to make a missing corpus a hard failure.
const requireCorpus = process.env.REQUIRE_CORPUS === "1";
if (skipped.length && requireCorpus) {
  console.log(` FAIL  REQUIRE_CORPUS=1 but ${skipped.length} block(s) were skipped: ${skipped.join("; ")}`);
  fails++;
}
const tail = skipped.length
  ? ` (${asserts} assertions; ${skipped.length} block(s) SKIPPED - ${skipped.join("; ")})`
  : ` (${asserts} assertions)`;
console.log(fails ? `\n${fails} FAILURE(S)${tail}\n` : `\nALL PASS${tail}\n`);
process.exit(fails ? 1 : 0);
