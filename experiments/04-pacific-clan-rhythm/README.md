# 04 — Does a corpus with real repertoire overlap answer what Dominica could not?

**Status:** run 2026-08-06. Statistical parameters and the negative-control
failure threshold were fixed in `tools/pacific_clan_check.mjs` before the test
was run. Three controls — region, region+year, and the effect-size measure —
were added *after* the first run and are flagged as such throughout. One
control (the injection) was **wrong in the first two runs** and is corrected
below rather than overwritten.

## Question

Experiment 01 ended with a specific, actionable failure:

> The honest conclusion is that this design cannot answer the question. […]
> Answering it needs a corpus with real overlap in repertoire, or more social
> units, not more codas.

EC1 and EC2 barely use the same coda types, so only ~33 codas of 6,038 carried
within-type timing information, and with 12 single-clan social units no
permutation test could return a p below 1/66 = 0.0152.

This runs the identical test on a corpus chosen to fix exactly those two
limits. Same question: **if clan identity is marked by rhythm, two codas of the
same type from different clans should still be timed differently.**

## Data

**Hersh et al. 2022** (PNAS 119:e2201692119, doi:10.1073/pnas.2201692119),
deposited at <https://osf.io/ae6pd/>. Fetched by `tools/fetch_pacific.py`.

24,237 rows → **22,795 codas** after cleaning, of which **6,868 are five-click**
(the statistic is defined for d = 4 ICIs). **7 clans, 191 repertoires, 100 coda
types, 23 Pacific regions, 1978–2017.**

