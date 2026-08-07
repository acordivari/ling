# 06 — Can the DSWP audio be joined to the public coda annotations?

**Status: PRE-REGISTRATION, written 2026-08-06. Nothing matched yet.**

The Result section is empty on purpose. No matching statistic has been computed
against the real annotation table, and none will be until the gates below pass.

## Question

Sperm whale coda data is published as two disjoint artifacts:

| artifact | what | what is missing |
|---|---|---|
| `orrp/DSWP` (HuggingFace) | **1,501 WAV files**, 585 MB, CC BY 4.0, **ungated** | no ICIs, no coda type, no speaker, no rig metadata |
| `DominicaCodas.csv` (Sharma et al.) | **8,719 annotated codas** — ICI1–9, CodaType, Clan, Unit, IDN | no audio |
| `sperm-whale-dialogues.csv` | 3,839 codas, ICI1–28, speaker index, timestamp, bout id | no audio |
| `coda-vowel-phonology` (OSF `9t6qu`) | 1,375 codas, **13 named individuals**, vowel labels, spectral peaks | no audio |

Nothing public joins the audio to any of the annotations. That gap is named as
the binding constraint in `experiments/05-structure-vs-timbre/README.md` and as a
gotcha in `CLAUDE.md`.

**Does a recoverable correspondence exist between the 1,501 audio files and the
published annotation rows?**

### Why this is the keystone

If a join is recovered it unblocks, at once:

- experiment 05's stated binding constraint — real coda audio the codec can
  round-trip, rather than continuous click train
- `CLAUDE.md` planned experiment 1 (cross-species FAD ladder) — needs real coda audio
- planned experiment 3 (embedding transfer) — needs audio
- planned experiment 5 (noise artifact ablation) — needs audio **and** vowel labels,
  and the vowel labels are already joinable to the ICI tables on `Duration`

If it is not recoverable, that is a result too. A 2026 preprint (arXiv:2606.16084)
asserts exactly this pairing, reporting 1,501 − 18 = 1,483 codas, while
attributing the audio to a repository that contains no audio, documenting no join
key, and withholding its code. A demonstration that the alignment cannot be
reproduced from public sources is worth recording.

### What is already known, before any matching

A five-file probe on 2026-08-06 (files 1, 2, 3, 700, 1501) established two things.

**Naive index-order join is false.** WAV 700 has a click span of 1.02 s against
row 700's stated `Duration` of 0.3304 s; WAV 1501 shows five clicks at ~630 ms
spacing against row 1501's `1+1+3` pattern (0.3505, 0.3148, 0.1721, 0.1858). No
row matched its like-numbered file. This rules out `wav N ↔ row N`; it does not
rule out a join.

**The corpus contains more than one recording configuration**, readable from the
WAV headers alone. The five-file probe found two; the full fetch found **five**.

The dataset card states there is no per-file metadata about which recording system
was used. The headers supply a grouping variable anyway. This is recorded here
because it is the variable the Beguš recording-artifact question needs, and
because it must be collected during the fetch rather than reconstructed later.

Note the consequence for the instrument: the shipped detector computes its onset
function on 512-sample frames with a 128-sample hop, so its time resolution is a
function of sample rate. **The rigs are not measured on the same grid.** Gate G2
tests whether that matters.

#### Amendment, 2026-08-06 — G2 scope widened after the fetch

G2 was pre-registered as "44.1 kHz vs 48 kHz", from a five-file probe. The
completed fetch of all 1,501 files shows that was wrong about the corpus:

| configuration | files | frame / hop |
|---|---|---|
| 48 000 Hz stereo | 846 | 10.67 / 2.67 ms |
| 44 100 Hz mono | 368 | 11.61 / 2.90 ms |
| **120 000 Hz stereo** | **219** | **4.27 / 1.07 ms** |
| **96 000 Hz stereo** | **42** | **5.33 / 1.33 ms** |
| 44 100 Hz stereo | 26 | 11.61 / 2.90 ms |

