# 07 — Is the coda-vowel distinction a recording or analysis artifact?

**Status: OPEN. Two results established — the measurement grid, and the
individual-versus-composition test across three levels of clustering. The
recording-artifact test itself is blocked on a rig label per coda, which
experiment 06 could not deliver.**

## Question

Beguš, Dąbkowski, Sprouse, Gruber & Gero (*Proc R Soc B* 293:20252994, 15 April
2026) report that sperm whale codas carry vowel-like spectral structure — an a/i
distinction, with coarticulation and diphthong-like trajectories.

Luke Rendell's objection, stated publicly and with a mechanism, is that a single
sperm whale click is a rapid succession of pulses, and those pulses imprint
ripples on a spectrum that resemble the reported pattern. On that reading the
"formants" are click structure, not phonology.

**That objection is unrebutted in the peer-reviewed literature.** There is no
Matters Arising, no Comment, and no reply article. The authors' stated response —
that the same pattern appears in other laboratories' recordings made on different
equipment — was unpublished as of August 2026.

`CLAUDE.md` lists this as planned experiment 5 and flags it, correctly, as "a live
open question rather than a replication."

### Why it is more urgent than it was

Three things converged in 2026:

1. **Diamant, Gruber, Gero & Beguš**, *Ecological Informatics*, June 2026 —
   ship noise shifts the a/i distribution and compresses ICIs. The dependent
   variable is the mismatched-click count from the vowel pipeline itself. This is
   the authors' own evidence that **external acoustic conditions move the
   classification**.
2. **The public DSWP audio carries five recording configurations** — 846 / 368 /
   219 / 42 / 26 files at 48 kHz stereo, 44.1 kHz mono, 120 kHz stereo, 96 kHz
   stereo and 44.1 kHz stereo. Measured from WAV headers in
   [experiment 06](../06-audio-annotation-join/), in a dataset whose card states
   no per-file recording metadata exists.
3. **The vowel annotations are public** (`Project-CETI/coda-vowel-phonology`,
   OSF `9t6qu`) and join to `sperm-whale-dialogues.csv` on `Duration` at 96.6%
   matched, 93.5% uniquely — giving vowel labels, per-click spectral peaks, full
   ICI vectors, timestamps, and **13 named individuals** in one table.

## Established: the measurement grid

`tools/exp07_vowel_grid.py`. No audio, no join, no null model — the relation is
exact arithmetic.

The four spectral columns in `codasp.csv` (`meandist_pk1`, `meandist_pk2`,
`meandiff_pk1`, `meandiff_pk2`) do not take arbitrary values. A first pass
suggests they are multiples of a single constant, and that is wrong. They are
**means over a coda's detected peaks of a per-click quantity that is an integer
multiple of 58.59375 Hz**:

```
exact integer at some denominator d <= nClicks:  3,362 of 3,362 = 100.00%
denominators used:  d=1:3044   d=3:108   d=5:105   d=7:49   d=2:42   d=9:14
```

Every value, in all four columns, with no exceptions.

**58.59375 Hz is an FFT bin width.** 58.59375 × 2048 = **120 000 Hz exactly** —
and 120 kHz is one of the five recording configurations present in the public
DSWP audio (219 files). The same quantum is also consistent with 60 kHz/1024 and
240 kHz/4096.

### What the vowel distinction rests on

| column | mean(a) | mean(i) | difference | in bins | n(a) | n(i) |
|---|---|---|---|---|---|---|
| `meandist_pk1` | 358.7 Hz | 231.8 Hz | **+126.9 Hz** | **+2.17** | 745 | 397 |
| `meandiff_pk1` | 205.8 Hz | 129.0 Hz | **+76.8 Hz** | **+1.31** | 745 | 397 |

**The a/i separation is one to two bins of the analysis grid.**

### What this does and does not license

**It does not refute the vowel claim, and must not be reported as if it does.** A
mean difference of 2.17 bins over 745 against 397 codas can be both statistically
robust and physically real; a ~127 Hz formant difference is entirely plausible.
Coarse quantisation adds noise, and noise ordinarily *works against* finding a
difference rather than manufacturing one.

