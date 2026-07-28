// library.js — the reference material the explorer draws on.
//
// PROVENANCE, PLEASE READ:
// The coda entries below are *stylised renderings of published coda notation*,
// not measurements of recordings. Coda notation (e.g. "1+1+3", "5R1") specifies
// a click count and a rhythm class; the normalised inter-click intervals here
// are a reasonable realisation of each class, not ground truth from DSWP.
// They are useful for building intuition about rhythm space and for exercising
// the analysis path. They are NOT a substitute for real audio — drop actual
// DSWP / Watkins WAVs into either panel to analyse the real thing.

// --------------------------------------------------------------- coda types
// iciNorm: inter-click intervals as a fraction of total coda duration (sums to 1)
// duration: nominal total coda duration in seconds
// Coda naming follows the standard convention: "5R1" = 5 clicks, regular,
// variant 1; "1+1+3" = two isolated clicks then a rapid triplet.

export const CODA_TYPES = [
  // --- Eastern Caribbean (EC1) clan — the Dominica/DSWP repertoire ---
  {
    id: "1+1+3", label: "1+1+3", clan: "EC1 (Caribbean)",
    note: "EC1 clan identity coda. Two isolated clicks, then a rapid triplet.",
    iciNorm: [0.35, 0.35, 0.15, 0.15], duration: 1.0,
  },
  {
    id: "5R1", label: "5R1", clan: "EC1 (Caribbean)",
    note: "Five evenly spaced clicks, fast variant.",
    iciNorm: [0.25, 0.25, 0.25, 0.25], duration: 0.68,
  },
  {
    id: "5R2", label: "5R2", clan: "EC1 (Caribbean)",
    note: "Same shape as 5R1, slower. Identical under duration-normalised rhythm distance — a useful demonstration of what that metric cannot see.",
    iciNorm: [0.25, 0.25, 0.25, 0.25], duration: 0.95,
  },
  {
    id: "5R3", label: "5R3", clan: "EC1 (Caribbean)",
    note: "Five regular clicks, slowest variant.",
    iciNorm: [0.25, 0.25, 0.25, 0.25], duration: 1.25,
  },
  {
    id: "4R1", label: "4R1", clan: "EC1 (Caribbean)",
    note: "Four regular clicks, fast.",
    iciNorm: [1 / 3, 1 / 3, 1 / 3], duration: 0.5,
  },
  {
    id: "4R2", label: "4R2", clan: "EC1 (Caribbean)",
    note: "Four regular clicks, mid tempo.",
    iciNorm: [1 / 3, 1 / 3, 1 / 3], duration: 0.75,
  },
  {
    id: "3R1", label: "3R1", clan: "EC1 (Caribbean)",
    note: "Three regular clicks. Short codas carry little rhythmic information.",
    iciNorm: [0.5, 0.5], duration: 0.32,
  },
  {
    id: "2+3", label: "2+3", clan: "EC1 (Caribbean)",
    note: "A pair, a gap, then a triplet.",
    iciNorm: [0.15, 0.45, 0.20, 0.20], duration: 0.9,
  },
  {
    id: "1+2+2", label: "1+2+2", clan: "EC1 (Caribbean)",
    note: "Isolated click, then two pairs.",
    iciNorm: [0.33, 0.14, 0.33, 0.20], duration: 1.0,
  },
  {
    id: "1+3", label: "1+3", clan: "EC1 (Caribbean)",
    note: "One isolated click, then a triplet.",
    iciNorm: [0.5, 0.25, 0.25], duration: 0.7,
  },

  // --- "Regular" / Pacific-style clans: long regular codas and "+1" endings ---
  {
    id: "4+1", label: "4+1", clan: "Regular (Pacific)",
    note: "Four regular clicks then a delayed final click. The '+1' ending is a clan-diagnostic pattern.",
    iciNorm: [0.18, 0.18, 0.18, 0.46], duration: 1.1,
  },
  {
    id: "8+1", label: "8+1", clan: "Regular (Pacific)",
    note: "Eight regular clicks then a delayed final click.",
    iciNorm: [0.093, 0.093, 0.093, 0.093, 0.093, 0.093, 0.093, 0.349], duration: 1.6,
  },
  {
    id: "7R", label: "7R", clan: "Regular (Pacific)",
    note: "Seven evenly spaced clicks.",
    iciNorm: [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6], duration: 1.1,
  },
  {
    id: "9R", label: "9R", clan: "Regular (Pacific)",
    note: "Nine evenly spaced clicks — long regular codas dominate some Pacific clan repertoires.",
    iciNorm: new Array(8).fill(1 / 8), duration: 1.5,
  },
  {
    id: "10R", label: "10R", clan: "Regular (Pacific)",
    note: "Ten evenly spaced clicks.",
    iciNorm: new Array(9).fill(1 / 9), duration: 1.7,
  },

  // --- shapes with clear internal contour, useful as rhythm-probe targets ---
  {
    id: "3+1", label: "3+1", clan: "Contour",
    note: "Triplet then a delayed click. Decelerating contour.",
    iciNorm: [0.2, 0.2, 0.6], duration: 0.8,
  },
  {
    id: "2+1", label: "2+1", clan: "Contour",
    note: "A pair then a delayed click. Shortest asymmetric shape.",
    iciNorm: [0.3, 0.7], duration: 0.6,
  },
  {
    id: "accel-6", label: "6 accel.", clan: "Contour",
    note: "Six clicks with monotonically shortening intervals. Not a standard notation class — included as a rhythm-space probe.",
    iciNorm: [0.32, 0.25, 0.19, 0.14, 0.10], duration: 1.0,
  },
  {
    id: "decel-6", label: "6 decel.", clan: "Contour",
    note: "Six clicks with monotonically lengthening intervals. Mirror image of the accelerating probe.",
    iciNorm: [0.10, 0.14, 0.19, 0.25, 0.32], duration: 1.0,
  },
];

