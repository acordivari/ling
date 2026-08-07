# 01 — Is the clan rhythm difference a dialect, or a repertoire difference?

**Status:** control condition pre-registered before the stratified test was run.
Run 2026-07-29. **Revised the same day** after adversarial review found the first
two nulls pseudoreplicated; the original conclusion and the correction are both
recorded below.

## Question

Sperm whale vocal clans are described as having distinct coda dialects. Clans
EC1 and EC2 share the waters off Dominica and are distinguished by their coda
repertoires (Gero et al.; Sharma et al. 2024).

If clan identity is marked by *rhythm*, then two codas of the **same type**
produced by different clans should still be timed differently. If clan identity
is marked only by *which codas get used*, then within a shared type the two clans
should be indistinguishable.

These are different claims, and a naive test cannot tell them apart.

## Data

`DominicaCodas.csv` from the Sharma et al. deposit
(`github.com/pratyushasharma/sw-combinatoriality`, Zenodo 10.5281/zenodo.10817697).
8,719 annotated rows → 8,112 codas after cleaning → **6,105 five-click codas**
used here (5,467 EC1, 638 EC2).

Cleaning rules, each derived by measuring the file:

| rule | dropped |
|---|---|
| `CodaType` contains `NOISE` (10 variants) | 600 |
| any ICI < 10 ms — inside the intra-click IPI band; observed values as low as 3e-6 s, i.e. duplicated click timestamps | 7 |
| `nClicks < 3`, `Duration <= 0`, non-positive ICI, `\|sum(ICI) − Duration\| > 0.01 s` | 0 additional |

Statistic: Euclidean distance between clan centroids in **standardised ICI**
space (each ICI ÷ coda duration, so the vector sums to 1 — Sharma et al.'s
"standardised absolute ICI", which discards tempo and keeps rhythm).

## Control condition — stated before running

Permutation nulls, 2,000 shuffles each, seed 1:

- **Naive.** Clan labels shuffled freely across codas. Controls for nothing but
  group size.
- **Stratified.** Clan labels shuffled **only within each coda type**, across
  codas. Preserves each clan's repertoire composition exactly and destroys only
  the within-type timing difference.
- **By social unit** *(added after review, not pre-registered — flagged as such)*.
  Whole units are relabelled together, because clan is a property of a unit and
  not of a coda.

**Pre-registered prediction:** the clans will separate strongly under the naive
null, and the stratified null will absorb most of it — because the two clans are
known to favour different coda types. If the stratified null absorbed *none* of
it, that would be strong evidence for a genuine timing dialect.

Stating this in advance because "the separation looked convincing" is exactly the
judgement that is easy to make after seeing a large number.

## Result

Observed clan centroid separation: **0.12871**.

| null | null mean | explained by null | p | z |
|---|---|---|---|---|
| naive (shuffle codas) | 0.00304 | **2.4 %** | < 0.0005 | 71.89 |
| stratified by coda type (shuffle codas) | 0.12742 | **99.0 %** | < 0.0005 | 4.93 |
| shuffle whole SOCIAL UNITS | 0.03256 | 25.3 % | 0.0152 | rank 1 of 66 |
| **remove coda-type means, THEN shuffle units** | 0.00585 | — | **0.9630** | — |

**The first three return a small p. The fourth does not, and the fourth is the
one that matters.**

### Correction: the first two nulls are pseudoreplicated

This experiment originally reported only the first two rows and concluded "99 %
of the clan effect is repertoire composition". That conclusion rested on an
invalid null, and the correction is recorded here rather than quietly edited.

**Clan is perfectly nested within social unit.** Every one of the 12 real units in the
5-click corpus belongs to exactly one clan:

| clan | units |
|---|---|
| EC1 | A, D, F, J, N, R, S, T, U, V (10 units) |
| EC2 | K, P (2 units) |

`ZZZ` is **excluded**: the corpus's own metadata flags it
(`unit_ZZZ_is_unknown_sentinel: true`) and it is not a social unit. A first
attempt at this correction counted it, giving C(13,3) = 286 assignments and a
floor of 0.0035 — manufacturing four times the available resolution, which is the
same class of error one level up. Recorded because it was caught in review, not
by me.

Shuffling clan labels across individual **codas** therefore constructs a world
that could not exist — two codas from unit A assigned to different clans. It
treats 6,105 correlated observations as 6,105 independent ones, which is where
z = 71.89 comes from. The effective sample size for a clan comparison is
**12 units, not 6,105 codas**.