What it establishes is the **resolution the claim is stated at**, which was not
previously available in a form anyone could check: the discriminating variable is
measured in 58.59 Hz steps and the categories differ by one to two steps.

### The question it opens, which this deposit cannot answer

If a **fixed** FFT size was applied across audio recorded at five different
sample rates without first resampling to a common rate, then the bin width — and
therefore any measured peak distance — varies with recording equipment by up to
**2.7×** (1.07 ms/58.59 Hz at 120 kHz against 2.90 ms/159.5 Hz-equivalent at
44.1 kHz for the same nFFT).

That is precisely the confound Rendell's objection predicts, and it is now a
specific, answerable question rather than a general worry.

**Whether resampling occurred cannot be determined from the public deposit.** The
CSV carries no sample-rate, file, or rig column. Resolving it needs either the
analysis code or a rig label joined to each coda — and
[experiment 06](../06-audio-annotation-join/) established that the audio↔annotation
join is not recoverable with this repo's measurement chain.

## Is the vowel a property of the individual, or of repertoire composition?

`tools/exp07_vowel_individual.mjs`. Pre-registered: `MIN_N` 15, `MIN_LEVERAGE`
33.3, 4,000 shuffles, seed 707, FDR at q < 0.05, all fixed before any p was run.

Rendell's mechanism runs through click structure, and intra-click pulse spacing
scales with body size. If the a/i categories track that, vowel should be a stable
property of an **animal**. If it is phonology, it should vary within an animal by
context. So: do named whales differ in vowel usage?

They differ enormously at face value — SOURSOP 0%, SAM 9.6%, TWEAK 13.3% against
SOPH 50%, PINCHY 44.3%, ATWOOD 42.1%. But whales differ in repertoire (ATWOOD is
260/359 type `1+1+3`; SAM is 45/52 type `5R1`) and **coda type predicts vowel on
its own**: `1+1+3` is 46.1% "i", `5R1` is 7.7%, `8i` is 0.0%. This is experiment
01's composition confound one level up.

### Leverage first, before any p-value

Within-coda-type leverage — Σ over shared types of *n₁n₂/(n₁+n₂)* — for all 45
whale pairs:

```
36 pairs   median leverage 18.4   range 2.7 - 131.7
28 of 36 pairs fall BELOW experiment 01's leverage of 33.3
```

Experiment 01 declared a design with leverage 33.3 **underpowered**. Over
three-quarters of the whale pairs here sit below that, so they were excluded from
testing rather than reported with p-values that could not mean anything. The
threshold was fixed in advance.

(Counts are over the 1,115 codas that survive the bout join below, so they differ
slightly from a pass on the raw vowel table: 9 whales clear `MIN_N` rather than
10, and JOCASTA/PINCHY falls just under the leverage threshold.)

### The bout join

`tools/exp07_join_bouts.py`. The vowel deposit carries named individuals but no
recording identifier; `sperm-whale-dialogues.csv` carries `REC` — the DTag
sub-recording — but no vowel labels. They join on **`Duration`**.

That key works here for a reason that experiment 06 established by failing: this
is an **exact float match between two tables that inherit the same annotated
numbers**, a shared primary key rather than a measurement. Matching a *measured*
duration against these tables is hopeless — 3.1% unique at 0.5 ms tolerance.

```
codamd 1,375   dialogues 3,840
uniquely matched  1,297 (94.3%)    ambiguous 30    unmatched 48

V1  every joined row is dialogue speaker index 1 (focal-only)      PASS
V2  nClicks agrees with the codatype-implied count  1,293/1,297    PASS  99.7%
S   unattributed rows (blank `whale`): 58, of which 0 vowel-labelled — dropped
V3  bouts spanning >1 named whale         0 of 135                 PASS
V4  deployments spanning >1 named whale   0 of 20                  PASS
V5  dialogue rows claimed by >1 named vowel row   0                PASS
```

Two of those checks earned their place on the first run.

**The blank-`whale` sentinel.** 108 rows carry an empty whale name. Read naively
it becomes a 14th animal, and two bouts then appear to span two whales — which is
what V3 caught. It is the same trap family as `IDN == 0` in `DominicaCodas.csv`
(unidentified, not whale zero) and the `ZZZ` unknown-unit sentinel that
manufactured C(13,3) in experiment 01. None of the 108 carry a vowel label, so
dropping them costs this analysis nothing.

