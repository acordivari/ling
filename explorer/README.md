# WhAM Explorer

A browser tool for putting sperm whale coda structure side by side with rhythm
sources, click-language sequences, and other impulsive animal signals — and
seeing what a rhythm metric and a timbre metric actually say about the pair.

**Question it exists to serve:** before spending GPU hours on the experiments in
`CLAUDE.md`, what does coda rhythm space look like, and how easily do unrelated
impulsive sources land inside it?

## Run it

```bash
cd explorer
python3 -m http.server 8777
# open http://localhost:8777/
```

No build step, no npm, no network. Eight ES modules and one stylesheet. It has
to be served over HTTP rather than opened as a `file://` URL because it uses ES
modules; microphone capture additionally requires `localhost` or HTTPS.

## What it is not

This is the important part.

- **Not WhAM.** The model is never loaded. Running it needs the Python pipeline
  and the Zenodo weights — see [`INSTALL.md`](../INSTALL.md). It does *not* need
  CUDA: WhAM runs on Apple Silicon via MPS, and on CPU.
- **Not Fréchet Audio Distance.** FAD needs the Python pipeline
  (`wham/generation/eval/`). The distances here are DTW over inter-click
  intervals and cosine over mel spectra — cheap, interpretable, and unrelated
  to what FAD measures.
- **Not recordings.** No audio ships with this tool. The coda presets are
  stylised realisations of published coda *notation* — a name like `1+1+3` or
  `5R1` specifies a click count and a rhythm class, and the normalised
  inter-click intervals in `js/library.js` are a plausible realisation of that
  class, not ground truth from DSWP.

Drag any WAV/MP3/FLAC onto either panel to analyse real audio instead. Once you
have DSWP or Watkins material, that is the intended use; the synthesis is
scaffolding for the period before then.

## Layout

**Left (A)** — sperm whale. Pick a coda type, then shape the click itself:

- `inter-pulse interval` is the one control worth playing with. A sperm whale
  click is not a single impulse: sound reflects inside the spermaceti organ and
  emits a decaying pulse train (P0, P1, P2 …). The IPI scales with organ length,
  hence body size. In the frequency domain that train is a comb, and the comb is
  what produces the spectral peaks the coda-vowel literature analyses. Move the
  slider and watch the peaks in the click-spectrum plot move with it.
- `background noise` connects to experiment 5 in `CLAUDE.md` — raise it and
  watch the spectral statistics drift, which is the shape the noise-artifact
  worry takes.

**Right (B)** — the comparison source. Rhythm (Morse, Euclidean, clave, Amen,
isochronous control, beatbox), click language (Taa/ǃXóõ, Nama, Xhosa
inventories), animal (dolphin, woodpecker, bat, beluga, narwhal, plus the
random-impulse control the upstream repo builds in
`data/testing_data/impulses/create_impulses.py`), file, or microphone.

**Bottom** — four separate distances rather than one score, DTW alignment
between the two ICI contours, and nearest coda types to B.

## The metrics

| metric | what it is | range |
|---|---|---|
| rhythm shape | DTW over ICI divided by total duration | 0 = identical shape |
| timbre | cosine over mean-centred log-mel | 0 identical, 0.5 uncorrelated, 1 opposed |
| tempo | \|log\| ratio of click rates | 0 = same rate |
| regularity | difference in ICI coefficient of variation | 0 = equally even |

Rhythm is duration-normalised, so it is blind to tempo *by construction* — that
is why tempo is reported separately rather than folded in. `5R1` and `5R3` have
the same shape at different speeds and land at rhythm ≈ 0, tempo ≈ 0.6. The
composite in `compare.js` exists to give an ordering; its weights are arbitrary
and shown rather than hidden.

## Known limitations

**IPI estimation has an irreducible failure mode.** Autocorrelation cannot
distinguish one click with a 6 ms internal echo from two clicks 6 ms apart. A
fast click train (a dolphin buzz at 4–6 ms spacing) therefore registers a
spurious IPI, and no amount of filtering fixes that — it is the same
measurement.

Four guards are applied: reject tonal material, reject the click's own resonant
ring via two independent cycle-count tests, never window past the next onset,
and bound the search to the physically plausible 2–10 ms band. Measured against
the synthetic library:

| | detection rate |
|---|---|
| whale, IPI 3–9.5 ms | 100% |
| whale, IPI 2.5 ms (band edge) | 90% |
| `dolphin-burst` (4–6 ms click train) | **88% — the documented failure case** |
| aggregate across the other 17 non-whale sources | 0.5% of 204 trials |

Degradation under added noise (IPI 5.5 ms, N=150 per level):

| noise floor | 0.0 | 0.3 | 0.6 | 1.0 |
|---|---|---|---|---|
| detection | 100% | 100% | 96% | 47% |

Accuracy does not degrade with noise — worst error stays at 0.01 ms across every
level. The estimator drops out rather than reporting a wrong value, which is the
intended direction.

Do not treat IPI presence as a whale detector. Read the reported `r`.