Total 44.9 min, 585.5 MB, 1,501 of 1,501 readable, 0 failures.

**G2 is therefore run across all five rates, not two.** Recorded as an amendment
rather than folded in silently, because it widens a pre-registered gate after
seeing data.

Two consequences follow, and both were anticipated by the reasoning above rather
than discovered afterwards:

- Time resolution varies **2.7×** across the corpus (1.07 ms hop at 120 kHz
  against 2.90 ms at 44.1 kHz). Any per-file measurement is rig-dependent by
  construction.
- The high-rate rigs resolve the intra-click pulse train *better*. At 120 kHz an
  IPI of 2.8–3.3 ms spans ~340–400 samples, comfortably above the 128-sample hop,
  so the detector is **more** likely to fire on internal pulses there than at
  44.1 kHz. If click-count recovery depends on rig, the match is biased by rig,
  and a "partial join" would then be a rig artifact. G3 is run per rate for this
  reason.

## Statistic

For each audio file, the shipped detector returns onset times, hence a click
count *k* and an ICI vector of length *k* − 1. A candidate annotation row supplies
its own *k* and ICI vector. The match statistic is

> **d = mean absolute difference between standardised ICI vectors**, where
> standardised ICI is each ICI divided by the coda's total duration.

Standardised ICI is used because `iciNorm` in this repo already equals Sharma's
"standardised absolute ICI" and sums to 1, so *d* is scale-free and comparable
across codas of different tempo. Absolute-ICI distance is reported alongside but
is not the primary statistic, since a tempo offset between rigs would inflate it
without indicating a failed join.

Only rows with the same *k* are candidates. That makes click-count recovery a
precondition, not a detail — hence gate G3.

## Pre-registered gates — the instrument, before any matching

Experiment 05's G0 failed as pre-registered, in the direction that would have
manufactured its headline result, and was caught only because the gate ran first.
Experiment 03 established that this repo's onset machinery **cannot distinguish
real click structure from periodic broadband artifacts**. The same discipline
applies here, and the specific hazard is known in advance.

**The hazard: intra-click multipulse structure.** A sperm whale click is not an
impulse. It is a pulse train whose internal spacing (IPI) experiment 03 measured
at **2.81–3.31 ms** on real Pacific animals. A detector that fires on those
internal pulses returns far too many onsets. The 2026-08-06 probe, using a crude
20 ms-refractory detector rather than the shipped one, returned **14 onsets on a
file that should hold a 5-click coda**, with recovered intervals of 26–51 ms —
above the shipped detector's 30 ms `minIci` floor, so the floor alone will not
save it.

If the detector splits clicks, every ICI vector has the wrong dimension and the
match is meaningless. If it splits them *inconsistently*, matching will still
return a nearest row for every file, and the result will look like a partial join.

| | test | pass |
|---|---|---|
| **G1** | Synthetic recovery. Render click trains at ICIs taken from real annotation rows, recover with the shipped `analyze`. | r ≥ 0.95, slope 0.90–1.10 on recovered vs constructed ICI |
| **G2** | Rig invariance. Same material rendered and measured at 44.1 kHz and 48 kHz. | median per-coda *d* between the two ≤ 0.02 |
| **G3** | **Multipulse rejection.** Render clicks carrying realistic internal pulse structure (IPI 2.8–3.3 ms, per exp 03) and recover. | **≥ 95% of codas return the exact constructed click count** |
| **G4** | Real-audio stability. On real DSWP audio, perturb detector sensitivity ±20%. | median click count changes by ≤ 1; ≥ 80% of files unchanged |

G3 is the gate this experiment exists to pass. G4 is the only one that touches
real audio, and it deliberately scores *stability*, not accuracy — there is no
per-file ground truth, which is the entire problem.

**If G3 or G4 fails, no matching is run.** The failure is recorded and the
instrument is amended or the experiment stops, as in experiment 05.

## Pre-registered controls on the match itself

