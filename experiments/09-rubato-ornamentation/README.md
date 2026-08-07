# 09 — Do rubato and ornamentation survive controls?

**Status: PRE-REGISTRATION. Written before any test statistic was computed.**

The Result section is empty on purpose. Everything below the gates was fixed
before running.

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
node    tools/exp09_rubato_ornament.mjs                   # not yet written
```

Use the venv interpreter for the label fetch — `mean_codas.p` is a numpy pickle
and the system `python3` here is the x86_64 build with no numpy (INSTALL.md, the
Rosetta trap). The tool now says so instead of raising `ModuleNotFoundError`.
