# 07 — Is the coda "vowel" contrast independent of rhythm?

**Status:** run 2026-08-06. Statistic, null and calibration threshold fixed in
`tools/vowel_rhythm_check.mjs` before the test was run. Two follow-up analyses
(per-whale direction, leave-whales-out) were added **after** seeing the result and
are flagged as such — they are the reason the headline is hedged.

## Question

Beguš et al. annotate each Dominica coda as vowel `a` or `i` from its **spectral**
structure. Sharma et al. publish the **inter-click intervals** of the same codas.
Neither deposit can answer, alone:

> Within a single coda type, do `a` and `i` codas differ in *timing*?

If they do not, the vowel is a genuinely separate axis from rhythm — the first
independent dimension this project has had, and support for reading spectral
vowels as a distinct channel. If they do, the annotation is partly picking up
timing and any such claim has to account for it.

## Data

**Join of two deposits, verified rather than assumed.**

| | |
|---|---|
| vowels | Beguš et al., *Proc R Soc B* (2026), [OSF 9t6qu](https://osf.io/9t6qu) — 1,375 DTAG codas, 13 named whales, hand-annotated `handv` ∈ {a, i} |
| ICIs | Sharma et al. 2024 — `DominicaCodas.csv` |

`tools/fetch_vowels.py` joins on coda id and **refuses to write** unless the join
verifies. It does: **1,375 shared ids, coda type agrees 99.1 %, duration agrees
1375/1375 to under 5 ms with a median difference of 0.000 ms.** Same codas.

Cleaning mirrors `fetch_corpus.py` exactly. 1,080 codas survive with a hand vowel.

### A free result from the join

Sharma's numeric `IDN` maps **1:1** onto the named whales — 13 names, 13 IDNs,
**zero collisions in either direction**. That is an independent validation, from a
separate deposit, of a column experiments 01 and 04 depend on.

### Why the test is confined to one coda type

The vowel contrast is not evenly distributed:

| coda type | a | i | % i |
|---|---|---|---|
| **1+1+3** | 375 | 327 | **46.6 %** |
| 5R1 | 203 | 17 | 7.7 % |
| 5R2 | 35 | 3 | 7.9 % |
| 9i | 23 | 2 | 8.0 % |
| 6i | 23 | 1 | 4.2 % |

It is overwhelmingly carried by `1+1+3`. Pooling types would measure coda type,
not vowel. The test uses `1+1+3` only: **702 codas, 5 clicks, d = 4 intervals.**

## Control condition — stated before running

**The null must permute vowel WITHIN whale.** Unlike clan, vowel is *not* a
property of the individual — 6 of 11 whales use both categories with ≥5 each. So
the whole-cluster relabelling from experiments 01 and 04 does not transfer; there
is nothing to relabel. What has to be preserved is each whale's own vowel rate and
the correlation among that whale's codas.

Statistic: distance between vowel-group centroids in standardised ICI space — the
same construction `claims.js` uses for the clan question, and **tempo-blind by
construction**, since standardising divides out duration.

**Pre-registered prediction: no timing difference.** Beguš et al.'s framing treats
the vowel as a spectral dimension distinct from timing; if that is right, the
stratified null should absorb the separation. A positive result would be evidence
against the annotation being purely spectral.

## Result

**The prediction was wrong.**

```
observed centroid separation            0.01636   (0.065 of a typical interval)
centroid 'a'   [0.346, 0.333, 0.164, 0.158]
centroid 'i'   [0.336, 0.328, 0.175, 0.161]

null                                     null mean   explained        p
naive — shuffle vowel across codas         0.00264      16.1 %   0.0002
STRATIFIED — shuffle vowel within whale    0.00247      15.1 %   0.0002

calibration: 9/200 within-whale relabellings at p<0.05 (4.5 %)   [calibrated]
```

The stratified and naive nulls agree closely, so whale identity explains almost
none of the association — this is not a between-individual confound.

### The bigger effect is one the statistic cannot see

The tested statistic is tempo-blind. Duration is not:

| | a | i | Cohen d |
|---|---|---|---|
| duration | 1.172 s | 1.037 s | **0.693** |
| nPVI | 27.91 | 25.99 | 0.389 |
| std ICI3 | 0.164 | 0.175 | −0.510 |
| std ICI1 | 0.346 | 0.336 | 0.418 |

`i` codas are ~135 ms shorter. That is a larger effect than the shape difference
the test was built around.

### Two follow-ups that force the hedge

**Not pre-registered. Added after seeing the above.**

**The duration effect reverses in 2 of 6 whales:**

| whale | n(a) | n(i) | dur a | dur i | Cohen d |
|---|---|---|---|---|---|
| ATWOOD | 130 | 128 | 1.101 | 0.953 | **+1.00** |
| FORK | 118 | 92 | 1.213 | 1.055 | **+0.91** |
| TBB | 35 | 15 | 1.292 | 1.124 | **+0.93** |
| PINCHY | 49 | 55 | 1.265 | 1.194 | **+0.86** |
| LAIUS | 17 | 9 | 0.775 | 0.848 | **−0.88** |
| JOCASTA | 19 | 7 | 1.420 | 1.567 | **−3.00** |

**The shape effect is unstable to whale composition:**

| excluded | n | separation | of an interval |
|---|---|---|---|
| — | 702 | 0.01636 | 0.065 |
| ATWOOD | 444 | 0.01344 | 0.054 |
| ATWOOD + FORK | 234 | 0.00364 | **0.015** |
| ATWOOD + FORK + PINCHY | 130 | 0.01569 | 0.063 |

Dropping two whales cuts the separation by 78 %; dropping a third restores it.
That is not the behaviour of a stable population-level effect.

## Reading this

**The vowel annotation is not cleanly orthogonal to timing.** There is a
detectable association, it survives stratification by whale, and the test is
calibrated. So the pre-registered prediction fails and the "purely spectral axis"
reading is not supported as stated.

**But the association is small, heterogeneous, and unstable.** 0.065 of a typical
interval; direction reverses across individuals; the estimate swings by a factor
of four depending on which whales are in. The honest claim is *"not independent"*,
not *"vowel encodes timing"*.

### A mechanism worth testing, stated as a hypothesis

If spectral peak detection is sensitive to click rate, the `a`/`i` assignment
could partly track coda tempo as a **measurement** property rather than a
phonological contrast. That would explain both the association and its
heterogeneity — different whales, tag placements and click rates would land
differently. This cannot be tested from the summary CSVs; it needs the per-click
spectra or the audio, neither of which is in the deposit.

## What this does not license

- **Any claim about the paper's conclusions.** This tests one relationship in the
  deposited summary data. The paper's argument is spectral and has controls not
  reproduced here; it may address this directly.
- **A causal direction.** "Vowel correlates with duration" does not say which, if
  either, is prior.
- **Generalisation past `1+1+3`.** Every other coda type is 0–8 % `i`, so nothing
  here speaks to them.
- **Individual-level inference.** Three whales supply 572 of 702 codas, and the
  leave-out table shows how much that matters.
- **Independence beyond whale.** Stratification controls whale identity, not
  recording day or tag deployment. Codas from one whale on one deployment remain
  correlated, and the vowel corpus carries no date column to control it.

## Reproducing

```bash
python3 tools/fetch_corpus.py        # Sharma ICIs
python3 tools/fetch_vowels.py        # Beguš vowels + verified join
node tools/vowel_rhythm_check.mjs    # every number above
```

The statistic (`centroid`, `euclidean`, `standardise`), the permutation test and
Cohen's d are imported from `explorer/js/rhythm.js`. Nothing is reimplemented.

**Licence.** Neither deposit declares one. Both are fetched on demand into
gitignored paths and nothing is redistributed — the posture `fetch_corpus.py` and
`fetch_pacific.py` already take.

Cite: Beguš, G. et al. *The phonology of sperm whale coda vowels.* Proc R Soc B
(2026). Sharma, P. et al. *Contextual and combinatorial structure in sperm whale
vocalisations.* Nat Commun 15:3617 (2024).