A nearest-neighbour search over 8,719 rows always returns a nearest row. "We
found matches" is not a result. Three controls, all fixed before running:

### N1 — the Pacific negative control

Run the identical matcher against the **Hersh et al. Pacific corpus**
(`data/pacific/pacific_coda_data.csv`, 22,795 codas, already fetched for
experiment 04). That corpus is real coda annotation of the same kind, from a
different ocean, and is **definitively not the source of this audio**.

This is the strongest available control because it holds constant everything
except provenance: same statistic, same distribution family, same click counts,
same annotation conventions. If Dominica and Pacific match equally well, the
matcher is measuring the density of coda space, not a join.

> **Pass: the median *d* of best matches against Dominica is lower than against
> Pacific by at least 2 standard deviations of the Pacific best-match
> distribution.**

### N2 — permutation null

Shuffle ICI vectors among Dominica rows *within* each click count, destroying the
row↔vector correspondence while preserving click-count composition exactly. This
is the coda-type-stratified null of experiment 01, applied to matching. 2,000
shuffles, seed fixed and recorded.

> **Pass: observed median best-match *d* below the 5th percentile of the null.**

### N3 — injectivity

A real join is a partial injection: distinct audio files map to distinct rows.
Random matching produces collisions at the birthday rate. Report the collision
rate against the rate expected under N2.

> **Pass: collision rate below the N2 null's 5th percentile.**

## Decision rule, fixed in advance

**JOIN RECOVERED** requires all three: N1, N2, N3 pass, *and* the best-match
distance distribution is visibly bimodal with a mode near zero. The size of the
low-distance mode is the deliverable — it says how much of the audio is joinable,
which is the number every downstream experiment needs.

**JOIN NOT RECOVERED** if N1 fails — Dominica matching no better than Pacific.
That is the informative negative and it is reported as a result, not a
non-finding.

**AMBIGUOUS** if N1 passes but the distribution is unimodal. Read as: some signal,
no per-file join. Explicitly not enough to license downstream use, because
downstream experiments need to know *which* files are joined, not that a
correlation exists.

## Prediction, stated before running

**A join exists and is recoverable for a substantial minority of files — I
predict 30–70% — and it is not index-order.**

Reasoning: the probed files are cut close to coda boundaries (click spans of
1.02–2.81 s inside files of 1.61–3.48 s), which is what per-coda extraction from a
longer recording looks like. Extraction implies a source annotation. But DSWP's
1,501 is not a round subset of Sharma's 8,719, the two rigs suggest more than one
deployment era, and `codaNUM2018` runs 1–8878 with gaps.

The competing hypothesis, which would produce a clean null: **the DSWP audio and
the Sharma annotations are disjoint recordings** — 1,501 codas curated by CETI
from material Sharma never annotated. Nothing public rules this out, and N1 is the
control that would reveal it.

What would falsify the prediction: Dominica best-match distances
indistinguishable from Pacific.

## Gate results — run 2026-08-06

**G1, G2, G3 PASS. G4 FAILS. No matching statistic has been computed.**

`artifacts/gate.json`. 120 sampled annotation rows, seed 606, shipped `analyze`
and shipped `renderCoda`/`spermWhaleClick`.

### On synthetic material the detector is near-perfect

```
G1  impulse clicks     slope 0.9949   r 0.9992   exact click count  99.2%   PASS
G3  multipulse clicks  worst exact click count 99.2% [>=95%]                PASS
      44100/48000/96000/120000 Hz x IPI 2.8/3.3/5.5 ms — 12 conditions
      exact 99.2-100%, over-detection 0.0% in every condition,
      slope 0.994-1.001, r 0.999-1.000
G2  rig invariance     worst median standardised-ICI d 0.00454 [<=0.02]      PASS
      48000 0.00454   96000 0.00423   120000 0.00430
```