**V5, injectivity the other way.** A duration unique on the dialogue side can
still be claimed by two vowel rows. Checking one direction only would have missed
it: exactly one such collision exists — PINCHY's `1+1+3` and an unnamed `5R3`,
both at 1.1856 s — and dropping the sentinel resolves it.

Result: **1,115 vowel-labelled codas across 135 bouts, 20 deployments, 13 named
whales.**

### The structure that decides what is answerable

| whale | codas | bouts | deployments |
|---|---|---|---|
| ATWOOD | 354 | 17 | **1** |
| FORK | 288 | 32 | 3 |
| PINCHY | 139 | 17 | **1** |
| TBB | 109 | 16 | 3 |
| JOCASTA | 53 | 11 | 2 |
| SAM | 49 | 8 | **1** |
| FRUIT | 32 | 6 | **1** |
| LAIUS | 29 | 5 | 2 |
| SOPH | 27 | 4 | **1** |

**9 of 13 whales were recorded in exactly one deployment.** Whale identity is
therefore near-perfectly confounded with recording session: for most animals
there is no way to ask whether this whale sounds different or this *tag
deployment* sounds different, because there is only one. That is the same shape
as experiment 04's Palindrome result, where every apparent clan effect turned out
to be recording era.

### The eight testable pairs — arm A

| pair | leverage | observed | null | explained by null | p | q |
|---|---|---|---|---|---|---|
| ATWOOD/FORK | 131.7 | 0.045 | 0.031 | 69% | 0.2722 | 0.3629 |
| ATWOOD/PINCHY | 91.8 | 0.012 | 0.038 | — | 0.8295 | 0.8295 |
| FORK/PINCHY | 77.3 | 0.057 | 0.055 | 96% | 0.4589 | 0.5244 |
| ATWOOD/TBB | 66.7 | 0.179 | 0.141 | 79% | 0.2299 | 0.3629 |
| PINCHY/TBB | 50.8 | 0.191 | 0.119 | 62% | 0.1127 | 0.3006 |
| FORK/TBB | 43.0 | 0.134 | 0.065 | 49% | 0.0502 | 0.2009 |
| **ATWOOD/JOCASTA** | 41.7 | 0.276 | 0.137 | 50% | **0.0082** | 0.0660 |
| JOCASTA/TBB | 34.2 | 0.097 | 0.061 | 63% | 0.2567 | 0.3629 |

**FDR across the 8 tested pairs: 0 significant at q < 0.05.**

ATWOOD/JOCASTA (p = 0.0082) would read as a finding uncorrected. It does not
clear Benjamini-Hochberg at rank 1, where the threshold is 0.0063. The
`explained by null` column is the substantive result: **49–96% of every raw
between-whale difference is repertoire composition**, and for ATWOOD/PINCHY the
null exceeds the observed, so no percentage is quoted — the guard experiment 01
installed for exactly this case.

### What this does and does not say

**It does not say vowel is independent of the individual.** It is a null from an
underpowered design, and that distinction is the single most-repeated lesson in
this repo — experiment 01 published "null result" twice and had to retract it
both times before settling on "underpowered, cannot tell."

What it says: **the public vowel data cannot demonstrate that vowel usage is an
individual property, and most of the apparent individual signal is which codas
each whale produces.**

### The clustered arms — the ladder

Arm A above permutes at coda level, treating codas from one whale in one bout as
independent draws. Experiment 04 measured that substitution against ground truth
and found it **anti-conservative**: 101 of 126 true-null splits shifted *p*
downward, sign test p = 5e-12. So arms B and C re-run the identical statistic
through the shipped joint null — residualise by coda type, then permute whale
across whole clusters.

| arm | permutation unit | negative control | significant | not testable |
|---|---|---|---|---|
| **A** | coda | 1/28 = 3.6% | 0 of 8 | — |
| **B** | **bout** (135) | 0/24 = 0.0% | 0 of 8 | — |
| **C** | **deployment** (20) | **cannot be run** | 0 of 1 | **7 of 8** |

