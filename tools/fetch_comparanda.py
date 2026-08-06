#!/usr/bin/env python3
"""Build the cross-domain rhythm comparison set.

    python3 tools/fetch_comparanda.py

Writes `explorer/data/comparanda.json`: nPVI and CV distributions for rhythm
sources outside the sperm whale, so coda rhythm can be placed on a shared axis
against human music and against exactly-specified symbolic rhythms.

Three provenance tiers, kept distinct because they are not equally trustworthy:

  measured          real performances, real microtiming. Groove MIDI: 1,150
                    takes by human drummers, CC BY 4.0, from Magenta.
  exact-symbolic    the IOI sequence IS the definition. Morse timing, Euclidean
                    rhythms, son clave. No approximation, nothing to be wrong.
  control           isochronous and Poisson. Not communication, just the floor
                    and ceiling of timing regularity.

Note there is deliberately NO "stylised animal" tier here. The explorer's
dolphin/woodpecker/bat sources are plausible-sounding inventions, and mixing
them into a quantitative comparison would put fiction on the same axis as
measurement.

WINDOW MATCHING MATTERS. nPVI is computed over n-1 intervals and its variance
depends strongly on n, so comparing a 4-interval whale coda against a whole
2-minute drum take would measure window length, not rhythm. Everything below is
cut into 4-interval windows to match the dominant 5-click coda.

Standard library only, including the MIDI parser — validated against `mido` in
tools/test_midi_parser.py.
"""
import json
import math
import random
import os
import struct
import subprocess
import sys
import urllib.request
import zipfile
from collections import defaultdict

GROOVE_URL = "https://storage.googleapis.com/magentadata/datasets/groove/groove-v1.0.0-midionly.zip"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
OUT_PATH = os.path.join(ROOT, "explorer", "data", "comparanda.json")
ZIP_PATH = os.path.join(DATA_DIR, "groove.zip")
GROOVE_DIR = os.path.join(DATA_DIR, "groove")

WINDOW = 4          # intervals per window: matches a 5-click coda
FLAM_MERGE_S = 0.012  # hits closer than this are one perceptual onset
MAX_WINDOWS_PER_TAKE = 40


# --------------------------------------------------------------- statistics
def npvi(x):
    if len(x) < 2:
        return None
    return 100 * sum(abs(a - b) / ((a + b) / 2) for a, b in zip(x, x[1:])) / (len(x) - 1)


def cv(x):
    if len(x) < 2:
        return None
    m = sum(x) / len(x)
    if m <= 0:
        return None
    return math.sqrt(sum((v - m) ** 2 for v in x) / len(x)) / m


# ------------------------------------------------------------- MIDI parsing
def _vlq(buf, i):
    """Variable-length quantity. Returns (value, next_index)."""
    v = 0
    while True:
        b = buf[i]
        i += 1
        v = (v << 7) | (b & 0x7F)
        if not b & 0x80:
            return v, i


def midi_note_on_times(path):
    """Absolute times (seconds) of every note-on with velocity > 0.

    Handles multi-track (format 1) files, running status, and tempo changes.
    Only what Groove MIDI actually contains — this is not a general parser.
    """
    with open(path, "rb") as f:
        data = f.read()
    if data[:4] != b"MThd":
        raise ValueError(f"not a MIDI file: {path}")
    (_, ntracks, division) = struct.unpack(">HHH", data[8:14])
    if division & 0x8000:
        raise ValueError("SMPTE time division is not supported")
    ticks_per_beat = division

    # Collect (tick, kind, payload) across all tracks, then merge on tick so the
    # tempo map applies correctly regardless of which track carries it.
    events = []
    pos = 14
    for _ in range(ntracks):
        if data[pos:pos + 4] != b"MTrk":
            break
        length = struct.unpack(">I", data[pos + 4:pos + 8])[0]
        end = pos + 8 + length
        i = pos + 8
        tick = 0
        status = None
        while i < end:
            delta, i = _vlq(data, i)
            tick += delta
            b = data[i]
            if b & 0x80:
                status = b
                i += 1
            # else: running status, reuse previous
            if status == 0xFF:                      # meta
                mtype = data[i]; i += 1
                mlen, i = _vlq(data, i)
                if mtype == 0x51:                   # set tempo
                    us = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
                    events.append((tick, "tempo", us))
                i += mlen
            elif status in (0xF0, 0xF7):            # sysex
                slen, i = _vlq(data, i)
                i += slen
            else:
                high = status & 0xF0
                if high in (0x80, 0x90, 0xA0, 0xB0, 0xE0):
                    d1, d2 = data[i], data[i + 1]; i += 2
                    if high == 0x90 and d2 > 0:
                        events.append((tick, "note", None))
                elif high in (0xC0, 0xD0):
                    i += 1
                else:
                    raise ValueError(f"unexpected status 0x{status:02x} in {path}")
        pos = end

    events.sort(key=lambda e: (e[0], e[1] != "tempo"))  # tempo first at a tick
    out = []
    us_per_beat = 500000  # MIDI default: 120 bpm
    last_tick = 0
    seconds = 0.0
    for tick, kind, payload in events:
        seconds += (tick - last_tick) * (us_per_beat / 1e6) / ticks_per_beat
        last_tick = tick
        if kind == "tempo":
            us_per_beat = payload
        else:
            out.append(seconds)
    return out


