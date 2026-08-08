# Ornamentation and rubato in sperm whale codas: an independent, pre-registered control using the authors' own classifications

**Status: DRAFT. Experiment 10 (rubato provenance) is registered and pending;
its section is marked. Nothing here has been submitted anywhere.**

Author: Andrew Cordivari
Code and data: `github.com/<user>/ling` (all inputs public; every statistic
deterministic and reproducible byte-for-byte from the repository)

---

## Abstract

Sharma et al. (*Nat. Commun.* 15:3617, 2024) report that sperm whale codas
carry a combinatorial "phonetic alphabet" built from four dimensions, two of
which — rubato (smooth modulation of coda duration across an exchange) and
ornamentation (an extra click marking sequence edges) — are properties of coda
*sequences* rather than of codas. Fifteen months and 60+ citations after
publication, no formal independent evaluation of these claims exists. We test
both, using the authors' own per-coda rhythm classifications and ornamentation
flags (public deposit, alignment validated at 95.65% with all mismatches
confined to one residual class), under two controls the original analyses do
not apply jointly: stratification by rhythm-class composition, and a sweep of
the sequence-segmentation threshold. Both tests were pre-registered with the
prediction that neither feature survives; the prediction was half wrong.
Ornamentation's positional association is a segmentation artifact by the
pre-registered criterion: it appears only at segmentation cuts of 10–15 s —
bracketing the 10 s window inside the flag's own operational definition — and
rhythm-class composition manufactures a third to half of it where it appears.
Rubato survives everything: within-class duration drift beats
composition-preserving nulls at every segmentation cut (z = 6.4–19.4,
permutation floor p = 0.0005), is robust to leave-one-recording-out, and holds
inside single rhythm classes, where click count is invariant and duration is
pure inter-click timing. Smooth tempo modulation in sperm whale codas is
real structure; whether it is signal or physiological state remains open, and
a registered follow-up (cross-whale concurrence under timeline-rotation nulls)
is in progress.

---

## 1. Introduction

Sharma et al. [1] analyse 8,719 codas from the Dominica Sperm Whale Project
and propose that coda structure decomposes into rhythm, tempo, rubato and
ornamentation. The first two are per-coda features with a long prior
literature [2]. The novel claims are the two *context-sensitive* dimensions:

- **Rubato:** duration varies smoothly across consecutive codas — adjacent
  same-type codas from the same whale differ less in duration than chance
  (0.05 s vs 0.08 s, p = 0.0001, n = 2,593), drift direction is sustained
  across sequences, and overlapping codas from different whales match in
  duration (0.099 s vs 0.129 s, n = 908), which the authors read as rubato
  being "perceived and imitated."
- **Ornamentation:** ~4% of exchange codas carry an extra click, occurring
  disproportionately at sequence beginnings (Fisher's exact, OR 2.00,
  p = 0.0006) and ends (OR 1.71, p = 0.008).

These claims matter beyond cetology: they are the empirical basis for the
"phonetic alphabet" framing that has organised subsequent machine-learning
work on whale vocalisation. Yet as of August 2026 the PMC record shows no
Matters Arising, no Comment, and no correction, and we find no published
independent statistical evaluation.

Two features of the corpus make an independent control both necessary and
unusually clean. Necessary, because the two context-sensitive claims are
*sequence-level* statistics, and sequence-level statistics inherit two
well-known failure modes: composition (which coda types occur where) and
segmentation (how continuous click trains are cut into "sequences" — a
parameter the deposit does not fix). Clean, because the authors published
their own per-coda classifications: rhythm-class indices and ornamentation
flags aligned 1:1 with the public dialogue corpus. We therefore test the
authors' own labels, not a reimplementation of their definitions — removing
the most common way an independent check goes wrong.

We pre-registered both tests, including the prediction that **neither**
feature would survive, before computing any test statistic. The prediction
was wrong about rubato. We consider that asymmetry — one claim dissolving
under controls, the other strengthening — the most informative outcome this
design could produce, and considerably more credible than either a uniform
debunking or a uniform confirmation.

