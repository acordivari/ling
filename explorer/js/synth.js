// synth.js — everything the explorer can make a sound out of.
//
// All synthesis. No recordings ship with this tool. The sperm whale click model
// is the one piece here with real structure worth understanding:
//
//   A sperm whale click is not a single impulse. Sound produced at the museau
//   de singe reflects back and forth inside the spermaceti organ, emitting a
//   decaying train of pulses (P0, P1, P2 ...) separated by the inter-pulse
//   interval (IPI). The IPI scales with the length of the organ, hence with the
//   animal's body size. In the frequency domain that pulse train is a comb, and
//   the comb is what produces the spectral peaks that the coda-vowel literature
//   analyses. Move the IPI slider and watch the "pseudo-formants" move: that
//   coupling is the point.

// --------------------------------------------------------------- filters

// RBJ biquad bandpass, applied in place, direct form I.
function bandpass(x, sr, f0, Q) {
  const w0 = (2 * Math.PI * Math.min(f0, sr / 2 - 100)) / sr;
  const alpha = Math.sin(w0) / (2 * Math.max(0.05, Q));
  const cw = Math.cos(w0);
  const a0 = 1 + alpha;
  const b0 = alpha / a0, b1 = 0, b2 = -alpha / a0;
  const a1 = (-2 * cw) / a0, a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = y;
    x[i] = y;
  }
  return x;
}

function resonator(x, sr, f0, Q, gain) {
  const copy = Float32Array.from(x);
  bandpass(copy, sr, f0, Q);
  for (let i = 0; i < x.length; i++) copy[i] *= gain;
  return copy;
}

function normalize(x, peak = 0.85) {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] = (x[i] / m) * peak;
  return x;
}

function mixInto(dst, src, offsetSamples, gain = 1) {
  for (let i = 0; i < src.length; i++) {
    const j = offsetSamples + i;
    if (j >= 0 && j < dst.length) dst[j] += src[i] * gain;
  }
}

// ------------------------------------------------------------ click grains

// Generic impulsive grain: exponentially decaying noise/tone mix through a
// resonant bandpass. Covers everything except sperm whale clicks.
export function clickGrain(sr, { durMs = 25, centerHz = 2000, q = 1.2, noise = 0.6, tauMs = null } = {}) {
  const n = Math.max(4, Math.round((durMs / 1000) * sr));
  const tau = ((tauMs ?? durMs / 3) / 1000) * sr;
  const x = new Float32Array(n);
  let phase = 0;
  const dp = (2 * Math.PI * centerHz) / sr;
  for (let i = 0; i < n; i++) {
    const env = Math.exp(-i / tau);
    const tone = Math.sin(phase);
    phase += dp;
    x[i] = env * (noise * (Math.random() * 2 - 1) + (1 - noise) * tone);
  }
  bandpass(x, sr, centerHz, q);
  return normalize(x, 1.0);
}

// Sperm whale click: a decaying train of broadband pulses spaced by the IPI.
export function spermWhaleClick(sr, { ipiMs = 5.5, nPulses = 4, pulseDecay = 0.55, centerHz = 6000, q = 0.5, pulseDurMs = 1.1 } = {}) {
  const ipi = Math.round((ipiMs / 1000) * sr);
  const pulse = clickGrain(sr, { durMs: pulseDurMs, centerHz, q, noise: 0.9, tauMs: pulseDurMs / 3.5 });
  const total = ipi * (nPulses - 1) + pulse.length + 8;
  const out = new Float32Array(total);
  for (let k = 0; k < nPulses; k++) {
    mixInto(out, pulse, k * ipi, Math.pow(pulseDecay, k));
  }
  return normalize(out, 1.0);
}

// ------------------------------------------------------------------ noise

// Pink-ish background. Relevant to the noise-artifact question in CLAUDE.md
// experiment 5: raise this and watch the spectral statistics drift.
function addNoiseFloor(out, sr, level) {
  if (level <= 0) return out;
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.0990460;
    b1 = 0.96300 * b1 + w * 0.2965164;
    b2 = 0.57000 * b2 + w * 1.0526913;
    out[i] += (b0 + b1 + b2 + w * 0.1848) * level * 0.06;
  }
  return out;
}

// ------------------------------------------------------------------- codas

// Turn a coda type from library.js into audio.
export function renderCoda(sr, coda, { ipiMs = 5.5, tempoScale = 1, jitter = 0, noiseFloor = 0, centerHz = 6000, tail = 0.35 } = {}) {
  const duration = coda.duration * tempoScale;
  const times = [0];
  for (const frac of coda.iciNorm) {
    let step = frac * duration;
    if (jitter > 0) step *= 1 + (Math.random() * 2 - 1) * jitter;
    times.push(times[times.length - 1] + step);
  }
  const totalSec = times[times.length - 1] + tail;
  const out = new Float32Array(Math.ceil(totalSec * sr));
  const click = spermWhaleClick(sr, { ipiMs, centerHz });
  times.forEach((t, i) => {
    // Slight level variation across the coda — real codas are not flat.
    const amp = 0.75 + 0.25 * Math.cos((i / Math.max(1, times.length - 1)) * Math.PI * 0.6);
    mixInto(out, click, Math.round(t * sr), amp);
  });
  addNoiseFloor(out, sr, noiseFloor);
  return { signal: normalize(out), sampleRate: sr, trueOnsets: times };
}