**Threshold provenance.** The confidence floor (0.22) and the cycle-count cuts
(20 against spectral centroid, 3 against zero-crossing rate) were set by
measuring the synthetic sources in `library.js`, not derived from physics and
not fitted to real recordings. They fail safe — a marginal real click is
reported as "no IPI" rather than given a fabricated value. **Re-check them
against real DSWP audio before relying on any of this.**

## Glossary

`◈ Glossary` in the top bar opens a reference panel covering the machine
learning concepts this project depends on and the datasets WhAM was trained on.
75 terms across seven categories, searchable, with cross-links between related
entries.

Each entry has two registers: a **formal definition** that stays visible, and an
**Explain Like I'm 5** version behind a toggle. The split is deliberate — the
formal text is what you want when reading upstream code, the plain-language
version is what you want when deciding whether a concept matters to an
experiment.

Numbers quoted in the entries were read out of the shipped Zenodo checkpoints
and the upstream source, not transcribed from the paper:

| | |
|---|---|
| `coarse.pth` | 335.9M params, 20 layers, 20 heads, d=1280, 4 codebooks |
| `c2f.pth` | 277.8M params, 16 layers, 20 heads, d=1280, 14 codebooks (4 conditioning) |
| `codec.pth` | 150.2M params, 44.1 kHz, 14 × 1024 codebooks, hop 768 |

Two entries worth reading before interpreting any training run — **Frozen
Weights** and **Parameters** — document a quirk inherited from upstream
VampNet: `loralib` freezes its own base weights on construction and nothing
sets them back, so roughly 15% of the network is trainable even during a full
training pass, and upstream's own parameter counter reports only that 15%.

The panel is self-contained. `js/glossary.js` imports nothing but its own data,
and nothing else imports it — deleting the two files and one `<script>` tag
removes the feature cleanly.

## Tests

```bash
npm test                          # both suites
node test/analysis.test.mjs       # 84 assertions, signal round trip
node test/glossary.test.mjs       # 23 assertions, reference data integrity
```

The glossary suite checks the wiring rather than the prose: unique ids, every
`seeAlso` resolving to a real entry, categories matching the filter list, and
the two registers actually differing. All three failure modes are silent in the
browser — a dead cross-link just renders as nothing.

The analysis suite is 84 assertions. They synthesise signals with known structure and check the
analysis recovers it — the only reason to trust any number the UI shows. The
IPI assertions are rate-based over repeated trials because the click grains are
noise-based and detection is genuinely stochastic at the edges.

The suite caught four real defects during development, each of which had been
silently producing plausible-looking output: spectral flux missed the **first**
onset of every clip; cosine distance over uncentred log-mel returned ~0 for
every pair; Morse dashes retriggered the detector mid-symbol; and IPI estimation
fired confidently on pure tones and percussion, where it was measuring the
carrier period rather than any echo.

`package.json` exists only so Node treats `js/*.js` as ES modules. There are no
dependencies and no build step.

**Onset detection is a single spectral-flux detector.** The two sliders in the
top bar apply to both panels simultaneously so comparisons stay fair. Change
them and re-read both sides; a rhythm distance computed at different
sensitivities on each side means nothing.

## Reading the click-language panel

The predicted result is a **null**, and that prediction is the point.

Human clicks are velaric ingressive *consonants* produced in the oral cavity and
embedded in voiced syllables. Sperm whale clicks are pneumatically driven
broadband pulses that pattern as vowel-like carriers. "Click" is a false cognate
across the two domains. Any closeness the metrics report reflects both signals
being impulsive, not a shared linguistic category.

The visible tell is in the spectrogram: the click-language render has continuous
voiced energy *between* the clicks. A coda has silence.

For real speech, use the UCLA Phonetics Lab Archive (Ladefoged collection) and
drop the WAVs in. The synthesised sequences here are phonotactic demonstrations
of how clicks distribute inside syllables — they are not lexical items from any
language, and the per-place synthesis targets are approximations of the
Ladefoged & Traill acoustic descriptions of ǃXóõ.

## Swapping in real model embeddings

The seam is `compare()` in `js/compare.js`. It consumes two feature objects and
only touches `.iciNorm` (rhythm) and `.mel` (timbre). To compare with WhAM
embeddings instead of mel spectra, run `wham/embedding/generate_embeddings.py`,
serve the vectors as JSON, and assign them to `features.mel` before calling
`compare()` — the DTW, the alignment plot, and the nearest-coda search all keep
working unchanged. That would make the timbre column mean something much closer
to what the paper's Figure 3 measures.

## Files

```
index.html        layout
css/app.css       theme
js/dsp.js         FFT, spectral-flux onsets, mel, IPI estimation
js/synth.js       coda / rhythm / click-language / animal synthesis
js/library.js     coda inventory, click inventories, source definitions
js/compare.js     DTW, distances, nearest-coda search
js/viz.js         canvas plots
js/main.js        wiring
js/glossary.js    reference panel UI (search, filter, cross-links)
js/glossary-data.js  75 glossary entries + category definitions
```

`js/dsp.js` and `js/compare.js` are pure functions over `Float32Array` and have
no DOM dependency, so they can be imported and tested under Node directly.
