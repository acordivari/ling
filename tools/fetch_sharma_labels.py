#!/usr/bin/env python3
"""Fetch Sharma et al.'s own per-coda classifications and validate the alignment.

    ./wham/.venv/bin/python tools/fetch_sharma_labels.py

Use the venv interpreter, not bare `python3`. `mean_codas.p` holds numpy arrays,
and on this machine `/usr/local/bin/python3` is an x86_64 build with no numpy —
the Rosetta trap documented in INSTALL.md. The other fetch tools in this repo do
not need it and run under either.

The `sw-combinatoriality` deposit ships pickled arrays alongside the CSVs that
are aligned 1:1 with `sperm-whale-dialogues.csv`:

    ornaments.p    binary ornamentation flag per coda      3,840
    rhythms.p      rhythm-class index per coda, 18 classes 3,840
    mean_codas.p   the 18 class centroids                     18
    tempos-dict.p  5 populated tempo classes                   --

Experiment 09 tests the authors' OWN labels rather than a reimplementation of
their definitions, which removes the most common way an independent check goes
wrong. `rhythms.p` also supplies something the dialogue CSV lacks entirely: a
coda-type column to stratify by.

SAFETY. Unpickling executes arbitrary code, and these are files from someone
else's repository. Every file is disassembled with `pickletools` FIRST and its
GLOBAL opcodes checked against an allowlist; anything unexpected aborts before
`pickle.load` is ever called. This is a gate, not a comment -- if the deposit
changes, this refuses rather than executes.

Writes data/sharma_labels/labels.json. Nothing is redistributed; data/ is
gitignored and the deposit carries no LICENSE file.
"""

import io
import json
import os
import pickle
import pickletools
import ssl
import subprocess
import sys
import urllib.error
import urllib.request

BASE = ("https://raw.githubusercontent.com/pratyushasharma/"
        "sw-combinatoriality/main/data")
FILES = ["ornaments.p", "rhythms.p", "mean_codas.p", "tempos-dict.p"]

# Only these may appear as GLOBAL opcodes. numpy is expected for the centroid
# arrays; anything else -- os, subprocess, builtins.eval -- means stop.
ALLOWED_GLOBALS = {
    "numpy ndarray",
    "numpy dtype",
    "numpy.core.multiarray _reconstruct",
    "numpy.core.multiarray scalar",
}

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "..", "data", "sharma_labels")
DIALOGUES = os.path.join(HERE, "..", "data", "sperm-whale-dialogues.csv")
OUT = os.path.join(DATA_DIR, "labels.json")

try:
    import certifi
    _SSL = ssl.create_default_context(cafile=certifi.where())
except Exception:  # noqa: BLE001
    _SSL = None


def fetch(name):
    path = os.path.join(DATA_DIR, name)
    if os.path.exists(path):
        return path
    os.makedirs(DATA_DIR, exist_ok=True)
    url = f"{BASE}/{name}"
    print(f"  fetching {name}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ling-exp09/1.0"})
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
    return path


def globals_in(path):
    """Every GLOBAL / STACK_GLOBAL operand, without executing anything."""
    out = io.StringIO()
    pickletools.dis(open(path, "rb"), out)
    found = set()
    for line in out.getvalue().splitlines():
        s = line.strip()
        if " GLOBAL " in f" {s} " or s.startswith(("GLOBAL", "STACK_GLOBAL")):
            # operand is the quoted tail of the line
            if "'" in s:
                found.add(s.split("'")[1])
    return found