# ------------------------------------------------------------ exact symbolic
MORSE = {
    "A": ".-", "B": "-...", "C": "-.-.", "D": "-..", "E": ".", "F": "..-.",
    "G": "--.", "H": "....", "I": "..", "J": ".---", "K": "-.-", "L": ".-..",
    "M": "--", "N": "-.", "O": "---", "P": ".--.", "Q": "--.-", "R": ".-.",
    "S": "...", "T": "-", "U": "..-", "V": "...-", "W": ".--", "X": "-..-",
    "Y": "-.--", "Z": "--..",
}


def morse_iois(text, unit=0.06):
    """Exact ITU Morse timing. Onsets at symbol starts, so the IOI sequence
    carries the message structure: dot=1u, dash=3u, intra-char gap=1u,
    inter-char gap=3u, word gap=7u."""
    onsets, t = [], 0.0
    for ch in text.upper():
        if ch == " ":
            t += 4 * unit          # bring the trailing 3u up to 7u
            continue
        code = MORSE.get(ch)
        if not code:
            continue
        for sym in code:
            onsets.append(t)
            t += (1 if sym == "." else 3) * unit + unit
        t += 2 * unit              # trailing 1u -> 3u inter-character
    return [b - a for a, b in zip(onsets, onsets[1:])]


def bjorklund(k, n):
    """Euclidean rhythm: k onsets distributed as evenly as possible over n."""
    return [i for i in range(n) if (i * k) % n < k]


def steps_to_iois(steps, n, step=0.125):
    on = [s * step for s in steps] + [n * step]
    return [b - a for a, b in zip(on, on[1:])]


def windows(iois, w=WINDOW, cap=None):
    out = []
    for i in range(0, len(iois) - w + 1, w):
        out.append(iois[i:i + w])
        if cap and len(out) >= cap:
            break
    return out


# ----------------------------------------------------------------- pipeline
def download_groove():
    os.makedirs(DATA_DIR, exist_ok=True)
    if os.path.isdir(GROOVE_DIR):
        print(f"  cached   {GROOVE_DIR}")
        return
    if not os.path.exists(ZIP_PATH):
        print(f"  fetching {GROOVE_URL}")
        body = None
        try:
            with urllib.request.urlopen(GROOVE_URL, timeout=180) as r:
                body = r.read()
        except Exception as e:
            print(f"  urllib failed ({type(e).__name__}); falling back to curl")
            try:
                body = subprocess.run(["curl", "-sSL", "--fail", GROOVE_URL],
                                      check=True, capture_output=True, timeout=300).stdout
            except Exception as e2:
                sys.exit(f"  download failed: {e2}")
        with open(ZIP_PATH, "wb") as f:
            f.write(body)
        print(f"  saved    {ZIP_PATH} ({len(body):,} bytes)")
    with zipfile.ZipFile(ZIP_PATH) as z:
        z.extractall(GROOVE_DIR)
    print(f"  extracted {GROOVE_DIR}")


def collect_groove():
    """nPVI/CV windows per musical style from real drum performances."""
    import csv as _csv
    info_path = None
    for base, _, files in os.walk(GROOVE_DIR):
        if "info.csv" in files:
            info_path = os.path.join(base, "info.csv")
            break
    if not info_path:
        sys.exit("  info.csv not found in the Groove archive")
    base_dir = os.path.dirname(info_path)

    by_style = defaultdict(list)
    takes = 0
    for rec in _csv.DictReader(open(info_path)):
        path = os.path.join(base_dir, rec["midi_filename"])
        if not os.path.exists(path):
            continue
        try:
            onsets = midi_note_on_times(path)
        except Exception:
            continue
        if len(onsets) < 20:
            continue
        onsets.sort()
        merged = [onsets[0]]
        for t in onsets[1:]:
            if t - merged[-1] > FLAM_MERGE_S:
                merged.append(t)
        iois = [b - a for a, b in zip(merged, merged[1:])]
        if len(iois) < WINDOW + 2:
            continue
        style = rec["style"].split("/")[0]
        by_style[style].extend(windows(iois, cap=MAX_WINDOWS_PER_TAKE))
        takes += 1
    return by_style, takes


