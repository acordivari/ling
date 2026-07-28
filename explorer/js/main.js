// main.js — application wiring: source selection, synthesis, analysis, render.

import { analyze } from "./dsp.js";
import { compare, nearestCoda, describeRhythm, describeTimbre } from "./compare.js";
import {
  CODA_TYPES, CLICK_TYPES, CLICK_LANGUAGES, CLICK_EXAMPLES,
  RHYTHM_SOURCES, ANIMAL_SOURCES,
} from "./library.js";
import { renderCoda, renderRhythm, renderAnimal, renderClickLanguage } from "./synth.js";
import { drawWaveform, drawSpectrogram, drawSpectrum, drawIci, drawAlignment } from "./viz.js";

const SR = 44100;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const canvasOf = (name) => $(`[data-canvas="${name}"]`);

const state = {
  A: { signal: null, sr: SR, features: null, label: "—", origin: "synth" },
  B: { signal: null, sr: SR, features: null, label: "—", origin: "synth" },
  settings: { sensitivity: 0.6, minIci: 0.03 },
  sel: {
    coda: CODA_TYPES[0],
    rhythm: RHYTHM_SOURCES[0],
    animal: ANIMAL_SOURCES[0],
    lang: CLICK_LANGUAGES[0],
  },
  tab: "rhythm",
  rhythmParams: {},
};

// ------------------------------------------------------------------ audio

let actx = null;
function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === "suspended") actx.resume();
  return actx;
}

const playback = { A: null, B: null };

function toBuffer(ctx, signal, sr) {
  const buf = ctx.createBuffer(1, signal.length, sr);
  buf.copyToChannel(signal, 0);
  return buf;
}

function play(side, onEnded) {
  const s = state[side];
  if (!s.signal) return;
  stop(side);
  const ctx = audio();
  const src = ctx.createBufferSource();
  src.buffer = toBuffer(ctx, s.signal, s.sr);
  src.connect(ctx.destination);
  const t0 = ctx.currentTime;
  src.start();
  playback[side] = { src, t0 };
  src.onended = () => {
    if (playback[side] && playback[side].src === src) playback[side] = null;
    drawSide(side);
    if (onEnded) onEnded();
  };
  animatePlayhead(side);
}

function stop(side) {
  if (playback[side]) {
    try { playback[side].src.onended = null; playback[side].src.stop(); } catch (e) { /* already stopped */ }
    playback[side] = null;
  }
}

function animatePlayhead(side) {
  const p = playback[side];
  if (!p) return;
  const s = state[side];
  const t = audio().currentTime - p.t0;
  drawWaveform(canvasOf(`${side}-wave`), s.signal, s.sr, {
    onsets: s.features ? s.features.onsets : [],
    playhead: t,
    accent: side === "A" ? "#38bdf8" : "#fbbf24",
  });
  requestAnimationFrame(() => animatePlayhead(side));
}

// --------------------------------------------------------------- analysis

let analyzeTimer = null;
function setSignal(side, { signal, sampleRate, label, origin = "synth" }) {
  Object.assign(state[side], { signal, sr: sampleRate, label, origin });
  runAnalysis(side);
}

function runAnalysis(side) {
  const s = state[side];
  if (!s.signal) return;
  s.features = analyze(s.signal, s.sr, state.settings);
  drawSide(side);
  renderReadout(side);
  renderComparison();
}

// Slider drags re-synthesise; debounce so we do not re-run the FFT per pixel.
function scheduleRebuild(fn) {
  clearTimeout(analyzeTimer);
  analyzeTimer = setTimeout(fn, 110);
}

// ---------------------------------------------------------------- drawing

function drawSide(side) {
  const s = state[side];
  const accent = side === "A" ? "#38bdf8" : "#fbbf24";
  drawWaveform(canvasOf(`${side}-wave`), s.signal, s.sr, {
    onsets: s.features ? s.features.onsets : [], accent,
  });
  if (!s.features) return;
  drawSpectrogram(canvasOf(`${side}-spec`), s.features.spec);
  drawSpectrum(canvasOf(`${side}-spectrum`), s.features.clickSpec, s.features.spec, {
    peaks: s.features.peaks, accent,
  });
  drawIci(canvasOf(`${side}-ici`), s.features, { accent });
}

