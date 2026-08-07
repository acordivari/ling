#!/usr/bin/env python3
"""Recover the measurement grid behind the sperm whale coda-vowel claim.

    python3 tools/exp07_vowel_grid.py

Beguš et al. (Proc R Soc B 293:20252994, 15 Apr 2026) report that sperm whale
codas carry vowel-like spectral structure, an a/i distinction. Luke Rendell's
published objection is that a single click is a rapid succession of pulses whose
ripples resemble the reported pattern -- i.e. that the "formants" are click
structure, not phonology. That objection is unrebutted in the literature; the
authors' stated reply (same pattern on other labs' equipment) is unpublished.

Separately, Diamant, Gruber, Gero & Begus (Ecological Informatics, June 2026)
show the vowel measure responds to ambient ship noise -- the authors' own
evidence that external acoustic conditions move the classification.

This tool asks a narrower question that needs no audio and no join: **at what
resolution is the vowel-discriminating variable actually measured?**

It reads the authors' own deposit (github.com/Project-CETI/coda-vowel-phonology,
mirrored at OSF 9t6qu) and recovers the quantisation of the four spectral peak
columns. The finding is arithmetic, not statistical -- there is no null model
here because none is needed for an exact integer relation.

Nothing is redistributed; the CSV is fetched on demand into a gitignored path.
"""

import csv
import os
import re
import ssl
import subprocess
import sys
import urllib.error
import urllib.request
from collections import Counter

RAW = ("https://raw.githubusercontent.com/Project-CETI/"
       "coda-vowel-phonology/main/codasp.csv")
HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "..", "data", "vowel")
CSV_PATH = os.path.join(DATA_DIR, "codasp.csv")

SPECTRAL_COLS = ["meandist_pk1", "meandist_pk2", "meandiff_pk1", "meandiff_pk2"]

try:
    import certifi
    _SSL = ssl.create_default_context(cafile=certifi.where())
except Exception:  # noqa: BLE001
    _SSL = None


def fetch():
    os.makedirs(DATA_DIR, exist_ok=True)
    if os.path.exists(CSV_PATH):
        print(f"  cached   {CSV_PATH} ({os.path.getsize(CSV_PATH):,} bytes)")
        return
    print(f"  fetching {RAW}")
    try:
        req = urllib.request.Request(RAW, headers={"User-Agent": "ling-exp07/1.0"})
        with urllib.request.urlopen(req, timeout=60, context=_SSL) as r:
            body = r.read()
        with open(CSV_PATH, "wb") as f:
            f.write(body)
    except (urllib.error.URLError, OSError) as e:
        try:
            subprocess.run(["curl", "-sSL", "--fail", "-o", CSV_PATH, RAW],
                           check=True, timeout=60)
        except (subprocess.SubprocessError, OSError):
            sys.exit(f"  fetch failed ({e}); download {RAW} to {CSV_PATH} manually")
    print(f"  saved    {CSV_PATH} ({os.path.getsize(CSV_PATH):,} bytes)")


def n_clicks(codatype):
    """Click count implied by the coda-type label. '1+1+3' -> 5, '9i' -> 9."""
    ct = (codatype or "").strip()
    if "+" in ct:
        try:
            return sum(int(x) for x in ct.split("+"))
        except ValueError:
            return None
    m = re.match(r"^(\d+)", ct)
    return int(m.group(1)) if m else None


def main():
    print("EXPERIMENT 07 — the measurement grid behind the coda-vowel claim")
    print("=" * 74)
    fetch()
    rows = list(csv.DictReader(open(CSV_PATH, encoding="utf-8-sig")))
    print(f"  rows     {len(rows):,}   columns {len(rows[0])}")
    print()

    # --- recover the quantum -------------------------------------------------
    # The four spectral columns take values that are NOT all multiples of a
    # single constant, which is what a first pass suggests. They are means over
    # a coda's clicks of a per-click value that IS. So the test is: does
    # value * d / BIN land on an integer for some integer d <= nClicks?
    BIN = 58.59375
    total = exact = 0
    dens = Counter()
    for r in rows:
        n = n_clicks(r.get("codatype"))
        if not n:
            continue
        for c in SPECTRAL_COLS:
            v = r.get(c, "")
            if v in ("", "NA"):
                continue
            total += 1
            x = float(v)
            for d in range(1, n + 1):
                if abs(x * d / BIN - round(x * d / BIN)) < 1e-6:
                    exact += 1
                    dens[d] += 1
                    break

    print(f"  Hypothesis: every spectral value is a mean over detected peaks of a")
    print(f"  per-click quantity that is an integer multiple of {BIN} Hz.")
    print()
    print(f"    exact integer at some denominator d <= nClicks: "
          f"{exact:,} of {total:,} = {100 * exact / total:.2f}%")
    print(f"    denominators used: " +
          "  ".join(f"d={k}:{v}" for k, v in dens.most_common(6)))
    print()
    print(f"  {BIN} Hz as an FFT bin width (sample rate / nFFT):")
    for nfft in (512, 1024, 2048, 4096):
        note = ""
        if abs(BIN * nfft - 120000) < 1:
            note = "   <-- 120 kHz: one of the five rigs in the public DSWP audio"
        print(f"    nFFT {nfft:>5}  ->  {BIN * nfft:>10.1f} Hz{note}")
    print()

    # --- resolution of the distinction the claim rests on --------------------
    print("  Resolution of the a/i distinction, in bins of that grid:")
    print(f"    {'column':<15}{'mean(a)':>10}{'mean(i)':>10}{'diff Hz':>10}"
          f"{'bins':>8}{'n_a':>7}{'n_i':>7}")
    for c in SPECTRAL_COLS:
        a = [float(r[c]) for r in rows
             if r.get("handv") == "a" and r.get(c, "") not in ("", "NA")]
        i = [float(r[c]) for r in rows
             if r.get("handv") == "i" and r.get(c, "") not in ("", "NA")]
        if not a or not i:
            continue
        ma, mi = sum(a) / len(a), sum(i) / len(i)
        print(f"    {c:<15}{ma:>10.1f}{mi:>10.1f}{ma - mi:>+10.1f}"
              f"{(ma - mi) / BIN:>+8.2f}{len(a):>7}{len(i):>7}")

    print()
    print("  Reading: the vowel-discriminating variable is measured on a "
          f"{BIN:.2f} Hz grid,")
    print("  and the a/i separation is one to two bins of it. That bounds the")
    print("  resolution of the distinction; it does not by itself refute it.")
    print()
    print("  The open question this raises: the public DSWP audio carries FIVE")
    print("  sample rates (44.1k, 48k, 96k, 120k). If a fixed nFFT was applied")
    print("  across rates without resampling, the bin width -- and any measured")
    print("  peak distance -- varies by up to 2.7x with recording equipment.")
    print("  Whether resampling occurred cannot be determined from this deposit.")


if __name__ == "__main__":
    main()