## 2. Data, alignment, and three traps

**Corpus.** `sperm-whale-dialogues.csv` from the authors' deposit: 3,840
codas with recording id, click count, duration, per-click ICIs, a
per-recording speaker index, and absolute onset time. (The paper describes
Dataset 2 as 3,948 codas; the public deposit carries 3,840. We flag the
108-coda bookkeeping difference without interpreting it.) Labels:
`ornaments.p` (binary flag per coda) and `rhythms.p` (18-class index per
coda), both length 3,840, plus the 18 class centroids.

**Alignment gate (G1).** The claim "`rhythms.p[i]` describes CSV row *i*" has
an independent test: each centroid has a click count, which must match the
row's own `nClicks`. Agreement is 3,673/3,840 = 95.65% — and all 167
mismatches sit in class 17. A detection rule (a class whose members' click
counts mostly disagree with its own centroid is a bucket, not a category)
finds class 17 and nothing else: it holds 175 codas with 1–29 clicks under a
10-click centroid, while class 14 — same centroid — holds 13 codas, all
exactly 10 clicks. Class 17 is a residual bucket and is excluded; it holds
13 ornamented codas that would otherwise let unclassifiable material carry
positional signal. A consequence used throughout: **within every non-residual
class, click count equals the centroid's exactly**, so within-class duration
variation is inter-click timing, never click count.

**Zero-duration trap (G2).** Eight codas have duration exactly 0; all are
single clicks (no inter-click interval, hence no rhythm and no duration
sequence), and all sit in class 17.

**Dual-tag trap (G0).** The `a`/`b`/`c` suffix in recording ids is a DTag
letter, not a session: deployments carry several tags at once, so the same
acoustic scene can appear twice with independently assigned speaker indices
(constant clock offsets between duplicated scenes: 1,449.7 s and 1,870.2 s).
We keep one tag per deployment (the one contributing the most codas): 3,083
of 3,840 codas retained. The final observation universe is 2,958 classifiable
codas, 116 of them ornamented.

## 3. The composition confound, measured before testing

Ornamentation is strongly associated with rhythm class. In the full corpus,
two classes carry most of the flag: class 10 (rate 0.667) and class 16
(0.596), against 0.006 in the majority class (n = 2,359). Rhythm class alone
predicts the ornament flag with a 19.2% error reduction over the
majority-class baseline. Sharper still: **140 of 151 ornamented codas have
exactly their class's centroid click count** — the "extra" click is absorbed
by the class assignment, so classes 16 and 10 behave as ornamented variants
in their own right.

The design consequence is immediate: a positional test of ornamentation that
does not stratify by rhythm class is a test of where classes 16 and 10 occur.
The confound is strong but not total (their rates are 0.6–0.67, not 1.0), so
a stratified test has leverage rather than being vacuous — we report that
leverage (259.7–429.8 by the harmonic-mass convention, against the floor of
33.3 this project carries) beside every p-value.

## 4. Methods

**Sequences.** The deposit ships no sequence definition. We define a sequence
as consecutive codas by the same speaker within one recording, separated by
silence (offset-to-onset) of at most GAP seconds, and sweep GAP over
{3, 5, 10, 15, 30} s as a pre-registered falsification device: a statistic
that a segmentation parameter can switch on and off is measuring the cut.
Same-speaker sequences are deliberate: 39.0% of adjacent cross-speaker coda
pairs overlap in time (against 18.4–25.6% in eight surrogate families;
z = 9.6–12.7) and no turn-taking signal survives rotation nulls, so a
cross-speaker "exchange" mixes two animals with different duration means —
which would manufacture sequence-level duration structure outright.

**S1 (ornamentation).** Δ = P(ornamented | sequence-final) −
P(ornamented | non-final), two arms with the identical observed statistic:
a naive null (permute flags anywhere) and a stratified null (permute flags
within rhythm class — destroying position, preserving composition and
per-class rates). Two-sided.

