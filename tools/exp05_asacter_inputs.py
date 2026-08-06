#!/usr/bin/env python3
"""exp05_asacter_inputs.py — stage 0b. Real coda audio as experiment 05 input.

    ./wham/.venv/bin/python tools/exp05_asacter_inputs.py

The synthetic click trains built by exp05_build_inputs.mjs are in distribution
for RHYTHM by construction but almost certainly out of distribution for TIMBRE,
and WhAM encodes both into the same tokens. That is the single biggest threat to
experiment 05's finding: a model handed atypical tokens may fill in atypically
for reasons that have nothing to do with its rhythm prior.

This writes real sperm whale coda audio in the same raw-float32 format, so the
identical generate -> measure pipeline runs over it with nothing else changed.

Source: ASACTER (Hualien Formosa Association & Turumoan Whale Watching, figshare,
CC BY 4.0), the five coda-labelled records, already on disk from experiment 03.

Two properties of this deposit, both established in experiment 03, are handled
explicitly rather than discovered later:

  file 03 is a 5 s re-export of the opening of file 01 (Pearson r = 0.974).
      Included it would double-count the same animal. EXCLUDED here.

  all five files are hard-clipped, 0.60-1.34 % of samples at digital full scale
      and 9.85 % for file 05, which also carries vessel noise. File 05's own CFAR
      threshold exceeded its maximum envelope value, so experiment 03's detector
      found zero clicks in it. It is NOT excluded — that was our detector's
      arithmetic, not a property of the file — but it is expected to contribute
      few or no usable windows, and that is reported rather than hidden.

Resampling 192000 -> 44100 is exact: 44100/192000 = 147/640.
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "experiments" / "05-structure-vs-timbre" / "artifacts"
OUT_DIR = ART / "inputs_asacter"
ASACTER = sorted((ROOT / "data" / "asacter").glob("*/*.wav"))

TARGET_SR = 44100          # codec sample_rate, measured
UP, DOWN = 147, 640        # 44100/192000 exactly
WINDOW_SEC = 2.57          # the synthetic arm's mean duration
HOP_SEC = 1.0
EXCLUDE = ("_03.wav",)     # duplicate of file 01, experiment 03
MIN_RMS = 1e-4


def main():
    if not ASACTER:
        sys.exit("no ASACTER audio found — run: python3 tools/fetch_asacter.py --audio coda")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for f in OUT_DIR.glob("*.f32"):
        f.unlink()

    items, per_file = [], []
    for path in ASACTER:
        if any(path.name.endswith(x) for x in EXCLUDE):
            per_file.append({"file": path.name, "excluded": "duplicate of file 01 (exp 03)"})
            print(f"  {path.name}  EXCLUDED — duplicate of file 01 (experiment 03)")
            continue

        x, sr = sf.read(path, dtype="float64")
        if x.ndim > 1:
            x = x.mean(axis=1)
        clipped = float(np.mean(np.abs(x) >= 0.999) * 100)

        y = signal.resample_poly(x, UP, DOWN)
        assert abs(len(y) / TARGET_SR - len(x) / sr) < 0.01

        w = int(WINDOW_SEC * TARGET_SR)
        hop = int(HOP_SEC * TARGET_SR)
        kept = 0
        for start in range(0, max(1, len(y) - w + 1), hop):
            seg = y[start:start + w]
            if len(seg) < w:
                break
            rms = float(np.sqrt((seg ** 2).mean()))
            if rms < MIN_RMS:
                continue
            peak = float(np.abs(seg).max())
            if peak <= 0:
                continue
            seg = (seg / peak).astype(np.float32)   # peak-normalised, as the synthetic arm is
            sid = f"as{len(items):04d}"
            seg.tofile(OUT_DIR / f"{sid}.f32")
            items.append({
                "id": sid, "source": path.name, "startSec": start / TARGET_SR,
                "durSec": len(seg) / TARGET_SR, "rms": rms,
                "clippedPctFile": round(clipped, 3),
            })
            kept += 1
        per_file.append({"file": path.name, "origSr": sr, "durSec": round(len(x) / sr, 2),
                         "clippedPct": round(clipped, 3), "windows": kept})
        print(f"  {path.name}  {len(x)/sr:5.1f}s @ {sr}  clipped {clipped:5.2f}%  -> {kept} windows")

    meta = {
        "schema": 1, "sampleRate": TARGET_SR, "windowSec": WINDOW_SEC, "hopSec": HOP_SEC,
        "resample": f"{UP}/{DOWN} (192000 -> 44100, exact)",
        "source": ("ASACTER: Acoustic Signature Database for Cetacean in Taiwan Eastern "
                   "Maritime Waters (Hualien Formosa Association & Turumoan Whale "
                   "Watching, figshare, CC BY 4.0)"),
        "excluded": {"_03.wav": "5 s re-export of file 01, r = 0.974 (experiment 03)"},
        "caveats": {
            "clipping": ("Every file is hard-clipped. Absolute levels are meaningless "
                         "and clipping distorts click envelopes. Windows are "
                         "peak-normalised, matching the synthetic arm."),
            "no_ici_ground_truth": ("These recordings carry no annotated ICIs, so input "
                                    "nPVI is MEASURED by the same shipped detector as the "
                                    "outputs. The regression is measured-on-measured, "
                                    "which is what the synthetic arm reports too."),
            "not_all_windows_are_codas": ("Windows are cut on a fixed grid, not selected "
                                          "for coda content. Windows without enough "
                                          "detected onsets are dropped downstream, in "
                                          "node, by the shipped detector."),
        },
        "perFile": per_file, "items": len(items),
        "format": "raw float32 mono, little-endian, no header",
    }
    (ART / "manifest_asacter.json").write_text(json.dumps({"meta": meta, "items": items}, indent=1))
    print(f"\n  wrote {len(items)} windows -> {OUT_DIR}")
    print(f"  manifest -> {ART / 'manifest_asacter.json'}")


if __name__ == "__main__":
    main()
