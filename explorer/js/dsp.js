// dsp.js — browser-side signal analysis.
//
// Everything here is plain DSP: FFT, spectral-flux onset detection, mel
// features. It is NOT a WhAM embedding and NOT Frechet Audio Distance. Numbers
// produced here are a cheap, interpretable proxy you can compute without a GPU.
// See explorer/README.md for how to swap in real model embeddings.

// ---------------------------------------------------------------- primitives

export function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

// In-place iterative radix-2 Cooley-Tukey. re/im must be power-of-two length.
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const ar = re[i + k], ai = im[i + k];
        const br = re[i + k + half], bi = im[i + k + half];
        const vr = br * cr - bi * ci;
        const vi = br * ci + bi * cr;
        re[i + k] = ar + vr; im[i + k] = ai + vi;
        re[i + k + half] = ar - vr; im[i + k + half] = ai - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

export function hannWindow(n) {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

// --------------------------------------------------------------- spectrogram

// Returns { frames: Float32Array[], nBins, hop, frameSize, sampleRate }
// Each frame is a linear magnitude spectrum of length frameSize/2 + 1.
export function spectrogram(signal, sampleRate, { frameSize = 512, hop = 128 } = {}) {
  const win = hannWindow(frameSize);
  const nBins = frameSize / 2 + 1;
  const nFrames = Math.max(1, Math.floor((signal.length - frameSize) / hop) + 1);
  const frames = [];
  const re = new Float32Array(frameSize);
  const im = new Float32Array(frameSize);

  for (let f = 0; f < nFrames; f++) {
    const off = f * hop;
    for (let i = 0; i < frameSize; i++) {
      re[i] = (signal[off + i] || 0) * win[i];
      im[i] = 0;
    }
    fft(re, im);
    const mag = new Float32Array(nBins);
    for (let b = 0; b < nBins; b++) mag[b] = Math.hypot(re[b], im[b]);
    frames.push(mag);
  }
  return { frames, nBins, hop, frameSize, sampleRate };
}

// ----------------------------------------------------------- onset detection

// Spectral flux with log compression — half-wave rectified positive difference
// summed across bins. This is the same family of detector madmom uses; it is
// robust for impulsive/click material where an amplitude envelope alone gets
// confused by reverberation tails.
export function onsetEnvelope(spec) {
  const { frames, nBins } = spec;
  const odf = new Float32Array(frames.length);
  // Seed `prev` from frame 0 so odf[0] is 0. Seeding from zeros instead makes
  // the first frame's flux enormous for any clip that starts loud, and that
  // spike then dominates normalisation and flattens every real onset.
  const prev = new Float32Array(nBins);
  for (let b = 0; b < nBins; b++) prev[b] = Math.log1p(1000 * frames[0][b]);

  for (let f = 1; f < frames.length; f++) {
    const cur = frames[f];
    let sum = 0;
    for (let b = 0; b < nBins; b++) {
      const c = Math.log1p(1000 * cur[b]);
      const d = c - prev[b];
      if (d > 0) sum += d;
      prev[b] = c;
    }
    odf[f] = sum;
  }
  // normalise to [0,1] so the sensitivity control means the same thing
  // regardless of input level.
  let max = 0;
  for (let i = 0; i < odf.length; i++) if (odf[i] > max) max = odf[i];
  if (max > 0) for (let i = 0; i < odf.length; i++) odf[i] /= max;
  return odf;
}

function movingMedian(x, halfWin) {
  const out = new Float32Array(x.length);
  const buf = [];
  for (let i = 0; i < x.length; i++) {
    const lo = Math.max(0, i - halfWin);
    const hi = Math.min(x.length - 1, i + halfWin);
    buf.length = 0;
    for (let j = lo; j <= hi; j++) buf.push(x[j]);
    buf.sort((a, b) => a - b);
    out[i] = buf[buf.length >> 1];
  }
  return out;
}

// Peak-pick the onset envelope. `sensitivity` in [0,1]; higher finds more.
// `minIci` in seconds suppresses double-triggers on a single click's ringing.
// Onset times are refined to the nearest local energy peak in the raw signal,
// which matters because clicks are shorter than one analysis frame.
export function detectOnsets(signal, spec, odf, { sensitivity = 0.6, minIci = 0.03 } = {}) {
  const hopTime = spec.hop / spec.sampleRate;
  const med = movingMedian(odf, 12);
  const delta = 0.28 * (1 - sensitivity) + 0.02;
  const minFrames = Math.max(1, Math.round(minIci / hopTime));

  const candidates = [];
  for (let i = 1; i < odf.length - 1; i++) {
    if (odf[i] <= odf[i - 1] || odf[i] < odf[i + 1]) continue; // local max
    if (odf[i] < med[i] + delta) continue;
    candidates.push(i);
  }

  // Greedy suppression: keep strongest peaks, drop anything too close.
  candidates.sort((a, b) => odf[b] - odf[a]);
  const kept = [];
  for (const c of candidates) {
    if (kept.every((k) => Math.abs(k - c) >= minFrames)) kept.push(c);
  }
  kept.sort((a, b) => a - b);

  // Refine to sample-domain energy peak within the frame's neighbourhood.
  const search = spec.hop;
  return kept.map((f) => {
    const center = f * spec.hop + spec.frameSize / 2;
    let best = center, bestV = -1;
    for (let s = Math.max(0, center - search); s < Math.min(signal.length, center + search); s++) {
      const v = Math.abs(signal[s]);
      if (v > bestV) { bestV = v; best = s; }
    }
    return best / spec.sampleRate;
  });
}

// ------------------------------------------------------------- mel + spectral

function hzToMel(f) { return 2595 * Math.log10(1 + f / 700); }
function melToHz(m) { return 700 * (Math.pow(10, m / 2595) - 1); }

export function melFilterbank(sampleRate, frameSize, nMels = 40, fmin = 50, fmax = null) {
  const nBins = frameSize / 2 + 1;
  const top = fmax || sampleRate / 2;
  const mlo = hzToMel(fmin), mhi = hzToMel(top);
  const pts = [];
  for (let i = 0; i < nMels + 2; i++) {
    const hz = melToHz(mlo + ((mhi - mlo) * i) / (nMels + 1));
    pts.push(Math.floor(((frameSize + 1) * hz) / sampleRate));
  }
  const fb = [];
  for (let m = 1; m <= nMels; m++) {
    const row = new Float32Array(nBins);
    const l = pts[m - 1], c = pts[m], r = pts[m + 1];
    for (let k = l; k < c; k++) if (c > l && k < nBins) row[k] = (k - l) / (c - l);
    for (let k = c; k < r; k++) if (r > c && k < nBins) row[k] = (r - k) / (r - c);
    fb.push(row);
  }
  return fb;
}

// Mean log-mel across frames, then mean-centred. Used as the "timbre" vector.
//
// The centring matters: raw log-mel vectors sit at a large common negative
// offset, and cosine similarity between two such vectors is dominated by that
// shared offset rather than by spectral shape — every pair comes back at
// distance ~0. Subtracting the per-vector mean compares shape, which is what
// the metric is supposed to be measuring.
export function meanLogMel(spec, nMels = 40) {
  const fb = melFilterbank(spec.sampleRate, spec.frameSize, nMels);
  const out = new Float32Array(nMels);
  for (const frame of spec.frames) {
    for (let m = 0; m < nMels; m++) {
      let s = 0;
      const row = fb[m];
      for (let b = 0; b < spec.nBins; b++) s += frame[b] * row[b];
      out[m] += Math.log(1e-8 + s);
    }
  }
  let mean = 0;
  for (let m = 0; m < nMels; m++) {
    out[m] /= Math.max(1, spec.frames.length);
    mean += out[m];
  }
  mean /= nMels;
  for (let m = 0; m < nMels; m++) out[m] -= mean;
  return out;
}

// Mean linear-magnitude spectrum across the frames with the most energy — this
// isolates the clicks themselves rather than averaging in the silence between
// them, which matters a lot for click material.
export function clickSpectrum(spec, topFraction = 0.15) {
  const energies = spec.frames.map((f, i) => {
    let s = 0;
    for (let b = 0; b < f.length; b++) s += f[b] * f[b];
    return { i, s };
  });
  energies.sort((a, b) => b.s - a.s);
  const n = Math.max(1, Math.round(spec.frames.length * topFraction));
  const out = new Float32Array(spec.nBins);
  for (let k = 0; k < n; k++) {
    const f = spec.frames[energies[k].i];
    for (let b = 0; b < spec.nBins; b++) out[b] += f[b];
  }
  for (let b = 0; b < spec.nBins; b++) out[b] /= n;
  return out;
}

function binToHz(b, spec) { return (b * spec.sampleRate) / spec.frameSize; }

export function spectralStats(mag, spec) {
  let sum = 0, wsum = 0;
  for (let b = 0; b < mag.length; b++) { sum += mag[b]; wsum += mag[b] * binToHz(b, spec); }
  const centroid = sum > 0 ? wsum / sum : 0;

  let varsum = 0;
  for (let b = 0; b < mag.length; b++) {
    const d = binToHz(b, spec) - centroid;
    varsum += mag[b] * d * d;
  }
  const bandwidth = sum > 0 ? Math.sqrt(varsum / sum) : 0;

  let acc = 0, rolloff = 0;
  for (let b = 0; b < mag.length; b++) {
    acc += mag[b];
    if (acc >= 0.85 * sum) { rolloff = binToHz(b, spec); break; }
  }

  let logSum = 0, arith = 0;
  for (let b = 1; b < mag.length; b++) { logSum += Math.log(1e-10 + mag[b]); arith += mag[b]; }
  const geo = Math.exp(logSum / (mag.length - 1));
  const flatness = arith > 0 ? geo / (arith / (mag.length - 1)) : 0;

  return { centroid, bandwidth, rolloff, flatness };
}

// Peaks in the smoothed click spectrum. For sperm whale clicks these come from
// the multipulse comb structure (inter-pulse interval inside a single click),
// which is the same spectral structure the "coda vowel" literature works with.
export function spectralPeaks(mag, spec, count = 3, minHz = 300) {
  const sm = new Float32Array(mag.length);
  const w = 4;
  for (let b = 0; b < mag.length; b++) {
    let s = 0, n = 0;
    for (let k = Math.max(0, b - w); k <= Math.min(mag.length - 1, b + w); k++) { s += mag[k]; n++; }
    sm[b] = s / n;
  }
  const peaks = [];
  for (let b = 2; b < sm.length - 2; b++) {
    const hz = binToHz(b, spec);
    if (hz < minHz) continue;
    if (sm[b] > sm[b - 1] && sm[b] > sm[b + 1] && sm[b] > sm[b - 2] && sm[b] > sm[b + 2]) {
      peaks.push({ hz, mag: sm[b] });
    }
  }
  peaks.sort((a, b) => b.mag - a.mag);
  return peaks.slice(0, count).sort((a, b) => a.hz - b.hz);
}

// --------------------------------------------------------------- ICI + rhythm

// The standard representation for a coda: inter-click intervals divided by the
// coda's total duration. Duration-invariant, so a slow drum pattern and a fast
// coda with the same shape land in the same place.
export function iciFeatures(onsets) {
  if (onsets.length < 2) {
    return { ici: [], iciNorm: [], duration: 0, meanIci: 0, cvIci: 0, nClicks: onsets.length, rate: 0, trend: 0 };
  }
  const ici = [];
  for (let i = 1; i < onsets.length; i++) ici.push(onsets[i] - onsets[i - 1]);
  const duration = onsets[onsets.length - 1] - onsets[0];
  const iciNorm = duration > 0 ? ici.map((v) => v / duration) : ici.map(() => 0);
  const meanIci = ici.reduce((a, b) => a + b, 0) / ici.length;
  const sd = Math.sqrt(ici.reduce((a, b) => a + (b - meanIci) ** 2, 0) / ici.length);
  const cvIci = meanIci > 0 ? sd / meanIci : 0;

  // Linear trend of ICI vs index, normalised — negative = accelerating.
  let trend = 0;
  if (ici.length > 1) {
    const n = ici.length;
    const mx = (n - 1) / 2;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (i - mx) * (ici[i] - meanIci); den += (i - mx) ** 2; }
    trend = den > 0 && meanIci > 0 ? (num / den) / meanIci : 0;
  }

  return {
    ici, iciNorm, duration, meanIci, cvIci,
    nClicks: onsets.length,
    rate: duration > 0 ? (onsets.length - 1) / duration : 0,
    trend,
  };
}