**S2/S2b (rubato).** Pooled per-sequence-centered lag-1 autocorrelation of
duration. S2's null shuffles durations within sequence (destroying order,
preserving each sequence's duration multiset); S2b's shuffles within
sequence × class (additionally preserving the class ordering and any duration
structure it carries). One-sided: smoothness asserts positive
autocorrelation. Excluded codas break sequences into fragments rather than
being spliced over; fragments require ≥ 3 codas.

**Discipline.** Both statistics, their nulls, the sweep, the survival
criterion (p < 0.05 at *every* GAP with mass above floor), and the prediction
that neither survives were fixed before any statistic was computed. Negative
controls (placebo draws from each arm's own null pushed through the full
pipeline, 40 repeats per arm) fired at 1–5/40 against a nominal 2/40.
Everything is seeded and byte-for-byte reproducible.

## 5. Results

### 5.1 Ornamentation does not survive; the initial-position claim never fires

| GAP | Δ observed | naive null (z, p) | stratified null (z, p) |
|---|---|---|---|
| 3 s | 0.0136 | 0.0000 (1.3, 0.27) | 0.0173 (−0.5, 0.83) |
| 5 s | 0.0136 | −0.0003 (1.6, 0.15) | 0.0090 (0.7, 0.62) |
| 10 s | 0.0327 | 0.0001 (3.1, **0.004**) | 0.0130 (2.3, **0.048**) |
| 15 s | 0.0408 | 0.0000 (3.5, **0.004**) | 0.0143 (2.7, **0.017**) |
| 30 s | 0.0204 | −0.0005 (1.8, 0.13) | 0.0063 (1.4, 0.23) |

Three observations. First, the effect exists only under particular cuts —
nothing fires at 3, 5 or 30 s in either arm. Second, where it fires, the
stratified null already produces 40% (10 s) and 35% (15 s) of the observed Δ:
class composition manufactures a third to half of the naive effect. Third,
and most tellingly: the paper's ornament flag is operationally defined
relative to neighbours **within a ten-second window**, and the only cuts at
which the positional effect appears (10–15 s) bracket that definitional
window. An effect that lives only at the segmentation scale its own label was
constructed at is not evidence of a positional code.

Post-hoc arms (flagged as such; run after the registered result) extend this
to the paper's other positional claims. The *initial*-position contrast — the
paper's stronger odds ratio — never survives the stratified null at any cut
(p = 0.076–0.75). The pooled *edge* contrast fires only at 10/15/30 s
(p = 0.0010–0.041) and is absent at 3 and 5 s: the same cut-dependence
signature.

We emphasise the scope: this does not test the paper's claim that ornamented
codas are rhythmically closer to their temporal neighbours with the final
click removed, and a within-class positional excess at intermediate cuts
(uncorrected p = 0.017–0.048 at 2 of 5 cuts) is reported, not erased. What
fails is specifically the claim that ornamentation marks sequence edges in a
way that survives composition control at more than a privileged segmentation
scale.

### 5.2 Rubato survives everything we could throw at it

| GAP | fragments | r observed | S2 null (z) | S2b null (z) | p (both) |
|---|---|---|---|---|---|
| 3 s | 192 | 0.106 | −0.197 (7.8) | −0.067 (6.4) | **0.0005** |
| 5 s | 388 | 0.265 | −0.148 (12.1) | 0.021 (10.1) | **0.0005** |
| 10 s | 353 | 0.405 | −0.097 (17.5) | 0.093 (15.3) | **0.0005** |
| 15 s | 324 | 0.483 | −0.079 (20.1) | 0.154 (17.6) | **0.0005** |
| 30 s | 286 | 0.522 | −0.068 (22.6) | 0.173 (19.4) | **0.0005** |

p = 0.0005 is the resolution floor at 2,000 iterations; every arm sits on it.
The S2b null mean grows with GAP — class composition in time does carry real
smoothness, and the control absorbs exactly that — but the observed
autocorrelation sits 6.4–19.4 standard deviations above what composition can
produce. The inference is identical at all five cuts (only the magnitude
grows with window length, which per-fragment centering guarantees
mechanically for any genuinely autocorrelated process). Contrast S1, where
the *inference itself* flips with the cut.