def _subsample(vals, k, seed=12345):
    """Seeded uniform random subsample WITHOUT replacement.

    Two earlier attempts were wrong in different ways and both are worth naming:

      sorted[::n//k][:k]  returned the LOWEST k values whenever n < 2k, because
                          the stride collapses to 1 and the slice truncates. New
                          Orleans came out at 42.0 against a true mean of 72.7.

      quantile grid       fixed the mean but is still not an i.i.d. draw. It is a
                          systematic sample with essentially no sampling variance,
                          and the browser then feeds it to a PERMUTATION test,
                          which assumes exchangeable draws. Right mean, wrong
                          second moment.

    A seeded random sample is representative in mean AND spread, and is a valid
    input to a permutation test. The seed keeps the artifact reproducible.
    """
    if len(vals) <= k:
        return [round(v, 3) for v in vals]
    return [round(v, 3) for v in random.Random(seed).sample(list(vals), k)]


def _subsample_windows(wins, k, seed=6789):
    """Seeded subsample of the raw ICI windows themselves.

    `npviSample` below is a sample of nPVI *values*. This is a sample of the
    *intervals* those values were computed from, which is what a consumer needs
    when it has to re-render the rhythm as audio rather than re-analyse the
    statistic.

    Added for experiment 05's G0 gate, which synthesises click trains from real
    drum microtiming and checks that the shipped onset detector recovers the
    intervals that were put in. A summary statistic cannot be re-rendered.
    """
    src = list(wins)
    if len(src) > k:
        src = random.Random(seed).sample(src, k)
    return [[round(v, 5) for v in w] for w in src]


def summarise(name, tier, wins, note=""):
    vals = [v for v in (npvi(w) for w in wins) if v is not None]
    cvs = [v for v in (cv(w) for w in wins) if v is not None]
    if not vals:
        return None
    vals_sorted = sorted(vals)
    mean = sum(vals) / len(vals)
    sd = math.sqrt(sum((v - mean) ** 2 for v in vals) / len(vals)) if len(vals) > 1 else 0.0
    q = lambda p: vals_sorted[min(len(vals_sorted) - 1, int(p * len(vals_sorted)))]
    return {
        "name": name, "tier": tier, "note": note,
        "n": len(vals),
        "npviMean": round(mean, 3), "npviSd": round(sd, 3),
        "npviMedian": round(q(0.5), 3), "npviP05": round(q(0.05), 3), "npviP95": round(q(0.95), 3),
        "cvMean": round(sum(cvs) / len(cvs), 4) if cvs else None,
        # Capped raw sample so the browser can run its own permutation tests
        # rather than trusting these summaries.
        #
        # This MUST be representative. A naive `sorted[::n//400][:400]` looks like
        # subsampling but silently returns the LOWEST 400 values whenever n < 800
        # (the stride collapses to 1 and the slice truncates), which shifted the
        # New Orleans sample mean from 72.7 to 42.0 — a 30-point error on a panel
        # whose whole point is honest comparison. Take evenly spaced quantiles
        # across the full sorted distribution instead, so the sample mean tracks
        # the population mean by construction.
        "npviSample": _subsample(vals, 400),
        # The intervals themselves, for consumers that must RE-RENDER the rhythm
        # rather than re-analyse the statistic. See _subsample_windows.
        "iciSample": _subsample_windows(wins, 200),
    }


