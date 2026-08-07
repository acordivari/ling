# 08 — Do sperm whales take turns?

**Status: COMPLETE.** Pre-registration below was written before the ladder ran;
the prediction it records was correct, and the strongest result was not the one
being predicted.

**Headline: no turn-taking signal survives. Sperm whales overlap each other far
more than chance — 39.0% of adjacent cross-speaker coda pairs overlap in time,
against 18.4–25.6% in every surrogate, p = 0.0005 across all eight nulls.**

## Question

Every experiment in this repo so far has measured the *form* of a single coda —
its rhythm, its click structure, its spectral labels. Turn-taking is the first
question about the **exchange**, and it is a different kind of question. Rhythm
is a property of a signal; response contingency is a property of a
**conversation**, and it is the thing that distinguishes communication from
display.

> **When one sperm whale stops, does the next one start sooner — or more
> often — than chance predicts?**

## Why now

**Assayag, Gero, Paradise & Diamant, *Bioacoustics*, 19 June 2026**
(doi:10.1080/09524622.2026.2684665) — peer-reviewed, seven weeks before this was
written — reports that in Dominica whale pairs, the next coda from whale B is
predictable from up to 10 preceding codas of whale A. Their central metric is
**"Coda Break"**: the time from the last click of A's coda to the first click of
B's, **signed so that negative values quantify overlap.**

That sign convention means they met the same structure this experiment is built
around. Whether their predictive model controls for it or feeds on it is a
specific, checkable question, and it is the reason this experiment exists now
rather than later.

## The structural fact that shapes the whole design

`sperm-whale-dialogues.csv` carries 3,839 codas with a speaker index and a
timestamp. Taking `TsTo` as coda onset and `Duration` as extent:

```
same-speaker adjacent pairs that overlap in time      0 of 1,382   =  0.00%
cross-speaker adjacent pairs that overlap in time    908 of 2,239   = 40.55%
```

**A whale cannot overlap itself.** The 0.00% is not a finding about politeness,
it is anatomy — one animal produces one click train at a time. So *every*
overlapping pair of codas is necessarily attributed to two different animals.

> **40.55% of all speaker "switches" in this corpus are forced by simultaneity
> and carry no information about turn-taking whatsoever.**

Any statistic computed over all adjacent pairs inherits that. A naive switch rate
counts 908 forced switches as though a whale chose to respond. A naive response
latency is dominated by them, since a forced switch has a gap near zero by
construction.

(The onset and offset readings of `TsTo` disagree on only 22 of 2,239 pairs —
40.55% against 39.57% — so nothing here turns on which is correct.)

### The admissibility restriction

A gap between coda *i* and coda *i+1* is **admissible** only if coda *i+1* begins
after coda *i* ends. In that regime both a same-speaker and a cross-speaker
continuation are physically possible, so the observed label carries information.

This is a per-coda test against that coda's own duration, not a global floor.

## Statistics

Two, because they can disagree and the disagreement is informative.

1. **Switch rate** — the fraction of admissible adjacent pairs where the speaker
   changes. Coarse: it asks whether whales alternate at all.
2. **Median switch gap** — onset-to-onset time at admissible speaker changes.
   Fine: it asks whether, having switched, the answer comes quickly.

A system with real turn-taking should show a shorter switch gap than chance. A
system where both animals simply call during shared active periods can show an
elevated switch *rate* with no latency effect at all.

## Pre-registered null ladder

Reporting a single p-value here would repeat this repo's most expensive mistake.
The deliverable is the **ladder**, and each rung controls one thing the rung
above ignores.

| null | what it destroys | what it preserves | controls |
|---|---|---|---|
| **N1** naive label shuffle | everything | group sizes | nothing |
| **N2** speaker rotation | cross-speaker alignment | each speaker's own bout structure exactly | bout structure |
| **N3** local jitter ±W | fine alignment | the joint activity envelope | co-activity |