**The multipulse hazard this gate was written for did not materialise.** The
shipped detector's 30 ms `minIci` floor sits well above the 2.8–5.5 ms IPI, and
over-detection was 0.0% in all twelve conditions. That was the predicted failure
and it is not the actual one.

### G4 — real audio: FAIL

```
files 186 (stratified across all five rigs)
median count spread 1.0 [<=1]        unchanged 35.5% [>=80%]   FAIL

by rig                     n    median recovered clicks   stable under +/-20%
  44100 Hz mono           66              11.0                    37.9%
  48000 Hz stereo         40               4.0                    32.5%
  96000 Hz stereo         40              10.0                    15.0%
  120000 Hz stereo        40              10.0                    55.0%
```

Two things are wrong, and the second is worse than the first.

**Instability.** Only 35.5% of files return the same click count under a ±20%
sensitivity perturbation, against a pre-registered 80%. A click count that moves
with a tuning knob is not a measurement.

**Rig dependence.** Median recovered click count is **11 at 44.1 kHz and 4 at
48 kHz** — a 2.75× spread driven by recording equipment. The annotation corpora
are dominated by 5-click codas; the detector returns a nearly flat distribution
from 2 to 13 across the corpus.

> **This is the finding that stops the experiment.** Matching pairs an audio file
> to annotation rows *with the same click count*. If recovered click count is set
> by the recording rig, then 44.1 kHz files match 11-click rows and 48 kHz files
> match 4-click rows, and the resulting "partial join" is a map of recording
> equipment wearing the costume of a data-provenance result. N1, the Pacific
> control, would not catch this: it would be biased identically.

### Mechanism

Detected-ICI distributions on real audio, by rig, at the default 30 ms floor:

| rig | 0–50 ms | 50–100 ms | 100–150 ms | 150–200 ms | 200–300 ms | 300–500 ms |
|---|---|---|---|---|---|---|
| 120 kHz | **137** | 95 | 58 | 41 | 48 | 55 |
| 96 kHz | 52 | **125** | 73 | 50 | 49 | 31 |
| 44.1 kHz mono | **98** | 72 | 56 | 67 | 62 | 64 |
| 48 kHz | 14 | 12 | 32 | 23 | 15 | 28 |

The high-rate rigs carry heavy sub-100 ms mass — reverberation, surface echo, and
neighbouring animals resolved by equipment built for it. The 48 kHz rig carries
almost none. **The rigs do not merely differ in resolution; they differ in what
structure is present in the recording at all.** No single detector setting
normalises that.

### The obvious remedy, measured and disqualified

Raise `minIci` until recovered counts look coda-like:

| `minIci` | 120 kHz | 44.1k mono | 44.1k stereo | 48 kHz | 96 kHz | real ICIs merged | codas losing ≥1 click |
|---|---|---|---|---|---|---|---|
| 30 ms | 10 | 12 | 8 | 4 | 10 | 0.9% | — |
| 80 ms | 8 | 9 | 7 | 4 | 8 | 20.8% | — |
| 120 ms | 7 | 8 | 6 | 4 | 7 | 34.3% | **38.2%** |
| 160 ms | 6 | 6 | 5 | 4 | 6 | 46.2% | **61.4%** |
| 200 ms | 5 | 6 | 4 | 3 | 5 | **58.9%** | **79.4%** |

Counts do converge toward the coda-like 4–6 range — by **merging the majority of
real clicks**. At the 200 ms floor that makes the numbers look right, 58.9% of the
34,450 annotated ICIs in the Dominica corpus fall below the floor and 79.4% of
codas would lose at least one click. The rigs still disagree, 3 against 6.

This is experiment 05's remedy table again: the setting that makes the statistic
presentable is the setting that destroys the signal.

### Status

**The gate does not pass, so `tools/exp06_match.mjs` was not written and no
matching statistic exists.** Per the pre-registration, that is the whole point of
running the gate first.

Candidate amendments, recorded before running any of them:

