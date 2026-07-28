// viz.js — canvas rendering. All plots are HiDPI-aware and redraw on resize.

// Prepare a canvas for device-pixel-ratio-correct drawing. Returns a context
// already scaled to CSS pixels, plus the CSS-pixel dimensions.
function setup(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 300;
  const h = canvas.clientHeight || 100;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

const EMPTY_MSG = "no signal";

function drawEmpty(ctx, w, h, msg = EMPTY_MSG) {
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(msg, w / 2, h / 2);
  ctx.textAlign = "start";
}

// ---------------------------------------------------------------- waveform

export function drawWaveform(canvas, signal, sampleRate, { onsets = [], playhead = null, accent = "#38bdf8" } = {}) {
  const { ctx, w, h } = setup(canvas);
  if (!signal || !signal.length) return drawEmpty(ctx, w, h);

  const mid = h / 2;
  const spp = signal.length / w; // samples per pixel

  // min/max envelope per column
  ctx.fillStyle = accent;
  for (let x = 0; x < w; x++) {
    const s0 = Math.floor(x * spp);
    const s1 = Math.min(signal.length, Math.floor((x + 1) * spp));
    let lo = 0, hi = 0;
    for (let i = s0; i < s1; i++) {
      const v = signal[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const y0 = mid - hi * mid * 0.92;
    const y1 = mid - lo * mid * 0.92;
    ctx.fillRect(x, y0, 1, Math.max(1, y1 - y0));
  }

  // zero line
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();

  // detected onsets
  const dur = signal.length / sampleRate;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.setLineDash([2, 3]);
  for (const t of onsets) {
    const x = (t / dur) * w;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  ctx.setLineDash([]);

  if (playhead != null && dur > 0) {
    const x = (playhead / dur) * w;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
}

// ------------------------------------------------------------- spectrogram

// Shared perceptual ramp for both panels — comparing spectrograms across
// panels only means something if the colour mapping is identical.
const RAMP = [
  [0, 0, 4], [40, 11, 84], [101, 21, 110], [159, 42, 99],
  [212, 72, 66], [245, 125, 21], [250, 193, 39], [252, 255, 164],
];

function ramp(v) {
  const t = Math.max(0, Math.min(1, v)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(t));
  const f = t - i;
  const a = RAMP[i], b = RAMP[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export function drawSpectrogram(canvas, spec, { dynamicRange = 55 } = {}) {
  const { ctx, w, h } = setup(canvas);
  if (!spec || !spec.frames.length) return drawEmpty(ctx, w, h);

  const nyq = spec.sampleRate / 2;
  const fmin = 80;
  const logMin = Math.log(fmin), logMax = Math.log(nyq);

  // peak for normalisation
  let peak = 1e-9;
  for (const f of spec.frames) for (let b = 0; b < f.length; b++) if (f[b] > peak) peak = f[b];

  const img = ctx.createImageData(Math.round(w), Math.round(h));
  const W = Math.round(w), H = Math.round(h);

  for (let x = 0; x < W; x++) {
    const fi = Math.min(spec.frames.length - 1, Math.floor((x / W) * spec.frames.length));
    const frame = spec.frames[fi];
    for (let y = 0; y < H; y++) {
      // log frequency axis, low frequencies at the bottom
      const fr = 1 - y / H;
      const hz = Math.exp(logMin + (logMax - logMin) * fr);
      const bin = Math.min(frame.length - 1, Math.round((hz / nyq) * (frame.length - 1)));
      const db = 20 * Math.log10(frame[bin] / peak + 1e-9);
      const v = (db + dynamicRange) / dynamicRange;
      const [r, g, b] = ramp(v);
      const o = (y * W + x) * 4;
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // frequency gridlines
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.lineWidth = 1;
  for (const hz of [100, 1000, 5000, 10000, 20000]) {
    if (hz >= nyq) continue;
    const y = H * (1 - (Math.log(hz) - logMin) / (logMax - logMin));
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.fillText(hz >= 1000 ? `${hz / 1000}k` : `${hz}`, 3, y - 2);
  }
}

// ---------------------------------------------------------------- spectrum

export function drawSpectrum(canvas, mag, spec, { peaks = [], accent = "#38bdf8" } = {}) {
  const { ctx, w, h } = setup(canvas);
  if (!mag || !mag.length) return drawEmpty(ctx, w, h);

  const nyq = spec.sampleRate / 2;
  const fmin = 80;
  const logMin = Math.log(fmin), logMax = Math.log(nyq);

  let peak = 1e-9;
  for (let b = 0; b < mag.length; b++) if (mag[b] > peak) peak = mag[b];

  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  let started = false;
  for (let x = 0; x < w; x++) {
    const hz = Math.exp(logMin + (logMax - logMin) * (x / w));
    const bin = Math.min(mag.length - 1, Math.round((hz / nyq) * (mag.length - 1)));
    const db = 20 * Math.log10(mag[bin] / peak + 1e-9);
    const y = h - ((db + 60) / 60) * h;
    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // pseudo-formant markers
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.setLineDash([2, 2]);
  peaks.forEach((p) => {
    if (p.hz < fmin) return;
    const x = ((Math.log(p.hz) - logMin) / (logMax - logMin)) * w;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    ctx.fillText(`${(p.hz / 1000).toFixed(1)}k`, x + 3, 10);
  });
  ctx.setLineDash([]);
}

// --------------------------------------------------------------- ICI plot

// Two stacked views: a click-tick timeline, and the ICI contour (interval
// duration against interval index). The contour is the shape that coda
// notation is actually naming.
export function drawIci(canvas, f, { accent = "#38bdf8" } = {}) {
  const { ctx, w, h } = setup(canvas);
  if (!f || !f.onsets || f.onsets.length < 2) {
    return drawEmpty(ctx, w, h, f && f.onsets && f.onsets.length === 1 ? "1 onset — no intervals" : "no onsets detected");
  }

  const padL = 30, padR = 8, padT = 6, padB = 16;
  const tickH = 26;
  const plotW = w - padL - padR;

  // --- click tick timeline ---
  const t0 = f.onsets[0], span = f.duration || 1;
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath(); ctx.moveTo(padL, padT + tickH); ctx.lineTo(w - padR, padT + tickH); ctx.stroke();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  f.onsets.forEach((t) => {
    const x = padL + ((t - t0) / span) * plotW;
    ctx.beginPath(); ctx.moveTo(x, padT + 4); ctx.lineTo(x, padT + tickH); ctx.stroke();
  });
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(`${f.nClicks} clicks / ${span.toFixed(2)}s`, padL, padT + tickH + 11);

  // --- ICI contour ---
  const cy0 = padT + tickH + 18;
  const cy1 = h - padB;
  const ch = cy1 - cy0;
  if (ch < 12) return;

  const maxIci = Math.max(...f.ici);
  const n = f.ici.length;
  const xAt = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v) => cy1 - (v / (maxIci || 1)) * ch * 0.9;

  // axis
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, cy0); ctx.lineTo(padL, cy1); ctx.lineTo(w - padR, cy1); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText(`${(maxIci * 1000).toFixed(0)}ms`, 2, cy0 + 8);
  ctx.fillText("0", 2, cy1);

  // contour
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  f.ici.forEach((v, i) => (i === 0 ? ctx.moveTo(xAt(i), yAt(v)) : ctx.lineTo(xAt(i), yAt(v))));
  ctx.stroke();
  ctx.fillStyle = accent;
  f.ici.forEach((v, i) => {
    ctx.beginPath(); ctx.arc(xAt(i), yAt(v), 2.75, 0, Math.PI * 2); ctx.fill();
  });
}

// ------------------------------------------------------- comparison overlay

// Both normalised ICI contours on one axis, with DTW alignment lines showing
// which interval on the left was matched to which on the right.
export function drawAlignment(canvas, fa, fb, path, { accentA = "#38bdf8", accentB = "#fbbf24" } = {}) {
  const { ctx, w, h } = setup(canvas);
  if (!fa || !fb || !fa.iciNorm.length || !fb.iciNorm.length) {
    return drawEmpty(ctx, w, h, "need onsets on both sides");
  }

  const padL = 34, padR = 10, padT = 14, padB = 20;
  const plotW = w - padL - padR;
  const laneH = (h - padT - padB) / 2;
  const gap = 18;

  const maxV = Math.max(...fa.iciNorm, ...fb.iciNorm) || 1;
  const mk = (arr, top, hgt) => {
    const n = arr.length;
    return arr.map((v, i) => ({
      x: padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW),
      y: top + hgt - (v / maxV) * hgt * 0.85,
      v,
    }));
  };

  const A = mk(fa.iciNorm, padT, laneH - gap / 2);
  const B = mk(fb.iciNorm, padT + laneH + gap / 2, laneH - gap / 2);

  // alignment lines first, behind the contours
  ctx.strokeStyle = "rgba(167,139,250,0.4)";
  ctx.lineWidth = 1;
  for (const [i, j] of path) {
    if (!A[i] || !B[j]) continue;
    ctx.beginPath();
    ctx.moveTo(A[i].x, A[i].y);
    ctx.lineTo(B[j].x, B[j].y);
    ctx.stroke();
  }

  const contour = (pts, color, label) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.fillStyle = color;
    pts.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill(); });
    ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(label, 3, pts[0].y);
  };

  contour(A, accentA, "A");
  contour(B, accentB, "B");

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("normalised ICI (fraction of total duration) — interval index →", padL, h - 6);
}