**N2 is the primary null.** Rotating one speaker's entire timeline by a random
offset is a rigid shift: it preserves every interval within that speaker, so the
surrogate never asks a whale to overlap itself. (The wrap point is the one
exception and is reported.) A free label shuffle does not have that property and
is included only to show what it inflates.

**N3 sweeps W** — 2, 5, 10, 20, 45, 90 s and full-span. If an effect is real
response contingency it should survive small W, where the surrogate still shares
the observed co-activity envelope. If it only appears at large W it is
co-activity, not contingency.

## Pre-registered data gate — G0

**The `a`/`b`/`c` suffix in `REC` is a tag letter, not a recording session.**
Deployments carry more than one DTag simultaneously, so two recordings can hold
*the same acoustic scene* twice, with speaker indices assigned independently per
tag. Constant clock offsets confirm it: 1449.7 s across the sw090 pair, 1870.2 s
across sw119.

Left uncorrected, the same exchange is counted twice, with different labels.

**G0: retain one tag per deployment.** Crude and deliberately conservative —
recovering which coda in tag A is which coda in tag B is a matching problem of
the kind experiment 06 showed is not reliably solvable. Losing half the data is
cheaper than pseudoreplicating it.

Pass condition: after the gate, no deployment contributes more than one tag.

## Pre-registered prediction

**Switch rate: null under N2. Median switch gap: no strong prediction.**

Reasoning for the first: the naive switch-rate excess is exactly what shared
activity periods produce, and N2 preserves each speaker's own bout structure
while destroying only the cross-speaker alignment. Recorded in advance because
"whales alternate more than chance" is the result everyone expects and the one
that is easiest to report without checking.

The second is genuinely open, which is why it is the more interesting statistic.

What would falsify the prediction: a switch rate that survives N2 and N3 at small
W.

## Result

**They do not take turns. They overlap — far more than chance.**

`tools/exp08_turn_taking.mjs`, `artifacts/turn_taking.json`. G0 passed, keeping
3,083 of 3,840 codas (80.3%); 65 two-speaker recordings, 1,192 codas, 839
admissible pairs, 448 admissible switches.

| null | overlap | z | p | switch rate | z | p | median gap | z | p |
|---|---|---|---|---|---|---|---|---|---|
| **(observed)** | **0.390** | | | **0.534** | | | **3.62 s** | | |
| N1 naive label shuffle | 0.256 | 10.4 | **0.0005** | 0.499 | 2.2 | 0.0190 | 4.09 | −12.7 | 0.0005 |
| N2 speaker rotation | 0.212 | 10.8 | **0.0005** | 0.646 | −8.1 | 1.0000 | 2.65 | 11.9 | 1.0000 |
| N3 jitter ±2 s | 0.252 | 9.6 | **0.0005** | 0.538 | −0.3 | 0.6212 | 2.51 | 13.0 | 1.0000 |
| N3 jitter ±5 s | 0.235 | 11.1 | **0.0005** | 0.533 | 0.0 | 0.4958 | 2.72 | 11.0 | 1.0000 |
| N3 jitter ±10 s | 0.231 | 11.1 | **0.0005** | 0.510 | 1.7 | 0.0370 | 2.73 | 10.0 | 1.0000 |
| N3 jitter ±20 s | 0.219 | 12.0 | **0.0005** | 0.491 | 3.0 | 0.0025 | 2.85 | 8.0 | 1.0000 |
| N3 jitter ±45 s | 0.199 | 12.7 | **0.0005** | 0.428 | 7.1 | 0.0005 | 3.13 | 4.2 | 1.0000 |
| N3 jitter ±90 s | 0.184 | 12.4 | **0.0005** | 0.335 | 13.0 | 0.0005 | 3.36 | 1.7 | 0.9580 |

### Overlap survives everything

