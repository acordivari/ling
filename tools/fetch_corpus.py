#!/usr/bin/env python3
"""Fetch and clean the Sharma et al. sperm whale coda corpus.

    python3 tools/fetch_corpus.py

Downloads to gitignored `data/`, cleans, and writes `explorer/data/coda-corpus.json`
so the browser tool can load real measured codas instead of synthesised stand-ins.

Nothing here is committed. The article (Sharma et al. 2024, Nat Commun 15:3617,
doi:10.1038/s41467-024-47221-8) is CC BY 4.0, but the GitHub data deposit itself
carries no LICENSE file, so this repo fetches on demand and does not redistribute.

Standard library only — no numpy, no pandas. It runs on whatever python3 is
already on the machine.

Every cleaning rule below was derived by measuring the file, not assumed. The
counts in the docstrings are what the current upstream file produces; if they
change, upstream changed, and that is worth noticing rather than silently
absorbing.
"""
import csv
import json
import os
import re
import sys
import subprocess
import urllib.request
from collections import Counter

RAW_URL = ("https://raw.githubusercontent.com/pratyushasharma/"
           "sw-combinatoriality/main/data/DominicaCodas.csv")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
OUT_DIR = os.path.join(ROOT, "explorer", "data")
CSV_PATH = os.path.join(DATA_DIR, "DominicaCodas.csv")
OUT_PATH = os.path.join(OUT_DIR, "coda-corpus.json")

# ICIs are stored as integer 1/SCALE seconds. Millisecond rounding was measured
# to cost up to 1.43 nPVI on short codas; 0.1 ms costs at most 0.09.
SCALE = 10_000

# A sperm whale click is a pulse train whose internal inter-pulse interval is
# 2-10 ms. An "inter-click interval" below that is not a gap between clicks, it
# is inside one. The file contains ICIs of 3e-6 s and 6e-6 s — duplicated click
# timestamps that pass a naive `> 0` filter.
IPI_BAND_MAX_S = 0.010


def npvi(x):
    if len(x) < 2:
        return None
    return 100 * sum(abs(a - b) / ((a + b) / 2)
                     for a, b in zip(x, x[1:])) / (len(x) - 1)


def parse_date(s):
    """Normalise the Date column to an ISO day key, or None.

    An earlier version of this file omitted Date entirely, with the note
    "mixes bare years with DD-MM-YYYY; unsafe to parse". That was measured
    again and is wrong: all 8,719 rows are DD/MM/YYYY or DD-MM-YYYY and none
    is a bare year. Day-first is unambiguous — 3,907 rows have a first field
    above 12 and none has a second field above 12.

    The day key exists because it is the only available stand-in for a social
    unit in corpora that lack unit ids (see tools/cluster_calibration.mjs).
    Here, where Unit IS known, the two can be compared directly.
    """
    s = (s or "").strip().replace("-", "/")
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", s)
    if not m:
        return None
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if not (1 <= d <= 31 and 1 <= mo <= 12):
        return None
    return f"{y:04d}-{mo:02d}-{d:02d}"


def download():
    os.makedirs(DATA_DIR, exist_ok=True)
    if os.path.exists(CSV_PATH):
        print(f"  cached  {CSV_PATH} ({os.path.getsize(CSV_PATH):,} bytes)")
        return
    print(f"  fetching {RAW_URL}")
    body = None
    try:
        with urllib.request.urlopen(RAW_URL, timeout=60) as r:
            body = r.read()
    except Exception as e:
        # A stock macOS python3 often has no CA bundle wired up, so urllib fails
        # with CERTIFICATE_VERIFY_FAILED while curl — which uses the system trust
        # store — works fine. Falling back is more useful than telling the user
        # to go install certifi. See INSTALL.md on the LibreSSL conflict.
        print(f"  urllib failed ({type(e).__name__}); falling back to curl")
        try:
            body = subprocess.run(
                ["curl", "-sSL", "--fail", RAW_URL],
                check=True, capture_output=True, timeout=120).stdout
        except Exception as e2:
            sys.exit(f"  download failed: {e2}\n"
                     f"  fetch it manually into {CSV_PATH}\n"
                     f"  from {RAW_URL}")
    if not body or len(body) < 1000:
        sys.exit(f"  download returned {len(body or b'')} bytes — that is not the corpus")
    with open(CSV_PATH, "wb") as f:
        f.write(body)
    print(f"  saved    {CSV_PATH} ({len(body):,} bytes)")


def clean(rows):
    """Apply the measured cleaning rules. Returns (codas, dropped counter)."""
    codas, dropped = [], Counter()
    for r in rows:
        ct = r["CodaType"]
        # 600 rows across 10 variants (1-NOISE .. 10-NOISE) are noise annotations.
        if "NOISE" in ct:
            dropped["noise_type"] += 1
            continue
        try:
            n = int(r["nClicks"])
            dur = float(r["Duration"])
        except (ValueError, KeyError):
            dropped["unparseable"] += 1
            continue
        if n < 3:
            dropped["nclicks_lt_3"] += 1
            continue
        if dur <= 0:
            dropped["duration_le_0"] += 1
            continue
        try:
            icis = [float(r[f"ICI{i}"]) for i in range(1, 10)][: n - 1]
        except (ValueError, KeyError):
            dropped["unparseable_ici"] += 1
            continue
        if len(icis) != n - 1 or any(v <= 0 for v in icis):
            dropped["nonpositive_ici"] += 1
            continue
        if min(icis) < IPI_BAND_MAX_S:
            dropped["ici_inside_ipi_band"] += 1
            continue
        if abs(sum(icis) - dur) > 0.01:
            dropped["ici_sum_vs_duration"] += 1
            continue
        codas.append({"icis": icis, "type": ct, "clan": r["Clan"],
                      "unit": r["Unit"], "idn": r["IDN"],
                      "date": parse_date(r.get("Date"))})
    return codas, dropped