const fmtMs = (v) => `${(v * 1000).toFixed(0)}<small> ms</small>`;
const fmtHz = (v) => (v >= 1000 ? `${(v / 1000).toFixed(2)}<small> kHz</small>` : `${v.toFixed(0)}<small> Hz</small>`);

function renderReadout(side) {
  const f = state[side].features;
  const el = $(`[data-readout="${side}"]`);
  if (!f) { el.innerHTML = ""; return; }

  const trendLabel = f.ici.length < 2 ? "—"
    : f.trend < -0.08 ? "accelerating"
    : f.trend > 0.08 ? "decelerating" : "steady";

  const ipi = f.ipi
    ? `${f.ipi.ipiMs.toFixed(2)}<small> ms · r=${f.ipi.confidence.toFixed(2)}</small>`
    : `none<small> detected</small>`;

  const tiles = [
    ["clicks", `${f.nClicks}`],
    ["coda span", f.duration ? `${f.duration.toFixed(2)}<small> s</small>` : "—"],
    ["mean ICI", f.meanIci ? fmtMs(f.meanIci) : "—"],
    ["click rate", f.rate ? `${f.rate.toFixed(1)}<small> /s</small>` : "—"],
    ["regularity CV", f.ici.length ? f.cvIci.toFixed(3) : "—"],
    ["ICI contour", trendLabel],
    ["centroid", fmtHz(f.centroid)],
    ["85% rolloff", fmtHz(f.rolloff)],
    ["flatness", f.flatness.toFixed(3)],
    ["est. IPI", ipi],
    ["spectral peaks", f.peaks.length ? f.peaks.map((p) => (p.hz / 1000).toFixed(1)).join(" / ") + "<small> kHz</small>" : "—"],
    ["source", `<small>${state[side].origin === "file" ? "loaded audio" : state[side].origin === "mic" ? "recording" : "synthesised"}</small>`],
  ];

  el.innerHTML = tiles.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
}

// ------------------------------------------------------------- comparison

function bucket(v, mid, far) {
  return v < mid ? "close" : v < far ? "mid" : "far";
}

function setMetric(name, value, display, scale, thresholds) {
  const el = $(`[data-metric="${name}"]`);
  el.classList.remove("close", "mid", "far");
  const val = $(".mval", el);
  const bar = $(".bar i", el);
  if (value == null || !isFinite(value)) {
    val.textContent = "—";
    bar.style.width = "0%";
    return;
  }
  val.textContent = display;
  bar.style.width = `${Math.min(100, (value / scale) * 100).toFixed(1)}%`;
  el.classList.add(bucket(value, thresholds[0], thresholds[1]));
}

function renderComparison() {
  const fa = state.A.features, fb = state.B.features;
  const alignCanvas = canvasOf("align");

  if (!fa || !fb) {
    drawAlignment(alignCanvas, fa, fb, []);
    return;
  }

  const cmp = compare(fa, fb);

  setMetric("rhythm", cmp.rhythm, cmp.rhythm.toFixed(4), 0.25, [0.05, 0.12]);
  setMetric("timbre", cmp.timbre, cmp.timbre.toFixed(4), 1.0, [0.20, 0.45]);
  setMetric("tempo", cmp.tempo, cmp.tempo == null ? "—" : `${cmp.tempo.toFixed(2)}`, 2.0, [0.35, 0.9]);
  setMetric("regularity", cmp.regularity, cmp.regularity.toFixed(3), 1.0, [0.15, 0.4]);

  drawAlignment(alignCanvas, fa, fb, cmp.rhythmPath);

  // nearest coda types to B
  const near = nearestCoda(fb.iciNorm, CODA_TYPES, 3);
  const list = $("#nearestList");
  list.innerHTML = near.length
    ? near.map((n) => `<li><strong>${n.coda.label}</strong> <span class="d">d=${n.d.toFixed(4)} · ${n.coda.clan}</span></li>`).join("")
    : `<li class="empty">no intervals detected in B</li>`;

  $("#interpText").className = "";
  $("#interpText").innerHTML = interpret(fa, fb, cmp, near);
}

