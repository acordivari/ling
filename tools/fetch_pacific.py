#!/usr/bin/env python3
"""Fetch and clean the Hersh et al. 2022 Pacific sperm whale coda corpus.

    python3 tools/fetch_pacific.py

Downloads to gitignored `data/`, cleans, and writes
`explorer/data/pacific-corpus.json`.

Why this corpus exists in this repo: experiment 01 concluded that the
within-type clan-rhythm question is *not determinable* from the Dominica
corpus, because EC1 and EC2 barely use the same coda types — only ~33 codas
of leverage out of 6,038. Its closing line was that answering it needs "a
corpus with real overlap in repertoire, or more social units, not more codas".

This is that corpus: 7 clans, 191 repertoires, 23 Pacific regions, 1978-2017.

Nothing here is committed. The article (Hersh et al. 2022, PNAS
119:e2201692119, doi:10.1073/pnas.2201692119) is CC BY-NC-ND 4.0 and the OSF
node declares NO licence, so this repo fetches on demand and does not
redistribute — the same posture as the Sharma deposit in fetch_corpus.py.

Standard library only. Runs on whatever python3 is already on the machine.

The output is deliberately in the SAME packed shape as coda-corpus.json, with
the repertoire id occupying the `unit` slot, so that the shipped
`decodeCorpus` in explorer/js/claims.js reads it with no changes. The
repertoire is the correct permutation cluster here for exactly the reason the
social unit is in the Dominica corpus: clan is a property of the repertoire,
not of an individual coda.

Cleaning rules mirror fetch_corpus.py so the two corpora remain comparable. A
rule applied to one and not the other would silently make any cross-corpus
statement an artifact of cleaning.
"""
import csv
import json
import os
import subprocess
import sys
import urllib.request
from collections import Counter, defaultdict

# OSF node ae6pd, folder RawCodaInterClickIntervals.
CSV_URL = "https://osf.io/download/9hwmj/"
README_URL = "https://osf.io/download/2jhd4/"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data", "pacific")
OUT_DIR = os.path.join(ROOT, "explorer", "data")
CSV_PATH = os.path.join(DATA_DIR, "pacific_coda_data.csv")
README_PATH = os.path.join(DATA_DIR, "README_pacific_coda_data.txt")
OUT_PATH = os.path.join(OUT_DIR, "pacific-corpus.json")

# Identical to fetch_corpus.py. ICIs are stored as integer 1/SCALE seconds.
SCALE = 10_000

# Identical to fetch_corpus.py. A sperm whale click is a pulse train whose
# internal inter-pulse interval is 2-10 ms; an "inter-click interval" below
# that is inside one click, not between two. The Sharma deposit contained ICIs
# of 3e-6 s. This file contains 47 below 10 ms, the smallest 1.542 ms.
IPI_BAND_MAX_S = 0.010

# The deposit's own README documents a duration-column repair (Nov 2022): the
# published `duration` is now defined as the sum of the ICIs. We still check,
# because "documented as fixed" and "fixed" are different claims.
DURATION_TOL_S = 0.01

CLAN_NAMES = {
    "FP": "Four-Plus", "PALI": "Palindrome", "PO": "Plus-One",
    "REG": "Regular", "RI": "Rapid Increasing", "SH": "Short",
    "SI": "Slow Increasing",
}
MISSING = {"#N/A", "NA", "", "NaN"}


def npvi(x):
    if len(x) < 2:
        return None
    return 100 * sum(abs(a - b) / ((a + b) / 2)
                     for a, b in zip(x, x[1:])) / (len(x) - 1)


def fetch(url, path, label):
    if os.path.exists(path):
        print(f"  cached   {path} ({os.path.getsize(path):,} bytes)")
        return
    print(f"  fetching {label} <- {url}")
    body = None
    try:
        with urllib.request.urlopen(url, timeout=120) as r:
            body = r.read()
    except Exception as e:
        # Same fallback as fetch_corpus.py: stock macOS python3 often has no CA
        # bundle wired up while curl uses the system trust store.
        print(f"  urllib failed ({type(e).__name__}); falling back to curl")
        try:
            body = subprocess.run(["curl", "-sSL", "--fail", url],
                                  check=True, capture_output=True,
                                  timeout=300).stdout
        except Exception as e2:
            sys.exit(f"  download failed: {e2}\n  fetch manually into {path}\n"
                     f"  from {url}")
    if not body or len(body) < 500:
        sys.exit(f"  download returned {len(body or b'')} bytes — not the corpus")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(body)
    print(f"  saved    {path} ({len(body):,} bytes)")


def parse_icis(row, n):
    """ICI1..ICI30, truncated at the first missing/non-positive value."""
    out = []
    for i in range(1, 31):
        s = (row.get(f"ICI{i}") or "").strip()
        if s in MISSING:
            break
        try:
            v = float(s)
        except ValueError:
            break
        if v <= 0:
            break
        out.append(v)
    return out