// ------------------------------------------------------------ click language
// Click consonant inventories. The synthesis targets (centre frequency, Q,
// duration, noisiness) are approximations of the acoustic descriptions in the
// Ladefoged & Traill work on !Xoo: abrupt clicks (bilabial, alveolar, palatal)
// have short transient bursts; affricated clicks (dental, lateral) are longer
// and noisier.
//
// The linguistic point this panel exists to make: these are velaric INGRESSIVE
// CONSONANTS produced in the oral cavity. Sperm whale clicks are pneumatically
// driven broadband pulses that pattern as vowel-like carriers. "Click" is a
// false cognate across the two domains — see CLAUDE.md experiment 4.

export const CLICK_TYPES = {
  "ʘ": { name: "bilabial", centerHz: 700, q: 1.2, durMs: 35, noise: 0.35, desc: "Lip smack. Weak, low-frequency burst." },
  "ǀ": { name: "dental", centerHz: 5200, q: 0.8, durMs: 75, noise: 0.85, desc: "Affricated 'tsk'. Long, noisy, high-frequency." },
  "ǃ": { name: "alveolar", centerHz: 1400, q: 1.6, durMs: 30, noise: 0.3, desc: "Abrupt 'pop'. Loud, low-frequency dominant." },
  "ǂ": { name: "palatal", centerHz: 3200, q: 1.4, durMs: 32, noise: 0.4, desc: "Abrupt, sharp, mid-high burst." },
  "ǁ": { name: "lateral", centerHz: 2400, q: 0.9, durMs: 70, noise: 0.8, desc: "Affricated lateral release. Long, noisy, mid-frequency." },
};

export const CLICK_LANGUAGES = [
  {
    id: "taa", name: "Taa (ǃXóõ)", family: "Tuu",
    clicks: ["ʘ", "ǀ", "ǃ", "ǂ", "ǁ"],
    note: "All five click influxes, plus the largest consonant inventory of any documented language. Clicks are ordinary consonants filling onset position.",
  },
  {
    id: "nama", name: "Nama (Khoekhoe)", family: "Khoe",
    clicks: ["ǀ", "ǃ", "ǂ", "ǁ"],
    note: "Four influxes — no bilabial. Clicks pattern with the rest of the consonant system.",
  },
  {
    id: "xhosa", name: "Xhosa", family: "Bantu (borrowed)",
    clicks: ["ǀ", "ǃ", "ǁ"],
    note: "Three influxes, borrowed from Khoisan contact. Clicks are a minority of onsets in running speech.",
  },
];

// Illustrative click sequences. These are phonotactic demonstrations of how
// clicks distribute inside syllables — NOT lexical items from any language.
// For real speech, use the UCLA Phonetics Lab Archive (Ladefoged collection)
// and drop the WAVs into this panel.
export const CLICK_EXAMPLES = [
  { id: "cv-run", label: "CV syllables", seq: "ǃa ǀo ǂe ǁu ʘa", note: "One click onset per syllable, each followed by a voiced vowel." },
  { id: "dense", label: "Click-dense", seq: "ǃaǀ oǂ eǁ uʘ a", note: "Maximum click density — still interleaved with voiced material." },
  { id: "sparse", label: "Click-sparse", seq: "ǃa ta ma ǀo na sa", note: "Clicks as a minority of onsets, closer to running-speech statistics." },
  { id: "isolated", label: "Isolated clicks", seq: "ǃ ǀ ǂ ǁ ʘ", note: "Clicks stripped of vocalic context — the closest a human click gets to a coda, and still not close." },
];