Cleaning rules are *identical* to `tools/fetch_corpus.py`, deliberately — a rule
applied to one corpus and not the other would make any cross-corpus statement an
artifact of cleaning. Dropped: 682 codas with no clan assignment, 726 with no
coda type, 34 with an ICI inside the 2–10 ms intra-click IPI band (smallest
1.542 ms — the same trap class as the Sharma deposit's 3e-6 s values).

| | Dominica (exp. 01) | Pacific (here) |
|---|---|---|
| clans | 2 | **7** |
| permutation clusters | 12 social units | **191 repertoires** |
| within-type leverage | 33.3 codas | **42.3–303.2**, median 70.1 |
| finest possible p | 1/66 = 0.0152 | **2.67e-8** |

**The permutation cluster is the repertoire**, because 0 of 191 repertoires span
more than one clan — clan is nested inside repertoire exactly as it was nested
inside social unit at Dominica. A repertoire is *one recording day with ≥25
codas*, **not** a social unit, and this deposit carries no social-unit or
individual ids at all.

### What is not testable here, by construction

Clans were **defined** by clustering repertoires on coda-type usage (the IDcall
method). "Clans use different coda types" is therefore true by construction and
is not a claim this experiment can test. Only **within-shared-type timing** is a
real question, and that is the only thing tested below.

## Pre-registered criteria

Fixed as constants in the tool before the run.

| # | Test | Pass |
|---|---|---|
| **N** | Within-clan repertoire splits (true null) return p < 0.05 at ~nominal rate | ≤ 10% |
| **P** | Minimum detectable within-type effect, at 80% power | < 0.40 (Dominica's) |
| **F** | Pairwise clan tests, FDR-corrected across 21 pairs | q < 0.05 |

**Pre-registered prediction:** at least one of the 21 pairs shows a within-type
rhythm difference surviving FDR. Leverage is 1.3–9.1× Dominica's and there are 21
pairs instead of 1; if *nothing* clears it despite that, the clan-rhythm dialect
is not a within-type timing phenomenon in the Pacific either.

### Deliberately not scored

- **The raw count of significant pairs.** With leverage up to 303 a permutation
  test detects differences far too small to matter — the lesson experiment 01
  recorded and this corpus makes worse, not better. Effect size is reported
  alongside every p, against the null distribution of the same measure.
- **Rank of any individual pair.** The statistic's denominator is a coda-level SE
  while the null permutes repertoires, so T retains a leverage dependence
  (measured below). Ranks are soft. This is inherited from experiment 01 and not
  fixed here.

## Result

### The design question: pass, decisively

```
N  NEGATIVE CONTROL   5.4% of 168 within-clan splits at p<0.05   (nominal 5%)  [pass]
C  CALIBRATION        log-log slope of T vs leverage 0.115       (Dominica 0.31)
P  MINIMUM DETECTABLE EFFECT, injected into TRUE-NULL splits
     SI    median leverage  29.8    MDE 0.080
     PALI  median leverage  55.7    MDE 0.200
     REG   median leverage 871.7    MDE 0.016
     scale check: injecting 0.200 moves the effect measure 0.005 -> 0.200
   Dominica (experiment 01): ~0.40                                            [pass]
```

This is a working test where experiment 01 had none. The negative control sits
at nominal rate, the effect measure recovers an injected effect exactly, and the
detection floor is 2–25× better than Dominica's depending on leverage.

### The biology question: yes, but less than half of it survives control

Pooled across all regions and years, **15 of 21 clan pairs** show a within-type
rhythm difference surviving FDR at q < 0.05. The pre-registered prediction is
confirmed.

That number should not be quoted on its own.

**Effect sizes are small.** Median 0.088 of a typical interval, range
0.035–0.202. The null distribution of the *same measure* on within-clan splits
is median 0.029, p95 0.082, max 0.135. Only **12 of 21** real pairs exceed the
null p95. Several significant pairs have effects *below* it — significant
because leverage is high, not because the difference is large.

**And more than half of it is a recording-era confound.** The region control
(compare clans only where both were recorded) leaves 15 of 21 significant and
barely moves the effect sizes — but 13 of 21 pairs are testable only in
Galápagos, so it is largely a within-Galápagos comparison. Inside Galápagos, the
clans were recorded **decades apart**:

```
PALI/REG   PALI: 2013-2014   REG: 1985-1995    overlap  0 yr   <- was p = 0.0005
PALI/SI    PALI: 2013-2014   SI:  1987-1999    overlap  0 yr   <- was p = 0.0005
PALI/PO    PALI: 2013-2014   PO:  1978-1989    overlap  0 yr   <- was p = 0.0010
```

Same place, twenty years apart, means a different hydrophone, a different
annotator and different software — confounded with clan.

Restricting to shared region **and** overlapping years:

| | pairs significant |
|---|---|
| pooled | 15 of 21 |
| region-matched | 15 of 21 |
| **region + year matched** | **7 of 18 testable** |

**Every PALI result disappears.** PALI was 6 of the 15 significant pairs; three
become untestable (no overlapping year exists) and the other three go to
p = 0.10, 0.28, 0.56. PALI's apparent rhythmic distinctiveness tracked its
recording decade.

The seven that survive the strictest control:

| pair | leverage | effect | p |
|---|---|---|---|
| PO/REG | 78.3 | 0.049 | 0.0005 |
| REG/RI | 35.2 | 0.083 | 0.0005 |
| REG/SH | 73.5 | 0.067 | 0.0005 |
| FP/SH | 89.0 | 0.103 | 0.0360 |
| FP/REG | 46.0 | 0.116 | 0.0275 |
| FP/SI | 15.4 | 0.183 | 0.0010 |
| RI/SI | 6.0 | 0.275 | 0.0027 |

The last two have leverage *below Dominica's 33.3* and should be read as the
weakest of the seven, not the strongest despite their large effects — small
leverage with a large measured effect is the regime where the calibration slope
bites hardest.

**The 15 → 7 drop is not purely confound removal.** Year matching also shrinks
n, so some of the loss is power. Those two cannot be separated in general. What
*can* be said cleanly is narrower and stronger: for the three zero-overlap PALI
pairs the comparison **cannot be made at all** without confounding recording era
with clan, and that is a property of the corpus rather than of the test.

### The permutation cluster is a recording day, and that inflates everything above

A repertoire is one recording day. Clan is a property of a social **unit**, and
one unit contributes many days — so permuting repertoires treats correlated
observations as independent. This deposit has no unit or individual ids, so the
substitution cannot be avoided here. It *can* be measured, because the Dominica
corpus has both.

`tools/cluster_calibration.mjs` assigns a fake clan to whole Dominica units — a
true null with exactly the structure real clan has — then tests the identical
data twice, clustering by unit (correct) and by recording day (the proxy):

```
recording days per social unit                 7.6x
splits where DAY gives a SMALLER p     101 of 126   sign test p = 5.03e-12
median p, by unit / by day             0.504 / 0.366
null SD ratio (day / unit)                    0.881
false-positive rate at alpha=0.05      4.8% / 4.8%   (6 of 126 each)
```

**The proxy is anti-conservative.** The day-permuted null is ~12% narrower,
because a group drawn from 80 days contains pieces of every unit and sits near
the grand mean, while a group of five whole units varies by the between-unit
variance. So p shifts systematically downward.

The false-positive *rate* is unaffected on that corpus (4.8% both arms) — but
Dominica's p-values all sit far from 0.05, so there is little room for the shift
to change a verdict. Experiment 04 has many pairs at p = 0.0005, where there is.

### Cluster ladder — and the result does not survive it

Coarser clusters group repertoires that could plausibly be one unit. None spans
more than one clan, so all are valid; coarsening can only lose resolution.

| clustering | clusters | pairs surviving FDR q < 0.05 |
|---|---|---|
| repertoire (one recording day) | 183 | **15 of 21** |
| **region × year × clan** | 71 | **3 of 21** |
| region × clan | 45 | **0 of 21** |

The bottom row is resolution-limited — Plus-One collapses to 2 clusters and
Palindrome to 3, reintroducing the EC2-style degeneracy that capped Dominica at
p ≥ 0.0152 — so it is a floor, not a better answer. The middle row is the
defensible one, and it takes the headline from 15 to **3**.

### Joint control — the strictest thing this corpus supports

Region+year matching and conservative clustering each remove one confound.
Reading the two lists together is not a joint test, so the joint test was run:
shared region, overlapping years, **and** region × year × clan clusters.

**13 of 21 pairs are computable at all. Two are significant:**

| pair | years | clusters | leverage | p |
|---|---|---|---|---|
| REG/SH | 1985–2003 | 12 | 73.5 | **0.0013** |
| REG/RI | 1985–2003 | 10 | 35.2 | **0.0048** |

Both survive FDR across the 13 computable pairs (q = 0.017 and 0.031). The other
eight pairs collapse to one cluster in one clan and cannot be permuted at all.

Both surviving pairs involve **Regular**, the largest clan (4,385 five-click
codas, 50 repertoires). That is partly a statement about which comparisons retain
enough structure to be tested, not only about which clans differ.

### Reading this

The headline result does not survive its own controls.

| control | pairs significant |
|---|---|
| pooled, repertoire-clustered | 15 of 21 |
| region + year matched | 7 of 18 |
| region × year × clan clustered | 3 of 21 |
| **both, jointly** | **2 of 13 computable** |

Two Pacific clan pairs — Regular/Short and Regular/Rapid-Increasing — differ in
how they time a shared coda type, in the same region, in overlapping years, under
a permutation cluster that does not assume recording days are independent. That
is a real result and it is the first time this project has been able to state one
on this question at all.

Everything larger than that is confound. The 15-of-21 figure is inflated by three
separate things measured here: recording era (kills every Palindrome result),
region, and pseudoreplication of recording days (measured at Dominica as a
systematic downward shift in p, sign test p = 5e-12).

This is experiment 01's shape again, one level up. There, the naive result was
mostly repertoire composition and unit non-independence, and the residual was
undeterminable. Here the corpus is big enough that a residual **is** determinable
— and it is 2 pairs, not 15.

## Corrections

1. **The injection control was wrong in the first two runs.** It injected a known
   effect into *real clan pairs*, two of which already returned p = 0.0005 with
   nothing injected. Power was 1.00 at every δ, and the reported "MDE ≤ 0.001"
   was the baseline difference being detected, not a detection floor. Injection
   now runs on within-clan repertoire splits where the true effect is zero. The
   corrected MDEs (0.016–0.200) are 16–200× larger than the discarded figure.
2. **The first δ grid was censored from below** — power saturated at the smallest
   value tested, so the MDE was an upper bound presented as a measurement. The
   grid now extends to 0.001 and the tool prints `CENSORED` when power saturates.
3. **`nullMean` was read as `mean`**, so the null column printed `--` in the first
   run. The shipped `summarise` returns `nullMean`.
4. **Region and year controls did not exist in the first run.** Their absence
   would have left the headline at 15 of 21 with no check on the confound this
   project has flagged since the ASACTER work. Neither was pre-registered.
5. **An effect-size measure was added** (`contrastMagnitude`, harness-side)
   because the shipped statistic studentises magnitude away. It is validated by
   the injection: on a true-null split, injecting 0.200 moves it 0.005 → 0.200.
6. **The standing conclusion changed from "15 of 21" to "2 of 13".** The first
   version of this writeup reported 15 of 21 pooled and 7 of 18 year-matched, and
   concluded that a small within-type difference was real across many clan pairs.
   That rested on treating each recording day as an independent cluster. The
   Dominica calibration then showed the substitution is anti-conservative, the
   cluster ladder took the count to 3, and the joint control took it to 2. The
   earlier numbers are kept in the tables above rather than deleted, because the
   *sequence* is the result: each control removes a confound and the count falls.
7. **The calibration itself was reported wrongly at first.** Its initial run
   compared false-positive *rates* (3.3% vs 3.3%) and concluded no inflation.
   With ~2 rejections per arm that rate has a 95% interval of roughly 0.4–11.5%
   and cannot separate nominal from double-nominal. Both arms see byte-identical
   data, so the informative comparison is the **paired** shift, which is
   unambiguous (101 of 126, p = 5e-12). The rate comparison is retained and
   labelled as uninformative rather than dropped.
8. **`fetch_corpus.py` omitted the Date column** as "mixes bare years with
   DD-MM-YYYY; unsafe to parse". Re-measured: all 8,719 rows are `DD/MM/YYYY` or
   `DD-MM-YYYY`, none is a bare year, and day-first is unambiguous (3,907 rows
   have a first field > 12, none has a second > 12). Without that column the
   calibration above could not have been run at all.

## What this licenses, and what it does not

Licensed:

- **The design works.** Negative control at nominal rate, an effect measure that
  recovers an injected effect exactly, and a detection floor 2–25× better than
  Dominica's. Experiment 01's stated blocker is removed.
- **Two clan pairs differ in within-type rhythm** — Regular/Short and
  Regular/Rapid-Increasing — under region matching, year matching and
  conservative clustering simultaneously.
- **The day-for-unit substitution is anti-conservative**, measured against ground
  truth rather than argued: 101 of 126 true-null splits shift p downward
  (p = 5e-12). This applies to any corpus that lacks unit ids, not just this one.

Not licensed:

- **"Clans have rhythmic dialects" as a general claim.** Two pairs of twenty-one,
  both involving the same clan, with effects near the noise floor of the measure.
- **The 15-of-21 figure**, which is inflated by recording era, region, and
  pseudoreplication of recording days. It is retained above only to show the
  sequence.
- **Anything about coda-type usage.** Circular — clans are defined by it.
- **Any individual pair's rank.** The calibration slope is 0.115, not 0.
- **Social-unit-level inference.** The permutation cluster is a *recording day*
  or a *region × year × clan* group, never a social unit — this deposit has no
  unit or individual ids, and no clustering derived from date and place recovers
  them. Two units can be recorded in one place on one day; one unit is followed
  across years. The controls here **bound** the pseudoreplication; they do not
  remove it.
- **The eight pairs that are not computable under the joint control.** They are
  not null results. The corpus cannot address them.
- **Cross-corpus comparison with Dominica.** Different ocean, different
  annotators, different decades, and clan labels produced by a different method
  (IDcall clustering here; published clan assignment there). The leverage and MDE
  comparisons above are about *designs*, not about whales.
- **Anything about function.** That timing correlates with clan says nothing
  about whether whales perceive or use it.

## Reproducing

```bash
python3 tools/fetch_pacific.py          # ~3.9 MB from OSF, gitignored
node tools/pacific_clan_check.mjs       # the clan tests, controls and ladder

python3 tools/fetch_corpus.py           # Dominica, now with parsed dates
node tools/cluster_calibration.mjs      # the day-vs-unit calibration (~2 min)
```

Full output is in `artifacts/run.txt` (gitignored, regenerable). The statistic
(`studentisedContrast`), its null (`permutationTest` with cluster permutation)
and the FDR correction are **imported from `explorer/js/`**, not reimplemented —
a second copy that silently diverged from the shipped code is a failure mode this
project has hit before. Only `contrastMagnitude` and the region/year restrictions
are harness-side, and both are labelled in the source.

**Licence.** The article is CC BY-NC-ND 4.0 and the OSF node declares no licence,
so `fetch_pacific.py` downloads on demand into gitignored `data/` and this repo
redistributes nothing — the same posture as the Sharma deposit.

Cite: Hersh, T.A., Gero, S., Rendell, L., Cantor, M., et al. (2022). *Evidence
from sperm whale clans of symbolic marking in non-human cultures.* PNAS
119(37):e2201692119.
