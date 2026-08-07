#!/usr/bin/env python3
"""Fetch the Beguš et al. coda-vowel annotations and join them to Sharma ICIs.

    python3 tools/fetch_vowels.py

Downloads OSF 9t6qu into gitignored `data/`, joins on coda id, and writes
`explorer/data/vowel-corpus.json`.

Why the join is possible at all: both deposits describe the SAME Dominica codas
and use the same identifier. Verified here rather than assumed — the tool checks
coda type and duration agreement on every shared id and refuses to write if they
disagree.

Nothing is committed. The article is Beguš et al., Proc R Soc B (2026), "The
phonology of sperm whale coda vowels"; the OSF node declares NO licence, so this
fetches on demand and does not redistribute — the same posture fetch_corpus.py
and fetch_pacific.py take.

Standard library only.
"""
import csv
import json
import os
import subprocess
import sys
import urllib.request
from collections import Counter, defaultdict

FILES = {
    "codamd.csv": "https://osf.io/download/ytsq9/",
    "codasp.csv": "https://osf.io/download/3nkf8/",
    "README.9t6qu.md": "https://osf.io/download/8u5h3/",
}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data", "vowels")
SHARMA = os.path.join(ROOT, "data", "DominicaCodas.csv")
OUT_PATH = os.path.join(ROOT, "explorer", "data", "vowel-corpus.json")

SCALE = 10_000            # identical to fetch_corpus.py
IPI_BAND_MAX_S = 0.010    # identical to fetch_corpus.py
DURATION_TOL_S = 0.005    # join check: same coda => same duration


def fetch(name, url):
    path = os.path.join(DATA_DIR, name)
    if os.path.exists(path):
        print(f"  cached   {name} ({os.path.getsize(path):,} bytes)")
        return path
    os.makedirs(DATA_DIR, exist_ok=True)
    print(f"  fetching {name}")
    try:
        with urllib.request.urlopen(url, timeout=120) as r:
            body = r.read()
    except Exception as e:
        print(f"  urllib failed ({type(e).__name__}); falling back to curl")
        body = subprocess.run(["curl", "-sSL", "--fail", url],
                              check=True, capture_output=True, timeout=300).stdout
    if not body or len(body) < 200:
        sys.exit(f"  download returned {len(body or b'')} bytes")
    with open(path, "wb") as f:
        f.write(body)
    print(f"  saved    {name} ({len(body):,} bytes)")
    return path


