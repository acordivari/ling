# 09 — Do rubato and ornamentation survive controls?

**Status: RUN. Ornamentation does not survive; rubato does — half the
pre-registered prediction was wrong.**

Everything from [Question](#question) through [Nulls](#nulls) and the
[prediction](#pre-registered-prediction) was frozen before the first test
statistic was computed and is unchanged below. Results are in
[Result](#result).

## Question

Sharma, Gero, Payne, Gruber, Rus, Torralba & Andreas, *Nature Communications*
15:3617 (7 May 2024) report that sperm whale codas carry a combinatorial
structure — a "phonetic alphabet" — built from four dimensions: **rhythm**,
**tempo**, **rubato** and **ornamentation**.

Two of those four are properties of an **exchange**, not of a coda:

- **Rubato** — successive codas in an exchange vary smoothly in duration.
- **Ornamentation** — an extra click marks codas at the edge of a sequence.

> **Do either survive a control for which coda types are being produced, and for
> how the sequences were cut?**

### Why this is worth doing

**No formal critique of the paper exists.** No Matters Arising, no Comment, no
erratum, no correction, no editor's note — checked on the PMC record. Thirteen
citations. The claim is fifteen months old, widely reported, and has never been
independently controlled.

It is also the natural successor to
[experiment 08](../08-turn-taking/), which established that an "exchange" in this
corpus is **not** a clean alternating sequence: 40.6% of adjacent cross-speaker
coda pairs overlap in time, and no turn-taking signal survives. If exchanges are
two animals calling over each other, then "successive codas in an exchange" is a
sequence that mixes speakers — and duration drift across it could be alternation
between two whales with different mean durations rather than either whale
modulating anything. That is experiment 01's composition confound relocated to
the sequence level.

## What makes this testable: the authors' own labels are public

The `sw-combinatoriality` deposit ships pickled per-coda classifications that are
**aligned 1:1 with `sperm-whale-dialogues.csv`**:

| file | contents | length |
|---|---|---|
| `ornaments.p` | binary ornamentation flag per coda | 3,840 |
| `rhythms.p` | rhythm-class index per coda, 18 classes | 3,840 |
| `mean_codas.p` | the 18 class centroids, as cumulative normalised ICI profiles | 18 |
| `tempos-dict.p` | 5 populated tempo classes (a 6th is empty), 3,808 values | — |

So this experiment tests **the authors' own classifications**, not a
reimplementation of their definitions. That removes the most common way an
independent check goes wrong.

`rhythms.p` matters for a second reason: `sperm-whale-dialogues.csv` carries no
coda-type column, so until now there was no way to stratify exchange-level
analysis by coda type. It supplies exactly that.

**Safety note.** Unpickling executes arbitrary code. These were disassembled with
`pickletools.dis` before loading: `ornaments.p` and `rhythms.p` contain no
`GLOBAL` opcodes at all (pure data), and the other two reference only
`numpy.ndarray`, `numpy.dtype` and `numpy.core.multiarray`.

## Gates

### G1 — alignment, validated independently

The claim "`rhythms.p[i]` describes row *i*" is an assumption until checked. It
has an independent test: each rhythm class centroid in `mean_codas.p` has a click
count, which must match that row's own `nClicks`.

```
nClicks == len(mean_codas[rhythms[i]])     3,673 / 3,840 = 95.65%
```

**Pass: ≥ 95% agreement, with every mismatch confined to a residual class.** Met
— but not for the reason first written here, and the correction is the more
useful finding.

#### Correction, made when the gate failed

This section originally read: *"All 167 mismatches are long click trains — 11 to
21 clicks — assigned to the 10-click class… the classifier's ceiling."* That was
inferred from the eight most common mismatch pairs and **it was wrong.** The gate
was coded to the claim as written, and it failed: only 153 of 167 sit at the
ceiling. The other **14 are 1- and 2-click entries**, which are shorter than the
smallest real class (3 clicks) and so have nowhere to go either.

Both groups land in the same place. **All 167 mismatches are class 17, and zero
are outside it.**

Class 17 is not a rhythm class. It is a residual bucket, and the comparison that
proves it is class 14, which shares the same 10-click centroid:

| class | centroid | members | click counts held |
|---|---|---|---|
| 14 | 10 clicks | 13 | **all exactly 10** |
| **17** | 10 clicks | **175** | **1 – 29** |

So the gate now **detects** residual classes rather than hardcoding one: a class
whose members' click counts mostly disagree with its own centroid is a bucket,
not a category. That rule finds class 17 and nothing else.

**Class 17 is excluded from all downstream analysis**, and this matters for the
statistics below: it holds 175 codas including 13 ornamented ones, so leaving it
in would let unclassifiable material carry ornamentation signal.

#### This is the fifth instance of the same trap

Every corpus this project has touched ships a sentinel that reads as a category
unless you check:

| corpus | sentinel | reads naively as |
|---|---|---|
| `DominicaCodas.csv` | `IDN == 0` | "whale zero" |
| `DominicaCodas.csv` | `Unit == 'ZZZ'` | a 13th social unit |
| `DominicaCodas.csv` | `*-NOISE` coda types | ordinary coda types |
| `codamd.csv` | blank `whale` | a 14th named individual |
| **`rhythms.p`** | **class 17** | **a 10-click rhythm class** |

Each one inflates a count, a cluster set, or a category if taken at face value.
Experiment 01 manufactured C(13,3) = 286 against a true C(12,2) = 66 by counting
`ZZZ`. The check is cheap and has paid off five times.

### G2 — data traps

- **8 codas have `Duration` exactly 0**, and all 8 have `nClicks == 1`. A single
  click has no inter-click interval, so it has no rhythm and cannot participate
  in a duration sequence. Excluded, and recorded here rather than silently
  filtered.
- `tempos-dict.p` values reconstruct to coda durations for only **93.3%** of
  rows, so tempo class is *not* cleanly invertible to a per-coda label. **This
  experiment therefore does not use `tempos-dict.p`**; rubato is tested against
  `Duration` directly, which is what the tempo classes discretise anyway.

### G0 — dual-tag deduplication

Carried unchanged from experiment 08. The `a`/`b`/`c` suffix in `REC` is a tag
letter, not a session: deployments carry several DTags at once, so the same
acoustic scene appears more than once with independently assigned speaker
indices. Retain one tag per deployment — the one contributing the most codas.

## The confound, measured before any test

Ornamentation is **strongly associated with rhythm class**:

| class | n | ornamented | rate |
|---|---|---|---|
| 10 | 33 | 22 | **0.667** |
| 16 | 94 | 56 | **0.596** |
| 11 | 43 | 9 | 0.209 |
| 9 | 34 | 7 | 0.206 |
| 7 | 54 | 9 | 0.167 |
| 17 | 175 | 13 | 0.074 |
| **2** | **2,359** | **14** | **0.006** |
| 0 / 5 / 15 | 272 / 39 / 29 | 0 | 0.000 |

Predicting the ornamentation flag from rhythm class alone gives **19.2% error
reduction** over the majority-class baseline (0.9682 against 0.9607), z = +122
against a label-shuffle null.

Also: **140 of the 151 ornamented codas have exactly their class's click count.**
Ornamentation is not an extra click *relative to the assigned class* — the class
absorbs it. Classes 16 and 10 look like ornamented variants in their own right.

> **So a positional test of ornamentation that does not stratify by rhythm class
> is not testing ornamentation. It is testing where classes 16 and 10 occur.**

That is the whole design problem, and it is the same one experiment 01 spent four
conclusions learning. Crucially the confound is strong but **not total** —
classes 16 and 10 are 60–67% ornamented, not 100% — so within-class leverage
exists and the stratified test is possible rather than vacuous. Leverage is
reported before any p-value, as in experiments 04 and 07.

## Statistics

**S1 — ornamentation is positional.** Is an ornamented coda more likely to be
sequence-final than a non-final one?

    P(ornamented | final) − P(ornamented | non-final),  stratified by rhythm class

**S2 — rubato is smooth.** Does coda duration vary *smoothly* across a sequence,
rather than arbitrarily?

    lag-1 autocorrelation of duration within a sequence, stratified by rhythm class

Stratification is not optional for S2 either: rhythm class largely determines
duration, so a run of one class produces duration autocorrelation with no
modulation by any whale.

## The sequence definition, and why it is swept

Neither claim is defined without a notion of "sequence", and the deposit does not
ship one. This experiment defines a sequence as **consecutive codas by the same
speaker within one recording, separated by no more than `GAP` seconds**, and
**sweeps `GAP` over 3, 5, 10, 15, 30 s**.

The sweep is not a robustness afterthought — it is a pre-registered
falsification device. A first-pass probe found that strictly monotone duration
drift occurred in **30.4% of length-4 runs against 8.3% by chance, but collapsed
to near-chance at every longer length**. A real drift should become *more*
detectable in longer runs, not less. That pattern is the signature of a
segmentation artifact, and a statistic that moves with `GAP` is measuring the
cut, not the whale.

Same-speaker runs are used deliberately, given experiment 08: a cross-speaker
"exchange" mixes two animals with different mean durations, which would
manufacture S2 outright.

## Nulls

| statistic | null | destroys | preserves |
|---|---|---|---|
| S1 | permute the ornament flag **within rhythm class** | any association with position | class composition and per-class ornament rate |
| S2 | shuffle durations **within sequence** | order, hence smoothness | the exact multiset of durations in that sequence |
| S2b | shuffle durations **within sequence × class** | order | composition too |

S2's within-sequence shuffle is the right null because it holds the sequence's own
duration distribution fixed and destroys only the ordering — which is precisely
what "smooth variation" asserts.

**Negative control:** runs split in half at random and tested against themselves
must fire at about α. Reported for every arm, as in experiment 07.

## Pre-registered prediction

**Neither survives.**

For ornamentation: a first-pass probe found the final coda of a run averages
**0.18 fewer** clicks than the preceding ones — the opposite of the published
direction — and the flag is 19.2%-predicted by rhythm class before position is
considered at all.

For rubato: the length-dependence above is the wrong shape for a real effect.

Stated in advance because a positive result here would be far more interesting
than a negative one, and that asymmetry is exactly the pressure that produces
unreplicable findings.

**What would falsify the prediction:** either statistic surviving its stratified
null at every `GAP` in the sweep, with leverage above the 33.3 floor this project
inherited from experiment 01.

## Result

**Ornamentation does not survive. Rubato does — at every gap, against every
control this project has, and the pre-registered prediction was therefore wrong
about it.** It is the first effect from this corpus to survive the full control
stack: clan rhythm fell (01, 04), turn-taking fell (08), positional
ornamentation fell here.

`tools/exp09_rubato_ornament.mjs`, `artifacts/rubato_ornament.json`.
Deterministic, `SEED 909`. G1 re-derived from the data rather than trusted from
the fetch: 95.65% agreement, the residual-class *rule* finds {17} and nothing
else, zero mismatches outside it. G2: 8 zero-duration codas, all single-click,
all in class 17 — so the class-17 exclusion covers them. G0 kept 3,083 of 3,840
codas (80.3%). Observation universe: 2,958 classifiable codas, 116 ornamented.

### Implementation decisions, fixed before first run

The pre-registration left five things open; each was pinned in the tool header
before any statistic was computed.

1. **"Separated by no more than `GAP` seconds" is offset-to-onset** — the
   silence between codas. The sweep exists because any such choice is a cut.
2. **Runs are formed on the whale's full post-G0 timeline**, including codas
   later excluded from observations. Being sequence-final is a physical fact
   about what the whale produced; exclusion removes a coda's *observation*, not
   the event. A run ending in an unclassifiable coda contributes no final
   observation rather than a false one.
3. **For S2, excluded codas break a run into fragments** rather than being
   spliced over — splicing would manufacture adjacency between codas that were
   never adjacent. Fragments need ≥ 3 codas; a 2-coda fragment's centered lag-1
   product is negative by algebra, not by whale.
4. **S2's statistic** is the pooled per-fragment-centered lag-1 autocorrelation
   of duration. Per-fragment centering gives short fragments a negative
   small-sample bias; the shuffle null has the same bias, so the comparison is
   clean. It does mean observed *r* is not comparable across gaps — longer
   fragments retain more slow variance — which is why the criterion was
   significance at every gap, never magnitude.
5. **The negative controls.** The registered wording — "runs split in half and
   tested against themselves" — does not type-check for a positional or an
   autocorrelation statistic, so its intent (data null by construction, pushed
   through the full pipeline, firing at ≈ α) is implemented as: for S1,
   relabel a uniformly random position in each run as pseudo-final; for
   S2/S2b, draw once from the arm's own null and test that draw. All arms
   fired at 1–5 of 40 against a nominal 2 (pass threshold 0.15, exp07's).

One equivalence used without ceremony: permuting the *position label* within
rhythm class induces the identical null on Δ as the registered "permute the
ornament flag within rhythm class" — it is the same exchangeability, and it
lets the shipped `permutationTest` from `explorer/js/rhythm.js` do the work.

### S1 — ornamentation appears and disappears with the cut

Δ = P(ornamented | final) − P(ornamented | non-final), identical in both arms;
what changes is the null. Two-sided p, shift convention.

| gap | finals | non-final | Δ obs | naive null | z | p | strat null | z | p | leverage |
|---|---|---|---|---|---|---|---|---|---|---|
| 3 s | 371 | 896 | 0.0136 | 0.0000 | 1.3 | 0.2679 | 0.0173 | −0.5 | 0.8286 | 259.7 |
| 5 s | 544 | 2,104 | 0.0136 | −0.0003 | 1.6 | 0.1539 | 0.0090 | 0.7 | 0.6157 | 429.8 |
| 10 s | 403 | 2,480 | 0.0327 | 0.0001 | 3.1 | **0.0040** | 0.0130 | 2.3 | **0.0480** | 344.5 |
| 15 s | 343 | 2,572 | 0.0408 | 0.0000 | 3.5 | **0.0040** | 0.0143 | 2.7 | **0.0170** | 300.8 |
| 30 s | 293 | 2,634 | 0.0204 | −0.0005 | 1.8 | 0.1279 | 0.0063 | 1.4 | 0.2259 | 261.0 |

Three readings, in order of importance:

- **The effect exists only under particular cuts.** Nothing fires at 3, 5 or
  30 s in *either* arm; both fire at 10 and 15 s. An effect that a segmentation
  parameter can switch on and off is the pre-registered signature of measuring
  the cut. Under the fixed criterion — survive at every gap — S1 fails, and the
  all-five criterion is precisely what makes the two uncorrected 0.048/0.017
  unquotable as a finding.
- **Where it fires, class composition manufactures a third to half of it.** At
  10 s the within-class null already produces Δ = 0.0130 of the observed
  0.0327; at 15 s, 0.0143 of 0.0408. Same observed number — the null rises to
  meet it, exactly as in experiment 07's noise arm.
- **The pre-registration's own probe was wrong about the click deficit.** The
  probe claimed final codas average 0.18 *fewer* clicks; under the registered
  universe the difference is +0.00 to +0.15 — final codas have marginally
  *more* clicks, weakly toward the published direction. The probe's ad-hoc
  universe (no G0, class 17 included, a different sequence rule) produced a
  sign error, which is this experiment's thesis applied to itself: edge
  statistics are cut-dependent.

### S2 — rubato survives everything

Pooled per-fragment-centered lag-1 autocorrelation of duration. S2's null
shuffles durations within fragment; S2b's within fragment × class, preserving
the class sequence and any duration structure it carries. One-sided high.

| gap | frags | codas | 1-class | r obs | S2 null | z | p | S2b null | z | p | mass |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 s | 192 | 893 | 71% | 0.106 | −0.197 | 7.8 | **0.0005** | −0.067 | 6.4 | **0.0005** | 633 |
| 5 s | 388 | 2,311 | 59% | 0.265 | −0.148 | 12.1 | **0.0005** | 0.021 | 10.1 | **0.0005** | 1,701 |
| 10 s | 353 | 2,738 | 48% | 0.405 | −0.097 | 17.5 | **0.0005** | 0.093 | 15.3 | **0.0005** | 2,101 |
| 15 s | 324 | 2,814 | 45% | 0.483 | −0.079 | 20.1 | **0.0005** | 0.154 | 17.6 | **0.0005** | 2,195 |
| 30 s | 286 | 2,844 | 43% | 0.522 | −0.068 | 22.6 | **0.0005** | 0.173 | 19.4 | **0.0005** | 2,262 |

p = 0.0005 is the resolution floor at 2,000 iterations; every arm sits on it.
The S2b null mean grows with gap — class composition in time does carry real
smoothness, and the control absorbs exactly that — but the observed *r* sits
6.4 to 19.4 standard deviations above what composition plus the shared
small-sample bias can produce. Shuffle mass 633–2,262 against the 33.3 floor.

The contrast with S1 is the point of the sweep. S1's *inference* flips with the
cut: significant at two gaps, absent at three. S2's inference is identical at
all five cuts; only the magnitude grows with window length, which per-fragment
centering guarantees mechanically for any genuinely autocorrelated process.
One statistic moves with the cut; the other does not.

**What survives means, precisely:** within a rhythm class, click count is
pinned to the centroid exactly (G1's zero-mismatch consequence), so within-class
duration variation is pure inter-click timing. Runs are same-speaker, so no
exp08 cross-speaker mixing; deployments are dedup'd, so no dual-tag doubling;
the null preserves the class sequence, so no composition. What remains:
**successive codas by the same whale drift smoothly in tempo, within coda
type.** That is rubato in Sharma et al.'s sense, surviving the controls that
dissolved every previous effect this project tested.

### The probe's "collapse at longer lengths" does not reproduce

The pre-registration flagged, as the falsification device for rubato, a
first-pass observation that monotone duration drift collapsed to chance beyond
length 4. Under the registered universe it does not collapse — the probe's
universe (raw runs, class 17 in, duplicates in, monotonicity across mixed
classes) was the artifact:

| gap | L4 obs% (null%) | L5 | L6 | L7 | L8 |
|---|---|---|---|---|---|
| 3 s | 22.0 (8.2), n=41 | 3.7 (1.7), n=27 | 12.5 (0.3), n=16 | 0.0 (0.0), n=13 | 0.0 (0.0), n=7 |
| 5 s | 19.5 (8.3), n=77 | 7.7 (1.7), n=52 | 2.3 (0.3), n=43 | 9.4 (0.0), n=32 | 9.1 (0.0), n=22 |
| 10 s | 21.8 (8.2), n=55 | 5.1 (1.7), n=39 | 2.6 (0.3), n=38 | 9.4 (0.0), n=32 | 4.2 (0.0), n=24 |
| 15 s | 27.1 (8.1), n=48 | 6.1 (1.7), n=33 | 0.0 (0.3), n=38 | 3.2 (0.0), n=31 | 5.0 (0.0), n=20 |
| 30 s | 30.8 (8.5), n=39 | 4.3 (1.7), n=23 | 0.0 (0.3), n=27 | 3.6 (0.0), n=28 | 0.0 (0.0), n=19 |

Strict monotonicity is a brutal statistic — chance is 2/L!, about 0.04% at
L=7 — and 3 of 32 length-7 fragments are monotone at 5 s and again at 10 s.
Cell counts are small and the cells are not independent across gaps; this table
is diagnostic context for S2, not a test. The test is the autocorrelation.

### Post-hoc robustness, not pre-registered

`tools/exp09_posthoc.mjs`, run after the sweep falsified the prediction,
because a surprising positive earns more hostility than a null. At 3 s / 10 s:

- **Broad-based:** 58.3% / 62.5% of individual fragments (length ≥ 4) have
  positive own-*r*, against a sub-50% chance baseline from the centering bias.
- **Not the majority class:** fragments consisting only of class 2 give
  z = 5.5 / 12.0; single-class fragments of *other* classes give z = 3.7 / 5.7.
- **Not one recording:** leave-one-recording-out worst case z = 5.3 / 11.5
  (dropping `sw061b003`, of 49 / 125 recordings).
- **Room to vary:** class-2 duration CV is 0.21 / 0.27 — within-class timing
  varies by a fifth of the mean, so there is real signal to structure.

### Reading this

Rubato surviving is a statement about *structure*, not *use*. Smooth tempo
modulation is what a whale's respiration, arousal or dive phase would also
produce; nothing here distinguishes modulation-as-signal from
modulation-as-state. Sharma et al.'s stronger claim — that rubato is deployed
contrastively, as part of a combinatorial code — is untested by this design.
The control is also exactly as fine as the authors' own 18 classes: a finer
rhythm inventory could in principle re-absorb some smoothness as composition.
But that inventory is the paper's own, so the claim survives on its own terms.

The asymmetry of the outcome is worth recording. The prediction said neither
would survive, and it was stated in advance precisely because a positive would
be more interesting than a null. Ornamentation behaved like every effect this
project had previously dissolved — cut-dependent, half composition. Rubato did
not, anywhere, under anything. That is what a real effect is supposed to look
like, observed once in nine experiments.

## What this will not license

- **A refutation of Sharma et al.** Their analysis used definitions, subsetting
  and a modelling approach that are not reproduced here. A null on these
  statistics bears on these statistics.
- **Anything about tempo**, the third dimension — `tempos-dict.p` is not cleanly
  invertible (93.3%), so it is out of scope rather than quietly approximated.
- **Anything about meaning.** Both features are claimed as combinatorial
  structure, not semantics, and are tested as such.
- **Anything about individuals.** Speaker indices are per-recording; the same
  index in two recordings is not the same whale.
- **Anything about the 175 codas in residual class 17**, which are excluded. They
  are not evidence of absence; they are material the authors' own classifier
  could not place.

## Reproducing

```bash
python3 tools/fetch_corpus.py                             # dialogues CSV
./wham/.venv/bin/python tools/fetch_sharma_labels.py      # labels + G1/G2 gates
node    tools/exp09_rubato_ornament.mjs                   # gates, sweep, artifacts
node    tools/exp09_posthoc.mjs                           # post-hoc robustness
```

Both tools are deterministic; a re-run reproduces `artifacts/rubato_ornament.json`
byte-for-byte.

Use the venv interpreter for the label fetch — `mean_codas.p` is a numpy pickle
and the system `python3` here is the x86_64 build with no numpy (INSTALL.md, the
Rosetta trap). The tool now says so instead of raising `ModuleNotFoundError`.
