# 07 — Is the coda-vowel distinction a recording or analysis artifact?

**Status: OPEN. One result established (the measurement grid). The artifact test
itself is not yet run and is not yet fully pre-registered.**

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

## Also established, from the annotation table alone

A first pass on individual-level vowel usage, 1,142 hand-labelled codas, 13 named
whales, using this repo's stratified-permutation machinery:

| null | z | p | explained by null |
|---|---|---|---|
| free shuffle | +3.84 | 0.0023 | 47.6% |
| **shuffle within coda type** | **+1.37** | **0.0923** | **84.6%** |

**85% of the apparent individual-level vowel effect is repertoire composition** —
experiment 01's confound, one level up. The raw cross-tabulation is stark: coda
type `1+1+3` is 46.1% "i" while `5R1` is 7.7% and `8i` is 0.0%, so vowel is
substantially predicted by which coda type an animal produces.

Two caveats, both load-bearing. This is a preliminary pass, not a pre-registered
test. And p = 0.0923 over 10 whales with n ≥ 15 is **underpowered, not null** —
the same trap experiment 01 fell into and had to retract twice.

One detail worth chasing: **`6-NOISE` codas show the highest "i" rate in the
corpus at 64.5%.** Noise-labelled codas being the most vowel-positive, in a corpus
whose own authors have shown the vowel measure responds to ambient noise, is a
convergence rather than a coincidence.

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
python3 tools/exp07_vowel_grid.py     # fetches codasp.csv, recovers the grid
```

The deposit is public (`Project-CETI/coda-vowel-phonology`, OSF `9t6qu`). Fetched
on demand into a gitignored path; nothing redistributed here.