// ------------------------------------------------------------------ rhythms

const MORSE = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....",
  I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.",
  Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..", 0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-",
  5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----.",
};

// Keyed carrier with raised-cosine edges — this is what CW actually is. A
// flat top matters for analysis: an exponentially decaying grain fluctuates
// enough during a 200 ms dash that the flux detector retriggers mid-symbol,
// reporting far more onsets than there are Morse symbols.
function toneBurst(sr, durSec, freq, rampSec = 0.005) {
  const n = Math.max(4, Math.round(durSec * sr));
  const ramp = Math.max(1, Math.round(rampSec * sr));
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = Math.min(1, i / ramp, (n - i) / ramp);
    const env = 0.5 - 0.5 * Math.cos(Math.PI * r); // raised cosine on the edges
    x[i] = Math.sin((2 * Math.PI * freq * i) / sr) * env;
  }
  return x;
}

export function textToMorse(text) {
  return text.toUpperCase().split("").map((c) => (c === " " ? " " : MORSE[c] || "")).filter((s) => s !== "");
}

// Real Morse timing: dot = 1 unit, dash = 3, intra-character gap = 1,
// inter-character gap = 3, word gap = 7. Onsets fall at symbol starts, so the
// ICI sequence genuinely carries the message structure.
export function renderMorse(sr, { text = "WHALE", unitMs = 60, centerHz = 1400 } = {}) {
  const u = unitMs / 1000;
  const events = [];
  let t = 0;
  const chars = textToMorse(text);
  chars.forEach((code, ci) => {
    if (code === " ") { t += 7 * u; return; }
    code.split("").forEach((sym, si) => {
      const len = sym === "." ? u : 3 * u;
      events.push({ t, len });
      t += len + u; // intra-character gap
    });
    t += 2 * u; // bring the trailing 1u up to a 3u inter-character gap
  });
  const totalSec = t + 0.3;
  const out = new Float32Array(Math.ceil(totalSec * sr));
  for (const e of events) {
    mixInto(out, toneBurst(sr, e.len, centerHz), Math.round(e.t * sr));
  }
  return { signal: normalize(out), sampleRate: sr, trueOnsets: events.map((e) => e.t) };
}

// Bjorklund's algorithm — k onsets spread as evenly as possible over n steps.
export function bjorklund(k, n) {
  if (k <= 0 || n <= 0 || k > n) return new Array(Math.max(0, n)).fill(0);
  let a = Array.from({ length: k }, () => [1]);
  let b = Array.from({ length: n - k }, () => [0]);
  while (b.length > 1) {
    const m = Math.min(a.length, b.length);
    const na = [], nb = [];
    for (let i = 0; i < m; i++) na.push(a[i].concat(b[i]));
    if (a.length > m) for (let i = m; i < a.length; i++) nb.push(a[i]);
    else for (let i = m; i < b.length; i++) nb.push(b[i]);
    a = na; b = nb;
    if (a.length <= 1) break;
  }
  return a.concat(b).flat();
}

const STEP_TIMBRES = [
  null,
  { centerHz: 220, q: 1.4, durMs: 70, noise: 0.35 },  // 1 = kick
  { centerHz: 7000, q: 0.9, durMs: 18, noise: 0.95 }, // 2 = hat
  { centerHz: 1600, q: 1.0, durMs: 55, noise: 0.8 },  // 3 = snare
];

export function renderSteps(sr, steps, stepMs, { uniformTimbre = null } = {}) {
  const totalSec = (steps.length * stepMs) / 1000 + 0.35;
  const out = new Float32Array(Math.ceil(totalSec * sr));
  const onsets = [];
  steps.forEach((v, i) => {
    if (!v) return;
    const t = (i * stepMs) / 1000;
    const timbre = uniformTimbre || STEP_TIMBRES[v] || STEP_TIMBRES[1];
    mixInto(out, clickGrain(sr, timbre), Math.round(t * sr));
    onsets.push(t);
  });
  return { signal: normalize(out), sampleRate: sr, trueOnsets: onsets };
}

export function renderRhythm(sr, source, overrides = {}) {
  const p = { ...(source.params || {}), ...overrides };
  if (source.kind === "morse") return renderMorse(sr, p);
  if (source.kind === "euclid") {
    const steps = bjorklund(p.k, p.n);
    return renderSteps(sr, steps, p.stepMs, { uniformTimbre: { centerHz: 2200, q: 1.2, durMs: 30, noise: 0.6 } });
  }
  return renderSteps(sr, source.steps, overrides.stepMs || source.stepMs);
}

// ------------------------------------------------------------------ animals