// Turn the numbers into a sentence or two. Deliberately hedged: this tool
// measures DSP proxies, so the language stays descriptive rather than causal.
function interpret(fa, fb, cmp, near) {
  const parts = [];
  const isLang = state.tab === "clicklang" && state.B.origin === "synth";

  if (fb.nClicks < 2) {
    return "B has fewer than two detected onsets, so there is no interval structure to compare. " +
           "Raise onset sensitivity or lower the minimum interval in the top bar.";
  }

  parts.push(
    `<strong>${describeRhythm(cmp.rhythm)}</strong> (d=${cmp.rhythm.toFixed(3)}) and ` +
    `<strong>${describeTimbre(cmp.timbre)}</strong> (d=${cmp.timbre.toFixed(3)}).`
  );

  // The structure-vs-timbre split — the distinction CLAUDE.md experiment 2 turns on.
  if (cmp.rhythm < 0.05 && cmp.timbre > 0.35) {
    parts.push(
      "Timing lines up while spectrum does not: these two share a rhythmic shape but nothing about " +
      "their sound. That dissociation is the thing worth testing on the real model — if acoustic " +
      "translation preserves this shape it learned a timbre, and if it collapses onto canonical coda " +
      "rhythms regardless it learned something closer to a grammar."
    );
  } else if (cmp.rhythm > 0.12 && cmp.timbre < 0.15) {
    parts.push(
      "Spectrum is close while timing is not — similar texture, unrelated structure. Usually means both " +
      "sides are broadband impulsive material with different grouping."
    );
  }

  if (cmp.tempo != null && cmp.tempo > 0.9 && cmp.rhythm < 0.05) {
    parts.push(
      `Note the tempo gap (|log ratio| = ${cmp.tempo.toFixed(2)}, roughly ` +
      `${Math.exp(cmp.tempo).toFixed(1)}× apart) despite matched shape. The rhythm metric is ` +
      "duration-normalised, so it cannot see this by design — that is why tempo is reported separately."
    );
  }

  // IPI: the one structural feature that is genuinely whale-specific.
  if (fa.ipi && !fb.ipi) {
    parts.push(
      `A shows multipulse structure (IPI ≈ ${fa.ipi.ipiMs.toFixed(2)} ms, r=${fa.ipi.confidence.toFixed(2)}) ` +
      "and B shows none. In a real click that interval is the spermaceti organ's reflection delay, " +
      "which scales with body length. Treat it as suggestive rather than diagnostic: autocorrelation " +
      "cannot separate one click with a 6 ms internal echo from two clicks 6 ms apart, so a fast click " +
      "train can register a spurious IPI. Low r values are where that happens."
    );
  }

  if (isLang) {
    parts.push(
      "<strong>Expect a null here.</strong> The click-language panel renders velaric ingressive " +
      "consonants embedded in voiced syllables. Sperm whale clicks are pneumatic broadband pulses " +
      "that pattern as vowel-like carriers. Any closeness in these numbers reflects both signals " +
      "being impulsive, not a shared linguistic category — “click” is a false cognate across the two."
    );
  }

  if (near.length && near[0].d < 0.03) {
    parts.push(
      `B's rhythm falls within ${near[0].d.toFixed(3)} of coda type <strong>${near[0].coda.label}</strong>. ` +
      "Before reading anything into that, check how many unrelated sources also land there — the coda " +
      "shape space is small enough that arbitrary rhythms hit it often."
    );
  }

  return parts.join(" ");
}

// ----------------------------------------------------------- panel A build

function rebuildA() {
  const opts = {
    ipiMs: +$("#ipi").value,
    tempoScale: +$("#tempo").value,
    jitter: +$("#jitter").value,
    noiseFloor: +$("#noise").value,
  };
  const { signal, sampleRate } = renderCoda(SR, state.sel.coda, opts);
  setSignal("A", { signal, sampleRate, label: state.sel.coda.label, origin: "synth" });
}

