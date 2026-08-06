#!/usr/bin/env python3
"""exp05_generate.py — stage 2 of 3. WhAM acoustic translation.

    ./wham/.venv/bin/python tools/exp05_generate.py --mode p0
    ./wham/.venv/bin/python tools/exp05_generate.py --mode n
    ./wham/.venv/bin/python tools/exp05_generate.py --mode sweep

USE THE VENV INTERPRETER. On this machine /usr/local/bin/python3 is an x86_64
binary and comes first in PATH; building or running against it yields Rosetta
wheels and no MPS, silently. See INSTALL.md, "the Rosetta trap".

Reads inputs written by tools/exp05_build_inputs.mjs, runs each through
translation at a grid of mask ratios and seeds, writes raw float32 outputs for
tools/exp05_measure.mjs to analyse with the SHIPPED onset detector.

Nothing here measures anything. This stage only generates, so that every number
experiment 05 reports comes out of explorer/js code that G0 characterised.

Modes:
  p0     passthrough gate — low mask only. Does output rhythm track input on
         material the model should find easy? If not, nothing downstream means
         anything.
  n      seed-variance gate — one mask, many seeds. If within-input seed variance
         is comparable to between-input variance, output rhythm is sampling noise
         and NO slope should be reported at all.
  sweep  the full mask x seed grid.
"""
import argparse
import json
import logging
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
logging.disable(logging.INFO)

import numpy as np
import torch

# INSTALL.md gotcha 6: these checkpoints carry pickled classes, and torch 2.6+
# defaults to weights_only=True. Only reasonable because they came from CETI's
# own Zenodo record.
_orig_load = torch.load
torch.load = lambda *a, **k: _orig_load(*a, **{**k, "weights_only": False})

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "experiments" / "05-structure-vs-timbre" / "artifacts"
MODELS = ROOT / "wham" / "vampnet" / "models"

SAMPLING_STEPS = 12          # same as experiment 00
DEVICE = "mps"

MODES = {
    # mode: (mask ratios, seeds, how many inputs)
    "p0":    ([0.2], [0], 20),
    "n":     ([0.6], [0, 1, 2, 3, 4], 20),
    # nsweep — added after `n` FAILED at mask 0.6 (ratio 1.809) while p0 gave
    # beta 0.913 at mask 0.2. The pre-registration ran N at ONE mask, which was
    # a design error: validity is mask-dependent, so N must be evaluated per
    # mask and beta reported only where it passes. This maps the boundary before
    # committing to a full-size sweep.
    "nsweep": ([0.1, 0.2, 0.3, 0.4, 0.6, 0.8], [0, 1, 2, 3, 4], 20),
    "sweep": ([0.2, 0.4, 0.6, 0.8, 0.95], [0, 1, 2], None),
}


def load_interface():
    from vampnet.interface import Interface
    return Interface(
        coarse_ckpt=str(MODELS / "coarse.pth"),
        coarse2fine_ckpt=str(MODELS / "c2f.pth"),
        codec_ckpt=str(MODELS / "codec.pth"),
        wavebeat_ckpt=None,           # INSTALL.md gotcha 6
        device=DEVICE,
    )


def checkpoint_log():
    """CLAUDE.md: log the checkpoint used for every generation. Named there as a
    non-obvious source of irreproducibility."""
    out = {}
    for name in ("coarse.pth", "c2f.pth", "codec.pth"):
        p = MODELS / name
        st = p.stat()
        out[name] = {"bytes": st.st_size, "mtime": int(st.st_mtime)}
    return out


def seed_all(s):
    torch.manual_seed(s)
    if torch.backends.mps.is_available():
        torch.mps.manual_seed(s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=sorted(MODES), required=True)
    args = ap.parse_args()
    masks, seeds, limit = MODES[args.mode]

    man_path = ART / "manifest.json"
    if not man_path.exists():
        sys.exit(f"missing {man_path}\n  run: node tools/exp05_build_inputs.mjs")
    man = json.loads(man_path.read_text())
    meta, items = man["meta"], man["items"]
    SR = meta["sampleRate"]

    # Subsets are spread across the nPVI bands, not taken off the top, so a gate
    # never runs on one end of the axis.
    if limit and limit < len(items):
        step = len(items) / limit
        items = [items[int(i * step)] for i in range(limit)]

    from audiotools import AudioSignal
    from vampnet.mask import linear_random

    iface = load_interface()
    out_dir = ART / f"out_{args.mode}"
    out_dir.mkdir(parents=True, exist_ok=True)

    total = len(items) * len(masks) * len(seeds)
    print(f"experiment 05 — stage 2, generation ({args.mode})")
    print(f"  device {DEVICE}   sampling_steps {SAMPLING_STEPS}")
    print(f"  {len(items)} inputs x {len(masks)} masks x {len(seeds)} seeds = {total} generations")
    print(f"  masks {masks}   seeds {seeds}")
    print(f"  -> {out_dir}\n")

    log = []
    done = 0
    for it in items:
        raw = np.fromfile(ART / "inputs" / f"{it['id']}.f32", dtype=np.float32)
        sig = AudioSignal(raw[None, None, :], sample_rate=SR)
        with torch.no_grad():
            z = iface.encode(sig)
        n = iface.s2t(iface.coarse.chunk_size_s)
        zc = z[:, :, :n]

        for m in masks:
            for s in seeds:
                seed_all(s)
                mask = linear_random(zc, m)
                with torch.no_grad():
                    zv = iface.coarse_vamp(zc, mask, sampling_steps=SAMPLING_STEPS)
                    zv = iface.coarse_to_fine(zv)
                    wav = iface.to_signal(zv).cpu().samples.numpy().reshape(-1)
                name = f"{it['id']}__m{int(round(m * 100)):03d}__s{s}.f32"
                wav.astype(np.float32).tofile(out_dir / name)
                log.append({
                    "file": name, "input": it["id"], "mask": m, "seed": s,
                    "npviIn": it["npviIn"], "tokens": it["tokens"],
                    "inSec": len(raw) / SR, "outSec": len(wav) / SR,
                    "peak": float(np.abs(wav).max()),
                    "rms": float(np.sqrt((wav ** 2).mean())),
                    "silent": bool(np.abs(wav).max() < 1e-4),
                })
                done += 1
                if done % 20 == 0 or done == total:
                    # flush: without a tty Python block-buffers stdout, so a run
                    # that is killed mid-way loses every progress line it printed.
                    print(f"  {done}/{total}", flush=True)

    silent = sum(1 for r in log if r["silent"])
    payload = {
        "mode": args.mode, "device": DEVICE, "samplingSteps": SAMPLING_STEPS,
        "masks": masks, "seeds": seeds,
        "checkpoints": checkpoint_log(),
        "torch": torch.__version__,
        "generations": log,
    }
    (ART / f"gen_{args.mode}.json").write_text(json.dumps(payload, indent=1))
    print(f"\n  wrote {len(log)} outputs")
    print(f"  silent outputs: {silent}" + ("  <- investigate" if silent else ""))
    print(f"  duration preserved: "
          f"{sum(1 for r in log if abs(r['outSec'] - r['inSec']) < 0.05)}/{len(log)}")
    print(f"  log -> {ART / f'gen_{args.mode}.json'}")


if __name__ == "__main__":
    main()