// ------------------------------------------------------------ rhythm sources

export const RHYTHM_SOURCES = [
  {
    id: "morse", label: "Morse code", kind: "morse",
    note: "Text → dots and dashes. Symbol onsets carry the message; gap structure is the rhythm.",
    params: { text: "WHALE", unitMs: 60 },
  },
  {
    id: "euclid", label: "Euclidean E(k,n)", kind: "euclid",
    note: "k onsets distributed as evenly as possible over n steps. Generates most traditional bell patterns.",
    params: { k: 5, n: 13, stepMs: 90 },
  },
  {
    id: "clave", label: "Son clave", kind: "pattern",
    note: "3-2 son clave. Asymmetric, strongly grouped.",
    steps: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0], stepMs: 110,
  },
  {
    id: "amen", label: "Amen break (kick/snare)", kind: "pattern",
    note: "Simplified onset grid of the Amen break. Dense, syncopated.",
    steps: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1], stepMs: 105,
  },
  {
    id: "isochronous", label: "Isochronous (control)", kind: "pattern",
    note: "Perfectly even pulse. The control condition for every rhythm comparison — define it before you run, not after.",
    steps: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], stepMs: 110,
  },
  {
    id: "beatbox", label: "Beatbox pattern", kind: "pattern",
    note: "Kick/hat/snare style onset grid with mixed click timbres.",
    steps: [1, 0, 2, 0, 3, 0, 2, 1, 1, 0, 2, 0, 3, 2, 2, 0], stepMs: 100,
  },
];

// ------------------------------------------------------------ animal sources
// Synthesised approximations of impulsive biological signals, parameterised to
// match the published timing envelopes. Not recordings. Where the upstream
// WhAM pipeline has a matching prompt config in
// wham/generation/prompt_configs.py, the key is noted.

export const ANIMAL_SOURCES = [
  {
    id: "dolphin-echo", label: "Dolphin echolocation train", promptKey: null,
    note: "Accelerating click train closing on a target — ICI collapses from ~100 ms to a terminal buzz. Strong monotonic contour.",
    kind: "accel", nClicks: 22, startIci: 0.10, endIci: 0.008, centerHz: 8000, q: 0.7,
  },
  {
    id: "dolphin-burst", label: "Dolphin burst pulse", promptKey: "atlantic",
    note: "Very high repetition rate pulse train heard as a tonal squawk.",
    kind: "accel", nClicks: 40, startIci: 0.006, endIci: 0.004, centerHz: 6000, q: 0.6,
  },
  {
    id: "woodpecker", label: "Woodpecker drumming", promptKey: null,
    note: "~20 strikes at roughly 20 Hz with a decaying tail. Fast, near-isochronous, mechanically produced.",
    kind: "accel", nClicks: 18, startIci: 0.048, endIci: 0.062, centerHz: 1800, q: 1.1,
  },
  {
    id: "beluga", label: "Beluga click series", promptKey: "beluga",
    note: "Slower, irregular click series. Matches the 'beluga' prompt config upstream.",
    kind: "jitter", nClicks: 9, meanIci: 0.14, jitter: 0.35, centerHz: 5000, q: 0.9,
  },
  {
    id: "killer", label: "Killer whale click train", promptKey: "killer",
    note: "Matches the 'killer' prompt config upstream.",
    kind: "jitter", nClicks: 12, meanIci: 0.10, jitter: 0.25, centerHz: 4500, q: 0.9,
  },
  {
    id: "narwhal", label: "Narwhal click train", promptKey: "narwhal",
    note: "Matches the 'narwhal' prompt config upstream.",
    kind: "accel", nClicks: 16, startIci: 0.09, endIci: 0.02, centerHz: 7000, q: 0.8,
  },
  {
    id: "bat", label: "Bat feeding buzz", promptKey: null,
    note: "Terminal buzz — the most extreme accelerating contour in the library. Useful as a rhythm-space extremum.",
    kind: "accel", nClicks: 30, startIci: 0.05, endIci: 0.005, centerHz: 12000, q: 0.6,
  },
  {
    id: "impulses", label: "Random impulses (control)", promptKey: null,
    note: "4–8 uniformly random click positions in 2 s — the same control the upstream repo builds in data/testing_data/impulses/create_impulses.py.",
    kind: "random", nClicks: 6, span: 2.0, centerHz: 1000, q: 2.0,
  },
];