The negative control splits a single whale against itself, which is a true null by
construction; for the clustered arms the split is over whole bouts, since
splitting codas would hand the permutation a structure the real design never has.
Arms A and B sit at or below the nominal 5%. **Arm C cannot run one at all** — no
within-whale split has enough deployments — which is the same fact the ladder
reports, arriving from the other direction.

Arm B has no resolution problem whatsoever — assignment counts run from 1.3 × 10⁷
to 6.5 × 10¹², so unlike experiment 01's C(12,2) = 66 there is no floor anywhere
near the decision threshold. What changes is the p-values:

| pair | leverage | p, arm A (coda) | p, arm B (bout) |
|---|---|---|---|
| **ATWOOD/JOCASTA** | 41.7 | **0.0082** | **0.3857** |
| FORK/TBB | 43.0 | 0.0502 | 0.5604 |
| PINCHY/TBB | 50.8 | 0.1127 | 0.5431 |
| ATWOOD/TBB | 66.7 | 0.2299 | 0.7976 |
| ATWOOD/FORK | 131.7 | 0.2722 | 0.8078 |

**ATWOOD/JOCASTA moves from p = 0.0082 to p = 0.3857 — a factor of 47 — purely
by counting bouts instead of codas.** It was the strongest pair in arm A and the
one that came closest to surviving FDR. Experiment 04 predicted this direction
from a ground-truth calibration on a different corpus, and it reproduces here.

Arm C is where the design runs out. Only **FORK/TBB** has enough deployments to
permute at all (3 + 3, C(6,3) = 20, a floor of exactly 0.05); the other seven
pairs have C = 2, 3, 4, 4, 4, 4 and 10. Those are recorded as **not testable**,
not as nulls — the distinction experiment 04 insisted on for its eight
non-computable clan pairs.

**Every arm returns nothing significant, and each arm returns nothing for a
different reason**: arm A because the composition null already absorbs 51–164% of
the raw difference, arm B because bout-level clustering removes what remained,
arm C because whale identity and recording session are the same variable for 9 of
13 animals.

One detail still worth chasing: **`6-NOISE` codas show the highest "i" rate in the
corpus at 64.5%.** Noise-labelled codas being the most vowel-positive, in a corpus
whose own authors have shown the vowel measure responds to ambient noise, is a
convergence rather than a coincidence.

## Infrastructure this required

`permutationTest` in `explorer/js/rhythm.js` **threw** when `strata` and
`clusters` were supplied together — the one test experiment 01 needed, which had
to be written by hand outside the module. It now runs the joint null: residualise
each item against its stratum mean, then permute labels across whole clusters.

Every joint result carries **`leverage`**, the effective within-stratum sample
size, beside `p`. Experiment 01 established that a joint p is uninterpretable
without it. Validated against that experiment's published figures — leverage
33.31 on 6,038 codas across 12 social units, C(12,2) = 66 assignments enumerated
exactly, reproducing the observed 0.00145 — and the exact p of 64/66 = 0.9697
replaces the seed-dependent 0.9630 that wobbled across 0.9630/0.9660/0.9715/0.9770.

Twelve new assertions; suite now 311 across four suites, byte-identical across
runs.

## Next, and not yet run

- Pre-register the individual-vs-composition test properly, with the joint
  strata × cluster null. Note that `permutationTest` in `explorer/js/rhythm.js`
  **throws** when `clusters` and `strata` are combined — the exact test
  experiment 01 needed and had to do harness-side. That needs building first.
- Test whether vowel category tracks anything that proxies body size. Rendell's
  mechanism runs through intra-click pulse structure, so IPI is the direct
  measurement, and IPI maps to body length via Gordon (1991). Experiment 03 built
  and validated that estimator against real audio — but it needs audio joined to
  vowel labels, which experiment 06 could not deliver.
- Ask whether the `6-NOISE` result survives controls, or is simply the NOISE rows
  that this repo's other corpora already exclude.

## Reproducing

```bash
python3 tools/exp07_vowel_grid.py           # fetches codasp.csv, recovers the grid
node    tools/exp07_vowel_individual.mjs    # leverage pass, then the pairwise test
```

The deposit is public (`Project-CETI/coda-vowel-phonology`, OSF `9t6qu`). Fetched
on demand into a gitignored path; nothing redistributed here.
