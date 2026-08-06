# 05 — Did WhAM learn a timbre or a grammar?

**Status: PRE-REGISTRATION, GATES RUN 2026-08-06. Model not yet run.**

- **G1 (device) PASSES.** Re-verified against torch 2.7.1; every metric
  reproduces the 2026-07-28 baseline bit-for-bit.
- **G0 (measurement chain) FAILED as pre-registered**, and the failure was in
  the direction that would have manufactured this experiment's headline result.
  An amendment was found — to the *inputs*, not the instrument. See below.

The Result section is still empty on purpose.

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
left unmasked. **The frame rate is now measured: 17.241 ms (58 tokens/s).** The
shortest interval in the input spec is 12 tokens, so every interval is resolved
by roughly an order of magnitude — the reasoning holds, and the prediction stands
as written.

What would falsify it: β ≤ 0.5 with outputs converging on ~20 nPVI regardless of
whether the input was isochronous or Poisson. That would be the grammar result,
and it would be the more interesting of the two.

Stated in advance because "the outputs sounded whale-like" is exactly the
judgement that is easy to make after listening.

## Gate results

### G1 — device: PASS

`experiments/00-device-equivalence/check.py`, re-run 2026-08-06 against torch
2.7.1. Every metric reproduces the 2026-07-28 baseline to eight significant
figures: decode SNR 107.767 dB, top-1 agreement 100.00%, max logit diff 8.46e-05,
P3 ratio 0.878, all 14 codebooks 100%. Verdict EQUIVALENT.

Cross-device mel distance (0.00282) is *below* within-device (0.00321), so device
variation is smaller than the sampler's own seed-to-seed noise floor. MPS is
~2.2× faster than CPU (48.9 s vs 1:48.5 for 12 generations).

### G0 — measurement chain: FAIL, then amended

```
source                n  nPVI in  nPVI out    bias  recall   miss   spur  <floor
isochronous          20     0.00      0.02    0.02    100%   0.00   0.00    0.00
coda 5R3             20     0.00      0.02    0.02    100%   0.00   0.00    0.00
coda, Pacific        20    16.83     17.58    0.74    100%   0.00   0.00    0.00
coda, Dominica       20    22.09     22.33    0.24    100%   0.00   0.00    0.00
drumming (Groove)    20    71.65     58.26  -13.39     95%   0.25   0.00    0.30
Morse (ITU)          20    49.84     51.40    1.55    100%   0.00   0.00    0.00
Poisson              20    96.17     78.00  -18.17     93%   0.35   0.00    0.40

G0a  r 0.9185  [>= 0.95]  FAIL      slope 0.7742  [0.90-1.10]  FAIL
G0b  worst bias 18.17  [< 5]  FAIL
```

**This is the failure the gate existed to catch.** Bias is ~0 for everything
coda-like and strongly negative for the two high-nPVI sources. A detector that is
accurate near coda rhythm and compressive away from it produces β ≈ 0.77 —
the "grammar" result — **with no model involved**. Run without this gate, the
experiment would have measured its own instrument and concluded that WhAM had
internalised coda structure.

**Mechanism.** Not the detector's `minIci` floor: results are *identical* at
20/15/10/5 ms. The onset function runs on 512-sample frames (11.6 ms) and onset
times are quantised on a 128-sample hop (2.90 ms), so a few ms of jitter corrupts
nPVI in proportion to the interval — and nPVI is a difference of *adjacent*
intervals, which amplifies it. Four remedies were measured:

| remedy | outcome |
|---|---|
| retempo so every interval clears the floor | criteria met, but inputs run to 7.7 s — outside the 0.5–3.04 s coda range |
| lower `minIci` | saturates below 20 ms; never passes |
| slow everything uniformly | slope/r pass from 400 ms, bias plateaus at 5.6–6.3, never < 5 |
| restrict to nPVI ≤ 50 | bias 1.26–1.55, passes — but loses the informative inputs |

**The amendment: the fault was in the input sourcing, not the instrument.**

