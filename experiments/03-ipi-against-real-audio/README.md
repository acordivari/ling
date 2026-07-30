# 03 — Does the IPI estimator survive contact with real audio?

**Status:** first run 2026-07-29, **revised after adversarial review
2026-07-30**. Criteria were stated before the estimator was run on any real
file; several were then withdrawn as untestable and replaced. See *Corrections*
at the bottom, which records what the original criteria got wrong and why. The
revised criteria and the negative control were stated before the control was
run.

## Question

`explorer/README.md` has said from the beginning:

> The confidence floor (0.22) and the cycle-count cuts (20 against spectral
> centroid, 3 against zero-crossing rate) were set by measuring the synthetic
> sources in `library.js`, not derived from physics and not fitted to real
> recordings. **Re-check them against real DSWP audio before relying on any of
> this.**

That check had never been run. Every number the IPI estimator had produced came
from signals this repo synthesised — it had only ever been asked to recover a
structure put there on purpose, by the same code.

ASACTER makes the check possible: real sperm whale clicks, 192 kHz, CC BY 4.0,
from a population this project has never touched.

## Data

**ASACTER** — Acoustic Signature Database for Cetacean in Taiwan Eastern
Maritime Waters (Hualien Formosa Association & Turumoan Whale Watching,
figshare, CC BY 4.0, <https://creativecommons.org/licenses/by/4.0/>,
deposit <https://figshare.com/search?q=ASACTER>). 110 sperm whale records, 109
of them audio, **26.2 min** measured from the file headers, 2.15 GB, 192 kHz,
Western North Pacific (~121°42′E 23°51′N).

Format is **stereo 32-bit PCM** for 104 of the 109 files; only the five
coda-labelled `ASACTER_SW_20230709_0N.wav` files are mono 16-bit. Those five —
the lowest-fidelity subset of the deposit — are what this experiment uses, and
all five are hard-clipped (0.60–1.34 % of samples at digital full scale, 9.85 %
for file 05). Absolute levels are therefore meaningless, and clipping distorts
the very multipulse envelope an IPI estimator measures.

The 5 coda-labelled records (88 s nominal, voyage 20230709) were used. Clicks
were detected in a 2–20 kHz band, the 12 highest-energy clicks per file selected
**with a 30 ms minimum separation so no two segments share samples**, each
extracted with the following 30 ms, decimated 192 → 48 kHz, and passed to the
**shipped** `estimateIpi` in `explorer/js/dsp.js` — with `carrierHz` supplied
exactly as `analyze()` supplies it, so the spectral-centroid guard is exercised
rather than bypassed.

Four files yielded segments; **48 segments = 12 × 4**. File 05 yielded none, for
reasons that are about our detector and not about the file — see below.

```bash
python3 tools/fetch_asacter.py --audio coda
```

## Pre-registered criteria

### What is deliberately NOT a criterion

`estimateIpi` clamps its lag search to `minMs..maxMs` and returns
`bestLag / sampleRate`. **Every non-null return is inside 2–10 ms by
construction.** "All values were physically plausible" restates a constant in
the code under test. It cannot fail, so it is not scored, and it is *not*
evidence that the estimator declined to fabricate. The band is also a size prior
— the estimator very much *was* told roughly what size animal to expect.

Gordon (1991) body length is monotone over that band (7.74–19.26 m), so a
"6–18 m is plausible" check is ~89 % guaranteed given the bound, its lower edge
is unreachable, and 3 × the measured IPI still lands inside it — meaning it
cannot even detect a harmonic pick. Also reported, also not scored.

The **fire rate** is not scored either: with no ground-truth IPI for these
recordings, a miss cannot be distinguished from a correct refusal.

### What is scored

| # | Test | Pass |
|---|---|---|
| **N** | Material with no multipulse structure is refused | 0 fired |
| **C1** | Spread across non-overlapping segments | < 1 ms |
| **C2** | Values are not degenerate (a stuck estimator scores spread 0) | ≥ 2 distinct lag bins |
| **C3** | The value survives a change of lag grid (decimate to 96/64/48 kHz) | median drift ≤ one bin |

C2 and C3 exist because C1 alone is anti-correlated with the hazard it is meant
to catch: an estimator welded to a single lag bin scores spread 0.00, the
maximum possible pass. C3 is the real discriminator — a spermaceti reflection
delay is invariant in absolute time, an artefact of the autocorrelation bin grid
is not.

N is the control condition the first version of this experiment did not have,
which `CLAUDE.md` requires.

## Result

**Negative control: partial FAIL. Consistency: pass.**

```
N  NEGATIVE CONTROLS — material with no multipulse structure
     white noise                 0/24 fired   [pass]
     single pulse, no multipulse 0/24 fired   [pass]
     broadband impulse trains    8/8  fired   [FAIL]
       -> 4.42-10.00 ms, ALL inside the 2-10 ms band,
          confidence 0.39-0.77 vs 0.23-0.49 on the real clicks.

C  CONSISTENCY across 24 fired of 48 segments
     values                2.81 - 3.31 ms, median 2.83
     C1 spread < 1 ms      0.50 ms                                  [pass]
     C2 not degenerate     4 distinct lag bins [135, 136, 137, 159]  [pass]
     C3 grid invariance    96kHz->2.844, 64kHz->2.844, 48kHz->2.833
                           drift 0.010 ms vs one bin 0.0208 ms       [pass]

T  THRESHOLD MARGINS on the 24 real clicks that fired
     confidence floor 0.22   tightest 0.226   margin  +3%   (6 within 0.05)
     centroid cut     20     tightest 20.07   margin  +0.4%
     zcr cut          3      tightest 9.01    margin +200%
     tonal peak cut   6      worst    5

D  DERIVED, NOT SCORED
     in the 2-10 ms band   24/24 — true by construction
     Gordon (1991) length  8.9-9.6 m — monotone in the above
     fire rate             24/48
```

Per file:

| file | fired / segments | IPI values (ms) |
|---|---|---|
| `..._01.wav` | 2/12 | 2.83, 3.31 |
| `..._02.wav` | 5/12 | 2.83 ×4, 2.85 |
| `..._03.wav` | 10/12 | 2.81, 2.83 ×9 |
| `..._04.wav` | 7/12 | 2.83 ×6, 3.31 |
| `..._05.wav` | 0/**0** | — (no segments were extracted; see below) |

### The headline is the negative control, and it is a failure

A broadband impulse train — alternating-polarity clicks at a fixed rate, which
is what propeller cavitation looks like — is **not rejected**. Synthetic trains
at 120–450 Hz fire 8 out of 8, every one inside the 2–10 ms band, implying
sperm whales of 11–19 m.

Worse, they score *higher* confidence than any real click: 0.39–0.77 against
0.23–0.49. So raising the confidence floor to exclude them would delete every
real whale in this dataset first. The band does not separate them. The Gordon
length does not separate them. The spectral-centroid guard does not separate
them (their centroids sit near 7.3 kHz, comfortably past the 20-cycle cut).

The estimator *does* correctly refuse white noise (0/24) and single pulses with
no multipulse structure (0/24). Its refusal logic is real and does work. What it
cannot do is distinguish a genuine intra-click reflection delay from any other
periodic broadband structure at a plausible rate. **A single confident IPI from
vessel-adjacent audio is not evidence of a whale.** This is now recorded in
`explorer/js/dsp.js` at the function itself.

### The measurement on real clicks does hold up

2.83 ms survives everything thrown at it:

- **Grid invariance (C3).** Decimating 192 kHz by 2, 3 and 4 gives lag grids of
  0.0104 / 0.0156 / 0.0208 ms — genuinely different quantisation. The median
  moves by 0.010 ms, less than one bin of the coarsest. It is a delay in
  absolute time, not a bin artefact.
- **Not degenerate (C2).** The 24 values occupy 4 distinct lag bins
  (135/136/137/159), so the estimator is not welded to one output.
- **Not carried by low-frequency energy.** Band-passing the segments to the
  detector's own 2–20 kHz *at the native 192 kHz, before decimation* gives
  23/48 firing at 2.81–3.31 ms, spread 0.50 ms — unchanged.
- **Robust to the detector's knobs.** Raising the refractory from 8 to 10/12 ms
  and enforcing 30 ms separation between selected clicks leaves 24/48 at
  2.81–3.31 ms.

### Threshold margins — what `explorer/README.md` actually asked for

This, not a pass/fail, is the deliverable:

| threshold | value | tightest real click | margin |
|---|---|---|---|
| confidence floor | 0.22 | 0.226 | **+3 %**, 6 of 24 within 0.05 |
| spectral-centroid cycles | 20 | 20.07 | **+0.4 %** |
| zero-crossing-rate cycles | 3 | 9.01 | +200 % |
| tonal peak count | ≤ 6 | 5 | comfortable |

Two of the three cuts are *barely* clearing on real audio. The centroid cut in
particular is passed by 0.4 % — the tightest genuine sperm whale click in this
set is 0.07 cycles from being silently discarded. One caveat that cuts the other
way: centroids here are measured after decimation to 48 kHz, whose 24 kHz
Nyquist discards real click energy above it, so the measured centroid is
depressed and 20.07 is a **lower bound** on the true margin. The confidence
margin has no such excuse.

### File 05 was excluded by our detector, not by its content

```
ASACTER_SW_20230709_05.wav  0 clicks -> EXCLUDED BY THE DETECTOR:
    threshold 0.834 vs envelope max 0.816 (rms 0.498, 9.8% clipped)
  detections vs MAD multiplier k: k=8->0, k=6->84, k=5->215, k=4->412, k=3->718
```

The click detector is CFAR: it sets its threshold from the file's own
median/MAD. File 05 is 2.5× louder in rms than the files that worked, because it
contains vessel noise, so its own threshold rises to **0.834 — above the file's
maximum envelope value of 0.816.** Zero detections is arithmetic. A coda at full
scale could not have been found.

The depositor labels this file `clicks & codas (with engine sound)`. It is a
**positive** sample that our detector cannot reach — it is not a noise-only
control, and it must not be used as one. An earlier version of this writeup, and
the fetch tool's trap list, reported "the engine file yields zero click
detections" as a property of the deposit. That was our bug published as someone
else's data.

## What this licenses, and what it does not

Licensed:

- The IPI estimator returns a **consistent, grid-invariant, physically
  coherent** value on real recordings from an unfamiliar ocean, recording chain
  and animal. 2.83 ms is a real property of these clicks.
- The confidence floor and the ZCR cut do not collapse on real audio.

**Not** licensed:

- **The estimator does not reject periodic broadband artefacts.** See above.
  This is the most important thing the experiment found and it is a negative
  result.
- **No ground truth.** No independent IPI measurement exists for these animals,
  so this establishes plausibility and consistency, not accuracy. A systematic
  bias of a few tenths of a millisecond would be invisible.
- **One voyage, probably one animal.** This is within-animal repeatability, not
  independent replication. Unique audio is ~83 s, not 88 s: file 03 is a 5 s
  re-export of the opening of file 01 (Pearson r = 0.974). The selected clicks
  do *not* overlap — every click chosen from file 01 sits at t ≥ 7.6 s, outside
  the duplicated region — so no value is double-counted, but the corpus is
  smaller than the file listing suggests.
- **The centroid cut is 0.4 % from rejecting real whales.** It has not been
  validated so much as caught barely passing.
- **Animals below ~7.7 m are unreachable.** The 2 ms floor maps to 7.74 m via
  Gordon, so any size distribution this produces is censored from below —
  relevant for a nursery group, which would contain calves.
- **The estimator is size-selective by construction.** The autocorrelation
  divides every lag by the full-window energy, so only (N−lag) of N products
  contribute at lag: a 10 ms peak is penalised 46 % relative to a 2 ms one
  before any signal is considered. It is therefore least sensitive to the
  *largest* animals, whose IPI feeds a body-length regression. Left as-is
  deliberately — see *Corrections*.
- **50 % of segments returned nothing**, excluded from scoring by design. The
  breakdown: 21 below the confidence floor, 2 rejected as tonal, 1 caused by the
  harness (see *Corrections*).
- **Nothing about codas.** See below.

## ASACTER is not a second coda corpus

Worth stating plainly, because the reason it was pursued was to answer the
clan-timing question left open by experiment 01, and **it cannot**:

- Only **5 of 110** records are labelled as containing codas — 88 s nominal
  (~83 s distinct), one voyage — and the depositor's labels for the other 105
  records are labels, not measurements. Nothing in this repo has listened to
  them.
- **There are no clan, social-unit or individual labels of any kind.**

The second point settles it on its own, from the index alone, without any audio:
experiment 01 concluded that the question needs genuine repertoire overlap
between *labelled* clans, and unlabelled audio cannot supply that however much
of it there is. ASACTER is a fourth ocean basin and a redistributable licence,
and those are worth having — but not for that question.

An earlier version of this section rejected three "coda candidates" recovered by
a click detector, on the grounds that their ICIs of 0.008–0.013 s were "below
the 10 ms intra-click IPI floor". That argument is withdrawn: 13 ms is not below
10 ms, this same experiment measures the intra-click IPI at 2.83 ms, and — most
importantly — the detector's own 8 ms refractory left-censors the ICI
distribution at exactly the values being interpreted (pooled minimum ICI:
8.026 ms). Those numbers measured the detector, not the animal. No tool in this
repo reproduces the nPVI figures that were also quoted, so they are withdrawn
too.

For the record, the order-of-magnitude argument does hold: real Dominica coda
ICIs (n = 34,450) have a median of 170 ms and a 1st percentile of 31 ms, so
intervals of 8–13 ms are far below anything in a real coda. That corpus was
itself cleaned with a `min(ICI) ≥ 10 ms` rule (`tools/fetch_corpus.py`), which
makes the comparison partly circular at the very bottom — but p1 = 31 ms is 3×
the cut and not forced by it. **None of this affects the conclusion**, which is
over-determined by the missing labels.

## Corrections

This experiment was rewritten after adversarial review. What changed:

1. **P1 retracted.** "Every returned IPI lies inside the 2–10 ms band: 24/24"
   was a tautology — `estimateIpi` cannot return anything else. It was
   originally read as showing the estimator "did not lock onto an engine
   harmonic once in 24 firings"; that reading was unsupported, and the negative
   control now shows the opposite is true.
2. **P3 retracted** as a criterion, for the same reason at one remove: Gordon is
   monotone over the band, so it is ~89 % entailed by P1.
3. **A negative control was added.** The original had none, which violates the
   `CLAUDE.md` convention.
4. **`carrierHz` is now supplied** as `analyze()` supplies it, so the shipped
   centroid guard runs. It changes nothing here (24/48 either way, 0 segments
   killed) but it was previously untested, and the reported 0.4 % margin is the
   result.
5. **Segments no longer overlap.** Selection now enforces 30 ms separation and
   the detector refractory is derived from the estimator's own 10 ms maximum
   rather than hard-coded to 8 ms. "Independent segments" is now earned.
6. **P2 is two-sided.** Added the non-degeneracy and grid-invariance checks. The
   original's defence of the repeated 2.83 ms as "lag quantisation, not a stuck
   value" was written after seeing the result and was unfalsifiable as stated;
   C3 is the falsifiable version, and it passes.
7. **The analysis window is 19.33 ms, not 30 ms.** `estimateIpi` clips at the
   next supplied onset, so 10.67 ms of every extracted 30 ms segment never
   reaches the autocorrelation. The harness supplies onsets `[0.5 ms, 20 ms]` by
   hand. This is deliberate and is a documented bypass of the estimator's
   next-onset bound: `analyze()` finds exactly **one** onset in a 30 ms segment,
   so passing real onsets makes the estimator return null on all 48. The cost is
   1 of the 24 non-firings, which is a harness artefact rather than a refusal.
8. **File 05's table row is 0/0, not 0/12**, and 48 = 12 × 4 contributing files.
9. **The corpus description was wrong in five places**, all now corrected in
   `tools/fetch_asacter.py` and the root `README.md`, and all now *derived* from
   the deposit rather than asserted:
   - format is stereo 32-bit for 104 of 109 files, not mono 16-bit — the old
     claim generalised from the five coda files that happened to be on disk.
     The tool now range-fetches each file's `fmt` chunk (96 bytes) instead.
   - duration is **26.2 min**, not 17.4 min. The old figure summed `_Nsec`
     filename tokens over the 92 files that carry one, and the 17 that do not
     include the longest files in the deposit.
   - the 2027 typo is in record 30335251's *title*; its `voyage_date` and
     filename both read 2025 correctly. Deriving the check generically finds
     **4** date disagreements, not one.
   - "18 files with no duration token" conflated 17 untokened WAVs with 1 record
     that has no audio at all. 110 records = 109 audio files.
   - two records declare the same WAV filename with identical bytes, so the old
     flat download layout silently mapped 110 records onto 108 files while
     reporting success. Downloads are now namespaced per record id, verified
     against the index's byte count, written via a `.part` file, and cleaned up
     on `KeyboardInterrupt` (which `except Exception` never caught).
10. **The nPVI figures and the "engine file yields zero detections" trap are
    withdrawn** from the tool, the index and this writeup. No code in this repo
    reproduced the nPVI numbers, and the zero-detection claim was our detector's
    CFAR threshold reported as a property of someone else's dataset.

Two review findings were investigated and **rejected**:

- *"Supplying `carrierHz` cuts firing from 24 to 21."* It does not. Measured
  three ways including the exact `analyze()` path: 24/48 with the guard, 24/48
  without, 0 segments killed.
- *"Filtering segments to the detector's 2–20 kHz passband doubles the spread to
  0.96 ms."* Only if the filter is applied **after** decimation, which is an
  extra filter stage the detector never applies, on a 1440-sample window whose
  edge ringing manufactures the extra value. Applied at the native 192 kHz where
  the detector's own filter lives, the spread is 0.50 ms — unchanged.

One finding is **accepted as a limitation rather than fixed**: the biased
autocorrelation normalisation (dividing every lag by full-window energy). The
triangular taper is real and is documented above and in `dsp.js`, but replacing
it with a coherent per-lag normalisation was measured and is strictly worse —
16/48 firing instead of 24/48, spread 1.02 ms instead of 0.50, and a new 2.29 ms
outlier. The taper suppresses high-variance long-lag peaks, which is what it is
conventionally there for.

## Reproducing

```bash
python3 tools/fetch_asacter.py --audio coda        # ~34 MB, CC BY 4.0
./wham/.venv/bin/python tools/asacter_ipi_check.py # everything above
cd explorer && npm test                            # the IPI guards
```

`tools/asacter_ipi_check.py` prints every number in the Result section verbatim
— the negative controls, the consistency criteria, the threshold margins, the
grid-invariance sweep, the null-reason census, the per-file table and the file-05
k-sweep. Needs numpy/scipy (`wham/.venv`) and node.

Four figures quoted elsewhere in this writeup come from other places, so that no
number here is unattributable:

| figure | source |
|---|---|
| corpus format, duration, trap list | `python3 tools/fetch_asacter.py` (writes `data/asacter/index.json`) |
| Dominica ICI median 170 ms, p1 31 ms, n = 34,450 | `explorer/data/coda-corpus.json` via `tools/fetch_corpus.py` |
| file 03 ≈ file 01's first 5 s (r = 0.974); file 01's picks all at t ≥ 7.6 s | one-off cross-correlation, not shipped |
| coherent-normalisation comparison (16/48, spread 1.02) | one-off variant of `estimateIpi`, not shipped |

The last two were run to adjudicate review findings and are deliberately not
part of the tool — the first is a property of the deposit, the second is a
counterfactual about code that was decided against.

Cite: Hualien Formosa Association & Turumoan Whale Watching, *ASACTER: Acoustic
Signature Database for Cetacean in Taiwan Eastern Maritime Waters*, figshare,
CC BY 4.0 (<https://creativecommons.org/licenses/by/4.0/>).