def main():
    print("Cross-domain rhythm comparanda")
    download_groove()
    by_style, takes = collect_groove()
    print(f"  parsed   {takes} drum takes across {len(by_style)} styles")

    entries = []
    for style, wins in sorted(by_style.items(), key=lambda kv: -len(kv[1])):
        if len(wins) < 100:
            continue
        e = summarise(f"human drumming: {style}", "measured", wins,
                      "Groove MIDI (Magenta), CC BY 4.0. All drums collapsed to one onset train.")
        if e:
            entries.append(e)

    # exact symbolic — the IOI sequence is the definition, not an approximation
    entries.append(summarise("Morse code (ITU timing)", "exact-symbolic",
                             windows(morse_iois("THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG")),
                             "Dot 1u, dash 3u, gaps 1u/3u/7u. Onsets at symbol starts."))
    for k, n in [(3, 8), (5, 8), (5, 16), (7, 16)]:
        w = windows(steps_to_iois(bjorklund(k, n), n))
        if w:
            entries.append(summarise(f"Euclidean E({k},{n})", "exact-symbolic", w,
                                     "Bjorklund: k onsets spread as evenly as possible over n steps."))
    entries.append(summarise("son clave (3-2)", "exact-symbolic",
                             windows(steps_to_iois([0, 3, 6, 10, 12], 16)),
                             "Canonical 16-step son clave."))

    # controls
    entries.append(summarise("isochronous", "control", [[0.2] * WINDOW],
                             "Perfectly even. The nPVI floor: exactly 0."))
    # deterministic Poisson via a fixed LCG so the file is reproducible
    seed = 12345
    def rnd():
        nonlocal seed
        seed = (1103515245 * seed + 12345) % (1 << 31)
        return seed / (1 << 31)
    pois = [[-0.2 * math.log(1 - rnd()) for _ in range(WINDOW)] for _ in range(500)]
    entries.append(summarise("Poisson process", "control", pois,
                             "Memoryless point process: no timing structure at all."))

    entries = [e for e in entries if e]

    # The browser runs permutation tests and Cohen's d on npviSample while the
    # panel displays npviMean. If those disagree, the UI prints two numbers a
    # user cannot reconcile. Assert it here rather than hope.
    for e in entries:
        smp = e["npviSample"]
        if len(smp) < 30:
            continue
        sm = sum(smp) / len(smp)
        # Tolerance must scale with the standard error, not be a fixed constant.
        # A genuine random sample of 400 from sd=46 has se = 46/sqrt(400) = 2.3,
        # so deviations of 4-5 are ordinary. A fixed +/-3 flags honest sampling
        # variance as bias; 4 se catches a real systematic shift while passing
        # legitimate draws. (The earlier sorted-stride bug was off by 30 — orders
        # of magnitude outside this.)
        se = e["npviSd"] / math.sqrt(len(smp)) if e["npviSd"] > 0 else 1.0
        if abs(sm - e["npviMean"]) > 4 * se:
            sys.exit(f"  sample mean {sm:.2f} is {abs(sm - e['npviMean']) / se:.1f} standard "
                     f"errors from the reported mean {e['npviMean']:.2f} for {e['name']} "
                     f"— subsampling looks biased, not merely noisy")
        ssd = math.sqrt(sum((v - sm) ** 2 for v in smp) / len(smp))
        if e["npviSd"] > 0 and abs(ssd - e["npviSd"]) / e["npviSd"] > 0.25:
            sys.exit(f"  sample sd {ssd:.2f} disagrees with reported sd "
                     f"{e['npviSd']:.2f} for {e['name']} — subsampling distorts spread")
    payload = {
        "schema": 1,
        "window": WINDOW,
        "windowNote": (f"Every source is cut into {WINDOW}-interval windows to match the dominant "
                       "5-click sperm whale coda. nPVI variance depends strongly on window length, "
                       "so unmatched windows would compare window size rather than rhythm."),
        "tiers": {
            "measured": "Real performances with real microtiming.",
            "exact-symbolic": "The IOI sequence is the definition. No approximation.",
            "control": "Not communication — the floor and ceiling of regularity.",
        },
        "sources": {
            "groove": {"url": GROOVE_URL, "licence": "CC BY 4.0",
                       "cite": "Gillick et al., Learning to Groove with Inverse Sequence Transformations, ICML 2019"},
        },
        "caveat": ("Published per-language nPVI values for speech are NOT included. They are "
                   "computed over vocalic intervals across whole sentences, not 4-interval "
                   "windows, so putting them on this axis would be a category error."),
        "entries": entries,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(payload, f, separators=(",", ":"))
    print(f"  wrote    {OUT_PATH} ({os.path.getsize(OUT_PATH)/1024:.0f} KB)")
    print()
    print(f"  {'source':34s} {'tier':16s} {'n':>6s} {'nPVI':>8s}")
    for e in entries:
        print(f"  {e['name']:34s} {e['tier']:16s} {e['n']:6d} {e['npviMean']:8.1f}")


if __name__ == "__main__":
    main()