function buildCodaGrid() {
  const grid = $("#codaGrid");
  grid.innerHTML = CODA_TYPES.map(
    (c) => `<button class="chip" data-coda="${c.id}">${c.label}<span class="clan">${c.clan.split(" ")[0]}</span></button>`
  ).join("");
  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-coda]");
    if (!btn) return;
    state.sel.coda = CODA_TYPES.find((c) => c.id === btn.dataset.coda);
    syncCodaGrid();
    rebuildA();
  });
  syncCodaGrid();
}

function syncCodaGrid() {
  $$("#codaGrid .chip").forEach((b) => b.classList.toggle("active", b.dataset.coda === state.sel.coda.id));
  $("#codaNote").textContent = state.sel.coda.note;
}

// ----------------------------------------------------------- panel B build

function rebuildB() {
  if (state.tab === "rhythm") {
    const src = state.sel.rhythm;
    const overrides = state.rhythmParams[src.id] || {};
    const { signal, sampleRate } = renderRhythm(SR, src, overrides);
    setSignal("B", { signal, sampleRate, label: src.label, origin: "synth" });
  } else if (state.tab === "animal") {
    const { signal, sampleRate } = renderAnimal(SR, state.sel.animal);
    setSignal("B", { signal, sampleRate, label: state.sel.animal.label, origin: "synth" });
  } else if (state.tab === "clicklang") {
    const seq = $("#clickSeq").value;
    const { signal, sampleRate } = renderClickLanguage(SR, seq, CLICK_TYPES, {
      rateMs: +$("#clickRate").value,
      voiced: $("#voiced").checked,
    });
    setSignal("B", { signal, sampleRate, label: `${state.sel.lang.name}: ${seq}`, origin: "synth" });
  }
  // "mic" tab does not synthesise — it waits for a recording.
}

function buildRhythmTab() {
  const grid = $("#rhythmGrid");
  grid.innerHTML = RHYTHM_SOURCES.map(
    (r) => `<button class="chip" data-rhythm="${r.id}">${r.label}</button>`
  ).join("");
  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-rhythm]");
    if (!btn) return;
    state.sel.rhythm = RHYTHM_SOURCES.find((r) => r.id === btn.dataset.rhythm);
    syncRhythmTab();
    rebuildB();
  });
  syncRhythmTab();
}

function syncRhythmTab() {
  const src = state.sel.rhythm;
  $$("#rhythmGrid .chip").forEach((b) => b.classList.toggle("active", b.dataset.rhythm === src.id));
  $("#rhythmNote").textContent = src.note;

  const p = { ...(src.params || {}), ...(state.rhythmParams[src.id] || {}) };
  const host = $("#rhythmControls");
  const rows = [];

  if (src.kind === "morse") {
    rows.push(`<label class="text-input" style="grid-template-columns:1fr">text
      <input type="text" data-rp="text" value="${p.text}" spellcheck="false"></label>`);
    rows.push(slider("unit", "unitMs", p.unitMs, 20, 160, 5, "ms"));
  } else if (src.kind === "euclid") {
    rows.push(slider("onsets k", "k", p.k, 1, 16, 1, ""));
    rows.push(slider("steps n", "n", p.n, 2, 24, 1, ""));
    rows.push(slider("step", "stepMs", p.stepMs, 30, 250, 5, "ms"));
  } else {
    rows.push(slider("step", "stepMs", p.stepMs ?? src.stepMs, 40, 260, 5, "ms"));
  }
  host.innerHTML = rows.join("");

  host.oninput = (e) => {
    const key = e.target.dataset.rp;
    if (!key) return;
    const val = e.target.type === "text" ? e.target.value : +e.target.value;
    state.rhythmParams[src.id] = { ...(state.rhythmParams[src.id] || {}), [key]: val };
    const out = e.target.parentElement.querySelector("output");
    if (out) out.textContent = `${val}${e.target.dataset.unit || ""}`;
    scheduleRebuild(rebuildB);
  };

  // Euclidean pattern is worth showing as a string — it is the whole point.
  if (src.kind === "euclid") {
    $("#rhythmNote").textContent = `${src.note}  E(${p.k},${p.n})`;
  }
}