def clean(rows):
    codas, dropped = [], Counter()
    for r in rows:
        clan = (r.get("clan_name") or "").strip()
        ctype = (r.get("coda_type") or "").strip()
        # #N/A clan = repertoire not assigned to a clan by the IDcall
        # clustering. #N/A type = coda had 2 clicks or >10. Both are the
        # deposit's own sentinels, and both make the coda unusable for a
        # within-type between-clan contrast.
        if clan in MISSING:
            dropped["no_clan"] += 1
            continue
        if ctype in MISSING:
            dropped["no_coda_type"] += 1
            continue
        try:
            n = int(r["nclicks"])
            dur = float(r["duration"])
        except (ValueError, KeyError, TypeError):
            dropped["unparseable"] += 1
            continue
        if n < 3:
            dropped["nclicks_lt_3"] += 1
            continue
        if dur <= 0:
            dropped["duration_le_0"] += 1
            continue
        icis = parse_icis(r, n)
        if len(icis) != n - 1:
            dropped["ici_count_ne_nclicks_minus_1"] += 1
            continue
        if min(icis) < IPI_BAND_MAX_S:
            dropped["ici_inside_ipi_band"] += 1
            continue
        if abs(sum(icis) - dur) > DURATION_TOL_S:
            dropped["ici_sum_vs_duration"] += 1
            continue
        codas.append({
            "icis": icis, "type": ctype, "clan": clan,
            "rep": (r.get("grpvar") or "").strip(),
            "loc": (r.get("loc") or "").strip(),
            "year": (r.get("year") or "").strip(),
            "lat": (r.get("latitude") or "").strip(),
            "lon": (r.get("longitude") or "").strip(),
        })
    return codas, dropped


def derive_traps(rows, codas):
    """Traps derived from the file, not hardcoded from what someone noticed."""
    traps = {}

    raw_icis = []
    for r in rows:
        try:
            n = int(r["nclicks"])
        except (ValueError, KeyError, TypeError):
            continue
        raw_icis.extend(parse_icis(r, n))
    sub = sorted(v for v in raw_icis if v < IPI_BAND_MAX_S)
    traps["sub_ipi_band_icis"] = {
        "count": len(sub),
        "min_s": round(min(sub), 6) if sub else None,
        "note": ("ICIs below the 2-10 ms intra-click IPI band. Same trap class "
                 "as the Sharma deposit's 3e-6 s values. Dropped."),
    }

    # Is clan a property of the repertoire? Experiment 01 found every Dominica
    # social unit was single-clan, which is what forces cluster permutation.
    rep_clans = defaultdict(set)
    for c in codas:
        rep_clans[c["rep"]].add(c["clan"])
    multi = [k for k, v in rep_clans.items() if len(v) > 1]
    traps["repertoires_spanning_multiple_clans"] = {
        "count": len(multi),
        "of": len(rep_clans),
        "note": ("0 means clan is perfectly nested within repertoire, so clan "
                 "labels must be permuted across whole repertoires. Permuting "
                 "across codas would pseudoreplicate exactly as experiment 01 "
                 "did with social units."),
    }

    # Clans were DEFINED by clustering repertoires on coda-type usage (IDcall).
    # So a between-clan difference in coda-type usage is circular. Record how
    # much type-sharing exists, since that is what the non-circular
    # within-type test actually runs on.
    tc = defaultdict(set)
    for c in codas:
        tc[c["type"]].add(c["clan"])
    traps["circularity"] = {
        "coda_types": len(tc),
        "types_shared_by_2plus_clans": sum(1 for v in tc.values() if len(v) >= 2),
        "note": ("Clans are DEFINED by repertoire coda-type usage (IDcall "
                 "clustering, Hersh et al. 2022). 'Clans differ in which codas "
                 "they use' is therefore true by construction and is not a "
                 "testable claim. Only within-type timing is non-circular."),
    }

    # The deposit's own documented repair.
    bad_dur = 0
    for r in rows:
        try:
            n = int(r["nclicks"])
            dur = float(r["duration"])
        except (ValueError, KeyError, TypeError):
            continue
        icis = parse_icis(r, n)
        if len(icis) == n - 1 and abs(sum(icis) - dur) > DURATION_TOL_S:
            bad_dur += 1
    traps["duration_vs_ici_sum_mismatches"] = {
        "count": bad_dur,
        "tolerance_s": DURATION_TOL_S,
        "note": ("The deposit README documents a Nov 2022 repair making "
                 "duration == sum(ICI). Verified here rather than assumed."),
    }

    unassigned = sum(1 for r in rows
                     if (r.get("clan_name") or "").strip() in MISSING)
    traps["codas_with_no_clan"] = {
        "count": unassigned,
        "note": "Repertoires the IDcall clustering did not assign to a clan.",
    }
    return traps


