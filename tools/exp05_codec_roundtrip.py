#!/usr/bin/env python3
"""exp05_codec_roundtrip.py — the baseline experiment 05 was missing.

    ./wham/.venv/bin/python tools/exp05_codec_roundtrip.py

encode -> decode, with NO masking and NO sampling. Whatever this changes is the
codec's own reconstruction fidelity, and it is the floor under every number
experiment 05 reports.

Why it matters, and why its absence was a hole:

  At mask 0.10, 90 % of tokens are unmasked, so the output is close to a codec
  round-trip. The synthetic arm showed clean passthrough there (beta 1.127,
  onsets 5.09 against an input of 5). The ASACTER arm did not: beta 0.071, and
  output onsets 24.8 against an input of 13.3 — the model roughly TRIPLES the
  click count on real audio.

  If the round-trip alone triples onsets on real audio, then nothing measured on
  the ASACTER arm is about WhAM's rhythm prior; it is about how well the codec
  reconstructs dense click trains. That would also cast doubt on the synthetic
  arm's high-mask numbers, which is the finding experiment 05 currently rests on.

Writes raw float32 for tools/exp05_measure.mjs's sibling analysis in node, so the
measurement stays in the shipped detector.
"""
import json
import logging
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
logging.disable(logging.INFO)

import numpy as np
import torch

_orig_load = torch.load
torch.load = lambda *a, **k: _orig_load(*a, **{**k, "weights_only": False})

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "experiments" / "05-structure-vs-timbre" / "artifacts"
MODELS = ROOT / "wham" / "vampnet" / "models"
DEVICE = "mps"
LIMIT = 20


def main():
    from vampnet.interface import Interface
    from audiotools import AudioSignal

    iface = Interface(
        coarse_ckpt=str(MODELS / "coarse.pth"),
        coarse2fine_ckpt=str(MODELS / "c2f.pth"),
        codec_ckpt=str(MODELS / "codec.pth"),
        wavebeat_ckpt=None,
        device=DEVICE,
    )

    out_dir = ART / "out_roundtrip"
    out_dir.mkdir(parents=True, exist_ok=True)
    log = []

    for source, man_name, in_name in (
        ("synthetic", "manifest.json", "inputs"),
        ("coda", "manifest_coda.json", "inputs_coda"),
        ("asacter", "manifest_asacter.json", "inputs_asacter"),
    ):
        mp = ART / man_name
        if not mp.exists():
            print(f"  skip {source}: no {man_name}")
            continue
        man = json.loads(mp.read_text())
        SR = man["meta"]["sampleRate"]
        items = man["items"]
        if LIMIT < len(items):
            step = len(items) / LIMIT
            items = [items[int(i * step)] for i in range(LIMIT)]

        print(f"\n{source}: {len(items)} inputs")
        for it in items:
            raw = np.fromfile(ART / in_name / f"{it['id']}.f32", dtype=np.float32)
            sig = AudioSignal(raw[None, None, :], sample_rate=SR)
            with torch.no_grad():
                z = iface.encode(sig)
                wav = iface.to_signal(z).cpu().samples.numpy().reshape(-1)
            name = f"{source}__{it['id']}.f32"
            wav.astype(np.float32).tofile(out_dir / name)
            log.append({
                "file": name, "source": source, "input": it["id"],
                "inSec": len(raw) / SR, "outSec": len(wav) / SR,
                "npviIn": it.get("npviIn"),
                "rms": float(np.sqrt((wav ** 2).mean())),
            })
        print(f"  wrote {len(items)}")

    (ART / "gen_roundtrip.json").write_text(json.dumps({
        "note": ("encode -> decode only. No mask, no sampling, no coarse_vamp. "
                 "This is the codec's own reconstruction fidelity and it is the "
                 "floor under every experiment 05 number."),
        "device": DEVICE, "torch": torch.__version__,
        "generations": log,
    }, indent=1))
    print(f"\n  log -> {ART / 'gen_roundtrip.json'}")
    print(f"  now: node tools/exp05_roundtrip_measure.mjs")


if __name__ == "__main__":
    main()
