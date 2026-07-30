# 02 — Where does coda rhythm sit relative to human rhythm?

**Status:** control condition and prediction registered before the human-side
data was parsed. Run 2026-07-29.

## Question

Sperm whale codas are click sequences. Human drumming is also a sequence of
impulsive onsets. Both can be reduced to inter-onset intervals, so both can be
placed on the same durational-contrast axis.

Does coda rhythm sit inside the range human rhythm occupies, or somewhere else
entirely?

This is a question about **form, not function**. Codas are identity signals used
within social units; drumming is music. Nothing here treats them as the same kind
of thing. The claim is narrow: given two systems that both emit timed impulses,
where does each fall on a measure of how much adjacent intervals differ?

## Statistic

**nPVI** — normalised Pairwise Variability Index (Grabe & Low; Patel & Daniele
2003), the standard measure for comparing speech and music rhythm:

```
nPVI = (100 / (m−1)) · Σ |d_k − d_{k+1}| / ((d_k + d_{k+1}) / 2)
```

Tempo-invariant by construction. 0 = perfectly isochronous; ~66.7 = strict 2:1
alternation; ~100 = a memoryless (Poisson) process.

## Data — both sides measured, neither synthesised

| side | source | n |
|---|---|---|
| sperm whale | Sharma et al. annotated ICIs, 5-click codas | 6,105 windows |
| human | **Groove MIDI** (Magenta, CC BY 4.0) — 1,150 real drummer performances, 675 parsed | 5,981 windows (rock) etc. |

All drum voices are collapsed to a single onset train (hits within 12 ms merged
as one perceptual onset), which is the fair analogue of a click train.

## Control condition — stated before running

1. **Window matching.** nPVI is computed over m−1 intervals and its variance
   depends strongly on m. Comparing a 4-interval coda against a whole 2-minute
   drum take would measure window length, not rhythm. Every source is therefore
   cut into **4-interval windows**, matching the dominant 5-click coda.
2. **Two controls bracket the axis.** Isochronous (nPVI exactly 0) and a Poisson
   process (no timing structure). Any real system must fall between them, and if
   it does not, the pipeline is wrong.
3. **Cohen's *d*** as the primary evidence, with a permutation test reported
   alongside but explicitly discounted.

**On why the p-value here is near-worthless, stated up front rather than after
seeing it:** whale codas and human drumming are not exchangeable under any
plausible null. They are different species measured through different chains
(expert ICI annotation vs MIDI note-on timing). Permuting the labels asks "could
these two samples have come from one pool?", and the answer is no before any data
is collected. With thousands of windows, p < 0.0005 is guaranteed by construction.

What carries information is the **effect size**, plus the fact that both sides
went through an identical pipeline at an identical window length, plus the two
controls bracketing the axis. The p-value is reported only because omitting it
would look like hiding it.

**Pre-registered prediction:** whale codas will be markedly *more even* than
human drumming. Codas cluster on 1:1 isochrony; drumming exploits durational
contrast to make a groove.

## Result

Prediction confirmed, with a larger margin than expected.

| source | tier | n | nPVI |
|---|---|---|---|
| isochronous | control | — | 0.0 |
| **sperm whale `5R3`** | measured | 642 | **4.2** |
| Euclidean E(5,16) | exact-symbolic | 1 | 9.5 |
| **sperm whale `5R2`** | measured | 287 | **9.7** |
| **sperm whale `5R1`** | measured | 1,510 | **15.6** |
| **sperm whale, all 5-click** | measured | **6,105** | **21.0** |
| **sperm whale `1+1+3`** | measured | 3,589 | **26.6** |
| son clave (3-2) | exact-symbolic | 1 | 31.7 |
| dance | measured | 280 | 44.5 |
| Morse code (ITU) | exact-symbolic | 25 | 50.3 |
| hiphop | measured | 1,521 | 56.0 |
| rock | measured | 5,981 | 64.9 |
| funk | measured | 2,112 | 66.9 |
| soul | measured | 1,212 | 68.3 |
| latin | measured | 2,116 | 73.5 |
| afrobeat | measured | 520 | 75.4 |
| jazz | measured | 1,711 | 78.4 |
| Poisson process | control | 500 | 101.1 |

Permutation tests, whale vs each drum style: **p < 0.0005**, **Cohen's d = −1.30
to −2.48**.

### Reading this

**Whale codas fall below every human drumming style measured**, by a large effect
size, through an identical pipeline at an identical window length. Coda type
`5R3` at 4.2 is closer to a metronome than to any music in the set.

**The spread within the whale repertoire is itself the interesting part.** Codas
span 4.2 (`5R3`, nearly isochronous) to 26.6 (`1+1+3`, front-loaded) — a real
internal range, not a single point. But even the most contrastive coda type sits
below the least contrastive drum style.

### Deliberately not plotted

Published per-language nPVI values for human **speech** (English ~57, French ~43,
and so on) are widely cited and would make an attractive addition to this axis.
They are excluded for two reasons:

1. They are computed over **vocalic intervals across whole sentences**, not
   4-interval windows. Putting them on this axis would compare measurement
   protocols, not rhythms.
2. They could not be verified against an open-access source in this session —
   Patel & Daniele 2003 is paywalled and a PMC search returned no numeric values.
   Quoting recalled figures as fact is exactly the kind of thing this repo is
   supposed to avoid.

The whale-vs-drumming comparison needs no external reference: both sides were
measured here, the same way.

**Relevant constraint from the literature:** Ozaki et al. 2024 (*Sci Adv*,
PMC11095461) found song-vs-speech nPVI correlated at r = 0.087 across 55
languages — essentially not at all. So "music rhythm reflects speech rhythm" is
not a safe bridge, and no inference about speech should be drawn from the
drumming result.

## Reproducing

```bash
python3 tools/fetch_corpus.py
python3 tools/fetch_comparanda.py
./wham/.venv/bin/python tools/test_midi_parser.py   # validates the MIDI parser vs mido
cd explorer && python3 -m http.server 8777          # → /observatory.html
```

`tools/fetch_comparanda.py` contains a hand-written stdlib MIDI parser so the
toolchain has no third-party dependency. It is validated against `mido` on 250
real files: worst onset disagreement **2.8e-11 s**.

## What this does not license

- **Form, not function.** Occupying different regions of an nPVI axis is a
  statement about interval timing. It is not evidence that either system is or is
  not language, music, or communication.
- **One whale population**, and one drumming corpus (largely Western popular
  styles, one studio, a small number of drummers). "Human drumming" here means
  *this* corpus.
- **Collapsing drum voices is a choice.** A kit player produces several
  simultaneous streams; flattening them to one onset train is the right analogue
  for a click train but discards structure a drummer would say is the music.
- **nPVI is one statistic.** Two systems can share an nPVI and be nothing alike.
- **Neither side is independently sampled.** Up to 40 windows come from a single
  drum take, 675 takes from roughly 10 drummers; whale codas cluster by
  individual, social unit and recording session. The permutation test shuffles
  windows as though they were independent draws, which overstates precision. The
  effect sizes (Cohen's d of 1.3–2.5) are large enough that clustering is
  unlikely to reverse the direction, but the p-value is not a measurement — see
  the p-value note above, which is the main reason this experiment rests on d.
