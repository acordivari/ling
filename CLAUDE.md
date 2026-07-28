# WhAM exploration project

## What this is

A personal learning project built on top of Project CETI's WhAM
(`Project-CETI/wham`, NeurIPS 2025). Goal is to understand what the model has
actually learned about sperm whale coda structure by probing it with datasets
outside its training distribution. This is exploratory, not a publication
effort — prioritize interpretable results over polish.

Upstream paper: https://arxiv.org/abs/2512.02206
Model weights: https://doi.org/10.5281/zenodo.17633708

## Model capabilities being probed

WhAM is a VampNet-based masked acoustic token model with three surfaces:

1. **Acoustic translation** — style-transfers arbitrary audio into coda texture
2. **Pseudocoda synthesis** — generates novel codas from context
3. **Embeddings** — for downstream social unit and spectral "vowel" classification

Surfaces 1 and 3 need no retraining. Prefer experiments that use them before
reaching for fine-tuning.

## Planned experiments

Ordered by effort. Start at the top.

### 1. Cross-species FAD ladder
Use `wham/generation/eval/calculate_custom_fad.py`, which accepts arbitrary
`.npy` embeddings. Compute Fréchet Audio Distance between real codas and a
ranked set of impulsive/rhythmic sources: dolphin echolocation trains,
woodpecker drumming, human beatboxing, synthetic Morse (see
`data/generate_beeps.sh`), click-language speech, non-click speech.
Output: a distance ordering, plus whether it matches acoustic intuition.

### 2. Structure-vs-timbre probe
Feed structured input (spoken sentence, specific drum pattern, Morse string)
through acoustic translation, then run outputs through the downstream coda
classifiers.
- If input rhythmic structure is preserved → model learned a timbre
- If outputs snap to canonical coda types regardless → model learned closer
  to a grammar

This distinction determines how to interpret any generative claim. Highest
information-per-GPU-hour of the three.

### 3. Embedding transfer
Run WhAM embeddings against BEANS (Earth Species Project) tasks. Compare to
AVES and BirdNET, which are already baselines in the repo. Question: is the
representation coda-specific or does it generalize to impulsive bioacoustics?

### 4. Click-language null test
Extract embeddings for ǃXóõ / Nama speech (UCLA Phonetics Lab Archive) and
matched non-click speech. Test whether click-heavy audio sits closer to codas.

**Predicted result: no.** Human clicks are velaric ingressive *consonants*;
whale clicks pattern as vowel-like carriers (see Beguš et al., Proc R Soc B
2026, "The phonology of sperm whale coda vowels"). The word "click" is a false
cognate across the two domains. A null result confirms the phonetics; a
positive result would be genuinely surprising and worth chasing.

### 5. Noise artifact ablation
The repo ships a raw/denoised/noise-profile ablation
(`wham/generation/eval/FAD_ablation.sh`). Beguš has publicly said he worried
the formant structure might be a recording artifact. Running vowel
classification across denoised vs noise-only vs raw, ideally across different
recording equipment, is a live open question rather than a replication.

## Dataset shortlist

Already in the upstream pipeline:
- Watkins Marine Mammal Sound Database ("Best Of" cut)
- BirdSet (HuggingFace, `DBD-research-group/BirdSet`)
- AudioSet, `Animal` label
- DSWP (HuggingFace, `orrp/DSWP`)

Candidates to add:
- **BEANS** — benchmark w/ standardized splits, gives an eval harness
- **Xeno-canto** — extends bird coverage past BirdSet
- **Orcasound** — open Salish Sea hydrophone data
- **DCLDE / MobySound** — curated marine mammal detections
- **UCLA Phonetics Lab Archive** — Ladefoged collection, includes Khoisan clicks
- **Mozilla Common Voice** — ~100 languages, CC0
- **VoxLingua107** — built for language ID
- **Groove MIDI Dataset** (Magenta) — renderable drum patterns, precise timing
- **ESC-50 / UrbanSound8K** — non-biological impulsive controls

Note: `madmom` (beat tracking) is already a dependency. Rhythm experiments are
better supported than they look.

## Gotchas

- **DSWP is only partially public.** Full CETI annotations are gated; the repo
  README says reproducing all published results requires access that wasn't
  public at publication. Plan around partial annotation coverage.
- **Licensing differs per dataset.** Common Voice is CC0. AudioSet is
  YouTube-derived with link rot and its own terms. Watkins and the UCLA archive
  each have separate use conditions. Check before redistributing anything.
- **Compute:** full-species FAD is ~3h on an A10. One mid-range cloud GPU
  covers everything except retraining.
- **Overtraining degrades audio quality** on small fine-tuning sets. The README
  recommends manually auditing generations across checkpoints rather than
  trusting `latest`.
- Coarse and c2f weights can be trained separately but **must end up in the
  same WhAM copy**.

## Environment

Python 3.9 via conda, per upstream README. `pip install -e .`, then
`pip install -e ./vampnet`, then `madmom` with `--no-build-isolation`, then
ffmpeg from conda-forge. Weights extract to `vampnet/models/`.

## Conventions

- Keep each experiment in its own directory with a short `README.md` stating
  the question, the control condition, and the result — including null results.
- Always define the control condition *before* running. Easy to rationalize a
  FAD ordering after the fact.
- Log the checkpoint used for every generation. Non-obvious source of
  irreproducibility here.