def main():
    print("Hersh et al. 2022 Pacific sperm whale coda corpus")
    fetch(CSV_URL, CSV_PATH, "pacific_coda_data.csv")
    fetch(README_URL, README_PATH, "README")

    with open(CSV_PATH, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    codas, dropped = clean(rows)
    if not codas:
        sys.exit("  no codas survived cleaning — upstream format may have changed")

    traps = derive_traps(rows, codas)

    types = sorted({c["type"] for c in codas})
    clans = sorted({c["clan"] for c in codas})
    reps = sorted({c["rep"] for c in codas})
    locs = sorted({c["loc"] for c in codas})
    ti = {t: i for i, t in enumerate(types)}
    ci = {t: i for i, t in enumerate(clans)}
    ri = {t: i for i, t in enumerate(reps)}
    li = {t: i for i, t in enumerate(locs)}

    worst = 0.0
    for c in codas:
        if len(c["icis"]) < 2:
            continue
        q = [round(v * SCALE) / SCALE for v in c["icis"]]
        a, b = npvi(c["icis"]), npvi(q)
        if a is not None and b is not None:
            worst = max(worst, abs(a - b))
    if worst > 0.5:
        sys.exit(f"  quantisation error {worst:.3f} nPVI too high; raise SCALE")

    payload = {
        "schema": 1,
        "source": {
            "dataset": "pacific_coda_data.csv",
            "origin": "https://osf.io/ae6pd/",
            "paper": ("Hersh et al. 2022, PNAS 119:e2201692119, "
                      "doi:10.1073/pnas.2201692119"),
            "licence_note": (
                "Article is CC BY-NC-ND 4.0. The OSF node declares NO licence, "
                "so this repo fetches on demand into gitignored data/ and does "
                "not redistribute it. Same posture as the Sharma deposit."),
            "provenance_tier": "measured",
            "basin": "Pacific Ocean, 23 regions",
        },
        "cleaning": {
            "rules": [
                "clan_name assigned (not #N/A)",
                "coda_type assigned (not #N/A)",
                "nclicks >= 3",
                "duration > 0",
                "every ICI > 0 and ICI count == nclicks - 1",
                f"min(ICI) >= {IPI_BAND_MAX_S}s (below this is intra-click IPI)",
                f"|sum(ICI) - duration| <= {DURATION_TOL_S}s",
            ],
            "mirrors": ("tools/fetch_corpus.py — identical thresholds, so the "
                        "Dominica and Pacific corpora stay comparable"),
            "input_rows": len(rows),
            "kept": len(codas),
            "dropped": dict(dropped),
        },
        "traps": traps,
        "caveats": {
            "clan_is_a_property_of_the_repertoire": True,
            "permutation_cluster": "unit (= repertoire / grpvar)",
            "repertoire_is_a_recording_day_not_a_social_unit": (
                "grpvar identifies a repertoire, which Hersh et al. define as one "
                "recording day with >=25 codas. It is NOT a social unit. The same "
                "unit may contribute several repertoires, and no social-unit or "
                "individual ids exist in this deposit, so repertoire-level "
                "permutation may still under-control non-independence."),
            "no_individual_ids": True,
            "clan_definition_is_circular_for_type_usage": True,
        },
        "ici_units": f"integer 1/{SCALE} s",
        "quantisation_worst_npvi_error": round(worst, 4),
        "clan_full_names": CLAN_NAMES,
        # Keys below match coda-corpus.json exactly so the shipped
        # decodeCorpus() in explorer/js/claims.js reads this with no changes.
        "types": types, "clans": clans, "units": reps,
        "codaType": [ti[c["type"]] for c in codas],
        "clan": [ci[c["clan"]] for c in codas],
        "unit": [ri[c["rep"]] for c in codas],
        "idn": ["0"] * len(codas),
        "idnCertain": [0] * len(codas),
        "ici": [[int(round(v * SCALE)) for v in c["icis"]] for c in codas],
        # Pacific-only extras. decodeCorpus ignores unknown keys.
        "locs": locs,
        "loc": [li[c["loc"]] for c in codas],
        "year": [c["year"] for c in codas],
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(payload, f, separators=(",", ":"))

    five = [c for c in codas if len(c["icis"]) == 4]
    mean5 = sum(npvi(c["icis"]) for c in five) / len(five)
    print(f"\n  cleaned  {len(rows):,} rows -> {len(codas):,} codas")
    print(f"  dropped  {dict(dropped)}")
    print(f"  wrote    {OUT_PATH} ({os.path.getsize(OUT_PATH) / 1024:.0f} KB)")
    print(f"  scale    {len(clans)} clans, {len(reps)} repertoires, "
          f"{len(types)} coda types, {len(locs)} regions")
    print(f"  check    {len(five):,} five-click codas, mean nPVI {mean5:.4f}")
    print(f"  quantisation worst-case nPVI error {worst:.4f}")
    print("\n  traps derived from the file:")
    for k, v in traps.items():
        n = v.get("count")
        extra = f" of {v['of']}" if "of" in v else ""
        print(f"    {k}: {n}{extra}")
    print("\n  data/ and explorer/data/ are gitignored. Nothing was committed.")


if __name__ == "__main__":
    main()
