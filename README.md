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

### [`explorer/observatory.html`](explorer/) — null models over the real coda corpus

The part of this repo that works on **measured data**. Sharma et al. deposited
the inter-click intervals behind their 2024 Nature Communications paper publicly,
so the explorer's biggest documented limitation — "these are stylised
realisations of coda notation, not ground truth" — is now removable. 8,112
cleaned codas with clan, social unit, and individual labels.

It is built around one result, and the result is a **null result**.

Sperm whale clans EC1 and EC2 separate strongly in rhythm space (0.1287); a naive
label permutation gives p < 0.0005, 43× the null. But two things are wrong with
that test. EC1 is 65% coda type `1+1+3` while EC2 is 98% `5R3`, so the clans
mostly differ in *which* codas they use. And clan is a property of a social unit,
not of a coda — all 12 units are single-clan — so shuffling clan across 6,105
individual codas treats correlated observations as independent.

Control either one and the effect shrinks. Control **both at once** — remove each
coda's coda-type mean, then permute clan across whole units — and it vanishes:

| null | p |
|---|---|
| naive | 0.0005 |
| stratified by coda type | 0.0005 |
| by social unit | 0.0152 |
| **both together** | **0.9630** |

95% of random unit relabellings separate the clans *more* than the real split
does. So the tool makes the null model the primary control, reports *explained by
null* beside every p-value, and states which confounds each null does and does not
handle.

