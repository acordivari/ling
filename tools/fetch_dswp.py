#!/usr/bin/env python3
"""Fetch the DSWP sperm whale coda audio from HuggingFace.

    python3 tools/fetch_dswp.py              # all 1501 files, ~585 MB
    python3 tools/fetch_dswp.py --limit 60   # first 60, enough for the gate
    python3 tools/fetch_dswp.py --index-only # re-derive index.json from disk

`orrp/DSWP` is CC BY 4.0 and ungated: 1,501 WAVs named `1.wav` ... `1501.wav`,
audio only. There is no ICI, coda type, speaker id, or recording-system metadata
in the deposit, and the dataset card says so explicitly.

The card is right about the deposit and wrong about the audio. Every WAV carries
a `fmt ` chunk, and those disagree across the corpus:

    files 1-3      44100 Hz  mono    16-bit
    files 700,1501 48000 Hz  stereo  16-bit

Sample rate and channel count are a recording-configuration grouping variable,
free, sitting in bytes 20-36 of each file. Experiment 06 needs it because the
shipped onset detector's time resolution is a function of sample rate (512-sample
frames, 128-sample hop: 11.61/2.90 ms at 44.1 kHz, 10.67/2.67 ms at 48 kHz), so
the two groups are not measured on the same grid. The Beguš recording-artifact
question needs it for its own reasons.

So this tool builds `index.json` as it downloads, parsing each header rather than
trusting filenames or the card. Durations come from the `data` chunk size and the
`fmt ` block, never from a filename token -- the same discipline
`tools/fetch_asacter.py` arrived at after the `_Nsec` tokens there were found to
understate that corpus by a third.

Nothing here is redistributed. `data/` is gitignored.
"""

import argparse
import json
import os
import ssl
import struct
import subprocess
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

# macOS system Python ships without a usable CA bundle, so urllib raises
# CERTIFICATE_VERIFY_FAILED on every HTTPS fetch here. Use certifi's bundle when
# it is importable and fall back to curl otherwise -- the same two-step
# tools/fetch_corpus.py already uses. Verification is never disabled.
try:
    import certifi
    _SSL = ssl.create_default_context(cafile=certifi.where())
except Exception:  # noqa: BLE001 - certifi absent is normal, not exceptional
    _SSL = None

REPO = "orrp/DSWP"
BASE = f"https://huggingface.co/datasets/{REPO}/resolve/main"
N_FILES = 1501
LICENSE = "CC BY 4.0"

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "..", "data", "dswp")
INDEX = os.path.join(DATA_DIR, "index.json")
TIMEOUT = 60
RETRIES = 3