Permuting whole units instead puts the observed separation at **rank 1 of 66** —
the most extreme of every possible assignment — for an exact p of **0.0152**.
There are only C(12,2) = 66 ways to assign 2 of 12 units to EC2, so 1/66 is the
finest p this design can ever produce, however many shuffles are run.

A z-score is **not** quoted for this row. With 66 discrete outcomes a
standardised deviate is not interpretable; "rank 1 of 66" is the exact statement
and the app prints that instead.

Repertoire composition of the 5-click codas:

| clan | composition |
|---|---|
| EC1 (n=5,467) | `1+1+3` 65 %, `5R1` 28 %, `5R2` 5 %, `2+3` 1 %, `5R3` 0.3 % |
| EC2 (n=638) | `5R3` 98 %, `1+1+3` 2 % |

Clan centroids: EC1 `[0.314, 0.309, 0.194, 0.183]` (front-loaded), EC2
`[0.248, 0.247, 0.249, 0.256]` (very nearly even).

### Reading this

**The prediction was partly confirmed, and the confirmation is weaker than it
first appeared.** Under a coda-level null, 99 % of the headline separation is
repertoire composition. EC1 mostly produces `1+1+3`; EC2 almost exclusively produces `5R3`;
those two types have genuinely different shapes, so pooled centroids differ
regardless of whether either clan times a shared type differently.

**The residual is real but small, and thinly supported.** 0.00130 — 1.0 % of the
observed value. It is "significant" at n=6,105 because a permutation test with
that much data detects differences far too small to matter. And it rests on the
crossover cells, which are tiny: only **15** EC2 codas are type `1+1+3`, and only
**19** EC1 codas are type `5R3`. Any within-type claim is a claim about those
34 codas.

### Second and third corrections: not a residual, and not a null either

The stratified null controls for repertoire composition but not for
non-independence. The unit null does the reverse. Each left a residual, and an
earlier version of this writeup reported both — which is a stronger claim than
the data supports, because neither test controls both confounds at once.

**Second correction.** Adversarial review ran the test this project had declined
to implement — residualise each coda against its coda-type mean, then permute clan
across the 12 units — and got p = 0.96, which was reproduced exactly. That was
briefly recorded here as a null result.

**Third correction: that p was an artifact of the statistic.** The same reviewer
then refuted their own suggestion. Residualising against a global coda-type mean
attenuates a real within-type effect in proportion to how *exclusively* a group
owns its coda types — and the real clan split is by construction the most extreme
repertoire split there is. Measured by injecting an identical within-type rhythm
shift into each candidate pair of units:

| group | statistic moves by | slope |
|---|---|---|
| **K+P (the real clan split)** | **0.00491** | **0.049** |
| A+V | 0.09547 | 0.955 |
| N+R | 0.09769 | 0.977 |

The real split ranked **1 of 66 in sensitivity** — the least able to detect an
effect, 17.7× below the median. The p of 0.96 measured the instrument, not the
whales.

**The corrected test** forms the within-type contrast explicitly, pools it with
inverse-variance weights and divides by its own standard error, so assignments
with very different effective sample sizes are on one scale. All 66 assignments
are enumerated exactly — no sampling, no seed:

```
observed T            1.5693
rank                  27 of 66      (middle of the distribution)
exact p               40/66 = 0.6061
within-type leverage  33.3 codas of 6,038
```

**The honest conclusion is that this design cannot answer the question.** Not "the
clans are the same" — the test has almost no power. The only codas that carry
information about within-type timing are the crossover cells: 15 EC2 codas of type
`1+1+3` and 19 EC1 codas of `5R3`, giving 33.3 codas of leverage out of 6,038.
Injection tests put the minimum detectable within-type effect at roughly **40 % of
a typical interval** — a change large enough to reclassify the coda.

What can honestly be said: EC1 and EC2 differ unambiguously in **which codas they
produce**. Whether they also differ in **how they time a shared coda type** is
**not determinable from this dataset** — the two clans barely use the same types,
so there is almost nothing to compare. Answering it needs a corpus with real
overlap in repertoire, or more social units, not more codas.

### A residual calibration problem, stated rather than buried

The studentised statistic is better than what it replaced but is still not
perfectly calibrated across cluster assignments. Its denominator is a *coda-level*
standard error while the null permutes *units*, so T retains a dependence on
leverage. Measured with the effect held at exactly zero (within-EC1 pairs only,
corpus thinned uniformly):

| denominator | log-log slope of T vs leverage (0 = calibrated) |
|---|---|
| coda-level SE (shipped) | 0.31 |
| unit-level SE | 0.21 |
| ideal | 0 |