// --------------------------------------------------------------------- IPI

// Estimate the inter-pulse interval inside a single click by autocorrelating a
// short window at the loudest onset. For sperm whales this is the spermaceti
// organ's internal reflection delay, which scales with body length — it is the
// standard acoustic route to sizing an animal from its clicks.
//
// Returns null when there is no clear secondary peak, which is the honest
// answer for most non-whale material: a woodpecker strike has no multipulse
// structure to find.
// Search range is bounded to the physically plausible sperm whale IPI band
// (~2-10 ms). Via the Gordon (1991) relation this repo uses elsewhere
// (tools/asacter_ipi_check.py) that band is 7.7-19.3 m, not the "7-16 m" this
// comment claimed for a long time — and both ends are outside Gordon's own
// calibration range (Sri Lankan females and immatures, ~7.5-12 m), so treat the
// edges as nominal. Growcott et al. (2011) supersedes Gordon above ~12 m.
//
// Bounding is not tuning: a lag outside the band cannot be a spermaceti organ
// reflection whatever the autocorrelation says, and it removes the one class
// this method genuinely cannot resolve — a click train whose spacing happens to
// look like a multipulse interval. A dolphin buzz at ~12 ms spacing is exactly
// that case.
//
// But be clear about what the bound is NOT. It is a size prior, and it is
// applied before any measurement, so:
//   - every non-null return is inside the band by construction. "The values
//     were all physically plausible" restates this constant; it is not
//     evidence the estimator declined to fabricate. Do not score it.
//   - the 2 ms floor maps to ~7.7 m, so no calf or small juvenile is
//     reachable. Any size distribution this produces is censored from below.
//
// KNOWN FAILURE, measured in experiments/03-ipi-against-real-audio. A broadband
// impulse train — alternating-polarity clicks at a fixed rate, i.e. what
// propeller cavitation looks like — is NOT rejected. Synthetic trains at
// 120-450 Hz fire 8/8, all inside the band, at confidence 0.39-0.77 against
// 0.23-0.49 for real sperm whale clicks. Neither the band, nor the body-length
// check, nor the carrier guards separate them; they score BETTER than the real
// thing, so raising the confidence floor would delete whales before artefacts.
// The only thing that separates them is consistency across a set, and only if
// the artefact's rate varies. Treat a single confident IPI from vessel-adjacent
// audio as unproven.
export function estimateIpi(signal, sampleRate, onsets, { minMs = 2, maxMs = 10, carrierHz = null } = {}) {
  if (!onsets.length) return null;

  // Use the onset with the highest local energy.
  let best = onsets[0], bestE = -1;
  const win = Math.round(0.02 * sampleRate);
  for (const t of onsets) {
    const s = Math.round(t * sampleRate);
    let e = 0;
    for (let i = s; i < Math.min(signal.length, s + win); i++) e += signal[i] * signal[i];
    if (e > bestE) { bestE = e; best = t; }
  }

  // Never window past the next click. A high-rate click train (a dolphin buzz
  // at 4-6 ms spacing) is genuinely periodic at its click rate, so a fixed 20 ms
  // window autocorrelates the *train* and reports the click interval as though
  // it were a multipulse interval. Clipping at the next onset is what a human
  // analyst does by hand: measure inside one click, not across several.
  // ...and if there is NO next onset, the window cannot be bounded at all, so
  // refuse rather than fall back to the full 20 ms.
  //
  // The `Infinity` that used to sit here defeated the paragraph above it. A
  // dolphin burst pulse renders 40 clicks at 6->4 ms; spectral flux resolves
  // only 1 of them, because at that rate the train has no recoverable per-click
  // rising edge. With one onset there is no following onset to clip against, so
  // the 20 ms window swallowed roughly four dolphin clicks and autocorrelation
  // duly reported their ~6 ms spacing as an intra-click IPI — in 10 runs out of
  // 10. Via Gordon (1991) that implies a sperm whale of about 13 m. The tool was
  // fabricating a species, at its stated confidence, from a dolphin.
  //
  // A count-based guard (`onsets.length >= 2`) does NOT fix this: the bound
  // depends on whether a *later* onset exists, not on how many there are, so
  // hand-supplied onsets [t, t+0.4] still fabricate. The bound itself is the
  // guard.
  const next = onsets.find((t) => t > best + 1e-6);
  if (next == null) return null;
  const available = Math.max(0, Math.round((next - best) * sampleRate) - 8);

  const start = Math.max(0, Math.round(best * sampleRate) - Math.round(0.001 * sampleRate));
  const segLen = Math.min(win, available);
  const seg = signal.subarray(start, Math.min(signal.length, start + segLen));
  if (seg.length < 64) return null;

  const minLag = Math.round((minMs / 1000) * sampleRate);
  const maxLag = Math.min(Math.round((maxMs / 1000) * sampleRate), seg.length - 16);
  if (maxLag <= minLag) return null;

  // Every lag is normalised by the SAME full-window energy r0, even though only
  // (N - lag) products contribute at lag `lag`. That is the standard *biased*
  // autocorrelation estimator, and its triangular taper is deliberate: it damps
  // the high-variance long-lag peaks you get when few samples overlap, which is
  // one of the things keeping this function from reporting spurious 9 ms IPIs.
  //
  // ACCEPTED LIMITATION, not an oversight. The taper is steep — at the 928-sample
  // window this code sees in practice, a 10 ms peak is penalised 46% relative to
  // a 2 ms one before any signal is considered (832/928 terms at 2 ms, 448/928 at
  // 10 ms). So the estimator is least sensitive at long lags, i.e. against the
  // LARGEST animals, and its output feeds a body-length regression: a survey
  // built on this would under-detect mature males relative to females. Some
  // fraction of any non-fire rate is long-lag suppression rather than correct
  // refusal.
  //
  // Switching to a coherent per-lag normalisation (r / sqrt(e1*e2) over the
  // overlap) was measured against real ASACTER clicks and is strictly worse:
  // 16/48 firing instead of 24/48, spread 1.02 ms instead of 0.50, plus a new
  // out-of-family 2.29 ms outlier. See experiments/03-ipi-against-real-audio.
  let r0 = 0;
  for (let i = 0; i < seg.length; i++) r0 += seg[i] * seg[i];
  if (r0 <= 0) return null;

  const ac = new Float32Array(maxLag - minLag + 1);
  let bestLag = -1, bestR = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let r = 0;
    for (let i = 0; i + lag < seg.length; i++) r += seg[i] * seg[i + lag];
    r /= r0;
    ac[lag - minLag] = r;
    if (r > bestR) { bestR = r; bestLag = lag; }
  }
  // Require a genuinely periodic secondary peak, not just autocorrelation drift.
  // 0.22 sits below every whale observation across repeated runs of the
  // synthetic library (clean 0.51-0.54, heavily noised 0.24-0.47) and above the
  // sporadic low-confidence hits from broadband non-whale grains.
  if (bestLag < 0 || bestR < 0.22) return null;

  // Reject tonal material. A sustained tone correlates with itself at every
  // multiple of its carrier period, so the whole search window fills with
  // strong peaks. A real multipulse click has only the IPI and its first few
  // multiples. Without this test a pure Morse tone reports a confident-looking
  // "IPI" of whatever carrier multiple first clears the minimum lag — which is
  // exactly the kind of false positive this tool must not produce, since the
  // whale/non-whale distinction is what the IPI is being used to argue.
  let nPeaks = 0;
  for (let i = 1; i < ac.length - 1; i++) {
    if (ac[i] > ac[i - 1] && ac[i] >= ac[i + 1] && ac[i] > 0.5 * bestR) nPeaks++;
  }
  if (nPeaks > 6) return null;

  // Reject the resonance of the click itself. Any narrow-band impulsive sound
  // rings at its own centre frequency, and that ringing autocorrelates at the
  // carrier period — a 220 Hz drum hit "has an IPI" of 4.5 ms purely because
  // 1/220 Hz = 4.5 ms. A genuine multipulse interval is a reflection delay far
  // longer than one carrier cycle: a sperm whale click centred near 8 kHz with
  // a 5.5 ms IPI spans ~45 cycles.
  //
  // Two independent measures of "how many cycles fit inside the lag", because
  // neither separates on its own against the synthetic library: a drum-machine
  // mix has a high global centroid but a low-frequency loudest hit, while a
  // woodpecker strike is the reverse.
  //
  // THRESHOLDS ARE HEURISTIC. They were set by measuring the synthetic sources
  // in library.js, not derived from physics or fitted to real recordings. They
  // fail safe: a marginal real click is reported as "no IPI" rather than given
  // a fabricated value. Re-check them against real DSWP audio before relying
  // on this for anything beyond building intuition.
  const lagSec = bestLag / sampleRate;

  if (carrierHz && carrierHz > 0 && lagSec * carrierHz < 20) return null;

  let crossings = 0;
  for (let i = 1; i < seg.length; i++) if ((seg[i - 1] < 0) !== (seg[i] < 0)) crossings++;
  const zcrHz = crossings / (2 * (seg.length / sampleRate));
  if (zcrHz > 0 && lagSec * zcrHz < 3) return null;

  return { ipiMs: lagSec * 1000, confidence: bestR };
}