def wav_header(path):
    """Parse a RIFF/WAVE header. Returns None if the file is not a readable WAV.

    Walks the chunk list rather than assuming a 44-byte canonical header --
    real-world WAVs carry LIST/INFO and fact chunks ahead of `data`.
    """
    try:
        with open(path, "rb") as f:
            riff = f.read(12)
            if len(riff) < 12 or riff[0:4] != b"RIFF" or riff[8:12] != b"WAVE":
                return None
            fmt = None
            data_bytes = None
            while True:
                hdr = f.read(8)
                if len(hdr) < 8:
                    break
                cid, size = struct.unpack("<4sI", hdr)
                if cid == b"fmt ":
                    raw = f.read(size)
                    if len(raw) < 16:
                        return None
                    tag, ch, rate, _byte_rate, _align, bits = struct.unpack("<HHIIHH", raw[:16])
                    fmt = dict(format_tag=tag, channels=ch, sample_rate=rate, bits=bits)
                elif cid == b"data":
                    data_bytes = size
                    f.seek(size + (size & 1), os.SEEK_CUR)
                else:
                    f.seek(size + (size & 1), os.SEEK_CUR)
            if fmt is None or data_bytes is None:
                return None
            frame = max(1, fmt["channels"] * max(1, fmt["bits"] // 8))
            frames = data_bytes // frame
            fmt["frames"] = frames
            fmt["duration_s"] = frames / fmt["sample_rate"] if fmt["sample_rate"] else None
            fmt["data_bytes"] = data_bytes
            fmt["file_bytes"] = os.path.getsize(path)
            return fmt
    except OSError:
        return None


def fetch_one(i):
    """Download <i>.wav if absent. Returns (i, status, header-or-None)."""
    dest = os.path.join(DATA_DIR, f"{i}.wav")
    if os.path.exists(dest):
        h = wav_header(dest)
        if h:
            return i, "cached", h
        os.remove(dest)  # truncated from an interrupted run

    part = dest + ".part"
    url = f"{BASE}/{i}.wav"
    last = None
    for _attempt in range(RETRIES):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ling-exp06/1.0"})
            with urllib.request.urlopen(req, timeout=TIMEOUT, context=_SSL) as r:
                body = r.read()
            with open(part, "wb") as f:
                f.write(body)
            os.replace(part, dest)
        except (urllib.error.URLError, OSError, TimeoutError) as e:
            last = e
            try:
                subprocess.run(["curl", "-sSL", "--fail", "-o", part, url],
                               check=True, timeout=TIMEOUT)
                os.replace(part, dest)
            except (subprocess.SubprocessError, OSError) as e2:
                last = e2
                if os.path.exists(part):
                    try:
                        os.remove(part)
                    except OSError:
                        pass
                continue
        h = wav_header(dest)
        if not h:
            os.remove(dest)
            return i, "not-a-wav", None
        return i, "fetched", h
    return i, f"failed: {last}", None


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--limit", type=int, default=N_FILES,
                    help=f"fetch only the first N files (default {N_FILES})")
    ap.add_argument("--workers", type=int, default=8, help="parallel downloads (default 8)")
    ap.add_argument("--index-only", action="store_true",
                    help="skip downloading; rebuild index.json from files already on disk")
    args = ap.parse_args()

    os.makedirs(DATA_DIR, exist_ok=True)
    ids = list(range(1, min(args.limit, N_FILES) + 1))

    print(f"DSWP coda audio  --  {REPO}  ({LICENSE}, ungated)")
    print(f"  target   {DATA_DIR}")
    print(f"  files    {len(ids)} of {N_FILES}")
    print()

    headers, failures = {}, []

    if args.index_only:
        for i in ids:
            p = os.path.join(DATA_DIR, f"{i}.wav")
            if os.path.exists(p):
                h = wav_header(p)
                if h:
                    headers[i] = h
                else:
                    failures.append((i, "not-a-wav"))
    else:
        done = 0
        try:
            with ThreadPoolExecutor(max_workers=args.workers) as pool:
                futs = {pool.submit(fetch_one, i): i for i in ids}
                for fut in as_completed(futs):
                    i, status, h = fut.result()
                    done += 1
                    if h:
                        headers[i] = h
                    else:
                        failures.append((i, status))
                    if done % 50 == 0 or done == len(ids):
                        mb = sum(x["file_bytes"] for x in headers.values()) / 1e6
                        print(f"  {done:>5}/{len(ids)}   ok {len(headers):>5}   "
                              f"failed {len(failures):>3}   {mb:8.1f} MB")
        except KeyboardInterrupt:
            print("\n  interrupted -- partial downloads removed, rerun to resume")
            for p in os.listdir(DATA_DIR):
                if p.endswith(".part"):
                    try:
                        os.remove(os.path.join(DATA_DIR, p))
                    except OSError:
                        pass
            sys.exit(130)

    if not headers:
        print("  nothing on disk")
        sys.exit(1)

    # --- recording configurations, derived rather than assumed ---------------
    configs = {}
    for i, h in headers.items():
        key = f'{h["sample_rate"]}Hz_{h["channels"]}ch_{h["bits"]}bit'
        configs.setdefault(key, []).append(i)

    total_s = sum(h["duration_s"] for h in headers.values())
    durs = sorted(h["duration_s"] for h in headers.values())

    index = {
        "source": {"repo": REPO, "url": f"https://huggingface.co/datasets/{REPO}",
                   "license": LICENSE, "gated": False},
        "note": ("Audio only. No ICI, coda type, speaker, or recording-system "
                 "annotation ships with this deposit. Recording configuration "
                 "below is parsed from each WAV's own fmt chunk, not from the "
                 "dataset card, which states no such metadata exists."),
        "counts": {"requested": len(ids), "readable": len(headers), "failed": len(failures)},
        "duration_s_total": round(total_s, 3),
        "duration_s_median": round(durs[len(durs) // 2], 4),
        "duration_s_min": round(durs[0], 4),
        "duration_s_max": round(durs[-1], 4),
        "bytes_total": sum(h["file_bytes"] for h in headers.values()),
        "recording_configurations": {
            k: {"n": len(v), "ids": sorted(v)} for k, v in sorted(configs.items())
        },
        "files": {str(i): headers[i] for i in sorted(headers)},
        "failures": [{"id": i, "status": s} for i, s in sorted(failures)],
    }
    with open(INDEX, "w") as f:
        json.dump(index, f, indent=2)

    print()
    print(f"  readable   {len(headers)}   failed {len(failures)}")
    print(f"  audio      {total_s / 60:.1f} min   "
          f"{index['bytes_total'] / 1e6:.1f} MB")
    print(f"  duration   min {index['duration_s_min']:.3f}s   "
          f"median {index['duration_s_median']:.3f}s   max {index['duration_s_max']:.3f}s")
    print()
    print("  recording configurations found in the headers:")
    for k, v in sorted(configs.items(), key=lambda kv: -len(kv[1])):
        print(f"    {k:<24} {len(v):>5} files")
    if len(configs) > 1:
        print()
        print("  NOTE: more than one configuration is present. The shipped detector's")
        print("  time resolution depends on sample rate, so these groups are not")
        print("  measured on the same grid. Experiment 06 gate G2 tests whether that")
        print("  matters; it is also the grouping variable the recording-artifact")
        print("  question needs.")
    if failures:
        print()
        print(f"  {len(failures)} failed; rerun to retry (cached files are skipped)")
    print()
    print(f"  index      {INDEX}")


if __name__ == "__main__":
    main()