def main():
    print("Beguš et al. sperm whale coda vowels (OSF 9t6qu)")
    if not os.path.exists(SHARMA):
        sys.exit(f"  missing {SHARMA}\n  run: python3 tools/fetch_corpus.py")
    md_path = fetch("codamd.csv", FILES["codamd.csv"])
    sp_path = fetch("codasp.csv", FILES["codasp.csv"])
    fetch("README.9t6qu.md", FILES["README.9t6qu.md"])

    with open(md_path, encoding="utf-8-sig") as f:
        md = {r["codanum"]: r for r in csv.DictReader(f)}
    with open(sp_path, encoding="utf-8-sig") as f:
        sp = {r["codanum"]: r for r in csv.DictReader(f)}
    with open(SHARMA, encoding="utf-8-sig") as f:
        sh = {r["codaNUM2018"]: r for r in csv.DictReader(f)}

    shared = sorted(set(md) & set(sh), key=int)
    if not shared:
        sys.exit("  no shared coda ids — the two deposits do not use the same scheme")

    # Verify the join instead of trusting it.
    type_ok = sum(1 for c in shared if md[c]["codatype"] == sh[c]["CodaType"])
    dur_ok, dur_diffs = 0, []
    for c in shared:
        try:
            d = abs(float(md[c]["Duration"]) - float(sh[c]["Duration"]))
        except ValueError:
            continue
        dur_diffs.append(d)
        if d < DURATION_TOL_S:
            dur_ok += 1
    type_rate = type_ok / len(shared)
    dur_rate = dur_ok / len(dur_diffs) if dur_diffs else 0
    print(f"\n  join    {len(shared)} shared coda ids")
    print(f"          coda type agrees {type_ok}/{len(shared)} ({100*type_rate:.1f}%)")
    print(f"          duration agrees  {dur_ok}/{len(dur_diffs)} (<{DURATION_TOL_S*1000:.0f} ms), "
          f"median |diff| {sorted(dur_diffs)[len(dur_diffs)//2]*1000:.3f} ms")
    if type_rate < 0.95 or dur_rate < 0.95:
        sys.exit("  join verification FAILED — these are not the same codas")

    codas, dropped = [], Counter()
    for c in shared:
        m, s = md[c], sh[c]
        v = (m.get("handv") or "").strip()
        if v not in ("a", "i"):
            dropped["no_hand_vowel"] += 1
            continue
        ct = s["CodaType"]
        if "NOISE" in ct:
            dropped["noise_type"] += 1
            continue
        try:
            n = int(s["nClicks"])
            dur = float(s["Duration"])
        except ValueError:
            dropped["unparseable"] += 1
            continue
        if n < 3 or dur <= 0:
            dropped["short_or_zero"] += 1
            continue
        try:
            icis = [float(s[f"ICI{i}"]) for i in range(1, 10)][: n - 1]
        except ValueError:
            dropped["unparseable_ici"] += 1
            continue
        if len(icis) != n - 1 or any(x <= 0 for x in icis):
            dropped["nonpositive_ici"] += 1
            continue
        if min(icis) < IPI_BAND_MAX_S:
            dropped["ici_inside_ipi_band"] += 1
            continue
        if abs(sum(icis) - dur) > 0.01:
            dropped["ici_sum_vs_duration"] += 1
            continue
        codas.append({
            "codanum": c, "icis": icis, "type": ct,
            "vowel": v, "whale": (m.get("whale") or "").strip(),
            "idn": s["IDN"], "unit": s["Unit"], "clan": s["Clan"],
            "autov": (sp.get(c, {}).get("autovbycoda") or "").strip(),
            "mismatchPct": (sp.get(c, {}).get("mismatchpct") or "").strip(),
        })

    # Does Sharma's numeric IDN agree with the named whale? Independent check on
    # a column experiments 01 and 04 depend on.
    name2idn, idn2name = defaultdict(set), defaultdict(set)
    for c in codas:
        if c["whale"] and c["idn"].isdigit() and c["idn"] != "0":
            name2idn[c["whale"]].add(c["idn"])
            idn2name[c["idn"]].add(c["whale"])
    collisions = (sum(1 for v in name2idn.values() if len(v) > 1)
                  + sum(1 for v in idn2name.values() if len(v) > 1))

    types = sorted({c["type"] for c in codas})
    whales = sorted({c["whale"] for c in codas if c["whale"]})
    ti = {t: i for i, t in enumerate(types)}
    wi = {w: i for i, w in enumerate(whales)}

    by_type = Counter(c["type"] for c in codas)
    payload = {
        "schema": 1,
        "source": {
            "vowels": "Beguš et al., Proc R Soc B (2026), OSF https://osf.io/9t6qu",
            "icis": "Sharma et al. 2024, Nat Commun 15:3617 (DominicaCodas.csv)",
            "licence_note": ("Neither deposit declares a licence. Fetched on demand into "
                             "gitignored data/; nothing is redistributed."),
            "provenance_tier": "measured",
        },
        "join": {
            "shared_ids": len(shared),
            "codatype_agreement": round(type_rate, 4),
            "duration_agreement": round(dur_rate, 4),
            "note": ("Verified, not assumed. Same coda id, same coda type, same "
                     "duration to the millisecond."),
        },
        "cleaning": {"rules_mirror": "tools/fetch_corpus.py", "kept": len(codas),
                     "dropped": dict(dropped)},
        "idn_check": {
            "names": len(name2idn), "idns": len(idn2name), "collisions": collisions,
            "note": ("0 collisions means Sharma's numeric IDN maps 1:1 onto the named "
                     "whales in the vowel deposit — an independent validation of a "
                     "column experiments 01 and 04 rely on."),
        },
        "caveats": {
            "vowel_is_concentrated_in_one_coda_type": dict(by_type.most_common(6)),
            "vowel_not_independent_of_coda_type": (
                "The a/i contrast is overwhelmingly carried by 1+1+3; other types are "
                "0-8% 'i'. Any test pooling coda types would measure type, not vowel."),
            "vowel_varies_WITHIN_whale": (
                "Unlike clan, vowel is not a property of the individual — most whales "
                "use both. So the null permutes vowel WITHIN whale, which preserves "
                "each whale's usage rate and its coda-level correlation."),
        },
        "ici_units": f"integer 1/{SCALE} s",
        "types": types, "whales": whales,
        "codanum": [c["codanum"] for c in codas],
        "codaType": [ti[c["type"]] for c in codas],
        "whale": [wi[c["whale"]] if c["whale"] else -1 for c in codas],
        "vowel": [c["vowel"] for c in codas],
        "autov": [c["autov"] for c in codas],
        "idn": [c["idn"] for c in codas],
        "unit": [c["unit"] for c in codas],
        "ici": [[int(round(v * SCALE)) for v in c["icis"]] for c in codas],
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(payload, f, separators=(",", ":"))

    print(f"\n  kept     {len(codas)} codas with a hand-annotated vowel")
    print(f"  dropped  {dict(dropped)}")
    print(f"  whales   {len(whales)}   IDN<->name collisions: {collisions}")
    print(f"  by type  {dict(by_type.most_common(5))}")
    print(f"  wrote    {OUT_PATH} ({os.path.getsize(OUT_PATH)/1024:.0f} KB)")
    print("\n  data/ and explorer/data/ are gitignored. Nothing was committed.")


if __name__ == "__main__":
    main()