// ------------------------------------------------------------------ pipeline

export function analyze(signal, sampleRate, { sensitivity = 0.6, minIci = 0.03 } = {}) {
  const frameSize = 512, hop = 128;

  // Prepend a frame of silence. A click sitting at t=0 otherwise lands entirely
  // inside the first analysis frame, so there is no rising edge for spectral
  // flux to find and the first onset of every clip goes missing. The lead is
  // subtracted back off the onset times below.
  const lead = frameSize;
  const padded = new Float32Array(signal.length + lead);
  padded.set(signal, lead);
  const leadSec = lead / sampleRate;

  const spec = spectrogram(padded, sampleRate, { frameSize, hop });
  const odf = onsetEnvelope(spec);
  const onsets = detectOnsets(padded, spec, odf, { sensitivity, minIci })
    .map((t) => Math.max(0, t - leadSec));
  const clickSpec = clickSpectrum(spec);
  const stats = spectralStats(clickSpec, spec);
  return {
    spec, odf, onsets,
    ...iciFeatures(onsets),
    mel: meanLogMel(spec),
    clickSpec,
    ...stats,
    peaks: spectralPeaks(clickSpec, spec),
    ipi: estimateIpi(signal, sampleRate, onsets, { carrierHz: stats.centroid }),
    sampleRate,
    length: signal.length / sampleRate,
  };
}
