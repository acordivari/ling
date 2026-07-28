"""CPU vs MPS equivalence check for WhAM.

See README.md for the question, the control condition, and the pass criteria,
all of which were fixed before this ran.

    python check.py run --device cpu      # writes the reference tokens
    python check.py run --device mps
    python check.py compare
"""
import argparse, itertools, json, logging, sys, warnings
from pathlib import Path

warnings.filterwarnings("ignore")
logging.disable(logging.INFO)

import numpy as np
import torch

HERE = Path(__file__).parent
ART = HERE / "artifacts"
MODELS = HERE / ".." / ".." / "wham" / "vampnet" / "models"

SR = 44100
N_SEEDS = 12
SAMPLING_STEPS = 12
MASK_RATIO = 0.8


# --------------------------------------------------------------------------
# fixed input — identical on both devices by construction
# --------------------------------------------------------------------------
def make_signal():
    """Synthetic coda-like click train. numpy seed fixed, so device-independent."""
    from audiotools import AudioSignal

    icis = [0.0, 0.11, 0.21, 0.29, 0.35]
    x = np.zeros(int(SR * 3.0), dtype=np.float32)
    rng = np.random.default_rng(0)
    for rep in range(6):
        for t in icis:
            i = int((rep * 0.5 + t) * SR)
            if i + 200 < len(x):
                env = np.exp(-np.arange(200) / 12.0)
                x[i : i + 200] += (env * rng.standard_normal(200)).astype(np.float32)
    x /= np.abs(x).max() + 1e-9
    return AudioSignal(x[None, None, :], sample_rate=SR)


def load_interface(device):
    from vampnet.interface import Interface

    return Interface(
        coarse_ckpt=str(MODELS / "coarse.pth"),
        coarse2fine_ckpt=str(MODELS / "c2f.pth"),
        codec_ckpt=str(MODELS / "codec.pth"),
        wavebeat_ckpt=None,  # see INSTALL.md gotcha 6
        device=device,
    )


def seed_all(s):
    torch.manual_seed(s)
    if torch.backends.mps.is_available():
        torch.mps.manual_seed(s)


def mel_feature(wav):
    """Time-averaged log-mel. Always computed on CPU so the metric itself is
    never device-dependent."""
    import torchaudio

    t = torch.from_numpy(wav).float().reshape(1, -1)
    m = torchaudio.transforms.MelSpectrogram(
        sample_rate=SR, n_fft=2048, hop_length=512, n_mels=64
    )(t)
    return torch.log(m + 1e-6).mean(dim=-1).squeeze(0).numpy()


def generate(iface, z, seed):
    from vampnet.mask import linear_random

    seed_all(seed)
    n = iface.s2t(iface.coarse.chunk_size_s)
    zc = z[:, :, :n]
    mask = linear_random(zc, MASK_RATIO)
    with torch.no_grad():
        zv = iface.coarse_vamp(zc, mask, sampling_steps=SAMPLING_STEPS)
        zv = iface.coarse_to_fine(zv)
        sig = iface.to_signal(zv)
    return zv.detach().cpu().numpy(), sig.cpu().samples.numpy().reshape(-1)


# --------------------------------------------------------------------------
def run(device):
    ART.mkdir(exist_ok=True)
    out = {}
    sig = make_signal()
    iface = load_interface(device)

    # --- S1: encode -------------------------------------------------------
    z = iface.encode(sig)
    out["encode_tokens"] = z.detach().cpu().numpy()

    ref_path = ART / "ref_tokens.npy"
    if device == "cpu":
        np.save(ref_path, out["encode_tokens"])
    if not ref_path.exists():
        sys.exit("ref_tokens.npy missing — run --device cpu first (see README).")
    ref = torch.from_numpy(np.load(ref_path)).long().to(device)

    # --- P1: decode identical tokens -------------------------------------
    with torch.no_grad():
        wav = iface.to_signal(ref).cpu().samples.numpy().reshape(-1)
    out["decode_wav"] = wav

    # --- P2: transformer forward on identical latent ----------------------
    m = iface.coarse
    lat = np.random.default_rng(7).standard_normal(
        (1, m.latent_dim * m.n_codebooks, 173)
    ).astype(np.float32)
    with torch.no_grad():
        logits = m(torch.from_numpy(lat).to(device))
    out["logits"] = logits.detach().cpu().float().numpy()

    # --- precondition: is seeding actually deterministic on this device? --
    _, a = generate(iface, z, 0)
    _, b = generate(iface, z, 0)
    out["selfconsistent"] = np.array_equal(a, b)

    # --- P3: sampled generations -----------------------------------------
    feats, rms = [], []
    for s in range(N_SEEDS):
        _, w = generate(iface, z, s)
        feats.append(mel_feature(w))
        rms.append(float(np.sqrt((w ** 2).mean())))
    out["mel"] = np.stack(feats)
    out["rms"] = np.array(rms)

    np.savez(ART / f"{device}.npz", **out)
    print(f"[{device}] done. self-consistent under fixed seed: {out['selfconsistent']}")


