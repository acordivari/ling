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
- **Not recordings.** No audio ships with this tool. The coda presets on *this*
  page are stylised realisations of published coda *notation* — a name like
  `1+1+3` or `5R1` specifies a click count and a rhythm class, and the normalised
  inter-click intervals in `js/library.js` are a plausible realisation of that
  class, not ground truth from DSWP.

  **This no longer applies to [`observatory.html`](#coda-observatory--observatoryhtml),
  which analyses 8,112 real measured codas** from the Sharma et al. deposit. If
  you want numbers about actual whales rather than a demonstration of the
  metrics, that is the page to use.

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

**The "irreducible" failure mode was not irreducible.** This section used to say
that autocorrelation cannot distinguish one click with a 6 ms internal echo from
two clicks 6 ms apart, and recorded `dolphin-burst` firing at 88% as a documented
limitation. That was wrong, and the way it was wrong is worth keeping.

The estimator clips its analysis window at the *next* onset — measure inside one
click, not across several. But when no next onset exists it fell back to the full
20 ms window. A dolphin burst pulse renders 40 clicks at 6→4 ms and spectral flux
resolves only **one** of them, because at that rate there is no recoverable
per-click rising edge. One onset means no onset to clip against, so the window
swallowed roughly four dolphin clicks and autocorrelation reported their spacing
as an intra-click IPI — **10 runs out of 10**, at the estimator's stated
confidence. Via Gordon (1991) a 6 ms IPI implies a sperm whale of about 13 m.

The tool was fabricating a species from a dolphin, and the behaviour was
documented as acceptable rather than investigated.

The fix is one line: if the window cannot be bounded by a following onset, return
`null`. A count-based guard would *not* have worked — the bound depends on whether
a later onset exists, not on how many there are, so two hand-supplied onsets
400 ms apart still fabricated.

| | detection rate |
|---|---|
| whale, IPI 3–9.5 ms | 100% |
| whale, IPI 2.5 ms (band edge) | 90% |
| `dolphin-burst` | **0% of 20 — was 100%** |
| aggregate across all 18 non-whale sources | **0.0% of 216 trials** |

Four guards remain: reject tonal material, reject the click's own resonant ring
via two independent cycle-count tests, refuse an unbounded window, and bound the
search to the physically plausible 2–10 ms band.

Degradation under added noise (IPI 5.5 ms, N=150 per level):

| noise floor | 0.0 | 0.3 | 0.6 | 1.0 |
|---|---|---|---|---|
| detection | 100% | 100% | 96% | 47% |

Accuracy does not degrade with noise — worst error stays at 0.01 ms across every
level. The estimator drops out rather than reporting a wrong value, which is the
intended direction.

Do not treat IPI presence as a whale detector. Read the reported `r`.

**The default `minIci` over-counts onsets on most rhythm sources.** Found late, by
a verification script (`tools/measure_onsets.mjs`) written to recompute every
number rather than trust any of them. Measured at 44.1 kHz, seed 5:

| source | true onsets | detected @ `minIci` 0.03 (default) | @ 0.08 |
|---|---|---|---|
| son clave | 5 | **10** | 5 |
| Amen break | 7 | **14** | 7 |
| isochronous | 8 | **16** | 8 |
| beatbox | 10 | 13 | 10 |
| Morse | 14 | 16 | 14 |
| Euclidean E(5,8) | 5 | 5 | 5 |

Three sources are *exactly* doubled: the spectral-flux detector splits each onset
in two and the 30 ms suppression window is too short to merge them. Every rhythm
distance this A/B tool reports against those sources is therefore computed on
twice the true number of intervals. `minIci` of 0.08–0.10 gives F1 = 1.000 on all
six at every seed tested.

**Deliberately not fixed here.** Raising the default changes the behaviour the
existing 84 assertions were written against, and that is a judgement call about
this A/B tool rather than a defect in the analysis added later — the Observatory
does not use onset detection at all, it works from annotated inter-click
intervals. Until it is decided: raise the `min interval` slider to 0.08 before
reading any rhythm distance involving clave, Amen, isochronous or beatbox.

**Threshold provenance.** The confidence floor (0.22) and the cycle-count cuts
(20 against spectral centroid, 3 against zero-crossing rate) were set by
measuring the synthetic sources in `library.js`, not derived from physics and
not fitted to real recordings.

**That re-check has now been run** — against 48 real sperm whale click segments
from ASACTER, using the shipped `estimateIpi` with `carrierHz` supplied exactly
as `analyze()` supplies it. See `experiments/03-ipi-against-real-audio/`. Two
results matter here:

- **The margins are thin.** The tightest real click cleared the confidence floor
  by 3 % (6 of 24 sat within 0.05 of it) and the spectral-centroid cut by
  **0.4 %**. The ZCR cut is comfortable (+200 %). These thresholds are not
  validated so much as caught barely passing.
- **They do not fail safe against periodic broadband artefacts.** Synthetic
  impulse trains at 120–450 Hz — what propeller cavitation looks like — fire
  8/8, all inside the 2–10 ms band, at *higher* confidence (0.39–0.77) than any
  real click (0.23–0.49). Raising the floor would delete whales before
  artefacts. The estimator does correctly refuse white noise and single pulses
  (0/48 each).

They fail safe against noise and against structureless impulses. They do not
fail safe against a rhythm. Do not read a single confident IPI from
vessel-adjacent audio as evidence of a whale.

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
npm test                          # all four suites
node test/analysis.test.mjs       # 84 assertions, signal round trip
node test/glossary.test.mjs       # 24 assertions, reference data integrity
node test/rhythm.test.mjs         # 94 assertions, statistics kernel
node test/observatory.test.mjs    # 97 assertions, claim wiring + every claim x null
```

299 assertions total.

**The suite is now deterministic — byte-for-byte, output included.** It
previously failed about 1 run in 40 on `IPI 2.5ms (band edge)` — not a
regression, just an unlucky noise draw, because the click grains are noise-based
and the RNG was unseeded. `js/random.js` now provides a seeded generator and each
stochastic block re-seeds, so results do not depend on test order.

Verified by hashing `npm test` output across 15 consecutive runs and confirming a
single distinct hash. That check caught a second problem worth naming: the
observatory suite originally printed elapsed milliseconds per claim, so its
stdout differed on every run even though every result was identical. Timings are
no longer printed — a suite whose output changes for reasons unrelated to
behaviour cannot be diffed, which is most of what determinism buys you.

Measured across 200 independent seeds, that assertion's threshold of 0.6 genuinely
fails on 2.0% of them — which is exactly the flake rate that was observed. Seeding
removes the flake; it does not make the estimator better, and the comment in the
test says so.

`test/rhythm.test.mjs` asserts **known answers only** — values derived by hand
(isochronous nPVI is exactly 0, a 2:1 alternation is exactly 200/3, a 3:1 is
exactly 100) or computed independently in Python. A suite that snapshots its own
implementation proves only that the code is deterministic. The corpus-dependent
assertions skip cleanly when the data has not been fetched, and cross-check
against Python: mean nPVI 20.9871 and clan separation 0.12871, both matched to
1e-4.

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

## Coda Observatory — `observatory.html`

A second screen, and the one that works on **real measured data** rather than
synthesis. It exists because of a single result.

Sperm whale clans EC1 and EC2 have visibly different mean coda rhythms:
separation 0.1287 in standardised-ICI space. Shuffle the clan labels and the
null separation is 0.0030 — p < 0.0005, an effect 43× the null. That looks like
a clean demonstration of clan dialect.

But EC1 is 65% coda type `1+1+3` and EC2 is 98% type `5R3`. Permute the labels
*within each coda type*, so the null preserves each clan's repertoire and
destroys only timing, and the null mean is **0.1274 — 99.0% of the observed
value**. The residual is 1.0%, and it rests on crossover cells of n=15 and n=19.

Both nulls return p < 0.0005. The p-value cannot tell them apart. So the screen
is built around the number that can:

> **explained by null** — how much of the observed statistic the control already
> reproduces on its own.

The null model is the primary control on the page, not a buried setting. Switch
it and the verdict text rewrites itself.

### And then a third null, which is the one that matters

Adversarial review found both nulls above **pseudoreplicated**. Clan is perfectly
nested inside social unit — every one of the 12 real units is single-clan — so
shuffling clan across individual *codas* builds a world that cannot exist, and
treats 6,105 correlated observations as independent. That is where z = 71.9 comes
from.

Permuting whole **social units** instead:

| null | explained by null | z / rank | p |
|---|---|---|---|
| naive, coda-level | 2.4 % | z 71.89 | < 0.0005 |
| stratified by coda type, coda-level | 99.0 % | z 4.93 | < 0.0005 |
| **by social unit** | **25.3 %** | **rank 1 of 66** | **0.0152** |

The effective sample size is **12 units, not 6,105 codas**. There are only
C(12, 2) = 66 ways to assign 2 of 12 units to EC2, so **0.0152 is the finest
p this design can ever produce** — more shuffles buy nothing, and the app says so
rather than printing `1/2001`.

The unknown-unit sentinel `ZZZ` is excluded. Counting it as a 13th unit inflates
the space to C(13, 3) = 286 and manufactures four times the resolution — an
earlier version of this very fix made exactly that mistake.

### And a fourth null, which is the actual answer

25.3 % and 99.0 % are not on a common scale: the cluster null controls for
non-independence but not repertoire, the stratified null the reverse. Each left a
residual, and reporting both without ever running them **together** claims more
than the data supports.

Remove each coda's own coda-type mean, *then* permute clan across the 12 units:

| null | p | |
|---|---|---|
| naive, coda-level | 0.0005 | "This survives the null" |
| stratified by coda type | 0.0005 | 99.0 % explained |
| by social unit | 0.0152 | rank 1 of 66 |
| **both at once** | **0.9630** | **smaller than chance produces** |

Observed 0.00145 against a null mean of 0.00585, with **95 % of unit relabellings
producing a larger separation than the real one**. The clans differ in *which*
codas they use. There is no detectable difference in *how they time a shared coda
type*.

**That is a null result, and it is the headline.** It was found by adversarial
review running the test this project had declined to implement — the refusal to
combine `clusters` with `strata` was described here as restraint, and it was not.

### What is on it

- **Cross-domain rhythm ladder.** nPVI (durational contrast) for whale codas
  against real human drumming, exact symbolic rhythms, and controls. Whale codas
  land at 21.0; human drumming at 56–78; a Poisson process at 101. Coda type
  `5R3` is at 4.2, which is nearly metronomic. Every source is cut into matched
  4-interval windows, because nPVI variance depends strongly on window length.
- **The Null Lab.** Four pre-registered claims, each with two or three null
  models (the clan claim has three, including a cluster-level one), a null-distribution plot with the observed value marked, and effect
  sizes alongside every p-value.
- **Predict before reveal.** You commit to what you expect the null to do before
  the result is shown. This is pre-registration as an interaction: the only part
  of the screen you can get right through understanding rather than luck.

### Getting the data

No data is committed — the Sharma et al. deposit carries no LICENSE file, so it
is fetched on demand into gitignored paths.

```bash
python3 tools/fetch_corpus.py       # 8,112 cleaned codas -> explorer/data/
python3 tools/fetch_comparanda.py   # human drumming + symbolic rhythms
cd explorer && python3 -m http.server 8777
```

Without them the page explains what to run rather than rendering empty.

### Two kinds of statistic, and a bug worth knowing about

`explained by null` is `nullMean / observed`. That is a proportion **only when
"no effect" implies "statistic near zero"** — true for a distance (two identical
groups separate by 0), false for a shift (mean nPVI under a shuffled null is ~35,
not 0).

Applied to a shift, the ratio exceeds 1 and reads as "the null explains
everything", which is exactly backwards: real codas at nPVI 21.0 against a
within-coda shuffled null of 34.8 is one of the strongest results here. Every test
therefore declares a `kind`, and `explainedByNull` is `null` for shifts rather
than a misleading number. There is a regression test in `test/rhythm.test.mjs`.

### And a second bug found by review, worth reading

The first version of that shuffle null was itself wrong, in exactly the way this
tool exists to catch. Its label said "each coda keeps its own intervals; only the
ORDER is destroyed", but the implementation flattened all 6,105 codas into one
24,420-interval pool and shuffled globally — so intervals migrated between codas
and it destroyed between-coda tempo variation too. Measured:

| null | mean nPVI | gap from observed 20.99 |
|---|---|---|
| within-coda shuffle (what the label promised) | 34.8 | 13.8 |
| pooled shuffle (what shipped) | 62.4 | 41.4 |
| Poisson | 100.0 | 79.0 |

A 3× overstatement, produced by a null that failed to preserve a structural
feature of the data — the precise failure mode the Null Lab is built to expose.
`surrogateBlockTest` now applies surrogates per block with boundaries intact, and
the pooled version is kept as an explicitly weaker null, because the contrast
between those three rows is the clearest lesson in the tool.

## Files

```
index.html          A/B comparison tool
observatory.html    null-model workbench over the real corpus
css/app.css         theme
css/observatory.css observatory layout
js/dsp.js           FFT, spectral-flux onsets, mel, IPI estimation
js/synth.js         coda / rhythm / click-language / animal synthesis
js/library.js       coda inventory, click inventories, source definitions
js/compare.js       DTW, distances, nearest-coda search
js/random.js        seeded PRNG — determinism for tests and null models
js/rhythm.js        nPVI, CV, rhythm ratios, permutation and surrogate nulls
js/claims.js        the pre-registered claims and their null models
js/observatory.js   observatory UI
js/viz.js           canvas plots
js/main.js          wiring
js/glossary.js      reference panel UI (search, filter, cross-links)
js/glossary-data.js 75 glossary entries + category definitions
```

Tooling lives at the repo root:

```
tools/fetch_corpus.py       fetch + clean the Sharma et al. coda corpus
tools/fetch_comparanda.py   build the cross-domain comparison set
tools/test_midi_parser.py   validate the stdlib MIDI parser against mido
```

`js/dsp.js` and `js/compare.js` are pure functions over `Float32Array` and have
no DOM dependency, so they can be imported and tested under Node directly.