It also places coda rhythm on a shared axis with real human drumming: whale codas
sit at nPVI 21.0 against 56–78 for human drummers measured through the identical
pipeline (Cohen's d = −1.3 to −2.5), and 101 for a Poisson process. Coda type
`5R3` is at 4.2 — very nearly a metronome.

```bash
python3 tools/fetch_corpus.py && python3 tools/fetch_comparanda.py
cd explorer && python3 -m http.server 8777   # → /observatory.html
```

No data is committed: the Sharma deposit carries no LICENSE file, so everything
is fetched on demand into gitignored paths.

### [`explorer/`](explorer/) — browser-based coda / rhythm / click comparison

A zero-dependency web tool for putting sperm whale coda structure side by side
with rhythm sources, click-language sequences, and other impulsive animal
signals, and seeing what a rhythm metric and a timbre metric say about the pair.

```bash
cd explorer && python3 -m http.server 8777   # → http://localhost:8777/
npm test                                     # 299 assertions, 4 suites
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

## Experiments run

- [`00-device-equivalence`](experiments/00-device-equivalence/) — CPU vs MPS.
  **Verdict: equivalent**, all four pre-registered criteria passed.
- [`01-clan-rhythm-confound`](experiments/01-clan-rhythm-confound/) — is the
  EC1/EC2 rhythm difference a dialect or a repertoire difference?
  **Null result.** Controlling repertoire composition and unit-level
  non-independence together gives p = 0.96, with 95% of null relabellings
  producing a larger separation than the real one. Two earlier, weaker versions of
  this conclusion are recorded alongside it rather than overwritten.
- [`02-cross-domain-rhythm`](experiments/02-cross-domain-rhythm/) — where does
  coda rhythm sit relative to human rhythm? **Below every human drumming style
  measured** (nPVI 21.0 vs 56–78, Cohen's d −1.3 to −2.5), through an identical
  pipeline at a matched window length.
- [`03-ipi-against-real-audio`](experiments/03-ipi-against-real-audio/) — the
  IPI estimator's thresholds were tuned on this repo's own synthesis and had
  never met a real recording. Against 48 real sperm whale clicks from the
  **Western North Pacific**: **24/24 returned values inside the 2–10 ms physical
  band**, spread 0.48 ms, implied body length 8.9–9.6 m. All three pre-registered
  criteria passed.
- [`04-pacific-clan-rhythm`](experiments/04-pacific-clan-rhythm/) — experiment 01
  said the clan-rhythm question needed a corpus with real repertoire overlap.
  This is that corpus: **7 Pacific clans, 191 repertoires, 23 regions,
  1978–2017**. The design blocker is gone — leverage 42–303 against Dominica's
  33.3, detection floor 0.016–0.200 against ~0.40, negative control at nominal
  rate. The result is the sequence, not the headline: **15 of 21 clan pairs
  → 7 of 18 once region and year are matched → 3 of 21 under conservative
  clustering → 2 of 13 under both jointly.** Every Palindrome result is recording
  era (it was taped 2013–14 against everyone else's 1978–2003, zero overlapping
  years). What survives everything is two pairs, Regular/Short and
  Regular/Rapid-Increasing.
  A side result with wider reach: the day-for-unit substitution that every
  corpus without social-unit ids is forced into is **measurably
  anti-conservative** — calibrated against Dominica, where both are known,
  101 of 126 true-null splits shift *p* downward (sign test p = 5e-12).
- [`05-structure-vs-timbre`](experiments/05-structure-vs-timbre/) — did WhAM
  learn a coda timbre or a coda grammar? **Neither.** β, the slope of output
  nPVI on input nPVI, falls from ~1 to ~0 across a sharp transition between mask
  0.4 and 0.6. Below it input rhythm passes through; above it the model neither
  preserves the input nor imposes coda timing, drifting to nPVI ~90 against real
  codas at 18–21 and a Poisson process at 101 — *from coda-like inputs*. A
  density control rules out the detector artifact and a codec round-trip
  (slope 1.000, r 0.9995 on synthetic) rules out reconstruction. **WhAM's
  generative prior over rhythm, reached through acoustic translation, is not
  coda-shaped.** The pre-registered G0 measurement gate failed first, in the
  direction that would have manufactured the grammar result with no model
  involved.
- [`06-audio-annotation-join`](experiments/06-audio-annotation-join/) — can the
  open DSWP audio be joined to the public coda annotations, which are published
  as disjoint artifacts? **Gate failed; no matching was run.** On synthetic
  material the detector is near-perfect (99.2% exact click count across four
  sample rates and three IPIs). On real audio only 35.5% of files hold their
  click count under a ±20% sensitivity change, and the median recovered count is
  **11 at 44.1 kHz against 4 at 48 kHz** — so matching would have paired files to
  annotation rows by recording equipment. The obvious remedy is disqualified:
  the 200 ms floor that makes counts look coda-like merges 58.9% of real
  annotated ICIs. Recovered anyway: the corpus contains **five recording
  configurations**, derived from WAV headers, in a dataset whose card states no
  such metadata exists.

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

### Corpora

| corpus | what | basin | licence |
|---|---|---|---|
| Sharma et al. 2024 | 8,112 cleaned codas, annotated ICIs + clan/unit/individual | Caribbean (Dominica) | article CC BY 4.0; **the deposit itself has no LICENSE file** |
| **Hersh et al. 2022** | 22,795 cleaned codas, ICIs + clan/repertoire/region/year/lat-lon, **7 clans, 191 repertoires, 23 regions, 1978–2017** | **Pacific** | article CC BY-NC-ND 4.0; **the [OSF deposit](https://osf.io/ae6pd/) declares no licence** |
| **ASACTER** (Hualien Formosa Association & Turumoan Whale Watching) | 110 sperm whale records, 109 of them audio, 192 kHz, 26.2 min | **Western North Pacific (Taiwan)** | **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — redistributable**; [deposit](https://figshare.com/search?q=ASACTER), per-record DOIs under `10.6084/m9.figshare.*` |
| Groove MIDI | 1,150 human drum performances | — | CC BY 4.0 |

```bash
python3 tools/fetch_corpus.py          # Dominica coda ICIs
python3 tools/fetch_pacific.py         # Pacific coda ICIs (7 clans, 23 regions)
python3 tools/fetch_comparanda.py      # human drumming + symbolic rhythms
python3 tools/fetch_asacter.py         # ASACTER index + WAV header probe, no audio
python3 tools/fetch_asacter.py --audio coda   # + 34 MB of coda-labelled audio
```

**ASACTER is a second population, not a second coda corpus.** Only 5 of its 110
records are labelled as containing codas (88 s nominal, ~83 s distinct, one
voyage), and **there are no clan, social-unit or individual labels of any kind**.
That last point settles it from the index alone: it cannot answer the clan-timing
question experiment 01 leaves open, because that needs repertoire overlap between
*labelled* clans and unlabelled audio cannot supply it. The other 105 records are
labelled by the depositor, not inspected here. What ASACTER does give is real
audio for validating the IPI estimator, and a licence that permits
redistribution.

Duration is measured from each file's own `fmt` chunk, not from the `_Nsec`
filename tokens — 17 of the 109 WAVs carry no token and they include the longest
files, so the token sum (17.4 min) understates the corpus by a third. Formats are
stereo 32-bit for 104 files and mono 16-bit for the 5 coda files.
`tools/fetch_asacter.py` derives its own trap list from the metadata (date-field
disagreements, a record with no audio, two records sharing a WAV filename) rather
than hardcoding what someone noticed by eye.

No audio or datasets are committed here, and `.gitignore` excludes them by
default. Licensing differs per source — Common Voice is CC0, AudioSet is
YouTube-derived with its own terms, Watkins and the UCLA Phonetics Lab Archive
each carry separate use conditions. Check before redistributing anything.

## License

[MIT](LICENSE) for the code in this repository. WhAM itself is MIT and remains
the property of its authors; cite the paper if you build on it.
