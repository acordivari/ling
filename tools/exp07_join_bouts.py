#!/usr/bin/env python3
"""Join the coda-vowel annotations to the dialogue corpus, recovering bout ids.

    python3 tools/exp07_join_bouts.py

The vowel deposit (`Project-CETI/coda-vowel-phonology`, OSF 9t6qu) carries
per-coda vowel labels and 13 NAMED individual whales, but no recording or bout
identifier. `sperm-whale-dialogues.csv` (Sharma et al. deposit) carries `REC` --
the DTag sub-recording a coda came from -- but no vowel labels and only a
per-recording speaker index, not a name.

Joining them supplies what experiment 07's clustered arm needs: a unit of
non-independence. Codas from one whale in one bout are not independent draws,
and experiment 04 measured that exact substitution against ground truth and
found it ANTI-CONSERVATIVE (101 of 126 true-null splits shifted p downward,
sign test p = 5e-12). An unclustered p here is too small, not too large.

**The join key is `Duration`.** That is not a convenience: it is an exact float
match between two tables that inherit the same annotated numbers, so it behaves
like a shared primary key rather than a measurement. (Experiment 06 established
the opposite for audio: matching a *measured* duration against these tables is
hopeless, 3.1% unique at 0.5 ms. The distinction is the whole reason that
experiment failed and this one works.)

Two independent validations are run and printed, because a join asserted without
one is how experiment 06's target paper got into trouble:

  1. every uniquely-matched row should carry dialogue speaker index 1, since the
     vowel data is focal-only and the tagged whale is speaker 1;
  2. `nClicks` in the dialogue row should equal the click count implied by the
     vowel row's own `codatype` label.

Writes data/vowel/joined.json. Nothing is redistributed; data/ is gitignored.
"""

import csv
import json
import os
import re
import ssl
import subprocess
import sys
import urllib.error
import urllib.request
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
VOWEL_DIR = os.path.join(HERE, "..", "data", "vowel")
CODAMD = os.path.join(VOWEL_DIR, "codamd.csv")
CODASP = os.path.join(VOWEL_DIR, "codasp.csv")
DIALOGUES = os.path.join(HERE, "..", "data", "sperm-whale-dialogues.csv")
OUT = os.path.join(VOWEL_DIR, "joined.json")

SOURCES = {
    CODAMD: "https://raw.githubusercontent.com/Project-CETI/coda-vowel-phonology/main/codamd.csv",
    CODASP: "https://raw.githubusercontent.com/Project-CETI/coda-vowel-phonology/main/codasp.csv",
    DIALOGUES: ("https://raw.githubusercontent.com/pratyushasharma/"
                "sw-combinatoriality/main/data/sperm-whale-dialogues.csv"),
}

try:
    import certifi
    _SSL = ssl.create_default_context(cafile=certifi.where())
except Exception:  # noqa: BLE001
    _SSL = None


def fetch(path, url):
    if os.path.exists(path):
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    print(f"  fetching {os.path.basename(path)}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ling-exp07/1.0"})
        with urllib.request.urlopen(req, timeout=60, context=_SSL) as r:
            body = r.read()
        with open(path, "wb") as f:
            f.write(body)
    except (urllib.error.URLError, OSError) as e:
        try:
            subprocess.run(["curl", "-sSL", "--fail", "-o", path, url],
                           check=True, timeout=60)
        except (subprocess.SubprocessError, OSError):
            sys.exit(f"  fetch failed ({e}); download {url} to {path} manually")


def n_clicks(codatype):
    ct = (codatype or "").strip()
    if "+" in ct:
        try:
            return sum(int(x) for x in ct.split("+"))
        except ValueError:
            return None
    m = re.match(r"^(\d+)", ct)
    return int(m.group(1)) if m else None


def deployment(rec):
    """sw061b001_124 -> sw061b. One DTag on one animal."""
    m = re.match(r"^(sw\d+[a-z])", rec or "")
    return m.group(1) if m else rec


