# 05 — Did WhAM learn a timbre or a grammar?

**Status: PRE-REGISTRATION. NOT YET RUN.** Everything below the Result heading is
empty on purpose. This file exists to fix the design before any GPU time is
spent, per the `CLAUDE.md` convention that the control condition is stated first.

Implements the experiment `CLAUDE.md` lists as planned #2 and flags as the
highest information-per-GPU-hour of the set.

## Question

WhAM style-transfers arbitrary audio into coda texture. Two very different things
could be happening:

- **Timbre.** The model learned what a sperm whale click *sounds like* and paints
  that texture onto whatever temporal structure it is given. Input rhythm passes
  through.
- **Grammar.** The model learned what a coda *is* — a small set of canonical
  timing patterns — and outputs snap to those regardless of input.

Every generative claim about this model reads differently depending on which is
true. "WhAM generated a novel coda" means one thing if the model is a texture
brush and another if it has internalised coda structure.

The first four experiments in this repo built, without meaning to, exactly the
apparatus needed to tell them apart: a rhythm metric and a set of **measured**
reference distributions on one axis.

| source | nPVI | measured in |
|---|---|---|
| isochronous | ~0 | control |
| coda type `5R3` | 4.2 | observatory |
| real codas, Pacific | 18.1 | exp 04 |
| real codas, Dominica | 21.0 | exp 02 |
| human drumming (rock/soul/funk/hiphop) | 56–78 | exp 02 |
| Poisson process | ~101 | exp 02 |

## Statistic

**β, the slope of output nPVI regressed on input nPVI.**

- β ≈ 1 → timbre. Structure passes through.
- β ≈ 0 with intercept ≈ 20 → grammar. Outputs collapse onto coda timing.
- 0 < β < 1 → the interesting case, and β is directly interpretable as the
  fraction of input rhythmic structure that survives.

One number, falsifiable in both directions.

### β is a function of mask ratio, and that is the real deliverable

Acoustic translation is masked resampling: a mask ratio near 0 copies the input
and a ratio near 1 generates unconditionally. So β is trivially 1 at one end and 0
at the other, and **reporting β at a single mask setting would be reporting a
parameter choice, not a property of the model.**

The deliverable is therefore **β measured across the mask sweep**, and the shape
of that curve. Where it departs from 1, and how fast, is how much of the output
structure is prior rather than input. A model that is purely a timbre brush holds
β ≈ 1 until the mask is nearly total; a model with an internalised coda grammar
sheds input structure early.

## Inputs

**Input timbre is held constant.** Every input is a click train built from the
same fixed click waveform, varying *only* in its inter-click intervals. This is
deliberate and is a change from the `CLAUDE.md` sketch, which suggested feeding
speech and drum audio directly.

The reason: if input timbre varies with input rhythm, then any change in output
is unattributable — the model may be responding to either. Holding the click
waveform fixed makes rhythm the only manipulated variable, which is what a slope
against rhythm requires.

| # | source of ICIs | target nPVI | n |
|---|---|---|---|
| 1 | isochronous | ~0 | 20 |
| 2 | coda `5R3` realisations | ~4 | 20 |
| 3 | real Pacific coda ICIs (exp 04 corpus) | ~18 | 20 |
| 4 | real Dominica coda ICIs (exp 01 corpus) | ~21 | 20 |
| 5 | Groove MIDI onsets, 4 styles (`data/groove`) | 56–78 | 20 |
| 6 | Poisson process | ~101 | 20 |
| 7 | synthetic Morse (`wham/data/generate_beeps.sh`) | measure first | 20 |

Source 7's nPVI is not yet measured and must be measured **before** the run, not
after, so it cannot be quietly dropped if it lands somewhere inconvenient.

### Secondary arm, run only if the primary passes

Genuinely different input timbres — rendered drum audio, speech — as a robustness
check on whether the constant-click design generalises. Not scored, and not run
until the primary produces an interpretable β.

## Pre-registered gates and controls

### G0 — the measurement chain, BEFORE the model