High nPVI and short absolute intervals are different properties, and the
pre-registration conflated them — real drum performances and a Poisson process
happen to have both. An alternating sequence `[a,b,a,b]` has
nPVI = 100·|a−b| / ((a+b)/2), so for target *N* and shortest interval *b*,
a = b(2+r)/(2−r) with r = N/100. **The whole nPVI range is constructible at any
minimum interval.**

At a **200 ms shortest interval**:

```
 target     a/b (ms)    dur  nPVI in  nPVI out    bias
      0      200/200  0.80s     0.00      0.02    0.02
     20      244/200  0.89s    20.00     18.81   -1.19
     40      300/200  1.00s    40.00     42.08    2.08
     60      371/200  1.14s    60.00     59.87   -0.13
     80      467/200  1.33s    80.00     79.05   -0.95
    100      600/200  1.60s   100.00     99.27   -0.73
    120      800/200  2.00s   120.00    121.83    1.83

slope 1.0059   r 0.9996   worst bias 2.08   recall 100%   spurious 0
```

Full nPVI 0–120, every input inside the real coda duration range (max 2.00 s
against the 3.04 s measured maximum), no spurious onsets.

### What the amendment costs

Experiment 05 now tests **constructed** rhythms, not real drum microtiming. That
is a real loss of ecological validity and it must be stated in any result: the
claim becomes "structure at nPVI *N*" rather than "a rock groove". The
`iciSample` windows added to `comparanda.json` remain available for a secondary
arm, but only at nPVI ≤ 50 where the instrument is linear.

### A second quantiser: the codec's own token grid

Measured from the loaded model, not assumed — this is the figure the prediction
below depends on:

| | |
|---|---|
| `Interface.s2t(1.0)` | **58 tokens/s → 17.241 ms per token** |
| codec `sample_rate` | 44100 Hz — same as this measurement chain |
| `coarse.chunk_size_s` | 10 s |
| `c2f.chunk_size_s` | 3 s |

WhAM cannot represent an onset off its own token grid, so the grid caps how
faithfully *any* input rhythm can survive before the model does anything.

The section-7 amendment (200 ms shortest interval) fails on it. 200 ms is
**11.6 tokens**, so an isochronous train alternates 11/12 tokens and the grid
**manufactures nPVI 8.70 out of a perfectly even input** — the grammar-result
direction for a third time, from the codec on this occasion.

Making every interval an integer token count removes it exactly.

### Final input specification

Shortest interval = **12 tokens = 206.9 ms**. Every interval an integer token
count. The *achieved* nPVI replaces the nominal target, since rounding to the
grid moves it slightly.

| achieved nPVI | a/b (tokens) | a/b (ms) | duration | detector bias |
|---|---|---|---|---|
| 0.00 | 12/12 | 207/207 | 0.83 s | +4.61 |
| 22.22 | 15/12 | 259/207 | 0.93 s | −1.83 |
| 40.00 | 18/12 | 310/207 | 1.03 s | +2.24 |
| 58.82 | 22/12 | 379/207 | 1.17 s | +0.46 |
| 80.00 | 28/12 | 483/207 | 1.38 s | +1.61 |
| 100.00 | 36/12 | 621/207 | 1.66 s | +2.89 |
| 120.00 | 48/12 | 828/207 | 2.07 s | −0.80 |

```
codec grid          EXACT (0.000)
onset detector      slope 0.9860   r 0.9987   worst bias 4.61   recall 100%   spurious 0
```

Both quantisers clear. The worst detector bias is the isochronous row (+4.61,
against a threshold of 5) and it is residual onset jitter, so **nPVI ≈ 0 is the
least trustworthy point on the axis** and should not carry the regression alone.

n = 20 per target, jittered within target, 3 seeds each. The 22.22 row is the
passthrough anchor — it sits where real codas sit (18.1 Pacific / 21.0 Dominica),
so P0 and the regression share a point.

## Result

**Partial: gates run, mask boundary mapped, full sweep not yet run.** 11 inputs
× 6 masks × 5 seeds = 330 generations. Checkpoints logged in
`artifacts/gen_nsweep.json`; torch 2.7.1, MPS, 12 sampling steps.