def main():
    print("EXPERIMENT 07 — joining vowel labels to bout ids on Duration")
    print("=" * 74)
    for p, u in SOURCES.items():
        fetch(p, u)

    md = list(csv.DictReader(open(CODAMD, encoding="utf-8-sig")))
    sp = {r["codanum"]: r for r in csv.DictReader(open(CODASP, encoding="utf-8-sig"))}
    dlg = list(csv.DictReader(open(DIALOGUES, encoding="utf-8-sig")))
    print(f"  codamd {len(md)}   codasp {len(sp)}   dialogues {len(dlg)}")

    by_dur = defaultdict(list)
    for r in dlg:
        by_dur[round(float(r["Duration"]), 7)].append(r)
    shared = sum(1 for v in by_dur.values() if len(v) > 1)
    print(f"  distinct dialogue durations {len(by_dur)}   "
          f"durations held by >1 row {shared}")

    joined, ambiguous, unmatched = [], 0, 0
    for r in md:
        cand = by_dur.get(round(float(r["Duration"]), 7), [])
        if len(cand) == 1:
            d = cand[0]
            joined.append({
                "codanum": r["codanum"], "whale": r["whale"],
                "codatype": r["codatype"], "handv": r["handv"],
                "duration": float(r["Duration"]),
                "rec": d["REC"], "deployment": deployment(d["REC"]),
                "speakerIndex": d["Whale"], "nClicks": int(d["nClicks"]),
                "tsTo": float(d["TsTo"]),
                "meandist_pk1": (sp.get(r["codanum"], {}) or {}).get("meandist_pk1"),
            })
        elif len(cand) > 1:
            ambiguous += 1
        else:
            unmatched += 1

    print(f"  matched uniquely {len(joined)} ({100 * len(joined) / len(md):.1f}%)   "
          f"ambiguous {ambiguous}   unmatched {unmatched}")
    print()

    # --- validation ---------------------------------------------------------
    spk = Counter(j["speakerIndex"] for j in joined)
    v1 = set(spk) == {"1"}
    print(f"  V1  every joined row is dialogue speaker index 1 "
          f"(focal-only): {dict(spk)}  {'PASS' if v1 else 'FAIL'}")

    agree = tot = 0
    for j in joined:
        k = n_clicks(j["codatype"])
        if k is None:
            continue
        tot += 1
        agree += (j["nClicks"] == k)
    v2 = tot and agree / tot >= 0.95
    print(f"  V2  nClicks agrees with the codatype-implied count: "
          f"{agree}/{tot} = {100 * agree / tot:.1f}%  {'PASS' if v2 else 'FAIL'}")

    # --- the unattributed-whale sentinel ------------------------------------
    #
    # `whale` is blank on 108 rows. Read naively as a whale name, an empty string
    # becomes a 14th animal, and two bouts then appear to span two whales -- which
    # is what the nesting check below caught on the first run. It is the same trap
    # family as `IDN == 0` in DominicaCodas.csv (unidentified, not whale zero) and
    # the `ZZZ` unknown-unit sentinel that manufactured C(13,3) in experiment 01.
    #
    # None of the 108 carry a vowel label, so excluding them costs the analysis
    # nothing. They are dropped explicitly rather than silently surviving as a
    # group.
    unnamed = [j for j in joined if not j["whale"].strip()]
    unnamed_labelled = [j for j in unnamed if j["handv"] in ("a", "i")]
    named = [j for j in joined if j["whale"].strip()]
    print(f"  S   unattributed rows (blank `whale`): {len(unnamed)}, of which "
          f"{len(unnamed_labelled)} carry a vowel label -- dropped")

    # --- nesting, which the cluster permutation requires ---------------------
    rec_w, dep_w = defaultdict(set), defaultdict(set)
    for j in named:
        rec_w[j["rec"]].add(j["whale"])
        dep_w[j["deployment"]].add(j["whale"])
    bad_rec = [k for k, v in rec_w.items() if len(v) > 1]
    bad_dep = [k for k, v in dep_w.items() if len(v) > 1]
    print(f"  V3  bouts spanning >1 named whale: {len(bad_rec)} of {len(rec_w)}  "
          f"{'PASS' if not bad_rec else 'FAIL'}")
    print(f"  V4  deployments spanning >1 named whale: {len(bad_dep)} of {len(dep_w)}  "
          f"{'PASS' if not bad_dep else 'FAIL'}")

    # --- injectivity the OTHER way ------------------------------------------
    # A duration unique on the dialogue side can still be claimed by two vowel
    # rows. Checking one direction only would have let that through: exactly one
    # such collision exists (PINCHY `1+1+3` and an unnamed `5R3`, both at
    # 1.1856 s), and dropping the sentinel resolves it.
    claims = defaultdict(list)
    for j in named:
        claims[(j["rec"], j["tsTo"])].append(j["codanum"])
    collisions = {k: v for k, v in claims.items() if len(v) > 1}
    print(f"  V5  dialogue rows claimed by >1 named vowel row: {len(collisions)}  "
          f"{'PASS' if not collisions else 'FAIL'}")

    if not (v1 and v2 and not bad_rec and not bad_dep and not collisions):
        sys.exit("\n  join validation FAILED — not written")
    joined = named

    # --- the structure that decides what is testable -------------------------
    labelled = [j for j in joined if j["handv"] in ("a", "i")]
    wc, wb, wd = Counter(), defaultdict(set), defaultdict(set)
    for j in labelled:
        wc[j["whale"]] += 1
        wb[j["whale"]].add(j["rec"])
        wd[j["whale"]].add(j["deployment"])
    print()
    print(f"  vowel-labelled and joined: {len(labelled)}")
    print(f"    {'whale':<10}{'codas':>7}{'bouts':>7}{'deployments':>13}")
    for w, _ in wc.most_common():
        print(f"    {w:<10}{wc[w]:>7}{len(wb[w]):>7}{len(wd[w]):>13}")
    one_dep = sum(1 for w in wc if len(wd[w]) == 1)
    print()
    print(f"  {one_dep} of {len(wc)} whales were recorded in exactly ONE deployment.")
    print("  Whale identity is therefore near-perfectly confounded with recording")
    print("  session, and a deployment-level permutation has almost no resolution.")
    print("  That is the finding, not an obstacle to be tuned away.")

    with open(OUT, "w") as f:
        json.dump({
            "source": {
                "vowel": "github.com/Project-CETI/coda-vowel-phonology (OSF 9t6qu)",
                "dialogues": "github.com/pratyushasharma/sw-combinatoriality",
            },
            "joinKey": "Duration (exact float; both tables inherit the same "
                       "annotated numbers, so this is a shared key, not a measurement)",
            "counts": {"codamd": len(md), "uniquelyMatched": len(joined),
                       "ambiguous": ambiguous, "unmatched": unmatched,
                       "vowelLabelled": len(labelled)},
            "validation": {"speakerIndexAllOne": v1, "nClicksAgreement": agree / tot,
                           "boutsSpanningWhales": len(bad_rec),
                           "deploymentsSpanningWhales": len(bad_dep)},
            "rows": joined,
        }, f, indent=2)
    print()
    print(f"  written {OUT}")


if __name__ == "__main__":
    main()