1. **Restrict to a single rig.** Defensible, costs the corpus. The 48 kHz set is
   largest (846) and cleanest, but its median 4 recovered clicks against a corpus
   dominated by 5-click codas suggests *under*-detection, which is its own bias.
2. **Change the statistic to duration.** Matching on coda extent needs only the
   first and last onset, a far weaker demand than every interior click.
3. **Abandon the per-file join** and report the negative.

Option 2 was called "the most promising" here before it was tested. **It is the
worst of the three, and the identifiability analysis below is why.** Recorded as
a retraction rather than edited away.

## Identifiability — is a per-file join possible in principle?

Run before building any matcher, because a matcher that cannot succeed at any
implementation quality is not worth writing. Pure combinatorics on the 8,112-row
annotation table; no audio, no detector. For a query row, how many rows fall
within tolerance?

**A. Duration alone**

| tolerance | median candidates | p90 | uniquely identified |
|---|---|---|---|
| 0.5 ms | 8 | 33 | 3.1% |
| 5 ms | 75 | 326 | 0.1% |
| 10 ms | 149 | 637 | 0.0% |

**B. Duration + exact click count**

| tolerance | median candidates | p90 | uniquely identified |
|---|---|---|---|
| 1 ms | 12 | 56 | 10.1% |
| 5 ms | 58 | 249 | 2.7% |
| 10 ms | 117 | 503 | 1.2% |

**C. Full standardised ICI vector + exact click count** — the pre-registered statistic

| tolerance | median candidates | p90 | uniquely identified |
|---|---|---|---|
| **0.002** | **3** | 16 | **32.7%** |
| 0.005 | 29 | 197 | 11.5% |
| 0.010 | 206 | 864 | 3.2% |

**Duration matching is hopeless.** At 0.5 ms — finer than any onset detector here
can deliver — the median query still has 8 candidates and 3.1% resolve uniquely.
The reasoning that motivated it was wrong in a specific and instructive way: the
`coda-vowel-phonology` set does join to `sperm-whale-dialogues.csv` on `Duration`
at 93.5% unique, but that is an **exact float join between two tables carrying the
same annotated numbers**, not a measurement matched against a table. Transferring
a join key across that boundary was the error.

**The pre-registered statistic was the right one**, and it needs a tolerance near
**0.002** in standardised-ICI space to reach even one-third unique identification.
Standardised ICIs sum to 1 over ~4 intervals, so 0.002 mean absolute difference is
roughly **1.7 ms per interval on a median 0.854 s coda**.

The shipped detector quantises onset times on a 128-sample hop: **2.90 ms at
44.1 kHz**, 2.67 ms at 48 kHz, 1.33 ms at 96 kHz, 1.07 ms at 120 kHz. At the two
low rates — 1,240 of 1,501 files — **the measurement grid is coarser than the
precision the annotation table demands.** No detector tuning fixes that; it is the
grid. Sub-hop onset refinement does not exist in this repo (noted as absent in
experiment 05) and would be required before the low-rate rigs could be attempted
at all.

## The distributional test, which survives a per-file failure

Per-file matching fails, but the underlying question — *is this audio the material
those tables annotate?* — is still answerable from distributions, which do not
require any file to be matched to any row.

Click span (first to last detected onset) measured on all 1,501 files, against
both public annotation sets:

| set | n | p10 | median | p90 | max |
|---|---|---|---|---|---|
| `DominicaCodas.csv` (cleaned) | 8,112 | 0.322 | **0.854** | 1.325 | 1.917 |
| `sperm-whale-dialogues.csv` | 3,832 | 0.326 | **0.990** | 1.341 | 2.183 |
| **DSWP audio, measured** | 1,369 | 0.929 | **1.511** | 2.072 | 3.950 |

Per rig, the DSWP median click span is 1.436 / 1.498 / 1.511 / 1.556 / 1.657 s
across the five configurations — **stable to within 0.22 s, so this is not a rig
artifact.**