# --------------------------------------------------------------------------
def cosdist(a, b):
    return float(1 - np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))


def compare():
    c = np.load(ART / "cpu.npz")
    m = np.load(ART / "mps.npz")
    R = {}

    print("precondition — same seed, same device, twice:")
    print(f"  cpu bit-identical: {bool(c['selfconsistent'])}")
    print(f"  mps bit-identical: {bool(m['selfconsistent'])}")
    R["precondition"] = bool(c["selfconsistent"]) and bool(m["selfconsistent"])

    # P1
    a, b = c["decode_wav"], m["decode_wav"]
    n = min(len(a), len(b))
    a, b = a[:n], b[:n]
    noise = ((a - b) ** 2).sum()
    snr = 10 * np.log10(((a ** 2).sum() / noise)) if noise > 0 else float("inf")
    R["P1_decode_snr_db"] = float(snr)
    print(f"\nP1 decode SNR (identical tokens): {snr:.1f} dB   [pass >= 40]")

    # P2
    lc, lm = c["logits"], m["logits"]
    top1 = float((lc.argmax(1) == lm.argmax(1)).mean())
    R["P2_top1_agreement"] = top1
    R["P2_max_abs_diff"] = float(np.abs(lc - lm).max())
    print(f"P2 top-1 agreement:              {top1*100:.2f}%   [pass >= 99%]")
    print(f"   max abs logit diff:           {R['P2_max_abs_diff']:.2e}  (descriptive)")

    # S1
    ec, em = c["encode_tokens"], m["encode_tokens"]
    per_cb = [(float((ec[0, k] == em[0, k]).mean())) for k in range(ec.shape[1])]
    R["S1_per_codebook_agreement"] = per_cb
    print(f"S1 encode agreement, codebook 0: {per_cb[0]*100:.2f}%  (unscored)")
    print("   per-codebook: " + " ".join(f"{v*100:.0f}" for v in per_cb))

    # P3
    fc, fm = c["mel"], m["mel"]
    within = [cosdist(fc[i], fc[j]) for i, j in itertools.combinations(range(len(fc)), 2)]
    within += [cosdist(fm[i], fm[j]) for i, j in itertools.combinations(range(len(fm)), 2)]
    cross = [cosdist(x, y) for x in fc for y in fm]
    ratio = float(np.median(cross) / (np.median(within) + 1e-12))
    R["P3_within_median"] = float(np.median(within))
    R["P3_cross_median"] = float(np.median(cross))
    R["P3_ratio"] = ratio
    print(
        f"\nP3 mel distance — within-device median {np.median(within):.5f}"
        f"  (range {np.min(within):.5f}–{np.max(within):.5f})"
    )
    print(
        f"                   cross-device median {np.median(cross):.5f}"
        f"  (range {np.min(cross):.5f}–{np.max(cross):.5f})"
    )
    print(f"                   ratio {ratio:.3f}   [pass <= 1.5]")
    print(f"   rms cpu {c['rms'].mean():.5f} +/- {c['rms'].std():.5f} | "
          f"mps {m['rms'].mean():.5f} +/- {m['rms'].std():.5f}")

    verdict = (
        R["precondition"]
        and R["P1_decode_snr_db"] >= 40
        and R["P2_top1_agreement"] >= 0.99
        and R["P3_ratio"] <= 1.5
    )
    R["verdict"] = "EQUIVALENT" if verdict else "DIVERGENT"
    print(f"\nVERDICT: {R['verdict']}")
    (ART / "result.json").write_text(json.dumps(R, indent=2))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--device", required=True, choices=["cpu", "mps"])
    sub.add_parser("compare")
    a = p.parse_args()
    run(a.device) if a.cmd == "run" else compare()