A unit-level standard error helps but cannot fix it, because EC2 has only **two**
social units and its between-unit variance is barely estimable. Across three
defensible denominators the real split ranks **27, 59 and 66 of 66**.

So the *rank* is soft and the app says so. The *conclusion* is not: none of the
three clears the 1/66 resolution floor, so all three agree the design cannot
resolve the question.

### Record of conclusions

Four were published here in sequence, each superseding the last:

1. "99 % confound, ~1 % survives" — pseudoreplicated.
2. "Null result, p = 0.96" — the statistic was least sensitive on precisely the
   split under test.
3. "Underpowered, cannot tell" — current.
4. …with the rank treated as soft, because the statistic remains imperfectly
   calibrated.

All four are kept. **Cite (3) with the caveat in (4).** Every one of these
corrections came from adversarial review, and three of them were found only
because a reviewer re-ran the analysis independently rather than reading the code.

**This does not contradict the clan-dialect literature.** Clans genuinely do
differ in coda usage, and that *is* the dialect as usually defined — a repertoire
difference. What this shows is narrower: the pooled rhythm-space separation is
not independent evidence *on top of* the repertoire difference. It is the same
fact measured twice.

### The methodological point, which is the reason this experiment exists

A p-value answers "could the null have produced something this extreme?" It does
not answer "how much of this did the null produce anyway?" Here the two questions
give opposite impressions from identical data.

This motivated `explainedByNull` (= null mean ÷ observed) in
`explorer/js/rhythm.js`, reported next to every p-value in the Observatory.

## Reproducing

```bash
python3 tools/fetch_corpus.py
cd explorer && node test/rhythm.test.mjs     # asserts the numbers above
python3 -m http.server 8777                  # → /observatory.html, claim 1
```

The assertions live in `explorer/test/rhythm.test.mjs` under "real corpus" and in
`explorer/test/observatory.test.mjs` under "the clan claim behaves as documented".
Seed 1, 1,000–2,000 iterations; re-running with the same seed reproduces the same
p exactly.

## What this does not license

- **One population.** EC1 and EC2 off Dominica. Nothing about other clans or oceans.
- **Two clans, unbalanced, and only 12 clusters.** EC2 contributes 638 codas
  across just 2 social units (K, P), and 98 % of them are one coda type. With
  C(12,2) = 66 possible unit assignments no permutation test can resolve a p below
  0.0152. More codas would not help; more *units* would.
- **The stratified null is coda-level** and so inherits the naive null's
  pseudoreplication. That is precisely why the joint null exists and why it, not
  the stratified figure, is the result to quote.
- **Annotation, not audio.** ICIs were measured by researchers with tooling that
  changed across 2005–2018. This inherits every one of those decisions.
- **Nothing about individuals.** Only 2,797 of 8,112 codas carry an unambiguous
  individual id (`IDN == 0` means unidentified, and values like `6070/6068` mean
  the annotator could not decide). A per-whale version of this test has a third of
  the data it appears to.
- **Function untested.** That timing correlates with clan says nothing about
  whether whales perceive or use it.

## Addendum, 2026-08-06 — the joint null is now in the shipped API

The decisive test on this page had to be written by hand, because
`permutationTest` in `explorer/js/rhythm.js` **threw** when `strata` and
`clusters` were supplied together. That refusal is part of how three superseded
conclusions got published here: each single-confound null left a residual, and
the test that dissolved it lived outside the module that everything else used.

It now runs the joint null directly — residualise against stratum means, then
permute labels across clusters — and reproduces this experiment's numbers:

```
five-click codas, ZZZ sentinel excluded              n = 6,038
clusters                            12 social units, C(12,2) = 66, enumerated exactly
observed (residualised separation)  0.00145      as published here
leverage                            33.31        as published here (33.3 of 6,038)
informative strata                  2            crossover cells 1+1+3 and 5R3
exact p                             64/66 = 0.9697
```

Two things changed rather than merely moved.

**The p is now exact.** The sampled version printed 0.9630 / 0.9660 / 0.9715 /
0.9770 across seeds against a resolution unit of 1/66. With 66 assignments
enumerated there is no seed to report.

**`leverage` is returned beside `p`, always.** This experiment's central lesson is
that the joint p was uninterpretable on its own — 0.9630 came from a design that
ranked 1 of 66 in sensitivity on precisely the split under test, 17.7× below the
median. The number that would have caught it is now impossible to omit.

**None of this changes the conclusion.** It remains (3): the design is
underpowered and cannot answer the question, cited with caveat (4) that the rank
is soft. 33.3 codas of 6,038 is 0.55% of the rows a naive reading assumes.
