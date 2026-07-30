#!/usr/bin/env python3
"""Run the SHIPPED IPI estimator against real sperm whale clicks, with controls.

    python3 tools/fetch_asacter.py --audio coda     # get the audio first
    ./wham/.venv/bin/python tools/asacter_ipi_check.py

Reproduces experiments/03-ipi-against-real-audio/. Extracts isolated clicks from
ASACTER audio, decimates 192 kHz down, and hands them to `estimateIpi` in
explorer/js/dsp.js via node — so the code under test is the code that runs in the
browser. `carrierHz` is supplied the way `analyze()` supplies it, so the shipped
spectral-centroid guard is exercised rather than bypassed.

WHAT IS AND IS NOT A TEST HERE
------------------------------
`estimateIpi` clamps its autocorrelation search to `minMs..maxMs` (default
2-10 ms) and returns `bestLag / sampleRate`. **Every non-null return is inside
2-10 ms by construction.** "All values landed in the physically plausible band"
is therefore a restatement of a constant in the code under test, not a result,
and neither it nor the Gordon body length derived from it is scored. Both are
reported as derived quantities.

What is scored:

  N   negative controls — material with no multipulse structure must be refused
  C   consistency       — two-sided: tight spread, but NOT degenerate, and the
                          value must survive a change of lag grid

Needs numpy + scipy (use wham/.venv) and node. The repo's browser code stays
dependency-free; this is offline tooling.
"""
import json
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np
from scipy.signal import butter, sosfiltfilt, decimate

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, "data", "asacter")
DSP = os.path.join(ROOT, "explorer", "js", "dsp.js")

DECIMATE_Q = 4         # 192 kHz / 4 = 48 kHz; the browser FFT path is not built for 192
PERTURB_Q = (2, 3, 4)  # lag grids of 0.0104 / 0.0156 / 0.0208 ms
CLICKS_PER_FILE = 12
WINDOW_S = 0.030       # extracted; estimateIpi analyses the first 19.33 ms of it
IPI_BAND = (2.0, 10.0) # estimateIpi's own search bound — see the note above

# A detection must be a distinct click, not the next pulse of the same
# multipulse train. The estimator treats pulses up to IPI_BAND[1] apart as ONE
# click, so anything shorter here lets the detector disagree with the estimator
# about what a click is. Derived, not hard-coded.
REFRACTORY_MS = IPI_BAND[1]
# Selected clicks must not share samples, or "independent segments" is not earned.
MIN_SEPARATION_S = WINDOW_S

CONFIDENCE_FLOOR = 0.22   # the three thresholds explorer/README.md asks to re-check
CENTROID_CYCLE_CUT = 20
ZCR_CYCLE_CUT = 3


# ------------------------------------------------------------------- audio io

def read_wav(path):
    """Read a WAV at whatever sample width it actually declares.

    104 of the 109 ASACTER WAVs are stereo 32-bit; only the five coda-labelled
    files are mono 16-bit. Forcing int16 on an int32 file splits every sample
    into two halves and silently doubles the apparent length.
    """
    with wave.open(path, "rb") as w:
        sr, n, ch, sw = (w.getframerate(), w.getnframes(),
                         w.getnchannels(), w.getsampwidth())
        raw = w.readframes(n)
    dtype = {1: np.uint8, 2: np.int16, 4: np.int32}.get(sw)
    if dtype is None:
        raise ValueError(f"{os.path.basename(path)}: unsupported sample width {sw} bytes")
    x = np.frombuffer(raw, dtype=dtype).astype(np.float64)
    x = (x - 128.0) / 128.0 if sw == 1 else x / float(2 ** (8 * sw - 1))
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x, sr


def click_threshold(x, sr, lo=2000, hi=20000, k=8.0):
    """Envelope, and the adaptive threshold applied to it.

    Returned so callers can see WHY a file yields nothing. This is a CFAR
    detector: the threshold is set from the file's own median/MAD, so broadband
    vessel noise raises it. On a loud enough file the threshold can exceed the
    envelope's own maximum, at which point zero detections is arithmetic, not a
    statement about the ocean.
    """
    sos = butter(4, [lo, min(hi, sr / 2 - 1000)], btype="band", fs=sr, output="sos")
    env = np.abs(sosfiltfilt(sos, x))
    win = max(1, int(0.001 * sr))
    env = np.convolve(env, np.ones(win) / win, mode="same")
    med = np.median(env)
    thr = med + k * 1.4826 * (np.median(np.abs(env - med)) + 1e-12)
    return env, float(thr)