def main():
    print("Sharma et al. sperm whale coda corpus")
    download()

    with open(CSV_PATH, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    codas, dropped = clean(rows)
    if not codas:
        sys.exit("  no codas survived cleaning — the upstream format may have changed")

    types = sorted({c["type"] for c in codas})
    clans = sorted({c["clan"] for c in codas})
    units = sorted({c["unit"] for c in codas})
    dates = sorted({c["date"] for c in codas if c["date"]})
    ti = {t: i for i, t in enumerate(types)}
    ci = {t: i for i, t in enumerate(clans)}
    ui = {t: i for i, t in enumerate(units)}
    di = {t: i for i, t in enumerate(dates)}

    # Measure the quantisation cost rather than trusting it.
    worst = 0.0
    for c in codas:
        if len(c["icis"]) < 2:
            continue
        q = [round(v * SCALE) / SCALE for v in c["icis"]]
        a, b = npvi(c["icis"]), npvi(q)
        if a is not None and b is not None:
            worst = max(worst, abs(a - b))
    if worst > 0.5:
        sys.exit(f"  quantisation error {worst:.3f} nPVI is too high; raise SCALE")

    # An IDN is only usable as an individual when it is an unambiguous number.
    # '0' means unidentified (5705 rows), and '6070/6068', '5981/5978', '59871?'
    # mean the annotator could not decide.
    def certain(v):
        return v.isdigit() and v != "0"

    payload = {
        "schema": 1,
        "source": {
            "dataset": "DominicaCodas.csv",
            "origin": "https://github.com/pratyushasharma/sw-combinatoriality",
            "paper": "Sharma et al. 2024, Nat Commun 15:3617, doi:10.1038/s41467-024-47221-8",
            "zenodo": "10.5281/zenodo.10817697",
            "licence_note": (
                "Article is CC BY 4.0. The data deposit carries no LICENSE file, so "
                "this repo fetches on demand into gitignored data/ and does not "
                "redistribute it."),
            "provenance_tier": "measured",
        },
        "cleaning": {
            "rules": [
                "CodaType must not contain 'NOISE'",
                "nClicks >= 3",
                "Duration > 0",
                "every ICI > 0",
                f"min(ICI) >= {IPI_BAND_MAX_S}s (below this is inside the intra-click IPI band)",
                "|sum(ICI) - Duration| <= 0.01s",
            ],
            "input_rows": len(rows),
            "kept": len(codas),
            "dropped": dict(dropped),
        },
        "caveats": {
            "idn_0_means_unidentified": True,
            "idn_ambiguous_examples": ["6070/6068", "5981/5978", "59871?"],
            "codas_with_certain_individual": sum(1 for c in codas if certain(c["idn"])),
            "unit_ZZZ_is_unknown_sentinel": True,
            "date_column": (
                "Parsed to an ISO day key. A previous version of this tool "
                "omitted it as 'mixes bare years with DD-MM-YYYY; unsafe to "
                "parse'. Re-measured: all 8,719 rows are DD/MM/YYYY or "
                "DD-MM-YYYY, none is a bare year, and day-first is unambiguous "
                "(3,907 rows have a first field > 12, none has a second > 12)."),
            "codas_with_unparseable_date": sum(1 for c in codas if not c["date"]),
            "recording_day_is_not_a_social_unit": (
                "Both are present here, which is why this corpus can calibrate "
                "the day-for-unit substitution that corpora without unit ids "
                "are forced into. See tools/cluster_calibration.mjs."),
            "single_clan_caveat": (
                "EC1 and EC2 only, off Dominica. Nothing here generalises to other "
                "sperm whale populations."),
        },
        "ici_units": f"integer 1/{SCALE} s",
        "quantisation_worst_npvi_error": round(worst, 4),
        "types": types, "clans": clans, "units": units, "dates": dates,
        "codaType": [ti[c["type"]] for c in codas],
        "clan": [ci[c["clan"]] for c in codas],
        "unit": [ui[c["unit"]] for c in codas],
        "date": [di[c["date"]] if c["date"] else -1 for c in codas],
        "idn": [c["idn"] for c in codas],
        "idnCertain": [1 if certain(c["idn"]) else 0 for c in codas],
        "ici": [[int(round(v * SCALE)) for v in c["icis"]] for c in codas],
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(payload, f, separators=(",", ":"))

    size = os.path.getsize(OUT_PATH)
    five = [c for c in codas if len(c["icis"]) == 4]
    mean5 = sum(npvi(c["icis"]) for c in five) / len(five)
    print(f"  cleaned  {len(rows):,} rows -> {len(codas):,} codas")
    print(f"  dropped  {dict(dropped)}")
    print(f"  wrote    {OUT_PATH} ({size / 1024:.0f} KB)")
    print(f"  check    {len(five):,} five-click codas, mean nPVI {mean5:.4f}")
    print(f"  quantisation worst-case nPVI error {worst:.4f}")
    print("\n  data/ and explorer/data/ are gitignored. Nothing was committed.")


if __name__ == "__main__":
    main()
