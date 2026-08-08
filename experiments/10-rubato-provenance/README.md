# 10 — Does rubato carry state signatures beyond the exchange?

**Status: RUN 2026-08-07. Frozen text unchanged; results in
[Result](#result). Matrix row 3; the registered predictions scored one hit,
two misses, one unevaluated.**

Freeze note: five adversarial review rounds (47 findings total: 27/11/4/5/0
critical-or-major by round, four personas — statistics, bioacoustics,
segmentation, interpretation). Round 5 was the clean round: no new critical
or major finding, all four gates open. Round 5 also filed five minors
(stats-r5-01, bio-r5-01/02, spin-r5-01/02), each carrying a registered
one-to-two-sentence fix in the ledger; those fixes were applied at freeze
verbatim from the ledger text — they touch the round-5 context paragraph and
two T3 reporting sentences, and change no statistic, null, criterion, or
matrix rule. Everything below this note is frozen; any post-freeze change
requires a dated revision note and, if it touches a null, the registered
battery re-run.

Revision note: a four-referee adversarial round filed 23 findings against the
first draft. The material repairs, all made before freezing: T1's statistic is
now a partial correlation (the raw one carries a mechanical term reviewer
simulations fired at up to 7× α with zero behavioral coupling); T2 now
operates on runs, not fragments (fragment pairs split by one excluded coda
re-measured exp09's within-run drift); T3 gained an envelope-preserving jitter
co-null and a primary-window criterion; the G3 × fragment interaction is
pinned; and the feasibility table was regenerated — the first draft's table
was computed under a universe inconsistent with its own G3 rule and an
unregistered T3 pairing.

Round-2 revision note (2026-08-07, pre-freeze, no statistic computed): a
second adversarial round filed 11 findings, all repaired here before freezing.
The material ones: T1's rotation null is **pinned to one implementation** —
the round-1 wording admitted a literal reading that reviewer simulation fired
at 2–4× α, sign-skewed negative, under zero coupling; the placebo battery
gained execution parameters and a consequence-of-failure branch mirroring the
negative controls; **NOT TESTED** became a third matrix value with a
registered propagation rule; matrix row 3's epistemic label is split on
observables and conditioned on T1; "stable" (non-overlapping stratum) is
pinned to a numeric criterion; the T2 scale-reading sentence was corrected
(separations are bridged time, not silence); and the W-sweep nesting claim
was corrected (span ≥ 2W breaks nesting; a composition-constant profile is
registered).

Round-3 revision note (2026-08-07, pre-freeze, no statistic computed): a
third adversarial round filed 4 findings, all repaired here before freezing.
The material one: the round-2 pin of T1's rotation null registered an offset
set that **excluded the identity rotation** (`k ∈ {1, …, L−2}`). With
per-fragment centering the cyclic cross-terms sum to zero over all L−1
offsets (verified to machine precision), so the identity-excluding ensemble
is conditionally anti-correlated with the observed statistic (per-fragment
null mean −c(0)/(n−1)) and round-3 simulation on the real scaffolds measured
it at 14.4% type-I at GAP 3 and 8.4–8.8% at the wide arms in provably-exact
pure noise. The offset set now includes the identity, with calibration
verified at 250 draws × 500 iterations per cell (4.4/5.2/4.4% pure noise at
GAP 3/5/30; 2.8–5.2% in both registered placebo worlds; 3.2–7.6% under
in-world fragment formation), and the round-2 sentence claiming the
excluding set "calibrates at ≈ α" is retracted — its evidence (60 draws
against a >8/60 flag) had ~8% power against a true 8.8% rate. Also
repaired: matrix row 3's sub-case (a) is re-keyed on a *tested* T1 that
does not survive, a sub-case (d) registers the T1-negative-survives
composition, a NOT TESTED T1 strips row 3's epistemic stamps, and a T1
partial fire is registered as carrying no anti-state stamp; predictions
about NOT TESTED statistics are excluded from prediction scoring; and the
T1 partial-fire narrative labels gained a precedence rule (registered
arm-pattern readings override the generic cut-dependence label).

Round-4 revision note (2026-08-07, pre-freeze, no statistic computed): a
fourth adversarial round filed 5 findings. The material one: an
implementation (`tools/exp10_rubato_provenance.mjs`) was drafted before the
freeze whose header claimed the registration was already frozen and cited an
implementation-pins note this document did not contain — and it silently
resolved degrees of freedom the frozen text left open (the composition of
T1's pooled partial correlation; the T3-P placebo world's generative
constants), the exact flexibility channel this registration exists to close.
Repaired: the pins are now registered in the
[Implementation pins](#implementation-pins-registered-pre-freeze) section,
the battery's no-retuning clause names the placebo constants, the tool's
header is corrected, and the tool stays quarantined behind `--gates-only`
until the freeze — it has never executed past the counts-only feasibility
echo (its artifacts directory does not exist). Also repaired: the
wraparound-seam share in the T1 arm-pattern reading is pinned to explicit
denominators and conditioning (the round-3 repair updated the adjacent
alignments-per-fragment figure but left the seam figure without a computable
definition); the matrix preamble's machinery-only reporting is scoped to the
NOT TESTED statistic alone; row 3's sub-case strip under a NOT TESTED T1 is
key-scoped ((a)/(c)/(d) are T1-keyed and strip; (b) is T2-keyed and
survives); and T3 prediction clause (ii) is registered as conditional —
unevaluated under a tested, non-surviving T3.

## Question

Experiment 09 established the first effect in this corpus to survive the full
control stack: **successive codas by the same whale drift smoothly in tempo,
within coda type** — rubato, in Sharma et al.'s sense, at z = 6.4–19.4 against
the within-sequence × class shuffle at every segmentation. Experiment 09 also
recorded what that does *not* license: smooth modulation is what respiration,
arousal or dive phase would produce too. Nothing there distinguishes
modulation-as-signal from modulation-as-state.

> **Does the drift carry the signatures a state-like process predicts?**

This corpus carries no depth, respiration or behavioral channel, so no
statistic here can *identify* a physiological driver. What it can do is
measure three properties that a state-like process predicts. **The instrument
is one-sided**: every registered outcome either supports a state reading or
fails to; no outcome affirms "signal". The maximally signal-compatible
pattern is registered below, and even it licenses no signal claim.

- **T1 — gap coupling.** Does a coda's duration track the silence that
  preceded it? A whale whose overall pace slows — longer silences *and* longer
  codas — has a shared latent rate. That is the signature of a pacing state,
  not of a coda-level code.
- **T2 — beyond-gap persistence.** Does mean tempo persist across the
  separations between exchanges? A rejection at gap `GAP` establishes
  structure across separations each containing at least one silence longer
  than `GAP` seconds — nothing more. "Session-scale" is licensed only if the
  widest arm itself fires.
- **T3 — cross-speaker concurrence.** When two whales are recorded together,
  do their concurrent tempo deviations covary? Covariation that survives both
  registered nulls means a shared driver or interaction. Its absence means
  **no covariation was detectable at these windows at the reported
  sensitivity** — a statement of non-detection, not a demonstration that the
  drift is private.

### Why this is worth doing

A surviving effect earns hostility, and exp09's Result section already named
this exact question as the untested one. The interpretation matrix is fixed in
advance — see [Reading the outcomes](#reading-the-outcomes-fixed-in-advance) —
because a result in either direction invites spin: "state" deflates a Nature
Communications claim, a concurrence positive inflates one, and both
temptations are worth pre-committing against.

T3 additionally **applies, on this corpus's two-speaker subset, the two
controls missing from a published sub-claim** (context added pre-freeze
2026-08-07; revised at freeze per round-5 findings stats-r5-01, bio-r5-01,
spin-r5-01/02, whose registered fixes are applied here verbatim; it changes
no registered decision rule). Sharma et al. report that overlapping codas
from different whales match in duration more closely than non-overlapping
same-type pairs (0.099 s vs 0.129 s, permutation p = 0.0001, n = 908 —
numerically matching the 908 overlapping cross-speaker adjacent pairs exp08
measured in this corpus), and read the matching as rubato being "perceived
and imitated" between whales. That comparison holds coda type fixed but not
**temporal proximity**: overlapping pairs are near-simultaneous by
construction, non-overlapping same-type pairs can sit minutes apart — and
under zero interaction, closer matching in the overlap set is predicted by
any shared slow component (the activity envelope each whale's own pacing
tracks — the registered T3-P mechanism, absorbed by the jitter co-null) or
by split-train attribution (same-whale pairs riding exp09's established
private drift — the registered overlap channel). **Private independent drift
alone predicts no proximity effect** (a round-5 simulation measured the
matching profile flat across separation bins in that world); which channel
operates is what T3's nulls adjudicate, not a consequence of exp09. A T3
outcome bears on the imitation reading in the registered senses only: a
survival that is **stable in the pinned sense** is concurrence beyond the
shared envelope and private drift (still not "imitation"; see the matrix);
a null is a non-detection under these controls, not a demonstration that
the published effect is artifact. **Registered:** a criterion-surviving
fire that fails the stability pin has two generators this corpus cannot
separate (exp06/exp08) — a split train (same-whale material, no cross-whale
concurrence) and a genuine chorus-confined imitation, the published
sub-claim's own locus; that outcome licenses neither "concurrence" nor
"the published sub-claim reduced to an annotation artifact", and this
paragraph's survival sense applies only to a fire that is stable in the
pinned sense. **Coverage, registered:** at the primary arm at most 229
overlap-configuration pairs enter (of the 908 the published n numerically
matches); sw061b003 and every multi-speaker scene are structurally
excluded, and no statistic here recomputes the published
duration-difference comparison — that the shared-envelope and split-train
channels reproduce the published matching is a hypothesis these controls
probe, not an established fact.

## Universe

Carried unchanged from experiment 09, same loaders:

- **G0** — one DTag per deployment (dual-tag dedup). Expected: 3,083 of 3,840
  codas kept.
- **G1** — alignment re-derived; residual-class *rule* (members' click counts
  mostly disagreeing with the class's own centroid) must find {17} and nothing
  else, ≥ 95% agreement, zero mismatches outside. Class 17 excluded.
- **G2** — zero-duration single-click codas excluded (expected 8, all in
  class 17).

New for this experiment:

- **G3 — residual cells.** The tempo deviation of a coda is its **residual**:
  `res = Duration − mean(Duration | same recording, same whale, same rhythm
  class)`, over observable codas. A cell of size 1 gives `res ≡ 0` — no
  information, pure dilution — so **codas in size-1 cells are excluded from
  all three statistics**. Cell-size distribution is reported before any test.
  Expected: 2,958 observable post-G0 codas, 192 in size-1 cells, 2,766
  G3-eligible.
- **G3 × segmentation, pinned now** (the first draft left this open and its
  feasibility table silently resolved it a third way): a G3-excluded coda is a
  **produced acoustic event**, so it breaks fragments exactly as G1/G2
  exclusions do — exp09 decision 3 extended. Splicing over it would
  manufacture adjacency and would corrupt T1's `y` (a "silence" spanning a
  coda the whale audibly produced is not a silence). Every count basis below
  — fragment length ≥ 4, run size ≥ 2, unit size ≥ 3 — counts **G3-eligible
  codas**.

Within-class duration is pure inter-click timing (G1's zero-mismatch
consequence, established in exp09), so `res` is a tempo deviation, never a
click-count artifact.

## Statistics

### T1 — gap coupling

Fragments: maximal stretches of **consecutive G3-eligible codas** within a
same-speaker run at gap `GAP` (runs formed on the full post-G0 timeline,
exp09 decision 2; any excluded coda breaks the stretch), length ≥ 4. Within
each fragment, `x_i = res(coda_i)` and `y_i = silence preceding coda_i`
(offset-to-onset), `i = 2..L`.

**The mechanical confound, named before the statistic.** `y_i` is an
arithmetic identity: `y_i = IOI_i − dur_{i−1}`, so it shares `dur_{i−1}` with
the residual series, and exp09 established that series is autocorrelated
(r up to 0.522). Consequence, verified by reviewer simulation on the real
fragment scaffolds: a whale that paces **onsets** independently of durations
drives the raw correlation negative (fired 22/60 at GAP 3 with zero
coupling), a whale that paces **silences** drives the mirrored
parametrization (`y = IOI`) positive, and the bias scale is a pure function
of `GAP` geometry (σ_res/sd(y) = 0.275 at 3 s vs 0.041 at 30 s). Neither
clocking can be privileged in advance — whether a whale times onsets or
pauses is unsettled — so **raw signs are registered as uninterpretable**.

**Primary statistic:** pooled per-fragment-centered **partial correlation of
`res_i` with `y_i` controlling `res_{i−1}`**. The partialling removes the
mechanical term under both clockings
(`cov(dur_i − φ·dur_{i−1}, IOI_i − dur_{i−1}) = −φσ² + φσ² = 0`) and runs
identically inside every null draw. The raw correlation under **both**
parametrizations (`y` = preceding silence; `y` = preceding IOI) is reported
as a diagnostic — each is biased in a known direction under the opposite
clocking — and no reading rests on either.

**Null, pinned to one implementation:** within each fragment, form the
aligned triplets `(res_i, res_{i−1}, y_i)`, `i = 2..L`, and circularly rotate
the gap vector `(y_2, …, y_L)` — length L−1 — against the **intact**
`(res_i, res_{i−1})` triplets by a uniform offset `k ∈ {0, …, L−2}` — **all
L−1 cyclic offsets including the trivial one**, drawn uniformly and
independently per fragment each iteration; the trivial draw reproduces the
observed alignment for that fragment and is valid under the +1-smoothed
shift p-value. Two pins here are load-bearing, and both have measured
failure modes:

1. **The identity offset is included.** With per-fragment centering the
   cyclic cross-terms sum to zero over all L−1 offsets (machine-precision
   identity), so an identity-*excluding* set makes each fragment's null
   draws average `−c(0)/(n−1)` — conditionally anti-correlated with the
   observed statistic, worst on GAP-3's short fragments (mean 4.7 pairs per
   fragment). Round-3 simulation on the real scaffolds measured the
   excluding variant at **14.4% type-I at GAP 3 and 8.4–8.8% at the wide
   arms in provably-exact pure noise**. A round-2 draft registered the
   excluding set and claimed it "calibrates at ≈ α"; that sentence is
   **retracted** — its evidence was 60 draws against a >8/60 flag, a design
   with ~8% power against a true 8.8% rate — and the excluding set is
   explicitly not the null (round-3 revision note).
2. **The `(res_i, res_{i−1})` triplets stay intact**, carrying the
   partialling's mechanical cancellation into every null draw. The round-1
   wording ("rotate the residual series") admitted a literal reading —
   rotate `res` and *re-derive* the lag control from the rotated series —
   under which the cancellation fails in null draws: reviewer simulation on
   the real GAP-3/GAP-30 scaffolds fired that variant at 2–4× α under
   onset-clocked zero coupling, sign-skewed negative — exactly the pattern
   the sign readings below would print as "compensatory / isochronous motor
   timing". **That variant is explicitly not the null either.**

Calibration of the null as pinned (intact triplets, identity included),
measured at 250 draws × 500 iterations per cell on the real GAP-3/5/30
scaffolds: 4.4 / 5.2 / 4.4% in pure noise; 2.8–5.2% in both registered
placebo worlds (onset- and silence-clocked, at the registered per-arm φ);
3.2–7.6% with fragment formation run inside the generative world (the
selection channel). T1-P/T1-P′ below remain the registered acceptance check
that the implementation as built calibrates too. Rotation preserves each
series' internal ordering and (up to the wraparound seam, disclosed) its
autocorrelation. **Two-sided** (shift convention), with the sign readings
registered below.

### T2 — beyond-gap persistence

**Run-collapse** (changed from the first draft's fragments, and why: two
fragments split from one run by a single excluded coda are two halves of one
exchange; exp09's established within-run rubato guarantees their means
correlate with no beyond-exchange process, and the contamination measured up
to 39% of pairs at the decisive GAP-30 arm. Runs *are* the exchange unit;
collapsing to them removes the channel structurally — same-run pairs cannot
exist).

Unit = recording × whale. Element = mean `res` over the G3-eligible codas of
one **run** (a run qualifies with ≥ 2 eligible codas — a mean needs two).
Series = the unit's time-ordered qualifying-run means; units need ≥ 3.

Statistic: pooled per-unit-centered lag-1 autocorrelation of that series —
exp09's S2 statistic, one level up. **Null:** permute run order within unit.
**One-sided high**: the state signature is positive persistence of
exchange-level tempo across the session.

**Scale reading, registered:** consecutive qualifying runs are separated by
**at least one silence > `GAP`** by construction — but the separation
interval is bridged *time*, not silence: skipped single-coda and
sub-threshold runs may sit inside it, so the whale's own codas appear inside
the separation interval (probe: 55 / 24 / 12 / 9 / 11% of pairs at
GAP 3/5/10/15/30 contain ≥ 1 own-whale onset). A rejection at gap `GAP`
therefore establishes persistence across separations each containing at
least one silence longer than `GAP` seconds — the arms are scale-indexed
claims, not five replications of one claim. Registered per-arm reports:
between-run separation distributions (probe: median 13.2 s at GAP 3 rising
to 112.6 s at GAP 30), the own-codas-inside-separation share above, and the
scene composition of separations — other-whale-active vs scene-dead (probe
at GAP 30: 40/44 other-whale-active, 4/44 scene-dead), which bounds the
annotation-lapse channel at ~9–15% of pairs at the decisive arms. None of
this opens a false-positive channel — qualifying-run means remain
exchangeable under the intended H0 — but the frozen description must match
what the intervals contain. The **beyond-exchange reading requires the
GAP-30 arm itself to fire**; the 3–15 s arms alone establish persistence
across pauses exp09's own widest segmentation treats as within-exchange.

**Concentration disclosure, registered before any test:** T2's material is
dominated by deployment sw061 — 65–95% of pairs depending on arm; without
it, the GAP 10/15/30 arms fall below the 33.3 floor. `sw061b003` is a
single-tag, five-speaker, 113-minute continuous scene (731 codas) —
worst-case conditions for manual speaker attribution, no dual-tag check
exists for it, and exp09's post-hoc found it the most influential recording
in the corpus. Registered reports: per-deployment mass beside every arm, and
a leave-one-deployment-out worst case. **Pre-assigned reading (a reading
qualifier, not a survival gate):** a T2 positive whose worst case (dropping
sw061) loses significance at the arms that fired reads "concentrated in one
annotation scene — consistent with block-wise attribution error as well as
state; the state reading is not licensed at full strength." Attribution
errors on a crowded single-tag record would be block-wise, and a
misattributed block is a run of same-sign residuals the within-unit
permutation cannot distinguish from state.

### T3 — cross-speaker concurrence

**Two-speaker basis, pinned:** exactly two whale indices among a recording's
post-G0 rows; the recording contributes only if **both** whales have ≥ 1
G3-eligible coda (62 recordings qualify). Pair every G3-eligible coda with
the *other* whale's nearest-in-time G3-eligible coda (by onset; ties broken
toward the earlier coda); keep pairs with `|Δts| ≤ W`; build pairs from both
directions and deduplicate unordered duplicates. A coda may appear in more
than one pair (disclosed; the nulls preserve the pairing mechanism).

**Span heterogeneity, disclosed:** "recording" is not a uniform unit. Most
two-speaker REC ids are annotator-cut excerpt windows — spans p10 16.8 s,
median 38.6 s, max 163.9 s; 46 of 67 under one minute (the suffix is the
window's start second in session time) — while `sw061b003` is a whole
113-minute session (five speakers, so it can never enter T3's universe at
all). **Arm eligibility, registered:** a recording enters arm `W` only if its
span ≥ `2W` (span = last offset − first onset over post-G0 rows). Rotation
modulo a span shorter than that re-pairs the same handful of codas — a
granular null that hides true concurrence and feeds a false "private"
reading.

Statistic: Pearson correlation between `res_A` and `res_B` over all pairs,
pooled across recordings (`res` is centered within recording × whale × class
by construction, so pooling adds no between-recording composition).

**Two nulls, both required for a positive reading:**

1. **Rotation** (exp08's N2): rigidly rotate the second whale's timeline
   modulo the recording's span, **re-derive the pairing under the same `W`**,
   recompute. Preserves each whale's internal sequence and autocorrelation;
   destroys temporal concurrence. Null pair counts are reported beside
   observed, as in exp08 — and beside them the **pair-identity retention
   share** of each null (fraction of observed pairs re-derived identically
   per draw, per `J` and for rotation; measured pre-freeze at 89.9 / 67.4 /
   13.1% for J=2 / J=5 / rotation at W = 5, per bio-r5-02).
2. **Envelope-preserving jitter** (exp08's N3, restored — the first draft
   dropped the instrument exp08 needed to catch exactly this misattribution):
   jitter each of the second whale's coda onsets independently by uniform
   `±J`, `J ∈ {2, 5}` s, re-derive the pairing, recompute. Preserves the
   joint activity envelope; destroys fine alignment. The reason it is
   required: two whales conditionally independent given a shared activity
   envelope, each with own-whale gap coupling (T1's registered positive),
   fire the rotation null with **zero** interaction — reviewer simulation
   z up to 7.3. **Fires under rotation but not under jitter is pre-assigned
   the reading "co-activity plus private state, or fine alignment below the
   co-null's discrimination at the reported retention; no evidence of tempo
   concurrence at that discrimination"** — the retention share is printed
   beside this reading whenever it is used. J = 2's ~90% retention makes it
   the weaker arm of the jitter conjunction; known and registered before
   freezing (bio-r5-02).

Reported diagnostic (not survival-bearing): partial correlation controlling
each whale's own preceding silence — removes the T1 channel from T3.

**One-sided high**: the claim under test is covariation. `pLess` is reported
descriptively.

**Overlap / split-train channel, registered:** 51% of W=5 pairs are
temporally overlapping codas — the configuration exp08 explicitly could not
clear of *systematic* annotation error (the dual-tag check ruled out random
attribution error only), and exp06 established the audio can never be joined
to these annotations, so the channel is permanently unresolvable inside this
corpus. Genuinely overlapping codas are documented behavior (chorusing, coda
matching), so the share is an **exposure**, not an artifact rate. Registered:
per-arm overlap-pair share; an overlap-stratified diagnostic (recompute on
non-overlapping pairs only) — reported, not survival-bearing.

**"Stable", pinned definition — used with exactly this meaning at every
occurrence of the term in this document:** the non-overlapping-stratum
correlation **has the same sign as the full-set correlation AND p < 0.05
against the stratum's own re-derived rotation and jitter nulls**. Feasible:
the W = 5 stratum is 222 pairs (451 − 229 overlapping), above the 33.3
floor. The pin exists because "stable" adjudicates the branch between T3's
two most consequential readings and must not be decided after the result is
visible.

**The T3-positive reading requires stability on the non-overlapping stratum,
in the pinned sense**; otherwise the pre-assigned reading is "concentrated
in the overlap configuration — the split-train annotation channel is not
excluded." A split train yields same-whale pairs whose residuals covary
through exp09's own rubato effect.

## Sweeps

- T1, T2: `GAP ∈ {3, 5, 10, 15, 30}` s (offset-to-onset silence, exp09's
  definition).
- T3: pairing window `W ∈ {5, 10, 30}` s. **W = 5 is the primary
  confirmatory arm; W = 10 and 30 are reported as a scale profile and do not
  gate survival.** The two sweeps carry different logic, stated now so it
  cannot be re-litigated at read time. `GAP` plays different roles in T1 and
  T2, and the registration says so rather than letting it be discovered at
  write-up: for **T1** it is an analyst cut (it decides fragment
  membership), and an effect a cut can switch on and off is measuring the
  cut — the all-arms rule follows. For **T2** it sets the physical
  separation regime (median separation 13.2 → 112.6 s), so the arms are
  scale-indexed claims; T2 keeps the all-arms rule not because its arms
  replicate one claim but because the compound headline — beyond-exchange
  persistence — is licensed only by the full profile. A T2 partial fire
  selects the null row and takes the **scale-limited reading** (matrix
  row 3, sub-case b), not a cut-dependence label; cut-dependence is T1's
  partial-fire label only. `W` is a physical lag scale, and the arms share
  most of their pairs (56% of W = 5 pairs also appear at W = 30) so they are
  not independent replications — but under the span ≥ 2W eligibility rule
  the pair sets are **not nested**: at W = 30 the filter removes 41 of 62
  recordings, 197 of the 451 W = 5 pairs are absent, and the deployment lead
  flips from sw085 (28%) to sw061 (37%). A decay across the raw profile can
  therefore be produced by composition alone. Registered: the scale profile
  is reported twice — on each arm's own eligible set, and on the fixed
  W = 30-eligible recording set (composition-constant); **only the
  composition-constant profile may carry the reading "decay across `W` is
  what real short-lag coupling produces"** (exp08's N3 read small-window
  survival as the mark of a real effect). The shared-pair fraction across
  windows is reported so a scale profile cannot be read as three
  confirmations.

**Survival criterion, fixed now:**

- **Mass, defined numerically:** T1 mass = Σ_fragments (L − 1) aligned pairs;
  T2 mass = Σ_units (n_runs − 1) consecutive run-mean pairs; T3 mass = the
  arm's deduplicated pair count. The floor is 33.3 (exp01's), and arms below
  it are NOT TESTED — they count neither for nor against survival. From the
  regenerated probe, no arm falls below the floor.
- **T1** survives if `p < 0.05` at every tested arm **and the observed sign
  agrees at every tested arm**. Mixed signs = "no consistent direction — does
  not survive." (Two-sided statistics without a sign clause can certify a
  mechanical mixture of "pacing" and "compensation" as one finding.)
- **T2** survives if `p < 0.05` at every tested arm.
- **T3** survives if `p < 0.05` at the primary arm (W = 5) under **both**
  nulls (rotation, and jitter at both J values).
- **Binding, fixed now:** in the reading matrix below, "fires" means
  *survives this criterion* and "null" means *does not survive* — **including
  partial fires**, which select the null row. In the narrative a T1 partial
  fire is reported as cut-dependence (GAP is an analyst cut for fragment
  formation), **with a registered precedence rule:** where one of the three
  registered T1 arm-pattern readings below applies, that reading overrides
  the generic cut-dependence label; cut-dependence is the default label for
  a T1 partial fire matching none of the three patterns. A T2 partial fire
  is reported as **scale-limited persistence** per the scale-indexed
  registration (matrix row 3, sub-case b) — not as cut-dependence. (Exp09's
  S1 fired at exactly two arms; the modal interesting outcome in this
  project is a partial fire, and it must not have a discretionary reading.)
- **NOT TESTED propagation, fixed now:** a statistic whose primary arm (T3)
  or **all** of whose arms (T1, T2) are NOT TESTED — by the mass floor, a
  failed negative control, or a failed placebo battery — is itself
  **NOT TESTED**: it takes neither "fires" nor "null", no matrix row keyed
  on its value may be selected (row 2's T2 column is "any", so it tolerates
  a NOT TESTED T2; rows 1 and 3 require tested values of both T2 and T3;
  T1 is not a matrix column, so a NOT TESTED T1 blocks no row — but it
  strips row 3's **T1-keyed** sub-case labels — (a), (c), (d) — only;
  sub-case (b) is T2-keyed and applies regardless of T1's state, both
  registered in the row itself), its
  sensitivity deliverable is not quoted (it derives from the very null
  found broken), and the outcome is reported as a finding about the null
  machinery, not about whales. Correspondingly, **"every tested arm" in the
  T1/T2 criteria requires at least one tested arm** — survival cannot be
  vacuously true.
- **Multiplicity:** each statistic is its own confirmatory family at
  α = 0.05. The matrix's compound rows are compositions of family-level
  outcomes; under a global null, "at least one of the three fires" has
  probability ≈ 0.14, and no compound reading is treated as more than the
  sum of its parts.
- **T1 arm-pattern reading, registered (applies to the partialled statistic
  only):** every within-fragment `y ≤ GAP` by construction, so the GAP-3 arm
  truncates the regressor's support to [0, 3] s — unlike exp09's sweep, the
  parameter here truncates the variable being correlated, and monotone
  attenuation with shrinking support is what a *real* coupling does under
  truncation. If T1 is significant at the wide arms with |r| attenuating
  monotonically as `GAP` shrinks, that pattern is registered as "consistent
  with a real coupling at timescales the narrow arms truncate away" — it
  does not *survive* (the criterion stands), but it is reported as that
  pattern and not as a cut artifact. Significance at isolated interior arms
  with no monotone profile is the cut-artifact signature. A third pattern is
  registered now: **fires confined to the narrow edge arms (GAP 3–5) with no
  wide-arm support** are the signature of residual null miscalibration on
  short-fragment geometry (GAP-3 median fragment length is 5, giving 3–4
  rotation alignments per fragment under the corrected identity-included
  offset set — the round-2 draft's identity-excluding set, since retracted,
  was itself a measured miscalibration source on exactly this geometry — and
  one wraparound-seam adjacency per non-trivially rotated fragment: pooled at
  GAP 3 that is 27% of the rotated gap vector's adjacencies (108/402) and 21%
  of aligned pairs (108/510), and 25–33% of the modal L = 4–5 fragments' own
  pairs; identity draws reproduce the observed alignment and carry no seam,
  so the unconditional expectations are 20% / 16% respectively), not of
  coupling — that pattern
  triggers re-examination of the placebo battery at those arms and licenses
  no coupling reading. **Precedence, registered:** these three arm-pattern
  readings partition nothing by accident — a partial fire matching none of
  them (e.g. fires at both edges only) takes the generic cut-dependence
  label; see the binding bullet above.

## Feasibility (counts only — no test statistic was computed)

Regenerated after the review under the registered universe: G3-eligible
codas, excluded codas break fragments, run-collapse T2, eligible-only
bidirectional dedup T3 pairing, span ≥ 2W. (The first draft's table was
computed with no G3 filter and a single-direction T3 pairing — a universe the
registration itself excludes; every registered mass below supersedes it.)

| arm | mass |
|---|---|
| T1, GAP 3/5/10/15/30 s | 510 / 1,576 / 2,040 / 2,152 / 2,228 aligned pairs (108 / 266 / 278 / 263 / 244 fragments) |
| T2, GAP 3/5/10/15/30 s | 225 / 254 / 120 / 76 / 44 consecutive run-mean pairs (41 / 55 / 22 / 12 / 6 units) |
| T3, W 5/10/30 s | 451 / 525 / 384 pairs (62 / 55 / 21 recordings with span ≥ 2W) |

Material facts the probes measured, registered as report obligations:

- T2 separation medians 13.2 / 12.6 / 22.3 / 37.3 / 112.6 s by arm; share of
  separations ≥ 30 s: 28 / 22 / 39 / 59 / 100%.
- T2 deployment concentration: sw061 carries 72 / 65 / 79 / 87 / 95% of arm
  mass.
- T3 deployment leaders: sw085 28%, sw061 21%, sw090 13% at W = 5 — nearly
  disjoint from T2's material (sw061b003, T2's dominant unit source, has five
  speakers and is structurally barred from T3).
- T3 overlap-pair share: 51 / 41 / 35% by arm.

T2 at 30 s is thin (6 units, 44 pairs) and will carry wide nulls; it stays in
the sweep because excluding a pre-registered arm after seeing its width is
exactly the flexibility this project exists to remove.

## Nulls, summarized

| statistic | null | destroys | preserves |
|---|---|---|---|
| T1 | per-fragment circular rotation of the aligned gap vector against intact `(res_i, res_{i−1})` triplets, all L−1 offsets including the identity (pinned above) | alignment | both series' internal structure, the partialling's cancellation |
| T2 | permute run order within recording × whale | beyond-gap order | every run's own mean, the unit's composition |
| T3a | rigid rotation of one whale's timeline, pairing re-derived | temporal concurrence | each whale's sequence and autocorrelation, the pairing mechanism |
| T3b | per-coda jitter ±J of one whale, pairing re-derived | fine alignment | the joint activity envelope |

**Negative controls, every arm:** draw once from the arm's own null, run the
full test on the draw; repeat 40× at 1,000 iterations. Must fire at ≈ α;
pass threshold 0.15 (exp07's convention). **Consequence of failure,
registered:** an arm whose negative control exceeds the threshold is reported
NOT TESTED — its null is broken — counts neither for nor against survival,
and the failure is itself reported as a finding about the null.

**What the own-null battery cannot check, and what does:** drawing from an
arm's own null and testing against that null passes *by construction* even
when the null is mis-specified — it validates machinery, not exchangeability
(the reviewer simulations fired T1's raw statistic at 7× α while its
negative control sailed through). So a **synthetic-H0 placebo battery** is
registered, one generative world per statistic, each pushed through the full
registered pipeline.

**Execution and consequence of failure, registered (mirroring the negative
controls):** the battery runs **before any real statistic is computed**, at
**every arm separately** (T1's bias scale is a pure function of `GAP`
geometry — σ_res/sd(y) = 0.275 at 3 s vs 0.041 at 30 s — so a wide-arm-only
run can pass while a narrow arm is broken), **40 draws × 1,000 iterations at
the registered seed, pass threshold 0.15 per arm**. A statistic whose
placebo exceeds the threshold at **any** arm is **NOT TESTED in toto** (see
the propagation rule above) until the null implementation is amended via a
**dated pre-statistic revision note** in this document and the battery
re-run under the amendment; the failure is itself reported as a finding.
There is no other branch: no silent variant-switching, no reseeding, no
φ re-tuning — and **no re-tuning of the placebo worlds' generative
constants**, which are frozen text (pin P4 in the implementation-pins
section: T3-P coupling β = 0.3, T3-P own-whale noise AR(1) φ = 0.405 at
every `W`, own-fragment marginal resampling); moving any of them is an
amendment of the null machinery and requires the same dated pre-statistic
revision note and battery re-run. This branch is known to be live, not
decorative — the
round-2 simulations showed the *unpinned* T1 rotation variant fails exactly
this battery (0.32 at GAP 3), which is why the null above is pinned.

- **T1-P (onset-clocked):** real fragment scaffolds; i.i.d. IOIs, AR(1)
  durations at zero coupling. **T1-P′ (silence-clocked):** AR(1) durations,
  i.i.d. silences. **φ is pinned per arm** to exp09's measured S2 lag-1
  values: 0.106 / 0.265 / 0.405 / 0.483 / 0.522 at GAP 3/5/10/15/30 ("exp09's
  measured φ" unqualified is a range, not a value). The partialled T1 under
  the pinned null must fire at ≈ α in both worlds at every arm.
- **T2-P, generation level pinned:** **coda-level** simulation on the real
  (run-size, order) scaffolds — AR(1) durations within runs at the arm's
  pinned φ, collapsed to run means through the registered pipeline. Not
  direct i.i.d. run-mean draws: those are exchangeable by construction and
  would test nothing. The pin is about test severity, not suspicion —
  reviewer simulation showed the registered T2 permutation calibrates at
  ≈ α even under 55× run-size variance ratios on the real scaffolds. The
  run-collapse T2 must fire at ≈ α.
- **T3-P:** two whales sharing an activity envelope, each with own-whale gap
  coupling, zero cross-whale coupling. The full T3 decision procedure
  (rotation + jitter conjunction) must certify concurrence at ≈ α.

**Sensitivity, registered deliverable:** for every arm of every statistic,
report the smallest |statistic| that would have fired, derived from the arm's
own null width. Every null reading below is a reading *at the reported
sensitivity*.

`SEED = 1010`, `ITERATIONS = 2000`, α = 0.05, deterministic.

## Implementation pins (registered pre-freeze)

The implementation (`tools/exp10_rubato_provenance.mjs`) was drafted before
the freeze — see the round-4 revision note — and is quarantined behind
`--gates-only` until this document is frozen: it has never executed past the
counts-only feasibility echo, and no test statistic has been computed. The
registration text leaves five implementation choices open; they are pinned
here so that the tool resolves nothing silently. These pins are frozen text,
covered by the battery section's no-retuning clause.

- **P1 — composition of T1's partial correlation:** the three pooled
  per-fragment-centered correlations `r_xy`, `r_xz`, `r_yz` are computed
  over the same aligned triplets, then combined as
  `(r_xy − r_xz·r_yz) / √((1 − r_xz²)(1 − r_yz²))` — **pool-then-partial**.
  Every calibration number in this document (the 250 × 500 pure-noise,
  placebo-world and in-world-formation rates) was computed under exactly
  this composition and certifies no other; on this scaffold it is also the
  only workable one (GAP-3's modal fragments yield 3 aligned triplets,
  leaving zero residual degrees of freedom for a per-fragment partial).
  Per-fragment-partial-then-pool is explicitly not the statistic.
- **P2 — T3 pair orientation:** double entry — each unordered deduplicated
  pair contributes both (res_A, res_B) and (res_B, res_A) — so the pooled
  correlation is symmetric and no per-recording whale ordering is
  privileged. Identical inside every null draw.
- **P3 — T3 null target and tie-breaks:** rotation and jitter move the
  lexicographically **larger** whale index (exp08 rotated `ws[1]`);
  nearest-neighbour ties break toward the earlier-onset coda (T3 section),
  and equal-onset ties toward the lower row index.
- **P4 — placebo-world generative constants:** synthetic IOIs / silences
  are resampled i.i.d. from the fragment's **own observed values**;
  synthetic `res` is Gaussian AR(1) at the arm's pinned φ with the
  fragment's (or run's) observed res sd. T3-P couples each whale's `res` to
  its own preceding silence at standardized **β = 0.3** on the whale's real
  onsets, with own-whale AR(1) smoothness **φ = 0.405 (the mid-arm pin) at
  every `W`** (T3's arms are windows, not gaps, so the per-GAP φ table does
  not apply to them; one fixed mid-range value is used at all three arms).
  These constants are reachable by the no-retuning clause **by name**: a
  post-freeze battery failure cannot be repaired by moving them without a
  dated pre-statistic revision note and a battery re-run.
- **P5 — sensitivity definition:** for the one-sided statistics (T2, T3)
  the reported sensitivity is the arm's null-distribution 95th percentile;
  for two-sided T1 it is the null 2.5th and 97.5th percentiles.

## Pre-registered predictions

The deflationary stance, stated in advance:

- **T1 fires, positive, sign-consistent** (low confidence). Pace is a state
  variable; codas and silences plausibly share it.
- **T2 fires** (moderate confidence). Physiological states plausibly outlast
  single exchanges. (The first draft cited exp09's autocorrelation growth
  with window length here; that growth is mechanically guaranteed for any
  autocorrelated process under per-fragment centering — exp09 registered it
  as "not comparable across gaps" — so it supports nothing and the rationale
  is struck.)
- **T3, two scored clauses:** (i) **T3 does not survive**; (ii) **any fire
  will not be stable on the non-overlapping stratum** (stability in the
  pinned sense, T3 section). Entrainment is the extraordinary claim;
  rotation has already dissolved one intuitive effect in this corpus
  (exp08's switch rate), and the jitter co-null raises the bar further. The
  two clauses are scored independently so that a criterion-surviving T3 can
  never be reported as an unbroken prediction on wording alone. **Clause (ii)
  is conditional, and its scoring is registered now:** it is scored only if
  T3 survives; under a tested, non-surviving T3 it is **unevaluated** —
  neither hit nor miss, excluded from any prediction-scoring summary — so a
  single T3 non-detection scores as exactly one hit (clause i), never two.

**What would falsify the predictions:** T1 — any **tested** outcome other
than a sign-consistent positive survival of the partialled statistic; T2 —
failure to survive; T3 clause (i) — survival at the primary arm under both
nulls, **alone**; T3 clause (ii) — a surviving fire that is additionally
stable on the non-overlapping stratum (pinned sense). Misses are reported as
misses, as exp09's was. **Scoring under NOT TESTED, registered:** a
prediction about a statistic that is NOT TESTED is **unevaluated** — reported
as neither hit nor miss and excluded from any prediction-scoring summary; the
propagation rule's machinery-only reporting governs. A machinery failure is
never scored as a whale-prediction miss, in either direction.

## Reading the outcomes, fixed in advance

"Fires" and "null" are bound to the survival criterion above; partial fires
select the null row. A third value exists — **NOT TESTED** — governed by the
propagation rule in the survival section: rows 1 and 3 require tested values
of both T2 and T3; row 2's T2 column is "any" and tolerates a NOT TESTED T2;
in every other T2/T3 configuration no row is selected and the outcome is
reported as a finding about the null machinery. **Scope of that sentence,
registered:** in a no-row configuration the machinery-only reporting attaches
to the NOT TESTED statistic alone; a *tested* statistic retains its
statistic-level registered readings and qualifiers (for T2: the scale
reading, the GAP-30 requirement for "beyond-exchange", and the sw061
concentration qualifier; for T3: the non-detection-at-reported-sensitivity
statement) and takes no matrix-level stamp — "state-flavored" included —
because every such stamp is keyed on the partner column that was not tested.
Neither suppressing a tested statistic's outcome under the machinery
headline nor borrowing a row's stamp without its key is a registered
reading. T1 is not a matrix column:
its outcomes modulate row 3's sub-cases only, every tested T1 state maps to
exactly one registered sub-case treatment, and a NOT TESTED T1 strips
row 3's epistemic stamps (both registered in the row).

| T2 | T3 | reading |
|---|---|---|
| fires | null | Beyond-gap persistence with no detectable concurrence at the reported sensitivity — **state-flavored**. Rubato-as-code would have to ride on top of a state gradient, and any decoding claim inherits that burden. Two registered qualifiers apply: "session-scale" only if GAP-30 fired; and the LODO reading above if the effect is sw061-concentrated. |
| any | fires | Concurrent modulation — **shared driver or interaction**, undecidable here (whales dive together; synchronized state mimics coordination). A new fact about coda timing *only because* "fires" already means surviving the jitter co-null (criterion) — and this reading additionally requires stability on the non-overlapping stratum (registered reading condition, pinned definition in the T3 section). A rotation-only positive is not "fires" and takes the pre-assigned "co-activity plus private state" reading; a fire that fails the pinned stability definition takes "split-train channel not excluded". |
| null | null | Row selection is unchanged — partial fires land here — but the epistemic label is **split on observables, registered now**, because one label for everything in this cell pre-approved contradictory headlines. **(a) Clean null** (no tested T2 arm fires AND **T1 is tested and does not survive, with null or mixed signs**): drift is local to the exchange and not detectably shared — compatible with the paper's exchange-level reading; **registered as the maximally signal-compatible outcome and as evidence against the state predictions made here** — and still licensing no signal claim: unexplained is not signal. **(b) T2 partial fire** (some but not all tested arms fire): does not survive; reported per the scale-indexed registration as **scale-limited persistence at the fired arms** — persistence is not established beyond the widest fired gap, a miss at the thin GAP-30 arm (6 units, 44 pairs, the widest nulls in the design) is a **non-detection there, not evidence against a state process**, and "local to the exchange" may not be asserted. **(c) T1 surviving positive** (T2 and T3 null): the composed reading, registered now — **a pacing-state signature exists but is exchange-local**: evidence against the *beyond-exchange* state predictions (T2, T3) specifically, not against state, and still licensing no signal claim. **(d) T1 surviving negative** (T2 and T3 null): the composed reading, registered now, mirroring (c) — **a compensatory / isochronous motor-timing account is detected and is exchange-local**: "evidence against the pacing-state prediction" may be stated; "maximally signal-compatible" and "unexplained is not signal" may **not** — something *was* detected, and a T1 null is strictly more signal-compatible than a detected motor-timing structure. **T1 partial fire** (does not survive; sign-consistent fires at some tested arms): no sub-case stamp applies — not (a), a partial fire is not a clean null — and the narrative label follows the T1 partial-fire precedence rule in the binding bullet. **T1 NOT TESTED**: this row is still selected (rows key on T2/T3 only) but carries **no T1-keyed epistemic stamp** — sub-case labels (a), (c), (d) do not apply; the **T2-keyed sub-case (b) applies whenever its own condition (a T2 partial fire) is met, regardless of T1's state**, with all of (b)'s registered clauses — and the row is reported alongside the null-machinery finding per the propagation rule. The "maximally signal-compatible / evidence against the state predictions" stamp applies **only** in sub-case (a); (b) may co-occur with (c), (d), a T1 partial fire, or a T1 NOT TESTED — all applicable sub-readings are reported and the sub-case (a) stamp applies in none of these compositions. |

**T1 modulates the reading; it decides no row. Its sign outcomes are
registered separately** (the first draft's sign-blind "gap-coupled drift is
more state-like" would have read a compensation-direction fire backwards;
the two remaining T1 states — partial fire and NOT TESTED — are governed by
the binding bullet's precedence rule and the propagation rule respectively,
and by their entries in matrix row 3):

- **Positive, survives:** pacing-state signature — moves every reading
  toward state (with T2 and T3 null, the composed reading is matrix row 3,
  sub-case c, and row 3's anti-state stamp does not apply).
- **Negative, survives (partialled):** compensatory / isochronous motor
  timing — a *different* motor-timing account, **not** a shared-rate
  signature; registered as weakening the pacing account specifically, while
  still not evidence of a code (with T2 and T3 null, the composed reading is
  matrix row 3, sub-case d, and row 3's sub-case (a) stamp does not apply).
  A raw-statistic negative that does not survive partialled is
  uninterpretable (the mechanical term produces it).
- **Null or mixed signs:** no gap coupling detected; T1 contributes nothing
  (this is the T1 state row 3's sub-case (a) requires).

**Material caveat on compound readings, registered:** T2 and T3 draw on
nearly disjoint material — T2's mass is 65–95% sw061 (whole-session,
multi-speaker); T3's is led by sw085 sub-minute excerpts, and sw061b003
cannot enter T3 at all. A T2-fires + T3-null dissociation is therefore a
statement about *different whales, deployments and window regimes*, not a
within-process dissociation, and is reported with the side-by-side
per-deployment mass table that makes this visible. "Private" is never the
headline of a non-detection on material where the drift was not measured.

## What this will not license

- **A physiological identification.** "State" here means *temporally
  structured beyond the gap and/or coupled to calling pace* — not
  "respiration", which this corpus cannot see.
- **A state/signal discrimination.** The instrument is one-sided: it can
  find state signatures or fail to find them. It cannot affirm "signal", and
  the title's question is answerable only in the state direction.
- **A communication claim from a T3 positive.** Shared environment and joint
  behavior produce concurrence without interaction — and so would the
  systematic split-train annotation channel exp08 could not exclude and
  exp06 showed cannot be resolved against audio. The stability-off-overlap
  requirement (pinned definition, T3 section) reduces, but does not
  eliminate, that channel.
- **A no-coordination claim from a T3 null** — at *any* scale. A null here
  is a non-detection at the reported sensitivity, on the swept windows, on
  material dominated by sub-minute annotator-cut excerpts.
- **Anything about meaning, individuals, or class-17 codas** — exp09's limits
  carry over unchanged.

## Result

**The machinery validated everywhere and the whale mostly declined to
cooperate with the state story — and entirely declined to support the
imitation one.** Every negative control passed (max 5/40 against threshold
6/40); the placebo battery passed at every arm in all four synthetic worlds
(T3-P notably at 0/40: the jitter co-null absorbs the shared-envelope
channel exactly as designed). All three statistics were tested. Matrix
**row 3** (T2 null, T3 null), with sub-case (b) and a T1 partial fire.
`tools/exp10_rubato_provenance.mjs`, `artifacts/rubato_provenance.json`,
deterministic.

### T1 — gap coupling: present at four of five cuts; does not survive

| GAP | partial-r | z | p | raw(sil) | raw(IOI) |
|---|---|---|---|---|---|
| 3 s | 0.167 | 2.2 | **0.030** | 0.164 | 0.198 |
| 5 s | 0.076 | 1.9 | 0.057 | 0.075 | 0.135 |
| 10 s | 0.119 | 4.3 | **0.001** | 0.091 | 0.130 |
| 15 s | 0.107 | 3.6 | **0.002** | 0.089 | 0.122 |
| 30 s | 0.120 | 4.5 | **0.001** | 0.091 | 0.113 |

Sign-consistent positive everywhere; the 5 s arm missed at p = 0.057, so by
the frozen criterion T1 **does not survive**, and the fired set
{3, 10, 15, 30} matches none of the three registered arm-patterns — the
registered narrative label is **generic cut-dependence**, and the frozen
precedence rule forbids upgrading it. The scored prediction
(fires-positive-sign-consistent) is a **miss**. What may be said: a positive
partial gap-coupling — longer preceding silence, longer coda, with the
mechanical channel partialled out — appears at four cuts including every
wide one, and its registered reading stops at the label above.

### T2 — persistence at short and mid cuts; not beyond the exchange

| GAP | units | lag1-r | z | p | sw061 share | LODO worst p | sep median / ≥30 s |
|---|---|---|---|---|---|---|---|
| 3 s | 41 | 0.178 | 3.9 | **0.0005** | 72% | 0.063 | 13.2 s / 28% |
| 5 s | 55 | 0.343 | 6.5 | **0.0005** | 65% | 0.005 | 12.6 s / 22% |
| 10 s | 22 | 0.326 | 4.6 | **0.0010** | 79% | 0.001 | 22.3 s / 39% |
| 15 s | 12 | 0.143 | 2.2 | **0.0145** | 87% | 0.026 | 37.3 s / 59% |
| 30 s | 6 | 0.002 | 0.7 | 0.224 | 95% | 0.239 | 112.6 s / 100% |

Four arms fire; the GAP-30 arm — the only one whose separations are all
≥ 30 s — does not (6 units, 44 pairs, the widest nulls in the design).
**Sub-case (b), as registered: scale-limited persistence at the fired
arms.** Persistence is established across separations with medians 13–37 s;
it is *not* established beyond the widest fired gap; the 30 s miss is a
non-detection there, not evidence against a state process; and "local to
the exchange" may not be asserted. The registered concentration qualifier
**triggered** (the 3 s arm's worst leave-one-deployment-out case loses
significance at p = 0.063): concentrated in one annotation scene —
consistent with block-wise attribution error as well as state; the state
reading is not licensed at full strength. The scored prediction (fires) is
a **miss**.

### T3 — the covariation is real, and the envelope explains all of it

| W | pairs | r | rotation p | jitter-2 p | jitter-5 p | overlap share |
|---|---|---|---|---|---|---|
| 5 s | 451 | 0.302 | **0.008** | 0.62 | 0.48 | 51% |
| 10 s | 525 | 0.264 | **0.012** | 0.82 | 0.65 | 41% |
| 30 s | 384 | 0.211 | **0.025** | 0.97 | 0.83 | 35% |

Nearby codas from different whales really do covary in tempo deviation —
r = 0.30 at the primary arm, firing the rotation null at every window, and
not removed by controlling each whale's own preceding silence (partial
r = 0.32). **And the envelope-preserving jitter null reproduces every bit
of it** (p = 0.48–0.97). The registered pre-assigned reading applies
verbatim: *co-activity plus private state, or fine alignment below the
co-null's discrimination at the reported retention; no evidence of tempo
concurrence at that discrimination* (retention: rotation 12.8%, J2 89.9%,
J5 67.7% — the J2 arm re-derives ~90% of pairs identically, so its
discrimination is limited and was registered as such before freezing). T3
does not survive; prediction clause (i) is a **hit**; clause (ii) is
unevaluated (conditional on a surviving fire). The non-overlap stratum
(r = 0.28, n = 222) is not stable in the pinned sense, which bears no
reading on a non-surviving T3.

**Bearing on the published imitation sub-claim, in the registered senses
only:** Sharma et al. read overlap-pair duration matching (0.099 s vs
0.129 s, n = 908) as rubato "perceived and imitated." This experiment finds
the corresponding covariation in the same corpus — and finds that a null
preserving only the joint activity envelope, with zero cross-whale
coupling, reproduces it at every window. That is a **non-detection of
imitation under the two controls the published comparison does not apply**,
at the reported discrimination, on the two-speaker subset — registered in
advance as exactly that, and not as a demonstration that the published
effect is artifact.

### Scorecard and what stands

Predictions: T1 fires-positive — miss (partial fire); T2 fires — miss
(scale-limited); T3(i) no survival — hit; T3(ii) — unevaluated. One hit,
two misses, one unevaluated: the deflationary stance itself over-predicted
how much state signature the corpus would certify.

After experiments 09 and 10 together, what stands about rubato: the
within-exchange smooth drift is real and robust (09); its tempo state shows
scale-limited persistence concentrated in one annotation scene, a positive
but cut-dependent coupling to calling pace, and cross-whale covariation
fully absorbed by co-activity (10). Nothing here identifies a driver;
nothing here affirms signal; and the strongest published evidence for
communicative use of rubato — imitation — has now been tested under the
controls its original analysis lacked, and did not survive them.

## Reproducing

```bash
python3 tools/fetch_corpus.py
./wham/.venv/bin/python tools/fetch_sharma_labels.py
node    tools/exp10_rubato_provenance.mjs --gates-only   # gates + counts only
node    tools/exp10_rubato_provenance.mjs                # the registered run
```

Code-verification note (2026-08-07, post-freeze, pre-statistic): the frozen
implementation was independently verified clause-by-clause (six domains, 170
clauses, fixture-based re-derivation, adversarial cross-examination). The 14
confirmed defects — a crash that made the battery unexecutable, an
unregistered gate-bypass flag, incomplete NOT TESTED propagation (the
negative-control and mass-floor channels reached per-arm flags but not the
statistic-level verdict), a direction-blind prediction line, an
unconditional clause-(ii) print, and six unimplemented registered report
obligations — were repaired before any statistic ran. No pinned constant,
null, statistic, criterion, or matrix rule changed; a second verification
pass ran clean before the first ungated run.