def detect_clicks(x, sr, k=8.0, refractory_ms=REFRACTORY_MS):
    env, thr = click_threshold(x, sr, k=k)
    above = env > thr
    idx = np.flatnonzero(above[1:] & ~above[:-1])
    out, last, ref = [], -1e9, refractory_ms / 1000 * sr
    for i in idx:
        if i - last > ref:
            out.append(i)
            last = i
    return np.array(out) / sr, env, thr


def extract(path, q=DECIMATE_Q, prefilter=None):
    """Top-N highest-energy clicks, no two closer than MIN_SEPARATION_S."""
    x, sr = read_wav(path)
    times, env, thr = detect_clicks(x, sr)
    diag = {"clicks": len(times), "rms": float(np.sqrt(np.mean(x ** 2))),
            "env_max": float(env.max()), "thr": thr,
            "clipped_pct": float(100 * np.mean(np.abs(x) >= 0.999))}
    if len(times) == 0:
        return [], diag
    if prefilter:  # applied at the detector's own sample rate, before decimation
        lo, hi = prefilter
        sos = (butter(4, lo, btype="high", fs=sr, output="sos") if hi is None else
               butter(4, [lo, hi], btype="band", fs=sr, output="sos"))
        x = sosfiltfilt(sos, x)

    energies = []
    for t in times:
        s = int(t * sr)
        e = min(len(x), s + int(0.025 * sr))
        energies.append((float(np.sum(x[s:e] ** 2)), float(t)))
    energies.sort(reverse=True)

    chosen = []
    for _, t in energies:
        if any(abs(t - u) < MIN_SEPARATION_S for u in chosen):
            continue
        chosen.append(t)
        if len(chosen) >= CLICKS_PER_FILE:
            break

    segs = []
    for t in chosen:
        s = int(t * sr)
        e = min(len(x), s + int(WINDOW_S * sr))
        if e - s < int(0.020 * sr):
            continue
        seg = decimate(x[s:e], q, ftype="fir", zero_phase=True) if q > 1 else x[s:e]
        peak = np.max(np.abs(seg)) or 1.0
        segs.append({"file": os.path.basename(path), "t": round(t, 4),
                     "sampleRate": int(sr // q),
                     "signal": [round(float(v / peak), 6) for v in seg]})
    diag["segments"] = len(segs)
    return segs, diag


# --------------------------------------------------------------- the estimator

# Runs inside node. Mirrors estimateIpi's branch structure so the tool can
# report WHICH guard rejected a segment and by what margin — that per-threshold
# margin is the deliverable explorer/README.md actually asks for. The scored
# ipiMs always comes from the real imported estimateIpi, never from this copy;
# the copy only attributes the nulls.
NODE = r"""
const fs = require('fs');
import('file://%(dsp)s').then(({ estimateIpi, analyze }) => {
  const segs = JSON.parse(fs.readFileSync(process.env.SEGS, 'utf8'));
  const F = %(floor)s, CC = %(cyc)s, ZC = %(zcr)s;

  function why(sig, sr, onsets, carrierHz) {
    let best = onsets[0], bestE = -1;
    const win = Math.round(0.02 * sr);
    for (const t of onsets) {
      const s = Math.round(t * sr);
      let e = 0;
      for (let i = s; i < Math.min(sig.length, s + win); i++) e += sig[i] * sig[i];
      if (e > bestE) { bestE = e; best = t; }
    }
    const next = onsets.find((t) => t > best + 1e-6);
    if (next == null) return { reason: 'no-next-onset' };
    const available = Math.max(0, Math.round((next - best) * sr) - 8);
    const start = Math.max(0, Math.round(best * sr) - Math.round(0.001 * sr));
    const seg = sig.subarray(start, Math.min(sig.length, start + Math.min(win, available)));
    if (seg.length < 64) return { reason: 'segment-too-short' };
    const analysedMs = 1000 * seg.length / sr;
    const minLag = Math.round(0.002 * sr);
    const maxLag = Math.min(Math.round(0.010 * sr), seg.length - 16);
    if (maxLag <= minLag) return { reason: 'no-band', analysedMs };
    let r0 = 0;
    for (let i = 0; i < seg.length; i++) r0 += seg[i] * seg[i];
    if (r0 <= 0) return { reason: 'silent', analysedMs };
    const ac = new Float32Array(maxLag - minLag + 1);
    let bestLag = -1, bestR = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let r = 0;
      for (let i = 0; i + lag < seg.length; i++) r += seg[i] * seg[i + lag];
      r /= r0;
      ac[lag - minLag] = r;
      if (r > bestR) { bestR = r; bestLag = lag; }
    }
    if (bestLag < 0 || bestR < F) return { reason: 'confidence', bestR, analysedMs };
    let nPeaks = 0;
    for (let i = 1; i < ac.length - 1; i++)
      if (ac[i] > ac[i - 1] && ac[i] >= ac[i + 1] && ac[i] > 0.5 * bestR) nPeaks++;
    if (nPeaks > 6) return { reason: 'tonal', nPeaks, bestR, analysedMs };
    const lagSec = bestLag / sr;
    const cyc = carrierHz > 0 ? carrierHz * lagSec : null;
    if (cyc != null && cyc < CC) return { reason: 'carrier-cycles', cyc, bestR, analysedMs };
    let cr = 0;
    for (let i = 1; i < seg.length; i++) if ((seg[i - 1] < 0) !== (seg[i] < 0)) cr++;
    const zcrHz = cr / (2 * (seg.length / sr));
    const zc = lagSec * zcrHz;
    if (zcrHz > 0 && zc < ZC) return { reason: 'zcr-cycles', zc, bestR, analysedMs };
    return { reason: 'FIRED', bestR, cyc, zc, nPeaks, analysedMs };
  }

  console.log(JSON.stringify(segs.map((s) => {
    const sig = Float32Array.from(s.signal);
    // Exactly what analyze() hands the estimator in the browser (dsp.js).
    const centroid = analyze(sig, s.sampleRate).centroid;
    const onsets = [0.0005, 0.020];
    const r = estimateIpi(sig, s.sampleRate, onsets, { carrierHz: centroid });
    return {
      file: s.file, t: s.t, sr: s.sampleRate, centroid,
      ipiMs: r ? r.ipiMs : null, confidence: r ? r.confidence : null,
      ...why(sig, s.sampleRate, onsets, centroid),
    };
  })));
}).catch((e) => { console.error(String(e)); process.exit(1); });
"""


def run_estimator(segs):
    if not segs:
        return []
    script = NODE % {"dsp": DSP, "floor": CONFIDENCE_FLOOR,
                     "cyc": CENTROID_CYCLE_CUT, "zcr": ZCR_CYCLE_CUT}
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(segs, f)
        segpath = f.name
    try:
        r = subprocess.run(["node", "-e", script], env=dict(os.environ, SEGS=segpath),
                           capture_output=True, timeout=900)
        if r.returncode != 0:
            sys.exit(f"node failed: {r.stderr.decode()[:400]}")
        return json.loads(r.stdout.decode().strip().splitlines()[-1])
    finally:
        os.unlink(segpath)


def fired(results):
    return sorted(r["ipiMs"] for r in results if r["ipiMs"] is not None)


def gordon_length_m(ipi_ms):
    """Gordon (1991) IPI -> body length: L = 4.833 + 1.453*IPI - 0.001*IPI^2.

    Monotone over the whole 2-10 ms search band (7.74 m to 19.26 m), so a
    "body length is plausible" check carries no information the search bound
    does not already guarantee. Reported, never scored. Gordon was fitted on
    Sri Lankan females and immatures (~7.5-12 m); 2.8-3.3 ms is inside that
    range, but the top of the search band extrapolates well past it and
    Growcott et al. (2011) supersedes Gordon above ~12 m.
    """
    return 4.833 + 1.453 * ipi_ms - 0.001 * ipi_ms ** 2


# ------------------------------------------------------------ negative controls

def synth_controls(sr):
    """Material with NO spermaceti multipulse structure. Deterministic."""
    rng = np.random.default_rng(7)
    n = int(WINDOW_S * sr)

    def pack(sig, label, i):
        peak = np.max(np.abs(sig)) or 1.0
        return {"file": label, "t": float(i), "sampleRate": sr,
                "signal": [round(float(v / peak), 6) for v in sig]}

    noise = [pack(rng.normal(0, 1, n), "noise", i) for i in range(24)]

    single = []
    for i in range(24):
        x = rng.normal(0, 0.02, n)
        t = np.arange(200) / sr
        x[int(0.001 * sr):int(0.001 * sr) + 200] += np.sin(2 * np.pi * 8000 * t) * np.exp(-t * 4000)
        single.append(pack(x, "single-pulse", i))

    # Broadband impulse trains at vessel blade rates. Alternating polarity,
    # click-band carrier — what propeller cavitation looks like, and the one
    # artefact class with genuinely periodic broadband structure.
    trains = []
    for f0 in (120, 150, 200, 250, 300, 350, 400, 450):
        x = rng.normal(0, 0.01, n)
        per = int(sr / f0)
        for j, k in enumerate(range(0, n - 100, per)):
            t = np.arange(80) / sr
            x[k:k + 80] += (1 if j % 2 == 0 else -1) * np.sin(2 * np.pi * 6000 * t) * np.exp(-t * 6000)
        trains.append(pack(x, "impulse-train", f0))

    return noise, single, trains


# ----------------------------------------------------------------------- main

def find_wavs():
    """Every WAV under data/asacter/, flat or namespaced per record id."""
    out = {}
    for dirpath, _dirs, files in os.walk(AUDIO):
        for f in files:
            if f.lower().endswith(".wav"):
                out[f] = os.path.join(dirpath, f)   # basenames are unique here
    return dict(sorted(out.items()))


def main():
    if not os.path.isdir(AUDIO):
        sys.exit(f"no audio at {AUDIO}\n  run: python3 tools/fetch_asacter.py --audio coda")
    paths = find_wavs()
    wavs = list(paths)
    if not wavs:
        sys.exit(f"no .wav under {AUDIO} — run tools/fetch_asacter.py --audio coda")

    sr_main = 192000 // DECIMATE_Q
    print(f"IPI estimator vs real ASACTER clicks  ({sr_main} Hz, "
          f"refractory {REFRACTORY_MS:.0f} ms, min separation {1000 * MIN_SEPARATION_S:.0f} ms)\n")

    # -- extraction -----------------------------------------------------------
    segs, diag = [], {}
    for name in wavs:
        s, d = extract(paths[name])
        segs += s
        diag[name] = d

    contributing = [n for n, d in diag.items() if d.get("segments")]
    print("extraction:")
    for name, d in diag.items():
        if d.get("segments"):
            print(f"  {name:<32} {d['clicks']:>4} clicks -> {d['segments']:>2} segments")
        else:
            print(f"  {name:<32} {d['clicks']:>4} clicks -> EXCLUDED BY THE DETECTOR: "
                  f"threshold {d['thr']:.3f} vs envelope max {d['env_max']:.3f} "
                  f"(rms {d['rms']:.3f}, {d['clipped_pct']:.1f}% clipped)")
    print(f"  {len(segs)} segments = {CLICKS_PER_FILE} x {len(contributing)} contributing "
          f"file(s), of {len(wavs)} present\n")

    # A file whose threshold exceeds its own envelope maximum cannot produce a
    # detection whatever it contains. Show that it is the knob, not the file.
    for name, d in diag.items():
        if not d.get("segments"):
            x, sr = read_wav(paths[name])
            sweep = [(k, len(detect_clicks(x, sr, k=k)[0])) for k in (8.0, 6.0, 5.0, 4.0, 3.0)]
            print(f"  {name} detections vs MAD multiplier k: "
                  + ", ".join(f"k={k:.0f}->{n}" for k, n in sweep))
            print("  The zero is the threshold, not the audio. This file is labelled\n"
                  "  'clicks & codas (with engine sound)' by the depositor — a positive\n"
                  "  sample the detector cannot reach, NOT a noise-only control.\n")

    results = run_estimator(segs)
    vals = fired(results)
    hits = [r for r in results if r["reason"] == "FIRED"]
    if not vals:
        sys.exit("no IPI returned on any real segment — nothing to score against")

    # -- negative controls (scored) -------------------------------------------
    print("N  NEGATIVE CONTROLS — material with no multipulse structure")
    noise, single, trains = synth_controls(sr_main)
    n_res, s_res, t_res = (run_estimator(noise), run_estimator(single), run_estimator(trains))
    n_fire, s_fire, t_fire = fired(n_res), fired(s_res), fired(t_res)
    refuse_ok = not n_fire and not s_fire
    print(f"     white noise                 {len(n_fire)}/{len(n_res)} fired   "
          f"[{'pass' if not n_fire else 'FAIL'}]")
    print(f"     single pulse, no multipulse {len(s_fire)}/{len(s_res)} fired   "
          f"[{'pass' if not s_fire else 'FAIL'}]")
    print(f"     broadband impulse trains    {len(t_fire)}/{len(t_res)} fired   "
          f"[{'pass' if not t_fire else 'FAIL'}]")
    if t_fire:
        tc = [r["confidence"] for r in t_res if r["confidence"]]
        print(f"       -> {t_fire[0]:.2f}-{t_fire[-1]:.2f} ms, ALL inside the 2-10 ms band,")
        print(f"          confidence {min(tc):.2f}-{max(tc):.2f} vs {min(c for c in (r['confidence'] for r in hits) if c):.2f}"
              f"-{max(r['confidence'] for r in hits):.2f} on the real clicks.")
        print("          A periodic broadband artefact is NOT rejected, and scores")
        print("          HIGHER confidence than any real click. Neither the band, nor")
        print("          Gordon, nor the centroid guard separates it. Only consistency")
        print("          across a set does, and only if the artefact rate varies.")

    # -- consistency (scored, two-sided) --------------------------------------
    print(f"\nC  CONSISTENCY across {len(vals)} fired of {len(results)} segments")
    spread = vals[-1] - vals[0]
    bins = sorted({round(v * sr_main / 1000) for v in vals})
    med = vals[len(vals) // 2]
    print(f"     values                {vals[0]:.2f} - {vals[-1]:.2f} ms, median {med:.2f}")
    print(f"     C1 spread < 1 ms      {spread:.2f} ms"
          f"                     [{'pass' if spread < 1.0 else 'FAIL'}]")
    print(f"     C2 not degenerate     {len(bins)} distinct lag bins {bins}"
          f"   [{'pass' if len(bins) >= 2 else 'FAIL'}]")

    # C3: change the lag grid. A physical reflection delay is invariant in
    # absolute time; an artefact of the autocorrelation bin grid is not.
    grid = []
    for q in PERTURB_Q:
        psegs = []
        for name in wavs:
            psegs += extract(paths[name], q=q)[0]
        pv = fired(run_estimator(psegs))
        grid.append((192000 // q, pv))
    meds = [(sr, v[len(v) // 2]) for sr, v in grid if v]
    coarsest = max(1000.0 / sr for sr, _ in meds)
    drift = max(m for _, m in meds) - min(m for _, m in meds)
    print(f"     C3 grid invariance    " + ", ".join(f"{sr // 1000}kHz->{m:.3f}" for sr, m in meds)
          + f"  drift {drift:.3f} ms vs one bin {coarsest:.4f} ms"
          f"  [{'pass' if drift <= coarsest else 'FAIL'}]")
    consistency_ok = spread < 1.0 and len(bins) >= 2 and drift <= coarsest

    # -- threshold margins (the deliverable explorer/README.md asked for) ------
    print(f"\nT  THRESHOLD MARGINS on the {len(hits)} real clicks that fired")
    mn_conf = min(r["bestR"] for r in hits)
    mn_cyc = min(r["cyc"] for r in hits if r["cyc"] is not None)
    mn_zcr = min(r["zc"] for r in hits)
    mx_pk = max(r["nPeaks"] for r in hits)
    print(f"     confidence floor {CONFIDENCE_FLOOR}   tightest {mn_conf:.3f}"
          f"   margin {100 * (mn_conf / CONFIDENCE_FLOOR - 1):+.0f}%"
          f"   ({sum(1 for r in hits if r['bestR'] < CONFIDENCE_FLOOR + 0.05)} within 0.05)")
    print(f"     centroid cut     {CENTROID_CYCLE_CUT}     tightest {mn_cyc:.2f}"
          f"   margin {100 * (mn_cyc / CENTROID_CYCLE_CUT - 1):+.1f}%")
    print(f"     zcr cut          {ZCR_CYCLE_CUT}      tightest {mn_zcr:.2f}"
          f"   margin {100 * (mn_zcr / ZCR_CYCLE_CUT - 1):+.0f}%")
    print(f"     tonal peak cut   6      worst    {mx_pk}")
    print("     Centroids are measured after decimation to "
          f"{sr_main // 1000} kHz (Nyquist {sr_main // 2000} kHz), which discards real")
    print("     click energy above it — so the centroid margin is a floor, not the value.")

    # -- derived, NOT scored --------------------------------------------------
    lo, hi = IPI_BAND
    blen = (gordon_length_m(vals[0]), gordon_length_m(vals[-1]))
    print(f"\nD  DERIVED, NOT SCORED")
    print(f"     in the {lo}-{hi} ms band   {len(vals)}/{len(vals)} — true by construction:")
    print(f"       estimateIpi clamps its lag search to minMs..maxMs, so no other")
    print(f"       value is reachable. This is a search bound, and it encodes a size")
    print(f"       prior; it is not evidence the estimator declined to fabricate.")
    print(f"     Gordon (1991) length  {blen[0]:.1f}-{blen[1]:.1f} m — monotone in the above.")
    print(f"       The band maps to {gordon_length_m(lo):.2f}-{gordon_length_m(hi):.2f} m, so a 6-18 m")
    print(f"       'plausible' window is ~89% guaranteed and its lower edge is")
    print(f"       unreachable. 3x the measured IPI still lands in it, so it cannot")
    print(f"       detect a harmonic pick either.")
    print(f"     fire rate             {len(vals)}/{len(results)} — not scored: with no ground-truth")
    print(f"       IPI a miss cannot be told from a correct refusal.")

    # -- robustness: does the low-frequency content carry the result? ---------
    band_segs = []
    for name in wavs:
        band_segs += extract(paths[name], prefilter=(2000, 20000))[0]
    bv = fired(run_estimator(band_segs))
    print(f"\nR  ROBUSTNESS — segments band-passed to the detector's own 2-20 kHz,")
    print(f"     at the native 192 kHz before decimation (one filter stage, not two):")
    if bv:
        print(f"     {len(bv)}/{len(band_segs)} fired  {bv[0]:.2f}-{bv[-1]:.2f} ms"
              f"  spread {bv[-1] - bv[0]:.2f} ms")
        print(f"     The result does not come from sub-2 kHz energy.")
    else:
        print(f"     0/{len(band_segs)} fired — the result DOES depend on sub-2 kHz energy.")

    # -- why the rest did not fire -------------------------------------------
    census = {}
    for r in results:
        census[r["reason"]] = census.get(r["reason"], 0) + 1
    print("\n   why each segment did or did not fire:")
    for k in sorted(census, key=lambda k: -census[k]):
        note = ""
        if k == "no-next-onset":
            note = "  <- harness artefact: onsets are hand-supplied [0.5, 20] ms"
        print(f"     {k:<16} {census[k]:>3}{note}")
    print(f"   analysed window: {hits[0]['analysedMs']:.2f} ms of the {1000 * WINDOW_S:.0f} ms extracted"
          " — estimateIpi clips at the\n     next supplied onset. analyze() finds exactly one onset in a"
          f" {1000 * WINDOW_S:.0f} ms\n     segment, so real onsets would make the estimator unreachable"
          " (0 fired); the\n     hand-supplied pair is deliberate and bypasses the next-onset bound.")

    print("\nper file:")
    for name, d in diag.items():
        v = sorted(round(r["ipiMs"], 2) for r in results
                   if r["file"] == name and r["ipiMs"] is not None)
        print(f"  {name:<32} {len(v)}/{d.get('segments', 0)}  {v}")

    ok = refuse_ok and consistency_ok
    print(f"\nVERDICT  negative-control refusals {'pass' if refuse_ok else 'FAIL'}"
          f" | consistency {'pass' if consistency_ok else 'FAIL'}"
          f" | impulse-train rejection {'pass' if not t_fire else 'FAIL (documented)'}")
    print("Exit code tracks the two criteria above. The impulse-train failure is a")
    print("real, reproducible limitation of the estimator, recorded in")
    print("experiments/03-ipi-against-real-audio/README.md and in explorer/js/dsp.js.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