**39.0% of adjacent cross-speaker coda pairs overlap in time, against 18.4–25.6%
in every surrogate.** z from 9.6 to 12.7, p = 0.0005 in all eight nulls —
including ±2 s jitter, which preserves the local co-activity envelope almost
exactly. Nothing in the ladder weakens it.

This is the one statistic in the experiment that is not distorted by the
admissibility filter, because it is scored *before* that filter — it is precisely
the quantity the filter exists to remove.

### The switch rate is co-activity, exactly as predicted

The pre-registered prediction was that the switch-rate excess would not survive
N2, and it does not — but the jitter sweep shows *why* more clearly than N2 does:

```
jitter  ±2 s   z = −0.3      ±20 s  z = +3.0
        ±5 s   z =  0.0      ±45 s  z = +7.1
        ±10 s  z = +1.7      ±90 s  z = +13.0
```

At the window where the surrogate still shares the observed co-activity envelope,
**z is zero**. The apparent alternation appears only as the window widens and
co-activity is destroyed. The naive z = +2.2 measures shared activity periods, not
turn-taking.

Against rotation the sign inverts, z = −8.1: whales alternate *less* than a
fully-scrambled arrangement, which is what two animals producing runs of their own
codas will do.

### The median gap is reported and discounted

Observed switch gaps are longer than every null. **The result is not trustworthy
and the diagnostic says so**: surrogates admit 930–972 admissible pairs against
the observed 839, so the comparison is not like with like. That difference is
itself the overlap finding seen from another angle — the real data has *fewer*
admissible pairs precisely because more of its pairs overlap. Any median computed
over differently-composed sets inherits that, so no claim rests on this column.

### Is the overlap an annotation artifact?

The serious alternative: an annotator splitting one whale's long click train into
two overlapping codas and attributing them to two animals would manufacture
exactly this.

Dual-tag deployments give an independent check, using the duplication that G0
exists to remove. Two DTags on two different animals record the same encounter
from different acoustic vantage points. If overlap were idiosyncratic attribution
error on one channel, the two tags would disagree.

| deployment | tag a | tag b | cross pairs (a / b) |
|---|---|---|---|
| sw090 | 0.413 | 0.470 | 75 / 115 |
| sw106 | 0.583 | 0.611 | 12 / 18 |
| sw119 | 0.333 | 0.333 | 9 / 9 |
| sw091 | 0.345 | 0.235 | 58 / 51 |
| sw133 | 0.722 | 0.368 | 18 / 87 |

The three best-sampled deployments agree closely; the rest scatter as small
samples do. Pooled across all two-speaker recordings without any deduplication
the rate is 0.406, against 0.390 after G0.

**This rules out random attribution error. It does not rule out a systematic
one** — the same annotator and pipeline processed both tags, so a consistent
tendency to split overlapping trains would affect both channels alike. Settling
that needs the audio, which experiment 06 established cannot be joined to these
annotations.

### Reading this

The popular framing of sperm whale exchanges as conversation implies turn-taking.
On this corpus, with these controls, **there is no turn-taking signal at all**,
and the strongest exchange-level structure runs the other way: these animals call
over each other far more than chance.

That is not evidence against communication. Chorusing, overlapping display and
simultaneous signalling are communicative in many taxa. It is evidence against
one specific and widely assumed model of what sperm whale exchanges are.

## What this will not license

- **Anything about meaning.** Response contingency is not semantics.
- **Anything about who is responding to whom.** Speaker indices are per-recording;
  the same index in two recordings is not the same animal.
- **A claim about Assayag et al.** Their statistic, corpus subset and model differ.
  A result here bears on the overlap structure their metric encodes; it does not
  reproduce or refute their analysis.
- **Anything about coda *content*.** This is timing only. Whether a reply
  resembles what it replies to is a separate question.

## Reproducing

```bash
python3 tools/fetch_corpus.py            # also fetches sperm-whale-dialogues.csv
node    tools/exp08_turn_taking.mjs
```