def main():
    print("EXPERIMENT 09 — Sharma et al. per-coda labels")
    print("=" * 74)
    paths = {n: fetch(n) for n in FILES}

    print()
    print("  SAFETY GATE — pickletools disassembly before any load")
    bad = False
    for n, p in paths.items():
        g = globals_in(p)
        unexpected = g - ALLOWED_GLOBALS
        status = "PASS" if not unexpected else f"REFUSED {sorted(unexpected)}"
        print(f"    {n:<16} globals={sorted(g) if g else '[] (pure data)'}  {status}")
        bad = bad or bool(unexpected)
    if bad:
        sys.exit("\n  a pickle references something outside the allowlist — not loaded")

    try:
        import numpy  # noqa: F401  -- mean_codas.p is a numpy array pickle
    except ImportError:
        sys.exit("  numpy is required to load mean_codas.p.\n"
                 "  Run with ./wham/.venv/bin/python, not bare python3 "
                 "(see INSTALL.md, the Rosetta trap).")

    orn = pickle.load(open(paths["ornaments.p"], "rb"))
    rhy = pickle.load(open(paths["rhythms.p"], "rb"))
    mc = pickle.load(open(paths["mean_codas.p"], "rb"))

    import csv
    rows = list(csv.DictReader(open(DIALOGUES, encoding="utf-8-sig")))
    print()
    print(f"  dialogues rows {len(rows)}   ornaments {len(orn)}   rhythms {len(rhy)}   "
          f"centroids {len(mc)}")
    if not (len(rows) == len(orn) == len(rhy)):
        sys.exit("  lengths disagree — the 1:1 alignment assumption fails")

    # --- G1: validate alignment independently -------------------------------
    # If rhythms.p[i] describes row i, the class centroid's click count must
    # match that row's own nClicks. This is a check the deposit does not supply.
    #
    # A RESIDUAL class is detected rather than hardcoded: one whose members'
    # click counts mostly disagree with its own centroid is not a rhythm class,
    # it is the bucket for codas that fit nothing. Class 17 holds click counts
    # from 1 to 29 against a 10-click centroid; class 14, also 10-click, holds
    # 13 codas of exactly 10. The contrast is what identifies it.
    class_n = [len(a) for a in mc]
    per_class = {}
    for i, r in enumerate(rows):
        k = rhy[i]
        agree_k, tot_k = per_class.get(k, (0, 0))
        per_class[k] = (agree_k + (int(r["nClicks"]) == class_n[k]), tot_k + 1)
    residual = sorted(k for k, (a, t) in per_class.items() if t >= 5 and a / t < 0.5)

    mism = [i for i, r in enumerate(rows) if int(r["nClicks"]) != class_n[rhy[i]]]
    agree = len(rows) - len(mism)
    frac = agree / len(rows)
    outside = [i for i in mism if rhy[i] not in residual]

    print()
    print(f"  G1  nClicks == centroid click count: {agree}/{len(rows)} = {100*frac:.2f}%")
    print(f"      residual class(es) detected: {residual}")
    for k in residual:
        ncs = sorted({int(rows[i]["nClicks"]) for i in range(len(rows)) if rhy[i] == k})
        print(f"        class {k}: {per_class[k][1]} codas, centroid {class_n[k]} clicks, "
              f"members span {min(ncs)}-{max(ncs)} clicks")
    print(f"      mismatches {len(mism)}, outside a residual class: {len(outside)}")
    g1 = frac >= 0.95 and not outside
    print(f"      {'PASS' if g1 else 'FAIL'} — every mismatch falls in a residual bucket")
    if not g1:
        sys.exit("  alignment gate failed — labels not written")

    # --- G2: data traps ------------------------------------------------------
    zero = [i for i, r in enumerate(rows) if float(r["Duration"]) == 0.0]
    zero_1click = [i for i in zero if int(rows[i]["nClicks"]) == 1]
    print()
    print(f"  G2  codas with Duration == 0: {len(zero)}, of which "
          f"{len(zero_1click)} have nClicks == 1")
    print("      a single click has no inter-click interval, so it has no rhythm and")
    print("      cannot enter a duration sequence — excluded downstream, not silently")

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUT, "w") as f:
        json.dump({
            "source": "github.com/pratyushasharma/sw-combinatoriality (no LICENSE file)",
            "alignedTo": "sperm-whale-dialogues.csv, row order",
            "validation": {"g1Agreement": frac, "mismatches": len(mism),
                           "residualClasses": residual,
                           "mismatchesOutsideResidual": len(outside), "pass": g1},
            "traps": {"zeroDuration": zero, "zeroDurationSingleClick": zero_1click},
            "classClickCounts": class_n,
            "ornaments": [int(v) for v in orn],
            "rhythms": [int(v) for v in rhy],
            "meanCodas": [[float(x) for x in a] for a in mc],
        }, f)
    print()
    print(f"  written {OUT}")


if __name__ == "__main__":
    main()