> **The median DSWP file, as measured, looks like a 98th-percentile annotated
> coda.** Only 1.9% of `DominicaCodas.csv` rows and 2.6% of dialogue rows reach
> 1.511 s. The DSWP maximum, 3.950 s, is 1.8× the longest annotated vocalisation
> in either table.

### Two readings, and this instrument cannot separate them

- **H1 — the detector over-segments.** G4 already shows median 11 recovered clicks
  at 44.1 kHz against corpora dominated by 5-click codas. Surface reflections
  arrive tens of milliseconds after the direct path, above the 30 ms floor, so
  they register as onsets. Spurious onsets before or after the coda proper inflate
  the span.
- **H2 — the clips hold more than one annotated coda's worth of material.**

Both predict everything observed. H1 is strongly supported by G4; the magnitude
argues against it being the whole story, since a 0.66 s median excess is large for
echo inflation alone. **They are not separable without ground truth, and no public
ground truth exists — which is the same gap that opened this experiment.**

## Conclusion of the first pass

**JOIN NOT RECOVERED, and the barrier is not implementation quality.**

Three independent findings, each sufficient on its own:

1. **Click count is rig-determined** (median 11 at 44.1 kHz, 4 at 48 kHz) and
   unstable (35.5% reproducible), so files cannot be reliably placed in a
   candidate pool.
2. **The annotation table is not identifiable at achievable precision.** The
   required standardised-ICI tolerance of ~0.002 sits below the detector's onset
   grid for 1,240 of 1,501 files, and even at that tolerance only 32.7% of rows
   are unique.
3. **The measured audio does not present as single annotated codas** in either
   public table, at a distributional level, consistently across all five rigs.

This does **not** establish that the DSWP audio and the Sharma annotations are
unrelated — H1 alone could produce finding 3, and findings 1 and 2 are statements
about the instrument and the table. What it establishes is that the alignment
asserted in arXiv:2606.16084 is **not reproducible from public sources with this
measurement chain**, and that recovering it would require sub-hop onset
refinement, echo rejection, or per-coda ground truth — none of which exist here.

Recovering the join is therefore not the cheapest route to the phase-2 question,
and phase 2 does not need it.

### What the gate produced anyway

The fetch found **five recording configurations** in a corpus whose dataset card
states no per-file recording metadata exists — 846 / 368 / 219 / 42 / 26 files at
48 kHz stereo, 44.1 kHz mono, 120 kHz stereo, 96 kHz stereo, and 44.1 kHz stereo.
That is a free grouping variable, derived from file headers, over the exact audio
used in the coda-vowel work.

Given that Rendell's recording-artifact objection to the vowel claim is
unrebutted in the literature, and that Diamant et al. (*Ecological Informatics*,
June 2026) show the vowel measure responds to ambient acoustic conditions, a
five-way equipment split in the underlying audio is worth more than the join that
failed to be recovered. It is the input to the phase-2 artifact test, and it did
not require the join.

## What this will and will not license

Will not, whatever the outcome:

- **Anything about coda meaning, clan structure, or vowels.** This is a data
  provenance question.
- **A claim that arXiv:2606.16084 is wrong.** A failure here shows the alignment
  is not reproducible *from public sources with this instrument*. The authors may
  hold a correspondence not published; that is a different statement.
- **Per-file confidence for files in the broad mode.** Only the tight mode is
  usable downstream, and each downstream use must re-state the match threshold it
  relied on.

## Reproducing

```bash
python3 tools/fetch_corpus.py            # Dominica annotations
python3 tools/fetch_pacific.py           # Pacific annotations (N1 control)
python3 tools/fetch_dswp.py              # DSWP audio, incremental, ~585 MB
node    tools/exp06_gate.mjs             # G1-G4; must pass before matching
node    tools/exp06_match.mjs            # only runs if the gate JSON says pass
```

Audio and annotations land in gitignored paths. The Sharma deposit carries no
LICENSE file; DSWP is CC BY 4.0. Nothing is redistributed from here.