Robustness (post-hoc, flagged): the effect holds in 58–62% of individual
fragments (against a sub-50% baseline from centering bias); inside the
majority class alone (z = 5.5–12.0); inside all other single-class fragments
pooled (z = 3.7–5.7); and under leave-one-recording-out (worst z = 5.3).
Because click count is pinned within class (§2), none of this is click-count
variation: successive codas by the same whale drift smoothly in *tempo*,
within coda type. That is rubato in the paper's sense, surviving controls
that dissolved the ornamentation claim in the same corpus with the same
machinery.

## 6. Relation to the published claims

| Paper sub-claim | This work |
|---|---|
| Adjacent same-type duration drift smaller than chance (rubato a) | **Supported and strengthened** — survives composition + segmentation controls the original test does not apply |
| Drift direction sustained across sequences (rubato b) | **Consistent** — long strictly-monotone duration runs occur far above chance (e.g. 3/32 length-7 fragments vs ~0.04% expected) |
| Overlapping whales' durations match: rubato "perceived and imitated" (rubato c) | **Not yet controlled.** The published test compares overlapping to non-overlapping pairs without controlling temporal proximity — and since each whale drifts smoothly (§5.2), proximity alone predicts matching. A registered follow-up (experiment 10) tests concurrence under timeline-rotation nulls that preserve each whale's private drift. *[pending]* |
| Ornaments mark sequence beginnings (OR 2.00) | **Does not survive** class-stratified control at any segmentation cut |
| Ornaments mark sequence ends (OR 1.71) | **Cut-dependent**: survives only at 10–15 s, bracketing the flag's own 10 s definitional window; a third to half of the naive effect is class composition |
| Ornamented codas rhythmically closer to neighbours minus final click | Untested here |

## 7. What this does and does not show

This is not a refutation of Sharma et al.'s analysis: their tests use
definitions, subsetting and modelling choices not reproduced here, and a null
on our statistics bears on our statistics. It is evidence about which of the
two context-sensitive dimensions denotes structure robust to the two most
dangerous degrees of freedom in sequence-level corpus analysis. Rubato is
such structure. Ornamentation's positional signature, on this corpus and
under these controls, is not.

Rubato's survival is a statement about structure, not use. Smooth tempo
modulation is what respiration, arousal or dive phase would also produce;
nothing here distinguishes modulation-as-signal from modulation-as-state, and
the paper's imitation claim — the strongest evidence for the signal reading —
is precisely the sub-claim whose published test lacks the proximity control.
Experiment 10 (pre-registered, in progress) addresses this directly.
*[section to be completed when experiment 10 reports]*

Tempo, the third dimension, is out of scope: the deposit's tempo labels
reconstruct per-coda durations for only 93.3% of rows, so we declined to
approximate them. The control granularity equals the authors' own 18-class
rhythm inventory; a finer inventory could in principle re-absorb some
within-class smoothness as composition — but that inventory is the paper's
own, so the claims are tested on their own terms.

## 8. Reproducibility

All inputs are public (the authors' Zenodo/GitHub deposit). The analysis
pipeline is deterministic: fixed seeds, exact permutation enumeration where
feasible, and artifacts that reproduce byte-for-byte. Pre-registrations,
including the wrong predictions and the corrections they forced, are
preserved verbatim in the repository (`experiments/09-rubato-ornamentation/`,
`experiments/10-rubato-provenance/`).

## References

[1] Sharma, P., Gero, S., Payne, R., Gruber, D. F., Rus, D., Torralba, A. &
Andreas, J. Contextual and combinatorial structure in sperm whale
vocalisations. *Nat. Commun.* 15, 3617 (2024). doi:10.1038/s41467-024-47221-8
[2] Gero, S., Whitehead, H. & Rendell, L. Individual, unit and vocal clan
level identity cues in sperm whale codas. *R. Soc. Open Sci.* 3, 150372
(2016).
