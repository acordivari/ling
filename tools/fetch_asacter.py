#!/usr/bin/env python3
"""Fetch the ASACTER sperm whale corpus — a SECOND population, and real audio.

    python3 tools/fetch_asacter.py                # index only (no audio)
    python3 tools/fetch_asacter.py --no-probe     # skip the WAV header probe
    python3 tools/fetch_asacter.py --audio coda   # + the 5 coda-labelled files (~34 MB)
    python3 tools/fetch_asacter.py --audio all    # + every sperm whale file (~2.15 GB)

ASACTER = Acoustic Signature Database for Cetacean in Taiwan Eastern Maritime
Waters, deposited on figshare by the Hualien Formosa Association and Turumoan
Whale Watching. 110 sperm whale records (109 of them audio), 192 kHz.

  Licence: CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/
  Deposit: https://figshare.com/search?q=ASACTER
  Each record carries its own DOI under the 10.6084/m9.figshare.* prefix;
  every DOI is recorded per-record in the index this script writes.

WHY THIS IS HERE, AND WHAT IT IS NOT
------------------------------------
The project's biggest limitation is that every coda it analyses comes from one
population (Dominica, clans EC1/EC2). ASACTER is the Western North Pacific, and
unlike Watkins its licence permits redistribution.

**It is not a second coda corpus, and it cannot answer the clan-timing
question.** From the index alone, no audio required:

  - 110 sperm whale records, but only **5** are labelled "clicks & codas" —
    88 s of audio, all from one voyage (20230709), and one of those 5 is a 5 s
    re-export of the opening of another.
  - There are **no clan, social-unit or individual labels** of any kind.

That is sufficient on its own: experiment 01 concluded the clan-timing question
needs repertoire overlap between labelled clans, and no amount of audio without
labels supplies it.

The remaining 105 records are **labelled, not inspected** — this script fetches
their metadata, not their audio, unless you ask for `--audio all`. Across all
110 records the depositor's free-text labels mention (categories overlap; the
verbatim leading-phrase tally is written to the index as
`sound_pattern_labels`):

   5  codas
  25  burst pulse
  17  whistles, which the annotator attributes to another dolphin species
   1  a "ticking sound"
  67  clicks and water splashing only, across several spellings
   1  no label at all

Burst pulses are social signals, not echolocation, so "the rest is echolocation"
is not a claim this deposit supports, and the 17 whistle records are a
contamination caveat for any cross-basin click comparison. This script makes no
claim about what any unfetched file contains acoustically. Nothing here has
measured them.

What ASACTER IS good for is the check `explorer/README.md` explicitly asks for
and never had: the IPI estimator's thresholds "were set by measuring the
synthetic sources in library.js, not derived from physics and not fitted to real
recordings ... Re-check them against real DSWP audio before relying on any of
this." ASACTER is real, freely licensed, and at 192 kHz.

See experiments/03-ipi-against-real-audio/.

DATA TRAPS, all observed in the deposit
---------------------------------------
  - record 30335251 has a TITLE of `20270727_009_03_SpermWhale` — 2027, a typo
    for 2025. Its `voyage date` field and its filename both read 2025 correctly,
    so grepping voyage_date for 2027 finds nothing; the title is the only place
    the typo lives. Deriving the trap generically — comparing every title's date
    prefix against its voyage_date, rather than hardcoding the one that was
    spotted by eye — turns up **4** such disagreements, including a voyage_date
    of `202307009` (nine digits) on record 28464788. Which field is wrong varies
    per record, so the generated trap reports all three date fields and does not
    guess.
  - a title reading `SperrmWhale`
  - one record (24053322) carries three JPGs and no WAV at all
  - 17 of the 109 WAVs carry no `_Nsec` duration token in the filename, and the
    untokened ones include the LONGEST files in the deposit — so summing those
    tokens understates the corpus by about a third. Duration here is computed
    from each file's own `fmt` chunk instead.
  - two different records (30326683, 30325948) declare the SAME WAV filename
    with identical byte size. Downloads are namespaced per record id so the
    second cannot silently resolve to the first's file.
  - headers are **stereo 32-bit PCM at 192 kHz**, except the five
    `ASACTER_SW_20230709_0N.wav` coda files, which are mono 16-bit. An earlier
    reconnaissance here asserted the opposite from the coda files alone; the
    `--probe` header check exists so this is measured per record rather than
    generalised from whichever files happened to be on disk.
  - the five coda files are hard-clipped (0.60-1.34% of samples at digital full
    scale, and 9.85% for the "with engine sound" file), so absolute levels are
    meaningless and clipping distorts the very multipulse envelope an IPI
    estimator measures.

Standard library only. Falls back to curl because a stock macOS python3 often
has no CA bundle wired up — same trap documented in tools/fetch_corpus.py.
"""
import argparse
import json
import os
import re
import struct
import subprocess
import sys
import urllib.request