### P0 — passthrough: PASS

```
detector on the inputs   slope 0.999  r 0.9993      (G0 measured 0.986 / 0.9987)
mask 0.20                beta 0.913   r 0.826
input onsets 5.00 (constructed: 5)    output onsets 5.30, range 5-6, dead 0
```

The detector reading 0.999 here against G0's 0.986 on the same input spec is an
independent consistency check on the whole chain.

### N — seed variance, per mask

The pre-registration ran N at **one** mask. That was an error: mask 0 copies the
input and mask 1 generates unconditionally, so validity is mask-dependent by
construction. Recorded as an amendment, not folded in silently.

| mask | within SD | between SD | ratio | |
|---|---|---|---|---|
| 0.10 | 11.26 | 22.96 | **0.490** | pass |
| 0.20 | 28.98 | 20.58 | 1.408 | FAIL |
| 0.30 | 31.43 | 23.74 | 1.324 | FAIL |
| 0.40 | 37.05 | 21.27 | 1.742 | FAIL |
| 0.60 | 37.62 | 15.85 | 2.373 | FAIL |
| 0.80 | 35.01 | 11.35 | 3.085 | FAIL |

**A single generation is input-driven only at mask 0.10.** Above that, the seed
matters more than the input.

### β, seed-averaged, bootstrap CI over inputs

N asks whether *one generation* is input-driven. That is not the same question as
whether the *slope* is estimable — averaging k seeds shrinks the sampling
component by √k and leaves the input-driven component alone. Reported explicitly
rather than letting N stand in for it. **This does not relax the gate.**

| mask | β | 95% CI | r | excludes 0 | excludes 1 |
|---|---|---|---|---|---|
| 0.10 | 1.127 | [0.92, 1.39] | 0.963 | yes | **no** |
| 0.20 | 0.911 | [0.64, 1.27] | 0.868 | yes | **no** |
| 0.30 | 0.827 | [0.39, 1.43] | 0.683 | yes | **no** |
| 0.40 | 0.782 | [0.39, 1.34] | 0.721 | yes | **no** |
| 0.60 | 0.052 | [−0.51, 0.59] | 0.065 | **no** | yes |
| 0.80 | −0.132 | [−0.39, 0.25] | −0.229 | **no** | yes |

Bootstrap resamples **inputs**, the unit of independence, not generations.

**A sharp transition between mask 0.4 and 0.6.** Below it, β is significantly
above 0 and *indistinguishable from 1* — input rhythm passes through. Above it,
β is indistinguishable from 0 and significantly below 1 — input rhythm is gone.

### Click count is not preserved either

| mask | output onsets, mean | range | exactly 5 (= input) |
|---|---|---|---|
| 0.10 | 5.09 | 5–6 | 91% |
| 0.20 | 5.25 | 5–6 | 75% |
| 0.30 | 5.53 | 5–8 | 56% |
| 0.40 | 5.75 | 5–9 | 47% |
| 0.60 | 6.78 | 4–11 | 20% |
| 0.80 | 8.76 | 3–16 | 5% |

### Reading this — and what it does NOT yet license

The β curve alone is close to trivial at both ends: at low mask most tokens are
copied, at high mask most are generated. **The informative question is what the
outputs look like where the input no longer controls them**, and the honest
answer is that this is not yet established.

Mean output nPVI rises monotonically with mask: 33.9, 45.8, 54.1, 62.3, 84.5,
89.6. Real codas are nPVI 18.1 (Pacific) / 21.0 (Dominica). Taken at face value
that says WhAM does **not** converge on coda-like rhythm when the input stops
constraining it — the opposite of the grammar prediction.

**That reading is not safe yet.** Output onset density rises with mask over the
same range (5.09 → 8.76 onsets in a fixed duration), so intervals get shorter, and
G0 established that this detector *inflates* nPVI at short intervals — a 60 ms
isochronous train reads 13.06 instead of 0. The nPVI rise and the density rise are
confounded, and separating them is the next piece of work, not a caveat to
mention and move past.

So: **the transition is established; what lies above it is not.**

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