**This is a gate, not a criterion. If it fails, nothing downstream means
anything, and the experiment stops here.**

Experiment 03 established that this repo's onset/IPI machinery **cannot
distinguish real click structure from periodic broadband artifacts** — synthetic
impulse trains fired 8 of 8 inside the physical band, at *higher* confidence than
real whale clicks. WhAM output is synthetic click-like audio. That is precisely
the regime where the instrument is known to fail.

So before any generation: synthesise the input click trains, run them through the
**shipped** onset detection, and check that the recovered ICIs reproduce the ICIs
that were put in.

| | test | pass |
|---|---|---|
| G0a | recovered nPVI vs constructed nPVI, all 7 sources | r ≥ 0.95, slope 0.9–1.1 |
| G0b | no source's recovered nPVI is systematically compressed toward ~20 | max \|bias\| < 5 nPVI |

G0b matters because a detector that compresses everything toward coda-like values
would manufacture the grammar result on its own.

### G1 — device gate

Re-run `experiments/00-device-equivalence`. It passed on 2026-07-28 and it gates
experiments 1–5 by its own statement, but `torch` is now 2.7.1 and that check has
not been re-run since. Cheap, already written.

### P0 — model passthrough

Feed **real coda audio** through translation at each mask ratio. Output nPVI
should track input nPVI at low mask. If the model cannot pass through material
from its own training distribution, β measured on anything else is meaningless.

### N — seed variance versus input variance

The control that decides whether β exists at all. Run **3 seeds per input item**.

Compare within-input seed variance against between-input variance in output nPVI.
If they are comparable, the model's output rhythm is driven by sampling noise
rather than by the input, and **no slope should be reported at all**. This is the
same logic as experiment 00's within-device control, and it is the most likely way
this experiment returns nothing.

Pre-registered failure: within-input SD ≥ 0.7 × between-input SD.

### N2 — unstructured material

White noise and a single impulse. Neither has a defined input nPVI, so these are
not part of the regression; they exist to confirm the pipeline produces something
identifiably different rather than a coda-shaped output regardless of input.

### Conventions carried from CLAUDE.md

- **Log the checkpoint for every generation.** Named as a non-obvious source of
  irreproducibility.
- **Audit across checkpoints, not just `latest`.** The upstream README warns that
  overtraining degrades audio quality on small fine-tuning sets.
- Fixed seeds recorded; `signal.cpu().write(path)` per INSTALL.md gotcha 7.

## Pre-registered prediction

**β > 0.5 at moderate mask ratios** — most input rhythmic structure survives, so
the model is closer to a timbre than a grammar.

Reasoning: the codec is time-aligned and masked resampling operates on
time-aligned tokens, so gross timing is largely carried by whatever tokens are
left unmasked. *(The codec frame rate has not been verified in this repo and must
be measured before the run — the reasoning depends on it.)*

What would falsify it: β ≤ 0.5 with outputs converging on ~20 nPVI regardless of
whether the input was isochronous or Poisson. That would be the grammar result,
and it would be the more interesting of the two.

Stated in advance because "the outputs sounded whale-like" is exactly the
judgement that is easy to make after listening.

## Result

*Not yet run.*

## What this will and will not license

Will not, whatever the outcome:

- **Anything about coda semantics.** Rhythm survival is not meaning.
- **Anything about the other two surfaces.** Pseudocoda synthesis and the
  embeddings are separate questions.
- **Perceptual claims.** That structure survives says nothing about whether a
  whale would hear it as a coda.

## Reproducing

```bash
node tools/pacific_clan_check.mjs      # not needed; corpora already fetched
python3 tools/fetch_corpus.py          # ICI sources 3 and 4
python3 tools/fetch_pacific.py

./wham/.venv/bin/python experiments/00-device-equivalence/check.py   # G1
```

**Use `./wham/.venv/bin/python`, never bare `python3`.** On this machine
`/usr/local/bin/python3` is an x86_64 binary and comes first in `PATH`; the venv
interpreter is arm64 with MPS available. See INSTALL.md, "the Rosetta trap".