SEARCH = "https://api.figshare.com/v2/articles/search"
ARTICLE = "https://api.figshare.com/v2/articles/%s"
PAGE_SIZE = 100
MAX_PAGES = 40

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data", "asacter")
# Written next to the audio, not into explorer/data/: nothing in the explorer
# reads this index, and parking a 250 KB orphan in the browser's asset
# directory implies a consumer that does not exist.
OUT_INDEX = os.path.join(DATA_DIR, "index.json")

LICENCE_URI = "https://creativecommons.org/licenses/by/4.0/"
DEPOSIT_URL = "https://figshare.com/search?q=ASACTER"
CITATION = ("Hualien Formosa Association & Turumoan Whale Watching, "
            "ASACTER: Acoustic Signature Database for Cetacean in Taiwan "
            "Eastern Maritime Waters (figshare, CC BY 4.0, "
            + LICENCE_URI + ")")


def _get(url, body=None):
    """GET or POST JSON, with a curl fallback for missing CA bundles."""
    try:
        if body is None:
            req = urllib.request.Request(url)
        else:
            req = urllib.request.Request(
                url, data=json.dumps(body).encode(),
                headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except Exception:
        cmd = ["curl", "-sS", "--fail", url]
        if body is not None:
            cmd += ["-X", "POST", "-H", "Content-Type: application/json",
                    "-d", json.dumps(body)]
        out = subprocess.run(cmd, check=True, capture_output=True, timeout=120).stdout
        return json.loads(out)


def enumerate_records():
    """Every ASACTER record whose title names a sperm whale.

    Pages until a short batch. A fixed page cap would silently truncate as the
    deposit grows, and the caller cannot tell a truncated list from a complete
    one — so MAX_PAGES exists only as a runaway guard and is fatal if reached.
    """
    seen, recs, page = set(), [], 1
    while True:
        batch = _get(SEARCH, {"search_for": "ASACTER",
                              "page_size": PAGE_SIZE, "page": page})
        if not batch:
            break
        for r in batch:
            if r["id"] not in seen:
                seen.add(r["id"])
                recs.append(r)
        if len(batch) < PAGE_SIZE:
            break
        page += 1
        if page > MAX_PAGES:
            sys.exit(f"  pagination guard hit at {MAX_PAGES} pages "
                     f"({len(recs)} records) — the deposit has grown; raise MAX_PAGES")
    # 'SperrmWhale' is a real typo in the deposit; normalise before matching.
    sw = [r for r in recs
          if "sperm" in (r.get("title") or "").lower().replace("sperrm", "sperm")]
    return recs, sw


def describe(article):
    """Pull the structured fields out of the free-text description."""
    desc = article.get("description") or ""
    plain = re.sub(r"<[^>]+>", " ", desc)
    grab = lambda pat: (re.search(pat, plain, re.I).group(1).strip()
                        if re.search(pat, plain, re.I) else None)
    wavs = [f for f in article.get("files", []) if f["name"].lower().endswith(".wav")]
    w = wavs[0] if wavs else None
    dur = None
    if w:
        m = re.search(r"_(\d+)sec", w["name"])
        dur = int(m.group(1)) if m else None
    pattern = grab(r"sound patterns?\s*:\s*([^;<]+)")
    return {
        "id": article["id"],
        "doi": article.get("doi"),
        "title": article.get("title"),
        "voyage_date": grab(r"voyage date\s*:\s*(\d+)"),
        "coordinate": grab(r"coordinate\s*:\s*([^;<]+)"),
        "sound_pattern": pattern,
        "has_coda": bool(pattern and "coda" in pattern.lower()),
        "wav": os.path.basename(w["name"]) if w else None,
        "bytes": w["size"] if w else None,
        "seconds_from_name": dur,
        "download_url": w["download_url"] if w else None,
        "url": article.get("url_public_html"),
        "licence": (article.get("license") or {}).get("name"),
        # filled in by probe_headers()
        "channels": None, "bits": None, "block_align": None,
        "sample_rate": None, "seconds": None,
    }


# ------------------------------------------------------- WAV header probing

def probe_fmt(url):
    """Range-fetch the first 96 bytes and parse the RIFF `fmt ` chunk.

    Cheaper than any inference: 96 bytes settles channels, bit depth and sample
    rate per record, which byte arithmetic over a filename token cannot.
    """
    try:
        out = subprocess.run(["curl", "-sSL", "--fail", "-r", "0-95", url],
                             capture_output=True, timeout=60).stdout
    except Exception:
        return None
    if len(out) < 44 or out[:4] != b"RIFF" or out[8:12] != b"WAVE":
        return None
    i = 12
    while i + 8 <= len(out):
        cid, sz = out[i:i + 4], struct.unpack("<I", out[i + 4:i + 8])[0]
        if cid == b"fmt " and i + 8 + 16 <= len(out):
            _fmt, ch, sr, _br, ba, bits = struct.unpack("<HHIIHH", out[i + 8:i + 24])
            return {"channels": ch, "sample_rate": sr,
                    "block_align": ba, "bits": bits}
        i += 8 + sz + (sz & 1)
    return None


def probe_headers(entries):
    """Fill channels/bits/duration per record from each file's own fmt chunk."""
    n = sum(1 for e in entries if e["download_url"])
    print(f"  probing  {n} WAV headers (96-byte range requests)", end="", flush=True)
    done = 0
    for e in entries:
        if not e["download_url"]:
            continue
        f = probe_fmt(e["download_url"])
        done += 1
        if done % 20 == 0:
            print(".", end="", flush=True)
        if not f:
            continue
        e.update(f)
        if e["bytes"] and f["block_align"] and f["sample_rate"]:
            # 44 = canonical RIFF header; every file here is plain PCM.
            e["seconds"] = round((e["bytes"] - 44) / (f["sample_rate"] * f["block_align"]), 3)
    got = sum(1 for e in entries if e["channels"])
    print(f" {got}/{n} parsed")
    return got


# ------------------------------------------------------------------ download

def download(entries, dest):
    """Fetch to <dest>/<record id>/<name>, verifying size before counting a hit.

    Two independent reasons the flat, exists-only version was unsafe:
      - two records declare the same WAV filename, so the second silently
        resolved to the first's bytes and was still counted as fetched;
      - an interrupted transfer leaves a short file whose WAV header still
        declares full length, so downstream readers get truncated audio with no
        error. Ctrl-C raises KeyboardInterrupt, which is not an Exception, so
        the old cleanup never ran on the most likely interruption.
    Downloads land on a .part file and are renamed only after the byte count
    matches what the index says.
    """
    got, bad = 0, []
    for e in entries:
        if not e["download_url"]:
            continue
        sub = os.path.join(dest, str(e["id"]))
        os.makedirs(sub, exist_ok=True)
        path = os.path.join(sub, os.path.basename(e["wav"]))
        want = e["bytes"]
        # Adopt a file left by the earlier flat layout rather than re-fetching,
        # but only if its size checks out.
        legacy = os.path.join(dest, os.path.basename(e["wav"]))
        if not os.path.exists(path) and os.path.exists(legacy):
            if want and os.path.getsize(legacy) != want:
                print(f"  DISCARD  {e['wav']} from the old flat layout "
                      f"(have {os.path.getsize(legacy)} B, index says {want} B)")
                os.remove(legacy)
            else:
                os.replace(legacy, path)
                print(f"  migrated {e['wav']} -> {e['id']}/")
        if os.path.exists(path):
            have = os.path.getsize(path)
            if want and have != want:
                print(f"  REFETCH  {e['wav']} (have {have} B, index says {want} B)")
                os.remove(path)
            else:
                print(f"  cached   {e['wav']}")
                got += 1
                continue
        print(f"  fetching {e['wav']} ({(want or 0) / 1048576:.1f} MB)")
        tmp = path + ".part"
        try:
            subprocess.run(["curl", "-sSL", "--fail", "-o", tmp, e["download_url"]],
                           check=True, timeout=1800)
            have = os.path.getsize(tmp)
            if want and have != want:
                raise IOError(f"size mismatch: got {have} B, index says {want} B")
            os.replace(tmp, path)
            got += 1
        except BaseException as err:          # BaseException: catches Ctrl-C too
            if os.path.exists(tmp):
                os.remove(tmp)
            print(f"    failed: {err}")
            bad.append(e["wav"])
            if isinstance(err, KeyboardInterrupt):
                raise
    if bad:
        print(f"  {len(bad)} file(s) failed and were removed: {bad[:5]}")
    return got


# ---------------------------------------------------------------------- main

def label_tally(entries):
    lead = lambda e: re.sub(r"\s+", " ", (e["sound_pattern"] or "no label")
                            .split("coordinate")[0].split("sound file")[0]).strip()
    out = {}
    for e in entries:
        k = lead(e)[:60]
        out[k] = out.get(k, 0) + 1
    return dict(sorted(out.items(), key=lambda kv: -kv[1]))


def date_typos(entries):
    """Records whose title date, voyage_date and filename date disagree.

    Derived across all records rather than hardcoded to the one that was
    noticed by eye. Which field is wrong varies — sometimes the title,
    sometimes the voyage_date — so the trap reports all three and does not
    guess.
    """
    bad = []
    for e in entries:
        m = re.match(r"(\d{8})", e["title"] or "")
        if not m or not e["voyage_date"]:
            continue
        if m.group(1) == e["voyage_date"]:
            continue
        fm = re.match(r"(\d{6,8})", e["wav"] or "")
        bad.append({"id": e["id"], "title_date": m.group(1),
                    "voyage_date": e["voyage_date"],
                    "filename_date": fm.group(1) if fm else None,
                    "title": e["title"], "wav": e["wav"]})
    return bad


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--audio", choices=["none", "coda", "all"], default="none",
                    help="which WAVs to download (default: none — index only)")
    ap.add_argument("--no-probe", action="store_true",
                    help="skip the per-record WAV header probe (loses real durations)")
    args = ap.parse_args()

    print("ASACTER — sperm whale, Taiwan eastern waters (Western North Pacific)")
    all_recs, sw = enumerate_records()
    print(f"  found    {len(all_recs)} ASACTER records, {len(sw)} sperm whale")
    if not sw:
        sys.exit("  no sperm whale records returned — the figshare search may have changed")

    entries = []
    for r in sw:
        try:
            entries.append(describe(_get(ARTICLE % r["id"])))
        except Exception as err:
            print(f"    skipped {r['id']}: {err}")

    if not args.no_probe:
        probe_headers(entries)

    lic = {e["licence"] for e in entries}
    coda = [e for e in entries if e["has_coda"]]
    total = sum(e["bytes"] or 0 for e in entries)
    with_wav = [e for e in entries if e["wav"]]
    no_wav = [e for e in entries if not e["wav"]]
    # Two DIFFERENT counts that the old code conflated into one: a record with
    # no audio at all, and a WAV whose filename omits its duration token.
    no_token = [e for e in with_wav if e["seconds_from_name"] is None]
    token_secs = sum(e["seconds_from_name"] or 0 for e in entries)
    real_secs = sum(e["seconds"] or 0 for e in entries)
    measured = sum(1 for e in entries if e["seconds"] is not None)
    fmts = {}
    for e in entries:
        if e["channels"]:
            fmts[f"{e['channels']}ch/{e['bits']}bit/{e['sample_rate']}Hz"] = \
                fmts.get(f"{e['channels']}ch/{e['bits']}bit/{e['sample_rate']}Hz", 0) + 1
    dupes = {}
    for e in with_wav:
        dupes.setdefault(e["wav"], []).append(e["id"])
    dupes = {k: v for k, v in dupes.items() if len(v) > 1}
    typos = date_typos(entries)

    traps = ([
        f"{len(typos)} record(s) disagree with themselves about the date. Which "
        "field is wrong varies, so all three are given: "
        + "; ".join(f"{t['id']} title={t['title_date']} voyage_date="
                    f"{t['voyage_date']} filename={t['filename_date']}"
                    for t in typos)
        + ". The eye-catching one is 30335251, whose title reads 20270727 (2027) "
          "— but its voyage_date and filename both read 2025 correctly, so "
          "grepping voyage_date for 2027 returns nothing and the title is the "
          "only place the typo lives."
    ] if typos else []) + [
        "one title reads 'SperrmWhale'",
        f"{len(no_wav)} record(s) carry no WAV at all: "
        f"{[e['id'] for e in no_wav]} — so {len(entries)} records is "
        f"{len(with_wav)} audio files",
        f"{len(no_token)} of the {len(with_wav)} WAV filenames carry no _Nsec "
        "duration token, and the untokened files include the longest in the "
        "deposit — summing the tokens understates the corpus by about a third",
        "the coda files 01 and 03 are near-duplicates; 03 is a 5 s re-export of "
        "the opening of 01 (Pearson r = 0.974, not byte-identical)",
        "the five coda files are hard-clipped (0.60-1.34% of samples at full "
        "scale, 9.85% for the 'with engine sound' file)",
    ]
    if dupes:
        traps.append(
            "two records declare the same WAV filename with identical byte size: "
            + "; ".join(f"{k} on {v}" for k, v in dupes.items())
            + " — downloads are namespaced per record id so they cannot collide")
    if fmts:
        traps.append("WAV headers by format: " + ", ".join(
            f"{v} x {k}" for k, v in sorted(fmts.items(), key=lambda kv: -kv[1]))
            + " — the coda files are the mono 16-bit minority, so the corpus is "
              "NOT mono 16-bit as an earlier reconnaissance here claimed")

    payload = {
        "schema": 2,
        "source": {
            "name": "ASACTER",
            "long_name": ("Acoustic Signature Database for Cetacean in Taiwan "
                          "Eastern Maritime Waters"),
            "host": "figshare",
            "deposit": DEPOSIT_URL,
            "basin": "Western North Pacific (eastern Taiwan, ~121.7E 23.9N)",
            "licence": sorted(x for x in lic if x),
            "licence_uri": LICENCE_URI,
            "cite": CITATION,
            "redistribution": ("CC BY 4.0 permits redistribution with attribution "
                               "— unlike the Sharma deposit (no LICENSE) or Watkins "
                               "(all rights reserved). Still fetched on demand here, "
                               "to keep the repo's no-data-committed convention."),
        },
        "scale": {
            "records": len(entries),
            "records_with_wav": len(with_wav),
            "records_without_wav": len(no_wav),
            "wavs_without_duration_token": len(no_token),
            "wav_bytes": total,
            "seconds_from_filename_tokens": token_secs,
            "seconds_from_headers": round(real_secs, 1),
            "records_with_measured_duration": measured,
            "coda_labelled_records": len(coda),
        },
        "sound_pattern_labels": label_tally(entries),
        "provenance": {
            "measured_from_headers": ["channels", "bits", "sample_rate", "seconds"],
            "from_figshare_metadata": ["title", "voyage_date", "coordinate",
                                       "sound_pattern", "bytes", "doi", "licence"],
            "not_inspected": (
                f"{len(entries) - len(coda)} records have never been listened to or "
                "analysed by this repo. Their sound_pattern is the depositor's "
                "free-text label, not a measurement. Only the "
                f"{len(coda)} coda-labelled files have been fetched and processed."),
        },
        "not_a_coda_corpus": (
            f"Only {len(coda)} of {len(entries)} records are labelled as containing "
            "codas (~88 s, one voyage 20230709), and one of those is a 5 s re-export "
            "of another. There are no clan, social-unit or individual labels of any "
            "kind. That last point alone settles it: the clan-timing question "
            "experiment 01 leaves open needs repertoire overlap between LABELLED "
            "clans, and unlabelled audio cannot supply it. Use ASACTER for IPI "
            "validation and cross-basin click comparison, not for coda structure."),
        "known_traps": traps,
        "records": entries,
    }

    os.makedirs(os.path.dirname(OUT_INDEX), exist_ok=True)
    with open(OUT_INDEX, "w") as f:
        json.dump(payload, f, separators=(",", ":"))

    print(f"  licences {sorted(x for x in lic if x)}  <{LICENCE_URI}>")
    print(f"  audio    {total / 1073741824:.2f} GB across {len(with_wav)} files")
    if measured:
        print(f"  duration {real_secs / 60:.1f} min measured from {measured} file headers"
              f"  (the _Nsec filename tokens sum to only {token_secs / 60:.1f} min,"
              f" over the {len(with_wav) - len(no_token)} files that carry one)")
    else:
        print(f"  duration ~{token_secs / 60:.1f} min from filename tokens over "
              f"{len(with_wav) - len(no_token)} files — run without --no-probe for the real figure")
    print(f"  codas    {len(coda)} records labelled 'clicks & codas'")
    print(f"  traps    {len(no_wav)} record(s) with no WAV, {len(no_token)} WAV(s) "
          f"with no duration token, {len(dupes)} duplicated filename(s), "
          f"{len(typos)} title/voyage-date mismatch(es)")
    print(f"  wrote    {OUT_INDEX} ({os.path.getsize(OUT_INDEX) / 1024:.0f} KB)")

    if args.audio != "none":
        want = coda if args.audio == "coda" else entries
        want = [e for e in want if e["download_url"]]
        print(f"\n  downloading {len(want)} file(s) into {DATA_DIR}/<record id>/")
        n = download(want, DATA_DIR)
        print(f"  have     {n}/{len(want)}")

    print(f"\n  cite: {CITATION}")
    print("  data/ is gitignored. Nothing was committed.")


if __name__ == "__main__":
    main()