function slider(label, key, value, min, max, step, unit) {
  return `<label>${label}
    <input type="range" data-rp="${key}" data-unit="${unit}" min="${min}" max="${max}" step="${step}" value="${value}">
    <output>${value}${unit}</output></label>`;
}

function buildClickTab() {
  $("#langGrid").innerHTML = CLICK_LANGUAGES.map(
    (l) => `<button class="chip" data-lang="${l.id}">${l.name}</button>`
  ).join("");
  $("#langGrid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-lang]");
    if (!btn) return;
    state.sel.lang = CLICK_LANGUAGES.find((l) => l.id === btn.dataset.lang);
    syncClickTab();
    rebuildB();
  });

  $("#clickExamples").innerHTML = CLICK_EXAMPLES.map(
    (x) => `<button class="chip" data-ex="${x.id}">${x.label}</button>`
  ).join("");
  $("#clickExamples").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ex]");
    if (!btn) return;
    const ex = CLICK_EXAMPLES.find((x) => x.id === btn.dataset.ex);
    $("#clickSeq").value = ex.seq;
    $("#langNote").textContent = ex.note;
    rebuildB();
  });

  $("#clickPalette").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-click]");
    if (!btn) return;
    const input = $("#clickSeq");
    const ch = btn.dataset.click;
    const s = input.selectionStart ?? input.value.length;
    input.value = input.value.slice(0, s) + ch + input.value.slice(input.selectionEnd ?? s);
    input.focus();
    input.setSelectionRange(s + ch.length, s + ch.length);
    rebuildB();
  });

  $("#clickSeq").addEventListener("input", () => scheduleRebuild(rebuildB));
  $("#clickRate").addEventListener("input", (e) => {
    $("#clickRateOut").textContent = `${e.target.value} ms`;
    scheduleRebuild(rebuildB);
  });
  $("#voiced").addEventListener("change", rebuildB);

  syncClickTab();
}

function syncClickTab() {
  const lang = state.sel.lang;
  $$("#langGrid .chip").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang.id));
  $("#clickPalette").innerHTML = lang.clicks.map((c) => {
    const t = CLICK_TYPES[c];
    return `<button class="chip" data-click="${c}" title="${t.name} — ${t.desc}">${c}</button>`;
  }).join("");
  $("#langNote").textContent = lang.note;
}

function buildAnimalTab() {
  $("#animalGrid").innerHTML = ANIMAL_SOURCES.map(
    (a) => `<button class="chip" data-animal="${a.id}">${a.label}${a.promptKey ? `<span class="clan">prompt: ${a.promptKey}</span>` : ""}</button>`
  ).join("");
  $("#animalGrid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-animal]");
    if (!btn) return;
    state.sel.animal = ANIMAL_SOURCES.find((a) => a.id === btn.dataset.animal);
    syncAnimalTab();
    rebuildB();
  });
  syncAnimalTab();
}

function syncAnimalTab() {
  $$("#animalGrid .chip").forEach((b) => b.classList.toggle("active", b.dataset.animal === state.sel.animal.id));
  $("#animalNote").textContent = state.sel.animal.note;
}

// ------------------------------------------------------------ file + mic

async function loadFile(side, file) {
  const ctx = audio();
  const buf = await ctx.decodeAudioData(await file.arrayBuffer());
  // Mix to mono — every analysis path here is single-channel.
  const n = buf.length;
  const mono = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += ch[i] / buf.numberOfChannels;
  }
  setSignal(side, { signal: mono, sampleRate: buf.sampleRate, label: file.name, origin: "file" });
}

function wireFiles() {
  ["A", "B"].forEach((side) => {
    const input = $(`[data-fileinput="${side}"]`);
    $(`[data-file="${side}"]`).addEventListener("click", () => input.click());
    input.addEventListener("change", (e) => {
      if (e.target.files[0]) loadFile(side, e.target.files[0]).catch(reportDecodeError);
    });

    const panel = $(`.panel-${side.toLowerCase()}`);
    panel.addEventListener("dragover", (e) => { e.preventDefault(); panel.classList.add("dragover"); });
    panel.addEventListener("dragleave", () => panel.classList.remove("dragover"));
    panel.addEventListener("drop", (e) => {
      e.preventDefault();
      panel.classList.remove("dragover");
      const f = e.dataTransfer.files[0];
      if (f) loadFile(side, f).catch(reportDecodeError);
    });
  });
}

