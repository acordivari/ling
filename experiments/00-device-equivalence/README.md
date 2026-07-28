# 00 — CPU vs MPS device equivalence

**Status:** criteria pre-registered 2026-07-28, before any run.

## Question

WhAM was trained and validated on CUDA. This machine runs it on Apple Silicon via
MPS. Does MPS produce the same model behaviour as CPU, or does it diverge
numerically in a way that would corrupt every downstream experiment?

This gates experiments 1–5. A silent MPS divergence would not announce itself —
it would look like a finding.

## Why this is not simply "diff the output"

Sampling draws from `torch`'s RNG, and the MPS generator is a different stream
from the CPU generator. Identical seeds therefore do **not** produce identical
token sequences across devices, and no amount of seeding will make them. Testing
for bitwise-identical generations would fail for a reason that has nothing to do
with correctness.

So the deterministic and the stochastic parts of the pipeline are tested
differently:

- **Deterministic path** (codec decode, transformer forward) — same input must
  give the same output to float tolerance. Tested directly.
- **Stochastic path** (masked sampling) — cannot be compared sample-to-sample.
  Tested distributionally.

## Control condition

For the stochastic test the control is **the same model, on the same device,
with different seeds**.

That spread is the irreducible noise floor of the generator. If the cpu-vs-mps
spread sits inside the same range as the cpu-vs-cpu and mps-vs-mps spread, the
devices are equivalent for every purpose this project has. If cross-device spread
is clearly larger, MPS is doing something different.

Stating it before the run because "the distances looked close enough" is exactly
the kind of judgement that is easy to make after seeing the numbers.

## Pre-registered pass criteria

Fixed input throughout: a synthetic 3s click train built from a fixed numpy seed,
so the input is identical on both devices by construction.

| # | Test | Metric | Pass |
|---|---|---|---|
| **P1** | Codec decode of *identical* tokens | SNR between cpu and mps waveforms | ≥ 40 dB |
| **P2** | Coarse transformer forward, *identical* input latent | top-1 (argmax) agreement over all positions | ≥ 99% |
| **P3** | Sampled generation, 12 seeds per device | median cross-device mel distance ÷ median within-device mel distance | ≤ 1.5 |
| **S1** | Codec encode of identical audio | per-codebook token agreement | reported, not scored |

**On P2 rather than raw logit difference:** what matters downstream is whether
the model *decides* the same thing. Float drift of 1e-4 in a logit is irrelevant
if the argmax is unchanged; a small drift that flips argmax on 5% of positions is
not. Max absolute difference is reported alongside, as description.

**On S1 being unscored:** the codec is residual vector quantisation. A tie-break
flip in codebook 0 changes the residual that codebooks 1–13 encode, so a single
low-level float difference cascades by construction. Low agreement in later
codebooks would be expected behaviour, not evidence of a broken device. Scoring
it would manufacture a failure. It is recorded because the cascade pattern is
informative.

**Precondition:** same seed, same device, run twice must be bit-identical. If
seeding does not actually control the generator, P3 measures nothing. Checked
first; if it fails, P3 is void.

## Running

```bash
cd experiments/00-device-equivalence
../../wham/.venv/bin/python check.py run --device cpu     # must run first
../../wham/.venv/bin/python check.py run --device mps
../../wham/.venv/bin/python check.py compare
```

CPU runs first because it writes the reference token sequence that P1 decodes on
both devices.

## Result

**Run 2026-07-28. Verdict: EQUIVALENT.** All four criteria passed, none of them
marginally. Checkpoints: `coarse.pth` / `c2f.pth` / `codec.pth` from Zenodo
17633708, torch 2.7.1, macOS 26.2, Apple M5.

```
precondition — same seed, same device, twice:
  cpu bit-identical: True
  mps bit-identical: True

P1 decode SNR (identical tokens): 107.8 dB   [pass >= 40]
P2 top-1 agreement:              100.00%     [pass >= 99%]
   max abs logit diff:           8.46e-05    (descriptive)
S1 encode agreement, codebook 0: 100.00%     (unscored)
   per-codebook: 100 100 100 100 100 100 100 100 100 100 100 100 100 100

P3 mel distance — within-device median 0.00321  (range 0.00041–0.02411)
                  cross-device median 0.00282  (range 0.00038–0.01958)
                  ratio 0.878                   [pass <= 1.5]
   rms cpu 0.01171 ± 0.00372 | mps 0.01274 ± 0.00621
```

### Reading these

**P1 at 107.8 dB** is the float32 noise floor, not merely "good enough". The
codec decode path is doing the same arithmetic on both devices.

**P2 at exactly 100%** with max logit drift of 8.5e-05 is the important one. The
transformer's *decisions* are identical; the drift is four orders of magnitude
below anything that could flip an argmax.

**P3 ratio of 0.878** means the cross-device spread is, if anything, marginally
*smaller* than the within-device spread. The ratio landing slightly under 1.0 is
not meaningful — it is median noise across 144 cross pairs versus 132 within
pairs. What matters is that it is nowhere near the 1.5 threshold: cpu-vs-mps
differences are entirely absorbed by ordinary seed-to-seed variation. Two
generations from the same device differ from each other about as much as one from
each device does.

**S1 came back 100% on all 14 codebooks.** The pre-registered caution about
residual-quantiser cascade turned out to be unnecessary — there was no tie-break
flip to cascade from. Recording that the hedge was not needed, rather than
quietly dropping it.

### What this licenses, and what it does not

Generations produced on MPS can be treated as interchangeable with CPU
generations. Device no longer needs to be a suspect when a downstream result
looks strange.

It does **not** license these, none of which were tested:

- **CUDA.** Both arms here are this machine. The upstream reference was CUDA, and
  no CUDA run was available to compare against. This establishes cpu≡mps, not
  that either matches the paper's numbers.
- **One input, one configuration.** A single 3s synthetic click train, 80% mask,
  12 sampling steps. Real DSWP audio, longer sequences, and other mask ratios are
  untested — a divergence that only appears at length would not show up here.
- **P2 used a random latent**, not an embedding produced by the real token path.
  It isolates transformer arithmetic, which is what it was for, but it is not the
  exact tensor `coarse_vamp` would see.
- **The beat tracker and `fadtk`.** `wavebeat` was loaded with `wavebeat_ckpt=None`
  throughout (INSTALL.md gotcha 6), and the embedding/FAD path was not exercised
  at all. Experiment 1 will need its own check.

Widening the input set is cheap — `check.py` takes about 90s per device — and
worth doing before leaning on MPS for anything long-running.
