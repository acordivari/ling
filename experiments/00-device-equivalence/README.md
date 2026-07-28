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

_Not yet run._