function reportDecodeError(err) {
  console.error(err);
  alert("Could not decode that file. WAV, MP3, FLAC and M4A generally work; some WAV variants (24-bit fixed, certain codecs) do not decode in-browser.");
}

let recorder = null;
function wireMic() {
  const btn = $("#recBtn");
  const status = $("#recStatus");
  btn.addEventListener("click", async () => {
    if (recorder && recorder.state === "recording") {
      recorder.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        btn.classList.remove("on");
        btn.textContent = "● Record";
        status.textContent = "decoding…";
        const blob = new Blob(chunks, { type: recorder.mimeType });
        const ctx = audio();
        const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
        setSignal("B", {
          signal: buf.getChannelData(0).slice(),
          sampleRate: buf.sampleRate,
          label: "recording", origin: "mic",
        });
        status.textContent = `${buf.duration.toFixed(1)}s captured`;
      };
      recorder.start();
      btn.classList.add("on");
      btn.textContent = "■ Stop";
      status.textContent = "recording…";
    } catch (err) {
      // Signal processing note: browsers block getUserMedia off localhost/HTTPS.
      status.textContent = "microphone unavailable — needs localhost or HTTPS";
      console.error(err);
    }
  });
}

// ---------------------------------------------------------------- chrome

function wireTabs() {
  $("#tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    state.tab = btn.dataset.tab;
    $$("#tabs button").forEach((b) => b.classList.toggle("active", b === btn));
    $$(".pane").forEach((p) => p.classList.toggle("active", p.dataset.pane === state.tab));
    rebuildB();
  });
}

function wireSettings() {
  const s = $("#sensitivity"), m = $("#minIci");
  s.addEventListener("input", () => {
    state.settings.sensitivity = +s.value;
    $("#sensitivityOut").textContent = (+s.value).toFixed(2);
    scheduleRebuild(() => { runAnalysis("A"); runAnalysis("B"); });
  });
  m.addEventListener("input", () => {
    state.settings.minIci = +m.value;
    $("#minIciOut").textContent = `${Math.round(m.value * 1000)} ms`;
    scheduleRebuild(() => { runAnalysis("A"); runAnalysis("B"); });
  });
}

function wirePanelAControls() {
  const map = [
    ["#ipi", "#ipiOut", (v) => `${(+v).toFixed(1)} ms`],
    ["#tempo", "#tempoOut", (v) => `${(+v).toFixed(2)}×`],
    ["#jitter", "#jitterOut", (v) => `${Math.round(v * 100)}%`],
    ["#noise", "#noiseOut", (v) => `${Math.round(v * 100)}%`],
  ];
  map.forEach(([sel, out, fmt]) => {
    const el = $(sel);
    el.addEventListener("input", () => {
      $(out).textContent = fmt(el.value);
      scheduleRebuild(rebuildA);
    });
  });
}

function wireTransport() {
  $$("[data-play]").forEach((b) => b.addEventListener("click", () => play(b.dataset.play)));
  $("#playBoth").addEventListener("click", () => {
    play("A", () => setTimeout(() => play("B"), 220));
  });
}

function wireProvenance() {
  $("#provDismiss").addEventListener("click", () => $("#provenance").classList.add("hidden"));
}

let resizeTimer = null;
function wireResize() {
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      drawSide("A"); drawSide("B"); renderComparison();
    }, 120);
  });
}

// ------------------------------------------------------------------ init

buildCodaGrid();
buildRhythmTab();
buildClickTab();
buildAnimalTab();
wireTabs();
wireSettings();
wirePanelAControls();
wireTransport();
wireFiles();
wireMic();
wireProvenance();
wireResize();

rebuildA();
rebuildB();