export function renderAnimal(sr, a) {
  const times = [];
  if (a.kind === "accel") {
    // Geometric interpolation between start and end ICI.
    let t = 0;
    for (let i = 0; i < a.nClicks; i++) {
      times.push(t);
      const f = a.nClicks > 1 ? i / (a.nClicks - 1) : 0;
      t += a.startIci * Math.pow(a.endIci / a.startIci, f);
    }
  } else if (a.kind === "jitter") {
    let t = 0;
    for (let i = 0; i < a.nClicks; i++) {
      times.push(t);
      t += a.meanIci * (1 + (Math.random() * 2 - 1) * a.jitter);
    }
  } else if (a.kind === "random") {
    for (let i = 0; i < a.nClicks; i++) times.push(Math.random() * a.span);
    times.sort((x, y) => x - y);
  }
  const totalSec = times[times.length - 1] + 0.35;
  const out = new Float32Array(Math.ceil(totalSec * sr));
  const grain = clickGrain(sr, { centerHz: a.centerHz, q: a.q, durMs: 14, noise: 0.85 });
  times.forEach((t) => mixInto(out, grain, Math.round(t * sr)));
  return { signal: normalize(out), sampleRate: sr, trueOnsets: times };
}

// ----------------------------------------------------------- click language

const VOWEL_FORMANTS = {
  a: [730, 1090, 2440], e: [530, 1840, 2480], i: [270, 2290, 3010],
  o: [570, 840, 2410], u: [300, 870, 2240],
};

// Glottal pulse train through three parallel resonators.
//
// The glottal source is a Rosenberg pulse (smooth open phase, cosine closing)
// rather than a sharp exponential. A sharp pulse is broadband enough that the
// onset detector fires on individual glottal periods, which reports voiced
// speech as dozens of "clicks" and swamps the actual click consonants. Real
// voicing is not that impulsive, and neither is this now.
function vowelSegment(sr, vowel, durMs, f0 = 125) {
  const n = Math.round((durMs / 1000) * sr);
  const src = new Float32Array(n);
  const period = sr / f0;
  const openT = 0.4, closeT = 0.16; // fractions of the period
  for (let i = 0; i < n; i++) {
    const ph = (i % period) / period;
    let v;
    if (ph < openT) v = 0.5 * (1 - Math.cos((Math.PI * ph) / openT));
    else if (ph < openT + closeT) v = Math.cos((Math.PI * (ph - openT)) / (2 * closeT));
    else v = 0;
    src[i] = v - 0.35;
  }
  const F = VOWEL_FORMANTS[vowel] || VOWEL_FORMANTS.a;
  const out = new Float32Array(n);
  const gains = [1.0, 0.55, 0.3];
  F.forEach((f, k) => {
    const r = resonator(src, sr, f, 14, gains[k]);
    for (let i = 0; i < n; i++) out[i] += r[i];
  });
  // attack/release so segments don't click at their own boundaries
  const ramp = Math.round(0.008 * sr);
  for (let i = 0; i < n; i++) {
    out[i] *= Math.min(1, i / ramp, (n - i) / ramp);
  }
  return normalize(out, 0.55);
}

// Render an orthographic click string. Click characters become click grains
// with place-appropriate spectra; vowels become voiced segments; spaces become
// syllable gaps. The continuous voiced energy BETWEEN clicks is the whole
// point — it is what a coda does not have.
export function renderClickLanguage(sr, seq, clickTypes, { rateMs = 220, voiced = true, f0 = 125 } = {}) {
  const events = [];
  let t = 0;
  const onsets = [];
  for (const ch of seq) {
    if (ch === " ") { t += rateMs / 1000 * 0.5; continue; }
    if (clickTypes[ch]) {
      const spec = clickTypes[ch];
      events.push({ t, kind: "click", spec });
      onsets.push(t);
      t += spec.durMs / 1000;
    } else if (VOWEL_FORMANTS[ch.toLowerCase()]) {
      if (voiced) events.push({ t, kind: "vowel", v: ch.toLowerCase(), dur: rateMs * 0.75 });
      t += (rateMs * 0.75) / 1000;
    } else {
      // any other consonant letter: brief noisy burst, keeps the rhythm honest
      events.push({ t, kind: "click", spec: { centerHz: 3000, q: 1.0, durMs: 28, noise: 0.9 } });
      onsets.push(t);
      t += 0.028;
    }
  }
  const totalSec = t + 0.3;
  const out = new Float32Array(Math.ceil(totalSec * sr));
  for (const e of events) {
    if (e.kind === "click") {
      const g = clickGrain(sr, { durMs: e.spec.durMs, centerHz: e.spec.centerHz, q: e.spec.q, noise: e.spec.noise });
      mixInto(out, g, Math.round(e.t * sr), 0.9);
    } else {
      mixInto(out, vowelSegment(sr, e.v, e.dur, f0), Math.round(e.t * sr), 0.8);
    }
  }
  return { signal: normalize(out), sampleRate: sr, trueOnsets: onsets };
}
