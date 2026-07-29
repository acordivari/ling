# ling

A personal exploration of what [Project CETI's WhAM](https://github.com/Project-CETI/wham)
model has actually learned about sperm whale coda structure, by probing it with
data from outside its training distribution.

WhAM is a VampNet-based masked acoustic token model for sperm whale codas
([arXiv:2512.02206](https://arxiv.org/abs/2512.02206), NeurIPS 2025). This repo
is not affiliated with Project CETI — it holds my own experiments and tooling
built alongside it.

This is a learning project, not a publication effort. Null results are recorded
as results.

## What's here

### [`explorer/`](explorer/) — browser-based coda / rhythm / click comparison

A zero-dependency web tool for putting sperm whale coda structure side by side
with rhythm sources, click-language sequences, and other impulsive animal
signals, and seeing what a rhythm metric and a timbre metric say about the pair.

```bash
cd explorer && python3 -m http.server 8777   # → http://localhost:8777/
npm test                                     # 84 + 23 assertions
```

It also carries a **glossary** (`◈ Glossary`, top bar): 75 entries covering the
ML concepts this project depends on and plain-language descriptions of every
dataset WhAM was trained on, each with a formal definition and an "explain like
I'm 5" version. Figures in it were read from the shipped Zenodo checkpoints
rather than the paper.

Runs entirely client-side — no model, no GPU, no network. It synthesises codas
from published coda notation and accepts drag-dropped WAVs, so it analyses real
recordings the moment you have them.

**Important:** the measurements it reports are browser DSP — spectral-flux onset
detection, mel spectra, DTW. They are *not* WhAM embeddings and *not* Fréchet
Audio Distance. See [`explorer/README.md`](explorer/README.md) for what it
measures, what it cannot, and the documented limits of its IPI estimator.

## Planned experiments

Tracked in [`CLAUDE.md`](CLAUDE.md), ordered by effort:

1. **Cross-species FAD ladder** — distance between real codas and a ranked set
   of impulsive sources; does the ordering match acoustic intuition?
2. **Structure-vs-timbre probe** — feed structured input through acoustic
   translation. If rhythmic structure survives, the model learned a timbre; if
   outputs snap to canonical coda types regardless, something closer to a
   grammar. Highest information per GPU-hour.
3. **Embedding transfer** — WhAM embeddings against BEANS tasks, versus AVES
   and BirdNET.
4. **Click-language null test** — ǃXóõ / Nama speech versus matched non-click
   speech. *Predicted result: no effect.* Human clicks are velaric ingressive
   consonants; whale clicks pattern as vowel-like carriers. "Click" is a false
   cognate across the two domains.
5. **Noise artifact ablation** — vowel classification across denoised, raw, and
   noise-only conditions, ideally across recording equipment.

## Setup

The upstream WhAM repo is **not** vendored here — it's gitignored. Clone it
alongside if you need the Python pipeline:

```bash
git clone https://github.com/Project-CETI/wham.git
```

Then follow its README: Python 3.9, `pip install -e .`, `pip install -e
./vampnet`, `madmom` with `--no-build-isolation`, ffmpeg, and weights from
[Zenodo](https://doi.org/10.5281/zenodo.17633708) extracted to `vampnet/models/`.

On Apple Silicon, read [`INSTALL.md`](INSTALL.md) first — the pipeline runs fine
on MPS and CPU without CUDA, but there is a Rosetta trap in the default `PATH`
and a LibreSSL conflict that breaks `fadtk`.

The `explorer/` tool needs none of that.

## Conventions

- Each experiment gets its own directory with a `README.md` stating the
  question, the control condition, and the result — including null results.
- Define the control condition *before* running. It is easy to rationalise a
  distance ordering after the fact.
- Log the checkpoint used for every generation.

## Data and licensing

No audio or datasets are committed here, and `.gitignore` excludes them by
default. Licensing differs per source — Common Voice is CC0, AudioSet is
YouTube-derived with its own terms, Watkins and the UCLA Phonetics Lab Archive
each carry separate use conditions. Check before redistributing anything.

## License

[MIT](LICENSE) for the code in this repository. WhAM itself is MIT and remains
the property of its authors; cite the paper if you build on it.
